import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { Court } from '../venue/entities/court.entity';
import { User } from '../user/entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateBookingDto } from './dto/create-booking.dto';

function buildCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: faker.string.uuid(),
    name: faker.word.words(2),
    sport: 'football',
    basePrice: faker.number.int({ min: 100_000, max: 500_000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Court;
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: faker.internet.password(),
    fullName: faker.person.fullName(),
    phone: faker.phone.number(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function buildCreateDto(
  overrides: Partial<CreateBookingDto> = {},
): CreateBookingDto {
  return {
    courtId: faker.string.uuid(),
    bookingDate: '2026-08-10',
    startTime: '09:00',
    endTime: '10:00',
    ...overrides,
  };
}

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let dataSource: DeepMocked<DataSource>;
  let redisService: DeepMocked<RedisService>;
  let realtimeGateway: DeepMocked<RealtimeGateway>;
  let queryRunner: DeepMocked<QueryRunner>;
  let manager: DeepMocked<EntityManager>;
  let queryBuilder: DeepMocked<SelectQueryBuilder<Booking>>;

  const LOCK_TOKEN = 'lock-token';

  beforeEach(() => {
    bookingRepo = createMock<Repository<Booking>>();
    dataSource = createMock<DataSource>();
    redisService = createMock<RedisService>();
    realtimeGateway = createMock<RealtimeGateway>();
    queryRunner = createMock<QueryRunner>();
    manager = createMock<EntityManager>();
    queryBuilder = createMock<SelectQueryBuilder<Booking>>();

    queryBuilder.setLock.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.getOne.mockResolvedValue(null);

    manager.createQueryBuilder.mockReturnValue(queryBuilder);
    manager.create.mockImplementation(
      ((_entity: unknown, data: unknown) => data) as typeof manager.create,
    );
    manager.save.mockImplementation((_entity, data) =>
      Promise.resolve(data as Booking),
    );

    (queryRunner as unknown as { manager: EntityManager }).manager = manager;
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    redisService.acquireLock.mockResolvedValue(LOCK_TOKEN);

    service = new BookingService(
      bookingRepo,
      dataSource,
      redisService,
      realtimeGateway,
    );
  });

  describe('create', () => {
    it('creates a PENDING booking when the slot is free (happy path)', async () => {
      const court = buildCourt();
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      const result = await service.create(user.id, dto);

      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice));
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        `lock:court:${dto.courtId}:${dto.bookingDate}:${dto.startTime}`,
        10,
      );
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:court:${dto.courtId}:${dto.bookingDate}:${dto.startTime}`,
        LOCK_TOKEN,
      );
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: dto.courtId,
        bookingDate: dto.bookingDate,
        startTime: dto.startTime,
        status: BookingStatus.PENDING,
      });
    });

    it('throws 409 immediately when the Redis lock cannot be acquired (layer 1)', async () => {
      redisService.acquireLock.mockResolvedValue(null);
      const dto = buildCreateDto();

      await expect(
        service.create(faker.string.uuid(), dto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
      expect(redisService.releaseLock).not.toHaveBeenCalled();
    });

    it('throws 409 when the pessimistic-locked row check finds an existing active booking (layer 2)', async () => {
      const court = buildCourt();
      const userId = faker.string.uuid();
      const dto = buildCreateDto({ courtId: court.id });
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(buildUser({ id: userId }));
        return Promise.resolve(null);
      });
      queryBuilder.getOne.mockResolvedValue(buildBookingRow());

      await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
    });

    it('converts a 23505 unique-violation from the insert into a 409 (layer 3)', async () => {
      const court = buildCourt();
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id });
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.save.mockRejectedValue({ driverError: { code: '23505' } });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
    });

    it('throws NotFoundException when the court does not exist', async () => {
      const dto = buildCreateDto();
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.create(faker.string.uuid(), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects when endTime is not after startTime, without touching Redis/DB', async () => {
      const dto = buildCreateDto({ startTime: '10:00', endTime: '09:00' });

      await expect(
        service.create(faker.string.uuid(), dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(redisService.acquireLock).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('sets status to CANCELLED, saves, and broadcasts the freed slot', async () => {
      const booking = buildBookingRow({ status: BookingStatus.CONFIRMED });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.cancel(booking.id);

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BookingStatus.CANCELLED }),
      );
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: booking.court.id,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        status: BookingStatus.CANCELLED,
      });
    });

    it('throws NotFoundException for a missing booking', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel(faker.string.uuid())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('reschedules to a new slot: broadcasts the old slot freed and the new slot taken', async () => {
      const court = buildCourt();
      const newCourt = buildCourt();
      const current = buildBookingRow({
        court,
        bookingDate: '2026-08-10',
        startTime: '09:00',
        endTime: '10:00',
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(current);
      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(newCourt);
        return Promise.resolve(null);
      });

      await service.update(current.id, {
        courtId: newCourt.id,
        bookingDate: '2026-08-11',
        startTime: '14:00',
        endTime: '15:00',
      });

      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: court.id,
        bookingDate: '2026-08-10',
        startTime: '09:00',
        status: BookingStatus.CANCELLED,
      });
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: newCourt.id,
        bookingDate: '2026-08-11',
        startTime: '14:00',
        status: BookingStatus.CONFIRMED,
      });
    });

    it('does not broadcast when the slot is unchanged', async () => {
      const current = buildBookingRow({
        bookingDate: '2026-08-10',
        startTime: '09:00',
      });
      bookingRepo.findOne.mockResolvedValue(current);

      await service.update(current.id, { bookingDate: '2026-08-10' });

      expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
    });
  });

  function buildBookingRow(overrides: Partial<Booking> = {}): Booking {
    return {
      id: faker.string.uuid(),
      court: buildCourt(),
      user: buildUser(),
      bookingDate: '2026-08-10',
      startTime: '09:00',
      endTime: '10:00',
      status: BookingStatus.PENDING,
      totalAmount: faker.number.int({ min: 100_000, max: 500_000 }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }
});

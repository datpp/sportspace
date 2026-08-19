import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Role } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Court } from '../venue/entities/court.entity';
import { Venue } from '../venue/entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AddOnService } from '../addon-services/entities/add-on-service.entity';
import { BookingServiceItem } from '../addon-services/entities/booking-service-item.entity';
import { RedisService } from '../redis/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateBookingDto } from './dto/create-booking.dto';

function buildCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: faker.string.uuid(),
    venue: { id: faker.string.uuid() } as Venue,
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

function buildAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.PLAYER,
    ...overrides,
  };
}

function buildPaymentRow(overrides: Partial<Payment> = {}): Payment {
  return {
    id: faker.string.uuid(),
    booking: { id: faker.string.uuid() } as Booking,
    provider: 'VNPAY',
    amount: 200000,
    status: PaymentStatus.PAID,
    refundAmount: null,
    transactionRef: faker.string.alphanumeric(16),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('BookingService', () => {
  let service: BookingService;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let paymentRepo: DeepMocked<Repository<Payment>>;
  let dataSource: DeepMocked<DataSource>;
  let redisService: DeepMocked<RedisService>;
  let realtimeGateway: DeepMocked<RealtimeGateway>;
  let notificationService: DeepMocked<NotificationService>;
  let paymentService: DeepMocked<PaymentService>;
  let systemConfigService: DeepMocked<SystemConfigService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let manager: DeepMocked<EntityManager>;
  let queryBuilder: DeepMocked<SelectQueryBuilder<Booking>>;

  const LOCK_TOKEN = 'lock-token';

  beforeEach(() => {
    bookingRepo = createMock<Repository<Booking>>();
    paymentRepo = createMock<Repository<Payment>>();
    dataSource = createMock<DataSource>();
    redisService = createMock<RedisService>();
    realtimeGateway = createMock<RealtimeGateway>();
    notificationService = createMock<NotificationService>();
    paymentService = createMock<PaymentService>();
    systemConfigService = createMock<SystemConfigService>();
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
    paymentRepo.findOne.mockResolvedValue(null);
    paymentRepo.save.mockImplementation((p) => Promise.resolve(p as Payment));
    systemConfigService.get.mockResolvedValue({
      id: 'config-1',
      cancellationFullRefundHours: 24,
      cancellationPartialRefundHours: 2,
      cancellationPartialRefundPercent: 50,
      platformCommissionPercent: 10,
      updatedAt: new Date(),
    });

    service = new BookingService(
      bookingRepo,
      paymentRepo,
      dataSource,
      redisService,
      realtimeGateway,
      notificationService,
      paymentService,
      systemConfigService,
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

    it('creates a booking with zero services unchanged (regression)', async () => {
      const court = buildCourt();
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      const result = await service.create(user.id, dto);

      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice));
      expect(result.services).toBeUndefined();
    });

    it('adds one service to totalAmount and returns the itemized summary', async () => {
      const court = buildCourt();
      const user = buildUser();
      const addOnServiceId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [{ addOnServiceId, quantity: 2 }],
      });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === AddOnService) {
          return Promise.resolve([
            {
              id: addOnServiceId,
              name: 'Thuê bóng',
              price: 20000,
              isActive: true,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService,
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.create(user.id, dto);

      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice) + 40000);
      expect(result.services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
      ]);
    });

    it('sums multiple services with different quantities into totalAmount', async () => {
      const court = buildCourt();
      const user = buildUser();
      const serviceAId = faker.string.uuid();
      const serviceBId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [
          { addOnServiceId: serviceAId, quantity: 2 },
          { addOnServiceId: serviceBId, quantity: 3 },
        ],
      });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === AddOnService) {
          return Promise.resolve([
            {
              id: serviceAId,
              name: 'Thuê bóng',
              price: 20000,
              isActive: true,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService,
            {
              id: serviceBId,
              name: 'Nước uống',
              price: 10000,
              isActive: true,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService,
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await service.create(user.id, dto);

      // base price + (2 * 20000) + (3 * 10000) = base + 70000
      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice) + 70000);
      expect(result.services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
        expect.objectContaining({ name: 'Nước uống', quantity: 3, unitPrice: 10000 }),
      ]);
    });

    it('rejects a service ID that belongs to a different venue', async () => {
      const court = buildCourt();
      const user = buildUser();
      const addOnServiceId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [{ addOnServiceId, quantity: 1 }],
      });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === AddOnService) {
          return Promise.resolve([
            {
              id: addOnServiceId,
              name: 'Thuê bóng',
              price: 20000,
              isActive: true,
              venue: { id: 'a-completely-different-venue-id' },
            } as AddOnService,
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects booking a service that has been deactivated (isActive: false)', async () => {
      const court = buildCourt();
      const user = buildUser();
      const addOnServiceId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [{ addOnServiceId, quantity: 1 }],
      });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === AddOnService) {
          return Promise.resolve([
            {
              id: addOnServiceId,
              name: 'Thuê bóng',
              price: 20000,
              isActive: false,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService,
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('sets status to CANCELLED, saves, and broadcasts the freed slot', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ id: owner.id }),
      );

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

    it('leaves the payment untouched when the booking was never paid (still PENDING)', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.PENDING,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ id: owner.id }),
      );

      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(result.payment).toBeUndefined();
    });

    it('refunds 100% and marks the payment REFUNDED when cancelling >24h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:00`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ id: owner.id }),
      );

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 200000,
        }),
      );
      expect(result.payment).toEqual({
        status: PaymentStatus.REFUNDED,
        refundAmount: 200000,
      });
    });

    it('refunds 50% and marks the payment REFUNDED when cancelling 2-24h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 10 * 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:00`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ id: owner.id }),
      );

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 100000,
        }),
      );
      expect(result.payment).toEqual({
        status: PaymentStatus.REFUNDED,
        refundAmount: 100000,
      });
    });

    it('keeps the payment PAID with refundAmount 0 when cancelling <2h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:${String(slotStart.getUTCMinutes()).padStart(2, '0')}`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ id: owner.id }),
      );

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PAID,
          refundAmount: 0,
        }),
      );
      expect(result.payment).toEqual({
        status: PaymentStatus.PAID,
        refundAmount: 0,
      });
    });

    it('is a no-op the second time an already-CANCELLED booking is cancelled', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CANCELLED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(bookingRepo.save).not.toHaveBeenCalled();
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
      expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a missing booking', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.cancel(faker.string.uuid(), buildAuthUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when a different PLAYER tries to cancel', async () => {
      const booking = buildBookingRow({ user: buildUser() });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.cancel(booking.id, buildAuthUser({ role: Role.PLAYER })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it('allows an ADMIN to cancel any booking', async () => {
      const booking = buildBookingRow({
        user: buildUser(),
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.cancel(
        booking.id,
        buildAuthUser({ role: Role.ADMIN }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('merchantConfirm', () => {
    it('confirms a PENDING booking owned by the calling MERCHANT', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantConfirm(
        booking.id,
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: booking.court.id,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        status: BookingStatus.CONFIRMED,
      });
      expect(notificationService.notify).toHaveBeenCalledWith(
        booking.user.id,
        expect.any(String),
        expect.any(String),
      );
    });

    it('throws ForbiddenException when a non-owning MERCHANT tries to confirm', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantConfirm(
          booking.id,
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the booking is not PENDING', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantConfirm(
          booking.id,
          buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('merchantReject', () => {
    it('cancels a PENDING booking without touching payment (nothing was paid)', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'Sân đang bảo trì' },
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(paymentService.refundFull).not.toHaveBeenCalled();
    });

    it('cancels a CONFIRMED booking and triggers a full refund', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'Sân đang bảo trì' },
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(paymentService.refundFull).toHaveBeenCalledWith(booking.id);
    });

    it('throws ConflictException when the booking is already CANCELLED', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CANCELLED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantReject(
          booking.id,
          { reason: 'x' },
          buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows an ADMIN to reject any booking', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'x' },
        buildAuthUser({ role: Role.ADMIN }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });

  describe('findAllForMerchant', () => {
    function mockQb(bookings: Booking[], total: number) {
      const qb = createMock<SelectQueryBuilder<Booking>>();
      qb.leftJoinAndSelect.mockReturnThis();
      qb.innerJoin.mockReturnThis();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.orderBy.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getManyAndCount.mockResolvedValue([bookings, total]);
      bookingRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('returns paginated bookings scoped to the merchant via the query builder', async () => {
      const merchantId = faker.string.uuid();
      const bookings = [buildBookingRow(), buildBookingRow()];
      const qb = mockQb(bookings, 2);

      const result = await service.findAllForMerchant(merchantId, {
        page: 1,
        limit: 20,
      });

      expect(qb.where).toHaveBeenCalledWith('venue.owner = :merchantId', {
        merchantId,
      });
      expect(result.data).toBe(bookings);
      expect(result.meta).toMatchObject({ total: 2, page: 1, limit: 20 });
    });

    it('defaults to PENDING+CONFIRMED statuses when no status filter is given', async () => {
      const qb = mockQb([], 0);

      await service.findAllForMerchant(faker.string.uuid(), {
        page: 1,
        limit: 20,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'booking.status IN (:...statuses)',
        { statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      );
    });

    it('filters by an explicit status and skips the default status filter', async () => {
      const qb = mockQb([], 0);

      await service.findAllForMerchant(faker.string.uuid(), {
        page: 1,
        limit: 20,
        status: BookingStatus.CANCELLED,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('booking.status = :status', {
        status: BookingStatus.CANCELLED,
      });
    });

    it('does not filter by status when status=ALL', async () => {
      const qb = mockQb([], 0);

      await service.findAllForMerchant(faker.string.uuid(), {
        page: 1,
        limit: 20,
        status: 'ALL',
      });

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('booking.status'),
        expect.anything(),
      );
    });
  });

  describe('findAll', () => {
    it("scopes a PLAYER's results to their own bookings", async () => {
      const user = buildAuthUser({ role: Role.PLAYER });
      bookingRepo.find.mockResolvedValue([]);

      await service.findAll(user);

      expect(bookingRepo.find).toHaveBeenCalledWith({
        where: { user: { id: user.id } },
        relations: { court: true, user: true },
      });
    });

    it('returns every booking for an ADMIN, unfiltered', async () => {
      const user = buildAuthUser({ role: Role.ADMIN });
      bookingRepo.find.mockResolvedValue([]);

      await service.findAll(user);

      expect(bookingRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: { court: true, user: true },
      });
    });

    it('attaches a payment summary only to bookings that have a payment', async () => {
      const paidBooking = buildBookingRow();
      const unpaidBooking = buildBookingRow();
      const payment = buildPaymentRow({
        booking: { id: paidBooking.id } as Booking,
        status: PaymentStatus.REFUNDED,
        refundAmount: 100000,
      });
      bookingRepo.find.mockResolvedValue([paidBooking, unpaidBooking]);
      paymentRepo.find.mockResolvedValue([payment]);

      const result = await service.findAll(buildAuthUser({ role: Role.ADMIN }));

      expect(result.find((b) => b.id === paidBooking.id)?.payment).toEqual({
        status: PaymentStatus.REFUNDED,
        refundAmount: 100000,
      });
      expect(
        result.find((b) => b.id === unpaidBooking.id)?.payment,
      ).toBeUndefined();
    });

    it('attaches itemized service summaries to each booking that has them', async () => {
      const user = buildUser();
      const booking = { id: faker.string.uuid(), user, court: buildCourt() } as Booking;
      bookingRepo.find.mockResolvedValue([booking]);
      paymentRepo.find.mockResolvedValue([]);
      const serviceItemRepo = createMock<Repository<BookingServiceItem>>();
      serviceItemRepo.find.mockResolvedValue([
        {
          id: 'item-1',
          booking: { id: booking.id } as Booking,
          addOnService: { name: 'Thuê bóng' } as AddOnService,
          quantity: 2,
          unitPrice: 20000,
        } as BookingServiceItem,
      ]);
      dataSource.getRepository.mockImplementation((entity: unknown) => {
        if (entity === BookingServiceItem) return serviceItemRepo;
        throw new Error(`Unexpected entity in test: ${String(entity)}`);
      });

      const result = await service.findAll(buildAuthUser({ id: user.id, role: Role.PLAYER }));

      expect(result[0].services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
      ]);
    });
  });

  describe('findOne', () => {
    it('throws ForbiddenException when a different PLAYER requests the booking', async () => {
      const booking = buildBookingRow({ user: buildUser() });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.findOne(booking.id, buildAuthUser({ role: Role.PLAYER })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the owner to fetch their own booking', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({ user: owner });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.findOne(booking.id, buildAuthUser({ id: owner.id })),
      ).resolves.toBe(booking);
    });

    it('allows an ADMIN to fetch any booking', async () => {
      const booking = buildBookingRow({ user: buildUser() });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.findOne(booking.id, buildAuthUser({ role: Role.ADMIN })),
      ).resolves.toBe(booking);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when a different PLAYER tries to delete', async () => {
      const booking = buildBookingRow({ user: buildUser() });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.remove(booking.id, buildAuthUser({ role: Role.PLAYER })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes when the caller owns the booking', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({ user: owner });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.delete.mockResolvedValue({ affected: 1, raw: undefined });

      await service.remove(booking.id, buildAuthUser({ id: owner.id }));

      expect(bookingRepo.delete).toHaveBeenCalledWith(booking.id);
    });
  });

  describe('update', () => {
    it('reschedules to a new slot: broadcasts the old slot freed and the new slot taken', async () => {
      const court = buildCourt();
      const newCourt = buildCourt();
      const owner = buildUser();
      const current = buildBookingRow({
        court,
        user: owner,
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

      await service.update(
        current.id,
        {
          courtId: newCourt.id,
          bookingDate: '2026-08-11',
          startTime: '14:00',
          endTime: '15:00',
        },
        buildAuthUser({ id: owner.id }),
      );

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
      const owner = buildUser();
      const current = buildBookingRow({
        user: owner,
        bookingDate: '2026-08-10',
        startTime: '09:00',
      });
      bookingRepo.findOne.mockResolvedValue(current);

      await service.update(
        current.id,
        { bookingDate: '2026-08-10' },
        buildAuthUser({ id: owner.id }),
      );

      expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a different PLAYER tries to reschedule', async () => {
      const current = buildBookingRow({ user: buildUser() });
      bookingRepo.findOne.mockResolvedValue(current);

      await expect(
        service.update(
          current.id,
          { bookingDate: '2026-08-12' },
          buildAuthUser({ role: Role.PLAYER }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getMerchantRevenueTimeseries', () => {
    let revenueQueryBuilder: DeepMocked<SelectQueryBuilder<Booking>>;

    beforeEach(() => {
      revenueQueryBuilder = createMock<SelectQueryBuilder<Booking>>();
      revenueQueryBuilder.innerJoin.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.where.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.andWhere.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.select.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.addSelect.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.groupBy.mockReturnValue(revenueQueryBuilder);
      revenueQueryBuilder.getRawMany.mockResolvedValue([]);
      bookingRepo.createQueryBuilder.mockReturnValue(revenueQueryBuilder);
    });

    it('zero-fills all 7 day-buckets for range=week when there is no revenue', async () => {
      const merchantId = faker.string.uuid();

      const result = await service.getMerchantRevenueTimeseries(merchantId, {
        range: 'week',
      });

      expect(result).toHaveLength(7);
      expect(result.every((p) => p.revenue === 0 && p.bookings === 0)).toBe(
        true,
      );
      expect(result.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.bucket))).toBe(
        true,
      );
      expect(revenueQueryBuilder.where).toHaveBeenCalledWith(
        'venue.owner = :merchantId',
        { merchantId },
      );
      expect(revenueQueryBuilder.andWhere).toHaveBeenCalledWith(
        'booking.status = :status',
        { status: BookingStatus.CONFIRMED },
      );
    });

    it('merges a real row into the matching day bucket, leaving the rest zero', async () => {
      const buckets = (
        service as unknown as {
          buildTimeseriesBuckets: (range: 'week' | 'month' | 'year') => {
            buckets: string[];
          };
        }
      ).buildTimeseriesBuckets('week').buckets;
      const targetBucket = buckets[3];
      revenueQueryBuilder.getRawMany.mockResolvedValue([
        { bucket: targetBucket, revenue: '450000.00', bookings: '2' },
      ]);

      const result = await service.getMerchantRevenueTimeseries(
        faker.string.uuid(),
        { range: 'week' },
      );

      expect(result.find((p) => p.bucket === targetBucket)).toEqual({
        bucket: targetBucket,
        revenue: 450000,
        bookings: 2,
      });
      expect(
        result
          .filter((p) => p.bucket !== targetBucket)
          .every((p) => p.revenue === 0 && p.bookings === 0),
      ).toBe(true);
    });

    it('produces 30 day-buckets for range=month (default)', async () => {
      const result = await service.getMerchantRevenueTimeseries(
        faker.string.uuid(),
        {},
      );
      expect(result).toHaveLength(30);
    });

    it('produces 12 YYYY-MM month-buckets for range=year', async () => {
      const result = await service.getMerchantRevenueTimeseries(
        faker.string.uuid(),
        { range: 'year' },
      );
      expect(result).toHaveLength(12);
      expect(result.every((p) => /^\d{4}-\d{2}$/.test(p.bucket))).toBe(true);
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

import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus, CourtStatus, Role } from '@sportspace/shared';
import { CourtService } from './court.service';
import { Court } from './entities/court.entity';
import { Venue } from './entities/venue.entity';
import { PriceRule } from './entities/price-rule.entity';
import { CourtBlock } from './entities/court-block.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    role: Role.MERCHANT,
    ...overrides,
  } as User;
}

function buildVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: faker.string.uuid(),
    owner: buildUser(),
    name: faker.company.name(),
    ...overrides,
  } as Venue;
}

function buildCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: faker.string.uuid(),
    venue: buildVenue(),
    name: 'Sân 1',
    sport: 'football',
    basePrice: 200_000,
    status: CourtStatus.ACTIVE,
    ...overrides,
  } as Court;
}

function buildAuthUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.MERCHANT,
    ...overrides,
  };
}

describe('CourtService', () => {
  let service: CourtService;
  let courtRepo: DeepMocked<Repository<Court>>;
  let dataSource: DeepMocked<DataSource>;
  let venueRepo: DeepMocked<Repository<Venue>>;
  let priceRuleRepo: DeepMocked<Repository<PriceRule>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let blockRepo: DeepMocked<Repository<CourtBlock>>;

  beforeEach(() => {
    courtRepo = createMock<Repository<Court>>();
    venueRepo = createMock<Repository<Venue>>();
    priceRuleRepo = createMock<Repository<PriceRule>>();
    bookingRepo = createMock<Repository<Booking>>();
    blockRepo = createMock<Repository<CourtBlock>>();
    dataSource = createMock<DataSource>();

    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Venue) return venueRepo;
      if (entity === PriceRule) return priceRuleRepo;
      if (entity === Booking) return bookingRepo;
      if (entity === CourtBlock) return blockRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    courtRepo.create.mockImplementation(
      ((data: object) => data) as typeof courtRepo.create,
    );
    courtRepo.save.mockImplementation((c) => Promise.resolve(c as Court));
    priceRuleRepo.create.mockImplementation(
      ((data: object) => data) as typeof priceRuleRepo.create,
    );
    priceRuleRepo.save.mockImplementation((p) =>
      Promise.resolve(p as PriceRule),
    );
    bookingRepo.find.mockResolvedValue([]);
    blockRepo.find.mockResolvedValue([]);

    service = new CourtService(courtRepo, dataSource);
  });

  describe('create', () => {
    it('throws NotFoundException when the venue does not exist', async () => {
      venueRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          {
            venueId: faker.string.uuid(),
            name: 'A',
            sport: 'football',
            basePrice: 100_000,
          },
          buildAuthUser(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester does not own the venue', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.create(
          {
            venueId: venue.id,
            name: 'A',
            sport: 'football',
            basePrice: 100_000,
          },
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates the court when the requester owns the venue', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.create(
        {
          venueId: venue.id,
          name: 'Sân 2',
          sport: 'tennis',
          basePrice: 150_000,
        },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.name).toBe('Sân 2');
      expect(courtRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the court does not exist', async () => {
      courtRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(faker.string.uuid())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('denies a non-owner, non-admin from updating the court', async () => {
      const court = buildCourt();
      courtRepo.findOne.mockResolvedValue(court);

      await expect(
        service.update(
          court.id,
          { name: 'X' },
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('price rules', () => {
    it('denies adding a price rule when the requester does not own the venue', async () => {
      const court = buildCourt();
      courtRepo.findOne.mockResolvedValue(court);

      await expect(
        service.addPriceRule(
          court.id,
          {
            dayOfWeek: 1,
            startTime: '18:00',
            endTime: '20:00',
            price: 300_000,
          },
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when removing a price rule that does not exist for the court', async () => {
      const owner = buildUser();
      const court = buildCourt({ venue: buildVenue({ owner }) });
      courtRepo.findOne.mockResolvedValue(court);
      priceRuleRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(
        service.removePriceRule(
          court.id,
          faker.string.uuid(),
          buildAuthUser({ id: owner.id }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getSlots', () => {
    it('marks the slot matching an existing booking as unavailable and uses the price rule when it matches', async () => {
      const court = buildCourt({ basePrice: 200_000 });
      courtRepo.findOne.mockResolvedValue(court);
      bookingRepo.find.mockResolvedValue([{ startTime: '09:00' } as Booking]);
      priceRuleRepo.findOne.mockImplementation((options: any) => {
        if (options.where.startTime.value === '09:00') {
          return Promise.resolve({ price: 350_000 } as PriceRule);
        }
        return Promise.resolve(null);
      });

      const slots = await service.getSlots(court.id, { date: '2026-09-01' });

      const nineAm = slots.find((s) => s.startTime === '09:00');
      expect(nineAm?.available).toBe(false);
      expect(nineAm?.price).toBe(350_000);

      const tenAm = slots.find((s) => s.startTime === '10:00');
      expect(tenAm?.available).toBe(true);
      expect(tenAm?.price).toBe(200_000);
    });

    it('marks every slot unavailable when the court is under MAINTENANCE', async () => {
      const court = buildCourt({ status: CourtStatus.MAINTENANCE });
      courtRepo.findOne.mockResolvedValue(court);
      bookingRepo.find.mockResolvedValue([]);
      blockRepo.find.mockResolvedValue([]);
      priceRuleRepo.findOne.mockResolvedValue(null);

      const slots = await service.getSlots(court.id, { date: '2026-09-01' });

      expect(slots.every((s) => s.available === false)).toBe(true);
    });

    it('marks a slot unavailable when it overlaps a CourtBlock', async () => {
      const court = buildCourt({ status: CourtStatus.ACTIVE });
      courtRepo.findOne.mockResolvedValue(court);
      bookingRepo.find.mockResolvedValue([]);
      blockRepo.find.mockResolvedValue([
        {
          id: 'blk1',
          court,
          blockDate: '2026-09-01',
          startTime: '10:30:00',
          endTime: '11:30:00',
          reason: 'x',
          createdAt: new Date(),
        } as CourtBlock,
      ]);
      priceRuleRepo.findOne.mockResolvedValue(null);

      const slots = await service.getSlots(court.id, { date: '2026-09-01' });

      const slot10 = slots.find((s) => s.startTime === '10:00');
      const slot11 = slots.find((s) => s.startTime === '11:00');
      const slot12 = slots.find((s) => s.startTime === '12:00');
      expect(slot10?.available).toBe(false);
      expect(slot11?.available).toBe(false);
      expect(slot12?.available).toBe(true);
    });
  });

  describe('createBlock', () => {
    it('creates a block when user is the venue owner', async () => {
      const owner = buildUser();
      const court = buildCourt({ venue: buildVenue({ owner }) });
      courtRepo.findOne.mockResolvedValue(court);
      const blockRepo = createMock<Repository<CourtBlock>>();
      blockRepo.find.mockResolvedValue([]);
      blockRepo.create.mockImplementation(
        ((data: object) => data) as typeof blockRepo.create,
      );
      blockRepo.save.mockImplementation((b) =>
        Promise.resolve(b as CourtBlock),
      );
      dataSource.getRepository.mockImplementation((entity: unknown) => {
        if (entity === Booking) return bookingRepo;
        if (entity === CourtBlock) return blockRepo;
        throw new Error(`Unexpected entity in test: ${String(entity)}`);
      });

      const result = await service.createBlock(
        court.id,
        {
          blockDate: '2026-09-01',
          startTime: '10:00',
          endTime: '11:00',
          reason: 'Bảo trì mặt sân',
        },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.reason).toBe('Bảo trì mặt sân');
    });

    it('rejects a block that overlaps an existing active booking (409)', async () => {
      const owner = buildUser();
      const court = buildCourt({ venue: buildVenue({ owner }) });
      courtRepo.findOne.mockResolvedValue(court);
      bookingRepo.find.mockResolvedValue([
        {
          id: 'b1',
          bookingDate: '2026-09-01',
          startTime: '10:30:00',
          endTime: '11:30:00',
          status: BookingStatus.CONFIRMED,
        } as Booking,
      ]);
      dataSource.getRepository.mockImplementation((entity: unknown) => {
        if (entity === Booking) return bookingRepo;
        throw new Error(`Unexpected entity in test: ${String(entity)}`);
      });

      await expect(
        service.createBlock(
          court.id,
          {
            blockDate: '2026-09-01',
            startTime: '10:00',
            endTime: '11:00',
            reason: 'Bảo trì',
          },
          buildAuthUser({ id: owner.id }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when user is not the venue owner', async () => {
      const court = buildCourt();
      courtRepo.findOne.mockResolvedValue(court);

      await expect(
        service.createBlock(
          court.id,
          {
            blockDate: '2026-09-01',
            startTime: '10:00',
            endTime: '11:00',
            reason: 'X',
          },
          buildAuthUser(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

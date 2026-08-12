import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  MatchParticipantStatus,
  MatchStatus,
  Role,
} from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { MatchingService } from './matching.service';
import { Match } from './entities/match.entity';
import { MatchParticipant } from './entities/match-participant.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    role: Role.PLAYER,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
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

function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: faker.string.uuid(),
    court: undefined as never,
    user: buildUser(),
    bookingDate: '2026-09-01',
    startTime: '09:00',
    endTime: '10:00',
    status: BookingStatus.CONFIRMED,
    totalAmount: 200000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: faker.string.uuid(),
    booking: buildBooking(),
    host: buildUser(),
    participants: [],
    slotsTotal: 3,
    slotsFilled: 0,
    skillLevel: 'trung bình',
    status: MatchStatus.OPEN,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildParticipant(
  overrides: Partial<MatchParticipant> = {},
): MatchParticipant {
  return {
    id: faker.string.uuid(),
    match: buildMatch(),
    user: buildUser(),
    status: MatchParticipantStatus.REQUESTED,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('MatchingService', () => {
  let service: MatchingService;
  let matchRepo: DeepMocked<Repository<Match>>;
  let participantRepo: DeepMocked<Repository<MatchParticipant>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let dataSource: DeepMocked<DataSource>;
  let queryRunner: DeepMocked<QueryRunner>;
  let manager: DeepMocked<EntityManager>;
  let lockQueryBuilder: DeepMocked<SelectQueryBuilder<Match>>;
  let findAllQueryBuilder: DeepMocked<SelectQueryBuilder<Match>>;

  beforeEach(() => {
    matchRepo = createMock<Repository<Match>>();
    participantRepo = createMock<Repository<MatchParticipant>>();
    bookingRepo = createMock<Repository<Booking>>();
    dataSource = createMock<DataSource>();
    queryRunner = createMock<QueryRunner>();
    manager = createMock<EntityManager>();
    lockQueryBuilder = createMock<SelectQueryBuilder<Match>>();
    findAllQueryBuilder = createMock<SelectQueryBuilder<Match>>();

    lockQueryBuilder.setLock.mockReturnValue(lockQueryBuilder);
    lockQueryBuilder.innerJoinAndSelect.mockReturnValue(lockQueryBuilder);
    lockQueryBuilder.where.mockReturnValue(lockQueryBuilder);

    findAllQueryBuilder.leftJoinAndSelect.mockReturnValue(findAllQueryBuilder);
    findAllQueryBuilder.where.mockReturnValue(findAllQueryBuilder);
    findAllQueryBuilder.andWhere.mockReturnValue(findAllQueryBuilder);
    findAllQueryBuilder.orderBy.mockReturnValue(findAllQueryBuilder);
    findAllQueryBuilder.getMany.mockResolvedValue([]);

    matchRepo.createQueryBuilder.mockReturnValue(findAllQueryBuilder);
    manager.createQueryBuilder.mockReturnValue(lockQueryBuilder);
    manager.save.mockImplementation((_entity, data) => Promise.resolve(data));

    (queryRunner as unknown as { manager: EntityManager }).manager = manager;
    dataSource.createQueryRunner.mockReturnValue(queryRunner);

    matchRepo.create.mockImplementation((data) => data as Match);
    matchRepo.save.mockImplementation((m) => Promise.resolve(m as Match));
    participantRepo.create.mockImplementation(
      (data) => data as MatchParticipant,
    );
    participantRepo.save.mockImplementation((p) =>
      Promise.resolve(p as MatchParticipant),
    );

    service = new MatchingService(
      matchRepo,
      participantRepo,
      bookingRepo,
      dataSource,
    );
  });

  describe('create', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(faker.string.uuid(), {
          bookingId: faker.string.uuid(),
          slotsTotal: 3,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the caller does not own the booking', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create(faker.string.uuid(), {
          bookingId: booking.id,
          slotsTotal: 3,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the booking is not CONFIRMED', async () => {
      const owner = buildUser();
      const booking = buildBooking({
        user: owner,
        status: BookingStatus.PENDING,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create(owner.id, { bookingId: booking.id, slotsTotal: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the booking already has a match', async () => {
      const owner = buildUser();
      const booking = buildBooking({ user: owner });
      bookingRepo.findOne.mockResolvedValue(booking);
      matchRepo.findOne.mockResolvedValue(buildMatch({ booking }));
      await expect(
        service.create(owner.id, { bookingId: booking.id, slotsTotal: 3 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an OPEN match with slotsFilled = 0', async () => {
      const owner = buildUser();
      const booking = buildBooking({ user: owner });
      bookingRepo.findOne.mockResolvedValue(booking);
      matchRepo.findOne.mockResolvedValue(null);

      const result = await service.create(owner.id, {
        bookingId: booking.id,
        slotsTotal: 4,
        skillLevel: 'khá',
      });

      expect(result.status).toBe(MatchStatus.OPEN);
      expect(result.slotsFilled).toBe(0);
      expect(result.slotsTotal).toBe(4);
    });
  });

  describe('findAll', () => {
    it('only queries OPEN matches', async () => {
      await service.findAll({});
      expect(findAllQueryBuilder.where).toHaveBeenCalledWith(
        'match.status = :status',
        { status: MatchStatus.OPEN },
      );
      expect(findAllQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('adds a sport filter when given', async () => {
      await service.findAll({ sport: 'football' });
      expect(findAllQueryBuilder.andWhere).toHaveBeenCalledWith(
        'court.sport = :sport',
        { sport: 'football' },
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a missing match', async () => {
      matchRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(faker.string.uuid())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when the caller is not the host', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.update(match.id, {}, buildAuthUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the match is already CLOSED', async () => {
      const host = buildUser();
      const match = buildMatch({ host, status: MatchStatus.CLOSED });
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.update(match.id, {}, buildAuthUser({ id: host.id })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows an ADMIN to update a match they do not host', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.update(
          match.id,
          { slotsTotal: 5 },
          buildAuthUser({ role: Role.ADMIN }),
        ),
      ).resolves.toEqual(expect.objectContaining({ slotsTotal: 5 }));
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when the caller is not the host', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.remove(match.id, buildAuthUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(matchRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('throws BadRequestException when the host tries to join their own match', async () => {
      const host = buildUser();
      const match = buildMatch({ host });
      matchRepo.findOne.mockResolvedValue(match);
      await expect(service.join(match.id, host.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the match is CLOSED', async () => {
      const match = buildMatch({ status: MatchStatus.CLOSED });
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.join(match.id, faker.string.uuid()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the user already has an active request', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      participantRepo.findOne.mockResolvedValue(buildParticipant());
      await expect(
        service.join(match.id, faker.string.uuid()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a REQUESTED participant on the happy path', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      participantRepo.findOne.mockResolvedValue(null);

      const result = await service.join(match.id, faker.string.uuid());

      expect(result.status).toBe(MatchParticipantStatus.REQUESTED);
    });
  });

  describe('acceptParticipant', () => {
    it('throws NotFoundException when the match does not exist', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(null);
      await expect(
        service.acceptParticipant(
          faker.string.uuid(),
          faker.string.uuid(),
          buildAuthUser(),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws ForbiddenException when the caller is not the host', async () => {
      const match = buildMatch();
      lockQueryBuilder.getOne.mockResolvedValue(match);
      await expect(
        service.acceptParticipant(
          match.id,
          faker.string.uuid(),
          buildAuthUser(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('throws BadRequestException when the match is already full', async () => {
      const host = buildUser();
      const match = buildMatch({ host, slotsTotal: 2, slotsFilled: 2 });
      lockQueryBuilder.getOne.mockResolvedValue(match);
      manager.findOne.mockResolvedValue(buildParticipant({ match }));

      await expect(
        service.acceptParticipant(
          match.id,
          faker.string.uuid(),
          buildAuthUser({ id: host.id }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('increments slotsFilled and keeps the match OPEN when under capacity', async () => {
      const host = buildUser();
      const match = buildMatch({ host, slotsTotal: 3, slotsFilled: 0 });
      const participant = buildParticipant({ match });
      lockQueryBuilder.getOne.mockResolvedValue(match);
      manager.findOne.mockResolvedValue(participant);

      const result = await service.acceptParticipant(
        match.id,
        participant.id,
        buildAuthUser({ id: host.id }),
      );

      expect(result.status).toBe(MatchParticipantStatus.ACCEPTED);
      expect(match.slotsFilled).toBe(1);
      expect(match.status).toBe(MatchStatus.OPEN);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('auto-closes the match once slotsFilled reaches slotsTotal', async () => {
      const host = buildUser();
      const match = buildMatch({ host, slotsTotal: 1, slotsFilled: 0 });
      const participant = buildParticipant({ match });
      lockQueryBuilder.getOne.mockResolvedValue(match);
      manager.findOne.mockResolvedValue(participant);

      await service.acceptParticipant(
        match.id,
        participant.id,
        buildAuthUser({ id: host.id }),
      );

      expect(match.slotsFilled).toBe(1);
      expect(match.status).toBe(MatchStatus.CLOSED);
    });
  });

  describe('rejectParticipant', () => {
    it('throws ForbiddenException when the caller is not the host', async () => {
      const match = buildMatch();
      matchRepo.findOne.mockResolvedValue(match);
      await expect(
        service.rejectParticipant(
          match.id,
          faker.string.uuid(),
          buildAuthUser(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('sets REJECTED and does not touch slotsFilled', async () => {
      const host = buildUser();
      const match = buildMatch({ host, slotsFilled: 0 });
      const participant = buildParticipant({ match });
      matchRepo.findOne.mockResolvedValue(match);
      participantRepo.findOne.mockResolvedValue(participant);

      const result = await service.rejectParticipant(
        match.id,
        participant.id,
        buildAuthUser({ id: host.id }),
      );

      expect(result.status).toBe(MatchParticipantStatus.REJECTED);
      expect(match.slotsFilled).toBe(0);
    });
  });
});

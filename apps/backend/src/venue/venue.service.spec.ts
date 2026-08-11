import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Role, VenueStatus } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    role: Role.MERCHANT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function buildVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: faker.string.uuid(),
    owner: buildUser(),
    name: faker.company.name(),
    address: faker.location.streetAddress(),
    lat: 10.76,
    lng: 106.66,
    status: VenueStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Venue;
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

describe('VenueService', () => {
  let service: VenueService;
  let venueRepo: DeepMocked<Repository<Venue>>;
  let queryBuilder: DeepMocked<SelectQueryBuilder<Venue>>;

  beforeEach(() => {
    venueRepo = createMock<Repository<Venue>>();
    queryBuilder = createMock<SelectQueryBuilder<Venue>>();

    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.innerJoin.mockReturnValue(queryBuilder);
    queryBuilder.distinct.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.setParameters.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.getMany.mockResolvedValue([]);
    venueRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    venueRepo.create.mockImplementation(
      ((data: object) => data) as typeof venueRepo.create,
    );
    venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));

    service = new VenueService(venueRepo);
  });

  describe('create', () => {
    it('creates a venue owned by the given user', async () => {
      const ownerId = faker.string.uuid();
      const dto = {
        name: faker.company.name(),
        address: faker.location.streetAddress(),
        lat: 10.76,
        lng: 106.66,
      };

      await service.create(ownerId, dto);

      expect(venueRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, owner: { id: ownerId } }),
      );
    });
  });

  describe('findByOwner', () => {
    it('queries venues filtered by owner id, newest first', async () => {
      const ownerId = faker.string.uuid();
      const owned = [buildVenue({ owner: buildUser({ id: ownerId }) })];
      venueRepo.find.mockResolvedValue(owned);

      const result = await service.findByOwner(ownerId);

      expect(venueRepo.find).toHaveBeenCalledWith({
        where: { owner: { id: ownerId } },
        relations: { courts: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(owned);
    });

    it("does not return another merchant's venues", async () => {
      venueRepo.find.mockResolvedValue([]);

      const result = await service.findByOwner(faker.string.uuid());

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('only searches APPROVED venues', async () => {
      await service.findAll({});

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'venue.status = :status',
        { status: VenueStatus.APPROVED },
      );
    });

    it('sorts by distance and binds lat/lng params when both are given', async () => {
      await service.findAll({ lat: 10.76, lng: 106.66 });

      expect(queryBuilder.addSelect).toHaveBeenCalled();
      expect(queryBuilder.setParameters).toHaveBeenCalledWith({
        lat: 10.76,
        lng: 106.66,
      });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('distance', 'ASC');
    });

    it('filters by sport via an inner join and de-dupes with distinct', async () => {
      await service.findAll({ sport: 'football' });

      expect(queryBuilder.innerJoin).toHaveBeenCalledWith(
        'venue.courts',
        'court',
        'court.sport = :sport',
        { sport: 'football' },
      );
      expect(queryBuilder.distinct).toHaveBeenCalledWith(true);
    });

    it('falls back to sorting by createdAt when no lat/lng is given', async () => {
      await service.findAll({});

      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'venue.createdAt',
        'DESC',
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the venue does not exist', async () => {
      venueRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(faker.string.uuid())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('allows the owner to update their venue', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.update(
        venue.id,
        { name: 'New name' },
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.name).toBe('New name');
    });

    it("allows an ADMIN to update someone else's venue", async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.update(
          venue.id,
          { name: 'X' },
          buildAuthUser({ role: Role.ADMIN }),
        ),
      ).resolves.toBeDefined();
    });

    it('denies a different MERCHANT from updating the venue', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.update(
          venue.id,
          { name: 'X' },
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('denies removal by a non-owner, non-admin user', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.remove(venue.id, buildAuthUser({ role: Role.PLAYER })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(venueRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('sets status to APPROVED and saves', async () => {
      const venue = buildVenue({ status: VenueStatus.PENDING });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.approve(venue.id);

      expect(result.status).toBe(VenueStatus.APPROVED);
      expect(venueRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VenueStatus.APPROVED }),
      );
    });

    it('throws NotFoundException for a missing venue', async () => {
      venueRepo.findOne.mockResolvedValue(null);
      await expect(service.approve(faker.string.uuid())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('reject', () => {
    it('sets status to REJECTED and saves', async () => {
      const venue = buildVenue({ status: VenueStatus.PENDING });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.reject(venue.id);

      expect(result.status).toBe(VenueStatus.REJECTED);
      expect(venueRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VenueStatus.REJECTED }),
      );
    });
  });
});

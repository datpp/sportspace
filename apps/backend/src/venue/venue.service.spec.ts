import * as fs from 'fs/promises';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CourtStatus, Role, VenueStatus } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { RedisService } from '../redis/redis.service';

jest.mock('fs/promises');

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
  let redisService: DeepMocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    venueRepo = createMock<Repository<Venue>>();
    queryBuilder = createMock<SelectQueryBuilder<Venue>>();
    redisService = createMock<RedisService>();
    redisService.acquireLock.mockResolvedValue('lock-token');

    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.innerJoin.mockReturnValue(queryBuilder);
    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.distinct.mockReturnValue(queryBuilder);
    queryBuilder.addSelect.mockReturnValue(queryBuilder);
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.setParameters.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);
    queryBuilder.getMany.mockResolvedValue([]);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    queryBuilder.getRawMany.mockResolvedValue([]);
    venueRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    venueRepo.create.mockImplementation(
      ((data: object) => data) as typeof venueRepo.create,
    );
    venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));

    service = new VenueService(venueRepo, redisService);
  });

  describe('create', () => {
    it('creates a venue owned by the given user', async () => {
      const ownerId = faker.string.uuid();
      const dto = {
        name: faker.company.name(),
        address: faker.location.streetAddress(),
        lat: 10.76,
        lng: 106.66,
        province: 'Hà Nội',
      };

      await service.create(ownerId, dto);

      expect(venueRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, owner: { id: ownerId } }),
      );
    });
  });

  describe('findByOwner', () => {
    it('queries venues filtered by owner id, newest first, and paginates', async () => {
      const ownerId = faker.string.uuid();
      const owned = [buildVenue({ owner: buildUser({ id: ownerId }) })];
      queryBuilder.getManyAndCount.mockResolvedValue([owned, 1]);

      const result = await service.findByOwner(ownerId, {
        page: 1,
        limit: 20,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'venue.owner = :ownerId',
        { ownerId },
      );
      expect(result.data).toBe(owned);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20 });
    });

    it("does not return another merchant's venues", async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByOwner(faker.string.uuid(), {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([]);
    });

    it('filters by status when provided', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findByOwner(faker.string.uuid(), {
        page: 1,
        limit: 20,
        status: VenueStatus.APPROVED,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'venue.status = :status',
        { status: VenueStatus.APPROVED },
      );
    });

    it('searches by name or address when q is provided', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findByOwner(faker.string.uuid(), {
        page: 1,
        limit: 20,
        q: 'san van dong',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(venue.name ILIKE :q OR venue.address ILIKE :q)',
        { q: '%san van dong%' },
      );
    });
  });

  describe('findAllForAdmin', () => {
    it('defaults to PENDING and paginates the result', async () => {
      const pending = [buildVenue({ status: VenueStatus.PENDING })];
      queryBuilder.getManyAndCount.mockResolvedValue([pending, 1]);

      const result = await service.findAllForAdmin({ page: 1, limit: 20 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'venue.status = :status',
        { status: VenueStatus.PENDING },
      );
      expect(result.data).toBe(pending);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20 });
    });

    it('queries by whatever status is passed in, not just PENDING', async () => {
      await service.findAllForAdmin({
        page: 1,
        limit: 20,
        status: VenueStatus.REJECTED,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'venue.status = :status',
        { status: VenueStatus.REJECTED },
      );
    });

    it('skips the status filter when status=ALL', async () => {
      await service.findAllForAdmin({ page: 1, limit: 20, status: 'ALL' });

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'venue.status = :status',
        expect.anything(),
      );
    });

    it('filters by search term across name, address, and owner', async () => {
      await service.findAllForAdmin({ page: 1, limit: 20, q: 'sports' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(venue.name ILIKE :q OR venue.address ILIKE :q OR owner.fullName ILIKE :q OR owner.email ILIKE :q)',
        { q: '%sports%' },
      );
    });

    it('filters by province', async () => {
      await service.findAllForAdmin({
        page: 1,
        limit: 20,
        province: 'Hà Nội',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'venue.province = :province',
        { province: 'Hà Nội' },
      );
    });
  });

  describe('listDistinctProvinces', () => {
    it('returns the distinct provinces currently in use', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { province: 'Hà Nội' },
        { province: 'Huế' },
      ]);

      const result = await service.listDistinctProvinces();

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'venue.province IS NOT NULL',
      );
      expect(result).toEqual(['Hà Nội', 'Huế']);
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
        'court.sport = :sport AND court.status = :courtStatus',
        { sport: 'football', courtStatus: CourtStatus.ACTIVE },
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

  describe('addImage', () => {
    it('writes the buffer to disk and appends the file path when the owner uploads', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      const result = await service.addImage(venue.id, authUser, file);

      expect(result.images).toEqual([
        expect.stringMatching(/^\/uploads\/venues\/.+\.jpg$/),
      ]);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.jpg'),
        file.buffer,
      );
    });

    it("derives the stored extension from the mimetype, ignoring originalname's extension", async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      // Attacker sends a validated image/jpeg mimetype but an
      // attacker-controlled .html filename — must not be trusted.
      const file = {
        originalname: 'payload.html',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      const result = await service.addImage(venue.id, authUser, file);

      expect(result.images[0]).toMatch(/^\/uploads\/venues\/.+\.jpg$/);
      expect(result.images[0]).not.toMatch(/\.html$/);
    });

    it('rejects a non-owner, non-admin uploader', async () => {
      const venue = buildVenue({ owner: buildUser(), images: [] });
      const otherUser = buildAuthUser({ id: 'someone-else', role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, otherUser, file)).rejects.toThrow(
        ForbiddenException,
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('rejects the 9th image past the 8-image cap', async () => {
      const owner = buildUser();
      const venue = buildVenue({
        owner,
        images: Array.from({ length: 8 }, (_, i) => `/uploads/venues/${i}.jpg`),
      });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      const file = {
        originalname: 'ninth.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, authUser, file)).rejects.toThrow(
        BadRequestException,
      );
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the images lock is already held', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      redisService.acquireLock.mockResolvedValue(null);
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, authUser, file)).rejects.toThrow(
        ConflictException,
      );
      expect(venueRepo.findOne).not.toHaveBeenCalled();
    });

    it('releases the lock after a successful upload', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      redisService.acquireLock.mockResolvedValue('token-abc');
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await service.addImage(venue.id, authUser, file);

      expect(redisService.acquireLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        expect.any(Number),
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        'token-abc',
      );
    });

    it('releases the lock even when the upload is rejected', async () => {
      const venue = buildVenue({ owner: buildUser(), images: [] });
      const otherUser = buildAuthUser({ id: 'someone-else', role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      redisService.acquireLock.mockResolvedValue('token-xyz');
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, otherUser, file)).rejects.toThrow(
        ForbiddenException,
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        'token-xyz',
      );
    });

    it('releases the lock even when an unexpected error occurs mid-operation (disk write failure)', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      redisService.acquireLock.mockResolvedValue('token-disk-fail');
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('disk full'));
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, authUser, file)).rejects.toThrow(
        'disk full',
      );
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        'token-disk-fail',
      );
      expect(venueRepo.save).not.toHaveBeenCalled();
    });

    it('does not attempt to release a lock it never acquired', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      redisService.acquireLock.mockResolvedValue(null);
      const file = {
        originalname: 'photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake-image-bytes'),
      } as Express.Multer.File;

      await expect(service.addImage(venue.id, authUser, file)).rejects.toThrow(
        ConflictException,
      );
      expect(redisService.releaseLock).not.toHaveBeenCalled();
    });
  });

  describe('removeImage', () => {
    it('removes the matching entry and best-effort deletes the file', async () => {
      const owner = buildUser();
      const venue = buildVenue({
        owner,
        images: ['/uploads/venues/a.jpg', '/uploads/venues/b.jpg'],
      });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeImage(
        venue.id,
        authUser,
        '/uploads/venues/a.jpg',
      );

      expect(result.images).toEqual(['/uploads/venues/b.jpg']);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('a.jpg'));
    });

    it('does not throw when the file is already gone from disk', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'ENOENT' }),
      );

      const result = await service.removeImage(
        venue.id,
        authUser,
        '/uploads/venues/a.jpg',
      );

      expect(result.images).toEqual([]);
    });

    it('rejects a non-owner, non-admin remover', async () => {
      const venue = buildVenue({ owner: buildUser(), images: ['/uploads/venues/a.jpg'] });
      const otherUser = buildAuthUser({ id: 'someone-else', role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.removeImage(venue.id, otherUser, '/uploads/venues/a.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects a url that does not belong to this venue's images, without touching disk", async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.removeImage(
          venue.id,
          authUser,
          '/uploads/venues/belongs-to-another-venue.jpg',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(venueRepo.save).not.toHaveBeenCalled();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the images lock is already held', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      redisService.acquireLock.mockResolvedValue(null);

      await expect(
        service.removeImage(venue.id, authUser, '/uploads/venues/a.jpg'),
      ).rejects.toThrow(ConflictException);
      expect(venueRepo.findOne).not.toHaveBeenCalled();
    });

    it('releases the lock after a successful removal', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      redisService.acquireLock.mockResolvedValue('token-def');
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await service.removeImage(venue.id, authUser, '/uploads/venues/a.jpg');

      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        'token-def',
      );
    });

    it('releases the lock even when the DB save fails mid-operation', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockRejectedValue(new Error('db connection lost'));
      redisService.acquireLock.mockResolvedValue('token-db-fail');

      await expect(
        service.removeImage(venue.id, authUser, '/uploads/venues/a.jpg'),
      ).rejects.toThrow('db connection lost');
      expect(redisService.releaseLock).toHaveBeenCalledWith(
        `lock:venue:${venue.id}:images`,
        'token-db-fail',
      );
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});

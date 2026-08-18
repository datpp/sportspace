import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { AddonServicesService } from './addon-services.service';
import { AddOnService } from './entities/add-on-service.entity';
import { Venue } from '../venue/entities/venue.entity';
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

function buildService(overrides: Partial<AddOnService> = {}): AddOnService {
  return {
    id: faker.string.uuid(),
    venue: buildVenue(),
    name: 'Thuê bóng',
    price: 20000,
    description: null,
    isActive: true,
    ...overrides,
  } as AddOnService;
}

function buildAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.MERCHANT,
    ...overrides,
  };
}

describe('AddonServicesService', () => {
  let service: AddonServicesService;
  let serviceRepo: DeepMocked<Repository<AddOnService>>;
  let dataSource: DeepMocked<DataSource>;
  let venueRepo: DeepMocked<Repository<Venue>>;

  beforeEach(() => {
    serviceRepo = createMock<Repository<AddOnService>>();
    venueRepo = createMock<Repository<Venue>>();
    dataSource = createMock<DataSource>();

    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Venue) return venueRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    serviceRepo.create.mockImplementation(((data: object) => data) as typeof serviceRepo.create);
    serviceRepo.save.mockImplementation((s) => Promise.resolve(s as AddOnService));

    service = new AddonServicesService(serviceRepo, dataSource);
  });

  describe('create', () => {
    it('tạo dịch vụ khi user là chủ sân', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.create(
        { venueId: venue.id, name: 'Thuê bóng', price: 20000 },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.name).toBe('Thuê bóng');
      expect(serviceRepo.save).toHaveBeenCalled();
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.create(
          { venueId: venue.id, name: 'X', price: 1000 },
          buildAuthUser({ id: faker.string.uuid() }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném NotFoundException khi venue không tồn tại', async () => {
      venueRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { venueId: faker.string.uuid(), name: 'X', price: 1000 },
          buildAuthUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('cập nhật isActive khi user là chủ sân', async () => {
      const owner = buildUser();
      const addOnService = buildService({ venue: buildVenue({ owner }) });
      serviceRepo.findOne.mockResolvedValue(addOnService);

      const result = await service.update(
        addOnService.id,
        { isActive: false },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.isActive).toBe(false);
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const addOnService = buildService();
      serviceRepo.findOne.mockResolvedValue(addOnService);

      await expect(
        service.update(addOnService.id, { isActive: false }, buildAuthUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('xoá dịch vụ khi user là chủ sân', async () => {
      const owner = buildUser();
      const addOnService = buildService({ venue: buildVenue({ owner }) });
      serviceRepo.findOne.mockResolvedValue(addOnService);

      await service.remove(addOnService.id, buildAuthUser({ id: owner.id }));

      expect(serviceRepo.remove).toHaveBeenCalledWith(addOnService);
    });
  });
});

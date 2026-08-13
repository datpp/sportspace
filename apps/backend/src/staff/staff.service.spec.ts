import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
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

function buildStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: faker.string.uuid(),
    venue: buildVenue(),
    fullName: faker.person.fullName(),
    phone: faker.phone.number(),
    position: 'Lễ tân',
    isActive: true,
    ...overrides,
  } as Staff;
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

describe('StaffService', () => {
  let service: StaffService;
  let staffRepo: DeepMocked<Repository<Staff>>;
  let dataSource: DeepMocked<DataSource>;
  let venueRepo: DeepMocked<Repository<Venue>>;

  beforeEach(() => {
    staffRepo = createMock<Repository<Staff>>();
    venueRepo = createMock<Repository<Venue>>();
    dataSource = createMock<DataSource>();

    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Venue) return venueRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    staffRepo.create.mockImplementation(
      ((data: object) => data) as typeof staffRepo.create,
    );
    staffRepo.save.mockImplementation((s) => Promise.resolve(s as Staff));

    service = new StaffService(staffRepo, dataSource);
  });

  describe('create', () => {
    it('tạo nhân viên khi user là chủ sân', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.create(
        {
          venueId: venue.id,
          fullName: 'Nguyễn Văn A',
          phone: '0900000000',
          position: 'Lễ tân',
        },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.fullName).toBe('Nguyễn Văn A');
      expect(staffRepo.save).toHaveBeenCalled();
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.create(
          {
            venueId: venue.id,
            fullName: 'X',
            phone: '0900000000',
            position: 'Lễ tân',
          },
          buildAuthUser({ id: faker.string.uuid(), role: Role.MERCHANT }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN tạo được nhân viên cho bất kỳ sân nào', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.create(
          {
            venueId: venue.id,
            fullName: 'X',
            phone: '0900000000',
            position: 'Lễ tân',
          },
          buildAuthUser({ role: Role.ADMIN }),
        ),
      ).resolves.toBeDefined();
    });

    it('ném NotFoundException khi venue không tồn tại', async () => {
      venueRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          {
            venueId: faker.string.uuid(),
            fullName: 'X',
            phone: '0900000000',
            position: 'Lễ tân',
          },
          buildAuthUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('cập nhật isActive khi user là chủ sân', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);

      const result = await service.update(
        staff.id,
        { isActive: false },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.isActive).toBe(false);
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const staff = buildStaff();
      staffRepo.findOne.mockResolvedValue(staff);

      await expect(
        service.update(staff.id, { isActive: false }, buildAuthUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('xoá nhân viên khi user là chủ sân', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);

      await service.remove(staff.id, buildAuthUser({ id: owner.id }));

      expect(staffRepo.remove).toHaveBeenCalledWith(staff);
    });
  });
});

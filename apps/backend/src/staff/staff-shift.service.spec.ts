import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { StaffService } from './staff.service';
import { Staff } from './entities/staff.entity';
import { Shift } from './entities/shift.entity';
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
  return { id: faker.string.uuid(), owner: buildUser(), name: faker.company.name(), ...overrides } as Venue;
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

function buildAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { id: faker.string.uuid(), email: faker.internet.email(), role: Role.MERCHANT, ...overrides };
}

describe('StaffService — shifts', () => {
  let service: StaffService;
  let staffRepo: DeepMocked<Repository<Staff>>;
  let dataSource: DeepMocked<DataSource>;
  let shiftRepo: DeepMocked<Repository<Shift>>;

  beforeEach(() => {
    staffRepo = createMock<Repository<Staff>>();
    shiftRepo = createMock<Repository<Shift>>();
    dataSource = createMock<DataSource>();

    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Shift) return shiftRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    shiftRepo.create.mockImplementation(((data: object) => data) as typeof shiftRepo.create);
    shiftRepo.save.mockImplementation((s) => Promise.resolve(s as Shift));
    shiftRepo.find.mockResolvedValue([]);

    service = new StaffService(staffRepo, dataSource);
  });

  describe('createShift', () => {
    it('tạo ca làm khi không trùng giờ với ca hiện có', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);
      shiftRepo.find.mockResolvedValue([]);

      const result = await service.createShift(
        staff.id,
        { shiftDate: '2026-08-20', startTime: '08:00', endTime: '12:00' },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.startTime).toBe('08:00');
    });

    it('ném BadRequestException khi trùng giờ với ca hiện có', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);
      shiftRepo.find.mockResolvedValue([
        { shiftDate: '2026-08-20', startTime: '10:00', endTime: '14:00' } as Shift,
      ]);

      await expect(
        service.createShift(
          staff.id,
          { shiftDate: '2026-08-20', startTime: '08:00', endTime: '12:00' },
          buildAuthUser({ id: owner.id }),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const staff = buildStaff();
      staffRepo.findOne.mockResolvedValue(staff);

      await expect(
        service.createShift(
          staff.id,
          { shiftDate: '2026-08-20', startTime: '08:00', endTime: '12:00' },
          buildAuthUser(),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném NotFoundException khi staff không tồn tại', async () => {
      staffRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createShift(
          faker.string.uuid(),
          { shiftDate: '2026-08-20', startTime: '08:00', endTime: '12:00' },
          buildAuthUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeShift', () => {
    it('xoá ca làm khi user là chủ sân', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);
      shiftRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeShift(staff.id, 'shift-1', buildAuthUser({ id: owner.id }));

      expect(shiftRepo.delete).toHaveBeenCalledWith({ id: 'shift-1', staff: { id: staff.id } });
    });

    it('ném NotFoundException khi ca làm không tồn tại', async () => {
      const owner = buildUser();
      const staff = buildStaff({ venue: buildVenue({ owner }) });
      staffRepo.findOne.mockResolvedValue(staff);
      shiftRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(
        service.removeShift(staff.id, 'shift-1', buildAuthUser({ id: owner.id })),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { FindUsersQueryDto } from './dto/find-users-query.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepo: DeepMocked<Repository<User>>;

  beforeEach(() => {
    userRepo = createMock<Repository<User>>();
    service = new UserService(userRepo);
  });

  describe('updateFcmToken', () => {
    it('updates only the fcmToken column for the given user', async () => {
      const userId = faker.string.uuid();

      await service.updateFcmToken(userId, 'device-token');

      expect(userRepo.update).toHaveBeenCalledWith(userId, {
        fcmToken: 'device-token',
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated users via the query builder', async () => {
      const users = [
        { id: faker.string.uuid(), email: faker.internet.email() },
      ] as User[];
      const qb = createMock<SelectQueryBuilder<User>>();
      qb.orderBy.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.skip.mockReturnThis();
      qb.take.mockReturnThis();
      qb.getManyAndCount.mockResolvedValue([users, 1]);
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const query: FindUsersQueryDto = { page: 1, limit: 20 };
      const result = await service.findAll(query);

      expect(result.data).toBe(users);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20 });
    });
  });

  describe('setLocked', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.setLocked(faker.string.uuid(), true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates isLocked and returns the saved user', async () => {
      const user = { id: faker.string.uuid(), isLocked: false } as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockImplementation(async (u) => u as User);

      const result = await service.setLocked(user.id, true);

      expect(result.isLocked).toBe(true);
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: user.id, isLocked: true }),
      );
    });
  });
});

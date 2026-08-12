import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

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
});

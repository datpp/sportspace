import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';

describe('UserController', () => {
  let controller: UserController;
  let service: DeepMocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: createMock<UserService>() },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('updateFcmToken() forwards the authenticated userId + token', async () => {
    const userId = faker.string.uuid();
    const dto = { fcmToken: 'device-token' };

    await controller.updateFcmToken(userId, dto);

    expect(service.updateFcmToken).toHaveBeenCalledWith(userId, 'device-token');
  });

  it('findAll() forwards to the service', async () => {
    const users = [{ id: faker.string.uuid() }];
    const query: FindUsersQueryDto = { page: 1, limit: 20 };
    const paginated: PaginatedDto<User> = {
      data: users as User[],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };
    service.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll(query);

    expect(result).toBe(paginated);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('lock() forwards id + true to the service', async () => {
    const id = faker.string.uuid();
    await controller.lock(id);
    expect(service.setLocked).toHaveBeenCalledWith(id, true);
  });

  it('unlock() forwards id + false to the service', async () => {
    const id = faker.string.uuid();
    await controller.unlock(id);
    expect(service.setLocked).toHaveBeenCalledWith(id, false);
  });
});

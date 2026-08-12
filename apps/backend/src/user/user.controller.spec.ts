import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

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
});

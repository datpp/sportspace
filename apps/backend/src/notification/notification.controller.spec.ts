import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: DeepMocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: createMock<NotificationService>(),
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll() forwards the authenticated userId', async () => {
    const userId = faker.string.uuid();
    const expected = [createMock<Notification>()];
    service.findAllForUser.mockResolvedValue(expected);

    const result = await controller.findAll(userId);

    expect(service.findAllForUser).toHaveBeenCalledWith(userId);
    expect(result).toBe(expected);
  });

  it('markRead() forwards notification id + authenticated userId', async () => {
    const id = faker.string.uuid();
    const userId = faker.string.uuid();
    const expected = createMock<Notification>();
    service.markRead.mockResolvedValue(expected);

    const result = await controller.markRead(id, userId);

    expect(service.markRead).toHaveBeenCalledWith(id, userId);
    expect(result).toBe(expected);
  });
});

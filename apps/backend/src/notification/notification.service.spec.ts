import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { FcmService } from './fcm.service';
import { User } from '../user/entities/user.entity';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: faker.string.uuid(),
    user: buildUser(),
    title: faker.lorem.words(3),
    body: faker.lorem.sentence(),
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: DeepMocked<Repository<Notification>>;
  let fcmService: DeepMocked<FcmService>;

  beforeEach(() => {
    notificationRepo = createMock<Repository<Notification>>();
    notificationRepo.create.mockImplementation((data) => data as Notification);
    notificationRepo.save.mockImplementation((data) =>
      Promise.resolve(data as Notification),
    );
    fcmService = createMock<FcmService>();

    service = new NotificationService(notificationRepo, fcmService);
  });

  describe('notify', () => {
    it('persists a notification row for the given user', async () => {
      const userId = faker.string.uuid();

      const result = await service.notify(userId, 'title', 'body');

      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { id: userId },
          title: 'title',
          body: 'body',
          isRead: false,
        }),
      );
      expect(notificationRepo.save).toHaveBeenCalled();
      expect(result.title).toBe('title');
      expect(fcmService.sendToUser).toHaveBeenCalledWith(
        userId,
        'title',
        'body',
      );
    });

    it('still returns the saved notification when the FCM push throws', async () => {
      fcmService.sendToUser.mockRejectedValue(new Error('fcm down'));

      const result = await service.notify(faker.string.uuid(), 'title', 'body');

      expect(result.title).toBe('title');
    });
  });

  describe('findAllForUser', () => {
    it('scopes the query to the given user, newest first', async () => {
      notificationRepo.find.mockResolvedValue([]);

      const userId = faker.string.uuid();
      await service.findAllForUser(userId);

      expect(notificationRepo.find).toHaveBeenCalledWith({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException when the notification does not exist', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markRead(faker.string.uuid(), faker.string.uuid()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the caller does not own the notification', async () => {
      const notification = buildNotification();
      notificationRepo.findOne.mockResolvedValue(notification);

      await expect(
        service.markRead(notification.id, faker.string.uuid()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marks the notification as read on the happy path', async () => {
      const owner = buildUser();
      const notification = buildNotification({ user: owner, isRead: false });
      notificationRepo.findOne.mockResolvedValue(notification);

      const result = await service.markRead(notification.id, owner.id);

      expect(result.isRead).toBe(true);
      expect(notificationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true }),
      );
    });
  });
});

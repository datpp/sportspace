import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { FcmService } from './fcm.service';
import { User } from '../user/entities/user.entity';

const sendMock = jest.fn();
const getMessagingMock = jest.fn((app: unknown) => {
  void app;
  return { send: sendMock };
});
const initializeAppMock = jest.fn((options: unknown) => {
  void options;
  return { name: 'fake-app' };
});
const getAppsMock = jest.fn(() => [] as unknown[]);
const certMock = jest.fn((account: unknown) => account);

jest.mock('firebase-admin/app', () => ({
  cert: (account: unknown) => certMock(account),
  getApps: () => getAppsMock(),
  initializeApp: (options: unknown) => initializeAppMock(options),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: (app: unknown) => getMessagingMock(app),
}));

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    fcmToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function buildConfig(value: string | undefined): DeepMocked<ConfigService> {
  const config = createMock<ConfigService>();
  config.get.mockImplementation((key: string) =>
    key === 'FIREBASE_SERVICE_ACCOUNT_JSON' ? value : undefined,
  );
  return config;
}

describe('FcmService', () => {
  let userRepo: DeepMocked<Repository<User>>;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo = createMock<Repository<User>>();
  });

  describe('when FIREBASE_SERVICE_ACCOUNT_JSON is not set', () => {
    it('stays no-op: never looks up the user or calls firebase-admin', async () => {
      const service = new FcmService(buildConfig(undefined), userRepo);

      await service.sendToUser(faker.string.uuid(), 'title', 'body');

      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('when FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON', () => {
    it('stays no-op instead of throwing from the constructor', () => {
      expect(
        () => new FcmService(buildConfig('not-json'), userRepo),
      ).not.toThrow();
      expect(initializeAppMock).not.toHaveBeenCalled();
    });
  });

  describe('when configured with a valid service account', () => {
    function buildService(): FcmService {
      return new FcmService(
        buildConfig(JSON.stringify({ projectId: 'sportspace-test' })),
        userRepo,
      );
    }

    it('initializes firebase-admin once via cert()', () => {
      buildService();
      expect(certMock).toHaveBeenCalledWith({ projectId: 'sportspace-test' });
      expect(initializeAppMock).toHaveBeenCalled();
    });

    it('is a no-op when the user has no fcmToken', async () => {
      const service = buildService();
      userRepo.findOne.mockResolvedValue(buildUser({ fcmToken: null }));

      await service.sendToUser(faker.string.uuid(), 'title', 'body');

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('sends a push to the user token on the happy path', async () => {
      const service = buildService();
      const user = buildUser({ fcmToken: 'device-token' });
      userRepo.findOne.mockResolvedValue(user);

      await service.sendToUser(user.id, 'title', 'body');

      expect(sendMock).toHaveBeenCalledWith({
        token: 'device-token',
        notification: { title: 'title', body: 'body' },
      });
    });

    it('clears fcmToken when the token is no longer registered', async () => {
      const service = buildService();
      const user = buildUser({ fcmToken: 'stale-token' });
      userRepo.findOne.mockResolvedValue(user);
      sendMock.mockRejectedValue({
        code: 'messaging/registration-token-not-registered',
      });

      await service.sendToUser(user.id, 'title', 'body');

      expect(userRepo.update).toHaveBeenCalledWith(user.id, {
        fcmToken: null,
      });
    });

    it('swallows other send errors without throwing or clearing the token', async () => {
      const service = buildService();
      const user = buildUser({ fcmToken: 'device-token' });
      userRepo.findOne.mockResolvedValue(user);
      sendMock.mockRejectedValue({ code: 'messaging/internal-error' });

      await expect(
        service.sendToUser(user.id, 'title', 'body'),
      ).resolves.toBeUndefined();
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });
});

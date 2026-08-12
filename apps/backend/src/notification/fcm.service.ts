import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  App,
  ServiceAccount,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';

/**
 * Wraps firebase-admin so push delivery is safely no-op when
 * FIREBASE_SERVICE_ACCOUNT_JSON isn't configured (no real Firebase project
 * in this environment) or the target user has no fcmToken — history is
 * still persisted by NotificationService regardless of this outcome.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App | null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {
    this.app = this.initFirebaseApp();
    if (!this.app) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON not set or invalid — FCM push is disabled, notification history still works.',
      );
    }
  }

  private initFirebaseApp(): App | null {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      return null;
    }
    try {
      const existing = getApps();
      if (existing.length) {
        return existing[0];
      }
      const serviceAccount = JSON.parse(raw) as ServiceAccount;
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (err) {
      this.logger.warn(
        `Failed to initialize firebase-admin: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async sendToUser(userId: string, title: string, body: string): Promise<void> {
    if (!this.app) {
      return;
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmToken) {
      return;
    }

    try {
      await getMessaging(this.app).send({
        token: user.fcmToken,
        notification: { title, body },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'messaging/registration-token-not-registered') {
        await this.userRepo.update(userId, { fcmToken: null });
      } else {
        this.logger.warn(`FCM send failed for user ${userId}: ${code ?? err}`);
      }
    }
  }
}

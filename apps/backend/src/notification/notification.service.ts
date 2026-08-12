import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly fcmService: FcmService,
  ) {}

  /**
   * Persists notification history, then best-effort pushes via FCM — a push
   * failure (no token, no credentials, invalid token) must never make the
   * history write (or the caller's own transaction) fail.
   */
  async notify(
    userId: string,
    title: string,
    body: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user: { id: userId } as Notification['user'],
      title,
      body,
      isRead: false,
    });
    const saved = await this.notificationRepo.save(notification);

    try {
      await this.fcmService.sendToUser(userId, title, body);
    } catch (err) {
      this.logger.warn(`FCM push failed for user ${userId}: ${err}`);
    }

    return saved;
  }

  findAllForUser(userId: string): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }
    if (notification.user.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem thông báo này');
    }
    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }
}

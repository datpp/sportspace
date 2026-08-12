import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { Notification } from './entities/notification.entity';
import { FcmService } from './fcm.service';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User])],
  providers: [NotificationService, FcmService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}

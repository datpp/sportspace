import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách thông báo của tôi' })
  @ApiOkResponse({ type: [Notification] })
  findAll(@CurrentUser('id') userId: string) {
    return this.notificationService.findAllForUser(userId);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  @ApiOkResponse({ type: Notification })
  markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationService.markRead(id, userId);
  }
}

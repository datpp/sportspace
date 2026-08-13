import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { UserService } from './user.service';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật FCM device token của chính mình' })
  @ApiOkResponse()
  updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.userService.updateFcmToken(userId, dto.fcmToken);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách toàn bộ người dùng' })
  @ApiOkResponse({ type: [User] })
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Patch(':id/lock')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Khóa tài khoản người dùng' })
  @ApiOkResponse({ type: User })
  lock(@Param('id') id: string): Promise<User> {
    return this.userService.setLocked(id, true);
  }

  @Patch(':id/unlock')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Mở khóa tài khoản người dùng' })
  @ApiOkResponse({ type: User })
  unlock(@Param('id') id: string): Promise<User> {
    return this.userService.setLocked(id, false);
  }
}

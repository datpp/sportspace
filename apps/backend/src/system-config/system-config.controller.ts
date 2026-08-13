import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { SystemConfig } from './entities/system-config.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('system-config')
@Controller('system-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Đọc cấu hình hệ thống hiện tại' })
  @ApiOkResponse({ type: SystemConfig })
  get(): Promise<SystemConfig> {
    return this.systemConfigService.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Cập nhật cấu hình hệ thống' })
  @ApiOkResponse({ type: SystemConfig })
  update(@Body() dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    return this.systemConfigService.update(dto);
  }
}

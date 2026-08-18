import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { AddonServicesService } from './addon-services.service';
import { CreateAddOnServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddOnServiceDto } from './dto/update-addon-service.dto';
import { AddOnService } from './entities/add-on-service.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('addon-services')
@Controller('addon-services')
export class AddonServicesController {
  constructor(private readonly addonServicesService: AddonServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm dịch vụ đi kèm cho cụm sân' })
  @ApiCreatedResponse({ type: AddOnService })
  create(
    @Body() dto: CreateAddOnServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addonServicesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách dịch vụ đi kèm theo cụm sân' })
  @ApiOkResponse({ type: [AddOnService] })
  findAll(@Query('venueId') venueId: string) {
    return this.addonServicesService.findAll(venueId);
  }

  @Get(':id')
  @ApiOkResponse({ type: AddOnService })
  findOne(@Param('id') id: string) {
    return this.addonServicesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AddOnService })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAddOnServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addonServicesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.addonServicesService.remove(id, user);
  }
}

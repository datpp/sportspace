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
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FindVenuesQueryDto } from './dto/find-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo cụm sân' })
  @ApiCreatedResponse({ type: Venue })
  create(@CurrentUser('id') ownerId: string, @Body() dto: CreateVenueDto) {
    return this.venueService.create(ownerId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Tìm sân theo vị trí + bộ môn' })
  @ApiOkResponse({ type: [Venue] })
  findAll(@Query() query: FindVenuesQueryDto) {
    return this.venueService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: Venue })
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: Venue })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVenueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.venueService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.venueService.remove(id, user);
  }
}

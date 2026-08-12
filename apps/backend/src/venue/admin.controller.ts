import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role, VenueStatus } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { AdminVenuesQueryDto } from './dto/admin-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly venueService: VenueService) {}

  @Get('venues')
  @ApiOperation({
    summary: 'Danh sách cụm sân theo status để duyệt (mặc định PENDING)',
  })
  @ApiOkResponse({ type: [Venue] })
  getVenues(@Query() query: AdminVenuesQueryDto): Promise<Venue[]> {
    return this.venueService.findAllForAdmin(
      query.status ?? VenueStatus.PENDING,
    );
  }
}

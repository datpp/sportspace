import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { AdminVenuesQueryDto } from './dto/admin-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly venueService: VenueService) {}

  @Get('venues')
  @ApiOperation({
    summary:
      'Danh sách cụm sân (tìm kiếm/lọc theo trạng thái, tỉnh/thành, phân trang)',
  })
  @ApiPaginatedResponse(Venue)
  getVenues(@Query() query: AdminVenuesQueryDto): Promise<PaginatedDto<Venue>> {
    return this.venueService.findAllForAdmin(query);
  }

  @Get('venues/provinces')
  @ApiOperation({
    summary: 'Danh sách tỉnh/thành đang có cụm sân (cho bộ lọc)',
  })
  @ApiOkResponse({ type: [String] })
  getVenueProvinces(): Promise<string[]> {
    return this.venueService.listDistinctProvinces();
  }
}

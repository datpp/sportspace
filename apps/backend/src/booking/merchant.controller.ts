import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { BookingService } from './booking.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';
import { RevenueTimeseriesQueryDto } from './dto/revenue-timeseries-query.dto';
import { RevenueTimeseriesPointDto } from './dto/revenue-timeseries-point.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { VenueService } from '../venue/venue.service';
import { Venue } from '../venue/entities/venue.entity';
import { Booking } from './entities/booking.entity';

@ApiTags('merchant')
@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly venueService: VenueService,
  ) {}

  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê doanh thu chủ sân' })
  @ApiOkResponse({ type: RevenueDto })
  getRevenue(
    @CurrentUser('id') merchantId: string,
    @Query() query: RevenueQueryDto,
  ): Promise<RevenueDto> {
    return this.bookingService.getMerchantRevenue(merchantId, query);
  }

  @Get('revenue/timeseries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Doanh thu theo thời gian (chart xu hướng), zero-filled',
  })
  @ApiOkResponse({ type: [RevenueTimeseriesPointDto] })
  getRevenueTimeseries(
    @CurrentUser('id') merchantId: string,
    @Query() query: RevenueTimeseriesQueryDto,
  ): Promise<RevenueTimeseriesPointDto[]> {
    return this.bookingService.getMerchantRevenueTimeseries(merchantId, query);
  }

  @Get('venues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách cụm sân của chủ sân hiện tại' })
  @ApiOkResponse({ type: [Venue] })
  getVenues(@CurrentUser('id') merchantId: string): Promise<Venue[]> {
    return this.venueService.findByOwner(merchantId);
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách đơn đặt sân trên các cụm sân của chủ sân hiện tại',
  })
  @ApiOkResponse({ type: [Booking] })
  getBookings(@CurrentUser('id') merchantId: string): Promise<Booking[]> {
    return this.bookingService.findAllForMerchant(merchantId);
  }
}

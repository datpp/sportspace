import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { BookingService } from './booking.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('merchant')
@Controller('merchant')
export class MerchantController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê doanh thu chủ sân' })
  getRevenue(
    @CurrentUser('id') merchantId: string,
    @Query() query: RevenueQueryDto,
  ): Promise<RevenueDto> {
    return this.bookingService.getMerchantRevenue(merchantId, query);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';

@ApiTags('merchant')
@Controller('merchant')
export class MerchantController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu chủ sân' })
  getRevenue(@Query() query: RevenueQueryDto): Promise<RevenueDto> {
    return this.bookingService.getMerchantRevenue('', query);
  }
}

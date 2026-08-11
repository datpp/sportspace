import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { Booking } from './entities/booking.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Đặt sân (⭐ race condition)' })
  @ApiCreatedResponse({ type: Booking })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Booking của tôi (ADMIN xem tất cả)' })
  @ApiOkResponse({ type: [Booking] })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.findAll(user);
  }

  @Get(':id')
  @ApiOkResponse({ type: Booking })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: Booking })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingService.update(id, dto, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Hủy đơn đặt sân' })
  @ApiCreatedResponse({ type: Booking })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.cancel(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.remove(id, user);
  }
}

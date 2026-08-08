import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { RevenueDto } from './dto/revenue.dto';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingService {
  create(_userId: string, _dto: CreateBookingDto): Booking {
    throw new Error('Not implemented');
  }

  findAll(): Booking[] {
    return [];
  }

  findOne(_id: string): Booking | null {
    return null;
  }

  update(_id: string, _dto: UpdateBookingDto): Booking {
    throw new Error('Not implemented');
  }

  cancel(_id: string): Booking {
    throw new Error('Not implemented');
  }

  remove(_id: string): void {
    throw new Error('Not implemented');
  }

  getMerchantRevenue(_merchantId: string, _query: RevenueQueryDto): RevenueDto {
    return { totalRevenue: 0, totalBookings: 0 };
  }
}

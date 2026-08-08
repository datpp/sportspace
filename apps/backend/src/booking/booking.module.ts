import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MerchantController } from './merchant.controller';
import { Booking } from './entities/booking.entity';
import { VenueModule } from '../venue/venue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), VenueModule],
  controllers: [BookingController, MerchantController],
  providers: [BookingService],
})
export class BookingModule {}

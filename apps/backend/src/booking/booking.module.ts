import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MerchantController } from './merchant.controller';

@Module({
  controllers: [BookingController, MerchantController],
  providers: [BookingService],
})
export class BookingModule {}

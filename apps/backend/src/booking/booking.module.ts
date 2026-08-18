import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MerchantController } from './merchant.controller';
import { Booking } from './entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AddOnService } from '../addon-services/entities/add-on-service.entity';
import { BookingServiceItem } from '../addon-services/entities/booking-service-item.entity';
import { VenueModule } from '../venue/venue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment, AddOnService, BookingServiceItem]),
    VenueModule,
    RealtimeModule,
    NotificationModule,
    PaymentModule,
    SystemConfigModule,
  ],
  controllers: [BookingController, MerchantController],
  providers: [BookingService],
})
export class BookingModule {}

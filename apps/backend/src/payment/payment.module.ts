import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Booking])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}

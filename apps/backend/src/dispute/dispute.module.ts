import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { Dispute } from './entities/dispute.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Booking, Payment]),
    PaymentModule,
  ],
  controllers: [DisputeController],
  providers: [DisputeService],
})
export class DisputeModule {}

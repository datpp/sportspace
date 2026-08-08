import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { IpnPayloadDto } from './dto/ipn-payload.dto';
import { IpnResponseDto } from './dto/ipn-response.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentService {
  create(_dto: CreatePaymentDto): Payment {
    throw new Error('Not implemented');
  }

  findAll(): Payment[] {
    return [];
  }

  findOne(_id: string): Payment | null {
    return null;
  }

  update(_id: string, _dto: UpdatePaymentDto): Payment {
    throw new Error('Not implemented');
  }

  remove(_id: string): void {
    throw new Error('Not implemented');
  }

  checkout(_bookingId: string, _dto: CheckoutDto): CheckoutResponseDto {
    return { paymentUrl: '' };
  }

  handleIpn(_payload: IpnPayloadDto): IpnResponseDto {
    return { RspCode: '00', Message: 'Confirm Success' };
  }
}

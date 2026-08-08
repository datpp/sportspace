import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { IpnPayloadDto } from './dto/ipn-payload.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentService.create(dto);
  }

  @Get()
  findAll() {
    return this.paymentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.paymentService.remove(id);
  }

  @Post(':bookingId/checkout')
  @ApiOperation({ summary: 'Sinh link thanh toán VNPAY (Sandbox)' })
  checkout(@Param('bookingId') bookingId: string, @Body() dto: CheckoutDto) {
    return this.paymentService.checkout(bookingId, dto);
  }

  @Post('ipn')
  @ApiOperation({ summary: 'Webhook IPN từ cổng thanh toán' })
  ipn(@Body() payload: IpnPayloadDto) {
    return this.paymentService.handleIpn(payload);
  }
}

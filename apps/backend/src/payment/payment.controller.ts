import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { IpnResponseDto } from './dto/ipn-response.dto';
import { VnpayIpnQuery } from './dto/vnpay-ipn-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

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

  /**
   * VNPAY calls this as a GET with every vnp_* field in the query string
   * (never a JSON body). Bound as a raw Record so the global ValidationPipe's
   * `whitelist` doesn't strip fields before signature verification runs —
   * see dto/vnpay-ipn-query.dto.ts. Must stay registered before `:id` below,
   * otherwise Nest matches `/payments/ipn` as `findOne('ipn')` first.
   */
  @Get('ipn')
  @ApiOperation({ summary: 'Webhook IPN từ VNPAY (GET, query string)' })
  @ApiQuery({ name: 'vnp_TxnRef', required: true })
  @ApiQuery({ name: 'vnp_Amount', required: true })
  @ApiQuery({ name: 'vnp_ResponseCode', required: true })
  @ApiQuery({ name: 'vnp_SecureHash', required: true })
  @ApiOkResponse({ type: IpnResponseDto })
  ipn(@Query() query: Record<string, string>) {
    return this.paymentService.handleIpn(query as VnpayIpnQuery);
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sinh link thanh toán VNPAY (Sandbox), chỉ chủ booking',
  })
  @ApiCreatedResponse({ type: CheckoutResponseDto })
  checkout(
    @CurrentUser('id') userId: string,
    @Param('bookingId') bookingId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.paymentService.checkout(bookingId, userId, dto);
  }
}

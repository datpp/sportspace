import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { BookingStatus, PaymentStatus } from '@sportspace/shared';
import { DataSource, Repository } from 'typeorm';
import { Booking } from '../booking/entities/booking.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { IpnResponseDto } from './dto/ipn-response.dto';
import { VnpayIpnQuery } from './dto/vnpay-ipn-query.dto';
import { Payment } from './entities/payment.entity';
import {
  buildVnpayRedirectUrl,
  formatVnpayDate,
  fromVnpayAmount,
  generateTxnRef,
  toVnpayAmount,
  verifyVnpaySignature,
} from './vnpay.util';

const VNP_VERSION = '2.1.0';
const VNP_COMMAND = 'pay';
const VNP_CURR_CODE = 'VND';
const VNP_LOCALE = 'vn';
const VNP_ORDER_TYPE = 'other';
const DEFAULT_VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

/** RspCode values VNPAY's IPN protocol expects back — see CLAUDE.md §7 / plan. */
enum IpnRspCode {
  SUCCESS = '00',
  ORDER_NOT_FOUND = '01',
  ORDER_ALREADY_CONFIRMED = '02',
  INVALID_AMOUNT = '04',
  INVALID_CHECKSUM = '97',
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(_dto: CreatePaymentDto): Payment {
    throw new Error('Not implemented');
  }

  findAll(): Payment[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findOne(_id: string): Payment | null {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(_id: string, _dto: UpdatePaymentDto): Payment {
    throw new Error('Not implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  remove(_id: string): void {
    throw new Error('Not implemented');
  }

  async checkout(
    bookingId: string,
    userId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutResponseDto> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: { user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn này');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ có thể thanh toán đơn đang chờ (PENDING)',
      );
    }

    let payment = await this.paymentRepo.findOne({
      where: { booking: { id: bookingId } },
    });
    if (payment?.status === PaymentStatus.PAID) {
      throw new BadRequestException('Đơn đã được thanh toán');
    }

    const amount = Number(booking.totalAmount);
    const txnRef = generateTxnRef();
    if (payment) {
      payment.provider = 'VNPAY';
      payment.amount = amount;
      payment.status = PaymentStatus.PENDING;
      payment.transactionRef = txnRef;
    } else {
      payment = this.paymentRepo.create({
        booking,
        provider: 'VNPAY',
        amount,
        status: PaymentStatus.PENDING,
        transactionRef: txnRef,
      });
    }
    await this.paymentRepo.save(payment);

    const tmnCode = this.config.get<string>('VNP_TMN_CODE', '');
    const hashSecret = this.config.get<string>('VNP_HASH_SECRET', '');
    const vnpUrl = this.config.get<string>('VNP_URL', DEFAULT_VNP_URL);
    const returnUrl =
      dto.returnUrl ?? this.config.get<string>('VNP_RETURN_URL', '');

    const paymentUrl = buildVnpayRedirectUrl(
      vnpUrl,
      {
        vnp_Version: VNP_VERSION,
        vnp_Command: VNP_COMMAND,
        vnp_TmnCode: tmnCode,
        vnp_Locale: VNP_LOCALE,
        vnp_CurrCode: VNP_CURR_CODE,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Thanh toan don dat san ${bookingId}`,
        vnp_OrderType: VNP_ORDER_TYPE,
        vnp_Amount: toVnpayAmount(amount),
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: '127.0.0.1',
        vnp_CreateDate: formatVnpayDate(new Date()),
      },
      hashSecret,
    );

    return { paymentUrl };
  }

  /**
   * Layer-2 style pessimistic lock (CLAUDE.md §6) on the Payment row: VNPAY
   * retries IPN on anything but RspCode 00, so two overlapping deliveries for
   * the same vnp_TxnRef must not both flip the booking to CONFIRMED.
   */
  async handleIpn(query: VnpayIpnQuery): Promise<IpnResponseDto> {
    const hashSecret = this.config.get<string>('VNP_HASH_SECRET', '');
    if (!verifyVnpaySignature(query, hashSecret)) {
      return {
        RspCode: IpnRspCode.INVALID_CHECKSUM,
        Message: 'Invalid signature',
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const payment = await queryRunner.manager
        .createQueryBuilder(Payment, 'payment')
        .setLock('pessimistic_write')
        .innerJoinAndSelect('payment.booking', 'booking')
        .where('payment.transactionRef = :txnRef', { txnRef: query.vnp_TxnRef })
        .getOne();

      if (!payment) {
        await queryRunner.rollbackTransaction();
        return {
          RspCode: IpnRspCode.ORDER_NOT_FOUND,
          Message: 'Order not found',
        };
      }

      const expectedAmount = Math.round(Number(payment.amount) * 100);
      const receivedAmount = Math.round(
        fromVnpayAmount(query.vnp_Amount) * 100,
      );
      if (expectedAmount !== receivedAmount) {
        await queryRunner.rollbackTransaction();
        return {
          RspCode: IpnRspCode.INVALID_AMOUNT,
          Message: 'Invalid amount',
        };
      }

      if (payment.status !== PaymentStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        return {
          RspCode: IpnRspCode.ORDER_ALREADY_CONFIRMED,
          Message: 'Order already confirmed',
        };
      }

      if (query.vnp_ResponseCode === '00') {
        payment.status = PaymentStatus.PAID;
        await queryRunner.manager.save(Payment, payment);
        await queryRunner.manager.update(Booking, payment.booking.id, {
          status: BookingStatus.CONFIRMED,
        });
      } else {
        payment.status = PaymentStatus.FAILED;
        await queryRunner.manager.save(Payment, payment);
      }

      await queryRunner.commitTransaction();
      return { RspCode: IpnRspCode.SUCCESS, Message: 'Confirm Success' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

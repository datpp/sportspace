import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Court } from '../venue/entities/court.entity';
import { User } from '../user/entities/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationService } from '../notification/notification.service';
import { VnpayIpnQuery } from './dto/vnpay-ipn-query.dto';
import { signVnpayParams, toVnpayAmount } from './vnpay.util';

const HASH_SECRET = 'unit-test-secret';
const CONFIG_VALUES: Record<string, string> = {
  VNP_TMN_CODE: 'TESTTMN',
  VNP_HASH_SECRET: HASH_SECRET,
  VNP_URL: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  VNP_RETURN_URL: 'http://localhost:3000/payments/return',
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: faker.internet.password(),
    fullName: faker.person.fullName(),
    phone: faker.phone.number(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

function buildCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: faker.string.uuid(),
    name: faker.word.words(2),
    sport: 'football',
    basePrice: 200000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Court;
}

function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: faker.string.uuid(),
    court: buildCourt(),
    user: buildUser(),
    bookingDate: '2026-09-01',
    startTime: '09:00',
    endTime: '10:00',
    status: BookingStatus.PENDING,
    totalAmount: 200000,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: faker.string.uuid(),
    booking: buildBooking(),
    provider: 'VNPAY',
    amount: 200000,
    status: PaymentStatus.PENDING,
    refundAmount: null,
    transactionRef: faker.string.hexadecimal({ length: 32, prefix: '' }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Builds a validly-signed IPN query the way VNPAY would send it (GET query params, all strings). */
function buildSignedIpnQuery(
  overrides: Partial<Record<string, string | number>> = {},
): VnpayIpnQuery {
  const raw: Record<string, string | number> = {
    vnp_TxnRef: faker.string.hexadecimal({ length: 32, prefix: '' }),
    vnp_Amount: toVnpayAmount(200000),
    vnp_ResponseCode: '00',
    vnp_TransactionNo: faker.string.numeric(10),
    vnp_TransactionStatus: '00',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20260901120000',
    vnp_OrderInfo: 'Thanh toan don dat san',
    vnp_TmnCode: 'TESTTMN',
    ...overrides,
  };
  const stringified = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, String(v)]),
  );
  const vnp_SecureHash = signVnpayParams(stringified, HASH_SECRET);
  return { ...stringified, vnp_SecureHash } as VnpayIpnQuery;
}

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: DeepMocked<Repository<Payment>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let dataSource: DeepMocked<DataSource>;
  let config: DeepMocked<ConfigService>;
  let queryRunner: DeepMocked<QueryRunner>;
  let manager: DeepMocked<EntityManager>;
  let queryBuilder: DeepMocked<SelectQueryBuilder<Payment>>;
  let realtimeGateway: DeepMocked<RealtimeGateway>;
  let notificationService: DeepMocked<NotificationService>;

  beforeEach(() => {
    paymentRepo = createMock<Repository<Payment>>();
    bookingRepo = createMock<Repository<Booking>>();
    dataSource = createMock<DataSource>();
    config = createMock<ConfigService>();
    realtimeGateway = createMock<RealtimeGateway>();
    notificationService = createMock<NotificationService>();
    queryRunner = createMock<QueryRunner>();
    manager = createMock<EntityManager>();
    queryBuilder = createMock<SelectQueryBuilder<Payment>>();

    config.get.mockImplementation(
      (key: string, def?: unknown) => CONFIG_VALUES[key] ?? def,
    );

    queryBuilder.setLock.mockReturnValue(queryBuilder);
    queryBuilder.innerJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.getOne.mockResolvedValue(null);

    manager.createQueryBuilder.mockReturnValue(queryBuilder);
    manager.save.mockImplementation((_entity, data) => Promise.resolve(data));
    manager.update.mockResolvedValue({ affected: 1 } as never);

    (queryRunner as unknown as { manager: EntityManager }).manager = manager;
    dataSource.createQueryRunner.mockReturnValue(queryRunner);

    paymentRepo.create.mockImplementation((data) => data as Payment);
    paymentRepo.save.mockImplementation((data) =>
      Promise.resolve(data as Payment),
    );

    service = new PaymentService(
      paymentRepo,
      bookingRepo,
      dataSource,
      config,
      realtimeGateway,
      notificationService,
    );
  });

  describe('checkout', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.checkout(faker.string.uuid(), faker.string.uuid(), {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the caller is not the booking owner', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.checkout(booking.id, faker.string.uuid(), {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the booking is not PENDING', async () => {
      const booking = buildBooking({ status: BookingStatus.CONFIRMED });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.checkout(booking.id, booking.user.id, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when a payment already exists and is PAID', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      paymentRepo.findOne.mockResolvedValue(
        buildPayment({ booking, status: PaymentStatus.PAID }),
      );

      await expect(
        service.checkout(booking.id, booking.user.id, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a PENDING payment and returns a correctly signed VNPAY redirect URL', async () => {
      const booking = buildBooking({ totalAmount: 250000 });
      bookingRepo.findOne.mockResolvedValue(booking);
      paymentRepo.findOne.mockResolvedValue(null);

      const result = await service.checkout(booking.id, booking.user.id, {});

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PENDING,
          amount: 250000,
        }),
      );

      const url = new URL(result.paymentUrl);
      expect(url.origin + url.pathname).toBe(CONFIG_VALUES.VNP_URL);
      expect(url.searchParams.get('vnp_Amount')).toBe(
        String(toVnpayAmount(250000)),
      );

      const query = Object.fromEntries(url.searchParams.entries());
      const receivedHash = query.vnp_SecureHash;
      delete query.vnp_SecureHash;
      expect(signVnpayParams(query, HASH_SECRET)).toBe(receivedHash);
    });

    it('reuses the existing Payment row (new txnRef) when a non-PAID payment already exists', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      const existing = buildPayment({ booking, status: PaymentStatus.FAILED });
      paymentRepo.findOne.mockResolvedValue(existing);

      await service.checkout(booking.id, booking.user.id, {});

      expect(paymentRepo.create).not.toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existing.id,
          status: PaymentStatus.PENDING,
        }),
      );
    });
  });

  describe('handleIpn', () => {
    it('returns RspCode 97 and touches no DB row when the signature is invalid', async () => {
      const query = buildSignedIpnQuery();
      query.vnp_Amount = String(toVnpayAmount(1));

      const result = await service.handleIpn(query);

      expect(result.RspCode).toBe('97');
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('returns RspCode 01 when no payment matches vnp_TxnRef', async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      const query = buildSignedIpnQuery();

      const result = await service.handleIpn(query);

      expect(result.RspCode).toBe('01');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('returns RspCode 04 when the amount does not match the stored payment', async () => {
      const payment = buildPayment({ amount: 200000 });
      queryBuilder.getOne.mockResolvedValue(payment);
      const query = buildSignedIpnQuery({
        vnp_TxnRef: payment.transactionRef,
        vnp_Amount: toVnpayAmount(999999),
      });

      const result = await service.handleIpn(query);

      expect(result.RspCode).toBe('04');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('returns RspCode 02 (idempotent) when the payment was already processed', async () => {
      const payment = buildPayment({ status: PaymentStatus.PAID });
      queryBuilder.getOne.mockResolvedValue(payment);
      const query = buildSignedIpnQuery({
        vnp_TxnRef: payment.transactionRef,
        vnp_Amount: toVnpayAmount(Number(payment.amount)),
      });

      const result = await service.handleIpn(query);

      expect(result.RspCode).toBe('02');
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('confirms payment + booking on vnp_ResponseCode 00 (success path)', async () => {
      const booking = buildBooking({ status: BookingStatus.PENDING });
      const payment = buildPayment({
        booking,
        amount: 200000,
        status: PaymentStatus.PENDING,
      });
      queryBuilder.getOne.mockResolvedValue(payment);
      const query = buildSignedIpnQuery({
        vnp_TxnRef: payment.transactionRef,
        vnp_Amount: toVnpayAmount(200000),
        vnp_ResponseCode: '00',
      });

      const result = await service.handleIpn(query);

      expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.PAID }),
      );
      expect(manager.update).toHaveBeenCalledWith(Booking, booking.id, {
        status: BookingStatus.CONFIRMED,
      });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: booking.court.id,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        status: BookingStatus.CONFIRMED,
      });
      expect(notificationService.notify).toHaveBeenCalledWith(
        booking.user.id,
        expect.any(String),
        expect.any(String),
      );
    });

    it('still replies RspCode 00 when the notification history write fails (best-effort)', async () => {
      const booking = buildBooking({ status: BookingStatus.PENDING });
      const payment = buildPayment({
        booking,
        amount: 200000,
        status: PaymentStatus.PENDING,
      });
      queryBuilder.getOne.mockResolvedValue(payment);
      notificationService.notify.mockRejectedValue(new Error('db down'));
      const query = buildSignedIpnQuery({
        vnp_TxnRef: payment.transactionRef,
        vnp_Amount: toVnpayAmount(200000),
        vnp_ResponseCode: '00',
      });

      const result = await service.handleIpn(query);

      expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('marks payment FAILED (but still replies RspCode 00) when VNPAY reports a failed transaction', async () => {
      const booking = buildBooking({ status: BookingStatus.PENDING });
      const payment = buildPayment({
        booking,
        amount: 200000,
        status: PaymentStatus.PENDING,
      });
      queryBuilder.getOne.mockResolvedValue(payment);
      const query = buildSignedIpnQuery({
        vnp_TxnRef: payment.transactionRef,
        vnp_Amount: toVnpayAmount(200000),
        vnp_ResponseCode: '24',
      });

      const result = await service.handleIpn(query);

      expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({ status: PaymentStatus.FAILED }),
      );
      expect(manager.update).not.toHaveBeenCalled();
      expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
      expect(notificationService.notify).not.toHaveBeenCalled();
    });
  });

  describe('refundFull', () => {
    it('flips a PAID payment to REFUNDED', async () => {
      const payment = {
        id: faker.string.uuid(),
        provider: 'VNPAY',
        amount: 200_000,
        status: PaymentStatus.PAID,
        transactionRef: faker.string.alphanumeric(10),
      } as Payment;
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.refundFull(faker.string.uuid());

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('is a no-op when there is no PAID payment for the booking', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await service.refundFull(faker.string.uuid());

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });
});

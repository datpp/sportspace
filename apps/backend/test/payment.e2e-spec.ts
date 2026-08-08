import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { PaymentStatus, Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Court } from '../src/venue/entities/court.entity';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { signVnpayParams, toVnpayAmount } from '../src/payment/vnpay.util';

describe('Payment / VNPAY (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let hashSecret: string;
  let owner: User;
  let venue: Venue;
  let court: Court;
  let playerId: string;
  let accessToken: string;
  let otherPlayerId: string;
  let otherAccessToken: string;
  const createdBookingIds: string[] = [];

  const BASE_PRICE = 200000;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
    hashSecret = moduleFixture
      .get(ConfigService)
      .get<string>('VNP_HASH_SECRET')!;

    owner = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash: 'hash',
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    venue = await dataSource.getRepository(Venue).save({
      owner,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
    });
    court = await dataSource.getRepository(Court).save({
      venue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: BASE_PRICE,
    });

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);
    playerId = registerRes.body.userId;
    accessToken = registerRes.body.accessToken;

    const otherRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);
    otherPlayerId = otherRegisterRes.body.userId;
    otherAccessToken = otherRegisterRes.body.accessToken;
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await dataSource
        .createQueryBuilder()
        .delete()
        .from('payments')
        .where('booking_id IN (:...ids)', { ids: createdBookingIds })
        .execute();
      await dataSource.getRepository('bookings').delete(createdBookingIds);
    }
    await dataSource.getRepository(Court).delete({ id: court.id });
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource.getRepository(User).delete({ id: playerId });
    await dataSource.getRepository(User).delete({ id: otherPlayerId });
    await app.close();
  });

  async function createPendingBooking(
    token: string,
    date: string,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        courtId: court.id,
        bookingDate: date,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const bookingId = res.body.id as string;
    createdBookingIds.push(bookingId);
    return bookingId;
  }

  function signedIpnQuery(overrides: Record<string, string | number>) {
    const stringified = Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)]),
    );
    const vnp_SecureHash = signVnpayParams(stringified, hashSecret);
    return { ...stringified, vnp_SecureHash };
  }

  it('rejects checkout with no Authorization header (401)', async () => {
    const bookingId = await createPendingBooking(accessToken, '2026-09-05');
    await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .expect(401);
  });

  it('rejects checkout from a user who does not own the booking (403)', async () => {
    const bookingId = await createPendingBooking(accessToken, '2026-09-06');
    await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(403);
  });

  it('returns a correctly signed VNPAY redirect URL for a PENDING booking owned by the caller (201)', async () => {
    const bookingId = await createPendingBooking(accessToken, '2026-09-07');

    const res = await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const url = new URL(res.body.paymentUrl);
    expect(url.searchParams.get('vnp_Amount')).toBe(
      String(toVnpayAmount(BASE_PRICE)),
    );

    const query = Object.fromEntries(url.searchParams.entries());
    const receivedHash = query.vnp_SecureHash;
    delete query.vnp_SecureHash;
    expect(signVnpayParams(query, hashSecret)).toBe(receivedHash);
  });

  describe('IPN webhook', () => {
    async function checkoutAndGetTxnRef(token: string, date: string) {
      const bookingId = await createPendingBooking(token, date);
      const res = await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      const url = new URL(res.body.paymentUrl);
      return { bookingId, txnRef: url.searchParams.get('vnp_TxnRef')! };
    }

    it('confirms Payment + Booking on a validly-signed success IPN (RspCode 00)', async () => {
      const { bookingId, txnRef } = await checkoutAndGetTxnRef(
        accessToken,
        '2026-09-08',
      );

      const res = await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(
          signedIpnQuery({
            vnp_TxnRef: txnRef,
            vnp_Amount: toVnpayAmount(BASE_PRICE),
            vnp_ResponseCode: '00',
          }),
        )
        .expect(200);
      expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });

      const bookingRes = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .expect(200);
      expect(bookingRes.body.status).toBe('CONFIRMED');

      const payment = await dataSource
        .getRepository('payments')
        .findOne({ where: { transactionRef: txnRef } });
      expect(payment?.status).toBe(PaymentStatus.PAID);
    });

    it('rejects a checkout retry once the booking is already CONFIRMED (400)', async () => {
      const { bookingId, txnRef } = await checkoutAndGetTxnRef(
        accessToken,
        '2026-09-09',
      );
      await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(
          signedIpnQuery({
            vnp_TxnRef: txnRef,
            vnp_Amount: toVnpayAmount(BASE_PRICE),
            vnp_ResponseCode: '00',
          }),
        )
        .expect(200);

      await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('rejects a forged signature and leaves the booking untouched (RspCode 97)', async () => {
      const { bookingId, txnRef } = await checkoutAndGetTxnRef(
        accessToken,
        '2026-09-10',
      );

      const res = await request(app.getHttpServer())
        .get('/payments/ipn')
        .query({
          vnp_TxnRef: txnRef,
          vnp_Amount: String(toVnpayAmount(BASE_PRICE)),
          vnp_ResponseCode: '00',
          vnp_SecureHash: 'deadbeef'.repeat(16),
        })
        .expect(200);
      expect(res.body.RspCode).toBe('97');

      const bookingRes = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .expect(200);
      expect(bookingRes.body.status).toBe('PENDING');
    });

    it('rejects a validly-signed IPN whose amount does not match the stored payment (RspCode 04)', async () => {
      const { bookingId, txnRef } = await checkoutAndGetTxnRef(
        accessToken,
        '2026-09-11',
      );

      const res = await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(
          signedIpnQuery({
            vnp_TxnRef: txnRef,
            vnp_Amount: toVnpayAmount(BASE_PRICE + 1),
            vnp_ResponseCode: '00',
          }),
        )
        .expect(200);
      expect(res.body.RspCode).toBe('04');

      const bookingRes = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .expect(200);
      expect(bookingRes.body.status).toBe('PENDING');
    });

    it('replaying an already-processed IPN returns RspCode 02 without reprocessing', async () => {
      const { txnRef } = await checkoutAndGetTxnRef(accessToken, '2026-09-12');
      const query = signedIpnQuery({
        vnp_TxnRef: txnRef,
        vnp_Amount: toVnpayAmount(BASE_PRICE),
        vnp_ResponseCode: '00',
      });

      await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(query)
        .expect(200);
      const replay = await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(query)
        .expect(200);

      expect(replay.body.RspCode).toBe('02');
    });

    it('marks Payment FAILED (still RspCode 00) and leaves booking PENDING when VNPAY reports a failed transaction', async () => {
      const { bookingId, txnRef } = await checkoutAndGetTxnRef(
        accessToken,
        '2026-09-13',
      );

      const res = await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(
          signedIpnQuery({
            vnp_TxnRef: txnRef,
            vnp_Amount: toVnpayAmount(BASE_PRICE),
            vnp_ResponseCode: '24',
          }),
        )
        .expect(200);
      expect(res.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });

      const bookingRes = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .expect(200);
      expect(bookingRes.body.status).toBe('PENDING');

      const payment = await dataSource
        .getRepository('payments')
        .findOne({ where: { transactionRef: txnRef } });
      expect(payment?.status).toBe(PaymentStatus.FAILED);
    });
  });
});

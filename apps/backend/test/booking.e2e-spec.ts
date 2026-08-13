import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Court } from '../src/venue/entities/court.entity';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { signVnpayParams, toVnpayAmount } from '../src/payment/vnpay.util';

describe('Booking (e2e)', () => {
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
      basePrice: 200000,
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
    // Payment IPN confirmation now writes to `notifications`, so those rows
    // must go before the users they reference (FK) — see notification.entity.ts.
    await dataSource
      .createQueryBuilder()
      .delete()
      .from('notifications')
      .where('user_id IN (:...ids)', {
        ids: [owner.id, playerId, otherPlayerId],
      })
      .execute();
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource.getRepository(User).delete({ id: playerId });
    await dataSource.getRepository(User).delete({ id: otherPlayerId });
    await app.close();
  });

  it('rejects a request with no Authorization header (401)', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .send({
        courtId: court.id,
        bookingDate: '2026-09-01',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(401);
  });

  it('rejects an authenticated request with an invalid payload (400)', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ courtId: court.id })
      .expect(400);
  });

  it('creates a PENDING booking for the authenticated user, price computed from basePrice (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-01',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.totalAmount).toBe(200000);
    expect(typeof res.body.totalAmount).toBe('number');
    expect(res.body.user.id).toBe(playerId);
    createdBookingIds.push(res.body.id);
  });

  it('rejects a second booking for the exact same slot (409)', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-01',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(409);
  });

  it('frees the slot again after cancelling the booking', async () => {
    const bookingId = createdBookingIds[0];

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-01',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);

    createdBookingIds.push(res.body.id);
  });

  describe('authorization', () => {
    let ownBookingId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-05',
          startTime: '09:00',
          endTime: '10:00',
        })
        .expect(201);
      ownBookingId = res.body.id;
      createdBookingIds.push(ownBookingId);
    });

    it('rejects every read/write route with no Authorization header (401)', async () => {
      await request(app.getHttpServer()).get('/bookings').expect(401);
      await request(app.getHttpServer())
        .get(`/bookings/${ownBookingId}`)
        .expect(401);
      await request(app.getHttpServer())
        .patch(`/bookings/${ownBookingId}`)
        .send({ startTime: '11:00' })
        .expect(401);
      await request(app.getHttpServer())
        .post(`/bookings/${ownBookingId}/cancel`)
        .expect(401);
      await request(app.getHttpServer())
        .delete(`/bookings/${ownBookingId}`)
        .expect(401);
    });

    it('rejects a different PLAYER from reading, updating, cancelling or deleting the booking (403)', async () => {
      await request(app.getHttpServer())
        .get(`/bookings/${ownBookingId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/bookings/${ownBookingId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({ startTime: '11:00' })
        .expect(403);
      await request(app.getHttpServer())
        .post(`/bookings/${ownBookingId}/cancel`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/bookings/${ownBookingId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(403);
    });

    it("GET /bookings only returns the caller's own bookings, never another player's", async () => {
      const res = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(200);

      const ids = (res.body as { id: string }[]).map((b) => b.id);
      expect(ids).not.toContain(ownBookingId);
    });

    it('lets the owner read their own booking', async () => {
      const res = await request(app.getHttpServer())
        .get(`/bookings/${ownBookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.id).toBe(ownBookingId);
    });
  });

  describe('payment summary on cancel', () => {
    it('cancel response and a subsequent GET /bookings both carry the refunded payment summary', async () => {
      const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const bookingDate = slotStart.toISOString().slice(0, 10);
      const startTime = `${String(slotStart.getUTCHours()).padStart(2, '0')}:00`;
      const endTime = `${String(slotStart.getUTCHours() + 1).padStart(2, '0')}:00`;

      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ courtId: court.id, bookingDate, startTime, endTime })
        .expect(201);
      const bookingId = createRes.body.id as string;
      createdBookingIds.push(bookingId);

      const checkoutRes = await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      const txnRef = new URL(checkoutRes.body.paymentUrl).searchParams.get(
        'vnp_TxnRef',
      )!;
      const ipnParams = {
        vnp_TxnRef: txnRef,
        vnp_Amount: String(toVnpayAmount(200000)),
        vnp_ResponseCode: '00',
      };
      const vnp_SecureHash = signVnpayParams(ipnParams, hashSecret);
      await request(app.getHttpServer())
        .get('/payments/ipn')
        .query({ ...ipnParams, vnp_SecureHash })
        .expect(200);

      const cancelRes = await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      expect(cancelRes.body.payment.status).toBe('REFUNDED');
      expect(Number(cancelRes.body.payment.refundAmount)).toBe(200000);

      const listRes = await request(app.getHttpServer())
        .get('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const listed = (
        listRes.body as { id: string; payment?: { status: string } }[]
      ).find((b) => b.id === bookingId);
      expect(listed?.payment?.status).toBe('REFUNDED');
    });
  });
});

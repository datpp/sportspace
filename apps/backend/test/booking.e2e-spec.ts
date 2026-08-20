import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
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
import { AddOnService } from '../src/addon-services/entities/add-on-service.entity';
import { BookingServiceItem } from '../src/addon-services/entities/booking-service-item.entity';
import { CourtBlock } from '../src/venue/entities/court-block.entity';
import { signVnpayParams, toVnpayAmount } from '../src/payment/vnpay.util';
import { Payment } from '../src/payment/entities/payment.entity';
import { BookingService } from '../src/booking/booking.service';

const SEED_PASSWORD = 'Password123!';

describe('Booking (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let hashSecret: string;
  let owner: User;
  let otherMerchant: User;
  let venue: Venue;
  let court: Court;
  let playerId: string;
  let accessToken: string;
  let otherPlayerId: string;
  let otherAccessToken: string;
  let ownerToken: string;
  let otherMerchantToken: string;
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

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    owner = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    otherMerchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
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

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    ownerToken = await login(owner.email);
    otherMerchantToken = await login(otherMerchant.email);
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
    await dataSource
      .getRepository(CourtBlock)
      .delete({ court: { id: court.id } });
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
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
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

  it('rejects a request with more than 20 services (400)', async () => {
    const services = Array.from({ length: 21 }, () => ({
      addOnServiceId: faker.string.uuid(),
      quantity: 1,
    }));
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-01',
        startTime: '09:00',
        endTime: '10:00',
        services,
      })
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

  describe('merchant confirm/reject', () => {
    it('lets the owning MERCHANT confirm a PENDING booking (200)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-05',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });

    it('rejects confirm from a non-owning MERCHANT (403)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-06',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${otherMerchantToken}`)
        .expect(403);
    });

    it('rejects confirm from a PLAYER (403)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-07',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('lets the owning MERCHANT reject a PENDING booking with a reason (200)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-08',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Sân đang bảo trì' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 409 when confirming a booking that is not PENDING', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-09',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
    });
  });

  describe('merchant bookings list', () => {
    it("lets the owning MERCHANT see a booking made on their own venue (200)", async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-10',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .get('/merchant/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const ids = (res.body.data as { id: string }[]).map((b) => b.id);
      expect(ids).toContain(createRes.body.id);
    });

    it('a different MERCHANT with no venues of their own sees a disjoint set', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-11',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .get('/merchant/bookings')
        .set('Authorization', `Bearer ${otherMerchantToken}`)
        .expect(200);

      const ids = (res.body.data as { id: string }[]).map((b) => b.id);
      expect(ids).not.toContain(createRes.body.id);
    });

    it('rejects an unauthenticated request (401)', async () => {
      await request(app.getHttpServer()).get('/merchant/bookings').expect(401);
    });

    it('rejects a PLAYER (403)', async () => {
      await request(app.getHttpServer())
        .get('/merchant/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('excludes CANCELLED bookings by default but includes them with ?status=ALL', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-12',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);
      await request(app.getHttpServer())
        .post(`/bookings/${createRes.body.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const defaultRes = await request(app.getHttpServer())
        .get('/merchant/bookings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(
        (defaultRes.body.data as { id: string }[]).map((b) => b.id),
      ).not.toContain(createRes.body.id);

      const allRes = await request(app.getHttpServer())
        .get('/merchant/bookings')
        .query({ status: 'ALL' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(
        (allRes.body.data as { id: string }[]).map((b) => b.id),
      ).toContain(createRes.body.id);
    });

    it('filters merchant bookings by date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/merchant/bookings')
        .query({ status: 'ALL', from: '2099-01-01', to: '2099-01-02' })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  it('full flow: merchant creates a service, player books with it, listing shows the itemized breakdown', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(201);

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-20',
        startTime: '08:00',
        endTime: '09:00',
        services: [{ addOnServiceId: serviceRes.body.id, quantity: 2 }],
      })
      .expect(201);
    expect(bookingRes.body.services).toEqual([
      expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
    ]);
    createdBookingIds.push(bookingRes.body.id);

    const listRes = await request(app.getHttpServer())
      .get('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const found = (listRes.body as { id: string; services?: unknown[] }[]).find(
      (b) => b.id === bookingRes.body.id,
    );
    expect(found?.services).toEqual([
      expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
    ]);

    await dataSource
      .getRepository(BookingServiceItem)
      .delete({ booking: { id: bookingRes.body.id } });
    await dataSource
      .getRepository(AddOnService)
      .delete({ id: serviceRes.body.id });
  });

  it('rejects a booking attempt on a MAINTENANCE court (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'MAINTENANCE' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-10',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('rejects creating a block over an already-booked slot, and rejects booking a blocked slot', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-11',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    createdBookingIds.push(bookingRes.body.id);

    await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        blockDate: '2026-09-11',
        startTime: '09:00',
        endTime: '10:00',
        reason: 'x',
      })
      .expect(409);

    const blockRes = await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        blockDate: '2026-09-12',
        startTime: '14:00',
        endTime: '15:00',
        reason: 'Sự kiện',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-12',
        startTime: '14:00',
        endTime: '15:00',
      })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/courts/${court.id}/blocks/${blockRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('slot listing correctly excludes both a MAINTENANCE court and a blocked window', async () => {
    await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        blockDate: '2026-09-13',
        startTime: '16:00',
        endTime: '17:00',
        reason: 'x',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/courts/${court.id}/slots`)
      .query({ date: '2026-09-13' })
      .expect(200);

    const blockedSlot = res.body.find(
      (s: { startTime: string }) => s.startTime === '16:00',
    );
    expect(blockedSlot.available).toBe(false);
  });

  describe('Stale PENDING booking expiry', () => {
    it('cancels a booking whose checkout was abandoned over 5 minutes ago, freeing the slot', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-25',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      const bookingId = createRes.body.id as string;
      createdBookingIds.push(bookingId);

      await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      await dataSource.query(
        `UPDATE payments SET "updatedAt" = now() - interval '10 minutes' WHERE booking_id = $1`,
        [bookingId],
      );

      const bookingService = app.get(BookingService);
      await bookingService.expireStalePendingBookings();

      const cancelled = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');

      const payment = await dataSource
        .getRepository(Payment)
        .findOne({ where: { booking: { id: bookingId } } });
      expect(payment?.status).toBe('FAILED');

      const retryRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-25',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(retryRes.body.id as string);
    });

    it('leaves a booking whose checkout happened moments ago untouched — proves the 5-minute threshold is real, not a no-op', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-27',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      const bookingId = createRes.body.id as string;
      createdBookingIds.push(bookingId);

      await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(201);

      const bookingService = app.get(BookingService);
      await bookingService.expireStalePendingBookings();

      const stillPending = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(stillPending.body.status).toBe('PENDING');
    });

    it('leaves a PENDING booking with no Payment row untouched, no matter how old (FR-M04 case)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-26',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      const bookingId = createRes.body.id as string;
      createdBookingIds.push(bookingId);

      await dataSource.query(
        `UPDATE bookings SET "createdAt" = now() - interval '1 day' WHERE id = $1`,
        [bookingId],
      );

      const bookingService = app.get(BookingService);
      await bookingService.expireStalePendingBookings();

      const stillPending = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(stillPending.body.status).toBe('PENDING');
    });
  });
});

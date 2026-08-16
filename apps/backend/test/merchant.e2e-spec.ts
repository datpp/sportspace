import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';
import { Booking } from '../src/booking/entities/booking.entity';

const SEED_PASSWORD = 'Password123!';

const BASE_PRICE = 200000;

describe('Merchant endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let merchant: User;
  let otherMerchant: User;
  let merchantToken: string;
  let otherMerchantToken: string;
  let playerToken: string;
  let merchantVenue: Venue;
  let otherMerchantVenue: Venue;
  let merchantCourt: Court;
  let otherMerchantCourt: Court;
  let confirmedBooking: Booking;
  let otherConfirmedBooking: Booking;
  let pendingBooking: Booking;
  const today = new Date().toISOString().slice(0, 10);

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

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    merchant = await dataSource.getRepository(User).save({
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
    merchantVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
    });
    otherMerchantVenue = await dataSource.getRepository(Venue).save({
      owner: otherMerchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    merchantToken = await login(merchant.email);
    otherMerchantToken = await login(otherMerchant.email);

    const playerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: faker.internet.email(),
        password: SEED_PASSWORD,
        fullName: faker.person.fullName(),
      })
      .expect(201);
    playerToken = playerRes.body.accessToken as string;

    merchantCourt = await dataSource.getRepository(Court).save({
      venue: merchantVenue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: BASE_PRICE,
    });
    otherMerchantCourt = await dataSource.getRepository(Court).save({
      venue: otherMerchantVenue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: BASE_PRICE,
    });

    confirmedBooking = await dataSource.getRepository(Booking).save({
      court: merchantCourt,
      user: merchant,
      bookingDate: today,
      startTime: '09:00',
      endTime: '10:00',
      status: BookingStatus.CONFIRMED,
      totalAmount: BASE_PRICE,
    });
    otherConfirmedBooking = await dataSource.getRepository(Booking).save({
      court: otherMerchantCourt,
      user: otherMerchant,
      bookingDate: today,
      startTime: '10:00',
      endTime: '11:00',
      status: BookingStatus.CONFIRMED,
      totalAmount: BASE_PRICE,
    });
    // PENDING bookings must never count toward revenue.
    pendingBooking = await dataSource.getRepository(Booking).save({
      court: merchantCourt,
      user: merchant,
      bookingDate: today,
      startTime: '14:00',
      endTime: '15:00',
      status: BookingStatus.PENDING,
      totalAmount: BASE_PRICE,
    });
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Booking)
      .delete([
        confirmedBooking.id,
        otherConfirmedBooking.id,
        pendingBooking.id,
      ]);
    await dataSource.getRepository(Court).delete({ id: merchantCourt.id });
    await dataSource.getRepository(Court).delete({ id: otherMerchantCourt.id });
    await dataSource.getRepository(Venue).delete({ id: merchantVenue.id });
    await dataSource.getRepository(Venue).delete({ id: otherMerchantVenue.id });
    await dataSource.getRepository(User).delete({ id: merchant.id });
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
    await app.close();
  });

  it('rejects a request with no Authorization header (401)', async () => {
    await request(app.getHttpServer()).get('/merchant/venues').expect(401);
  });

  it('rejects a PLAYER (403)', async () => {
    await request(app.getHttpServer())
      .get('/merchant/venues')
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
  });

  it("returns only the calling merchant's own venues, never another merchant's (200)", async () => {
    const res = await request(app.getHttpServer())
      .get('/merchant/venues')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toContain(merchantVenue.id);
    expect(ids).not.toContain(otherMerchantVenue.id);

    const otherRes = await request(app.getHttpServer())
      .get('/merchant/venues')
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .expect(200);
    const otherIds = (otherRes.body.data as Venue[]).map((v) => v.id);
    expect(otherIds).toContain(otherMerchantVenue.id);
    expect(otherIds).not.toContain(merchantVenue.id);
  });

  it("searches the merchant's own venues by name", async () => {
    const res = await request(app.getHttpServer())
      .get('/merchant/venues')
      .query({ q: merchantVenue.name })
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
    expect((res.body.data as Venue[]).map((v) => v.id)).toEqual([
      merchantVenue.id,
    ]);
  });

  describe('GET /merchant/revenue/timeseries', () => {
    it('rejects a request with no Authorization header (401)', async () => {
      await request(app.getHttpServer())
        .get('/merchant/revenue/timeseries')
        .expect(401);
    });

    it('rejects a PLAYER (403)', async () => {
      await request(app.getHttpServer())
        .get('/merchant/revenue/timeseries')
        .set('Authorization', `Bearer ${playerToken}`)
        .expect(403);
    });

    it('returns 7 zero-filled day-buckets for range=week, with only the CONFIRMED booking counted in the correct bucket', async () => {
      const res = await request(app.getHttpServer())
        .get('/merchant/revenue/timeseries')
        .query({ range: 'week' })
        .set('Authorization', `Bearer ${merchantToken}`)
        .expect(200);

      const points = res.body as {
        bucket: string;
        revenue: number;
        bookings: number;
      }[];
      expect(points).toHaveLength(7);

      const todayPoint = points.find((p) => p.bucket === today);
      expect(todayPoint).toEqual({
        bucket: today,
        revenue: BASE_PRICE,
        bookings: 1,
      });
      expect(typeof todayPoint?.revenue).toBe('number');

      const otherDays = points.filter((p) => p.bucket !== today);
      expect(otherDays.every((p) => p.revenue === 0 && p.bookings === 0)).toBe(
        true,
      );
    });

    it("never mixes another merchant's revenue into the caller's buckets", async () => {
      const res = await request(app.getHttpServer())
        .get('/merchant/revenue/timeseries')
        .query({ range: 'week' })
        .set('Authorization', `Bearer ${otherMerchantToken}`)
        .expect(200);

      const points = res.body as { bucket: string; revenue: number }[];
      const todayPoint = points.find((p) => p.bucket === today);
      // otherMerchant's own CONFIRMED booking is BASE_PRICE, not
      // 2 * BASE_PRICE — merchant's booking must not leak in.
      expect(todayPoint?.revenue).toBe(BASE_PRICE);
    });

    it('returns 12 YYYY-MM buckets for range=year', async () => {
      const res = await request(app.getHttpServer())
        .get('/merchant/revenue/timeseries')
        .query({ range: 'year' })
        .set('Authorization', `Bearer ${merchantToken}`)
        .expect(200);

      const points = res.body as { bucket: string }[];
      expect(points).toHaveLength(12);
      expect(points.every((p) => /^\d{4}-\d{2}$/.test(p.bucket))).toBe(true);
    });
  });
});

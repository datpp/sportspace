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

describe('Review (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let player: User;
  let playerToken: string;
  let venueId: string;
  let pastConfirmedBookingId: string;
  let pendingBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    const merchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.PLAYER,
    });

    const venue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: 'Sân test review',
      address: '123 Test St',
      lat: 10.762622,
      lng: 106.660172,
      status: 'APPROVED',
    });
    venueId = venue.id;

    const court = await dataSource.getRepository(Court).save({
      venue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: 200_000,
    });

    const pastConfirmed = await dataSource.getRepository(Booking).save({
      court,
      user: player,
      bookingDate: '2020-01-01',
      startTime: '18:00',
      endTime: '19:00',
      status: BookingStatus.CONFIRMED,
      totalAmount: 200_000,
    });
    pastConfirmedBookingId = pastConfirmed.id;

    const pending = await dataSource.getRepository(Booking).save({
      court,
      user: player,
      bookingDate: '2020-01-02',
      startTime: '18:00',
      endTime: '19:00',
      status: BookingStatus.PENDING,
      totalAmount: 200_000,
    });
    pendingBookingId = pending.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD });
    playerToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects creating a review for a non-CONFIRMED booking', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pendingBookingId, rating: 5 })
      .expect(400);
  });

  it('creates a review for a past confirmed booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pastConfirmedBookingId, rating: 5, comment: 'Tuyệt vời' })
      .expect(201);
    expect(res.body.rating).toBe(5);
  });

  it('rejects a second review for the same booking', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pastConfirmedBookingId, rating: 3 })
      .expect(400);
  });

  it('lists reviews for the venue with the average rating', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reviews?venueId=${venueId}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.averageRating).toBe(5);
    expect(res.body.items).toHaveLength(1);
  });
});

import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

describe('Booking (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: User;
  let venue: Venue;
  let court: Court;
  let playerId: string;
  let accessToken: string;
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
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await dataSource.getRepository('bookings').delete(createdBookingIds);
    }
    await dataSource.getRepository(Court).delete({ id: court.id });
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource.getRepository(User).delete({ id: playerId });
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
    expect(Number(res.body.totalAmount)).toBe(200000);
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
});

import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { Court } from '../src/venue/entities/court.entity';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';

const BASE_PRICE = 200000;

describe('Realtime slot updates (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let baseUrl: string;
  let owner: User;
  let venue: Venue;
  let court: Court;
  let accessToken: string;
  let clientSocket: ClientSocket;
  const createdBookingIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0);
    baseUrl = await app.getUrl();

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
    accessToken = registerRes.body.accessToken as string;
  }, 30000);

  afterEach(() => {
    clientSocket?.disconnect();
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await dataSource.getRepository('bookings').delete(createdBookingIds);
    }
    await dataSource.getRepository(Court).delete({ id: court.id });
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    await dataSource.getRepository(User).delete({ id: owner.id });
    await app.close();
  });

  function connect(): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const socket = io(baseUrl, { transports: ['websocket'] });
      socket.on('connect', () => resolve(socket));
    });
  }

  function subscribe(
    socket: ClientSocket,
    courtId: string,
    bookingDate: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      socket.emit('court:subscribe', { courtId, bookingDate }, () => resolve());
    });
  }

  it('delivers court:slotUpdate to a subscribed client when a booking is created via REST', async () => {
    clientSocket = await connect();
    const bookingDate = '2026-09-20';
    await subscribe(clientSocket, court.id, bookingDate);

    const eventPromise = new Promise((resolve) => {
      clientSocket.once('court:slotUpdate', resolve);
    });

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate,
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    createdBookingIds.push(res.body.id);

    await expect(eventPromise).resolves.toEqual({
      courtId: court.id,
      bookingDate,
      startTime: '09:00',
      status: 'PENDING',
    });
  });

  it('delivers court:slotUpdate with CANCELLED status when the booking is cancelled', async () => {
    const bookingDate = '2026-09-21';
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate,
        startTime: '10:00',
        endTime: '11:00',
      })
      .expect(201);
    const bookingId = createRes.body.id as string;
    createdBookingIds.push(bookingId);

    clientSocket = await connect();
    await subscribe(clientSocket, court.id, bookingDate);

    const eventPromise = new Promise((resolve) => {
      clientSocket.once('court:slotUpdate', resolve);
    });

    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/cancel`)
      .expect(201);

    await expect(eventPromise).resolves.toEqual({
      courtId: court.id,
      bookingDate,
      // cancel() reloads the booking via findOne() first; Postgres normalizes
      // `time` columns to HH:MM:SS on round-trip (unlike the create-path
      // broadcast, which uses the raw HH:MM straight from the request DTO).
      startTime: '10:00:00',
      status: 'CANCELLED',
    });
  });

  it('does not deliver events for a room the client never subscribed to', async () => {
    clientSocket = await connect();
    await subscribe(clientSocket, court.id, '2026-01-01');

    const received: unknown[] = [];
    clientSocket.on('court:slotUpdate', (event) => received.push(event));

    const res = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-22',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    createdBookingIds.push(res.body.id);

    // give the (unwanted) broadcast a moment to arrive if it were going to.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toEqual([]);
  });
});

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

describe('Notification (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let hashSecret: string;
  let owner: User;
  let venue: Venue;
  let court: Court;
  let playerId: string;
  let accessToken: string;
  let hostToken: string;
  let joinerId: string;
  let joinerToken: string;
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

    const registerPlayer = async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: faker.internet.email(),
          password: 'Password123!',
          fullName: faker.person.fullName(),
        })
        .expect(201);
      return {
        id: res.body.userId as string,
        token: res.body.accessToken as string,
      };
    };

    const player = await registerPlayer();
    playerId = player.id;
    accessToken = player.token;

    const host = await registerPlayer();
    hostToken = host.token;

    const joiner = await registerPlayer();
    joinerId = joiner.id;
    joinerToken = joiner.token;
  });

  afterAll(async () => {
    await dataSource
      .createQueryBuilder()
      .delete()
      .from('notifications')
      .where('user_id IN (:...ids)', { ids: [playerId, joinerId] })
      .execute();
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
    await dataSource.getRepository(User).delete([playerId, joinerId]);
    await app.close();
  });

  it('rejects GET /notifications with no Authorization header (401)', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('records a notification when a booking is CONFIRMED via IPN, visible only to its owner', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-10-05',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const bookingId = bookingRes.body.id as string;
    createdBookingIds.push(bookingId);

    const checkoutRes = await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const txnRef = new URL(checkoutRes.body.paymentUrl).searchParams.get(
      'vnp_TxnRef',
    )!;

    const stringified = {
      vnp_TxnRef: txnRef,
      vnp_Amount: String(toVnpayAmount(BASE_PRICE)),
      vnp_ResponseCode: '00',
    };
    await request(app.getHttpServer())
      .get('/payments/ipn')
      .query({
        ...stringified,
        vnp_SecureHash: signVnpayParams(stringified, hashSecret),
      })
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const notification = listRes.body.find(
      (n: { title: string }) => n.title === 'Đặt sân thành công',
    );
    expect(notification).toBeDefined();
    expect(notification.isRead).toBe(false);

    const otherListRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(200);
    expect(
      otherListRes.body.some((n: { id: string }) => n.id === notification.id),
    ).toBe(false);

    await request(app.getHttpServer())
      .post(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(403);

    const readRes = await request(app.getHttpServer())
      .post(`/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    expect(readRes.body.isRead).toBe(true);
  });

  it('notifies the host on join, and the joiner on accept', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-10-06',
        startTime: '09:00',
        endTime: '10:00',
      })
      .expect(201);
    const bookingId = bookingRes.body.id as string;
    createdBookingIds.push(bookingId);

    const checkoutRes = await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(201);
    const txnRef = new URL(checkoutRes.body.paymentUrl).searchParams.get(
      'vnp_TxnRef',
    )!;
    const stringified = {
      vnp_TxnRef: txnRef,
      vnp_Amount: String(toVnpayAmount(BASE_PRICE)),
      vnp_ResponseCode: '00',
    };
    await request(app.getHttpServer())
      .get('/payments/ipn')
      .query({
        ...stringified,
        vnp_SecureHash: signVnpayParams(stringified, hashSecret),
      })
      .expect(200);

    const matchRes = await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bookingId, slotsTotal: 1 })
      .expect(201);
    const matchId = matchRes.body.id as string;

    const joinRes = await request(app.getHttpServer())
      .post(`/matches/${matchId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(201);

    const hostNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(200);
    expect(
      hostNotifications.body.some(
        (n: { title: string }) => n.title === 'Có yêu cầu xin ghép kèo mới',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(`/matches/${matchId}/participants/${joinRes.body.id}/accept`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(201);

    const joinerNotifications = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${joinerToken}`)
      .expect(200);
    expect(
      joinerNotifications.body.some(
        (n: { title: string }) => n.title === 'Yêu cầu ghép kèo được chấp nhận',
      ),
    ).toBe(true);

    await dataSource
      .createQueryBuilder()
      .delete()
      .from('match_participants')
      .where('match_id = :matchId', { matchId })
      .execute();
    await dataSource.getRepository('matches').delete(matchId);
  });
});

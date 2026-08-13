import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BookingStatus, DisputeStatus, PaymentStatus, Role, VenueStatus } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';
import { Booking } from '../src/booking/entities/booking.entity';
import { Payment } from '../src/payment/entities/payment.entity';
import { Dispute } from '../src/dispute/entities/dispute.entity';
import { Notification } from '../src/notification/entities/notification.entity';

const SEED_PASSWORD = 'Password123!';

describe('Dispute (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: User;
  let player: User;
  let merchant: User;
  let adminToken: string;
  let playerToken: string;
  let venueId: string;
  let courtId: string;
  let bookingId: string;
  let paymentId: string;
  let disputeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    admin = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.ADMIN,
    });
    merchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.MERCHANT,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.PLAYER,
    });

    const venue = await dataSource.getRepository(Venue).save({
      owner: merchant, name: 'Sân test', address: 'Q1', lat: 10.77, lng: 106.7,
      status: VenueStatus.APPROVED,
    });
    venueId = venue.id;
    const court = await dataSource.getRepository(Court).save({
      venue, name: 'Sân 1', sport: 'football', basePrice: 200000,
    });
    courtId = court.id;
    const booking = await dataSource.getRepository(Booking).save({
      court, user: player, bookingDate: '2026-09-01', startTime: '10:00',
      endTime: '11:00', status: BookingStatus.CONFIRMED, totalAmount: 200000,
    });
    bookingId = booking.id;
    const payment = await dataSource.getRepository(Payment).save({
      booking, provider: 'VNPAY', amount: 200000, status: PaymentStatus.PAID,
      transactionRef: faker.string.alphanumeric(10),
    });
    paymentId = payment.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login').send({ email, password: SEED_PASSWORD }).expect(200);
      return res.body.accessToken as string;
    };
    adminToken = await login(admin.email);
    playerToken = await login(player.email);
  });

  afterAll(async () => {
    if (disputeId) await dataSource.getRepository(Dispute).delete({ id: disputeId });
    if (paymentId) await dataSource.getRepository(Payment).delete({ id: paymentId });
    if (bookingId) await dataSource.getRepository(Booking).delete({ id: bookingId });
    if (courtId) await dataSource.getRepository(Court).delete({ id: courtId });
    if (venueId) await dataSource.getRepository(Venue).delete({ id: venueId });
    // applyRefund() best-effort notifies the player — clean up before the
    // FK-constrained user delete below, or the delete throws and app.close()
    // never runs, leaving the connection open and Jest hanging on exit.
    await dataSource
      .getRepository(Notification)
      .delete({ user: { id: player.id } });
    await dataSource.getRepository(User).delete({ id: admin.id });
    await dataSource.getRepository(User).delete({ id: merchant.id });
    await dataSource.getRepository(User).delete({ id: player.id });
    await app.close();
  });

  it('lets the player create a dispute on their own booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId, reason: 'Sân không đúng như mô tả trên hệ thống' })
      .expect(201);
    disputeId = res.body.id;
    expect(res.body.status).toBe(DisputeStatus.OPEN);
  });

  it('rejects listing/resolving disputes by a non-ADMIN (403)', async () => {
    await request(app.getHttpServer())
      .get('/disputes').set('Authorization', `Bearer ${playerToken}`).expect(403);
  });

  it('lets an ADMIN resolve the dispute with a refund, marking the payment REFUNDED', async () => {
    const resolveRes = await request(app.getHttpServer())
      .patch(`/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: DisputeStatus.RESOLVED,
        resolutionNote: 'Khiếu nại hợp lý, hoàn tiền toàn bộ',
        refundAmount: 200000,
      })
      .expect(200);
    expect(resolveRes.body.status).toBe(DisputeStatus.RESOLVED);

    const payment = await dataSource.getRepository(Payment).findOne({ where: { id: paymentId } });
    expect(payment?.status).toBe(PaymentStatus.REFUNDED);

    const booking = await dataSource.getRepository(Booking).findOne({ where: { id: bookingId } });
    expect(booking?.status).toBe(BookingStatus.CANCELLED);
  });
});

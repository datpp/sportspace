import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';
import { PriceRule } from '../src/venue/entities/price-rule.entity';

const SEED_PASSWORD = 'Password123!';

describe('Venue + Court (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let merchant: User;
  let otherMerchant: User;
  let merchantToken: string;
  let otherMerchantToken: string;
  let playerToken: string;
  let venueId: string;
  let courtId: string;

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
  });

  afterAll(async () => {
    if (courtId) {
      await dataSource
        .getRepository(PriceRule)
        .delete({ court: { id: courtId } });
      await dataSource.getRepository(Court).delete({ id: courtId });
    }
    if (venueId) {
      await dataSource.getRepository(Venue).delete({ id: venueId });
    }
    await dataSource.getRepository(User).delete({ id: merchant.id });
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
    await app.close();
  });

  it('rejects venue creation without a token (401)', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .send({ name: 'X', address: 'Y', lat: 10.76, lng: 106.66 })
      .expect(401);
  });

  it('rejects venue creation by a PLAYER (403)', async () => {
    await request(app.getHttpServer())
      .post('/venues')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ name: 'X', address: 'Y', lat: 10.76, lng: 106.66 })
      .expect(403);
  });

  it('lets a MERCHANT create a venue (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/venues')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Sportspace Test Venue',
        address: '123 Test St',
        lat: 10.762622,
        lng: 106.660172,
      })
      .expect(201);

    venueId = res.body.id;
    expect(res.body.owner.id).toBe(merchant.id);
    expect(res.body.owner.passwordHash).toBeUndefined();
  });

  it('lets the owning MERCHANT create a court in that venue (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/courts')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ venueId, name: 'Sân 1', sport: 'football', basePrice: 200_000 })
      .expect(201);

    courtId = res.body.id;
  });

  it('denies a different MERCHANT from updating the venue (403)', async () => {
    await request(app.getHttpServer())
      .patch(`/venues/${venueId}`)
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('finds the venue publicly by sport, no auth required', async () => {
    const res = await request(app.getHttpServer())
      .get('/venues')
      .query({ sport: 'football' })
      .expect(200);

    expect(res.body.some((v: { id: string }) => v.id === venueId)).toBe(true);
  });

  it('adds a price rule and reflects it in the slots for the matching hour', async () => {
    const monday = 1;
    await request(app.getHttpServer())
      .post(`/courts/${courtId}/price-rules`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        dayOfWeek: monday,
        startTime: '18:00',
        endTime: '19:00',
        price: 350_000,
      })
      .expect(201);

    // 2026-08-10 is a Monday (UTC).
    const res = await request(app.getHttpServer())
      .get(`/courts/${courtId}/slots`)
      .query({ date: '2026-08-10' })
      .expect(200);

    const eveningSlot = res.body.find(
      (s: { startTime: string }) => s.startTime === '18:00',
    );
    const morningSlot = res.body.find(
      (s: { startTime: string }) => s.startTime === '06:00',
    );
    expect(Number(eveningSlot.price)).toBe(350_000);
    expect(Number(morningSlot.price)).toBe(200_000);
    expect(eveningSlot.available).toBe(true);
  });
});

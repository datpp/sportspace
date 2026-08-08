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

const SEED_PASSWORD = 'Password123!';

describe('GET /merchant/venues (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let merchant: User;
  let otherMerchant: User;
  let merchantToken: string;
  let otherMerchantToken: string;
  let playerToken: string;
  let merchantVenue: Venue;
  let otherMerchantVenue: Venue;

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
  });

  afterAll(async () => {
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

    const ids = (res.body as Venue[]).map((v) => v.id);
    expect(ids).toContain(merchantVenue.id);
    expect(ids).not.toContain(otherMerchantVenue.id);

    const otherRes = await request(app.getHttpServer())
      .get('/merchant/venues')
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .expect(200);
    const otherIds = (otherRes.body as Venue[]).map((v) => v.id);
    expect(otherIds).toContain(otherMerchantVenue.id);
    expect(otherIds).not.toContain(merchantVenue.id);
  });
});

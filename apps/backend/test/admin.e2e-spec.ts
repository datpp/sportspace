import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role, VenueStatus } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';

const SEED_PASSWORD = 'Password123!';

describe('GET /admin/venues (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let merchant: User;
  let admin: User;
  let merchantToken: string;
  let adminToken: string;
  let pendingVenue: Venue;
  let approvedVenue: Venue;
  let rejectedVenue: Venue;

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
    admin = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.ADMIN,
    });

    pendingVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.PENDING,
    });
    approvedVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.APPROVED,
    });
    rejectedVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.REJECTED,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    merchantToken = await login(merchant.email);
    adminToken = await login(admin.email);
  });

  afterAll(async () => {
    await dataSource
      .getRepository(Venue)
      .delete([pendingVenue.id, approvedVenue.id, rejectedVenue.id]);
    await dataSource.getRepository(User).delete({ id: merchant.id });
    await dataSource.getRepository(User).delete({ id: admin.id });
    await app.close();
  });

  it('rejects a request with no Authorization header (401)', async () => {
    await request(app.getHttpServer()).get('/admin/venues').expect(401);
  });

  it('rejects a MERCHANT (403)', async () => {
    await request(app.getHttpServer())
      .get('/admin/venues')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(403);
  });

  it('defaults to PENDING only, never mixing in APPROVED/REJECTED venues', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body as Venue[]).map((v) => v.id);
    expect(ids).toContain(pendingVenue.id);
    expect(ids).not.toContain(approvedVenue.id);
    expect(ids).not.toContain(rejectedVenue.id);
  });

  it('returns the owner field so the admin knows who registered the venue', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const found = (res.body as { id: string; owner: { id: string } }[]).find(
      (v) => v.id === pendingVenue.id,
    );
    expect(found?.owner?.id).toBe(merchant.id);
  });

  it('honors an explicit ?status= query', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: VenueStatus.APPROVED })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body as Venue[]).map((v) => v.id);
    expect(ids).toContain(approvedVenue.id);
    expect(ids).not.toContain(pendingVenue.id);
    expect(ids).not.toContain(rejectedVenue.id);
  });
});

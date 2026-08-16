import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role, VenueStatus, VIETNAM_PROVINCES } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';

const SEED_PASSWORD = 'Password123!';
const NAME_MARKER = `E2ETestVenue-${faker.string.alphanumeric(8)}`;
const markedName = () => `${NAME_MARKER} ${faker.company.name()}`;

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
  let multiCourtVenue: Venue;

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
      name: markedName(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.PENDING,
      province: faker.helpers.arrayElement(VIETNAM_PROVINCES),
    });
    approvedVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: markedName(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.APPROVED,
      province: faker.helpers.arrayElement(VIETNAM_PROVINCES),
    });
    rejectedVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: markedName(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.REJECTED,
      province: faker.helpers.arrayElement(VIETNAM_PROVINCES),
    });
    multiCourtVenue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: markedName(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
      status: VenueStatus.APPROVED,
      province: faker.helpers.arrayElement(VIETNAM_PROVINCES),
    });
    await dataSource.getRepository(Court).save([
      {
        venue: multiCourtVenue,
        name: 'Sân A',
        sport: 'football',
        basePrice: 200000,
      },
      {
        venue: multiCourtVenue,
        name: 'Sân B',
        sport: 'football',
        basePrice: 250000,
      },
    ]);

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
      .getRepository(Court)
      .delete({ venue: { id: multiCourtVenue.id } });
    await dataSource
      .getRepository(Venue)
      .delete([
        pendingVenue.id,
        approvedVenue.id,
        rejectedVenue.id,
        multiCourtVenue.id,
      ]);
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

    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toContain(pendingVenue.id);
    expect(ids).not.toContain(approvedVenue.id);
    expect(ids).not.toContain(rejectedVenue.id);
  });

  it('returns the owner field so the admin knows who registered the venue', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const found = (
      res.body.data as { id: string; owner: { id: string } }[]
    ).find((v) => v.id === pendingVenue.id);
    expect(found?.owner?.id).toBe(merchant.id);
  });

  it('honors an explicit ?status= query', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: VenueStatus.APPROVED })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toContain(approvedVenue.id);
    expect(ids).not.toContain(pendingVenue.id);
    expect(ids).not.toContain(rejectedVenue.id);
  });

  it('lists every status when ?status=ALL', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: 'ALL' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        pendingVenue.id,
        approvedVenue.id,
        rejectedVenue.id,
      ]),
    );
  });

  it('searches venues by name, address, or owner', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: 'ALL', q: pendingVenue.name })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toEqual([pendingVenue.id]);
  });

  it('lists the distinct provinces currently in use', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues/provinces')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain(pendingVenue.province);
  });

  it('paginates by distinct venues, not fanned-out by a venue having multiple courts', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/venues')
      .query({ status: 'ALL', q: NAME_MARKER, limit: 4, page: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.meta.total).toBe(4);
    const ids = (res.body.data as Venue[]).map((v) => v.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(
      expect.arrayContaining([
        pendingVenue.id,
        approvedVenue.id,
        rejectedVenue.id,
        multiCourtVenue.id,
      ]),
    );
  });
});

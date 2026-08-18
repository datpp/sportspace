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
import { AddOnService } from '../src/addon-services/entities/add-on-service.entity';

const SEED_PASSWORD = 'Password123!';

describe('AddOnServices (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: User;
  let otherMerchant: User;
  let venue: Venue;
  let ownerToken: string;
  let otherMerchantToken: string;
  let serviceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    owner = await dataSource.getRepository(User).save({
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
    venue = await dataSource.getRepository(Venue).save({
      owner,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 21.0285,
      lng: 105.8542,
      province: 'Hà Nội',
      status: VenueStatus.APPROVED,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    ownerToken = await login(owner.email);
    otherMerchantToken = await login(otherMerchant.email);
  });

  afterAll(async () => {
    if (serviceId) {
      await dataSource.getRepository(AddOnService).delete({ id: serviceId });
    }
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
    await app.close();
  });

  it('rejects create by a merchant who does not own the venue (403)', async () => {
    await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(403);
  });

  it('lets the owning merchant create, list, update, and delete a service', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(201);
    serviceId = createRes.body.id;
    expect(createRes.body.isActive).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get('/addon-services')
      .query({ venueId: venue.id })
      .expect(200);
    expect((listRes.body as { id: string }[]).map((s) => s.id)).toContain(serviceId);

    const updateRes = await request(app.getHttpServer())
      .patch(`/addon-services/${serviceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 25000 })
      .expect(200);
    expect(Number(updateRes.body.price)).toBe(25000);

    await request(app.getHttpServer())
      .delete(`/addon-services/${serviceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    serviceId = '';
  });
});

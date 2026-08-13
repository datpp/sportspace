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

describe('Staff + Shift (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let merchantToken: string;
  let otherMerchantToken: string;
  let venueId: string;
  let staffId: string;
  let shiftId: string;

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
    const otherMerchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD });
      return res.body.accessToken as string;
    };
    merchantToken = await login(merchant.email);
    otherMerchantToken = await login(otherMerchant.email);

    const venue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.0,
      lng: 106.0,
    });
    venueId = venue.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /staff — tạo nhân viên', async () => {
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ venueId, fullName: 'Nguyễn Văn A', phone: '0900000000', position: 'Lễ tân' })
      .expect(201);

    staffId = res.body.id;
    expect(res.body.fullName).toBe('Nguyễn Văn A');
  });

  it('POST /staff — 403 khi chủ sân khác cố tạo nhân viên', async () => {
    await request(app.getHttpServer())
      .post('/staff')
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .send({ venueId, fullName: 'X', phone: '0900000001', position: 'Bảo vệ' })
      .expect(403);
  });

  it('GET /staff?venueId= — danh sách nhân viên', async () => {
    const res = await request(app.getHttpServer())
      .get(`/staff?venueId=${venueId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('POST /staff/:id/shifts — tạo ca làm', async () => {
    const res = await request(app.getHttpServer())
      .post(`/staff/${staffId}/shifts`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ shiftDate: '2026-09-01', startTime: '08:00', endTime: '12:00' })
      .expect(201);

    shiftId = res.body.id;
    expect(res.body.startTime.slice(0, 5)).toBe('08:00');
  });

  it('POST /staff/:id/shifts — 400 khi trùng giờ với ca đã có', async () => {
    await request(app.getHttpServer())
      .post(`/staff/${staffId}/shifts`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ shiftDate: '2026-09-01', startTime: '10:00', endTime: '14:00' })
      .expect(400);
  });

  it('GET /staff/:id/shifts — danh sách ca làm', async () => {
    const res = await request(app.getHttpServer())
      .get(`/staff/${staffId}/shifts`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
  });

  it('PATCH /staff/:id — vô hiệu hoá nhân viên', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/staff/${staffId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('DELETE /staff/:id — xoá nhân viên (xoá ca làm trước do FK ON DELETE NO ACTION)', async () => {
    await request(app.getHttpServer())
      .delete(`/staff/${staffId}/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/staff/${staffId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
  });
});

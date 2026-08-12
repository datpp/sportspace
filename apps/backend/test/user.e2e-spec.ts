import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';

describe('User (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userId: string;
  let accessToken: string;

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

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);
    userId = registerRes.body.userId;
    accessToken = registerRes.body.accessToken;
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ id: userId });
    await app.close();
  });

  it('rejects PATCH /users/me/fcm-token with no Authorization header (401)', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/fcm-token')
      .send({ fcmToken: 'device-token' })
      .expect(401);
  });

  it('sets fcmToken for the authenticated user (200)', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/fcm-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken: 'device-token-123' })
      .expect(200);

    const user = await dataSource.getRepository(User).findOne({
      where: { id: userId },
    });
    expect(user?.fcmToken).toBe('device-token-123');
  });

  it('rejects an empty fcmToken (400)', async () => {
    await request(app.getHttpServer())
      .patch('/users/me/fcm-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken: '' })
      .expect(400);
  });
});

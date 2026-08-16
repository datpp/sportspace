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

const SEED_PASSWORD = 'Password123!';

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

describe('User admin (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: User;
  let player: User;
  let adminToken: string;
  let playerToken: string;

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
    admin = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.ADMIN,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.PLAYER,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    adminToken = await login(admin.email);
    playerToken = await login(player.email);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ id: admin.id });
    await dataSource.getRepository(User).delete({ id: player.id });
    await app.close();
  });

  it('rejects list/lock/unlock by a non-ADMIN (403)', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/users/${player.id}/lock`)
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
  });

  it('lets an ADMIN list users, lock, and unlock a player', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listRes.body.data.some((u: { id: string }) => u.id === player.id),
    ).toBe(true);
    expect(listRes.body.meta).toMatchObject({ page: 1, limit: 20 });

    const lockRes = await request(app.getHttpServer())
      .patch(`/users/${player.id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(lockRes.body.isLocked).toBe(true);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD })
      .expect(403);

    const unlockRes = await request(app.getHttpServer())
      .patch(`/users/${player.id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(unlockRes.body.isLocked).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD })
      .expect(200);
  });

  it('filters the user list by role', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ role: Role.ADMIN })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.every((u: { role: string }) => u.role === Role.ADMIN)).toBe(true);
    expect(res.body.data.some((u: { id: string }) => u.id === player.id)).toBe(false);
  });

  it('searches the user list by fullName or email', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ q: player.email })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([player.id]);
  });

  it('paginates the user list', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.limit).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });
});

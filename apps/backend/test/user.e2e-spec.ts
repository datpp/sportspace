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
      listRes.body.some((u: { id: string }) => u.id === player.id),
    ).toBe(true);

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
});

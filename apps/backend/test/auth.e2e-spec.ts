import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const createdUserIds: string[] = [];

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
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await dataSource.getRepository(User).delete(createdUserIds);
    }
    await app.close();
  });

  it('registers a new PLAYER and returns a bearer token (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: faker.internet.email(),
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);

    expect(res.body.role).toBe('PLAYER');
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
    expect(typeof res.body.refreshToken).toBe('string');
    createdUserIds.push(res.body.userId);
  });

  it('rejects registering the same email twice (409)', async () => {
    const email = faker.internet.email();
    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);
    createdUserIds.push(first.body.userId);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'AnotherPass1!',
        fullName: faker.person.fullName(),
      })
      .expect(409);
  });

  it('logs in with the correct password (200)', async () => {
    const email = faker.internet.email();
    const password = 'Password123!';
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, fullName: faker.person.fullName() })
      .expect(201);
    createdUserIds.push(registered.body.userId);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.userId).toBe(registered.body.userId);
  });

  it('rejects login with a wrong password (401)', async () => {
    const email = faker.internet.email();
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        fullName: faker.person.fullName(),
      })
      .expect(201);
    createdUserIds.push(registered.body.userId);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);
  });
});

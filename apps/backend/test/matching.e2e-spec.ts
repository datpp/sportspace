import { faker } from '@faker-js/faker';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Court } from '../src/venue/entities/court.entity';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Booking } from '../src/booking/entities/booking.entity';
import { Match } from '../src/matching/entities/match.entity';
import { MatchParticipant } from '../src/matching/entities/match-participant.entity';

const BASE_PRICE = 200000;

describe('Matching (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: User;
  let venue: Venue;
  let court: Court;
  let host: User;
  let hostToken: string;
  let playerA: User;
  let playerAToken: string;
  let playerB: User;
  let playerBToken: string;
  let playerC: User;
  let playerCToken: string;
  let confirmedBooking: Booking;
  let pendingBooking: Booking;
  const matchIds: string[] = [];

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

    owner = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash: 'hash',
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    venue = await dataSource.getRepository(Venue).save({
      owner,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 10.762622,
      lng: 106.660172,
    });
    court = await dataSource.getRepository(Court).save({
      venue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: BASE_PRICE,
    });

    const registerPlayer = async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: faker.internet.email(),
          password: 'Password123!',
          fullName: faker.person.fullName(),
        })
        .expect(201);
      return {
        id: res.body.userId as string,
        token: res.body.accessToken as string,
      };
    };

    const hostReg = await registerPlayer();
    host = { id: hostReg.id } as User;
    hostToken = hostReg.token;

    const aReg = await registerPlayer();
    playerA = { id: aReg.id } as User;
    playerAToken = aReg.token;

    const bReg = await registerPlayer();
    playerB = { id: bReg.id } as User;
    playerBToken = bReg.token;

    const cReg = await registerPlayer();
    playerC = { id: cReg.id } as User;
    playerCToken = cReg.token;

    confirmedBooking = await dataSource.getRepository(Booking).save({
      court,
      user: host,
      bookingDate: '2026-09-20',
      startTime: '09:00',
      endTime: '10:00',
      status: BookingStatus.CONFIRMED,
      totalAmount: BASE_PRICE,
    });
    pendingBooking = await dataSource.getRepository(Booking).save({
      court,
      user: host,
      bookingDate: '2026-09-21',
      startTime: '09:00',
      endTime: '10:00',
      status: BookingStatus.PENDING,
      totalAmount: BASE_PRICE,
    });
  });

  afterAll(async () => {
    if (matchIds.length) {
      await dataSource
        .createQueryBuilder()
        .delete()
        .from(MatchParticipant)
        .where('match_id IN (:...ids)', { ids: matchIds })
        .execute();
      await dataSource.getRepository(Match).delete(matchIds);
    }
    await dataSource
      .getRepository(Booking)
      .delete([confirmedBooking.id, pendingBooking.id]);
    await dataSource.getRepository(Court).delete({ id: court.id });
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    // join/accept/reject now write to `notifications`, so those rows must go
    // before the users they reference (FK) — see notification.entity.ts.
    await dataSource
      .createQueryBuilder()
      .delete()
      .from('notifications')
      .where('user_id IN (:...ids)', {
        ids: [owner.id, host.id, playerA.id, playerB.id, playerC.id],
      })
      .execute();
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource
      .getRepository(User)
      .delete([host.id, playerA.id, playerB.id, playerC.id]);
    await app.close();
  });

  it('rejects match creation with no Authorization header (401)', async () => {
    await request(app.getHttpServer())
      .post('/matches')
      .send({ bookingId: confirmedBooking.id, slotsTotal: 2 })
      .expect(401);
  });

  it('rejects creation by a user who does not own the booking (403)', async () => {
    await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', `Bearer ${playerAToken}`)
      .send({ bookingId: confirmedBooking.id, slotsTotal: 2 })
      .expect(403);
  });

  it('rejects creation from a booking that is not CONFIRMED (400)', async () => {
    await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bookingId: pendingBooking.id, slotsTotal: 2 })
      .expect(400);
  });

  it('lets the booking owner create an OPEN match (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        bookingId: confirmedBooking.id,
        slotsTotal: 2,
        skillLevel: 'khá',
      })
      .expect(201);

    matchIds.push(res.body.id);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.slotsFilled).toBe(0);
  });

  it('rejects a second match from the same booking (400)', async () => {
    await request(app.getHttpServer())
      .post('/matches')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ bookingId: confirmedBooking.id, slotsTotal: 1 })
      .expect(400);
  });

  it('finds the match publicly by sport, no auth required', async () => {
    const res = await request(app.getHttpServer())
      .get('/matches')
      .query({ sport: 'football' })
      .expect(200);

    expect(res.body.some((m: { id: string }) => m.id === matchIds[0])).toBe(
      true,
    );
  });

  it('rejects the host trying to join their own match (400)', async () => {
    await request(app.getHttpServer())
      .post(`/matches/${matchIds[0]}/join`)
      .set('Authorization', `Bearer ${hostToken}`)
      .expect(400);
  });

  describe('full accept flow: fills up and auto-closes', () => {
    let requestAId: string;
    let requestBId: string;

    it('lets playerA and playerB request to join (201)', async () => {
      const resA = await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/join`)
        .set('Authorization', `Bearer ${playerAToken}`)
        .expect(201);
      requestAId = resA.body.id;
      expect(resA.body.status).toBe('REQUESTED');

      const resB = await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/join`)
        .set('Authorization', `Bearer ${playerBToken}`)
        .expect(201);
      requestBId = resB.body.id;
    });

    it('rejects a duplicate join request from the same player (400)', async () => {
      await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/join`)
        .set('Authorization', `Bearer ${playerAToken}`)
        .expect(400);
    });

    it('rejects accept/reject from a non-host user (403)', async () => {
      await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/participants/${requestAId}/accept`)
        .set('Authorization', `Bearer ${playerAToken}`)
        .expect(403);
    });

    it('host accepts playerA: slotsFilled=1, match stays OPEN', async () => {
      const res = await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/participants/${requestAId}/accept`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(201);
      expect(res.body.status).toBe('ACCEPTED');

      const matchRes = await request(app.getHttpServer())
        .get(`/matches/${matchIds[0]}`)
        .expect(200);
      expect(matchRes.body.slotsFilled).toBe(1);
      expect(matchRes.body.status).toBe('OPEN');
    });

    it('host accepts playerB: slotsFilled=2, match auto-CLOSES', async () => {
      await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/participants/${requestBId}/accept`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(201);

      const matchRes = await request(app.getHttpServer())
        .get(`/matches/${matchIds[0]}`)
        .expect(200);
      expect(matchRes.body.slotsFilled).toBe(2);
      expect(matchRes.body.status).toBe('CLOSED');
    });

    it('no longer appears in public search once CLOSED', async () => {
      const res = await request(app.getHttpServer())
        .get('/matches')
        .query({ sport: 'football' })
        .expect(200);
      expect(res.body.some((m: { id: string }) => m.id === matchIds[0])).toBe(
        false,
      );
    });

    it('rejects playerC trying to join a CLOSED match (400)', async () => {
      await request(app.getHttpServer())
        .post(`/matches/${matchIds[0]}/join`)
        .set('Authorization', `Bearer ${playerCToken}`)
        .expect(400);
    });
  });

  describe('reject flow (separate match)', () => {
    let secondMatchId: string;
    let secondBooking: Booking;

    beforeAll(async () => {
      secondBooking = await dataSource.getRepository(Booking).save({
        court,
        user: host,
        bookingDate: '2026-09-22',
        startTime: '09:00',
        endTime: '10:00',
        status: BookingStatus.CONFIRMED,
        totalAmount: BASE_PRICE,
      });
      const res = await request(app.getHttpServer())
        .post('/matches')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ bookingId: secondBooking.id, slotsTotal: 1 })
        .expect(201);
      secondMatchId = res.body.id;
    });

    afterAll(async () => {
      // Must delete in FK order: match_participants -> matches -> the
      // booking. Jest tears nested-describe afterAll hooks down inner-first,
      // so this can't rely on the outer afterAll (which deletes `matchIds`)
      // to remove the Match before this hook deletes `secondBooking`.
      await dataSource
        .createQueryBuilder()
        .delete()
        .from(MatchParticipant)
        .where('match_id = :matchId', { matchId: secondMatchId })
        .execute();
      await dataSource.getRepository(Match).delete(secondMatchId);
      await dataSource.getRepository(Booking).delete(secondBooking.id);
    });

    it('host rejects a join request: slotsFilled unchanged, match stays OPEN', async () => {
      const joinRes = await request(app.getHttpServer())
        .post(`/matches/${secondMatchId}/join`)
        .set('Authorization', `Bearer ${playerCToken}`)
        .expect(201);

      const rejectRes = await request(app.getHttpServer())
        .post(
          `/matches/${secondMatchId}/participants/${joinRes.body.id}/reject`,
        )
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(201);
      expect(rejectRes.body.status).toBe('REJECTED');

      const matchRes = await request(app.getHttpServer())
        .get(`/matches/${secondMatchId}`)
        .expect(200);
      expect(matchRes.body.slotsFilled).toBe(0);
      expect(matchRes.body.status).toBe('OPEN');
    });
  });
});

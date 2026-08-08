import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { Role } from '@sportspace/shared';
import dataSource from '../../src/database/data-source';
import { Court } from '../../src/venue/entities/court.entity';
import { User } from '../../src/user/entities/user.entity';
import { Venue } from '../../src/venue/entities/venue.entity';

const PLAYER_PASSWORD = 'K6Password123!';

async function main() {
  await dataSource.initialize();

  const stamp = Date.now();
  const owner = await dataSource.getRepository(User).save({
    email: `k6-owner-${stamp}@sportspace.test`,
    passwordHash: 'k6-seed',
    fullName: 'K6 Owner',
    role: Role.MERCHANT,
  });
  const player = await dataSource.getRepository(User).save({
    email: `k6-player-${stamp}@sportspace.test`,
    passwordHash: await bcrypt.hash(PLAYER_PASSWORD, 10),
    fullName: 'K6 Player',
    role: Role.PLAYER,
  });
  const venue = await dataSource.getRepository(Venue).save({
    owner,
    name: 'K6 Venue',
    address: 'K6 Address',
    lat: 10.762622,
    lng: 106.660172,
  });
  const court = await dataSource.getRepository(Court).save({
    venue,
    name: 'K6 Court',
    sport: 'football',
    basePrice: 200000,
  });

  await dataSource.destroy();

  const env = {
    PLAYER_ID: player.id,
    PLAYER_EMAIL: player.email,
    PLAYER_PASSWORD,
    COURT_ID: court.id,
    VENUE_ID: venue.id,
    OWNER_ID: owner.id,
    BOOKING_DATE: '2026-12-01',
    START_TIME: '09:00',
    END_TIME: '10:00',
  };
  for (const [key, value] of Object.entries(env)) {
    console.log(`${key}=${value}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

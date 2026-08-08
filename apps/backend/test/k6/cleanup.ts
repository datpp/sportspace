import 'reflect-metadata';
import dataSource from '../../src/database/data-source';

async function main() {
  const [courtId, venueId, ownerId, playerId] = process.argv.slice(2);
  await dataSource.initialize();

  await dataSource.query('DELETE FROM bookings WHERE court_id = $1', [courtId]);
  await dataSource.query('DELETE FROM courts WHERE id = $1', [courtId]);
  await dataSource.query('DELETE FROM venues WHERE id = $1', [venueId]);
  await dataSource.query('DELETE FROM users WHERE id = ANY($1)', [
    [ownerId, playerId],
  ]);

  await dataSource.destroy();
  console.log('K6 seed data cleaned up.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

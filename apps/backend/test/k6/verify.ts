import 'reflect-metadata';
import dataSource from '../../src/database/data-source';

async function main() {
  const [courtId, bookingDate, startTime] = process.argv.slice(2);
  await dataSource.initialize();

  const rows = await dataSource.query(
    `SELECT id, status FROM bookings
     WHERE court_id = $1 AND "bookingDate" = $2 AND "startTime" = $3
       AND status IN ('PENDING','CONFIRMED')`,
    [courtId, bookingDate, startTime],
  );

  await dataSource.destroy();

  console.log(`Active bookings for the contended slot: ${rows.length}`);
  if (rows.length !== 1) {
    console.error(
      `FAIL: expected exactly 1 active booking, found ${rows.length}`,
    );
    process.exit(1);
  }
  console.log('PASS: exactly 1 booking exists in DB for the contended slot.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

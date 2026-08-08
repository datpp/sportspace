import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PLAYER_ID = __ENV.PLAYER_ID;
const COURT_ID = __ENV.COURT_ID;
const BOOKING_DATE = __ENV.BOOKING_DATE;
const START_TIME = __ENV.START_TIME;
const END_TIME = __ENV.END_TIME;

// CLAUDE.md §6: 50 concurrent requests for the exact same court/date/slot —
// must yield exactly 1 booking in DB and 49x 409.
export const options = {
  scenarios: {
    slam_same_slot: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 50,
      maxDuration: '30s',
    },
  },
  thresholds: {
    checks: ['rate==1'],
  },
};

export default function bookSameSlot() {
  const payload = JSON.stringify({
    userId: PLAYER_ID,
    courtId: COURT_ID,
    bookingDate: BOOKING_DATE,
    startTime: START_TIME,
    endTime: END_TIME,
  });

  const res = http.post(`${BASE_URL}/bookings`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 201 (won the slot) or 409 (lost the race)': (r) => r.status === 201 || r.status === 409,
  });
}

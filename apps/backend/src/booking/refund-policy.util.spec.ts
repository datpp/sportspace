import {
  calculateRefundPercentage,
  combineBookingDateTime,
} from './refund-policy.util';

function hoursBefore(slotStart: Date, hours: number): Date {
  return new Date(slotStart.getTime() - hours * 60 * 60 * 1000);
}

describe('calculateRefundPercentage', () => {
  const slotStart = new Date('2026-09-01T09:00:00Z');

  it('refunds 100% when cancelling more than 24h before the slot', () => {
    const now = hoursBefore(slotStart, 25);
    expect(calculateRefundPercentage(now, slotStart)).toBe(1);
  });

  it('refunds 50% at exactly the 24h boundary', () => {
    const now = hoursBefore(slotStart, 24);
    expect(calculateRefundPercentage(now, slotStart)).toBe(0.5);
  });

  it('refunds 50% for a cancel comfortably inside the 2-24h window', () => {
    const now = hoursBefore(slotStart, 10);
    expect(calculateRefundPercentage(now, slotStart)).toBe(0.5);
  });

  it('refunds 50% at exactly the 2h boundary', () => {
    const now = hoursBefore(slotStart, 2);
    expect(calculateRefundPercentage(now, slotStart)).toBe(0.5);
  });

  it('refunds 0% for a cancel just inside 2h (1h59m before)', () => {
    const now = hoursBefore(slotStart, 1 + 59 / 60);
    expect(calculateRefundPercentage(now, slotStart)).toBe(0);
  });

  it('refunds 0% when cancelling after the slot has already started', () => {
    const now = hoursBefore(slotStart, -1);
    expect(calculateRefundPercentage(now, slotStart)).toBe(0);
  });
});

describe('combineBookingDateTime', () => {
  it('combines a YYYY-MM-DD date and HH:mm time into a UTC Date', () => {
    const result = combineBookingDateTime('2026-09-01', '09:00');
    expect(result.toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });

  it('tolerates a Postgres-style HH:mm:ss time string', () => {
    const result = combineBookingDateTime('2026-09-01', '09:00:00');
    expect(result.toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });
});

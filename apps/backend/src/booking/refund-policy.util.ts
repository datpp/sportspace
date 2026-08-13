const FULL_REFUND_HOURS = 24;
const NO_REFUND_HOURS = 2;

/**
 * CLAUDE.md §7: >24h before the slot = 100% refund, 2-24h = 50%, <2h = 0%.
 * The 24h and 2h boundaries themselves fall in the 50% band.
 */
export function calculateRefundPercentage(now: Date, slotStart: Date): number {
  const hoursUntilSlot =
    (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSlot > FULL_REFUND_HOURS) {
    return 1;
  }
  if (hoursUntilSlot >= NO_REFUND_HOURS) {
    return 0.5;
  }
  return 0;
}

/**
 * `startTime` may come back from Postgres as "HH:mm:ss"; only the first two
 * segments matter here (see court.service.ts for the same trim elsewhere).
 */
export function combineBookingDateTime(
  bookingDate: string,
  startTime: string,
): Date {
  return new Date(`${bookingDate}T${startTime.slice(0, 5)}:00Z`);
}

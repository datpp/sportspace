const FULL_REFUND_HOURS = 24;
const NO_REFUND_HOURS = 2;
const PARTIAL_REFUND_PERCENT = 0.5;

/**
 * CLAUDE.md §7: >24h before the slot = 100% refund, 2-24h = partial (default
 * 50%), <2h = 0%. The 24h and 2h boundaries themselves fall in the partial
 * band. Thresholds default to the hardcoded policy but are overridable so
 * callers can source them from `SystemConfig` (admin-operations plan, Task 9).
 */
export function calculateRefundPercentage(
  now: Date,
  slotStart: Date,
  fullRefundHours: number = FULL_REFUND_HOURS,
  partialRefundHours: number = NO_REFUND_HOURS,
  partialRefundPercent: number = PARTIAL_REFUND_PERCENT,
): number {
  const hoursUntilSlot =
    (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSlot > fullRefundHours) {
    return 1;
  }
  if (hoursUntilSlot >= partialRefundHours) {
    return partialRefundPercent;
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

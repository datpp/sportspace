# Stale PENDING Booking Expiry — Design

## Goal

The thesis report (§6.2.1.a, FAQ) and CLAUDE.md §7 both promise that a booking slot is held for **5 minutes** and auto-released if the player never completes payment. The current implementation has no such mechanism: `SLOT_LOCK_TTL_SECONDS = 10` in `booking.service.ts` is a 10-second mutex that only serializes the INSERT itself, not a hold. A `PENDING` booking that's never paid sits in the DB forever — and because the partial UNIQUE index (`uq_booking_slot`) scopes to `status IN ('PENDING','CONFIRMED')`, that slot is permanently unbookable by anyone else. This is a correctness bug, not a missing nice-to-have.

## Architecture

A scheduled sweep, not a per-booking timer (no BullMQ/delayed-job infra exists in this codebase, and a periodic sweep is simpler and sufficient at this scale):

- Add `@nestjs/schedule` (new dependency), `ScheduleModule.forRoot()` registered in `AppModule`.
- A new method on the existing `BookingService` — `expireStalePendingBookings()` — decorated `@Cron(CronExpression.EVERY_MINUTE)`, living in `BookingService` itself (not a new module) since it operates on `Booking`/`Payment` repos already injected there.
- Query: `bookingRepo.find({ where: { status: BookingStatus.PENDING, createdAt: LessThan(fiveMinutesAgo) } })`.
- For each stale booking, inside a small transaction: `UPDATE bookings SET status='CANCELLED' WHERE id=:id AND status='PENDING'` (guard clause prevents a race with a concurrent IPN confirm flipping it to `CONFIRMED` between the SELECT and the UPDATE — if the guarded UPDATE affects 0 rows, skip broadcasting for that booking, it was concurrently confirmed). If a `Payment` row exists for the booking with `status = PENDING`, flip it to `FAILED` (no refund — nothing was ever paid, mirrors `cancel()`'s existing no-op-on-PENDING behavior).
- Broadcast `RealtimeGateway.broadcastSlotUpdate({ courtId, bookingDate, startTime, status: CANCELLED })` for each successfully expired booking, matching the existing convention used everywhere else a slot is freed.
- The 5-minute threshold is a module constant (`STALE_PENDING_MINUTES = 5`), not admin-configurable — the report describes this as fixed platform behavior, not a per-merchant/admin setting (unlike the cancellation refund thresholds, which `SystemConfig` already covers). Do not extend `SystemConfig` for this.

## Testing

- Unit: `BookingService.expireStalePendingBookings()` — cancels a booking whose `createdAt` is >5 min old and still `PENDING`; leaves alone a `PENDING` booking created <5 min ago; leaves alone a booking that's `CONFIRMED` even if old; the DB-guard behavior (simulate 0-rows-affected from the guarded update, e.g. via a `DeepMocked` `bookingRepo.update` returning `affected: 0`) does not broadcast.
- e2e: create a booking via the API, directly `UPDATE bookings SET "createdAt" = now() - interval '10 minutes' WHERE id = ...` via the raw `dataSource` (test-only shortcut — don't wait 5 real minutes), then invoke the service method directly (not wait for a real cron tick) and assert the booking is now `CANCELLED` and the slot is bookable again by a different request.

## Out of scope

- No change to the Redis lock (`SLOT_LOCK_TTL_SECONDS`) — that's a correctly-scoped short-lived mutex for the INSERT race, a separate concern from the payment-hold window.
- No UI countdown/timer shown to the player (report doesn't ask for one).

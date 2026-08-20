# Stale PENDING Booking Expiry — Design

## Goal

The thesis report (§6.2.1.a, FAQ) and CLAUDE.md §7 both promise that a booking slot is held for **5 minutes** and auto-released if the player never completes payment. The current implementation has no such mechanism: `SLOT_LOCK_TTL_SECONDS = 10` in `booking.service.ts` is a 10-second mutex that only serializes the INSERT itself, not a hold. A `PENDING` booking that's never paid sits in the DB forever — and because the partial UNIQUE index (`uq_booking_slot`) scopes to `status IN ('PENDING','CONFIRMED')`, that slot is permanently unbookable by anyone else. This is a correctness bug, not a missing nice-to-have.

## Architecture

**Design update (post-brainstorm, before planning):** the codebase already ships FR-M04 (`BookingService.merchantConfirm`/`merchantReject`, `PATCH /bookings/:id/confirm`/`:id/reject`, `apps/web/src/app/merchant/bookings/page.tsx`'s "Xác nhận"/"Từ chối" buttons) — a merchant can manually confirm or reject *any* `PENDING` booking at any time, with no time limit, independent of whether the player ever attempted online payment. Nothing distinguishes "PENDING, player mid-VNPAY-checkout" from "PENDING, sitting there for the merchant to review" at the data level — both are just `status: PENDING`. A universal "cancel any PENDING booking after 5 minutes" sweep — the originally-drafted design below — would silently cancel legitimate bookings out from under a merchant who doesn't happen to open the dashboard within 5 minutes of the booking landing, breaking FR-M04 in practice.

Resolution: **the 5-minute hold only applies to a booking with an abandoned online-payment attempt**, not to every `PENDING` booking. A `Payment` row is created only when the player calls `POST /payments/{bookingId}/checkout` (`PaymentService.checkout()`, `apps/backend/src/payment/payment.service.ts:83`) — booking creation itself (`BookingService.create()`) never creates one. So:
- A `PENDING` booking with **no `Payment` row at all** → checkout was never attempted → left alone indefinitely, available for merchant review via FR-M04. This spec does not add any new time limit for that case.
- A `PENDING` booking **with a `Payment` row whose `status = PENDING`** → the player started a VNPAY session (or retried one) that was never completed and never came back via IPN → this is the abandoned-payment case the thesis's "5-minute hold" promise is actually about. `Payment.updatedAt` is the clock (`checkout()` bumps it via `@UpdateDateColumn` on every call, including retries — each retry restarts a fresh VNPAY session and should restart the 5-minute window).

A scheduled sweep, not a per-booking timer (no BullMQ/delayed-job infra exists in this codebase, and a periodic sweep is simpler and sufficient at this scale):

- Add `@nestjs/schedule` (new dependency), `ScheduleModule.forRoot()` registered in `AppModule`.
- A new method on the existing `BookingService` — `expireStalePendingBookings()` — decorated `@Cron(CronExpression.EVERY_MINUTE)`, living in `BookingService` itself (not a new module) since it operates on `Booking`/`Payment` repos already injected there.
- Query: bookings joined to a `Payment` row, where `booking.status = PENDING`, `payment.status = PENDING`, and `payment.updatedAt < fiveMinutesAgo` — e.g. `bookingRepo.createQueryBuilder('booking').innerJoin('booking.payment'... )` or an equivalent `paymentRepo`-driven query that yields the booking IDs to expire. A `PENDING` booking with no matching `Payment` row is never selected by this query.
- For each stale booking, inside a small transaction: `UPDATE bookings SET status='CANCELLED' WHERE id=:id AND status='PENDING'` (guard clause prevents a race with a concurrent IPN confirm flipping it to `CONFIRMED`, or a concurrent merchant confirm/reject, between the SELECT and the UPDATE — if the guarded UPDATE affects 0 rows, skip broadcasting for that booking, it was concurrently resolved some other way). Flip the associated `Payment` row to `FAILED` (no refund — nothing was ever paid, mirrors `cancel()`'s existing no-op-on-PENDING behavior).
- Broadcast `RealtimeGateway.broadcastSlotUpdate({ courtId, bookingDate, startTime, status: CANCELLED })` for each successfully expired booking, matching the existing convention used everywhere else a slot is freed.
- The 5-minute threshold is a module constant (`STALE_PENDING_MINUTES = 5`), not admin-configurable — the report describes this as fixed platform behavior, not a per-merchant/admin setting (unlike the cancellation refund thresholds, which `SystemConfig` already covers). Do not extend `SystemConfig` for this.

## Testing

- Unit: `BookingService.expireStalePendingBookings()` — cancels a `PENDING` booking whose `Payment` row is `PENDING` with `updatedAt` >5 min old; leaves alone a `PENDING` booking with a `Payment` row whose `updatedAt` is <5 min old; **leaves alone a `PENDING` booking with no `Payment` row at all, no matter how old** (the FR-M04 case — this is the regression test that guards the conflict this design update resolved); leaves alone a booking that's `CONFIRMED` even if its payment is old; leaves alone a booking whose `Payment` is already `PAID`/`FAILED`/`REFUNDED`; the DB-guard behavior (simulate 0-rows-affected from the guarded update, e.g. via a `DeepMocked` `bookingRepo.update` returning `affected: 0`) does not broadcast.
- e2e: create a booking via the API, call checkout to create a `Payment` row, directly `UPDATE payments SET "updatedAt" = now() - interval '10 minutes' WHERE id = ...` via the raw `dataSource` (test-only shortcut — don't wait 5 real minutes), then invoke the service method directly (not wait for a real cron tick) and assert the booking is now `CANCELLED`, its `Payment` is `FAILED`, and the slot is bookable again by a different request. A second e2e case: create a booking via the API, do **not** call checkout (no `Payment` row), invoke the service method directly, assert the booking is still `PENDING` afterward (FR-M04 case unaffected).

## Out of scope

- No change to the Redis lock (`SLOT_LOCK_TTL_SECONDS`) — that's a correctly-scoped short-lived mutex for the INSERT race, a separate concern from the payment-hold window.
- No UI countdown/timer shown to the player (report doesn't ask for one).
- No new time limit on a `PENDING` booking that never had a `Payment` row (the FR-M04 merchant-review case) — that booking can sit `PENDING` indefinitely until a merchant confirms/rejects it or the player cancels it; this spec does not change that.

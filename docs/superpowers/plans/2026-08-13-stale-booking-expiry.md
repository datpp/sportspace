# Stale PENDING Booking Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-cancel a `PENDING` booking whose player abandoned an in-progress VNPAY checkout more than 5 minutes ago, so the slot becomes bookable again — without touching a `PENDING` booking that's simply awaiting merchant review (FR-M04).

**Architecture:** A `@Cron(CronExpression.EVERY_MINUTE)` method on the existing `BookingService` (`@nestjs/schedule`, new dependency) queries `Payment` rows that are still `PENDING` with `updatedAt` older than 5 minutes, whose booking is still `PENDING`. For each, a guarded `UPDATE ... WHERE id=:id AND status='PENDING'` (inside a transaction, alongside flipping the `Payment` to `FAILED`) protects against a race with a concurrent IPN confirm or merchant confirm/reject; a 0-affected-rows result means someone else resolved it first, so skip broadcasting. Successfully expired bookings get `RealtimeGateway.broadcastSlotUpdate(...)`, same as every other place a slot is freed.

**Platform investigation (done before writing this plan, not assumed):** this feature needs **no web or mobile code changes**. Evidence:
- Web's `apps/web/src/app/merchant/bookings/page.tsx` already renders `booking.status` generically (`Trạng thái: {booking.status}`) and gates action buttons off `status === PENDING`/`!== CANCELLED` — a newly-`CANCELLED` booking just stops showing the confirm/reject buttons on the next page load. No new UI state.
- Mobile's `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx` already has a `STATUS_LABEL` map covering `PENDING`/`CONFIRMED`/`CANCELLED`, refetches on every screen focus (`useFocusEffect`), and already conditionally renders a refund line only `status === CANCELLED && item.payment` (a booking cancelled here has `payment.status = FAILED`, `refundAmount` unset, so it correctly falls through to "Không được hoàn tiền" with zero new code).
- Mobile's `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx` already subscribes to `court:slotUpdate` via `useCourtSlotUpdates` and re-renders slot availability from whatever `status` arrives — the sweep's `broadcastSlotUpdate({..., status: CANCELLED})` call is indistinguishable from any other cancellation event this hook already handles.
- No mobile screen assumes a `PENDING` booking is time-bounded (checked `BookingConfirmScreen.tsx` and `pollBookingStatus.ts` — the latter's ~7.5s poll window is for the immediate post-VNPAY-redirect confirmation, unrelated to and unaffected by this 5-minute server-side sweep).

## Global Constraints

- TypeScript strict; follow existing file/module conventions exactly, do not restructure unrelated code.
- No hand-written mocks: unit tests use `createMock<T>()`/`DeepMocked<T>` from `@golevelup/ts-jest`, fixtures use `@faker-js/faker`, matching every other `*.service.spec.ts` in `apps/backend/src/booking/`.
- TDD: write the failing test before the implementation.
- **The 5-minute hold applies only to a `PENDING` booking with a `PENDING` `Payment` row** (an abandoned/never-completed VNPAY checkout). A `PENDING` booking with **no** `Payment` row at all (never checked out — the FR-M04 merchant-review case) must never be touched by this sweep, at any age. This is the load-bearing constraint of this plan — every task's tests must include a case proving it.
- `STALE_PENDING_MINUTES = 5` is a module constant, not admin-configurable (do not extend `SystemConfig`).
- No change to `SLOT_LOCK_TTL_SECONDS` / the Redis lock — unrelated concern.
- No UI countdown/timer on any platform.
- Vietnamese-only git commit messages; zero AI/Claude/Co-Authored-By mentions in any commit.

---

## File Structure

- Modify `apps/backend/package.json` — add `@nestjs/schedule`.
- Modify `apps/backend/src/app.module.ts` — register `ScheduleModule.forRoot()`.
- Modify `apps/backend/src/booking/booking.service.ts` — add `expireStalePendingBookings()`.
- Modify `apps/backend/src/booking/booking.service.spec.ts` — unit tests.
- Modify `apps/backend/test/booking.e2e-spec.ts` — e2e tests.

No new files, no migration, no `packages/shared`/client regen (no API/DTO surface changes — this is a background job with no new endpoint).

---

### Task 1: `BookingService.expireStalePendingBookings()` + unit tests

**Files:**
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Test: `apps/backend/src/booking/booking.service.spec.ts`

**Interfaces:**
- Consumes: existing `bookingRepo: Repository<Booking>`, `paymentRepo: Repository<Payment>`, `dataSource: DataSource`, `realtimeGateway: RealtimeGateway` — all already injected into `BookingService`'s constructor, no new dependencies to wire.
- Produces: `BookingService.expireStalePendingBookings(): Promise<void>`, `@Cron`-decorated, invoked automatically every minute by Nest's scheduler once `ScheduleModule.forRoot()` is registered. Also directly callable (e.g. from a test or manually) since `@Cron` doesn't change the method's normal callability.

- [ ] **Step 1: Add the dependency**

Run: `cd apps/backend && pnpm add @nestjs/schedule`
Expected: added to `package.json`/`pnpm-lock.yaml`.

- [ ] **Step 2: Register `ScheduleModule`**

```typescript
// apps/backend/src/app.module.ts
import { ScheduleModule } from '@nestjs/schedule';
// ... alongside the other imports, add:

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      // ... unchanged
```

(Insert `ScheduleModule.forRoot()` right after `ConfigModule.forRoot(...)`, before `TypeOrmModule.forRootAsync(...)` — order doesn't matter functionally, just keep it near the top with the other global infra modules rather than buried among feature modules.)

- [ ] **Step 3: Write the failing unit tests**

Add to `apps/backend/src/booking/booking.service.spec.ts`, as a new top-level `describe('expireStalePendingBookings', ...)` sibling of the existing `describe('create', ...)`/`describe('cancel', ...)` blocks. Uses the file's existing `buildBookingRow`/`buildPaymentRow` helpers and `beforeEach`-created mocks (`paymentRepo`, `dataSource`, `realtimeGateway`).

```typescript
describe('expireStalePendingBookings', () => {
  function mockTransaction(updateResults: { affected: number }[]): DeepMocked<EntityManager> {
    let call = 0;
    const transactionManager = createMock<EntityManager>();
    transactionManager.update.mockImplementation(() =>
      Promise.resolve(updateResults[call++] as UpdateResult),
    );
    dataSource.transaction.mockImplementation(
      ((work: (manager: EntityManager) => Promise<void>) =>
        work(transactionManager)) as typeof dataSource.transaction,
    );
    return transactionManager;
  }

  it('cancels a PENDING booking whose PENDING payment has not been touched in over 5 minutes', async () => {
    const court = buildCourt();
    const booking = buildBookingRow({
      status: BookingStatus.PENDING,
      court,
      bookingDate: '2026-09-01',
      startTime: '10:00',
    });
    const staleUpdatedAt = new Date(Date.now() - 6 * 60 * 1000);
    const payment = buildPaymentRow({
      status: PaymentStatus.PENDING,
      booking,
      updatedAt: staleUpdatedAt,
    });
    paymentRepo.find.mockResolvedValue([payment]);
    mockTransaction([{ affected: 1 }, { affected: 1 }]);

    await service.expireStalePendingBookings();

    expect(paymentRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PaymentStatus.PENDING,
          booking: { status: BookingStatus.PENDING },
        }),
      }),
    );
    expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
      courtId: court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CANCELLED,
    });
  });

  it('leaves alone a PENDING booking whose PENDING payment was touched less than 5 minutes ago', async () => {
    paymentRepo.find.mockResolvedValue([]);

    await service.expireStalePendingBookings();

    expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
  });

  it('never selects a PENDING booking with no Payment row at all (FR-M04 merchant-review case)', async () => {
    // The query itself excludes these (inner-joined to Payment) — this test
    // locks in that the query the implementation issues cannot match a
    // paymentless booking, by asserting the where clause paymentRepo.find
    // was called with is scoped to payment.status, never booking alone.
    paymentRepo.find.mockResolvedValue([]);

    await service.expireStalePendingBookings();

    const callArg = paymentRepo.find.mock.calls[0][0] as {
      where: { status: PaymentStatus };
    };
    expect(callArg.where.status).toBe(PaymentStatus.PENDING);
    expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
  });

  it('flips the Payment to FAILED alongside cancelling the booking', async () => {
    const court = buildCourt();
    const booking = buildBookingRow({ status: BookingStatus.PENDING, court });
    const payment = buildPaymentRow({
      status: PaymentStatus.PENDING,
      booking,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    paymentRepo.find.mockResolvedValue([payment]);
    const transactionManager = mockTransaction([{ affected: 1 }, { affected: 1 }]);

    await service.expireStalePendingBookings();

    expect(transactionManager.update).toHaveBeenCalledWith(
      Payment,
      { id: payment.id },
      { status: PaymentStatus.FAILED },
    );
  });

  it('does not broadcast when the guarded booking update affects 0 rows (concurrently resolved)', async () => {
    const court = buildCourt();
    const booking = buildBookingRow({ status: BookingStatus.PENDING, court });
    const payment = buildPaymentRow({
      status: PaymentStatus.PENDING,
      booking,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    paymentRepo.find.mockResolvedValue([payment]);
    mockTransaction([{ affected: 0 }]);

    await service.expireStalePendingBookings();

    expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
  });
});
```

(`buildCourt` is the file's existing court fixture helper — check its exact name/signature at the top of the spec file before using; adapt if it differs slightly, e.g. `buildCourtRow`. `UpdateResult` needs importing from `typeorm` in the spec file if not already imported.)

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts -t "expireStalePendingBookings"`
Expected: FAIL — `expireStalePendingBookings` doesn't exist yet.

- [ ] **Step 5: Implement `expireStalePendingBookings()`**

```typescript
// apps/backend/src/booking/booking.service.ts
// Add to the typeorm import line: LessThan
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
// Add:
import { Cron, CronExpression } from '@nestjs/schedule';

// Add near the other module constants:
const STALE_PENDING_MINUTES = 5;

// Add as a new public method on BookingService (anywhere alongside the
// other lifecycle methods, e.g. after merchantReject):

  /**
   * A PENDING booking with no Payment row at all is a booking left for
   * merchant review (FR-M04) — never selected here, at any age. Only a
   * PENDING booking whose Payment is itself still PENDING (an abandoned
   * VNPAY checkout) is a candidate; Payment.updatedAt is the clock so a
   * retried checkout restarts the 5-minute window.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStalePendingBookings(): Promise<void> {
    const threshold = new Date(Date.now() - STALE_PENDING_MINUTES * 60 * 1000);
    const stalePayments = await this.paymentRepo.find({
      where: {
        status: PaymentStatus.PENDING,
        updatedAt: LessThan(threshold),
        booking: { status: BookingStatus.PENDING },
      },
      relations: { booking: { court: true } },
    });

    for (const payment of stalePayments) {
      const booking = payment.booking;
      let expired = false;

      await this.dataSource.transaction(async (manager) => {
        const updateResult = await manager.update(
          Booking,
          { id: booking.id, status: BookingStatus.PENDING },
          { status: BookingStatus.CANCELLED },
        );
        if (updateResult.affected === 0) {
          return;
        }
        await manager.update(Payment, { id: payment.id }, { status: PaymentStatus.FAILED });
        expired = true;
      });

      if (expired) {
        this.realtimeGateway.broadcastSlotUpdate({
          courtId: booking.court.id,
          bookingDate: booking.bookingDate,
          startTime: booking.startTime,
          status: BookingStatus.CANCELLED,
        });
      }
    }
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts`
Expected: PASS (all `BookingService` tests, including the 5 new ones).

- [ ] **Step 7: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero tsc errors.

- [ ] **Step 8: Commit**

```bash
cd apps/backend && git add package.json ../../pnpm-lock.yaml src/app.module.ts src/booking/booking.service.ts src/booking/booking.service.spec.ts
git commit -m "feat(backend): tự động hủy booking PENDING bị bỏ dở thanh toán sau 5 phút"
```

---

### Task 2: e2e tests

**Files:**
- Modify: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Consumes: `BookingService.expireStalePendingBookings()` from Task 1, resolved from the Nest testing `app` instance (e.g. `app.get(BookingService)`).
- Produces: e2e proof that the sweep works against a real Postgres DB and that the FR-M04 case is genuinely unaffected.

- [ ] **Step 1: Write the failing e2e tests**

Add near the other booking-lifecycle e2e cases in `apps/backend/test/booking.e2e-spec.ts`. Read the file's existing `beforeAll`/`afterEach` setup first (venue/court/player fixtures, `dataSource`, `app` variables already in scope) and reuse them — do not create new top-level fixtures.

```typescript
describe('Stale PENDING booking expiry', () => {
  it('cancels a booking whose checkout was abandoned over 5 minutes ago, freeing the slot', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-20',
        startTime: '08:00',
        endTime: '09:00',
      })
      .expect(201);
    const bookingId = createRes.body.id as string;
    createdBookingIds.push(bookingId);

    await request(app.getHttpServer())
      .post(`/payments/${bookingId}/checkout`)
      .set('Authorization', `Bearer ${playerToken}`)
      .send({})
      .expect(201);

    await dataSource.query(
      `UPDATE payments SET "updatedAt" = now() - interval '10 minutes' WHERE booking_id = $1`,
      [bookingId],
    );

    const bookingService = app.get(BookingService);
    await bookingService.expireStalePendingBookings();

    const cancelled = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const payment = await dataSource
      .getRepository(Payment)
      .findOne({ where: { booking: { id: bookingId } } });
    expect(payment?.status).toBe('FAILED');

    const retryRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-20',
        startTime: '08:00',
        endTime: '09:00',
      })
      .expect(201);
    createdBookingIds.push(retryRes.body.id as string);
  });

  it('leaves a PENDING booking with no Payment row untouched, no matter how old (FR-M04 case)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-21',
        startTime: '08:00',
        endTime: '09:00',
      })
      .expect(201);
    const bookingId = createRes.body.id as string;
    createdBookingIds.push(bookingId);

    await dataSource.query(
      `UPDATE bookings SET "createdAt" = now() - interval '1 day' WHERE id = $1`,
      [bookingId],
    );

    const bookingService = app.get(BookingService);
    await bookingService.expireStalePendingBookings();

    const stillPending = await request(app.getHttpServer())
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(200);
    expect(stillPending.body.status).toBe('PENDING');
  });
});
```

(Adapt `playerToken`/`court`/`createdBookingIds`/`dataSource`/`app` to whatever this file's real existing variable names are — read the file first. `Payment` and `BookingService` need importing at the top of the spec file if not already imported. The `POST /payments/:id/checkout` body shape — check `CheckoutDto` for any required fields beyond the optional `returnUrl` seen in `payment.service.ts`; `{}` should be valid since `returnUrl` is optional there, confirm against the real DTO.)

- [ ] **Step 2: Run tests to verify they fail, then pass**

Run: `cd apps/backend && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: FAIL first — most likely on missing `Payment`/`BookingService` imports at the top of the spec file, or a wrong fixture variable name assumed above (`playerToken`/`court`/`createdBookingIds` — confirm the real names before writing). Fix those, then PASS.

- [ ] **Step 3: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors. This closes out the plan.

- [ ] **Step 4: Commit**

```bash
cd apps/backend && git add test/booking.e2e-spec.ts
git commit -m "test(backend): thêm e2e cho luồng tự động hủy booking PENDING quá hạn"
```

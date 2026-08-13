# Cancel/Refund Tiered Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `POST /bookings/:id/cancel` apply the thesis-report refund policy (>24h = 100% hoàn, 2–24h = 50% hoàn, <2h = 0% hoàn) to the booking's `Payment` row instead of only flipping the booking to `CANCELLED`.

**Architecture:** A new pure function `calculateRefundPercentage(now, slotStart)` in `apps/backend/src/booking/refund-policy.util.ts` encodes the three tiers and is unit-tested in isolation. `BookingService.cancel()` gains a `Payment` repository dependency (mirroring how `PaymentService` already depends directly on the `Booking` repo — no circular module import), looks up the booking's payment, and — only when that payment is `PAID` — computes `refundAmount` and, if it is greater than zero, flips the payment to `REFUNDED`. A `PAID` payment with a `<2h` cancel keeps `payment.status = PAID` and `refundAmount = 0`, since no money moved. Bookings with no `PAID` payment (still `PENDING`, never checked out) cancel exactly as before, untouched.

**Tech Stack:** NestJS, TypeORM (Postgres), Jest + `@golevelup/ts-jest` (`createMock<T>`), `@faker-js/faker`, Supertest.

## Global Constraints

- CLAUDE.md §0.2: migrations are generated via `pnpm run migration:generate <path>` from the entity, never hand-written.
- CLAUDE.md §0.3: unit-test mocks use `createMock<T>()` from `@golevelup/ts-jest`; no hand-rolled mock objects; e2e tests hit the real Postgres test DB via Supertest, matching existing `apps/backend/test/*.e2e-spec.ts` style.
- CLAUDE.md §7: refund tiers are exactly >24h = 100%, 2–24h = 50%, <2h = 0% (inclusive at the 24h and 2h boundaries → 50%, per this plan's interpretation, since the report's ">24h" / "<2h" wording implies the boundary hours themselves fall in the 50% band).
- No new date library: the codebase uses plain `Date`/UTC methods everywhere (see `booking.service.ts` `computeTotalAmount`, `buildTimeseriesBuckets`) — follow that, don't add `date-fns`/`dayjs`.
- `payments.amount` / any new decimal column must use `decimalTransformer` from `apps/backend/src/database/decimal.transformer.ts`, exactly like the existing `amount` column.

---

## File Structure

- Modify: `apps/backend/src/payment/entities/payment.entity.ts` — add `refundAmount` column.
- Create (via CLI): `apps/backend/src/database/migrations/<timestamp>-AddPaymentRefundAmount.ts` — schema migration for the new column.
- Create: `apps/backend/src/booking/refund-policy.util.ts` — pure refund-tier calculation, no NestJS/TypeORM dependencies.
- Create: `apps/backend/src/booking/refund-policy.util.spec.ts` — boundary-value unit tests.
- Modify: `apps/backend/src/booking/booking.module.ts` — register `Payment` on `TypeOrmModule.forFeature`.
- Modify: `apps/backend/src/booking/booking.service.ts` — inject `Payment` repo, rewrite `cancel()`.
- Modify: `apps/backend/src/booking/booking.service.spec.ts` — update the `BookingService` constructor call, add refund-tier unit tests to the `cancel` describe block.
- Modify: `apps/backend/test/payment.e2e-spec.ts` — add a `describe('cancel refund policy')` block using the existing `checkoutAndGetTxnRef` / `signedIpnQuery` helpers already defined in that file.
- Modify: `apps/backend/src/booking/entities/booking.entity.ts` — add an optional `payment?: BookingPaymentSummary` field + the `BookingPaymentSummary` class (Task 6).
- Modify: `apps/backend/src/booking/booking.service.ts` — `findAll()` batch-attaches payment summaries, `cancel()` attaches the one it already fetched (Task 6).
- Modify: `apps/backend/src/booking/booking.service.spec.ts` — cover `payment` on `findAll`/`cancel` responses (Task 6).
- Modify: `apps/backend/test/booking.e2e-spec.ts` — e2e assertion that a cancelled, paid booking's response carries `payment.refundAmount` (Task 6).
- Modify: `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx` — surface the refund amount after a successful cancel (Task 7).
- Modify: `apps/mobile/src/screens/bookings/__tests__/MyBookingsScreen.test.tsx` — cover the new refund-amount display (Task 7).

---

### Task 1: Add `refundAmount` to the `Payment` entity + generate migration

**Files:**
- Modify: `apps/backend/src/payment/entities/payment.entity.ts`
- Create: `apps/backend/src/database/migrations/<timestamp>-AddPaymentRefundAmount.ts` (CLI-generated, filename/timestamp assigned by TypeORM at generation time)

**Interfaces:**
- Produces: `Payment.refundAmount: number | null` — consumed by Task 3's `booking.service.ts` and Task 4's e2e assertions.

- [x] **Step 1: Add the column to the entity**

Edit `apps/backend/src/payment/entities/payment.entity.ts`, adding the field right after `status`:

```typescript
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  refundAmount: number | null;

  @Column({ nullable: true })
  transactionRef: string;
```

- [x] **Step 2: Make sure the local Postgres the migration generator introspects against is running**

Run: `docker compose up -d postgres redis` (from repo root, wherever `docker-compose.yml` already lives for this project) and confirm it's healthy with `docker compose ps`.

- [x] **Step 3: Run any pending migrations first, so the generator diffs against current schema**

Run (from `apps/backend/`): `pnpm run migration:run`
Expected: no new migrations besides the ones already in `src/database/migrations/` are applied (the two existing ones — `InitialSchema` and `AddUserFcmToken` — should already be applied in a dev DB that's been used before; this step is a no-op if so).

- [x] **Step 4: Generate the migration from the entity change**

Run (from `apps/backend/`): `pnpm run migration:generate src/database/migrations/AddPaymentRefundAmount`

Expected: a new file `src/database/migrations/<timestamp>-AddPaymentRefundAmount.ts` is created. Open it and confirm the `up()` body contains exactly one `ALTER TABLE "payments" ADD "refundAmount" numeric(12,2)` statement (TypeORM emits `nullable` columns without a `NOT NULL` clause) and the `down()` body contains the matching `ALTER TABLE "payments" DROP COLUMN "refundAmount"`. If the generator also picked up unrelated diffs (it shouldn't, since no other entity changed), stop and investigate before continuing — do not hand-edit around a spurious diff.

- [x] **Step 5: Apply the migration**

Run (from `apps/backend/`): `pnpm run migration:run`
Expected: output shows the new migration applied successfully, no errors.

- [x] **Step 6: Commit**

```bash
git add apps/backend/src/payment/entities/payment.entity.ts apps/backend/src/database/migrations/
git commit -m "feat(backend): add refundAmount column to payments"
```

---

### Task 2: Pure refund-tier calculation function + unit tests

**Files:**
- Create: `apps/backend/src/booking/refund-policy.util.ts`
- Test: `apps/backend/src/booking/refund-policy.util.spec.ts`

**Interfaces:**
- Produces: `calculateRefundPercentage(now: Date, slotStart: Date): number` (returns `1`, `0.5`, or `0`) and `combineBookingDateTime(bookingDate: string, startTime: string): Date` — both consumed by Task 3's `booking.service.ts`.

- [x] **Step 1: Write the failing tests**

Create `apps/backend/src/booking/refund-policy.util.spec.ts`:

```typescript
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
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter backend test refund-policy.util.spec.ts`
Expected: FAIL — `Cannot find module './refund-policy.util'`.

- [x] **Step 3: Implement the module**

Create `apps/backend/src/booking/refund-policy.util.ts`:

```typescript
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
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter backend test refund-policy.util.spec.ts`
Expected: PASS, all 8 tests green.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/booking/refund-policy.util.ts apps/backend/src/booking/refund-policy.util.spec.ts
git commit -m "feat(backend): add pure refund-tier calculation"
```

---

### Task 3: Wire the refund policy into `BookingService.cancel()`

**Files:**
- Modify: `apps/backend/src/booking/booking.module.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Modify: `apps/backend/src/booking/booking.service.spec.ts`

**Interfaces:**
- Consumes: `calculateRefundPercentage(now, slotStart)`, `combineBookingDateTime(bookingDate, startTime)` from Task 2; `Payment` entity + `Payment.refundAmount` from Task 1; `PaymentStatus` from `@sportspace/shared` (already imported elsewhere in the payment module — verify it's exported from the package root the same way `BookingStatus` is).
- Produces: `BookingService.cancel(id, user)` behavior consumed by Task 4's e2e tests — unchanged return type (`Promise<Booking>`), unchanged HTTP route/signature.

- [x] **Step 1: Register `Payment` on the booking module**

Edit `apps/backend/src/booking/booking.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MerchantController } from './merchant.controller';
import { Booking } from './entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { VenueModule } from '../venue/venue.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Payment]),
    VenueModule,
    RealtimeModule,
  ],
  controllers: [BookingController, MerchantController],
  providers: [BookingService],
})
export class BookingModule {}
```

This mirrors the existing precedent in `payment.module.ts`, which already imports the `Booking` entity directly via `TypeOrmModule.forFeature` instead of importing `BookingModule` — same pattern, opposite direction, no circular module dependency.

- [x] **Step 2: Write the failing unit tests first**

Edit `apps/backend/src/booking/booking.service.spec.ts`. First, extend the imports and add a `Payment`/`PaymentStatus` fixture builder and a `paymentRepo` mock:

```typescript
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus, Role } from '@sportspace/shared';
import {
  DataSource,
  EntityManager,
  QueryRunner,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { BookingService } from './booking.service';
import { Booking } from './entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Court } from '../venue/entities/court.entity';
import { User } from '../user/entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateBookingDto } from './dto/create-booking.dto';
```

Add a `buildPaymentRow` factory next to the other `build*` helpers (near `buildAuthUser`):

```typescript
function buildPaymentRow(overrides: Partial<Payment> = {}): Payment {
  return {
    id: faker.string.uuid(),
    booking: { id: faker.string.uuid() } as Booking,
    provider: 'VNPAY',
    amount: 200000,
    status: PaymentStatus.PAID,
    refundAmount: null,
    transactionRef: faker.string.alphanumeric(16),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

Add `paymentRepo` to the `describe('BookingService', ...)` block's `let` declarations, construct it in `beforeEach`, and pass it into the service constructor:

```typescript
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let paymentRepo: DeepMocked<Repository<Payment>>;
  let dataSource: DeepMocked<DataSource>;
```

```typescript
  beforeEach(() => {
    bookingRepo = createMock<Repository<Booking>>();
    paymentRepo = createMock<Repository<Payment>>();
    dataSource = createMock<DataSource>();
    redisService = createMock<RedisService>();
    realtimeGateway = createMock<RealtimeGateway>();
    queryRunner = createMock<QueryRunner>();
    manager = createMock<EntityManager>();
    queryBuilder = createMock<SelectQueryBuilder<Booking>>();

    queryBuilder.setLock.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.getOne.mockResolvedValue(null);

    manager.createQueryBuilder.mockReturnValue(queryBuilder);
    manager.create.mockImplementation(
      ((_entity: unknown, data: unknown) => data) as typeof manager.create,
    );
    manager.save.mockImplementation((_entity, data) =>
      Promise.resolve(data as Booking),
    );

    (queryRunner as unknown as { manager: EntityManager }).manager = manager;
    dataSource.createQueryRunner.mockReturnValue(queryRunner);
    redisService.acquireLock.mockResolvedValue(LOCK_TOKEN);
    paymentRepo.findOne.mockResolvedValue(null);
    paymentRepo.save.mockImplementation((p) => Promise.resolve(p as Payment));

    service = new BookingService(
      bookingRepo,
      paymentRepo,
      dataSource,
      redisService,
      realtimeGateway,
    );
  });
```

Now add refund-tier cases inside `describe('cancel', ...)`, right after the existing `'sets status to CANCELLED, saves, and broadcasts the freed slot'` test:

```typescript
    it('leaves the payment untouched when the booking was never paid (still PENDING)', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.PENDING,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('refunds 100% and marks the payment REFUNDED when cancelling >24h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:00`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 200000,
        }),
      );
    });

    it('refunds 50% and marks the payment REFUNDED when cancelling 2-24h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 10 * 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:00`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          refundAmount: 100000,
        }),
      );
    });

    it('keeps the payment PAID with refundAmount 0 when cancelling <2h before the slot', async () => {
      const owner = buildUser();
      const slotStart = new Date(Date.now() + 60 * 60 * 1000);
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CONFIRMED,
        bookingDate: slotStart.toISOString().slice(0, 10),
        startTime: `${String(slotStart.getUTCHours()).padStart(2, '0')}:${String(slotStart.getUTCMinutes()).padStart(2, '0')}`,
        totalAmount: 200000,
      });
      const payment = buildPaymentRow({
        booking: { id: booking.id } as Booking,
        amount: 200000,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.PAID,
          refundAmount: 0,
        }),
      );
    });

    it('is a no-op the second time an already-CANCELLED booking is cancelled', async () => {
      const owner = buildUser();
      const booking = buildBookingRow({
        user: owner,
        status: BookingStatus.CANCELLED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(bookingRepo.save).not.toHaveBeenCalled();
      expect(paymentRepo.findOne).not.toHaveBeenCalled();
      expect(realtimeGateway.broadcastSlotUpdate).not.toHaveBeenCalled();
    });
```

- [x] **Step 3: Run the tests to verify the new ones fail and nothing else broke by accident**

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: the 5 new `cancel` tests FAIL (constructor arg order mismatch / `cancel()` doesn't touch `paymentRepo` yet); all pre-existing tests should still be passing except wherever the constructor signature change breaks them until Step 4 below is applied — if the constructor edit in Step 2 was applied correctly, only the new assertions fail, not a constructor crash.

- [x] **Step 4: Implement `cancel()`**

Edit `apps/backend/src/booking/booking.service.ts`. Add the two new imports and the `PaymentStatus` import, add the `paymentRepo` constructor param, and replace `cancel()`:

```typescript
import { BookingStatus, PaymentStatus, Role } from '@sportspace/shared';
```

```typescript
import { Payment } from '../payment/entities/payment.entity';
import {
  calculateRefundPercentage,
  combineBookingDateTime,
} from './refund-policy.util';
```

```typescript
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}
```

```typescript
  /**
   * Refund policy (CLAUDE.md §7): only a PAID payment can be refunded. A
   * refundAmount of 0 (the <2h band) leaves the payment PAID — no money
   * moved, so REFUNDED would be misleading.
   */
  async cancel(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOne(id, user);
    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    const payment = await this.paymentRepo.findOne({
      where: { booking: { id: booking.id } },
    });

    if (payment && payment.status === PaymentStatus.PAID) {
      const slotStart = combineBookingDateTime(
        booking.bookingDate,
        booking.startTime,
      );
      const refundPercentage = calculateRefundPercentage(
        new Date(),
        slotStart,
      );
      const refundAmount =
        Math.round(Number(booking.totalAmount) * refundPercentage * 100) /
        100;

      payment.refundAmount = refundAmount;
      if (refundAmount > 0) {
        payment.status = PaymentStatus.REFUNDED;
      }
      await this.paymentRepo.save(payment);
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);
    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CANCELLED,
    });
    return booking;
  }
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: PASS, all tests green including the 5 new `cancel` cases.

- [x] **Step 6: Run the full backend unit test suite to check for regressions**

Run: `pnpm --filter backend test`
Expected: PASS. In particular, `payment.service.spec.ts` and `payment.controller.spec.ts` should be unaffected since `PaymentService` wasn't touched.

- [x] **Step 7: Commit**

```bash
git add apps/backend/src/booking/booking.module.ts apps/backend/src/booking/booking.service.ts apps/backend/src/booking/booking.service.spec.ts
git commit -m "feat(backend): apply tiered refund policy on booking cancel"
```

---

### Task 4: e2e coverage across the three refund bands

**Files:**
- Modify: `apps/backend/test/payment.e2e-spec.ts`

**Interfaces:**
- Consumes: `checkoutAndGetTxnRef(token, date)` and `signedIpnQuery(overrides)`, both already defined in this file's `describe('IPN webhook', ...)` block — hoist `checkoutAndGetTxnRef` one level up (out of the `IPN webhook` describe, into the top-level describe) so the new `describe('cancel refund policy', ...)` block can reuse it too, OR duplicate a small local helper if hoisting risks breaking the existing block — prefer hoisting since it's a pure function with no closure state beyond `app`/`hashSecret`, which are already top-level.

- [x] **Step 1: Hoist `checkoutAndGetTxnRef` to the top-level describe**

In `apps/backend/test/payment.e2e-spec.ts`, cut the `checkoutAndGetTxnRef` function out of `describe('IPN webhook', ...)` and paste it at the top level, directly after the existing top-level `createPendingBooking` function (leave `createPendingBooking` itself where it is; `checkoutAndGetTxnRef` already calls it and both need to be visible to the new describe block below). Leave every existing call site (`checkoutAndGetTxnRef(...)`) unchanged — hoisting doesn't change call syntax, only where the declaration lives — so this is a pure move, not a rename.

- [x] **Step 2: Write the new e2e tests**

Add this `describe` block after `describe('IPN webhook', ...)` closes, still inside the outer `describe('Payment / VNPAY (e2e)', ...)`:

```typescript
  describe('cancel refund policy', () => {
    function isoDateNHoursFromNow(hours: number): { date: string; time: string } {
      const target = new Date(Date.now() + hours * 60 * 60 * 1000);
      return {
        date: target.toISOString().slice(0, 10),
        time: `${String(target.getUTCHours()).padStart(2, '0')}:${String(
          target.getUTCMinutes(),
        ).padStart(2, '0')}`,
      };
    }

    async function createAndPayBooking(
      hoursFromNow: number,
    ): Promise<{ bookingId: string; txnRef: string }> {
      const { date, time } = isoDateNHoursFromNow(hoursFromNow);
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: date,
          startTime: time,
          endTime: `${String(Number(time.slice(0, 2)) + 1).padStart(2, '0')}:${time.slice(3)}`,
        })
        .expect(201);
      const bookingId = res.body.id as string;
      createdBookingIds.push(bookingId);

      const checkoutRes = await request(app.getHttpServer())
        .post(`/payments/${bookingId}/checkout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
      const txnRef = new URL(checkoutRes.body.paymentUrl).searchParams.get(
        'vnp_TxnRef',
      )!;

      await request(app.getHttpServer())
        .get('/payments/ipn')
        .query(
          signedIpnQuery({
            vnp_TxnRef: txnRef,
            vnp_Amount: toVnpayAmount(BASE_PRICE),
            vnp_ResponseCode: '00',
          }),
        )
        .expect(200);

      return { bookingId, txnRef };
    }

    it('refunds 100% when cancelling more than 24h before the slot', async () => {
      const { bookingId, txnRef } = await createAndPayBooking(48);

      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const payment = await dataSource
        .getRepository('payments')
        .findOne({ where: { transactionRef: txnRef } });
      expect(payment?.status).toBe(PaymentStatus.REFUNDED);
      expect(Number(payment?.refundAmount)).toBe(BASE_PRICE);
    });

    it('refunds 50% when cancelling between 2h and 24h before the slot', async () => {
      const { bookingId, txnRef } = await createAndPayBooking(10);

      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const payment = await dataSource
        .getRepository('payments')
        .findOne({ where: { transactionRef: txnRef } });
      expect(payment?.status).toBe(PaymentStatus.REFUNDED);
      expect(Number(payment?.refundAmount)).toBe(BASE_PRICE / 2);
    });

    it('keeps the payment PAID with a 0 refund when cancelling less than 2h before the slot', async () => {
      const { bookingId, txnRef } = await createAndPayBooking(1);

      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const payment = await dataSource
        .getRepository('payments')
        .findOne({ where: { transactionRef: txnRef } });
      expect(payment?.status).toBe(PaymentStatus.PAID);
      expect(Number(payment?.refundAmount)).toBe(0);
    });

    it('leaves an unpaid (PENDING) booking to cancel without creating a refund', async () => {
      const bookingId = await createPendingBooking(accessToken, '2026-09-14');

      await request(app.getHttpServer())
        .post(`/bookings/${bookingId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const bookingRes = await request(app.getHttpServer())
        .get(`/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(bookingRes.body.status).toBe('CANCELLED');
    });
  });
```

- [x] **Step 3: Run the new e2e tests**

Run: `pnpm --filter backend test:e2e payment.e2e-spec.ts`
Expected: PASS, all 4 new tests green, and every pre-existing test in the file still passes (the hoist from Step 1 must not have changed behavior).

- [x] **Step 4: Run the full e2e suite to check for regressions**

Run: `pnpm --filter backend test:e2e`
Expected: PASS. In particular `booking.e2e-spec.ts`'s `'frees the slot again after cancelling the booking'` test should still pass since that booking is never checked out (`payment` lookup returns nothing, so `cancel()` skips the refund branch exactly as before).

- [x] **Step 5: Commit**

```bash
git add apps/backend/test/payment.e2e-spec.ts
git commit -m "test(backend): e2e coverage for tiered refund policy on cancel"
```

---

### Task 5: Regenerate the Swagger spec and shared API client

**Files:**
- Modify (generated, not hand-edited): `packages/shared/src/generated/**` (whatever `orval` regenerates — model files under `packages/shared/src/generated/model/` gain `refundAmount` on the `Payment` schema)

**Interfaces:**
- Consumes: the updated `Payment` entity from Task 1 (its `@ApiProperty`-less fields still get inferred through the class-validator/swagger metadata already in place for the rest of the entity — check whether `Payment` needs `@ApiProperty()` decorators added for `refundAmount` to show up in Swagger, since, unlike `Booking`, `Payment`'s existing fields have **no** `@ApiProperty()` decorators at all (see the file read during research) — if that's still true after Task 1, `refundAmount` won't appear in the generated OpenAPI schema either, which is consistent with the rest of that entity and is NOT a regression to fix here (out of scope for this plan; `Payment`'s DTOs never having `@ApiProperty` is a pre-existing gap unrelated to the refund policy).

- [x] **Step 1: Regenerate the OpenAPI spec**

Run (from `apps/backend/`): `pnpm run swagger:export`
Expected: `openapi.json` at the repo root is rewritten (or wherever the script's configured output path is — confirm via `apps/backend/src/swagger/generate-swagger.ts` if the path isn't obvious from the command output).

- [x] **Step 2: Regenerate the shared client**

Run (from repo root): `pnpm run generate:api`
Expected: `packages/shared/src/generated/**` is rewritten; `git diff --stat packages/shared/src/generated` shows only the expected additions if `Payment` does gain `@ApiProperty` coverage, or shows no diff if it doesn't (per Step 1's note above — both are acceptable outcomes here).

- [x] **Step 3: Confirm nothing else in the workspace fails to typecheck against the regenerated client**

Run (from repo root): `pnpm -r typecheck` (or whatever the workspace's actual typecheck script is named — check root `package.json` / each app's `package.json` `scripts` block if `typecheck` isn't present under that exact name).
Expected: PASS across `apps/backend`, `apps/web`, `apps/mobile`.

- [x] **Step 4: Commit**

```bash
git add openapi.json packages/shared/src/generated
git commit -m "chore: regenerate OpenAPI spec + shared client for payments.refundAmount"
```

---

### Task 6: Expose `payment` (status + refundAmount) on Booking API responses

**Why:** Tasks 1-5 make the backend compute and persist the refund, but neither `GET /bookings` nor `POST /bookings/:id/cancel` returns anything about the booking's payment — `Booking` has no `payment` field at all today (`findAll`/`findOne`/`cancel` load only `{ court: true, user: true }`). Without this, Task 7's mobile screen has no field to read. Scope is deliberately minimal: a same-shape summary (`status`, `refundAmount`), not the full `Payment` entity, and only on the two endpoints Task 7 actually calls (`findAll`, `cancel`) — not `findOne`, which nothing in this plan uses.

**Files:**
- Modify: `apps/backend/src/booking/entities/booking.entity.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Modify: `apps/backend/src/booking/booking.service.spec.ts`
- Modify: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Produces: `Booking.payment?: BookingPaymentSummary` where `BookingPaymentSummary = { status: PaymentStatus; refundAmount: number | null }` — consumed by Task 7's `MyBookingsScreen.tsx` as `item.payment?.refundAmount` / `item.payment?.status`.
- `BookingPaymentSummary` is a plain class (no TypeORM decorators, not persisted) so it doesn't need a migration and doesn't create a circular import with `payment.entity.ts` (which already imports `Booking`).

- [x] **Step 1: Add `BookingPaymentSummary` + the `payment` field to the entity**

Edit `apps/backend/src/booking/entities/booking.entity.ts`. Change the `@sportspace/shared` import to include `PaymentStatus`:

```typescript
import { BookingStatus, PaymentStatus } from '@sportspace/shared';
```

Add this class above `Booking` (after the imports, before the `@Index` decorator):

```typescript
export class BookingPaymentSummary {
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ nullable: true })
  refundAmount: number | null;
}
```

Add the field to `Booking`, right after `totalAmount` and before `createdAt`:

```typescript
  @ApiProperty({ type: () => BookingPaymentSummary, required: false })
  payment?: BookingPaymentSummary;
```

This field has no `@Column`/`@ManyToOne` — TypeORM ignores undecorated properties when hydrating query results, so it stays `undefined` unless the service assigns it explicitly (Step 3), and no migration is needed.

- [x] **Step 2: Write the failing unit tests**

Edit `apps/backend/src/booking/booking.service.spec.ts`. Add two cases:

In the `describe('findAll', ...)` block (or create one if it doesn't exist yet — check the file first): a test that seeds `paymentRepo.find` (via `createMock`) to return one `Payment` row for one of two returned bookings, and asserts the matching booking in the result has `payment: { status, refundAmount }` while the other booking's `payment` is `undefined`.

In `describe('cancel', ...)`, extend the existing "refunds 100%..." test (added in Task 3) with an additional assertion on the returned booking:

```typescript
      const result = await service.cancel(booking.id, buildAuthUser({ id: owner.id }));

      expect(result.payment).toEqual({
        status: PaymentStatus.REFUNDED,
        refundAmount: 200000,
      });
```

(Apply the equivalent assertion — same shape, values matching that test's own refund tier — to the 50% and <2h/0% cancel tests from Task 3 too, and confirm the "never paid (PENDING)" cancel test asserts `result.payment` is `undefined`.)

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: FAIL — `payment` is `undefined`/missing on the asserted results.

- [x] **Step 3: Implement**

Edit `apps/backend/src/booking/booking.service.ts`. Add `In` to the `typeorm` import:

```typescript
import {
  DataSource,
  EntityManager,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
```

Replace `findAll`:

```typescript
  async findAll(user: AuthenticatedUser): Promise<Booking[]> {
    const where = user.role === Role.ADMIN ? {} : { user: { id: user.id } };
    const bookings = await this.bookingRepo.find({
      where,
      relations: { court: true, user: true },
    });
    await this.attachPaymentSummaries(bookings);
    return bookings;
  }
```

Add this private method (near `assertOwnerOrAdmin`):

```typescript
  private async attachPaymentSummaries(bookings: Booking[]): Promise<void> {
    if (bookings.length === 0) {
      return;
    }
    const payments = await this.paymentRepo.find({
      where: { booking: { id: In(bookings.map((b) => b.id)) } },
    });
    const byBookingId = new Map(payments.map((p) => [p.booking.id, p]));
    for (const booking of bookings) {
      const payment = byBookingId.get(booking.id);
      if (payment) {
        booking.payment = {
          status: payment.status,
          refundAmount: payment.refundAmount,
        };
      }
    }
  }
```

In `cancel()` (as rewritten by Task 3), right before `return booking;`, add:

```typescript
    if (payment) {
      booking.payment = {
        status: payment.status,
        refundAmount: payment.refundAmount,
      };
    }

    return booking;
```

This reuses the `payment` already fetched earlier in the same method (Task 3) — no extra query.

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: PASS, all tests green including the new `payment` assertions.

- [x] **Step 5: e2e coverage**

Edit `apps/backend/test/booking.e2e-spec.ts`. Add a test (reusing this file's existing booking/checkout/IPN helpers, following the same pattern Task 4 used in `payment.e2e-spec.ts`) that: creates a booking, checks it out, pays it via a signed IPN callback, cancels it more than 24h before the slot, and asserts the JSON response from `POST /bookings/:id/cancel` itself (not a separate DB query) has `body.payment.status === 'REFUNDED'` and `Number(body.payment.refundAmount) === <the paid amount>`. Also assert a `GET /bookings` call afterward includes that same `payment` object for the cancelled booking (proves `findAll` attaches it too, not just `cancel`).

Run: `pnpm --filter backend test:e2e booking.e2e-spec.ts`
Expected: PASS.

- [x] **Step 6: Full regression check**

Run: `pnpm --filter backend test && pnpm --filter backend test:e2e`
Expected: PASS, no regressions.

- [x] **Step 7: Commit**

```bash
git add apps/backend/src/booking/entities/booking.entity.ts apps/backend/src/booking/booking.service.ts apps/backend/src/booking/booking.service.spec.ts apps/backend/test/booking.e2e-spec.ts
git commit -m "feat(backend): expose payment status/refundAmount on booking responses"
```

---

### Task 7: Mobile — show the refund amount after cancelling

**Files:**
- Modify: `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx`
- Modify: `apps/mobile/src/screens/bookings/__tests__/MyBookingsScreen.test.tsx`

**Interfaces:**
- Consumes: `Booking.payment?: { status: PaymentStatus; refundAmount: number | null }` from Task 6, available on the shared `Booking` type once Task 5 (lead-owned, `packages/shared` regen) has run **after** Task 6 lands — this task cannot start until both Task 5 and Task 6 are done and `@sportspace/shared` is regenerated a second time to pick up Task 6's new field (Task 5's steps apply unchanged, just re-run once more; do not hand-edit the generated types).

- [x] **Step 1: Write/extend the failing test**

In `apps/mobile/src/screens/bookings/__tests__/MyBookingsScreen.test.tsx`, find the existing cancel-flow test(s) (the ones that mock `bookingsApi.bookingControllerCancel`). Add a case where the mocked response's booking has `payment: { status: 'REFUNDED', refundAmount: 100000 }`, and assert the rendered card shows a refund line (e.g. `getByText(/Hoàn.*100.000/)` — match whatever exact Vietnamese copy Step 2 below settles on, adjust the regex/testID to it). Add a second case where `status === 'CANCELLED'` but `payment` is `undefined` (never paid) and assert no refund line renders.

Run: `pnpm --filter mobile test MyBookingsScreen`
Expected: FAIL — no such text/testID rendered yet.

- [x] **Step 2: Implement**

In `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx`, inside the `renderItem` card, right after the existing `cardStatus`/`cardPrice` `<Text>` elements, add a conditional line shown only when the booking is cancelled and has a payment summary:

```tsx
            {item.status === BookingStatus.CANCELLED && item.payment ? (
              <Text testID={`booking-refund-${item.id}`} style={styles.cardRefund}>
                {item.payment.refundAmount && item.payment.refundAmount > 0
                  ? `Đã hoàn ${item.payment.refundAmount.toLocaleString('vi-VN')} đ`
                  : 'Không được hoàn tiền'}
              </Text>
            ) : null}
```

Add the matching style next to `cardPrice` in the `StyleSheet.create` block:

```typescript
  cardRefund: { color: '#16a34a', fontWeight: '600' },
```

- [x] **Step 3: Run the tests to verify they pass**

Run: `pnpm --filter mobile test MyBookingsScreen`
Expected: PASS, all cases green, including pre-existing tests (unaffected — the new block only renders for `CANCELLED` bookings that carry a `payment`).

- [x] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/bookings/MyBookingsScreen.tsx apps/mobile/src/screens/bookings/__tests__/MyBookingsScreen.test.tsx
git commit -m "feat(mobile): show refund amount on a cancelled booking"
```

---

## Self-Review

**Spec coverage:** FR-P07 (tiered refund: >24h=100%, 2-24h=50%, <2h=0%) is covered end-to-end: pure calc (Task 2) → service integration (Task 3) → e2e proof across all three bands plus the untouched-PENDING and already-cancelled-idempotent edge cases (Tasks 3-4) → generated client kept in sync (Task 5, CLAUDE.md §10) → the computed refund is actually visible to the player who triggered it (Task 6 exposes it on the API, Task 7 renders it in `MyBookingsScreen`, the only existing cancel UI in the app — confirmed by codebase search, no web booking/payment screen exists yet to extend). No other report requirement is in scope for this plan — see the parent gap-analysis for the other 4 gaps, each of which will get its own plan.

**Placeholder scan:** no TBD/TODO, no "add error handling", no "similar to Task N" — every step has literal code. Task 1's migration filename timestamp is the sole unavoidable unknown (CLI-assigned), and the step gives the exact expected SQL to verify against instead of a placeholder file.

**Type consistency:** `calculateRefundPercentage(now: Date, slotStart: Date): number` and `combineBookingDateTime(bookingDate: string, startTime: string): Date` (Task 2) are called with those exact signatures in Task 3. `Payment.refundAmount: number | null` (Task 1) matches every usage in Tasks 3-4. `BookingService`'s constructor param order (`bookingRepo, paymentRepo, dataSource, redisService, realtimeGateway`) is consistent between the Task 3 test-file edit and the Task 3 service-file edit.

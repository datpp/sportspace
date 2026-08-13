# Merchant Booking Confirm/Reject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a MERCHANT manually confirm or reject a booking on their own venue (report requirement FR-M04), with a full refund fired automatically when a already-paid booking is rejected, and push notifications to the player either way.

**Architecture:** Two new state-machine methods on the existing `BookingService` (`merchantConfirm`, `merchantReject`) guarded by ownership + role checks, exposed as `PATCH /bookings/:id/confirm` and `PATCH /bookings/:id/reject` on the existing `BookingController`. Reject calls a new `PaymentService.refundFull()` method when the booking was already `CONFIRMED` (i.e. paid). `BookingModule` gains `PaymentModule` and `NotificationModule` as imports to reach both services — no import cycle, since `PaymentModule` only depends on the `Booking` entity, never on `BookingModule`. Web gets a new `/merchant/bookings` page mirroring the existing `/admin/venues` server-action pattern.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest + `@golevelup/ts-jest` (`createMock<T>`), `@faker-js/faker`, Supertest e2e, Next.js App Router server actions, orval-generated API client.

## Global Constraints

- TypeScript strict; follow existing file/module conventions exactly (see files read below) — do not restructure unrelated code.
- No hand-written mocks: unit tests use `createMock<T>()` from `@golevelup/ts-jest`, fixtures use `@faker-js/faker`.
- After any backend DTO/controller change, regenerate the shared client with `pnpm generate:api` (root `package.json` script `orval --config orval.config.ts`) before touching web code — web types must come from the regenerated `@sportspace/shared`, never hand-typed.
- Booking domain messages are Vietnamese, matching every existing exception message in `booking.service.ts` / `payment.service.ts`.
- Every new backend endpoint needs `@ApiOperation`/`@ApiOkResponse` Swagger decorators, matching existing controllers.

---

## File Structure

- Modify `apps/backend/src/payment/payment.service.ts` — add `refundFull(bookingId)`.
- Modify `apps/backend/src/payment/payment.module.ts` — export `PaymentService`.
- Modify `apps/backend/src/payment/payment.service.spec.ts` — unit tests for `refundFull`.
- Create `apps/backend/src/booking/dto/reject-booking.dto.ts` — `{ reason: string }`.
- Modify `apps/backend/src/booking/booking.service.ts` — add `merchantConfirm`, `merchantReject`, `findOneForMerchant`, `assertMerchantOwnerOrAdmin`; inject `NotificationService` + `PaymentService`.
- Modify `apps/backend/src/booking/booking.service.spec.ts` — unit tests for both new methods.
- Modify `apps/backend/src/booking/booking.module.ts` — import `NotificationModule`, `PaymentModule`.
- Modify `apps/backend/src/booking/booking.controller.ts` — add `PATCH :id/confirm`, `PATCH :id/reject`.
- Modify `apps/backend/test/booking.e2e-spec.ts` — real bcrypt password for `owner`, add `otherMerchant`/`ownerToken`/`otherMerchantToken`, e2e cases for both endpoints.
- Regenerate `packages/shared/src/generated/**` via `pnpm generate:api` (no manual edits).
- Modify `apps/web/src/lib/api-client.ts` — add `bookings: getBookings(instance)`.
- Create `apps/web/src/app/merchant/bookings/page.tsx` — list PENDING/CONFIRMED bookings for the merchant's venues with confirm/reject buttons.
- Create `apps/web/src/app/merchant/bookings/actions.ts` — server actions calling the new endpoints.
- Create `apps/web/src/app/merchant/bookings/actions.test.ts` — mirrors `apps/web/src/app/admin/venues/actions.test.ts`.
- Modify `apps/web/src/app/merchant/layout.tsx` — add nav link `{ href: '/merchant/bookings', label: 'Đơn đặt sân' }`.

---

### Task 1: `PaymentService.refundFull` — mark a paid payment REFUNDED

**Files:**
- Modify: `apps/backend/src/payment/payment.service.ts`
- Modify: `apps/backend/src/payment/payment.module.ts`
- Test: `apps/backend/src/payment/payment.service.spec.ts`

**Interfaces:**
- Produces: `PaymentService.refundFull(bookingId: string): Promise<void>` — no-op if no `PAID` payment exists for the booking; otherwise flips it to `PaymentStatus.REFUNDED`. Consumed by Task 2's `BookingService.merchantReject`.

- [x] **Step 1: Write the failing unit tests**

Add to `apps/backend/src/payment/payment.service.spec.ts`, inside the top-level `describe('PaymentService', ...)` block, as a sibling of the existing `describe('checkout', ...)` and `describe('handleIpn', ...)` blocks:

```ts
  describe('refundFull', () => {
    it('flips a PAID payment to REFUNDED', async () => {
      const payment = {
        id: faker.string.uuid(),
        provider: 'VNPAY',
        amount: 200_000,
        status: PaymentStatus.PAID,
        transactionRef: faker.string.alphanumeric(10),
      } as Payment;
      paymentRepo.findOne.mockResolvedValue(payment);

      await service.refundFull(faker.string.uuid());

      expect(paymentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.REFUNDED }),
      );
    });

    it('is a no-op when there is no PAID payment for the booking', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await service.refundFull(faker.string.uuid());

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });
  });
```

This needs `PaymentStatus` imported in the spec file — check the top of `payment.service.spec.ts` first; it already imports `PaymentStatus` from `@sportspace/shared` for the `handleIpn` tests, so no new import is needed.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter backend test payment.service.spec.ts`
Expected: FAIL — `service.refundFull is not a function`

- [x] **Step 3: Implement `refundFull`**

In `apps/backend/src/payment/payment.service.ts`, add this method to the `PaymentService` class (after `handleIpn`, before the closing `}` of the class):

```ts
  /**
   * Merchant-initiated rejection isn't the player's fault, so unlike the
   * player-cancel tiered policy this is always a full refund. No-op if the
   * booking was never paid (still PENDING) — nothing to refund.
   */
  async refundFull(bookingId: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { booking: { id: bookingId }, status: PaymentStatus.PAID },
    });
    if (!payment) {
      return;
    }
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepo.save(payment);
  }
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter backend test payment.service.spec.ts`
Expected: PASS

- [x] **Step 5: Export `PaymentService` so `BookingModule` can inject it**

In `apps/backend/src/payment/payment.module.ts`, change:

```ts
  controllers: [PaymentController],
  providers: [PaymentService],
})
```

to:

```ts
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
```

- [x] **Step 6: Commit**

```bash
git add apps/backend/src/payment/payment.service.ts apps/backend/src/payment/payment.module.ts apps/backend/src/payment/payment.service.spec.ts
git commit -m "feat(backend): add PaymentService.refundFull for merchant-initiated rejections"
```

---

### Task 2: `BookingService.merchantConfirm` / `merchantReject`

**Files:**
- Create: `apps/backend/src/booking/dto/reject-booking.dto.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Modify: `apps/backend/src/booking/booking.module.ts`
- Test: `apps/backend/src/booking/booking.service.spec.ts`

**Interfaces:**
- Consumes: `PaymentService.refundFull(bookingId: string): Promise<void>` from Task 1; `NotificationService.notify(userId: string, title: string, body: string): Promise<Notification>` (existing, `apps/backend/src/notification/notification.service.ts`); `RealtimeGateway.broadcastSlotUpdate({ courtId, bookingDate, startTime, status })` (existing).
- Produces: `BookingService.merchantConfirm(id: string, user: AuthenticatedUser): Promise<Booking>` and `BookingService.merchantReject(id: string, dto: RejectBookingDto, user: AuthenticatedUser): Promise<Booking>`. Consumed by Task 3's controller.

- [x] **Step 1: Create the reject DTO**

Create `apps/backend/src/booking/dto/reject-booking.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectBookingDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason: string;
}
```

- [x] **Step 2: Write the failing unit tests**

In `apps/backend/src/booking/booking.service.spec.ts`, add two imports at the top alongside the existing ones:

```ts
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
```

In the `beforeEach` block (currently ending with `service = new BookingService(bookingRepo, dataSource, redisService, realtimeGateway);` around line 112), add the two new mocks and pass them into the constructor:

```ts
  let notificationService: DeepMocked<NotificationService>;
  let paymentService: DeepMocked<PaymentService>;
```

(declare these alongside the other `let ...: DeepMocked<...>` declarations), then in `beforeEach`:

```ts
    notificationService = createMock<NotificationService>();
    paymentService = createMock<PaymentService>();
    // ...existing mock setup stays as-is...
    service = new BookingService(
      bookingRepo,
      dataSource,
      redisService,
      realtimeGateway,
      notificationService,
      paymentService,
    );
```

Then add two new `describe` blocks as siblings of the existing `describe('cancel', ...)` block:

```ts
  describe('merchantConfirm', () => {
    it('confirms a PENDING booking owned by the calling MERCHANT', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantConfirm(
        booking.id,
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(realtimeGateway.broadcastSlotUpdate).toHaveBeenCalledWith({
        courtId: booking.court.id,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        status: BookingStatus.CONFIRMED,
      });
      expect(notificationService.notify).toHaveBeenCalledWith(
        booking.user.id,
        expect.any(String),
        expect.any(String),
      );
    });

    it('throws ForbiddenException when a non-owning MERCHANT tries to confirm', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantConfirm(
          booking.id,
          buildAuthUser({ role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the booking is not PENDING', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantConfirm(
          booking.id,
          buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('merchantReject', () => {
    it('cancels a PENDING booking without touching payment (nothing was paid)', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'Sân đang bảo trì' },
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(paymentService.refundFull).not.toHaveBeenCalled();
    });

    it('cancels a CONFIRMED booking and triggers a full refund', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CONFIRMED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'Sân đang bảo trì' },
        buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(paymentService.refundFull).toHaveBeenCalledWith(booking.id);
    });

    it('throws ConflictException when the booking is already CANCELLED', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({
        court,
        status: BookingStatus.CANCELLED,
      });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.merchantReject(
          booking.id,
          { reason: 'x' },
          buildAuthUser({ id: owner.id, role: Role.MERCHANT }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows an ADMIN to reject any booking', async () => {
      const owner = buildUser({ role: Role.MERCHANT });
      const court = buildCourt({
        venue: { id: faker.string.uuid(), owner } as Court['venue'],
      });
      const booking = buildBookingRow({ court, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.save.mockImplementation((b) => Promise.resolve(b as Booking));

      const result = await service.merchantReject(
        booking.id,
        { reason: 'x' },
        buildAuthUser({ role: Role.ADMIN }),
      );

      expect(result.status).toBe(BookingStatus.CANCELLED);
    });
  });
```

- [x] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: FAIL — `service.merchantConfirm is not a function` (and TS compile errors on the `BookingService` constructor arity mismatch)

- [x] **Step 4: Implement the service changes**

In `apps/backend/src/booking/booking.service.ts`:

Add two imports near the top, with the other relative imports:

```ts
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { RejectBookingDto } from './dto/reject-booking.dto';
```

Change the constructor:

```ts
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationService: NotificationService,
    private readonly paymentService: PaymentService,
  ) {}
```

Add these methods to the class, right after `cancel` and before `remove`:

```ts
  async merchantConfirm(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOneForMerchant(id);
    this.assertMerchantOwnerOrAdmin(booking, user);
    if (booking.status !== BookingStatus.PENDING) {
      throw new ConflictException('Chỉ có thể xác nhận đơn đang chờ (PENDING)');
    }

    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepo.save(booking);

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CONFIRMED,
    });
    await this.notificationService.notify(
      booking.user.id,
      'Đơn đặt sân đã được xác nhận',
      `Chủ sân đã xác nhận đơn đặt sân ngày ${booking.bookingDate} lúc ${booking.startTime}.`,
    );

    return booking;
  }

  /**
   * Merchant-initiated rejection is never the player's fault, so — unlike
   * player cancel — this always refunds 100% of whatever was already paid.
   */
  async merchantReject(
    id: string,
    dto: RejectBookingDto,
    user: AuthenticatedUser,
  ): Promise<Booking> {
    const booking = await this.findOneForMerchant(id);
    this.assertMerchantOwnerOrAdmin(booking, user);
    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new ConflictException('Đơn đặt sân này đã bị hủy trước đó');
    }

    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);

    if (wasConfirmed) {
      await this.paymentService.refundFull(booking.id);
    }

    this.realtimeGateway.broadcastSlotUpdate({
      courtId: booking.court.id,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      status: BookingStatus.CANCELLED,
    });
    await this.notificationService.notify(
      booking.user.id,
      'Đơn đặt sân bị từ chối',
      `Chủ sân đã từ chối đơn đặt sân ngày ${booking.bookingDate} lúc ${booking.startTime}. Lý do: ${dto.reason}`,
    );

    return booking;
  }
```

Add these two private helpers right after the existing `assertOwnerOrAdmin` private method:

```ts
  private async findOneForMerchant(id: string): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: { court: { venue: { owner: true } }, user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    return booking;
  }

  private assertMerchantOwnerOrAdmin(
    booking: Booking,
    user: AuthenticatedUser,
  ): void {
    if (user.role !== Role.ADMIN && booking.court.venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên đơn đặt sân này',
      );
    }
  }
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter backend test booking.service.spec.ts`
Expected: PASS

- [x] **Step 6: Wire `PaymentModule` and `NotificationModule` into `BookingModule`**

In `apps/backend/src/booking/booking.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { MerchantController } from './merchant.controller';
import { Booking } from './entities/booking.entity';
import { VenueModule } from '../venue/venue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking]),
    VenueModule,
    RealtimeModule,
    NotificationModule,
    PaymentModule,
  ],
  controllers: [BookingController, MerchantController],
  providers: [BookingService],
})
export class BookingModule {}
```

- [x] **Step 7: Run the full backend unit suite to confirm nothing else broke**

Run: `pnpm --filter backend test`
Expected: PASS (no other spec constructs `BookingService` or `BookingModule` directly other than the one just updated — confirm this is true by checking the test failures list, if any, and fix any other direct `new BookingService(...)` call sites the same way)

- [x] **Step 8: Commit**

```bash
git add apps/backend/src/booking/dto/reject-booking.dto.ts apps/backend/src/booking/booking.service.ts apps/backend/src/booking/booking.service.spec.ts apps/backend/src/booking/booking.module.ts
git commit -m "feat(backend): add BookingService.merchantConfirm/merchantReject"
```

---

### Task 3: Controller endpoints + e2e tests

**Files:**
- Modify: `apps/backend/src/booking/booking.controller.ts`
- Modify: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Consumes: `BookingService.merchantConfirm` / `merchantReject` from Task 2.
- Produces: `PATCH /bookings/:id/confirm` (204→200, body `Booking`), `PATCH /bookings/:id/reject` (body `RejectBookingDto` → `Booking`). Consumed by Task 4/5's regenerated client + web UI.

- [x] **Step 1: Implement the controller endpoints**

In `apps/backend/src/booking/booking.controller.ts`, add imports:

```ts
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@sportspace/shared';
import { RejectBookingDto } from './dto/reject-booking.dto';
```

Add these two handlers right after `update` and before `cancel`:

```ts
  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiOperation({ summary: 'Chủ sân xác nhận đơn đặt sân (FR-M04)' })
  @ApiOkResponse({ type: Booking })
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingService.merchantConfirm(id, user);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiOperation({
    summary:
      'Chủ sân từ chối đơn đặt sân, hoàn tiền 100% nếu đã thanh toán (FR-M04)',
  })
  @ApiOkResponse({ type: Booking })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingService.merchantReject(id, dto, user);
  }
```

- [x] **Step 2: Update e2e fixture setup so a real MERCHANT login is available**

In `apps/backend/test/booking.e2e-spec.ts`, add imports:

```ts
import * as bcrypt from 'bcrypt';
```

Change the `owner` creation (currently `passwordHash: 'hash'`) and add an `otherMerchant`, following the exact pattern already used in `apps/backend/test/venue.e2e-spec.ts`:

```ts
    const SEED_PASSWORD = 'Password123!';
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    owner = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    const otherMerchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
```

(replace the existing `owner = await dataSource.getRepository(User).save({...})` block with this — keep everything else in `beforeAll` unchanged, including the `venue`/`court` creation that follows and already references `owner`)

Add a login helper and capture tokens, right after the existing `otherAccessToken = otherRegisterRes.body.accessToken;` line:

```ts
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    const ownerToken = await login(owner.email);
    const otherMerchantToken = await login(otherMerchant.email);
```

Declare `let ownerToken: string;` and `let otherMerchantToken: string;` alongside the other `let` declarations at the top of the `describe` block (or keep them as `const` inside `beforeAll` if no other test file in this suite needs them outside that scope — check how `accessToken` is declared and used across `it` blocks to match the existing pattern; `accessToken` is a `describe`-level `let` assigned inside `beforeAll`, so do the same for `ownerToken`/`otherMerchantToken` for consistency).

Add cleanup for `otherMerchant` in `afterAll`, alongside the existing `owner` deletion:

```ts
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
```

(store `otherMerchant` itself as a `describe`-level `let otherMerchant: User;` so `afterAll` can reach it, matching how `owner` is declared)

- [x] **Step 3: Write the failing e2e tests**

Add a new `describe` block in `apps/backend/test/booking.e2e-spec.ts`, as a sibling of the existing top-level `it(...)` blocks (place it near the end, before the closing of the outer `describe('Booking (e2e)', ...)`):

```ts
  describe('merchant confirm/reject', () => {
    it('lets the owning MERCHANT confirm a PENDING booking (200)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-05',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.status).toBe('CONFIRMED');
    });

    it('rejects confirm from a non-owning MERCHANT (403)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-06',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${otherMerchantToken}`)
        .expect(403);
    });

    it('rejects confirm from a PLAYER (403)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-07',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('lets the owning MERCHANT reject a PENDING booking with a reason (200)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-08',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      const res = await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/reject`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Sân đang bảo trì' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
    });

    it('returns 409 when confirming a booking that is not PENDING', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          courtId: court.id,
          bookingDate: '2026-09-09',
          startTime: '08:00',
          endTime: '09:00',
        })
        .expect(201);
      createdBookingIds.push(createRes.body.id);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/bookings/${createRes.body.id}/confirm`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
    });
  });
```

- [x] **Step 4: Run tests to verify they fail (before the controller change) / pass (after)**

Run: `pnpm --filter backend test:e2e -- booking.e2e-spec.ts`
Expected: With Step 1 already applied, this should PASS. If you're following strict TDD, temporarily comment out the two new controller handlers, confirm the new `it` blocks fail with 404, then restore them and confirm PASS.

- [x] **Step 5: Run the full backend test suite (unit + e2e)**

Run: `pnpm --filter backend test && pnpm --filter backend test:e2e`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add apps/backend/src/booking/booking.controller.ts apps/backend/test/booking.e2e-spec.ts
git commit -m "feat(backend): expose PATCH /bookings/:id/confirm and /reject"
```

---

### Task 4: Regenerate the shared API client

**Files:**
- Regenerate: `packages/shared/src/generated/**` (via script, no manual edits)
- Modify: `apps/web/src/lib/api-client.ts`

**Interfaces:**
- Consumes: the two new endpoints from Task 3.
- Produces: `getBookings(instance)` factory (already exists in `packages/shared/src/generated/bookings/bookings.ts` for the pre-existing booking endpoints — regeneration adds `bookingControllerConfirm` / `bookingControllerReject` methods to it) exposed as `bookings` on the client returned by `createAuthenticatedApiClient`. Consumed by Task 5.

- [x] **Step 1: Regenerate**

Run: `pnpm generate:api`
Expected: `packages/shared/src/generated/bookings/bookings.ts` (and its `.msw.ts`/`.faker.ts` siblings) now contain generated functions for `PATCH /bookings/:id/confirm` and `PATCH /bookings/:id/reject`, and `packages/shared/src/generated/model/rejectBookingDto.ts` is created and re-exported from `packages/shared/src/generated/model/index.ts`. Run `git diff --stat packages/shared/src/generated` to confirm the diff touches only booking-related generated files.

- [x] **Step 2: Wire the bookings client into the web app**

In `apps/web/src/lib/api-client.ts`, change:

```ts
import { getAuth, getVenues, getCourts, getMerchant, getAdmin } from '@sportspace/shared';
```

to:

```ts
import { getAuth, getVenues, getCourts, getMerchant, getAdmin, getBookings } from '@sportspace/shared';
```

and in `createAuthenticatedApiClient`, add `bookings: getBookings(instance),` to the returned object (alongside `merchant`/`admin`).

- [x] **Step 3: Verify the web app still type-checks**

Run: `pnpm --filter web exec tsc --noEmit`
Expected: PASS (no type errors — confirms the generated client's exported function names match what Task 5 will import)

- [x] **Step 4: Commit**

```bash
git add packages/shared/src/generated apps/web/src/lib/api-client.ts
git commit -m "chore(shared): regenerate API client for booking confirm/reject"
```

---

### Task 5: Web merchant bookings page

**Files:**
- Create: `apps/web/src/app/merchant/bookings/page.tsx`
- Create: `apps/web/src/app/merchant/bookings/actions.ts`
- Create: `apps/web/src/app/merchant/bookings/actions.test.ts`
- Create: `apps/web/src/app/merchant/bookings/loading.tsx`
- Create: `apps/web/src/app/merchant/bookings/error.tsx`
- Modify: `apps/web/src/app/merchant/layout.tsx`

**Interfaces:**
- Consumes: `bookings.bookingControllerFindAll()`, `bookings.bookingControllerConfirm(id)`, `bookings.bookingControllerReject(id, { reason })` from Task 4's regenerated client; `createAuthenticatedApiClient`, `requireSession`, `handleApiError` (existing, `apps/web/src/lib/`).
- Produces: page at `/merchant/bookings`.

First, read `apps/web/src/app/admin/venues/actions.test.ts` in full to copy its exact mocking style (it mocks `@/lib/api-client` and `@/lib/require-session`, then asserts the right generated-client method was called and `revalidatePath` fired) before writing Step 1 below — reuse that structure verbatim, swapping venue calls for booking calls.

- [x] **Step 1: Write the failing action tests**

Create `apps/web/src/app/merchant/bookings/actions.test.ts`, mirroring `apps/web/src/app/admin/venues/actions.test.ts`'s mock setup exactly (same `jest.mock('@/lib/api-client', ...)` and `jest.mock('@/lib/require-session', ...)` shape) but asserting on `bookings.bookingControllerConfirm` / `bookings.bookingControllerReject`:

```ts
import { confirmBooking, rejectBooking } from './actions';

const bookingControllerConfirm = jest.fn();
const bookingControllerReject = jest.fn();

jest.mock('@/lib/api-client', () => ({
  createAuthenticatedApiClient: () => ({
    bookings: {
      bookingControllerConfirm: (...args: unknown[]) =>
        bookingControllerConfirm(...args),
      bookingControllerReject: (...args: unknown[]) =>
        bookingControllerReject(...args),
    },
  }),
}));

jest.mock('@/lib/require-session', () => ({
  requireSession: async () => ({ accessToken: 'token' }),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

describe('merchant bookings actions', () => {
  beforeEach(() => {
    bookingControllerConfirm.mockReset();
    bookingControllerReject.mockReset();
  });

  it('confirmBooking calls bookingControllerConfirm with the booking id', async () => {
    await confirmBooking('booking-1');
    expect(bookingControllerConfirm).toHaveBeenCalledWith('booking-1');
  });

  it('rejectBooking calls bookingControllerReject with the booking id and reason', async () => {
    await rejectBooking('booking-1', 'Sân đang bảo trì');
    expect(bookingControllerReject).toHaveBeenCalledWith('booking-1', {
      reason: 'Sân đang bảo trì',
    });
  });
});
```

Adjust the mock shapes to match whatever `admin/venues/actions.test.ts` actually does if it differs from the above sketch (e.g. it may mock the whole module differently) — read it first as instructed above and make this file consistent with it, not with this plan, if the two diverge.

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test actions.test.ts -- --testPathPattern=merchant/bookings`
Expected: FAIL — `Cannot find module './actions'`

- [x] **Step 3: Implement the server actions**

Create `apps/web/src/app/merchant/bookings/actions.ts`, mirroring `apps/web/src/app/admin/venues/actions.ts`:

```ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

async function withMerchantSession<T>(
  fn: (client: ReturnType<typeof createAuthenticatedApiClient>) => Promise<T>,
): Promise<T> {
  const session = await requireSession();
  const client = createAuthenticatedApiClient(session.accessToken);
  try {
    return await fn(client);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }
}

export async function confirmBooking(bookingId: string): Promise<void> {
  await withMerchantSession(({ bookings }) =>
    bookings.bookingControllerConfirm(bookingId),
  );
  revalidatePath('/merchant/bookings');
}

export async function rejectBooking(
  bookingId: string,
  reason: string,
): Promise<void> {
  await withMerchantSession(({ bookings }) =>
    bookings.bookingControllerReject(bookingId, { reason }),
  );
  revalidatePath('/merchant/bookings');
}
```

(If the generated `bookingControllerConfirm`/`bookingControllerReject` function signatures from Task 4 differ from `(id: string)` / `(id: string, dto: RejectBookingDto)` — e.g. orval may generate an options-object second parameter — check `packages/shared/src/generated/bookings/bookings.ts` after regeneration and match its actual signature here.)

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web test actions.test.ts -- --testPathPattern=merchant/bookings`
Expected: PASS

- [x] **Step 5: Implement the page**

Create `apps/web/src/app/merchant/bookings/page.tsx`, mirroring `apps/web/src/app/admin/venues/page.tsx`'s structure (server component, fetch via authenticated client, render a card per row with action-bound forms):

```tsx
import { BookingStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { confirmBooking, rejectBooking } from './actions';

export default async function MerchantBookingsPage() {
  const session = await requireSession();
  const { bookings } = createAuthenticatedApiClient(session.accessToken);

  let allBookings;
  try {
    const { data } = await bookings.bookingControllerFindAll();
    allBookings = data;
  } catch (err) {
    handleApiError(err);
  }

  const pendingOrConfirmed = allBookings.filter(
    (b) =>
      b.status === BookingStatus.PENDING ||
      b.status === BookingStatus.CONFIRMED,
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Đơn đặt sân</h1>

      {pendingOrConfirmed.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có đơn đặt sân nào cần xử lý.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {pendingOrConfirmed.map((booking) => (
          <div
            key={booking.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">{booking.court.name}</p>
            <p className="text-zinc-500">
              {booking.bookingDate} · {booking.startTime}–{booking.endTime}
            </p>
            <p className="text-zinc-500">
              Người đặt: {booking.user.fullName} ({booking.user.email})
            </p>
            <p className="text-xs text-zinc-400">Trạng thái: {booking.status}</p>
            <div className="flex gap-3">
              {booking.status === BookingStatus.PENDING && (
                <form action={confirmBooking.bind(null, booking.id)}>
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Xác nhận
                  </button>
                </form>
              )}
              <form action={rejectBooking.bind(null, booking.id, 'Chủ sân từ chối')}>
                <button
                  type="submit"
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Từ chối
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `apps/web/src/app/merchant/bookings/loading.tsx` and `apps/web/src/app/merchant/bookings/error.tsx` by copying `apps/web/src/app/admin/venues/loading.tsx` and `apps/web/src/app/admin/venues/error.tsx` verbatim (read them first — they are generic Next.js loading/error boundary components with no venue-specific content, so no edits should be needed beyond the copy).

- [x] **Step 6: Add the nav link**

In `apps/web/src/app/merchant/layout.tsx`, change `NAV_ITEMS` to:

```ts
const NAV_ITEMS = [
  { href: '/merchant', label: 'Tổng quan' },
  { href: '/merchant/venues', label: 'Cụm sân' },
  { href: '/merchant/venues/new', label: 'Tạo cụm sân mới' },
  { href: '/merchant/bookings', label: 'Đơn đặt sân' },
  { href: '/merchant/revenue', label: 'Doanh thu' },
];
```

- [x] **Step 7: Run the web test suite and type-check**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit`
Expected: PASS

- [x] **Step 8: Manually verify in the browser**

Run: `pnpm --filter backend start:dev` and `pnpm --filter web dev` (with Postgres/Redis up per `docker-compose.yml`), log in as a MERCHANT with a PENDING booking on one of their courts, visit `/merchant/bookings`, click Xác nhận/Từ chối, and confirm the booking's status changes and the row updates after the page revalidates.

- [x] **Step 9: Commit**

```bash
git add apps/web/src/app/merchant/bookings apps/web/src/app/merchant/layout.tsx
git commit -m "feat(web): merchant booking confirm/reject page"
```

---

## Self-Review Notes

- **Spec coverage:** FR-M04 (merchant confirms/rejects a booking) is covered end-to-end: backend state machine (Task 2), API surface (Task 3), generated client (Task 4), web UI (Task 5). The refund-on-reject behavior anticipates the separate cancel-refund-policy plan's `PaymentService` work — if that plan lands first and renames/reshapes the refund method, reconcile `refundFull` naming with it rather than keeping two divergent refund code paths.
- **Type consistency:** `RejectBookingDto` is defined once in Task 2 and reused verbatim in Task 3's controller and Task 5's action signature note.
- **No placeholders:** every step has literal code; the two "check X first" notes (Task 5 Steps 1 and 3) are deliberate — they point at a sibling file whose exact shape must be read before copying, not an unresolved TODO.

## Execution notes (post-implementation)

- Constructor conflict: this plan predates `cancel-refund-policy`, which added `paymentRepo` to `BookingService`'s constructor. Task 2's literal 6-arg constructor snippet was stale — reconciled to append `notificationService`/`paymentService` to the real 5-arg constructor instead of replacing it. Same for `booking.module.ts`'s `TypeOrmModule.forFeature` (kept `Payment`, added the two new module imports).
- **Real gap found and closed:** Task 5's `page.tsx` was written assuming `bookingControllerFindAll()` returns a merchant's incoming venue bookings — it actually returns bookings the merchant made *as a player*, scoped by `user.id`. Added `GET /merchant/bookings` on the existing `MerchantController` (venue-scoped via `court.venue.owner.id`, mirroring `getRevenue`/`getVenues`) as an unplanned addition; `page.tsx` consumes that instead.
- **UX gap found and closed:** Task 5's `page.tsx` sketch bound the reject form to a hardcoded reason string (`'Chủ sân từ chối'`). Added a real `reason` text input; `rejectBooking` now reads it from `FormData` instead of a fixed placeholder.
- Manual browser verification (Task 5 Step 8) was not performed — no running dev environment available to the implementing agents. Worth a manual pass before this ships to real users.

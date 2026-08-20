# Court Status + Slot Blocking (FR-M02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant take a whole court out of service (MAINTENANCE status) or block a specific date/time slot without a real booking, and have both correctly exclude the affected slots from availability everywhere a player can see or book them.

**Architecture:** `Court` gains a `status` enum column (`ACTIVE`/`MAINTENANCE`). A new `CourtBlock` entity (mirroring `Shift`'s shape and placement — methods live directly on the existing `CourtService`/`CourtController`, no separate module) records ad-hoc unavailable windows. Both integrate into the two places that currently only check `Booking` rows: `GET /courts/:id/slots` (read) and `BookingService.create()`'s `assertSlotFree` (write, inside the existing race-condition-protected transaction).

**Tech Stack:** NestJS + TypeORM (backend), Next.js App Router (web). **No mobile changes** — see the note at the bottom of this section.

**Platform coverage note (mobile):** investigated before writing this plan, not assumed. `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx` renders every slot purely off the `SlotDto.available: boolean` field (`disabled={!item.available}`, `!item.available && styles.slotDisabled}`, etc. — grep confirms zero reason-specific branches). Once the backend's `available` computation in Task 3 accounts for `CourtStatus` and `CourtBlock`, the existing mobile UI automatically and correctly disables those slots with no code change. The one accepted gap: `useCourtSlotUpdates`' realtime socket handler only reacts to booking-status-change events, so a merchant blocking a slot or setting MAINTENANCE while a player has the screen open won't push a live update (a manual refresh would show it) — this matches the spec's own "Out of scope: no notification to players" and isn't something this plan adds handling for.

## Global Constraints

- TypeScript strict; camelCase vars/functions, PascalCase classes/types.
- Vietnamese git commit messages, ZERO AI/Claude/Co-Authored-By attribution ever (hard standing project rule).
- No hand-written DB migrations — generate via `pnpm run migration:generate` from `apps/backend`.
- TDD: write the failing test before the implementation.
- No recurring/repeating blocks — each block is a single date+time range.
- No notification to players when a court goes into maintenance.
- A `CourtBlock` covering a slot that already has a live `Booking` is rejected at block-creation time (`ConflictException`) — merchants block empty slots, they don't force-cancel existing bookings through this endpoint.

---

## File Structure

**Backend — new:**
- `packages/shared/src/enums/court-status.enum.ts`
- `apps/backend/src/venue/entities/court-block.entity.ts`
- `apps/backend/src/venue/dto/create-court-block.dto.ts`
- `apps/backend/src/venue/dto/court-block-query.dto.ts`
- `apps/backend/src/database/migrations/*-AddCourtStatusAndCourtBlocks.ts` (generated)

**Backend — modified:**
- `packages/shared/src/index.ts`
- `apps/backend/src/venue/entities/court.entity.ts`
- `apps/backend/src/venue/dto/update-court.dto.ts`
- `apps/backend/src/venue/court.service.ts` (+ `.spec.ts`)
- `apps/backend/src/venue/court.controller.ts` (+ `.spec.ts`)
- `apps/backend/src/venue/venue.service.ts`
- `apps/backend/src/booking/booking.service.ts` (+ `.spec.ts`)
- `apps/backend/test/venue.e2e-spec.ts`
- `apps/backend/test/booking.e2e-spec.ts`

**Web — new:**
- `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/actions.ts`
- `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/block-form.tsx`

**Web — modified:**
- `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/courts/actions.ts`

---

### Task 1: `CourtStatus` enum, `Court.status` column, `CourtBlock` entity, migration

**Files:**
- Create: `packages/shared/src/enums/court-status.enum.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/backend/src/venue/entities/court.entity.ts`
- Create: `apps/backend/src/venue/entities/court-block.entity.ts`
- Create (generated): `apps/backend/src/database/migrations/*-AddCourtStatusAndCourtBlocks.ts`

**Interfaces:**
- Produces: `CourtStatus.ACTIVE | CourtStatus.MAINTENANCE`. `Court.status: CourtStatus` (default `ACTIVE`). `CourtBlock { id, court: Court, blockDate: string, startTime: string, endTime: string, reason: string, createdAt: Date }`.

- [ ] **Step 1: Add the shared enum**

```typescript
// packages/shared/src/enums/court-status.enum.ts
export enum CourtStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}
```

```typescript
// packages/shared/src/index.ts — add alongside the other explicit
// entity-status enum exports (near DisputeStatus etc.)
export { CourtStatus } from './enums/court-status.enum';
```

- [ ] **Step 2: Add the `status` column to `Court`**

```typescript
// apps/backend/src/venue/entities/court.entity.ts — add after `basePrice`
  @ApiProperty({ enum: CourtStatus })
  @Column({ type: 'enum', enum: CourtStatus, default: CourtStatus.ACTIVE })
  status: CourtStatus;
```

Add `import { CourtStatus } from '@sportspace/shared';` to this file's imports.

- [ ] **Step 3: Create the `CourtBlock` entity**

```typescript
// apps/backend/src/venue/entities/court-block.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Court } from './court.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('court_blocks')
export class CourtBlock {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): same circular-reference rule as Shift.staff.
  @ManyToOne(() => Court)
  @JoinColumn({ name: 'court_id' })
  court: Court;

  @ApiProperty()
  @Column({ type: 'date' })
  blockDate: string;

  @ApiProperty()
  @Column({ type: 'time' })
  startTime: string;

  @ApiProperty()
  @Column({ type: 'time' })
  endTime: string;

  @ApiProperty()
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 4: Rebuild `@sportspace/shared` and generate the migration**

Run: `cd packages/shared && pnpm build`
Expected: builds clean, `CourtStatus` exported.

Run: `cd apps/backend && pnpm run migration:generate src/database/migrations/AddCourtStatusAndCourtBlocks`
Expected: a new migration adding `status` (enum, default `ACTIVE`) to `courts` and creating the `court_blocks` table with a FK to `courts`.

Run: `cd apps/backend && pnpm run migration:run`
Expected: applies cleanly.

- [ ] **Step 5: Verify build**

Run: `cd apps/backend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd apps/backend && git add ../../packages/shared/src/enums/court-status.enum.ts \
  ../../packages/shared/src/index.ts src/venue/entities/court.entity.ts \
  src/venue/entities/court-block.entity.ts src/database/migrations
git commit -m "feat(backend): thêm trạng thái sân (bảo trì) và bảng chặn ô giờ"
```

---

### Task 2: Status update + `CourtBlock` CRUD on `CourtService`/`CourtController`

**Design note:** the design spec's Testing section refers to "CourtBlockService" — this plan deliberately does NOT create a separate service class for that. It mirrors the spec's own Architecture section instruction ("mirrors Staff's exact shape") and the actual precedent in this codebase: `Shift` (nested under `Staff`) has no separate `ShiftService` — its CRUD methods live directly on `StaffService`/`StaffController`. `CourtBlock` follows the identical pattern: methods on the existing `CourtService`/`CourtController`, no new module.

**Files:**
- Modify: `apps/backend/src/venue/dto/update-court.dto.ts`
- Create: `apps/backend/src/venue/dto/create-court-block.dto.ts`
- Create: `apps/backend/src/venue/dto/court-block-query.dto.ts`
- Modify: `apps/backend/src/venue/court.service.ts`
- Modify: `apps/backend/src/venue/court.controller.ts`
- Test: `apps/backend/src/venue/court.service.spec.ts` (create if it doesn't exist — check first)
- Test: `apps/backend/test/venue.e2e-spec.ts`

**Interfaces:**
- Consumes: `CourtStatus`, `CourtBlock` from Task 1.
- Produces: `UpdateCourtDto.status?: CourtStatus`. `CourtService.createBlock(courtId, dto: CreateCourtBlockDto, user): Promise<CourtBlock>`. `.listBlocks(courtId, query: CourtBlockQueryDto): Promise<CourtBlock[]>`. `.removeBlock(courtId, blockId, user): Promise<void>`. Routes: `POST /courts/:id/blocks`, `GET /courts/:id/blocks?date=`, `DELETE /courts/:id/blocks/:blockId`.

- [ ] **Step 1: Add `status` to `UpdateCourtDto`**

```typescript
// apps/backend/src/venue/dto/update-court.dto.ts — full file
import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { CourtStatus } from '@sportspace/shared';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateCourtDto } from './create-court.dto';

export class UpdateCourtDto extends PartialType(
  OmitType(CreateCourtDto, ['venueId'] as const),
) {
  @ApiPropertyOptional({ enum: CourtStatus })
  @IsOptional()
  @IsEnum(CourtStatus)
  status?: CourtStatus;
}
```

(`CourtService.update()` already does `Object.assign(court, dto); return this.courtRepo.save(court);` — no service change needed for this part, `status` flows through automatically.)

- [ ] **Step 2: Write the DTOs for blocks**

```typescript
// apps/backend/src/venue/dto/create-court-block.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, Matches, MinLength } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateCourtBlockDto {
  @ApiProperty()
  @IsDateString()
  blockDate: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason: string;
}
```

```typescript
// apps/backend/src/venue/dto/court-block-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CourtBlockQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;
}
```

- [ ] **Step 3: Write the failing unit tests**

Check whether `apps/backend/src/venue/court.service.spec.ts` already exists (it may not — `CourtService` may only have e2e coverage today). If it doesn't exist, create it following the exact mocking style of `apps/backend/src/staff/staff.service.spec.ts` (already shown to you if you're reading the plan doc alongside the addon-services plan's research — otherwise read that file directly): `createMock<Repository<Court>>()`, `createMock<DataSource>()`, `dataSource.getRepository.mockImplementation(...)`.

Add these cases (to the existing file, or the new one):

```typescript
describe('createBlock', () => {
  it('creates a block when user is the venue owner', async () => {
    const owner = buildUser();
    const court = buildCourt({ venue: buildVenue({ owner }) });
    courtRepo.findOne.mockResolvedValue(court);
    const blockRepo = createMock<Repository<CourtBlock>>();
    blockRepo.find.mockResolvedValue([]);
    blockRepo.create.mockImplementation(((data: object) => data) as typeof blockRepo.create);
    blockRepo.save.mockImplementation((b) => Promise.resolve(b as CourtBlock));
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === CourtBlock) return blockRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    const result = await service.createBlock(
      court.id,
      { blockDate: '2026-09-01', startTime: '10:00', endTime: '11:00', reason: 'Bảo trì mặt sân' },
      buildAuthUser({ id: owner.id }),
    );

    expect(result.reason).toBe('Bảo trì mặt sân');
  });

  it('rejects a block that overlaps an existing active booking (409)', async () => {
    const owner = buildUser();
    const court = buildCourt({ venue: buildVenue({ owner }) });
    courtRepo.findOne.mockResolvedValue(court);
    const bookingRepo = createMock<Repository<Booking>>();
    bookingRepo.find.mockResolvedValue([
      { id: 'b1', bookingDate: '2026-09-01', startTime: '10:30:00', endTime: '11:30:00', status: BookingStatus.CONFIRMED } as Booking,
    ]);
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Booking) return bookingRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    await expect(
      service.createBlock(
        court.id,
        { blockDate: '2026-09-01', startTime: '10:00', endTime: '11:00', reason: 'Bảo trì' },
        buildAuthUser({ id: owner.id }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when user is not the venue owner', async () => {
    const court = buildCourt();
    courtRepo.findOne.mockResolvedValue(court);

    await expect(
      service.createBlock(
        court.id,
        { blockDate: '2026-09-01', startTime: '10:00', endTime: '11:00', reason: 'X' },
        buildAuthUser(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

Add the necessary `buildCourt`/`buildVenue`/`buildUser`/`buildAuthUser` helper functions (mirror `staff.service.spec.ts`'s exact style) and imports (`CourtBlock`, `Booking`, `BookingStatus`, `ConflictException`, `ForbiddenException`) if this is a new spec file.

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- court.service.spec.ts`
Expected: FAIL — `createBlock` doesn't exist yet.

- [ ] **Step 5: Implement the service methods**

Add to `apps/backend/src/venue/court.service.ts`:

```typescript
  async createBlock(
    courtId: string,
    dto: CreateCourtBlockDto,
    user: AuthenticatedUser,
  ): Promise<CourtBlock> {
    const court = await this.findOne(courtId);
    this.assertOwnerOrAdmin(court.venue, user);

    const overlapping = await this.dataSource.getRepository(Booking).find({
      where: {
        court: { id: courtId },
        bookingDate: dto.blockDate,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });
    const hasBookingOverlap = overlapping.some(
      (b) => b.startTime.slice(0, 5) < dto.endTime && dto.startTime < b.endTime.slice(0, 5),
    );
    if (hasBookingOverlap) {
      throw new ConflictException(
        'Đã có đơn đặt sân trong khung giờ này, không thể chặn',
      );
    }

    const blockRepo = this.dataSource.getRepository(CourtBlock);
    const block = blockRepo.create({ ...dto, court });
    return blockRepo.save(block);
  }

  async listBlocks(
    courtId: string,
    query: CourtBlockQueryDto,
  ): Promise<CourtBlock[]> {
    return this.dataSource.getRepository(CourtBlock).find({
      where: {
        court: { id: courtId },
        ...(query.date ? { blockDate: query.date } : {}),
      },
    });
  }

  async removeBlock(
    courtId: string,
    blockId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const court = await this.findOne(courtId);
    this.assertOwnerOrAdmin(court.venue, user);

    const result = await this.dataSource
      .getRepository(CourtBlock)
      .delete({ id: blockId, court: { id: courtId } });
    if (!result.affected) {
      throw new NotFoundException('Khoảng chặn không tồn tại');
    }
  }
```

Add imports: `ConflictException` (from `@nestjs/common`, alongside the existing `ForbiddenException`/`Injectable`/`NotFoundException`), `In` (from `typeorm`, alongside existing imports), `BookingStatus` (from `@sportspace/shared`), `CourtBlock` (from `./entities/court-block.entity`), `Booking` (from `../booking/entities/booking.entity`), `CreateCourtBlockDto`, `CourtBlockQueryDto`.

- [ ] **Step 6: Wire the controller endpoints**

Add to `apps/backend/src/venue/court.controller.ts` (after the price-rules endpoints):

```typescript
  @Post(':id/blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chặn một khoảng giờ (không cho đặt) trên sân' })
  @ApiCreatedResponse({ type: CourtBlock })
  createBlock(
    @Param('id') id: string,
    @Body() dto: CreateCourtBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courtService.createBlock(id, dto, user);
  }

  @Get(':id/blocks')
  @ApiOperation({ summary: 'Danh sách khoảng giờ bị chặn của sân' })
  @ApiOkResponse({ type: [CourtBlock] })
  listBlocks(@Param('id') id: string, @Query() query: CourtBlockQueryDto) {
    return this.courtService.listBlocks(id, query);
  }

  @Delete(':id/blocks/:blockId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bỏ chặn một khoảng giờ' })
  removeBlock(
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.courtService.removeBlock(id, blockId, user);
  }
```

Add imports: `CreateCourtBlockDto`, `CourtBlockQueryDto`, `CourtBlock` (from `./entities/court-block.entity`).

- [ ] **Step 7: Run unit tests to verify they pass**

Run: `cd apps/backend && pnpm test -- court.service.spec.ts`
Expected: PASS

- [ ] **Step 8: Write and run the failing e2e test for status + blocks CRUD**

Add to `apps/backend/test/venue.e2e-spec.ts` (reuse this file's existing `merchantToken`/`courtId`/`venueId` fixtures — check the current file's exact variable names before writing, they may differ from what's shown here):

```typescript
  it('lets the owning MERCHANT toggle court status to MAINTENANCE and back', async () => {
    const maintRes = await request(app.getHttpServer())
      .patch(`/courts/${courtId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ status: 'MAINTENANCE' })
      .expect(200);
    expect(maintRes.body.status).toBe('MAINTENANCE');

    const activeRes = await request(app.getHttpServer())
      .patch(`/courts/${courtId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(activeRes.body.status).toBe('ACTIVE');
  });

  it('lets the owning MERCHANT create, list, and remove a court block', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/courts/${courtId}/blocks`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ blockDate: '2026-09-05', startTime: '10:00', endTime: '11:00', reason: 'Sự kiện riêng' })
      .expect(201);
    const blockId = createRes.body.id;

    const listRes = await request(app.getHttpServer())
      .get(`/courts/${courtId}/blocks`)
      .query({ date: '2026-09-05' })
      .expect(200);
    expect((listRes.body as { id: string }[]).map((b) => b.id)).toContain(blockId);

    await request(app.getHttpServer())
      .delete(`/courts/${courtId}/blocks/${blockId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
  });
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: PASS. (Known environment quirk, not a bug: the e2e jest process sometimes doesn't exit cleanly after finishing — redirect to a file if a run seems to hang, `pnpm test:e2e -- venue.e2e-spec.ts > /tmp/out.txt 2>&1 &`.)

- [ ] **Step 10: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors.

- [ ] **Step 11: Commit**

```bash
cd apps/backend && git add src/venue test/venue.e2e-spec.ts
git commit -m "feat(backend): thêm API cập nhật trạng thái sân và quản lý khoảng chặn giờ"
```

---

### Task 3: Availability integration — `getSlots` and `BookingService`

**Files:**
- Modify: `apps/backend/src/venue/court.service.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Test: `apps/backend/src/venue/court.service.spec.ts`
- Test: `apps/backend/src/booking/booking.service.spec.ts`

**Interfaces:**
- Consumes: `CourtStatus`, `CourtBlock` from Task 1; `court.status` field.
- Produces: `getSlots()` marks a slot unavailable if the court is `MAINTENANCE`, or covered by a `Booking`, or overlapping a `CourtBlock`. `BookingService.create()`/`update()` reject with `ConflictException` if the court is `MAINTENANCE` or the requested slot overlaps a `CourtBlock` — checked inside the same `manager`/transaction as the existing `assertSlotFree` pessimistic-lock check, so a block created concurrently with a booking attempt can't create a phantom double-booking.

- [ ] **Step 1: Write the failing test for `getSlots`**

Add to `court.service.spec.ts`:

```typescript
describe('getSlots', () => {
  it('marks every slot unavailable when the court is under MAINTENANCE', async () => {
    const court = buildCourt({ status: CourtStatus.MAINTENANCE });
    courtRepo.findOne.mockResolvedValue(court);
    const bookingRepo = createMock<Repository<Booking>>();
    bookingRepo.find.mockResolvedValue([]);
    const blockRepo = createMock<Repository<CourtBlock>>();
    blockRepo.find.mockResolvedValue([]);
    const priceRuleRepo = createMock<Repository<PriceRule>>();
    priceRuleRepo.findOne.mockResolvedValue(null);
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Booking) return bookingRepo;
      if (entity === CourtBlock) return blockRepo;
      if (entity === PriceRule) return priceRuleRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    const slots = await service.getSlots(court.id, { date: '2026-09-01' });

    expect(slots.every((s) => s.available === false)).toBe(true);
  });

  it('marks a slot unavailable when it overlaps a CourtBlock', async () => {
    const court = buildCourt({ status: CourtStatus.ACTIVE });
    courtRepo.findOne.mockResolvedValue(court);
    const bookingRepo = createMock<Repository<Booking>>();
    bookingRepo.find.mockResolvedValue([]);
    const blockRepo = createMock<Repository<CourtBlock>>();
    blockRepo.find.mockResolvedValue([
      { id: 'blk1', court, blockDate: '2026-09-01', startTime: '10:30:00', endTime: '11:30:00', reason: 'x', createdAt: new Date() } as CourtBlock,
    ]);
    const priceRuleRepo = createMock<Repository<PriceRule>>();
    priceRuleRepo.findOne.mockResolvedValue(null);
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Booking) return bookingRepo;
      if (entity === CourtBlock) return blockRepo;
      if (entity === PriceRule) return priceRuleRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    const slots = await service.getSlots(court.id, { date: '2026-09-01' });

    const slot10 = slots.find((s) => s.startTime === '10:00');
    const slot11 = slots.find((s) => s.startTime === '11:00');
    const slot12 = slots.find((s) => s.startTime === '12:00');
    expect(slot10?.available).toBe(false);
    expect(slot11?.available).toBe(false);
    expect(slot12?.available).toBe(true);
  });
});
```

Add `import { CourtStatus } from '@sportspace/shared';` and `import { CourtBlock } from './entities/court-block.entity';` if not already present from Task 2.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- court.service.spec.ts`
Expected: FAIL — `getSlots` doesn't check status/blocks yet.

- [ ] **Step 3: Implement the `getSlots` change**

Replace `apps/backend/src/venue/court.service.ts`'s `getSlots` method:

```typescript
  async getSlots(courtId: string, query: SlotQueryDto): Promise<SlotDto[]> {
    const court = await this.findOne(courtId);
    const dayOfWeek = new Date(`${query.date}T00:00:00Z`).getUTCDay();

    const activeBookings = await this.dataSource.getRepository(Booking).find({
      where: {
        court: { id: courtId },
        bookingDate: query.date,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });
    const bookedStartTimes = new Set(
      // Postgres returns `time` columns as "HH:mm:ss"; slots are "HH:mm".
      activeBookings.map((b) => b.startTime.slice(0, 5)),
    );

    const blocks = await this.dataSource.getRepository(CourtBlock).find({
      where: { court: { id: courtId }, blockDate: query.date },
    });

    const slots: SlotDto[] = [];
    for (let hour = OPERATING_START_HOUR; hour < OPERATING_END_HOUR; hour++) {
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      const endTime = `${String(hour + 1).padStart(2, '0')}:00`;
      const price = await this.getHourlyRate(
        court,
        dayOfWeek,
        startTime,
        endTime,
      );
      const isBlocked = blocks.some(
        (b) =>
          b.startTime.slice(0, 5) < endTime && startTime < b.endTime.slice(0, 5),
      );
      slots.push({
        startTime,
        endTime,
        price,
        available:
          court.status === CourtStatus.ACTIVE &&
          !bookedStartTimes.has(startTime) &&
          !isBlocked,
      });
    }
    return slots;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- court.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for `BookingService.create()`**

Add to `booking.service.spec.ts`'s existing `describe('create', ...)` block (reuse `buildCourt`/`buildUser`/`buildCreateDto`/`buildAuthUser` and the `manager` mock):

```typescript
    it('rejects booking a court that is under MAINTENANCE', async () => {
      const court = buildCourt({ status: CourtStatus.MAINTENANCE });
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects booking a slot that overlaps an existing CourtBlock', async () => {
      const court = buildCourt({ status: CourtStatus.ACTIVE });
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id, startTime: '10:00', endTime: '11:00' });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });
      manager.find.mockImplementation((entity: unknown) => {
        if (entity === CourtBlock) {
          return Promise.resolve([
            { id: 'blk1', blockDate: dto.bookingDate, startTime: '10:30:00', endTime: '11:30:00', reason: 'x' },
          ]);
        }
        return Promise.resolve([]);
      });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(ConflictException);
    });
```

Add `status: CourtStatus.ACTIVE` as a default field to `buildCourt`'s returned object (check the current helper — it may need this added so existing tests that don't care about status keep passing with the correct default), and add `import { CourtStatus } from '@sportspace/shared';` and `import { CourtBlock } from '../venue/entities/court-block.entity';`.

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts`
Expected: FAIL — no MAINTENANCE/block check yet.

- [ ] **Step 7: Implement the `BookingService.create()` change**

In `apps/backend/src/booking/booking.service.ts`'s `create()`, right after the existing `court` lookup (`manager.findOne(Court, { where: { id: dto.courtId }, relations: { venue: true } })`, already present from the addon-services plan) and before `assertSlotFree`, add:

```typescript
        if (court.status !== CourtStatus.ACTIVE) {
          throw new ConflictException('Sân đang bảo trì, không thể đặt');
        }

        await this.assertSlotFree(
          manager,
          dto.courtId,
          dto.bookingDate,
          dto.startTime,
        );

        await this.assertNoBlockOverlap(
          manager,
          dto.courtId,
          dto.bookingDate,
          dto.startTime,
          dto.endTime,
        );
```

(The `assertSlotFree` call is already there — this just adds the status check before it and a new block check after it.) Apply the same two additions to the `update()` method's equivalent slot-change block (it already loads `court` via `manager.findOne(Court, { where: { id: courtId } })` — check whether it currently loads `relations: { venue: true }`; if not, this method doesn't need it for the status/block check, only `create()`'s service-validation logic needed the venue relation).

Add the new private method:

```typescript
  private async assertNoBlockOverlap(
    manager: EntityManager,
    courtId: string,
    bookingDate: string,
    startTime: string,
    endTime: string,
  ): Promise<void> {
    const blocks = await manager.find(CourtBlock, {
      where: { court: { id: courtId }, blockDate: bookingDate },
    });
    const overlaps = blocks.some(
      (b) =>
        b.startTime.slice(0, 5) < endTime && startTime < b.endTime.slice(0, 5),
    );
    if (overlaps) {
      throw new ConflictException('Ô giờ đang bị chặn, không thể đặt');
    }
  }
```

Place it near `assertSlotFree`. Add imports: `CourtStatus` (from `@sportspace/shared`, alongside the existing `BookingStatus, PaymentStatus, Role` import), `CourtBlock` (from `../venue/entities/court-block.entity`).

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts`
Expected: PASS

- [ ] **Step 9: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors.

- [ ] **Step 10: Commit**

```bash
cd apps/backend && git add src/venue/court.service.ts src/booking
git commit -m "feat(backend): loại trừ sân bảo trì và ô giờ bị chặn khỏi tính khả dụng khi đặt sân"
```

---

### Task 4: e2e full-flow tests + public venue search exclusion

**Files:**
- Modify: `apps/backend/src/venue/venue.service.ts`
- Modify: `apps/backend/test/venue.e2e-spec.ts`
- Modify: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3.
- Produces: `GET /venues?sport=` no longer matches a venue whose only court(s) with that sport are all `MAINTENANCE`.

- [ ] **Step 1: Write the failing e2e tests**

Add to `apps/backend/test/booking.e2e-spec.ts` (reuse this file's existing venue/court/token fixtures — check current names first):

```typescript
  it('rejects a booking attempt on a MAINTENANCE court (409)', async () => {
    await request(app.getHttpServer())
      .patch(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'MAINTENANCE' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ courtId: court.id, bookingDate: '2026-09-10', startTime: '09:00', endTime: '10:00' })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/courts/${court.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('rejects creating a block over an already-booked slot, and rejects booking a blocked slot', async () => {
    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ courtId: court.id, bookingDate: '2026-09-11', startTime: '09:00', endTime: '10:00' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ blockDate: '2026-09-11', startTime: '09:00', endTime: '10:00', reason: 'x' })
      .expect(409);

    const blockRes = await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ blockDate: '2026-09-12', startTime: '14:00', endTime: '15:00', reason: 'Sự kiện' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ courtId: court.id, bookingDate: '2026-09-12', startTime: '14:00', endTime: '15:00' })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/courts/${court.id}/blocks/${blockRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });

  it('slot listing correctly excludes both a MAINTENANCE court and a blocked window', async () => {
    await request(app.getHttpServer())
      .post(`/courts/${court.id}/blocks`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ blockDate: '2026-09-13', startTime: '16:00', endTime: '17:00', reason: 'x' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/courts/${court.id}/slots`)
      .query({ date: '2026-09-13' })
      .expect(200);

    const blockedSlot = res.body.find((s: { startTime: string }) => s.startTime === '16:00');
    expect(blockedSlot.available).toBe(false);
  });
```

(Check this file's actual variable names for the merchant/owner token and player/booking token before writing — the placeholders above follow the pattern already established elsewhere in this same file for its addon-services tests.)

- [ ] **Step 2: Run tests to verify they fail, then pass**

Run: `cd apps/backend && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: FAIL first (confirms the tests exercise real behavior), then re-run after Task 3's implementation is confirmed already landed — should now PASS since Task 3 already implemented the underlying logic; this task is purely about test coverage for the full e2e flow described in the spec's Testing section.

- [ ] **Step 3: Add the public-search exclusion**

In `apps/backend/src/venue/venue.service.ts`'s `findAll()`:

```typescript
    if (query.sport) {
      qb.innerJoin(
        'venue.courts',
        'court',
        'court.sport = :sport AND court.status = :courtStatus',
        { sport: query.sport, courtStatus: CourtStatus.ACTIVE },
      ).distinct(true);
    }
```

(Replaces the existing `innerJoin('venue.courts', 'court', 'court.sport = :sport', { sport: query.sport })` call — same structure, added `AND court.status = :courtStatus` condition and parameter.) Add `import { CourtStatus } from '@sportspace/shared';` if not already imported in this file (it likely already imports `Role, VenueStatus` from the same package — add to that line).

- [ ] **Step 4: Write the failing e2e test for search exclusion**

Add to `apps/backend/test/venue.e2e-spec.ts`:

```typescript
  it('excludes a venue from sport search when its only matching court is under MAINTENANCE', async () => {
    await request(app.getHttpServer())
      .patch(`/courts/${courtId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ status: 'MAINTENANCE' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/venues')
      .query({ sport: 'football' })
      .expect(200);
    expect(res.body.some((v: { id: string }) => v.id === venueId)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/courts/${courtId}`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });
```

Place this after the existing `'finds the venue publicly by sport once APPROVED, no auth required'` test, and restore `status: 'ACTIVE'` at the end so it doesn't affect later tests in the same file that assume the court is active — check the file's actual test order and existing venue/court fixtures before placing this.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: PASS

- [ ] **Step 6: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors. This closes out the backend portion of this plan.

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add src/venue/venue.service.ts test/venue.e2e-spec.ts test/booking.e2e-spec.ts
git commit -m "test(backend): thêm e2e cho luồng sân bảo trì, chặn ô giờ, và loại trừ khỏi tìm kiếm công khai"
```

---

### Task 5: Regenerate the API client

**Files:**
- Modify (tracked): `openapi.json`
- Modify (generated, git-ignored): `packages/shared/src/generated/**`, `packages/shared/dist/**`

**Interfaces:**
- Consumes: every backend change from Tasks 1-4.
- Produces: `Court.status: CourtStatus` on the generated type; `courtControllerCreateBlock`, `courtControllerListBlocks`, `courtControllerRemoveBlock` (or whatever the actual generated names turn out to be — confirm, don't guess) on the `courts` client.

- [ ] **Step 1: Regenerate**

Run:
```bash
cd apps/backend && pnpm run swagger:export
cd ../.. && pnpm run generate:api
cd packages/shared && pnpm build
```
Expected: clean build.

- [ ] **Step 2: Confirm the generated block-endpoint names**

Run: `grep -n "^const court" packages/shared/src/generated/courts/courts.ts | grep -i block`
Note the exact names for use in Task 6.

- [ ] **Step 3: Verify downstream compiles**

Run: `cd apps/backend && pnpm exec tsc --noEmit` (should still be clean) and `cd apps/web && pnpm exec tsc --noEmit` (expect no new errors — this task doesn't touch web code).

- [ ] **Step 4: Commit**

```bash
git add openapi.json
git commit -m "chore(shared): cập nhật openapi.json sau khi backend hỗ trợ trạng thái sân và chặn ô giờ"
```

---

### Task 6: Web — status toggle + blocks management page

**Files:**
- Create: `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/page.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/actions.ts`
- Create: `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/block-form.tsx`
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/actions.ts`

**Interfaces:**
- Consumes: the generated `courts` API client from Task 5 (exact block-endpoint names confirmed in Task 5 Step 2 — use those).
- Produces: a status-toggle button per court in the courts list; `/merchant/venues/[venueId]/courts/[courtId]/blocks` page mirroring the price-rules sub-page exactly.

- [ ] **Step 1: Add the status toggle to the courts list**

In `apps/web/src/app/merchant/venues/[venueId]/courts/actions.ts`, add:

```typescript
export async function toggleCourtStatus(
  venueId: string,
  courtId: string,
  nextStatus: 'ACTIVE' | 'MAINTENANCE',
): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerUpdate(courtId, { status: nextStatus });
  revalidatePath(coursePath(venueId));
}
```

In `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`, in each court's row (inside the `courtList.map(...)`, alongside the existing "Giá theo khung giờ" link and "Xoá" button), add a status badge/toggle and a link to the blocks page:

```tsx
              <Link href={`/merchant/venues/${venueId}/courts/${court.id}/blocks`} className="hover:underline">
                Chặn giờ
              </Link>
              <form action={toggleCourtStatus.bind(null, venueId, court.id, court.status === 'MAINTENANCE' ? 'ACTIVE' : 'MAINTENANCE')}>
                <button type="submit" className="hover:underline">
                  {court.status === 'MAINTENANCE' ? 'Mở lại sân' : 'Đóng bảo trì'}
                </button>
              </form>
```

Import `toggleCourtStatus` alongside `deleteCourt` in `page.tsx`. Place these inside the existing `<div className="flex items-center gap-3 text-sm text-zinc-500">` row alongside "Giá theo khung giờ" and "Xoá" — don't create a new wrapping div, match the existing row's structure.

- [ ] **Step 2: Write the blocks sub-page**

Mirror `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/price-rules/{page.tsx,actions.ts,price-rule-form.tsx}` exactly (already shown to you in this plan's research — re-read those 3 files directly if needed before writing). Key differences: fields are `blockDate` (date input), `startTime`/`endTime` (time inputs), `reason` (text input) instead of price-rule's day/time/price; list each block as `{blockDate} {startTime}–{endTime}: {reason}` with a "Xoá" button; call `courts.courtControllerListBlocks(courtId, { date: undefined })` (no date filter — show all upcoming blocks) and `courts.courtControllerCreateBlock`/`courtControllerRemoveBlock` (use the exact confirmed names from Task 5 Step 2, adjust if they differ from these guesses).

```typescript
// apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const blockSchema = z
  .object({
    blockDate: z.string().min(1, 'Vui lòng chọn ngày'),
    startTime: z.string().regex(TIME_PATTERN, 'Giờ bắt đầu không hợp lệ (HH:mm)'),
    endTime: z.string().regex(TIME_PATTERN, 'Giờ kết thúc không hợp lệ (HH:mm)'),
    reason: z.string().min(1, 'Vui lòng nhập lý do'),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: 'Giờ bắt đầu phải trước giờ kết thúc',
    path: ['endTime'],
  });

export interface BlockActionState {
  error?: string;
}

function blocksPath(venueId: string, courtId: string): string {
  return `/merchant/venues/${venueId}/courts/${courtId}/blocks`;
}

export async function addBlock(
  venueId: string,
  courtId: string,
  _prevState: BlockActionState | undefined,
  formData: FormData,
): Promise<BlockActionState> {
  const parsed = blockSchema.safeParse({
    blockDate: formData.get('blockDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  try {
    await courts.courtControllerCreateBlock(courtId, parsed.data);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    if (isAxiosError(err) && err.response?.status === 409) {
      return { error: 'Đã có đơn đặt sân trong khung giờ này, không thể chặn' };
    }
    return { error: 'Không thể chặn khoảng giờ, vui lòng thử lại' };
  }

  revalidatePath(blocksPath(venueId, courtId));
  return {};
}

export async function removeBlock(venueId: string, courtId: string, blockId: string): Promise<void> {
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);
  await courts.courtControllerRemoveBlock(courtId, blockId);
  revalidatePath(blocksPath(venueId, courtId));
}
```

```tsx
// apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/block-form.tsx
'use client';

import { useActionState } from 'react';
import { addBlock, type BlockActionState } from './actions';

const initialState: BlockActionState = {};

export function BlockForm({ venueId, courtId }: { venueId: string; courtId: string }) {
  const action = addBlock.bind(null, venueId, courtId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="blockDate" className="text-xs font-medium">
          Ngày
        </label>
        <input
          id="blockDate"
          name="blockDate"
          type="date"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="startTime" className="text-xs font-medium">
          Giờ bắt đầu
        </label>
        <input
          id="startTime"
          name="startTime"
          type="time"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="endTime" className="text-xs font-medium">
          Giờ kết thúc
        </label>
        <input
          id="endTime"
          name="endTime"
          type="time"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reason" className="text-xs font-medium">
          Lý do
        </label>
        <input
          id="reason"
          name="reason"
          required
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang chặn...' : 'Chặn khoảng giờ'}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
```

```tsx
// apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/page.tsx
import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { BlockForm } from './block-form';
import { removeBlock } from './actions';

function formatTime(time: string): string {
  return time.slice(0, 5);
}

export default async function BlocksPage({
  params,
}: {
  params: Promise<{ venueId: string; courtId: string }>;
}) {
  const { venueId, courtId } = await params;
  const session = await requireSession();
  const { courts } = createAuthenticatedApiClient(session.accessToken);

  let courtName: string;
  let blocks;
  try {
    const [courtRes, blocksRes] = await Promise.all([
      courts.courtControllerFindOne(courtId),
      courts.courtControllerListBlocks(courtId, {}),
    ]);
    courtName = courtRes.data.name;
    blocks = blocksRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href={`/merchant/venues/${venueId}/courts`} className="hover:underline">
            Sân con
          </Link>{' '}
          / {courtName}
        </p>
        <h1 className="text-xl font-semibold">Chặn giờ — {courtName}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {blocks.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có khoảng giờ nào bị chặn.</p>
        )}
        {blocks.map((block) => (
          <div
            key={block.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {block.blockDate} {formatTime(block.startTime)}–{formatTime(block.endTime)}: {block.reason}
            </span>
            <form action={removeBlock.bind(null, venueId, courtId, block.id)}>
              <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                Xoá
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Chặn khoảng giờ mới</h2>
        <BlockForm venueId={venueId} courtId={courtId} />
      </div>
    </div>
  );
}
```

Check the generated `Court`/block model types for whether `.data` on the list response is optional (per this plan's established pattern from prior specs — use `blocks = blocksRes.data ?? []` if so) and whether `courtControllerListBlocks` needs a query object argument at all (it might accept just `courtId` with an optional second param, or require `{}` explicitly — check the actual generated signature before finalizing).

- [ ] **Step 3: Run web suite and typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero new errors.

- [ ] **Step 4: Manually verify in the browser**

Per CLAUDE.md's UI-testing rule: start `apps/backend` and `apps/web` dev servers, sign in as a merchant with a venue/court, open the courts page, toggle a court to MAINTENANCE and back, open its "Chặn giờ" sub-page, add a block, confirm it appears, delete it. Report exactly what you observed.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add "src/app/merchant/venues/[venueId]/courts"
git commit -m "feat(web): thêm bật/tắt trạng thái bảo trì và quản lý chặn giờ cho sân con"
```

# Venue Reviews (FR-P11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player rate (1-5) and comment a venue after a confirmed, past booking, and let anyone browsing a venue see its average rating and review list.

**Architecture:** Extend the existing `Review` entity (already declared in `apps/backend/src/venue/entities/review.entity.ts` and registered in `VenueModule`, but with no service/controller yet) with a `booking` relation and a uniqueness constraint (one review per booking). Add `ReviewController`/`ReviewService` inside the `venue` module — mirroring how `CourtController`/`CourtService` already live flat inside that module — rather than a new top-level Nest module. Regenerate the OpenAPI spec and the `packages/shared` orval client so the mobile app gets typed `reviewsApi` calls, then add a "Đánh giá" (write review) screen reachable from a past confirmed booking, and show the average rating + review list on `VenueDetailScreen`.

**Tech Stack:** NestJS + TypeORM (backend), React Native + `@testing-library/react-native` + MSW (mobile), Jest + `@golevelup/ts-jest` `createMock<T>()` + `@faker-js/faker` (unit tests), Supertest (e2e), orval (client generation).

## Global Constraints

- Backend scaffolding MUST come from Nest CLI (`nest g ...`), never hand-written from scratch — CLAUDE.md §0.2.
- DB schema changes MUST go through `typeorm migration:generate` from the entity, never hand-written SQL — CLAUDE.md §0.2.
- No hand-written mocks: unit tests use `createMock<T>()` (`@golevelup/ts-jest`) and `@faker-js/faker`; mobile HTTP mocks use MSW — CLAUDE.md §0.3.
- `packages/shared` is the single source of truth for DTOs/types shared with mobile; it is generated from the backend's Swagger doc via `orval` — CLAUDE.md §0.3 / §10. Never hand-edit `packages/shared/src/generated/**`.
- TypeScript strict; 1 service = 1 responsibility; Conventional Commits — CLAUDE.md §10.
- Enforce the "1 review per booking" and "must have played" invariants at the DB/service layer, not just in the UI — matches the project's general stance on race/consistency handling (CLAUDE.md §6, applied here to the weaker case of double-review prevention).

---

### Task 1: Add `booking` relation + uniqueness to the `Review` entity, generate migration

**Files:**
- Modify: `apps/backend/src/venue/entities/review.entity.ts`
- Create: `apps/backend/src/database/migrations/<timestamp>-AddReviewBookingRelation.ts` (generated, not hand-written)

**Interfaces:**
- Produces: `Review.booking: Booking` (relation, FK column `booking_id`, unique), used by `ReviewService` in Task 4.

- [x] **Step 1: Add the `booking` relation and a unique index to the entity**

```ts
// apps/backend/src/venue/entities/review.entity.ts
import { Venue } from './venue.entity';
import { User } from '../../user/entities/user.entity';
import { Booking } from '../../booking/entities/booking.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('uq_review_booking', { unique: true })
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ type: 'int' })
  rating: number;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [x] **Step 2: Generate the migration from the entity diff (CLAUDE.md §0.2 — never hand-write)**

Run (with local Postgres up via `docker-compose up -d`, matching how `AddUserFcmToken` was generated):

```bash
pnpm --filter backend run migration:generate src/database/migrations/AddReviewBookingRelation
```

Expected: a new file `apps/backend/src/database/migrations/<timestamp>-AddReviewBookingRelation.ts` is created containing an `ALTER TABLE "reviews" ADD "booking_id" ...` plus a unique index on `booking_id`. Open it and confirm it only touches the `reviews` table — if TypeORM also picked up unrelated diffs, stop and investigate before proceeding.

- [x] **Step 3: Run the migration against the local dev DB**

```bash
pnpm --filter backend run migration:run
```

Expected: migration applies cleanly, no errors.

- [x] **Step 4: Commit**

```bash
git add apps/backend/src/venue/entities/review.entity.ts apps/backend/src/database/migrations/
git commit -m "feat(backend): add booking relation to Review entity"
```

---

### Task 2: Scaffold `ReviewController`/`ReviewService` via Nest CLI, wire into `VenueModule`

**Files:**
- Create: `apps/backend/src/venue/review.controller.ts` (CLI-generated)
- Create: `apps/backend/src/venue/review.controller.spec.ts` (CLI-generated)
- Create: `apps/backend/src/venue/review.service.ts` (CLI-generated)
- Create: `apps/backend/src/venue/review.service.spec.ts` (CLI-generated)
- Modify: `apps/backend/src/venue/venue.module.ts`

**Interfaces:**
- Produces: `ReviewController` (empty CRUD stub), `ReviewService` (empty stub) — filled in by Tasks 3-6.

- [x] **Step 1: Scaffold flat (mirrors `court.controller.ts`/`court.service.ts` living directly under `venue/`, not in a subfolder)**

```bash
cd apps/backend
npx nest g controller venue/review --flat
npx nest g service venue/review --flat
```

Expected: Nest CLI reports `CREATE src/venue/review.controller.ts`, `CREATE src/venue/review.controller.spec.ts`, `CREATE src/venue/review.service.ts`, `CREATE src/venue/review.service.spec.ts`, and `UPDATE src/venue/venue.module.ts` (CLI auto-registers both in the nearest module).

- [x] **Step 2: Verify `venue.module.ts` was updated correctly**

Open `apps/backend/src/venue/venue.module.ts` and confirm it now looks like:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';
import { AdminController } from './admin.controller';
import { CourtController } from './court.controller';
import { ReviewController } from './review.controller';
import { Venue } from './entities/venue.entity';
import { Court } from './entities/court.entity';
import { PriceRule } from './entities/price-rule.entity';
import { Review } from './entities/review.entity';
import { CourtService } from './court.service';
import { ReviewService } from './review.service';
import { Booking } from '../booking/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venue, Court, PriceRule, Review, Booking]),
  ],
  controllers: [VenueController, CourtController, AdminController, ReviewController],
  providers: [VenueService, CourtService, ReviewService],
  exports: [VenueService],
})
export class VenueModule {}
```

If `Booking` wasn't already imported into `forFeature`, add it — `ReviewService` needs `@InjectRepository(Booking)` in Task 4. If the CLI didn't produce exactly this (it won't add the `Booking` import), edit by hand to match.

- [x] **Step 3: Run the backend build to confirm the empty scaffold compiles**

```bash
pnpm --filter backend run build
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add apps/backend/src/venue/review.controller.ts apps/backend/src/venue/review.controller.spec.ts apps/backend/src/venue/review.service.ts apps/backend/src/venue/review.service.spec.ts apps/backend/src/venue/venue.module.ts
git commit -m "feat(backend): scaffold Review controller/service via Nest CLI"
```

---

### Task 3: DTOs for create + list-with-average-rating

**Files:**
- Create: `apps/backend/src/venue/dto/create-review.dto.ts`
- Create: `apps/backend/src/venue/dto/venue-reviews.dto.ts`

**Interfaces:**
- Produces: `CreateReviewDto { bookingId: string; rating: number; comment?: string }`, `VenueReviewsDto { averageRating: number; total: number; items: Review[] }` — consumed by `ReviewService`/`ReviewController` in Tasks 4-6.

- [x] **Step 1: Write `CreateReviewDto`**

```ts
// apps/backend/src/venue/dto/create-review.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
```

- [x] **Step 2: Write `VenueReviewsDto`**

```ts
// apps/backend/src/venue/dto/venue-reviews.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Review } from '../entities/review.entity';

export class VenueReviewsDto {
  @ApiProperty()
  averageRating: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: () => [Review] })
  items: Review[];
}
```

- [x] **Step 3: Commit**

```bash
git add apps/backend/src/venue/dto/create-review.dto.ts apps/backend/src/venue/dto/venue-reviews.dto.ts
git commit -m "feat(backend): add review DTOs"
```

---

### Task 4: `ReviewService.create` with eligibility validation + unit tests

**Files:**
- Modify: `apps/backend/src/venue/review.service.ts`
- Modify: `apps/backend/src/venue/review.service.spec.ts`

**Interfaces:**
- Consumes: `Repository<Booking>` (via `@InjectDataSource`), `Repository<Review>`, `AuthenticatedUser { id, email, role }` (from `apps/backend/src/auth/interfaces/authenticated-user.interface.ts`), `BookingStatus` (from `@sportspace/shared`).
- Produces: `ReviewService.create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review>` — throws `NotFoundException` (booking not found), `ForbiddenException` (not the booking's owner), `BadRequestException` (booking not eligible: not CONFIRMED, or date not yet passed, or already reviewed). Consumed by `ReviewController` in Task 5.

- [x] **Step 1: Write the failing unit tests**

```ts
// apps/backend/src/venue/review.service.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';
import { Venue } from './entities/venue.entity';
import { Court } from './entities/court.entity';
import { Booking } from '../booking/entities/booking.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.PLAYER,
    ...overrides,
  };
}

function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: faker.string.uuid(),
    user: { id: faker.string.uuid() } as User,
    court: { id: faker.string.uuid(), venue: { id: faker.string.uuid() } as Venue } as Court,
    bookingDate: '2020-01-01',
    status: BookingStatus.CONFIRMED,
    ...overrides,
  } as Booking;
}

describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepo: DeepMocked<Repository<Review>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let dataSource: DeepMocked<DataSource>;

  beforeEach(() => {
    reviewRepo = createMock<Repository<Review>>();
    bookingRepo = createMock<Repository<Booking>>();
    dataSource = createMock<DataSource>();
    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Booking) return bookingRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });
    reviewRepo.create.mockImplementation(((data: object) => data) as typeof reviewRepo.create);
    reviewRepo.save.mockImplementation((r) => Promise.resolve(r as Review));

    service = new ReviewService(reviewRepo, dataSource);
  });

  describe('create', () => {
    it('throws NotFoundException when the booking does not exist', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ bookingId: faker.string.uuid(), rating: 5 }, buildAuthUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when the requester did not make the booking', async () => {
      const booking = buildBooking();
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, buildAuthUser({ id: faker.string.uuid() })),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws BadRequestException when the booking is not CONFIRMED', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User, status: BookingStatus.PENDING });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the booking date has not passed yet', async () => {
      const user = buildAuthUser();
      const future = new Date();
      future.setDate(future.getDate() + 3);
      const booking = buildBooking({
        user: { id: user.id } as User,
        bookingDate: future.toISOString().slice(0, 10),
      });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException when the booking already has a review', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User });
      bookingRepo.findOne.mockResolvedValue(booking);
      reviewRepo.findOne.mockResolvedValue(createMock<Review>());
      await expect(
        service.create({ bookingId: booking.id, rating: 5 }, user),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the review when the booking is eligible', async () => {
      const user = buildAuthUser();
      const booking = buildBooking({ user: { id: user.id } as User });
      bookingRepo.findOne.mockResolvedValue(booking);
      reviewRepo.findOne.mockResolvedValue(null);

      const result = await service.create(
        { bookingId: booking.id, rating: 4, comment: 'Sân đẹp' },
        user,
      );

      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Sân đẹp');
      expect(reviewRepo.save).toHaveBeenCalled();
    });
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

```bash
pnpm --filter backend test review.service -- --watchAll=false
```

Expected: FAIL — `ReviewService` has no `create` method yet (compile error / `TypeError: service.create is not a function`).

- [x] **Step 3: Implement `ReviewService.create`**

```ts
// apps/backend/src/venue/review.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BookingStatus } from '@sportspace/shared';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { VenueReviewsDto } from './dto/venue-reviews.dto';
import { Booking } from '../booking/entities/booking.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateReviewDto, user: AuthenticatedUser): Promise<Review> {
    const booking = await this.dataSource.getRepository(Booking).findOne({
      where: { id: dto.bookingId },
      relations: { user: true, court: { venue: true } },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== user.id) {
      throw new ForbiddenException('Bạn không thể đánh giá booking của người khác');
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Chỉ có thể đánh giá booking đã xác nhận');
    }
    if (new Date(booking.bookingDate) > new Date()) {
      throw new BadRequestException('Chỉ có thể đánh giá sau khi đã chơi xong');
    }
    const existing = await this.reviewRepo.findOne({ where: { booking: { id: booking.id } } });
    if (existing) {
      throw new BadRequestException('Booking này đã được đánh giá');
    }

    const review = this.reviewRepo.create({
      venue: booking.court.venue,
      user: booking.user,
      booking,
      rating: dto.rating,
      comment: dto.comment,
    });
    return this.reviewRepo.save(review);
  }
}
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
pnpm --filter backend test review.service -- --watchAll=false
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/venue/review.service.ts apps/backend/src/venue/review.service.spec.ts
git commit -m "feat(backend): implement Review creation with eligibility checks"
```

---

### Task 5: `ReviewService.listByVenue` (average rating aggregation) + unit tests

**Files:**
- Modify: `apps/backend/src/venue/review.service.ts`
- Modify: `apps/backend/src/venue/review.service.spec.ts`

**Interfaces:**
- Produces: `ReviewService.listByVenue(venueId: string): Promise<VenueReviewsDto>` — consumed by `ReviewController` in Task 6.

- [x] **Step 1: Add the failing test**

```ts
// append inside apps/backend/src/venue/review.service.spec.ts, new describe block
  describe('listByVenue', () => {
    it('returns items, total, and the average rating rounded to 1 decimal', async () => {
      const venueId = faker.string.uuid();
      reviewRepo.find.mockResolvedValue([
        createMock<Review>({ rating: 5 }),
        createMock<Review>({ rating: 4 }),
      ]);

      const result = await service.listByVenue(venueId);

      expect(reviewRepo.find).toHaveBeenCalledWith({
        where: { venue: { id: venueId } },
        relations: { user: true },
        order: { createdAt: 'DESC' },
      });
      expect(result.total).toBe(2);
      expect(result.averageRating).toBe(4.5);
    });

    it('returns averageRating 0 when there are no reviews', async () => {
      reviewRepo.find.mockResolvedValue([]);
      const result = await service.listByVenue(faker.string.uuid());
      expect(result.total).toBe(0);
      expect(result.averageRating).toBe(0);
    });
  });
```

- [x] **Step 2: Run to verify it fails**

```bash
pnpm --filter backend test review.service -- --watchAll=false
```

Expected: FAIL — `listByVenue` not defined.

- [x] **Step 3: Implement it**

```ts
// add to ReviewService in apps/backend/src/venue/review.service.ts
  async listByVenue(venueId: string): Promise<VenueReviewsDto> {
    const items = await this.reviewRepo.find({
      where: { venue: { id: venueId } },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    const total = items.length;
    const averageRating =
      total === 0
        ? 0
        : Math.round((items.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10;
    return { items, total, averageRating };
  }
```

- [x] **Step 4: Run to verify it passes**

```bash
pnpm --filter backend test review.service -- --watchAll=false
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/venue/review.service.ts apps/backend/src/venue/review.service.spec.ts
git commit -m "feat(backend): add venue review listing with average rating"
```

---

### Task 6: `ReviewController` endpoints + controller unit tests

**Files:**
- Modify: `apps/backend/src/venue/review.controller.ts`
- Modify: `apps/backend/src/venue/review.controller.spec.ts`

**Interfaces:**
- Consumes: `ReviewService.create`, `ReviewService.listByVenue` (Tasks 4-5).
- Produces: `POST /reviews` (body `CreateReviewDto`, auth required, returns `Review`), `GET /reviews?venueId=` (public, returns `VenueReviewsDto`).

- [x] **Step 1: Write the failing controller tests**

```ts
// apps/backend/src/venue/review.controller.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@sportspace/shared';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { Review } from './entities/review.entity';

describe('ReviewController', () => {
  let controller: ReviewController;
  let service: DeepMocked<ReviewService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: createMock<ReviewService>() }],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
    service = module.get(ReviewService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() forwards dto and the authenticated user', async () => {
    const user = { id: faker.string.uuid(), email: faker.internet.email(), role: Role.PLAYER };
    const dto = { bookingId: faker.string.uuid(), rating: 5 };
    const expected = createMock<Review>();
    service.create.mockResolvedValue(expected);

    const result = await controller.create(dto, user);

    expect(service.create).toHaveBeenCalledWith(dto, user);
    expect(result).toBe(expected);
  });

  it('findByVenue() forwards the venueId query param', async () => {
    const venueId = faker.string.uuid();
    service.listByVenue.mockResolvedValue({ averageRating: 0, total: 0, items: [] });

    await controller.findByVenue(venueId);

    expect(service.listByVenue).toHaveBeenCalledWith(venueId);
  });
});
```

- [x] **Step 2: Run to verify it fails**

```bash
pnpm --filter backend test review.controller -- --watchAll=false
```

Expected: FAIL — `create`/`findByVenue` not defined on the controller.

- [x] **Step 3: Implement the controller**

```ts
// apps/backend/src/venue/review.controller.ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { VenueReviewsDto } from './dto/venue-reviews.dto';
import { Review } from './entities/review.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLAYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đánh giá sân sau khi đã chơi xong' })
  @ApiCreatedResponse({ type: Review })
  create(@Body() dto: CreateReviewDto, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đánh giá + điểm trung bình theo cụm sân' })
  @ApiOkResponse({ type: VenueReviewsDto })
  findByVenue(@Query('venueId') venueId: string) {
    return this.reviewService.listByVenue(venueId);
  }
}
```

- [x] **Step 4: Run to verify it passes**

```bash
pnpm --filter backend test review.controller -- --watchAll=false
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/venue/review.controller.ts apps/backend/src/venue/review.controller.spec.ts
git commit -m "feat(backend): expose review create/list endpoints"
```

---

### Task 7: e2e test covering the full review flow

**Files:**
- Create: `apps/backend/test/review.e2e-spec.ts`

**Interfaces:**
- Consumes: `POST /auth/register`, `POST /auth/login`, `POST /venues`, `POST /courts`, `POST /bookings`, `POST /reviews`, `GET /reviews?venueId=` (existing/new HTTP endpoints).

- [x] **Step 1: Write the e2e spec, following `apps/backend/test/venue.e2e-spec.ts`'s setup style (raw repo seeding via `dataSource`, not going through the full booking+payment flow, since booking status/date are exactly what needs to be controlled here)**

```ts
// apps/backend/test/review.e2e-spec.ts
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BookingStatus, Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';
import { Booking } from '../src/booking/entities/booking.entity';

const SEED_PASSWORD = 'Password123!';

describe('Review (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let player: User;
  let playerToken: string;
  let venueId: string;
  let pastConfirmedBookingId: string;
  let pendingBookingId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

    const merchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.PLAYER,
    });

    const venue = await dataSource.getRepository(Venue).save({
      owner: merchant,
      name: 'Sân test review',
      address: '123 Test St',
      lat: 10.762622,
      lng: 106.660172,
      status: 'APPROVED',
    });
    venueId = venue.id;

    const court = await dataSource.getRepository(Court).save({
      venue,
      name: 'Sân 1',
      sport: 'football',
      basePrice: 200_000,
    });

    const pastConfirmed = await dataSource.getRepository(Booking).save({
      court,
      user: player,
      bookingDate: '2020-01-01',
      startTime: '18:00',
      endTime: '19:00',
      status: BookingStatus.CONFIRMED,
      totalAmount: 200_000,
    });
    pastConfirmedBookingId = pastConfirmed.id;

    const pending = await dataSource.getRepository(Booking).save({
      court,
      user: player,
      bookingDate: '2020-01-02',
      startTime: '18:00',
      endTime: '19:00',
      status: BookingStatus.PENDING,
      totalAmount: 200_000,
    });
    pendingBookingId = pending.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD });
    playerToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects creating a review for a non-CONFIRMED booking', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pendingBookingId, rating: 5 })
      .expect(400);
  });

  it('creates a review for a past confirmed booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pastConfirmedBookingId, rating: 5, comment: 'Tuyệt vời' })
      .expect(201);
    expect(res.body.rating).toBe(5);
  });

  it('rejects a second review for the same booking', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId: pastConfirmedBookingId, rating: 3 })
      .expect(400);
  });

  it('lists reviews for the venue with the average rating', async () => {
    const res = await request(app.getHttpServer())
      .get(`/reviews?venueId=${venueId}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.averageRating).toBe(5);
    expect(res.body.items).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run the e2e suite**

```bash
pnpm --filter backend test:e2e review.e2e-spec -- --watchAll=false
```

Expected: PASS (requires local Postgres/Redis up via `docker-compose up -d`, same as other e2e specs).

- [x] **Step 3: Commit**

```bash
git add apps/backend/test/review.e2e-spec.ts
git commit -m "test(backend): add e2e coverage for review creation and listing"
```

---

### Task 8: Regenerate OpenAPI spec + orval client for `packages/shared`

**Files:**
- Modify (generated, do not hand-edit): `openapi.json`, `packages/shared/src/generated/**`

**Interfaces:**
- Produces: `getReviews(axiosInstance)` factory in `packages/shared/src/generated/client.ts` (or the tag-split equivalent) with methods `reviewControllerCreate` / `reviewControllerFindByVenue`, and a `Review` / `VenueReviewsDto` model — consumed by mobile in Tasks 9-10.

- [x] **Step 1: Regenerate the OpenAPI document from the running Nest app definition**

```bash
docker-compose up -d
pnpm --filter backend run swagger:export
```

Expected: `openapi.json` at the repo root is rewritten and now includes the `reviews` tag with `POST /reviews` and `GET /reviews`.

- [x] **Step 2: Regenerate the orval client**

```bash
pnpm run generate:api
```

Expected: `packages/shared/src/generated/` gains a `reviews` client file (or updates `client.ts` in `tags-split` mode) plus model types for `Review` and `VenueReviewsDto`, and `packages/shared/src/generated/mocks` (MSW handlers, since `mock: true` in `orval.config.ts`) is updated too.

- [x] **Step 3: Rebuild the shared package and confirm it compiles**

```bash
pnpm --filter @sportspace/shared run build
```

Expected: PASS.

- [x] **Step 4: Commit the generated diff as-is (no hand-edits)**

```bash
git add openapi.json packages/shared/src/generated packages/shared/dist
git commit -m "chore(shared): regenerate API client for reviews endpoints"
```

---

### Task 9: Mobile — "Đánh giá" (write review) screen, reachable from a past confirmed booking

**Files:**
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Modify: `apps/mobile/src/screens/bookings/MyBookingsScreen.tsx`
- Create: `apps/mobile/src/screens/bookings/WriteReviewScreen.tsx`
- Create: `apps/mobile/src/screens/bookings/__tests__/WriteReviewScreen.test.tsx`

**Interfaces:**
- Consumes: `reviewsApi.reviewControllerCreate({ bookingId, rating, comment })` (generated in Task 8).

- [x] **Step 1: Register the generated reviews client**

```ts
// apps/mobile/src/api/client.ts — add to the import list and export list
import {
  getAuth,
  getBookings,
  getCourts,
  getMatches,
  getNotifications,
  getPayments,
  getReviews,
  getVenues,
} from '@sportspace/shared';
// ...
export const reviewsApi = getReviews(apiClient);
```

- [x] **Step 2: Add the `WriteReview` route param type**

```ts
// apps/mobile/src/navigation/types.ts — extend MyBookingsStackParamList
export type MyBookingsStackParamList = {
  MyBookingsList: undefined;
  CreateMatch: {
    bookingId: string;
    courtName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
  };
  WriteReview: {
    bookingId: string;
    courtName: string;
  };
};
```

- [x] **Step 3: Write the failing screen test**

```tsx
// apps/mobile/src/screens/bookings/__tests__/WriteReviewScreen.test.tsx
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test-utils/server';
import { WriteReviewScreen } from '../WriteReviewScreen';
import type { MyBookingsStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const goBack = jest.fn();
const navigation = { goBack } as unknown as NativeStackNavigationProp<
  MyBookingsStackParamList,
  'WriteReview'
>;

const params = { bookingId: 'booking-1', courtName: 'Sân số 1' };

async function renderScreen() {
  return render(
    <WriteReviewScreen navigation={navigation} route={{ key: 'WriteReview', name: 'WriteReview', params }} />,
  );
}

describe('WriteReviewScreen', () => {
  afterEach(() => {
    goBack.mockClear();
  });

  it('gửi đánh giá thành công gọi đúng API rồi quay lại màn trước', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('*/reviews', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'review-1' }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('write-review-star-4'));
    await user.type(screen.getByTestId('write-review-comment'), 'Sân đẹp');
    await user.press(screen.getByTestId('write-review-submit'));

    expect(capturedBody).toEqual({ bookingId: 'booking-1', rating: 4, comment: 'Sân đẹp' });
    expect(goBack).toHaveBeenCalled();
  });

  it('báo lỗi 400 khi booking đã được đánh giá', async () => {
    server.use(
      http.post('*/reviews', () =>
        HttpResponse.json({ message: 'Booking này đã được đánh giá' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByTestId('write-review-star-5'));
    await user.press(screen.getByTestId('write-review-submit'));

    expect(await screen.findByTestId('write-review-error')).toHaveTextContent(
      'Booking này đã được đánh giá',
    );
  });
});
```

- [x] **Step 4: Run to verify it fails**

```bash
pnpm --filter mobile test WriteReviewScreen -- --watchAll=false
```

Expected: FAIL — `WriteReviewScreen` module not found.

- [x] **Step 5: Implement the screen (mirrors `CreateMatchScreen.tsx`'s structure)**

```tsx
// apps/mobile/src/screens/bookings/WriteReviewScreen.tsx
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAxiosError } from 'axios';
import { reviewsApi } from '../../api/client';
import type { MyBookingsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MyBookingsStackParamList, 'WriteReview'>;

const STARS = [1, 2, 3, 4, 5];

export function WriteReviewScreen({ route, navigation }: Props) {
  const { bookingId, courtName } = route.params;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) {
      setError('Vui lòng chọn số sao đánh giá');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await reviewsApi.reviewControllerCreate({
        bookingId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      navigation.goBack();
    } catch (err) {
      const message = isAxiosError(err) && err.response?.status === 400
        ? (err.response.data as { message?: string })?.message
        : undefined;
      setError(message ?? 'Gửi đánh giá thất bại, vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container} testID="write-review-screen">
      <Text style={styles.title}>Đánh giá {courtName}</Text>
      <View style={styles.stars}>
        {STARS.map((value) => (
          <Pressable key={value} testID={`write-review-star-${value}`} onPress={() => setRating(value)}>
            <Text style={value <= rating ? styles.starActive : styles.starInactive}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        testID="write-review-comment"
        style={styles.input}
        placeholder="Nhận xét (không bắt buộc)"
        value={comment}
        onChangeText={setComment}
        multiline
      />
      {error ? (
        <Text testID="write-review-error" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="write-review-submit"
        style={styles.button}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Gửi đánh giá</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: 8 },
  starActive: { fontSize: 32, color: '#f59e0b' },
  starInactive: { fontSize: 32, color: '#d1d5db' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, minHeight: 80 },
  errorText: { color: '#dc2626' },
  button: { backgroundColor: '#1d4ed8', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
```

- [x] **Step 6: Run to verify it passes**

```bash
pnpm --filter mobile test WriteReviewScreen -- --watchAll=false
```

Expected: PASS.

- [x] **Step 7: Register the screen in the navigator**

```tsx
// apps/mobile/src/navigation/RootNavigator.tsx
// add import:
import { WriteReviewScreen } from '../screens/bookings/WriteReviewScreen';
// add inside the MyBookingsStack.Navigator, after the CreateMatch screen entry:
      <MyBookingsStack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ title: 'Đánh giá sân' }}
      />
```

- [x] **Step 8: Add the "Đánh giá" button to `MyBookingsScreen` for past confirmed bookings**

```tsx
// apps/mobile/src/screens/bookings/MyBookingsScreen.tsx
// add next to the existing `canCreateMatch` computation inside renderItem:
        const canCreateMatch = item.status === BookingStatus.CONFIRMED;
        const canReview =
          item.status === BookingStatus.CONFIRMED && new Date(item.bookingDate) <= new Date();
// add a new button inside styles.cardActions, alongside the existing "Tạo kèo" button:
              {canReview ? (
                <Pressable
                  testID={`booking-review-${item.id}`}
                  style={styles.reviewButton}
                  onPress={() =>
                    navigation.navigate('WriteReview', {
                      bookingId: item.id,
                      courtName: item.court.name,
                    })
                  }
                >
                  <Text style={styles.reviewButtonText}>Đánh giá</Text>
                </Pressable>
              ) : null}
// add to StyleSheet.create:
  reviewButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  reviewButtonText: { color: '#fff', fontWeight: '600' },
```

- [x] **Step 9: Run the full mobile test suite for this screen area**

```bash
pnpm --filter mobile test MyBookingsScreen -- --watchAll=false
pnpm --filter mobile test WriteReviewScreen -- --watchAll=false
```

Expected: PASS for both (existing `MyBookingsScreen.test.tsx` should be unaffected since it doesn't assert on absence of the new button; if it does with a snapshot, update it deliberately, not blindly).

- [x] **Step 10: Commit**

```bash
git add apps/mobile/src/api/client.ts apps/mobile/src/navigation/types.ts apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/screens/bookings/MyBookingsScreen.tsx apps/mobile/src/screens/bookings/WriteReviewScreen.tsx apps/mobile/src/screens/bookings/__tests__/WriteReviewScreen.test.tsx
git commit -m "feat(mobile): add write-review screen reachable from past bookings"
```

---

### Task 10: Mobile — show average rating + review list on `VenueDetailScreen`

**Files:**
- Modify: `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `reviewsApi.reviewControllerFindByVenue(venueId)` → `{ averageRating: number; total: number; items: Review[] }` (generated in Task 8).

- [x] **Step 1: Add a failing test case to the existing spec**

```tsx
// apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx
// add a new `it` alongside the existing ones (reuse whatever venue-mock/server helpers the file already defines):
  it('hiển thị điểm đánh giá trung bình và danh sách đánh giá', async () => {
    server.use(
      http.get('*/reviews', () =>
        HttpResponse.json({
          averageRating: 4.5,
          total: 2,
          items: [
            { id: 'r1', rating: 5, comment: 'Rất tốt', user: { fullName: 'An' } },
            { id: 'r2', rating: 4, comment: 'Ổn', user: { fullName: 'Bình' } },
          ],
        }),
      ),
    );
    await renderScreen();

    expect(await screen.findByTestId('venue-average-rating')).toHaveTextContent('4.5');
    expect(screen.getByTestId('review-item-r1')).toHaveTextContent('Rất tốt');
  });
```

Adjust the mocked `renderScreen`/`server`/`http`/`HttpResponse` imports and the venue-fetch mock setup to match whatever the existing top of this test file already uses (read it first — do not duplicate a second `server` import if one exists).

- [x] **Step 2: Run to verify it fails**

```bash
pnpm --filter mobile test VenueDetailScreen -- --watchAll=false
```

Expected: FAIL — no `venue-average-rating` / `review-item-r1` testIDs rendered yet.

- [x] **Step 3: Extend the screen to fetch and render reviews**

```tsx
// apps/mobile/src/screens/venues/VenueDetailScreen.tsx
// add import:
import type { VenueReviewsDto } from '@sportspace/shared';
import { reviewsApi, venuesApi } from '../../api/client';

// inside VenueDetailScreen, add state + a second fetch alongside fetchVenue:
  const [reviews, setReviews] = useState<VenueReviewsDto | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const { data } = await reviewsApi.reviewControllerFindByVenue(venueId);
      setReviews(data);
    } catch {
      // Điểm đánh giá không phải dữ liệu bắt buộc để xem sân — lỗi ở đây không chặn màn hình.
    }
  }, [venueId]);

  useEffect(() => {
    void fetchVenue();
    void fetchReviews();
  }, [fetchVenue, fetchReviews]);

// inside the header block, after the description:
      {reviews && reviews.total > 0 ? (
        <View testID="venue-average-rating" style={styles.ratingRow}>
          <Text style={styles.ratingValue}>{reviews.averageRating.toFixed(1)} ★</Text>
          <Text style={styles.ratingCount}>({reviews.total} đánh giá)</Text>
        </View>
      ) : null}

// after the courts FlatList (or wrapped together — keep whatever layout container the file already uses), render the review list:
      {reviews && reviews.items.length > 0 ? (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsTitle}>Đánh giá</Text>
          {reviews.items.map((review) => (
            <View key={review.id} testID={`review-item-${review.id}`} style={styles.reviewItem}>
              <Text style={styles.reviewRating}>{review.rating} ★</Text>
              {review.comment ? <Text>{review.comment}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

// add to StyleSheet.create:
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingHorizontal: 16 },
  ratingValue: { fontSize: 16, fontWeight: '700', color: '#f59e0b' },
  ratingCount: { color: '#777' },
  reviewsSection: { padding: 16, gap: 8 },
  reviewsTitle: { fontSize: 16, fontWeight: '700' },
  reviewItem: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, gap: 2 },
  reviewRating: { color: '#f59e0b', fontWeight: '600' },
```

- [x] **Step 4: Run to verify it passes**

```bash
pnpm --filter mobile test VenueDetailScreen -- --watchAll=false
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/venues/VenueDetailScreen.tsx apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx
git commit -m "feat(mobile): show venue average rating and review list"
```

---

## Self-Review Notes

- **Spec coverage:** FR-P11 (rate/comment a venue) is covered end-to-end: eligibility-checked creation (Task 4), average rating + list (Task 5-6), client generation (Task 8), write UI gated on a real past booking (Task 9), display on the venue page (Task 10).
- **Consistency check:** `VenueReviewsDto` field names (`averageRating`, `total`, `items`) are identical across Task 3 (DTO definition), Task 5 (service), Task 6 (controller test), Task 10 (mobile consumption) — verified no drift.
- **Out of scope (flagged, not silently dropped):** merchant-side reply-to-review, review moderation/reporting, and photo attachments are not in FR-P11 as scoped by the report and are not built here — call this out if the report's grading rubric expects them.

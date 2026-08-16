# Listing Screens: Pagination, Search & Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side pagination, search, and filtering to all 7 admin/merchant listing screens (Users, Admin Venues, Disputes, Merchant Bookings, Merchant Venues, Courts, Staff), replacing today's "fetch everything, filter nowhere" behavior.

**Architecture:** Every affected backend endpoint gains a query DTO (extending a shared `PaginationQueryDto`) and returns `{ data: T[], meta: {...} }` instead of a bare array, built via TypeORM `createQueryBuilder()` with `ILIKE` search and `.skip()/.take()`. The web app gets 3 reusable client components (`SearchInput`, `FilterSelect`, `Pagination`) that read/write the URL's query string; each Server Component page forwards `searchParams` to the API call and renders these controls.

**Tech Stack:** NestJS 11 + TypeORM (Postgres) on the backend; Next.js 16 App Router + React 19 + Vitest on `apps/web`; `@sportspace/shared` (orval-generated API client) as the contract between them.

**Design doc:** `docs/superpowers/specs/2026-08-14-listing-pagination-search-filter-design.md`

## Global Constraints

- TypeScript strict; `camelCase` vars/functions, `PascalCase` classes/types (CLAUDE.md §10).
- Every git commit message must be in Vietnamese, with **zero** mentions of AI/Claude/Co-Authored-By trailers (standing project rule).
- No hand-written DB migrations — always generate via `pnpm run migration:generate` from `apps/backend` (CLAUDE.md §0.2).
- Backend query/response shape changes are breaking — every existing e2e test asserting `res.body` as a bare array on a touched endpoint must be updated to `res.body.data` in the same task that changes that endpoint.
- TDD: for every backend service/DTO behavior change, write the failing test before the implementation (CLAUDE.md §11, `test-driven-development` skill).
- Frontend has no browser-automation test suite in this repo; each frontend wiring task's manual-verification step (run `pnpm dev` in `apps/web`, exercise the screen) is mandatory before marking the task done, per CLAUDE.md's UI-testing rule.
- New DTOs/decorators are hand-written business code (not CLI-scaffolded) — consistent with existing DTOs like `apps/backend/src/venue/dto/find-venues-query.dto.ts`.

---

## File Structure

**Backend — new shared infra:**
- `apps/backend/src/common/dto/pagination-query.dto.ts` — base query DTO (`page`, `limit`, clamped)
- `apps/backend/src/common/dto/paginated.dto.ts` — `PaginationMetaDto` + generic `PaginatedDto<T>`
- `apps/backend/src/common/pagination.util.ts` — `buildPaginationMeta(total, page, limit)`
- `apps/backend/src/common/decorators/api-paginated-response.decorator.ts` — `ApiPaginatedResponse(Model)` Swagger decorator

**Backend — province feature:**
- `packages/shared/src/constants/provinces.ts` — canonical `VIETNAM_PROVINCES` list
- `apps/backend/src/venue/entities/venue.entity.ts` — modified (+ `province` column)
- `apps/backend/src/database/migrations/*-AddProvinceToVenues.ts` — generated
- `apps/backend/src/venue/dto/create-venue.dto.ts`, `update-venue.dto.ts` — modified

**Backend — per-resource query DTOs (new) + services/controllers (modified):**
- `apps/backend/src/user/dto/find-users-query.dto.ts`
- `apps/backend/src/venue/dto/admin-venues-query.dto.ts` (modified)
- `apps/backend/src/venue/dto/merchant-venues-query.dto.ts`
- `apps/backend/src/venue/dto/find-courts-query.dto.ts`
- `apps/backend/src/dispute/dto/find-disputes-query.dto.ts`
- `apps/backend/src/booking/dto/merchant-bookings-query.dto.ts`
- `apps/backend/src/staff/dto/find-staff-query.dto.ts`

**Frontend — new shared components:**
- `apps/web/src/components/list/list-query.ts` — `withParam()` URL helper
- `apps/web/src/components/list/search-input.tsx`
- `apps/web/src/components/list/filter-select.tsx`
- `apps/web/src/components/list/pagination.tsx`

**Frontend — modified pages:**
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/venues/page.tsx`
- `apps/web/src/app/admin/disputes/page.tsx`
- `apps/web/src/app/merchant/bookings/page.tsx`
- `apps/web/src/app/merchant/venues/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/staff/page.tsx`
- `apps/web/src/app/merchant/venues/new/venue-form.tsx`, `actions.ts` (province select)

---

### Task 1: Shared backend pagination infra

**Files:**
- Create: `apps/backend/src/common/dto/pagination-query.dto.ts`
- Create: `apps/backend/src/common/dto/paginated.dto.ts`
- Create: `apps/backend/src/common/pagination.util.ts`
- Create: `apps/backend/src/common/decorators/api-paginated-response.decorator.ts`
- Test: `apps/backend/src/common/pagination.util.spec.ts`

**Interfaces:**
- Produces: `PaginationQueryDto { page: number; limit: number }` (both default-valued, clamped via `@Transform`, never throw validation errors on malformed input). `PaginationMetaDto { total: number; page: number; limit: number; totalPages: number }`. `PaginatedDto<T> { data: T[]; meta: PaginationMetaDto }`. `buildPaginationMeta(total: number, page: number, limit: number): PaginationMetaDto`. `ApiPaginatedResponse<TModel>(model: TModel)` — method decorator, used as `@ApiPaginatedResponse(User)` in place of `@ApiOkResponse({ type: [User] })`.
- Every later backend task consumes these four exports.

- [ ] **Step 1: Write the failing test for `buildPaginationMeta`**

```typescript
// apps/backend/src/common/pagination.util.spec.ts
import { buildPaginationMeta } from './pagination.util';

describe('buildPaginationMeta', () => {
  it('rounds totalPages up from total/limit', () => {
    expect(buildPaginationMeta(45, 2, 20)).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it('returns totalPages=1 when there are zero results, never zero', () => {
    expect(buildPaginationMeta(0, 1, 20)).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm jest pagination.util.spec.ts`
Expected: FAIL — `Cannot find module './pagination.util'`

- [ ] **Step 3: Implement pagination infra**

```typescript
// apps/backend/src/common/pagination.util.ts
import { PaginationMetaDto } from './dto/paginated.dto';

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMetaDto {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

```typescript
// apps/backend/src/common/dto/paginated.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedDto<T> {
  data: T[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
```

```typescript
// apps/backend/src/common/dto/pagination-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

function toPage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function toLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(Math.floor(n), 100);
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Transform(({ value }) => toPage(value))
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(({ value }) => toLimit(value))
  limit: number = 20;
}
```

```typescript
// apps/backend/src/common/decorators/api-paginated-response.decorator.ts
import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedDto, PaginationMetaDto } from '../dto/paginated.dto';

export function ApiPaginatedResponse<TModel extends Type<unknown>>(
  model: TModel,
) {
  return applyDecorators(
    ApiExtraModels(PaginatedDto, PaginationMetaDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
}
```

Note: a `page` beyond `totalPages` is not an error — the query simply returns an empty `data` array with an accurate `meta` (the frontend `Pagination` component disables "Next" once `page >= totalPages`, so this only happens via a stale/hand-edited URL).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm jest pagination.util.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/common
git commit -m "feat(backend): thêm hạ tầng phân trang dùng chung (PaginationQueryDto, PaginatedDto, ApiPaginatedResponse)"
```

---

### Task 2: `province` field on Venue (schema + shared constant)

**Files:**
- Create: `packages/shared/src/constants/provinces.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/backend/src/venue/entities/venue.entity.ts`
- Modify: `apps/backend/src/venue/dto/create-venue.dto.ts`
- Create (via CLI): `apps/backend/src/database/migrations/*-AddProvinceToVenues.ts`
- Test: `apps/backend/test/venue.e2e-spec.ts` (add one case)

**Interfaces:**
- Produces: `VIETNAM_PROVINCES: readonly string[]` exported from `@sportspace/shared`. `Venue.province: string | null`. `CreateVenueDto.province: string` (required, `@IsIn(VIETNAM_PROVINCES)`).
- Consumed by: Task 4 (admin filter), Task 13 (merchant venue-creation form + admin page wiring).

- [ ] **Step 1: Research and write the canonical province list**

Vietnam's provincial map changed in the July 2025 administrative merger (63 → 34 units: 28 provinces + 6 centrally-governed cities). Before writing the file, run a web search (`WebSearch` tool) for "danh sách 34 tỉnh thành Việt Nam sau sáp nhập 2025 chính thức" and cross-check against at least one official/government source, since this list is used for `@IsIn` validation on every new venue going forward and must be accurate.

```typescript
// packages/shared/src/constants/provinces.ts
// Danh sách 34 đơn vị hành chính cấp tỉnh của Việt Nam sau đợt sáp nhập
// 01/07/2025 (28 tỉnh + 6 thành phố trực thuộc trung ương). Xác nhận lại
// nguồn chính thức nếu danh sách được cập nhật.
export const VIETNAM_PROVINCES = [
  // Populate with the verified 34-item list from Step 1's research.
] as const;

export type VietnamProvince = (typeof VIETNAM_PROVINCES)[number];
```

(This step's deliverable is the fully populated array — do not leave it empty. The comment above documents the sourcing requirement; the array itself must contain the real, verified 34 names before moving on.)

- [ ] **Step 2: Export the constant from `@sportspace/shared`**

```typescript
// apps/backend/../../packages/shared/src/index.ts — add this line
// near the other non-generated exports at the top of the file:
export * from './constants/provinces';
```

Run: `cd packages/shared && pnpm build`
Expected: builds with no errors; `VIETNAM_PROVINCES` importable from `@sportspace/shared`.

- [ ] **Step 3: Write the failing e2e test for province validation**

```typescript
// apps/backend/test/venue.e2e-spec.ts — add inside the existing
// 'Venue + Court (e2e)' describe block, near the other POST /venues tests
it('rejects creating a venue with a province not in the canonical list (400)', async () => {
  await request(app.getHttpServer())
    .post('/venues')
    .set('Authorization', `Bearer ${merchantToken}`)
    .send({
      name: 'Sân test tỉnh không hợp lệ',
      address: '123 Test',
      lat: 21.0285,
      lng: 105.8542,
      province: 'Không Tồn Tại',
    })
    .expect(400);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: FAIL — request succeeds with 201 (no `province` validation exists yet)

- [ ] **Step 5: Add the entity column, migration, and DTO validation**

```typescript
// apps/backend/src/venue/entities/venue.entity.ts — add after `description`
  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'varchar', nullable: true })
  province: string | null;
```

```typescript
// apps/backend/src/venue/dto/create-venue.dto.ts — full file
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VIETNAM_PROVINCES } from '@sportspace/shared';
import { IsIn, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class CreateVenueDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsLatitude()
  lat: number;

  @ApiProperty()
  @IsLongitude()
  lng: number;

  @ApiProperty({ enum: VIETNAM_PROVINCES })
  @IsIn(VIETNAM_PROVINCES)
  province: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

`UpdateVenueDto` already extends `PartialType(CreateVenueDto)`, so `province` becomes optional there automatically — no change needed.

Run migration generation (do not hand-write the SQL):

Run: `cd apps/backend && pnpm run migration:generate src/database/migrations/AddProvinceToVenues`
Expected: a new file `src/database/migrations/<timestamp>-AddProvinceToVenues.ts` is created, adding a nullable `province` varchar column to `venues`.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/backend && pnpm run migration:run && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: PASS, including the new 400 case. (Existing "create venue" tests elsewhere in the suite that `POST /venues` without a `province` field will now start failing 400 instead of 201 — fix each by adding a valid `province` value, e.g. any entry from `VIETNAM_PROVINCES`, to their request bodies. Search across the whole e2e suite: `grep -rn "post('/venues')" apps/backend/test/`.)

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add ../../packages/shared/src/constants/provinces.ts \
  ../../packages/shared/src/index.ts src/venue/entities/venue.entity.ts \
  src/venue/dto/create-venue.dto.ts src/database/migrations test/
git commit -m "feat(backend): thêm trường tỉnh/thành cho cụm sân, validate theo danh sách chuẩn"
```

---

### Task 3: Users list — search, filter, paginate

**Files:**
- Create: `apps/backend/src/user/dto/find-users-query.dto.ts`
- Modify: `apps/backend/src/user/user.service.ts`
- Modify: `apps/backend/src/user/user.controller.ts`
- Test: `apps/backend/test/user.e2e-spec.ts`

**Interfaces:**
- Consumes: `PaginationQueryDto`, `PaginatedDto<T>`, `buildPaginationMeta`, `ApiPaginatedResponse` from Task 1.
- Produces: `GET /users` now returns `PaginatedDto<User>` (`{ data: User[], meta }`) instead of `User[]`. Query params: `page`, `limit`, `q` (matches `fullName`/`email`), `role` (`Role` enum), `isLocked` (`"true"`/`"false"` string).

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// apps/backend/test/user.e2e-spec.ts — inside 'User admin (e2e)', replace
// the existing 'lets an ADMIN list users, lock, and unlock a player' body's
// list assertion, and add new tests alongside it:
it('lets an ADMIN list users, lock, and unlock a player', async () => {
  const listRes = await request(app.getHttpServer())
    .get('/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  expect(
    listRes.body.data.some((u: { id: string }) => u.id === player.id),
  ).toBe(true);
  expect(listRes.body.meta).toMatchObject({ page: 1, limit: 20 });

  // ... rest of the existing test body unchanged (lock/unlock flow) ...
});

it('filters the user list by role', async () => {
  const res = await request(app.getHttpServer())
    .get('/users')
    .query({ role: Role.ADMIN })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(res.body.data.every((u: { role: string }) => u.role === Role.ADMIN)).toBe(true);
  expect(res.body.data.some((u: { id: string }) => u.id === player.id)).toBe(false);
});

it('searches the user list by fullName or email', async () => {
  const res = await request(app.getHttpServer())
    .get('/users')
    .query({ q: player.email })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([player.id]);
});

it('paginates the user list', async () => {
  const res = await request(app.getHttpServer())
    .get('/users')
    .query({ page: 1, limit: 1 })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(res.body.data).toHaveLength(1);
  expect(res.body.meta.limit).toBe(1);
  expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test:e2e -- user.e2e-spec.ts`
Expected: FAIL — `res.body.data` is `undefined` (endpoint still returns a bare array)

- [ ] **Step 3: Implement the query DTO, service, and controller**

```typescript
// apps/backend/src/user/dto/find-users-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: '"true" hoặc "false"' })
  @IsOptional()
  @IsBooleanString()
  isLocked?: string;
}
```

```typescript
// apps/backend/src/user/user.service.ts — replace findAll and imports
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { buildPaginationMeta } from '../common/pagination.util';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken });
  }

  async findAll(query: FindUsersQueryDto): Promise<PaginatedDto<User>> {
    const { page, limit, q, role, isLocked } = query;
    const qb = this.userRepo
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (q?.trim()) {
      qb.andWhere('(user.fullName ILIKE :q OR user.email ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }
    if (role) {
      qb.andWhere('user.role = :role', { role });
    }
    if (isLocked !== undefined) {
      qb.andWhere('user.isLocked = :isLocked', {
        isLocked: isLocked === 'true',
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async setLocked(userId: string, isLocked: boolean): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    user.isLocked = isLocked;
    return this.userRepo.save(user);
  }
}
```

```typescript
// apps/backend/src/user/user.controller.ts — replace the findAll method
// and its imports (add FindUsersQueryDto, PaginatedDto, ApiPaginatedResponse, Query)
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách người dùng (tìm kiếm, lọc, phân trang)' })
  @ApiPaginatedResponse(User)
  findAll(@Query() query: FindUsersQueryDto): Promise<PaginatedDto<User>> {
    return this.userService.findAll(query);
  }
```

(Add `Query` to the `@nestjs/common` import list, and import `FindUsersQueryDto` from `./dto/find-users-query.dto'`, `PaginatedDto` from `'../common/dto/paginated.dto'`, `ApiPaginatedResponse` from `'../common/decorators/api-paginated-response.decorator'`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- user.e2e-spec.ts`
Expected: PASS (all cases, including the 3 new ones)

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/user test/user.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm, lọc theo vai trò/trạng thái khóa và phân trang cho danh sách người dùng"
```

---

### Task 4: Admin Venues list — search, status filter (selectable), province filter, paginate

**Files:**
- Modify: `apps/backend/src/venue/dto/admin-venues-query.dto.ts`
- Modify: `apps/backend/src/venue/venue.service.ts`
- Modify: `apps/backend/src/venue/admin.controller.ts`
- Test: `apps/backend/test/admin.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra; `VIETNAM_PROVINCES`/`province` field from Task 2.
- Produces: `GET /admin/venues` returns `PaginatedDto<Venue>`. `status` query param accepts `VenueStatus | 'ALL'` (omitted → defaults to `PENDING`, preserving current behavior). New `GET /admin/venues/provinces` returns `string[]` of distinct provinces currently in use (for the filter dropdown).

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// apps/backend/test/admin.e2e-spec.ts — replace the two existing list
// assertions' `res.body as Venue[]` with `res.body.data as Venue[]`
// (lines "defaults to PENDING only..." and "honors an explicit ?status=
// query" and "returns the owner field..." — change `res.body` to
// `res.body.data` in all three). Then add:
it('lists every status when ?status=ALL', async () => {
  const res = await request(app.getHttpServer())
    .get('/admin/venues')
    .query({ status: 'ALL' })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  const ids = (res.body.data as Venue[]).map((v) => v.id);
  expect(ids).toEqual(
    expect.arrayContaining([pendingVenue.id, approvedVenue.id, rejectedVenue.id]),
  );
});

it('searches venues by name, address, or owner', async () => {
  const res = await request(app.getHttpServer())
    .get('/admin/venues')
    .query({ status: 'ALL', q: pendingVenue.name })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  const ids = (res.body.data as Venue[]).map((v) => v.id);
  expect(ids).toEqual([pendingVenue.id]);
});

it('lists the distinct provinces currently in use', async () => {
  const res = await request(app.getHttpServer())
    .get('/admin/venues/provinces')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);

  expect(Array.isArray(res.body)).toBe(true);
  expect(res.body).toContain(pendingVenue.province);
});
```

(`pendingVenue`/`approvedVenue`/`rejectedVenue` are the fixtures already seeded in this file's `beforeAll` — check their current `POST /venues` creation calls include a valid `province`, adding one if Task 2's step 6 didn't already touch this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test:e2e -- admin.e2e-spec.ts`
Expected: FAIL — `res.body.data` undefined on existing tests; `?status=ALL` and `/provinces` cases fail/404

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/venue/dto/admin-venues-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(VenueStatus), 'ALL'] as const;

export class AdminVenuesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL, default: VenueStatus.PENDING })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: VenueStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo tên, địa chỉ, hoặc chủ sở hữu' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Lọc theo tỉnh/thành' })
  @IsOptional()
  @IsString()
  province?: string;
}
```

```typescript
// apps/backend/src/venue/venue.service.ts — add these methods (keep the
// rest of the class as-is), and add PaginatedDto/buildPaginationMeta/
// AdminVenuesQueryDto/MerchantVenuesQueryDto imports at the top:
  //
  // Deliberately does NOT .leftJoinAndSelect('venue.courts', 'courts'): a
  // one-to-many join combined with .skip()/.take() operates on the
  // flattened venue×court row set, not on distinct venues — a venue with
  // multiple courts can make a page return fewer than `limit` distinct
  // venues or split its courts across the LIMIT window. The admin venues
  // list UI doesn't read `venue.courts`, so it's dropped from this query
  // rather than worked around.
  async findAllForAdmin(query: AdminVenuesQueryDto): Promise<PaginatedDto<Venue>> {
    const { page, limit, q, province } = query;
    const status = query.status ?? VenueStatus.PENDING;

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .leftJoinAndSelect('venue.owner', 'owner')
      .orderBy('venue.createdAt', 'DESC');

    if (status !== 'ALL') {
      qb.andWhere('venue.status = :status', { status });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(venue.name ILIKE :q OR venue.address ILIKE :q OR owner.fullName ILIKE :q OR owner.email ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }
    if (province?.trim()) {
      qb.andWhere('venue.province = :province', { province: province.trim() });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }

  async listDistinctProvinces(): Promise<string[]> {
    const rows = await this.venueRepo
      .createQueryBuilder('venue')
      .select('DISTINCT venue.province', 'province')
      .where('venue.province IS NOT NULL')
      .orderBy('venue.province', 'ASC')
      .getRawMany<{ province: string }>();
    return rows.map((r) => r.province);
  }
```

Remove the old `findAllForAdmin(status: VenueStatus)` implementation entirely (replaced by the one above).

```typescript
// apps/backend/src/venue/admin.controller.ts — full file
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { VenueService } from './venue.service';
import { AdminVenuesQueryDto } from './dto/admin-venues-query.dto';
import { Venue } from './entities/venue.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginatedDto } from '../common/dto/paginated.dto';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly venueService: VenueService) {}

  @Get('venues')
  @ApiOperation({
    summary: 'Danh sách cụm sân (tìm kiếm/lọc theo trạng thái, tỉnh/thành, phân trang)',
  })
  @ApiPaginatedResponse(Venue)
  getVenues(@Query() query: AdminVenuesQueryDto): Promise<PaginatedDto<Venue>> {
    return this.venueService.findAllForAdmin(query);
  }

  @Get('venues/provinces')
  @ApiOperation({ summary: 'Danh sách tỉnh/thành đang có cụm sân (cho bộ lọc)' })
  @ApiOkResponse({ type: [String] })
  getVenueProvinces(): Promise<string[]> {
    return this.venueService.listDistinctProvinces();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- admin.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/venue/dto/admin-venues-query.dto.ts \
  src/venue/venue.service.ts src/venue/admin.controller.ts test/admin.e2e-spec.ts
git commit -m "feat(backend): cho phép admin lọc cụm sân theo trạng thái/tỉnh thành, tìm kiếm và phân trang"
```

---

### Task 5: Disputes list — search, selectable status filter, paginate

**Files:**
- Create: `apps/backend/src/dispute/dto/find-disputes-query.dto.ts`
- Modify: `apps/backend/src/dispute/dispute.service.ts`
- Modify: `apps/backend/src/dispute/dispute.controller.ts`
- Test: `apps/backend/test/dispute.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra.
- Produces: `GET /disputes` returns `PaginatedDto<Dispute>`; `status` accepts `DisputeStatus | 'ALL'` (omitted → defaults to `OPEN`).

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// apps/backend/test/dispute.e2e-spec.ts — add near the existing
// 'rejects a non-ADMIN listing disputes' test. Check this file's beforeAll
// for the exact fixture/token variable names it already uses (adminToken,
// the created dispute's id, its raisedBy user) before wiring these in:
it('lists only OPEN disputes by default, and everything with ?status=ALL', async () => {
  const openOnly = await request(app.getHttpServer())
    .get('/disputes')
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  expect(
    openOnly.body.data.every((d: { status: string }) => d.status === DisputeStatus.OPEN),
  ).toBe(true);

  const all = await request(app.getHttpServer())
    .get('/disputes')
    .query({ status: 'ALL' })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  expect(all.body.data.length).toBeGreaterThanOrEqual(openOnly.body.data.length);
});

it('searches disputes by reason text', async () => {
  const res = await request(app.getHttpServer())
    .get('/disputes')
    .query({ status: 'ALL', q: 'not-a-real-reason-substring-xyz' })
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  expect(res.body.data).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test:e2e -- dispute.e2e-spec.ts`
Expected: FAIL — `res.body.data` is `undefined`

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/dispute/dto/find-disputes-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(DisputeStatus), 'ALL'] as const;

export class FindDisputesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL, default: DisputeStatus.OPEN })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: DisputeStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo lý do hoặc người khiếu nại' })
  @IsOptional()
  @IsString()
  q?: string;
}
```

```typescript
// apps/backend/src/dispute/dispute.service.ts — replace findAll and its
// imports (add PaginatedDto, buildPaginationMeta, FindDisputesQueryDto)
  async findAll(query: FindDisputesQueryDto): Promise<PaginatedDto<Dispute>> {
    const { page, limit, q } = query;
    const status = query.status ?? DisputeStatus.OPEN;

    const qb = this.disputeRepo
      .createQueryBuilder('dispute')
      .leftJoinAndSelect('dispute.booking', 'booking')
      .leftJoinAndSelect('dispute.raisedBy', 'raisedBy')
      .orderBy('dispute.createdAt', 'DESC');

    if (status !== 'ALL') {
      qb.andWhere('dispute.status = :status', { status });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(dispute.reason ILIKE :q OR raisedBy.fullName ILIKE :q OR raisedBy.email ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
```

```typescript
// apps/backend/src/dispute/dispute.controller.ts — replace the findAll
// method (add Query import already present; add FindDisputesQueryDto,
// PaginatedDto, ApiPaginatedResponse imports)
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách khiếu nại (tìm kiếm/lọc/phân trang)' })
  @ApiPaginatedResponse(Dispute)
  findAll(@Query() query: FindDisputesQueryDto): Promise<PaginatedDto<Dispute>> {
    return this.disputeService.findAll(query);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- dispute.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/dispute test/dispute.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm, lọc trạng thái và phân trang cho danh sách khiếu nại"
```

---

### Task 6: Merchant Bookings list — search, status/venue/date filters, paginate

**Files:**
- Create: `apps/backend/src/booking/dto/merchant-bookings-query.dto.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Modify: `apps/backend/src/booking/merchant.controller.ts`
- Test: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra.
- Produces: `GET /merchant/bookings` returns `PaginatedDto<Booking>`. Query: `page`, `limit`, `q` (customer name/email or court name), `status` (`BookingStatus | 'ALL'`; omitted → `PENDING`+`CONFIRMED` combined), `venueId`, `from`/`to` (bookingDate range, `YYYY-MM-DD`).

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// apps/backend/test/booking.e2e-spec.ts — inside the existing
// 'GET /merchant/bookings' describe block, update the two existing tests'
// `res.body as { id: string }[]` to `res.body.data as { id: string }[]`,
// then add:
it('excludes CANCELLED bookings by default but includes them with ?status=ALL', async () => {
  const createRes = await request(app.getHttpServer())
    .post('/bookings')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      courtId: court.id,
      bookingDate: '2026-09-12',
      startTime: '08:00',
      endTime: '09:00',
    })
    .expect(201);
  createdBookingIds.push(createRes.body.id);
  await request(app.getHttpServer())
    .post(`/bookings/${createRes.body.id}/cancel`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const defaultRes = await request(app.getHttpServer())
    .get('/merchant/bookings')
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  expect(
    (defaultRes.body.data as { id: string }[]).map((b) => b.id),
  ).not.toContain(createRes.body.id);

  const allRes = await request(app.getHttpServer())
    .get('/merchant/bookings')
    .query({ status: 'ALL' })
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  expect(
    (allRes.body.data as { id: string }[]).map((b) => b.id),
  ).toContain(createRes.body.id);
});

it('filters merchant bookings by date range', async () => {
  const res = await request(app.getHttpServer())
    .get('/merchant/bookings')
    .query({ status: 'ALL', from: '2099-01-01', to: '2099-01-02' })
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  expect(res.body.data).toHaveLength(0);
});
```

(Check this file's existing cancel-endpoint route — if it differs from `POST /bookings/:id/cancel`, use the actual route already exercised elsewhere in this spec file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: FAIL — `res.body.data` undefined

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/booking/dto/merchant-bookings-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@sportspace/shared';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(BookingStatus), 'ALL'] as const;

export class MerchantBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: BookingStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo tên/email khách hoặc tên sân' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ description: 'Từ ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Đến ngày (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

```typescript
// apps/backend/src/booking/booking.service.ts — replace findAllForMerchant
// and add PaginatedDto/buildPaginationMeta/MerchantBookingsQueryDto imports
  async findAllForMerchant(
    merchantId: string,
    query: MerchantBookingsQueryDto,
  ): Promise<PaginatedDto<Booking>> {
    const { page, limit, q, venueId, from, to } = query;

    const qb = this.bookingRepo
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.court', 'court')
      .leftJoinAndSelect('booking.user', 'user')
      .innerJoin('court.venue', 'venue')
      .where('venue.owner = :merchantId', { merchantId })
      .orderBy('booking.createdAt', 'DESC');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('booking.status = :status', { status: query.status });
    } else if (!query.status) {
      qb.andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      });
    }
    if (q?.trim()) {
      qb.andWhere(
        '(user.fullName ILIKE :q OR user.email ILIKE :q OR court.name ILIKE :q)',
        { q: `%${q.trim()}%` },
      );
    }
    if (venueId) {
      qb.andWhere('venue.id = :venueId', { venueId });
    }
    if (from) {
      qb.andWhere('booking.bookingDate >= :from', { from });
    }
    if (to) {
      qb.andWhere('booking.bookingDate <= :to', { to });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
```

```typescript
// apps/backend/src/booking/merchant.controller.ts — replace getBookings
// (add Query already imported; add MerchantBookingsQueryDto, PaginatedDto,
// ApiPaginatedResponse imports)
  @Get('bookings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Danh sách đơn đặt sân trên các cụm sân của chủ sân hiện tại (tìm kiếm/lọc/phân trang)',
  })
  @ApiPaginatedResponse(Booking)
  getBookings(
    @CurrentUser('id') merchantId: string,
    @Query() query: MerchantBookingsQueryDto,
  ): Promise<PaginatedDto<Booking>> {
    return this.bookingService.findAllForMerchant(merchantId, query);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/booking test/booking.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm, lọc trạng thái/khoảng ngày và phân trang cho đơn đặt sân của chủ sân"
```

---

### Task 7: Merchant Venues list — search, status filter, paginate

**Files:**
- Create: `apps/backend/src/venue/dto/merchant-venues-query.dto.ts`
- Modify: `apps/backend/src/venue/venue.service.ts`
- Modify: `apps/backend/src/booking/merchant.controller.ts`
- Test: `apps/backend/test/merchant.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra.
- Produces: `GET /merchant/venues` returns `PaginatedDto<Venue>`. Query: `page`, `limit`, `q`, `status` (`VenueStatus | 'ALL'`, omitted → no filter).

- [ ] **Step 1: Write the failing e2e tests**

```typescript
// apps/backend/test/merchant.e2e-spec.ts — update the existing
// "returns only the calling merchant's own venues..." test's two
// `res.body as Venue[]` / `otherRes.body as Venue[]` to
// `res.body.data as Venue[]` / `otherRes.body.data as Venue[]`. Then add:
it('searches the merchant\'s own venues by name', async () => {
  const res = await request(app.getHttpServer())
    .get('/merchant/venues')
    .query({ q: merchantVenue.name })
    .set('Authorization', `Bearer ${merchantToken}`)
    .expect(200);
  expect((res.body.data as Venue[]).map((v) => v.id)).toEqual([merchantVenue.id]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test:e2e -- merchant.e2e-spec.ts`
Expected: FAIL — `res.body.data` undefined

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/venue/dto/merchant-venues-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueStatus } from '@sportspace/shared';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const STATUS_OR_ALL = [...Object.values(VenueStatus), 'ALL'] as const;

export class MerchantVenuesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STATUS_OR_ALL })
  @IsOptional()
  @IsIn(STATUS_OR_ALL)
  status?: VenueStatus | 'ALL';

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc địa chỉ' })
  @IsOptional()
  @IsString()
  q?: string;
}
```

```typescript
// apps/backend/src/venue/venue.service.ts — replace findByOwner
  //
  // Deliberately does NOT .leftJoinAndSelect('venue.courts', 'courts'): a
  // one-to-many join combined with .skip()/.take() operates on the
  // flattened venue×court row set, not on distinct venues — a venue with
  // multiple courts can make a page return fewer than `limit` distinct
  // venues or split its courts across the LIMIT window. Neither the
  // merchant nor admin venues list UI reads `venue.courts`, so it's
  // dropped from this query rather than worked around.
  async findByOwner(
    ownerId: string,
    query: MerchantVenuesQueryDto,
  ): Promise<PaginatedDto<Venue>> {
    const { page, limit, q } = query;

    const qb = this.venueRepo
      .createQueryBuilder('venue')
      .where('venue.owner = :ownerId', { ownerId })
      .orderBy('venue.createdAt', 'DESC');

    if (query.status && query.status !== 'ALL') {
      qb.andWhere('venue.status = :status', { status: query.status });
    }
    if (q?.trim()) {
      qb.andWhere('(venue.name ILIKE :q OR venue.address ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
```

(Import `MerchantVenuesQueryDto` alongside `AdminVenuesQueryDto` at the top of `venue.service.ts` — both DTOs were already imported for Task 4.)

```typescript
// apps/backend/src/booking/merchant.controller.ts — replace getVenues
// (add MerchantVenuesQueryDto import from '../venue/dto/merchant-venues-query.dto')
  @Get('venues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Danh sách cụm sân của chủ sân hiện tại (tìm kiếm/lọc/phân trang)' })
  @ApiPaginatedResponse(Venue)
  getVenues(
    @CurrentUser('id') merchantId: string,
    @Query() query: MerchantVenuesQueryDto,
  ): Promise<PaginatedDto<Venue>> {
    return this.venueService.findByOwner(merchantId, query);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test:e2e -- merchant.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/venue/dto/merchant-venues-query.dto.ts \
  src/venue/venue.service.ts src/booking/merchant.controller.ts test/merchant.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm, lọc trạng thái và phân trang cho danh sách cụm sân của chủ sân"
```

---

### Task 8: Courts list — search, paginate

**Files:**
- Create: `apps/backend/src/venue/dto/find-courts-query.dto.ts`
- Modify: `apps/backend/src/venue/court.service.ts`
- Modify: `apps/backend/src/venue/court.controller.ts`
- Test: `apps/backend/test/venue.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra.
- Produces: `GET /courts` returns `PaginatedDto<Court>`. Query: `page`, `limit`, `venueId`, `q` (matches `name` or `sport`).

- [ ] **Step 1: Write the failing e2e test**

```typescript
// apps/backend/test/venue.e2e-spec.ts — find the existing test(s) that call
// GET /courts and assert on the array shape (search this file for
// ".get('/courts')" with a query object, not the /slots sub-route); update
// their `res.body` to `res.body.data`. Then add, inside the same describe
// block that already has `courtId`/`venueId` fixtures:
it('searches courts by name or sport, scoped to a venue, and paginates', async () => {
  const res = await request(app.getHttpServer())
    .get('/courts')
    .query({ venueId, q: 'not-a-real-court-name-xyz' })
    .expect(200);
  expect(res.body.data).toHaveLength(0);
  expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: FAIL — `res.body.data` undefined

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/venue/dto/find-courts-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindCourtsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên sân hoặc bộ môn' })
  @IsOptional()
  @IsString()
  q?: string;
}
```

```typescript
// apps/backend/src/venue/court.service.ts — replace findAll and add
// PaginatedDto/buildPaginationMeta/FindCourtsQueryDto imports
  async findAll(query: FindCourtsQueryDto): Promise<PaginatedDto<Court>> {
    const { page, limit, q, venueId } = query;

    const qb = this.courtRepo
      .createQueryBuilder('court')
      .leftJoinAndSelect('court.venue', 'venue')
      .orderBy('court.name', 'ASC');

    if (venueId) {
      qb.andWhere('venue.id = :venueId', { venueId });
    }
    if (q?.trim()) {
      qb.andWhere('(court.name ILIKE :q OR court.sport ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
```

```typescript
// apps/backend/src/venue/court.controller.ts — replace findAll
  @Get()
  @ApiOperation({ summary: 'Danh sách sân con (lọc theo venueId, tìm kiếm, phân trang)' })
  @ApiPaginatedResponse(Court)
  findAll(@Query() query: FindCourtsQueryDto): Promise<PaginatedDto<Court>> {
    return this.courtService.findAll(query);
  }
```

(Add `FindCourtsQueryDto`, `PaginatedDto`, `ApiPaginatedResponse` imports; the old `@Query('venueId') venueId?: string` param is replaced entirely.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/venue/dto/find-courts-query.dto.ts \
  src/venue/court.service.ts src/venue/court.controller.ts test/venue.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm và phân trang cho danh sách sân con"
```

---

### Task 9: Staff list — search, isActive filter, paginate

**Files:**
- Create: `apps/backend/src/staff/dto/find-staff-query.dto.ts`
- Modify: `apps/backend/src/staff/staff.service.ts`
- Modify: `apps/backend/src/staff/staff.controller.ts`
- Test: `apps/backend/test/staff.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 pagination infra.
- Produces: `GET /staff` returns `PaginatedDto<Staff>`. Query: `venueId` (required, unchanged), `page`, `limit`, `q` (fullName/phone), `isActive` (`"true"`/`"false"`).

- [ ] **Step 1: Write the failing e2e test**

```typescript
// apps/backend/test/staff.e2e-spec.ts — the existing test around line 94-98
// does `.get(\`/staff?venueId=${venueId}\`)` then
// `expect(res.body).toHaveLength(1)`. Change that assertion to
// `expect(res.body.data).toHaveLength(1)`. Then add:
it('searches staff by name or phone and filters by isActive', async () => {
  const res = await request(app.getHttpServer())
    .get('/staff')
    .query({ venueId, q: 'not-a-real-staff-name-xyz' })
    .set('Authorization', `Bearer ${ownerToken}`)
    .expect(200);
  expect(res.body.data).toHaveLength(0);
  expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
});
```

(Match this test's auth-token variable name to whatever `staff.e2e-spec.ts` already uses for the venue-owning merchant — check the file's `beforeAll` if `ownerToken` isn't it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test:e2e -- staff.e2e-spec.ts`
Expected: FAIL — `res.body.data` undefined

- [ ] **Step 3: Implement**

```typescript
// apps/backend/src/staff/dto/find-staff-query.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FindStaffQueryDto extends PaginationQueryDto {
  @ApiProperty()
  @IsUUID()
  venueId: string;

  @ApiPropertyOptional({ description: '"true" hoặc "false"' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiPropertyOptional({ description: 'Tìm theo tên hoặc số điện thoại' })
  @IsOptional()
  @IsString()
  q?: string;
}
```

```typescript
// apps/backend/src/staff/staff.service.ts — replace findAll and add
// PaginatedDto/buildPaginationMeta/FindStaffQueryDto imports
  async findAll(query: FindStaffQueryDto): Promise<PaginatedDto<Staff>> {
    const { page, limit, q, venueId, isActive } = query;

    const qb = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.venue', 'venue')
      .where('venue.id = :venueId', { venueId })
      .orderBy('staff.fullName', 'ASC');

    if (isActive !== undefined) {
      qb.andWhere('staff.isActive = :isActive', {
        isActive: isActive === 'true',
      });
    }
    if (q?.trim()) {
      qb.andWhere('(staff.fullName ILIKE :q OR staff.phone ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: buildPaginationMeta(total, page, limit) };
  }
```

```typescript
// apps/backend/src/staff/staff.controller.ts — replace findAll
  @Get()
  @ApiOperation({ summary: 'Danh sách nhân viên theo cụm sân (tìm kiếm/lọc/phân trang)' })
  @ApiPaginatedResponse(Staff)
  findAll(@Query() query: FindStaffQueryDto): Promise<PaginatedDto<Staff>> {
    return this.staffService.findAll(query);
  }
```

(Add `FindStaffQueryDto`, `PaginatedDto`, `ApiPaginatedResponse` imports.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm test:e2e -- staff.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd apps/backend && git add src/staff test/staff.e2e-spec.ts
git commit -m "feat(backend): thêm tìm kiếm, lọc theo trạng thái hoạt động và phân trang cho danh sách nhân viên"
```

---

### Task 10: Regenerate the web API client

**Files:**
- Modify (generated): `packages/shared/src/generated/**`
- Modify: `packages/shared/dist/**` (build output)

**Interfaces:**
- Consumes: every backend Swagger change from Tasks 2–9.
- Produces: updated generated client functions (`userControllerFindAll`, `adminControllerGetVenues`, `adminControllerGetVenueProvinces`, `disputeControllerFindAll`, `merchantControllerGetBookings`, `merchantControllerGetVenues`, `courtControllerFindAll`, `staffControllerFindAll`) whose param types now include the new query fields and whose return types resolve to the paginated shape. Function *names* are unchanged from today (same controller method names) — only their parameter and response types change.

- [ ] **Step 1: Run the full backend test suite before regenerating (regression baseline)**

Run: `cd apps/backend && pnpm test && pnpm test:e2e`
Expected: PASS — confirms Tasks 1–9 left the backend green before we touch the generated client.

- [ ] **Step 2: Export the OpenAPI spec and regenerate the client**

Run:
```bash
cd apps/backend && pnpm run swagger:export
cd ../.. && pnpm run generate:api
cd packages/shared && pnpm build
```
Expected: `openapi.json` at the repo root is refreshed; `packages/shared/src/generated/` is rewritten (new fields on the affected params/model files, e.g. `packages/shared/src/generated/model/user.ts` gains no changes but a new `UserControllerFindAllParams`-style model appears; `packages/shared/src/generated/model/venue.ts` gains `province`); `pnpm build` in `packages/shared` succeeds with no type errors.

- [ ] **Step 3: Check the new tag export for `/admin/venues/provinces`**

Since `AdminController` already has a `@ApiTags('admin')` export line in `packages/shared/src/index.ts` (`export * from './generated/admin/admin';`), no new export line is needed — confirm by grepping: `grep -n "getVenueProvinces\|adminControllerGetVenueProvinces" packages/shared/src/generated/admin/admin.ts`. If the generated function name differs from this guess, note the actual name for use in Task 13.

- [ ] **Step 4: Rebuild the web app to catch any consumer breakage**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: type errors in the 7 pages that still destructure the old bare-array shape (e.g. `allUsers.map(...)` where `allUsers` is now `{ data, meta }`). This is expected — those pages are fixed in Tasks 12–18. Confirm the errors are *only* in the 7 known page files (plus `venue-form.tsx`/`actions.ts` for the province field) and nothing else, so we know the regeneration itself introduced no unexpected breakage.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/generated packages/shared/dist openapi.json
git commit -m "chore(shared): generate lại API client sau khi backend hỗ trợ tìm kiếm/lọc/phân trang"
```

---

### Task 11: Frontend shared list components

**Files:**
- Create: `apps/web/src/components/list/list-query.ts`
- Create: `apps/web/src/components/list/list-query.test.ts`
- Create: `apps/web/src/components/list/search-input.tsx`
- Create: `apps/web/src/components/list/search-input.test.tsx`
- Create: `apps/web/src/components/list/filter-select.tsx`
- Create: `apps/web/src/components/list/filter-select.test.tsx`
- Create: `apps/web/src/components/list/pagination.tsx`
- Create: `apps/web/src/components/list/pagination.test.tsx`

**Interfaces:**
- Produces: `withParam(current: URLSearchParams, updates: Record<string, string | undefined>): string`. `<SearchInput paramKey?: string; placeholder?: string />`. `<FilterSelect paramKey: string; label: string; options: { value: string; label: string }[] />` (an option with `value: ''` clears the filter). `<Pagination page: number; totalPages: number />`.
- Consumed by: Tasks 12–18 (every screen).

- [ ] **Step 1: Write the failing test for `withParam`**

```typescript
// apps/web/src/components/list/list-query.test.ts
import { describe, expect, it } from 'vitest';
import { withParam } from './list-query';

describe('withParam', () => {
  it('sets a new param and resets page', () => {
    const current = new URLSearchParams('page=3&status=OPEN');
    const params = new URLSearchParams(withParam(current, { q: 'nguyen' }));
    expect(params.get('q')).toBe('nguyen');
    expect(params.get('status')).toBe('OPEN');
    expect(params.has('page')).toBe(false);
  });

  it('removes a param when set to an empty string', () => {
    const current = new URLSearchParams('q=abc');
    expect(new URLSearchParams(withParam(current, { q: '' })).has('q')).toBe(false);
  });

  it('keeps an explicit page value when updating page directly', () => {
    const current = new URLSearchParams('q=abc&page=1');
    const params = new URLSearchParams(withParam(current, { page: '2' }));
    expect(params.get('page')).toBe('2');
    expect(params.get('q')).toBe('abc');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- list-query.test.ts`
Expected: FAIL — `Cannot find module './list-query'`

- [ ] **Step 3: Implement `withParam` and the three components**

```typescript
// apps/web/src/components/list/list-query.ts
export function withParam(
  current: URLSearchParams,
  updates: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  if (!('page' in updates)) {
    next.delete('page');
  }
  return next.toString();
}
```

```tsx
// apps/web/src/components/list/search-input.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withParam } from './list-query';

const DEBOUNCE_MS = 400;

export function SearchInput({
  paramKey = 'q',
  placeholder,
}: {
  paramKey?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramKey) ?? '');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const query = withParam(searchParams, { [paramKey]: next });
      router.push(query ? `${pathname}?${query}` : pathname);
    }, DEBOUNCE_MS);
  }

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder ?? 'Tìm kiếm...'}
      className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    />
  );
}
```

```tsx
// apps/web/src/components/list/filter-select.tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withParam } from './list-query';

export function FilterSelect({
  paramKey,
  label,
  options,
}: {
  paramKey: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? '';

  function handleChange(next: string) {
    const query = withParam(searchParams, { [paramKey]: next });
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      {label}
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
```

```tsx
// apps/web/src/components/list/pagination.tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { withParam } from './list-query';

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(next: number) {
    const query = withParam(searchParams, { page: String(next) });
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => goTo(page - 1)}
        className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
      >
        Trước
      </button>
      <span className="text-zinc-500">
        Trang {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => goTo(page + 1)}
        className="rounded border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
      >
        Sau
      </button>
    </div>
  );
}
```

```tsx
// apps/web/src/components/list/search-input.test.tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('status=ACTIVE'),
}));

const { SearchInput } = await import('./search-input');

describe('SearchInput', () => {
  beforeEach(() => {
    push.mockClear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('debounces navigation, preserves other params, and resets page', () => {
    render(<SearchInput placeholder="Tìm..." />);
    fireEvent.change(screen.getByPlaceholderText('Tìm...'), {
      target: { value: 'an' },
    });
    expect(push).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(push).toHaveBeenCalledWith('/admin/users?status=ACTIVE&q=an');
  });
});
```

```tsx
// apps/web/src/components/list/filter-select.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('q=an'),
}));

const { FilterSelect } = await import('./filter-select');

describe('FilterSelect', () => {
  beforeEach(() => push.mockClear());

  it('navigates immediately with the new filter value, preserving q, resetting page', () => {
    render(
      <FilterSelect
        paramKey="role"
        label="Vai trò"
        options={[
          { value: '', label: 'Tất cả' },
          { value: 'ADMIN', label: 'Quản trị' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Vai trò'), {
      target: { value: 'ADMIN' },
    });
    expect(push).toHaveBeenCalledWith('/admin/users?q=an&role=ADMIN');
  });

  it('clears the filter when the empty option is chosen', () => {
    render(
      <FilterSelect
        paramKey="q"
        label="Tìm"
        options={[
          { value: '', label: 'Tất cả' },
          { value: 'x', label: 'X' },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Tìm'), { target: { value: '' } });
    expect(push).toHaveBeenCalledWith('/admin/users');
  });
});
```

```tsx
// apps/web/src/components/list/pagination.test.tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams('page=2'),
}));

const { Pagination } = await import('./pagination');

describe('Pagination', () => {
  beforeEach(() => push.mockClear());

  it('renders nothing when there is only one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('disables Prev on page 1 and Next on the last page', () => {
    render(<Pagination page={1} totalPages={3} />);
    expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sau' })).not.toBeDisabled();
  });

  it('navigates to the next page, preserving other params', () => {
    render(<Pagination page={2} totalPages={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(push).toHaveBeenCalledWith('/admin/users?page=3');
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- list-query.test.ts search-input.test.tsx filter-select.test.tsx pagination.test.tsx`
Expected: PASS (10 tests total)

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/components/list
git commit -m "feat(web): thêm bộ component dùng chung cho tìm kiếm, lọc và phân trang qua URL"
```

---

### Task 12: Wire Admin/Users page

**Files:**
- Modify: `apps/web/src/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `users.userControllerFindAll(params)` returning `{ data: { data: User[], meta: {...} } }` (Task 10).

- [ ] **Step 1: Rewrite the page to read `searchParams` and render the controls**

```tsx
// apps/web/src/app/admin/users/page.tsx — full file
import { Role } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { lockUser, unlockUser } from './actions';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const role = typeof sp.role === 'string' ? (sp.role as Role) : undefined;
  const isLocked = typeof sp.isLocked === 'string' ? sp.isLocked : undefined;

  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  let usersPage;
  try {
    const { data } = await users.userControllerFindAll({ page, q, role, isLocked });
    usersPage = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Người dùng</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc email" />
        <FilterSelect
          paramKey="role"
          label="Vai trò"
          options={[
            { value: '', label: 'Tất cả' },
            { value: Role.PLAYER, label: 'Người chơi' },
            { value: Role.MERCHANT, label: 'Chủ sân' },
            { value: Role.ADMIN, label: 'Quản trị' },
          ]}
        />
        <FilterSelect
          paramKey="isLocked"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'false', label: 'Đang hoạt động' },
            { value: 'true', label: 'Đã khóa' },
          ]}
        />
      </div>

      {usersPage.data.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không tìm thấy người dùng phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {usersPage.data.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{user.fullName}</p>
              <p className="text-zinc-500">
                {user.email} — {user.role}
              </p>
              {user.isLocked && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">Đã khóa</p>
              )}
            </div>
            <form action={(user.isLocked ? unlockUser : lockUser).bind(null, user.id)}>
              <button
                type="submit"
                className={
                  user.isLocked
                    ? 'rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : 'rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400'
                }
              >
                {user.isLocked ? 'Mở khóa' : 'Khóa'}
              </button>
            </form>
          </div>
        ))}
      </div>

      <Pagination page={usersPage.meta.page} totalPages={usersPage.meta.totalPages} />
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors referencing `admin/users/page.tsx` (if the generated param type name for `isLocked`/`role` differs from a plain string/`Role`, adjust the cast to match what `packages/shared/src/generated/users/users.ts` actually declares).

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, then in a browser sign in as an ADMIN and open `/admin/users`. Confirm: typing in the search box filters after a short pause and updates the URL with `?q=`; switching the role/status filters updates the list and URL; if there are more than 20 users, pagination controls appear and Next/Prev work; refreshing the page with a `?q=`/`?role=` URL preserves the filtered view.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/admin/users/page.tsx
git commit -m "feat(web): thêm tìm kiếm, lọc và phân trang cho trang quản lý người dùng"
```

---

### Task 13: Wire Admin/Venues page (+ province select on merchant venue form)

**Files:**
- Modify: `apps/web/src/app/admin/venues/page.tsx`
- Modify: `apps/web/src/app/merchant/venues/new/venue-form.tsx`
- Modify: `apps/web/src/app/merchant/venues/new/actions.ts`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `admin.adminControllerGetVenues(params)` and the new `admin.adminControllerGetVenueProvinces()` (name confirmed in Task 10 Step 3); `VIETNAM_PROVINCES` from `@sportspace/shared` (Task 2).

- [ ] **Step 1: Confirm the generated function name for the new provinces endpoint**

Run: `grep -n "Provinces" packages/shared/src/generated/admin/admin.ts`
Expected: one exported function whose name starts with `adminControllerGet...Provinces` (Task 10 guessed `adminControllerGetVenueProvinces`). Use whatever name this grep actually returns in Step 3 below — if it differs from the guess, substitute the real name everywhere in this task.

- [ ] **Step 2: Add the province select to the merchant venue-creation form**

```tsx
// apps/web/src/app/merchant/venues/new/venue-form.tsx — add this block
// right after the "Địa chỉ" field's closing </div>, before the lat/lng grid
      <div className="flex flex-col gap-1">
        <label htmlFor="province" className="text-sm font-medium">
          Tỉnh/Thành phố
        </label>
        <select
          id="province"
          name="province"
          required
          defaultValue=""
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Chọn tỉnh/thành
          </option>
          {VIETNAM_PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </select>
      </div>
```

Add `import { VIETNAM_PROVINCES } from '@sportspace/shared';` to the top of `venue-form.tsx`.

```typescript
// apps/web/src/app/merchant/venues/new/actions.ts — add to createVenueSchema
// and to the parsed.data passed to venueControllerCreate:
import { VIETNAM_PROVINCES } from '@sportspace/shared';

const createVenueSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên cụm sân'),
  address: z.string().min(1, 'Vui lòng nhập địa chỉ'),
  province: z.enum(VIETNAM_PROVINCES, 'Vui lòng chọn tỉnh/thành'),
  lat: z.coerce.number('Vĩ độ không hợp lệ').min(-90).max(90),
  lng: z.coerce.number('Kinh độ không hợp lệ').min(-180).max(180),
  description: z.string().optional(),
});
```

And add `province: formData.get('province'),` to the `safeParse` call's input object.

- [ ] **Step 3: Rewrite the Admin/Venues page**

The code below calls `admin.adminControllerGetVenueProvinces()` — substitute the actual function name confirmed in Step 1 if it differs.

```tsx
// apps/web/src/app/admin/venues/page.tsx — full file
import { VenueStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { approveVenue, rejectVenue } from './actions';

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;
  const province = typeof sp.province === 'string' ? sp.province : undefined;

  const session = await requireSession();
  const { admin } = createAuthenticatedApiClient(session.accessToken);

  let venuesPage;
  let provinces: string[] = [];
  try {
    const [venuesRes, provincesRes] = await Promise.all([
      admin.adminControllerGetVenues({ page, q, status, province } as never),
      admin.adminControllerGetVenueProvinces(),
    ]);
    venuesPage = venuesRes.data;
    provinces = provincesRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Duyệt cụm sân</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên, địa chỉ hoặc chủ sở hữu" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: VenueStatus.PENDING, label: 'Chờ duyệt' },
            { value: 'ALL', label: 'Tất cả' },
            { value: VenueStatus.APPROVED, label: 'Đã duyệt' },
            { value: VenueStatus.REJECTED, label: 'Từ chối' },
          ]}
        />
        <FilterSelect
          paramKey="province"
          label="Tỉnh/Thành"
          options={[
            { value: '', label: 'Tất cả' },
            ...provinces.map((p) => ({ value: p, label: p })),
          ]}
        />
      </div>

      {venuesPage.data.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có cụm sân nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venuesPage.data.map((venue) => (
          <div
            key={venue.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">{venue.name}</p>
            <p className="text-zinc-500">
              {venue.address}
              {venue.province ? ` — ${venue.province}` : ''}
            </p>
            <p className="text-zinc-500">
              Chủ sở hữu: {venue.owner.fullName} ({venue.owner.email})
            </p>
            <p className="text-xs text-zinc-400">
              Đăng ký lúc {new Date(venue.createdAt).toLocaleString('vi-VN')} — {venue.status}
            </p>
            {venue.status === VenueStatus.PENDING && (
              <div className="flex gap-3">
                <form action={approveVenue.bind(null, venue.id)}>
                  <button
                    type="submit"
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Duyệt
                  </button>
                </form>
                <form action={rejectVenue.bind(null, venue.id)}>
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    Từ chối
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
```

Note: the status/province badge line and the "only show approve/reject on PENDING" guard are new — before this task, the page only ever received PENDING venues, so those actions were always shown; now that "All/Approved/Rejected" are viewable too, approve/reject only make sense on a still-pending venue.

- [ ] **Step 4: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors in the 3 modified files (the `as never` cast on `adminControllerGetVenues`'s argument is a deliberate escape hatch only if the generated param type's `status` field is typed strictly as `VenueStatus` and rejects the `'ALL'` literal — try without the cast first, and only keep it if `tsc` actually complains).

- [ ] **Step 5: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, sign in as ADMIN, open `/admin/venues`. Confirm the default view shows only PENDING venues; switching status to "Tất cả" shows all; the province dropdown lists provinces currently in use and filters correctly; creating a new venue as a MERCHANT at `/merchant/venues/new` now requires picking a province from the dropdown.

- [ ] **Step 6: Commit**

```bash
cd apps/web && git add src/app/admin/venues/page.tsx \
  src/app/merchant/venues/new/venue-form.tsx src/app/merchant/venues/new/actions.ts
git commit -m "feat(web): thêm tìm kiếm, lọc theo trạng thái/tỉnh thành và phân trang cho trang duyệt cụm sân"
```

---

### Task 14: Wire Admin/Disputes page

**Files:**
- Modify: `apps/web/src/app/admin/disputes/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `disputes.disputeControllerFindAll(params)`.

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/app/admin/disputes/page.tsx — full file
import { DisputeStatus, ResolveDisputeDtoStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { resolveDispute } from './actions';

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;

  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  let disputesPage;
  try {
    const { data } = await disputes.disputeControllerFindAll({ page, q, status } as never);
    disputesPage = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khiếu nại</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo lý do hoặc người khiếu nại" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: DisputeStatus.OPEN, label: 'Đang chờ' },
            { value: 'ALL', label: 'Tất cả' },
            { value: DisputeStatus.RESOLVED, label: 'Đã chấp nhận' },
            { value: DisputeStatus.REJECTED, label: 'Đã từ chối' },
          ]}
        />
      </div>

      {disputesPage.data.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có khiếu nại nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {disputesPage.data.map((dispute) => (
          <div
            key={dispute.id}
            className="flex flex-col gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">
              Đơn #{dispute.booking.id} — {dispute.status}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">{dispute.reason}</p>
            {dispute.status === DisputeStatus.OPEN && (
              <form
                action={resolveDispute.bind(null, dispute.id)}
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
              >
                <label className="flex flex-col gap-1 text-xs">
                  Ghi chú xử lý
                  <textarea
                    name="resolutionNote"
                    required
                    minLength={5}
                    className="rounded border border-zinc-300 p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  Số tiền hoàn (VNĐ, nếu có)
                  <input
                    type="number"
                    name="refundAmount"
                    min={1}
                    className="rounded border border-zinc-300 p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="status"
                    value={ResolveDisputeDtoStatus.RESOLVED}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Chấp nhận
                  </button>
                  <button
                    type="submit"
                    name="status"
                    value={ResolveDisputeDtoStatus.REJECTED}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    Từ chối
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      <Pagination page={disputesPage.meta.page} totalPages={disputesPage.meta.totalPages} />
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors in this file (drop the `as never` cast if unneeded, same note as Task 13).

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, sign in as ADMIN, open `/admin/disputes`. Confirm default view shows only OPEN disputes with resolve actions; "Tất cả" shows resolved/rejected ones too (without the resolve form); search narrows by reason text.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/admin/disputes/page.tsx
git commit -m "feat(web): thêm tìm kiếm, lọc theo trạng thái và phân trang cho trang khiếu nại"
```

---

### Task 15: Wire Merchant/Bookings page

**Files:**
- Modify: `apps/web/src/app/merchant/bookings/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `merchant.merchantControllerGetBookings(params)`; `merchant.merchantControllerGetVenues(params)` (to conditionally show the venue filter).

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/app/merchant/bookings/page.tsx — full file
import { BookingStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { confirmBooking, rejectBooking } from './actions';

export default async function MerchantBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;
  const venueId = typeof sp.venueId === 'string' ? sp.venueId : undefined;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const to = typeof sp.to === 'string' ? sp.to : undefined;

  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let bookingsPage;
  let venueOptions: { value: string; label: string }[] = [];
  try {
    const [bookingsRes, venuesRes] = await Promise.all([
      merchant.merchantControllerGetBookings({
        page,
        q,
        status,
        venueId,
        from,
        to,
      } as never),
      merchant.merchantControllerGetVenues({ limit: 100 } as never),
    ]);
    bookingsPage = bookingsRes.data;
    venueOptions = venuesRes.data.data.map((v) => ({ value: v.id, label: v.name }));
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Đơn đặt sân</h1>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên khách hoặc tên sân" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: '', label: 'Cần xử lý' },
            { value: 'ALL', label: 'Tất cả' },
            { value: BookingStatus.CANCELLED, label: 'Đã hủy' },
          ]}
        />
        {venueOptions.length > 1 && (
          <FilterSelect
            paramKey="venueId"
            label="Cụm sân"
            options={[{ value: '', label: 'Tất cả' }, ...venueOptions]}
          />
        )}
      </div>

      {bookingsPage.data.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có đơn đặt sân nào phù hợp.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {bookingsPage.data.map((booking) => (
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
              {booking.status !== BookingStatus.CANCELLED && (
                <form
                  action={rejectBooking.bind(null, booking.id)}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    name="reason"
                    required
                    placeholder="Lý do từ chối"
                    className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <button
                    type="submit"
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                  >
                    Từ chối
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>

      <Pagination page={bookingsPage.meta.page} totalPages={bookingsPage.meta.totalPages} />
    </div>
  );
}
```

Note: `from`/`to` date-range filters are supported by the backend but this task doesn't add date-picker UI for them (out of scope for this plan's UI — the design's field mapping calls for them, but no existing date-range control exists to reuse in this codebase). If date filtering turns out to matter in practice, that's a small follow-up task adding two `<input type="date">` fields wired through the same `withParam` pattern as `SearchInput`.

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, sign in as a MERCHANT with bookings, open `/merchant/bookings`. Confirm default view shows pending+confirmed only; "Tất cả" includes cancelled; search and (if the merchant has >1 venue) the venue filter work.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/merchant/bookings/page.tsx
git commit -m "feat(web): thêm tìm kiếm, lọc và phân trang cho trang đơn đặt sân của chủ sân"
```

---

### Task 16: Wire Merchant/Venues page

**Files:**
- Modify: `apps/web/src/app/merchant/venues/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `merchant.merchantControllerGetVenues(params)`.

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/app/merchant/venues/page.tsx — full file
import Link from 'next/link';
import { VenueStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';

export default async function VenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const status = typeof sp.status === 'string' ? sp.status : undefined;

  const session = await requireSession();
  const { merchant } = createAuthenticatedApiClient(session.accessToken);

  let venuesPage;
  try {
    venuesPage = (
      await merchant.merchantControllerGetVenues({ page, q, status } as never)
    ).data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cụm sân của tôi</h1>
        <Link
          href="/merchant/venues/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Tạo cụm sân mới
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc địa chỉ" />
        <FilterSelect
          paramKey="status"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: VenueStatus.PENDING, label: 'Chờ duyệt' },
            { value: VenueStatus.APPROVED, label: 'Đã duyệt' },
            { value: VenueStatus.REJECTED, label: 'Từ chối' },
          ]}
        />
      </div>

      {venuesPage.data.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có cụm sân nào phù hợp. Bấm &quot;Tạo cụm sân mới&quot; để bắt đầu.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {venuesPage.data.map((venue) => (
          <Link
            key={venue.id}
            href={`/merchant/venues/${venue.id}/courts`}
            className="flex flex-col gap-1 rounded border border-zinc-200 p-4 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span className="font-medium">{venue.name}</span>
            <span className="text-zinc-500">{venue.address}</span>
            <span className="text-xs uppercase text-zinc-400">{venue.status}</span>
          </Link>
        ))}
      </div>

      <Pagination page={venuesPage.meta.page} totalPages={venuesPage.meta.totalPages} />
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, sign in as MERCHANT, open `/merchant/venues`. Confirm search and status filter work.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/merchant/venues/page.tsx
git commit -m "feat(web): thêm tìm kiếm, lọc theo trạng thái và phân trang cho trang cụm sân của chủ sân"
```

---

### Task 17: Wire Courts page

**Files:**
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `Pagination` (Task 11); `courts.courtControllerFindAll(params)`.

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx — full file
import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { Pagination } from '@/components/list/pagination';
import { CourtForm } from './court-form';
import { deleteCourt } from './actions';

export default async function CourtsPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { venueId } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;

  const session = await requireSession();
  const { venues, courts } = createAuthenticatedApiClient(session.accessToken);

  let venueName: string;
  let courtsPage;
  try {
    const [venueRes, courtsRes] = await Promise.all([
      venues.venueControllerFindOne(venueId),
      courts.courtControllerFindAll({ venueId, page, q }),
    ]);
    venueName = venueRes.data.name;
    courtsPage = courtsRes.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/merchant" className="hover:underline">
            Merchant
          </Link>{' '}
          / {venueName}
        </p>
        <h1 className="text-xl font-semibold">Sân con của {venueName}</h1>
      </div>

      <SearchInput placeholder="Tìm theo tên sân hoặc bộ môn" />

      <div className="flex flex-col gap-4">
        {courtsPage.data.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Không có sân con nào phù hợp.
          </p>
        )}
        {courtsPage.data.map((court) => (
          <div
            key={court.id}
            className="flex flex-col gap-2 rounded border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <CourtForm venueId={venueId} court={court} />
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <Link href={`/merchant/venues/${venueId}/courts/${court.id}/price-rules`} className="hover:underline">
                Giá theo khung giờ
              </Link>
              <form action={deleteCourt.bind(null, venueId, court.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Xoá
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={courtsPage.meta.page} totalPages={courtsPage.meta.totalPages} />

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm sân con mới</h2>
        <CourtForm venueId={venueId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, open a venue's courts page as its owning MERCHANT. Confirm search by name/sport works and existing add/edit/delete court flows still work.

- [ ] **Step 4: Commit**

```bash
cd apps/web && git add src/app/merchant/venues/\[venueId\]/courts/page.tsx
git commit -m "feat(web): thêm tìm kiếm và phân trang cho danh sách sân con"
```

---

### Task 18: Wire Staff page

**Files:**
- Modify: `apps/web/src/app/merchant/venues/[venueId]/staff/page.tsx`

**Interfaces:**
- Consumes: `SearchInput`, `FilterSelect`, `Pagination` (Task 11); `staffApi.staffControllerFindAll(params)`.

- [ ] **Step 1: Rewrite the page**

```tsx
// apps/web/src/app/merchant/venues/[venueId]/staff/page.tsx — full file
import Link from 'next/link';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { SearchInput } from '@/components/list/search-input';
import { FilterSelect } from '@/components/list/filter-select';
import { Pagination } from '@/components/list/pagination';
import { StaffForm } from './staff-form';
import { deactivateStaff } from './actions';

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { venueId } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;
  const q = typeof sp.q === 'string' ? sp.q : undefined;
  const isActive = typeof sp.isActive === 'string' ? sp.isActive : undefined;

  const session = await requireSession();
  const { staff: staffApi } = createAuthenticatedApiClient(session.accessToken);

  let staffPage;
  try {
    const res = await staffApi.staffControllerFindAll({ venueId, page, q, isActive });
    staffPage = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Nhân viên</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput placeholder="Tìm theo tên hoặc số điện thoại" />
        <FilterSelect
          paramKey="isActive"
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'true', label: 'Đang làm việc' },
            { value: 'false', label: 'Đã vô hiệu hoá' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2">
        {staffPage.data.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Không có nhân viên nào phù hợp.
          </p>
        )}
        {staffPage.data.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <Link
              href={`/merchant/venues/${venueId}/staff/${member.id}/shifts`}
              className="hover:underline"
            >
              {member.fullName} — {member.position} ({member.phone})
              {!member.isActive && ' — đã vô hiệu hoá'}
            </Link>
            {member.isActive && (
              <form action={deactivateStaff.bind(null, venueId, member.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Vô hiệu hoá
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <Pagination page={staffPage.meta.page} totalPages={staffPage.meta.totalPages} />

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm nhân viên mới</h2>
        <StaffForm venueId={venueId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: zero remaining errors anywhere in `apps/web` — this is the last of the 7 pages, so this run should be fully clean.

- [ ] **Step 3: Manually verify in the browser**

Run: `cd apps/web && pnpm dev`, open a venue's staff page as its owning MERCHANT. Confirm search and active/inactive filter work, and existing add/deactivate/shifts flows still work.

- [ ] **Step 4: Run the full test suite one last time**

Run: `cd apps/backend && pnpm test && pnpm test:e2e` and `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: all green — this closes out the plan.

- [ ] **Step 5: Commit**

```bash
cd apps/web && git add src/app/merchant/venues/\[venueId\]/staff/page.tsx
git commit -m "feat(web): thêm tìm kiếm, lọc theo trạng thái hoạt động và phân trang cho danh sách nhân viên"
```

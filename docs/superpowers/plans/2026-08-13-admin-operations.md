# Admin Operations (User Lock, Disputes, System Config) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three related gaps in the ADMIN role's operational surface identified against the thesis report (FR-A02/A03/A04): admins can list/lock/unlock player & merchant accounts, resolve player-raised disputes on bookings (with an optional forced refund), and edit the platform's system-wide config (cancellation refund thresholds, commission %) instead of having those values hardcoded.

**Architecture:** All three features extend existing modules rather than inventing a parallel "admin" module, mirroring how `venue.controller.ts` already puts `/venues/:id/approve` (ADMIN-guarded) next to the merchant-facing CRUD routes on the same controller — no bare `/admin/*` API prefix exists anywhere in this codebase, only `@Roles(Role.ADMIN)` guards on routes under the resource's own path. This plan follows that convention: user lock endpoints go on the existing `UserController` (`/users`), disputes get their own new resource controller (`/disputes`, `nest g resource dispute`) since a dispute isn't a sub-action of an existing resource, and system config gets its own new resource controller (`/system-config`) since it's a genuinely new top-level concept. The Next.js *web* routes (`/admin/users`, `/admin/disputes`, `/admin/config`) are unrelated to the API path scheme — those are just page URLs under the existing `apps/web/src/app/admin/` folder, same as `/admin/venues` today.

Disputes: a lightweight `Dispute` entity (not a raw "force-cancel" mutation) linked to a `Booking`, raised by the player who owns it, with status `OPEN` → `RESOLVED` | `REJECTED`, an admin `resolutionNote`, and an optional `refundAmount` that — when the admin resolves with a refund — calls a new `PaymentService.applyRefund(paymentId, amount, reason)` method this plan adds (it does not exist yet; Task 8 adds it). This is worth a real entity because the report treats disputes as a first-class admin workflow with a history/audit trail, not a one-off DB patch.

System config: a single-row `SystemConfig` entity with typed columns (not a generic key-value table) — the known parameter set is small and fixed (cancellation refund thresholds/percentages, platform commission %), so typed columns give compile-time safety and match this codebase's existing style (no EAV pattern used anywhere else). **Integration checkpoint:** `apps/backend/src/booking/booking.service.ts`'s `cancel()` method (see file, ~line 195) currently has NO refund logic at all — a separate plan (`2026-08-13-cancel-refund-policy.md`, if present) is expected to add the tiered 24h/2h refund calculation there as a pure function using hardcoded constants. Task 9 of *this* plan wires that function (once it exists) to read its thresholds from `SystemConfig` instead. If that other plan has not landed yet when Task 9 is executed, read `docs/superpowers/plans/2026-08-13-cancel-refund-policy.md` first to get the exact function name/signature; if it still doesn't exist, skip Task 9's wiring step and leave a note instead of guessing an API.

**Tech Stack:** NestJS + TypeORM (Postgres), class-validator DTOs, Jest + `@golevelup/ts-jest` `createMock<T>()` for unit tests, Supertest for e2e, `@faker-js/faker` for e2e fixtures, Next.js Server Components + Server Actions for the web pages, orval-generated API client (`@sportspace/shared`).

## Global Constraints

- TypeScript strict; ESLint + Prettier (per CLAUDE.md §10).
- Migrations MUST be generated via `pnpm migration:generate -- src/database/migrations/<Name>` (CLI, from `apps/backend`) after editing entities — never hand-write migration SQL (CLAUDE.md §0.2/§0.3). Verify the generated file's `up`/`down` before committing.
- New NestJS resources scaffolded via `nest g resource <name>` from `apps/backend/src`, then business logic added inside the generated files — never hand-author a module/controller/service skeleton from scratch (CLAUDE.md §0.2).
- Mocks in unit tests via `createMock<T>()` (`@golevelup/ts-jest`); test fixtures via `@faker-js/faker` — no hand-written literal objects for user/booking/payment fixtures (CLAUDE.md §0.3).
- After any DTO/entity change that affects the Swagger schema, run `pnpm generate:api` from the repo root so `packages/shared`'s orval-generated client stays in sync (CLAUDE.md §10).
- Every ADMIN-only route uses `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(Role.ADMIN)`, matching `venue.controller.ts:59-61`.
- Vietnamese user-facing strings (exception messages, UI copy), matching the rest of the codebase.

---

## Task 1: `User.isLocked` column + migration

**Files:**
- Modify: `apps/backend/src/user/entities/user.entity.ts`
- Create (via CLI): `apps/backend/src/database/migrations/<timestamp>-AddUserIsLocked.ts`

**Interfaces:**
- Produces: `User.isLocked: boolean` (default `false`), readable by `AuthService.login` and `UserService`.

- [x] **Step 1: Add the column to the entity**

```ts
// apps/backend/src/user/entities/user.entity.ts — add after the `role` column
@ApiProperty()
@Column({ default: false })
isLocked: boolean;
```

- [x] **Step 2: Generate the migration**

Run from `apps/backend`:
```bash
pnpm migration:generate src/database/migrations/AddUserIsLocked
```
Expected: a new file `src/database/migrations/<timestamp>-AddUserIsLocked.ts` containing `ALTER TABLE "users" ADD "isLocked" boolean NOT NULL DEFAULT false` in `up()` and the matching `DROP COLUMN` in `down()`. Open it and confirm — do not hand-edit unless the generated SQL is wrong.

- [x] **Step 3: Run the migration against the dev DB**

```bash
pnpm migration:run
```
Expected: migration listed as applied, no errors.

- [x] **Step 4: Commit**

```bash
git add apps/backend/src/user/entities/user.entity.ts apps/backend/src/database/migrations/
git commit -m "feat(backend): add User.isLocked column"
```

---

## Task 2: `UserService` admin methods — list, lock, unlock

**Files:**
- Modify: `apps/backend/src/user/user.service.ts`
- Test: `apps/backend/src/user/user.service.spec.ts`

**Interfaces:**
- Consumes: `User` entity from Task 1.
- Produces: `UserService.findAll(): Promise<User[]>`, `UserService.setLocked(id: string, isLocked: boolean): Promise<User>` — used by Task 3's controller and Task 4's `AuthService`.

- [x] **Step 1: Write the failing tests**

```ts
// apps/backend/src/user/user.service.spec.ts — add to existing describe block
it('findAll() returns all users', async () => {
  const users = [
    { id: faker.string.uuid(), email: faker.internet.email() },
  ] as User[];
  jest.spyOn(userRepo, 'find').mockResolvedValue(users);

  const result = await service.findAll();

  expect(result).toBe(users);
});

it('setLocked() throws NotFoundException when the user does not exist', async () => {
  jest.spyOn(userRepo, 'findOne').mockResolvedValue(null);

  await expect(service.setLocked(faker.string.uuid(), true)).rejects.toThrow(
    NotFoundException,
  );
});

it('setLocked() updates isLocked and returns the saved user', async () => {
  const user = { id: faker.string.uuid(), isLocked: false } as User;
  jest.spyOn(userRepo, 'findOne').mockResolvedValue(user);
  jest.spyOn(userRepo, 'save').mockImplementation(async (u) => u as User);

  const result = await service.setLocked(user.id, true);

  expect(result.isLocked).toBe(true);
  expect(userRepo.save).toHaveBeenCalledWith(
    expect.objectContaining({ id: user.id, isLocked: true }),
  );
});
```

Check the top of the spec file for how `userRepo` is currently obtained (`module.get(getRepositoryToken(User))` style) — reuse that, don't reintroduce a second mock.

- [x] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test user.service.spec.ts
```
Expected: FAIL — `findAll`/`setLocked` not defined on `UserService`.

- [x] **Step 3: Implement**

```ts
// apps/backend/src/user/user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
// ...existing imports

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find();
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

- [x] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test user.service.spec.ts
```
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/user/user.service.ts apps/backend/src/user/user.service.spec.ts
git commit -m "feat(backend): add UserService.findAll/setLocked"
```

---

## Task 3: `UserController` admin routes — list, lock, unlock

**Files:**
- Modify: `apps/backend/src/user/user.controller.ts`
- Test: `apps/backend/src/user/user.controller.spec.ts`

**Interfaces:**
- Consumes: `UserService.findAll`, `UserService.setLocked` from Task 2.
- Produces: `GET /users` (ADMIN), `PATCH /users/:id/lock` (ADMIN), `PATCH /users/:id/unlock` (ADMIN).

- [x] **Step 1: Write the failing tests**

```ts
// apps/backend/src/user/user.controller.spec.ts — add to existing describe block
it('findAll() forwards to the service', async () => {
  const users = [{ id: faker.string.uuid() }];
  service.findAll.mockResolvedValue(users as User[]);

  const result = await controller.findAll();

  expect(result).toBe(users);
  expect(service.findAll).toHaveBeenCalled();
});

it('lock() forwards id + true to the service', async () => {
  const id = faker.string.uuid();
  await controller.lock(id);
  expect(service.setLocked).toHaveBeenCalledWith(id, true);
});

it('unlock() forwards id + false to the service', async () => {
  const id = faker.string.uuid();
  await controller.unlock(id);
  expect(service.setLocked).toHaveBeenCalledWith(id, false);
});
```

Add `import { User } from './entities/user.entity';` if not already present in the spec.

- [x] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test user.controller.spec.ts
```
Expected: FAIL — `findAll`/`lock`/`unlock` not defined on `UserController`.

- [x] **Step 3: Implement**

```ts
// apps/backend/src/user/user.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { UserService } from './user.service';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cập nhật FCM device token của chính mình' })
  @ApiOkResponse()
  updateFcmToken(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    return this.userService.updateFcmToken(userId, dto.fcmToken);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách toàn bộ người dùng' })
  @ApiOkResponse({ type: [User] })
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Patch(':id/lock')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Khóa tài khoản người dùng' })
  @ApiOkResponse({ type: User })
  lock(@Param('id') id: string): Promise<User> {
    return this.userService.setLocked(id, true);
  }

  @Patch(':id/unlock')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Mở khóa tài khoản người dùng' })
  @ApiOkResponse({ type: User })
  unlock(@Param('id') id: string): Promise<User> {
    return this.userService.setLocked(id, false);
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test user.controller.spec.ts
```
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/user/user.controller.ts apps/backend/src/user/user.controller.spec.ts
git commit -m "feat(backend): add admin user list/lock/unlock endpoints"
```

---

## Task 4: Block login for locked users

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts`
- Test: `apps/backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `User.isLocked` from Task 1.
- Produces: `AuthService.login` now throws `ForbiddenException` for locked users (behavior change, no signature change).

- [x] **Step 1: Write the failing test**

```ts
// apps/backend/src/auth/auth.service.spec.ts — add to the login() describe block
it('login() rejects a locked user with ForbiddenException', async () => {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const qb = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue({
      id: faker.string.uuid(),
      email: 'locked@example.com',
      passwordHash,
      isLocked: true,
    }),
  };
  jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue(qb as never);

  await expect(
    service.login({ email: 'locked@example.com', password: 'Password123!' }),
  ).rejects.toThrow(ForbiddenException);
});
```

Match the existing spec file's pattern for mocking `createQueryBuilder` on `login()` — reuse its helper if one already exists instead of duplicating the `qb` shape.

- [x] **Step 2: Run test to verify it fails**

```bash
pnpm --filter backend test auth.service.spec.ts
```
Expected: FAIL — currently resolves/throws `UnauthorizedException` regardless of lock state (no lock check exists).

- [x] **Step 3: Implement**

```ts
// apps/backend/src/auth/auth.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
// ...

async login(dto: LoginDto): Promise<AuthResponseDto> {
  const user = await this.userRepo
    .createQueryBuilder('user')
    .addSelect('user.passwordHash')
    .where('user.email = :email', { email: dto.email })
    .getOne();

  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
  }
  if (user.isLocked) {
    throw new ForbiddenException('Tài khoản đã bị khóa');
  }

  return this.issueTokens(user);
}
```

- [x] **Step 4: Run test to verify it passes**

```bash
pnpm --filter backend test auth.service.spec.ts
```
Expected: PASS, and all pre-existing `login()` tests still PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/auth/auth.service.ts apps/backend/src/auth/auth.service.spec.ts
git commit -m "feat(backend): block login for locked users"
```

---

## Task 5: e2e — admin user lock/unlock flow

**Files:**
- Create: `apps/backend/test/user.e2e-spec.ts`

**Interfaces:**
- Consumes: `/auth/register`, `/auth/login`, `GET /users`, `PATCH /users/:id/lock`, `PATCH /users/:id/unlock` (all from Tasks 1-4).

- [x] **Step 1: Write the e2e test**

```ts
// apps/backend/test/user.e2e-spec.ts
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';

const SEED_PASSWORD = 'Password123!';

describe('User admin (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: User;
  let player: User;
  let adminToken: string;
  let playerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    admin = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.ADMIN,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.PLAYER,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    adminToken = await login(admin.email);
    playerToken = await login(player.email);
  });

  afterAll(async () => {
    await dataSource.getRepository(User).delete({ id: admin.id });
    await dataSource.getRepository(User).delete({ id: player.id });
    await app.close();
  });

  it('rejects list/lock/unlock by a non-ADMIN (403)', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/users/${player.id}/lock`)
      .set('Authorization', `Bearer ${playerToken}`)
      .expect(403);
  });

  it('lets an ADMIN list users, lock, and unlock a player', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      listRes.body.some((u: { id: string }) => u.id === player.id),
    ).toBe(true);

    const lockRes = await request(app.getHttpServer())
      .patch(`/users/${player.id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(lockRes.body.isLocked).toBe(true);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD })
      .expect(403);

    const unlockRes = await request(app.getHttpServer())
      .patch(`/users/${player.id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(unlockRes.body.isLocked).toBe(false);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: player.email, password: SEED_PASSWORD })
      .expect(200);
  });
});
```

- [x] **Step 2: Run and verify it passes**

```bash
pnpm --filter backend test:e2e user.e2e-spec.ts
```
Expected: PASS (2 tests).

- [x] **Step 3: Commit**

```bash
git add apps/backend/test/user.e2e-spec.ts
git commit -m "test(backend): e2e coverage for admin user lock/unlock"
```

---

## Task 6: `SystemConfig` entity + migration + default row

**Files:**
- Create: `apps/backend/src/system-config/entities/system-config.entity.ts`
- Create (via CLI): `apps/backend/src/database/migrations/<timestamp>-CreateSystemConfig.ts`

**Interfaces:**
- Produces: `SystemConfig` entity — single logical row, columns `cancellationFullRefundHours: number`, `cancellationPartialRefundHours: number`, `cancellationPartialRefundPercent: number`, `platformCommissionPercent: number`.

- [x] **Step 1: Create the entity**

```ts
// apps/backend/src/system-config/entities/system-config.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_config')
export class SystemConfig {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'int', default: 24 })
  cancellationFullRefundHours: number;

  @ApiProperty()
  @Column({ type: 'int', default: 2 })
  cancellationPartialRefundHours: number;

  @ApiProperty()
  @Column({ type: 'int', default: 50 })
  cancellationPartialRefundPercent: number;

  @ApiProperty()
  @Column({ type: 'int', default: 10 })
  platformCommissionPercent: number;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
```

These defaults match CLAUDE.md §7's hardcoded policy (>24h=100%, 2-24h=50%, <2h=0%) so behavior is unchanged until an admin edits them.

- [x] **Step 2: Generate + run the migration**

```bash
pnpm migration:generate src/database/migrations/CreateSystemConfig
pnpm migration:run
```
Expected: migration creates the `system_config` table with the columns above; confirm the generated file before running.

- [x] **Step 3: Commit**

```bash
git add apps/backend/src/system-config/entities/system-config.entity.ts apps/backend/src/database/migrations/
git commit -m "feat(backend): add SystemConfig entity + migration"
```

---

## Task 7: `SystemConfigModule` — get/update (singleton row)

**Files:**
- Create (via CLI, then edit): `apps/backend/src/system-config/system-config.service.ts`, `system-config.controller.ts`, `system-config.module.ts`, `system-config.service.spec.ts`, `system-config.controller.spec.ts`
- Create: `apps/backend/src/system-config/dto/update-system-config.dto.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `SystemConfig` entity from Task 6.
- Produces: `SystemConfigService.get(): Promise<SystemConfig>` (creates the default row on first call if none exists), `SystemConfigService.update(dto: UpdateSystemConfigDto): Promise<SystemConfig>`. `GET /system-config` (any authenticated user — booking cancellation math needs to read it too), `PATCH /system-config` (ADMIN only).

- [x] **Step 1: Scaffold via CLI**

From `apps/backend`:
```bash
nest g resource system-config --no-spec
```
When prompted, choose "REST API" and answer "N" to generate CRUD entry points (we'll hand-write the two routes we need). This produces `system-config.module.ts`, `.controller.ts`, `.service.ts` with boilerplate — delete the generated `dto/create-system-config.dto.ts` and `dto/update-system-config.dto.ts` stub, replace `entities/system-config.entity.ts` with Task 6's file (or move Task 6's file into this generated folder if it wasn't already there).

- [x] **Step 2: Write the DTO**

```ts
// apps/backend/src/system-config/dto/update-system-config.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSystemConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationFullRefundHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationPartialRefundHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  cancellationPartialRefundPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  platformCommissionPercent?: number;
}
```

- [x] **Step 3: Write the failing service tests**

```ts
// apps/backend/src/system-config/system-config.service.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfigService } from './system-config.service';
import { SystemConfig } from './entities/system-config.entity';

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let repo: DeepMocked<Repository<SystemConfig>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemConfigService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: createMock<Repository<SystemConfig>>(),
        },
      ],
    }).compile();

    service = module.get(SystemConfigService);
    repo = module.get(getRepositoryToken(SystemConfig));
  });

  it('get() returns the existing row if one exists', async () => {
    const row = { id: 'x' } as SystemConfig;
    repo.find.mockResolvedValue([row]);

    const result = await service.get();

    expect(result).toBe(row);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('get() creates and returns a default row if none exists', async () => {
    repo.find.mockResolvedValue([]);
    const created = { id: 'new' } as SystemConfig;
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    const result = await service.get();

    expect(repo.create).toHaveBeenCalledWith({});
    expect(result).toBe(created);
  });

  it('update() merges the dto into the existing row and saves', async () => {
    const row = { id: 'x', platformCommissionPercent: 10 } as SystemConfig;
    repo.find.mockResolvedValue([row]);
    repo.save.mockImplementation(async (r) => r as SystemConfig);

    const result = await service.update({ platformCommissionPercent: 15 });

    expect(result.platformCommissionPercent).toBe(15);
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'x', platformCommissionPercent: 15 }),
    );
  });
});
```

- [x] **Step 4: Run tests to verify they fail**

```bash
pnpm --filter backend test system-config.service.spec.ts
```
Expected: FAIL — `SystemConfigService` still has the generated CRUD stub methods, not `get`/`update`.

- [x] **Step 5: Implement the service**

```ts
// apps/backend/src/system-config/system-config.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from './entities/system-config.entity';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly repo: Repository<SystemConfig>,
  ) {}

  async get(): Promise<SystemConfig> {
    const [existing] = await this.repo.find({ take: 1 });
    if (existing) {
      return existing;
    }
    return this.repo.save(this.repo.create({}));
  }

  async update(dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    const config = await this.get();
    Object.assign(config, dto);
    return this.repo.save(config);
  }
}
```

- [x] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter backend test system-config.service.spec.ts
```
Expected: PASS.

- [x] **Step 7: Write the failing controller tests**

```ts
// apps/backend/src/system-config/system-config.controller.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { SystemConfig } from './entities/system-config.entity';

describe('SystemConfigController', () => {
  let controller: SystemConfigController;
  let service: DeepMocked<SystemConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemConfigController],
      providers: [
        { provide: SystemConfigService, useValue: createMock<SystemConfigService>() },
      ],
    }).compile();

    controller = module.get(SystemConfigController);
    service = module.get(SystemConfigService);
  });

  it('get() forwards to the service', async () => {
    const config = { id: 'x' } as SystemConfig;
    service.get.mockResolvedValue(config);

    expect(await controller.get()).toBe(config);
  });

  it('update() forwards the dto to the service', async () => {
    const dto = { platformCommissionPercent: 15 };
    await controller.update(dto);
    expect(service.update).toHaveBeenCalledWith(dto);
  });
});
```

- [x] **Step 8: Run tests to verify they fail, then implement**

```ts
// apps/backend/src/system-config/system-config.controller.ts
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@sportspace/shared';
import { SystemConfigService } from './system-config.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { SystemConfig } from './entities/system-config.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('system-config')
@Controller('system-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Đọc cấu hình hệ thống hiện tại' })
  @ApiOkResponse({ type: SystemConfig })
  get(): Promise<SystemConfig> {
    return this.systemConfigService.get();
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Cập nhật cấu hình hệ thống' })
  @ApiOkResponse({ type: SystemConfig })
  update(@Body() dto: UpdateSystemConfigDto): Promise<SystemConfig> {
    return this.systemConfigService.update(dto);
  }
}
```

```ts
// apps/backend/src/system-config/system-config.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemConfigService } from './system-config.service';
import { SystemConfigController } from './system-config.controller';
import { SystemConfig } from './entities/system-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  controllers: [SystemConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
```

Register in `apps/backend/src/app.module.ts`: add `import { SystemConfigModule } from './system-config/system-config.module';` and add `SystemConfigModule` to the `imports` array.

Run:
```bash
pnpm --filter backend test system-config.controller.spec.ts
```
Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add apps/backend/src/system-config apps/backend/src/app.module.ts
git commit -m "feat(backend): add SystemConfig get/update endpoints"
```

---

## Task 8: `PaymentService.applyRefund` (new method)

**Files:**
- Modify: `apps/backend/src/payment/payment.service.ts`
- Modify: `apps/backend/src/payment/entities/payment.entity.ts`
- Create (via CLI): `apps/backend/src/database/migrations/<timestamp>-AddPaymentRefundAmount.ts`
- Test: `apps/backend/src/payment/payment.service.spec.ts`

**Interfaces:**
- Consumes: `Payment`, `Booking` entities, `NotificationService.notify`.
- Produces: `PaymentService.applyRefund(paymentId: string, amount: number, reason: string): Promise<Payment>` — consumed by Task 11's `DisputeService`.

**Before writing:** check whether `docs/superpowers/plans/2026-08-13-cancel-refund-policy.md` exists and already added a differently-named/shaped refund method to `PaymentService`. If it did, skip this task and use that method's actual name/signature in Task 11 instead — do not create a duplicate.

- [x] **Step 1: Add the `refundAmount` column**

```ts
// apps/backend/src/payment/entities/payment.entity.ts — add after `status`
@ApiProperty({ required: false, nullable: true })
@Column({
  type: 'decimal',
  precision: 12,
  scale: 2,
  nullable: true,
  transformer: decimalTransformer,
})
refundAmount: number | null;
```

- [x] **Step 2: Generate + run the migration**

```bash
pnpm migration:generate src/database/migrations/AddPaymentRefundAmount
pnpm migration:run
```

- [x] **Step 3: Write the failing test**

```ts
// apps/backend/src/payment/payment.service.spec.ts — add to existing describe block
it('applyRefund() marks the payment REFUNDED, cancels the booking, and notifies the user', async () => {
  const bookingId = faker.string.uuid();
  const payment = {
    id: faker.string.uuid(),
    amount: 200000,
    status: PaymentStatus.PAID,
    booking: { id: bookingId, user: { id: faker.string.uuid() } },
  } as Payment;
  paymentRepo.findOne.mockResolvedValue(payment);
  paymentRepo.save.mockImplementation(async (p) => p as Payment);

  const result = await service.applyRefund(payment.id, 100000, 'Khiếu nại được chấp nhận');

  expect(result.status).toBe(PaymentStatus.REFUNDED);
  expect(result.refundAmount).toBe(100000);
  expect(bookingRepo.update).toHaveBeenCalledWith(bookingId, {
    status: BookingStatus.CANCELLED,
  });
  expect(notificationService.notify).toHaveBeenCalledWith(
    payment.booking.user.id,
    expect.any(String),
    expect.stringContaining('Khiếu nại được chấp nhận'),
  );
});

it('applyRefund() rejects a payment that is not PAID', async () => {
  paymentRepo.findOne.mockResolvedValue({
    id: 'x',
    status: PaymentStatus.PENDING,
  } as Payment);

  await expect(service.applyRefund('x', 1000, 'r')).rejects.toThrow(
    BadRequestException,
  );
});

it('applyRefund() rejects an amount greater than the original payment', async () => {
  paymentRepo.findOne.mockResolvedValue({
    id: 'x',
    amount: 100,
    status: PaymentStatus.PAID,
  } as Payment);

  await expect(service.applyRefund('x', 200, 'r')).rejects.toThrow(
    BadRequestException,
  );
});
```

Check the spec file's existing mock setup for `paymentRepo`, `bookingRepo`, and `notificationService` (constructed for `checkout`/`handleIpn` tests already) and reuse those `DeepMocked` instances rather than re-declaring them.

- [x] **Step 4: Run tests to verify they fail**

```bash
pnpm --filter backend test payment.service.spec.ts
```
Expected: FAIL — `applyRefund` not defined.

- [x] **Step 5: Implement**

```ts
// apps/backend/src/payment/payment.service.ts — add as a new method on PaymentService
async applyRefund(
  paymentId: string,
  amount: number,
  reason: string,
): Promise<Payment> {
  const payment = await this.paymentRepo.findOne({
    where: { id: paymentId },
    relations: { booking: { user: true } },
  });
  if (!payment) {
    throw new NotFoundException('Payment không tồn tại');
  }
  if (payment.status !== PaymentStatus.PAID) {
    throw new BadRequestException('Chỉ có thể hoàn tiền cho đơn đã thanh toán');
  }
  if (amount <= 0 || amount > Number(payment.amount)) {
    throw new BadRequestException('Số tiền hoàn không hợp lệ');
  }

  payment.status = PaymentStatus.REFUNDED;
  payment.refundAmount = amount;
  await this.paymentRepo.save(payment);
  await this.bookingRepo.update(payment.booking.id, {
    status: BookingStatus.CANCELLED,
  });

  try {
    await this.notificationService.notify(
      payment.booking.user.id,
      'Hoàn tiền đơn đặt sân',
      `Bạn đã được hoàn ${amount.toLocaleString('vi-VN')}đ. Lý do: ${reason}`,
    );
  } catch {
    // Swallow: notification is best-effort, refund must not roll back.
  }

  return payment;
}
```

- [x] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter backend test payment.service.spec.ts
```
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add apps/backend/src/payment apps/backend/src/database/migrations/
git commit -m "feat(backend): add PaymentService.applyRefund"
```

---

## Task 9: Wire `SystemConfig` into the cancellation refund calculation (conditional)

**Files:**
- Modify: `apps/backend/src/booking/booking.service.ts` (only if the refund calculation already exists there)

**Interfaces:**
- Consumes: `SystemConfigService.get()` from Task 7.

**Before writing:** open `apps/backend/src/booking/booking.service.ts` and check the current `cancel()` method (and check for `docs/superpowers/plans/2026-08-13-cancel-refund-policy.md`).

- **If `cancel()` still has no refund logic** (i.e. the cancel-refund-policy plan hasn't been executed yet): skip this task entirely — leave a one-line note in the commit-less state ("Task 9 skipped: no refund calculation exists yet to wire SystemConfig into") and move to Task 10. Do not invent a refund calculation here; that belongs to the other plan.
- **If `cancel()` (or a helper it calls) already computes a refund percentage from hardcoded hour thresholds**: inject `SystemConfigService` into `BookingService`'s constructor (mirror how `RedisService`/`RealtimeGateway` are already injected there), replace the hardcoded threshold constants with `const config = await this.systemConfigService.get();` and use `config.cancellationFullRefundHours`, `config.cancellationPartialRefundHours`, `config.cancellationPartialRefundPercent` in place of the constants. Update `booking.service.spec.ts`'s existing refund-calculation tests to mock `SystemConfigService.get()` returning the same default values (24h/2h/50%) so existing test expectations are unchanged, run `pnpm --filter backend test booking.service.spec.ts`, confirm PASS, then commit:

```bash
git add apps/backend/src/booking/booking.service.ts apps/backend/src/booking/booking.service.spec.ts
git commit -m "feat(backend): read cancellation refund thresholds from SystemConfig"
```

---

## Task 10: `DisputeStatus` enum + `Dispute` entity + migration

**Files:**
- Create: `packages/shared/src/enums/dispute-status.enum.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/backend/src/dispute/entities/dispute.entity.ts`
- Create (via CLI): `apps/backend/src/database/migrations/<timestamp>-CreateDispute.ts`

**Interfaces:**
- Produces: `DisputeStatus` enum (`OPEN`, `RESOLVED`, `REJECTED`), `Dispute` entity.

- [x] **Step 1: Add the shared enum**

```ts
// packages/shared/src/enums/dispute-status.enum.ts
export enum DisputeStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}
```

Add `export * from './enums/dispute-status.enum';` to `packages/shared/src/index.ts`, matching the existing enum export lines.

- [x] **Step 2: Create the entity**

```ts
// apps/backend/src/dispute/entities/dispute.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import { Booking } from '../../booking/entities/booking.entity';
import { User } from '../../user/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('disputes')
export class Dispute {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ type: () => Booking })
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User)
  @JoinColumn({ name: 'raised_by_id' })
  raisedBy: User;

  @ApiProperty()
  @Column({ type: 'text' })
  reason: string;

  @ApiProperty({ enum: DisputeStatus })
  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  resolutionNote: string | null;

  @ApiProperty({ required: false, nullable: true, type: () => User })
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User | null;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [x] **Step 3: Generate + run the migration**

```bash
pnpm migration:generate src/database/migrations/CreateDispute
pnpm migration:run
```
Expected: creates `disputes` table with FKs to `bookings`/`users` and the `dispute_status_enum` Postgres enum type.

- [x] **Step 4: Commit**

```bash
git add packages/shared/src apps/backend/src/dispute apps/backend/src/database/migrations/
git commit -m "feat: add Dispute entity and DisputeStatus enum"
```

---

## Task 11: `DisputeService` — create, list, resolve

**Files:**
- Create (via CLI, then edit): `apps/backend/src/dispute/dispute.service.ts`, `dispute.module.ts`
- Create: `apps/backend/src/dispute/dto/create-dispute.dto.ts`, `apps/backend/src/dispute/dto/resolve-dispute.dto.ts`
- Test: `apps/backend/src/dispute/dispute.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Booking`, `Dispute` entities, `PaymentService.applyRefund` (Task 8), `AuthenticatedUser` interface.
- Produces: `DisputeService.create(userId: string, dto: CreateDisputeDto): Promise<Dispute>`, `DisputeService.findAll(status?: DisputeStatus): Promise<Dispute[]>`, `DisputeService.resolve(id: string, adminId: string, dto: ResolveDisputeDto): Promise<Dispute>` — consumed by Task 12's controller.

- [x] **Step 1: Scaffold via CLI**

From `apps/backend`:
```bash
nest g resource dispute --no-spec
```
Choose "REST API", answer "N" to CRUD generation. Move Task 10's entity into the generated `dispute/entities/` folder if it landed elsewhere; delete the generated placeholder `dto/create-dispute.dto.ts` / `dto/update-dispute.dto.ts` before writing the real ones below.

- [x] **Step 2: Write the DTOs**

```ts
// apps/backend/src/dispute/dto/create-dispute.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  reason: string;
}
```

```ts
// apps/backend/src/dispute/dto/resolve-dispute.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DisputeStatus } from '@sportspace/shared';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class ResolveDisputeDto {
  @ApiProperty({ enum: DisputeStatus })
  @IsIn([DisputeStatus.RESOLVED, DisputeStatus.REJECTED])
  status: DisputeStatus.RESOLVED | DisputeStatus.REJECTED;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  resolutionNote: string;

  @ApiPropertyOptional({
    description: 'Số tiền hoàn (VNĐ), chỉ áp dụng khi status=RESOLVED',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  refundAmount?: number;
}
```

(`IsEnum` import above is unused if `IsIn` is used instead — drop the `IsEnum` import when writing the file.)

- [x] **Step 3: Write the failing tests**

```ts
// apps/backend/src/dispute/dispute.service.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisputeStatus } from '@sportspace/shared';
import { Repository } from 'typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { Dispute } from './entities/dispute.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentService } from '../payment/payment.service';

describe('DisputeService', () => {
  let service: DisputeService;
  let disputeRepo: DeepMocked<Repository<Dispute>>;
  let bookingRepo: DeepMocked<Repository<Booking>>;
  let paymentRepo: DeepMocked<Repository<Payment>>;
  let paymentService: DeepMocked<PaymentService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: getRepositoryToken(Dispute), useValue: createMock<Repository<Dispute>>() },
        { provide: getRepositoryToken(Booking), useValue: createMock<Repository<Booking>>() },
        { provide: getRepositoryToken(Payment), useValue: createMock<Repository<Payment>>() },
        { provide: PaymentService, useValue: createMock<PaymentService>() },
      ],
    }).compile();

    service = module.get(DisputeService);
    disputeRepo = module.get(getRepositoryToken(Dispute));
    bookingRepo = module.get(getRepositoryToken(Booking));
    paymentRepo = module.get(getRepositoryToken(Payment));
    paymentService = module.get(PaymentService);
  });

  it('create() rejects a booking the caller does not own', async () => {
    const userId = faker.string.uuid();
    bookingRepo.findOne.mockResolvedValue({
      id: 'b1',
      user: { id: faker.string.uuid() },
    } as Booking);

    await expect(
      service.create(userId, { bookingId: 'b1', reason: 'Sân không đạt chuẩn' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create() saves an OPEN dispute for the owning player', async () => {
    const userId = faker.string.uuid();
    bookingRepo.findOne.mockResolvedValue({ id: 'b1', user: { id: userId } } as Booking);
    disputeRepo.create.mockImplementation((v) => v as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);

    const result = await service.create(userId, {
      bookingId: 'b1',
      reason: 'Sân không đạt chuẩn',
    });

    expect(result.status).toBe(DisputeStatus.OPEN);
  });

  it('resolve() rejects resolving an already-resolved dispute', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.RESOLVED,
    } as Dispute);

    await expect(
      service.resolve('d1', 'admin1', {
        status: DisputeStatus.REJECTED,
        resolutionNote: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resolve() with REJECTED status does not call applyRefund', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.OPEN,
      booking: { id: 'b1' },
    } as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);

    await service.resolve('d1', 'admin1', {
      status: DisputeStatus.REJECTED,
      resolutionNote: 'Không đủ căn cứ',
    });

    expect(paymentService.applyRefund).not.toHaveBeenCalled();
  });

  it('resolve() with RESOLVED status + refundAmount calls applyRefund on the booking payment', async () => {
    disputeRepo.findOne.mockResolvedValue({
      id: 'd1',
      status: DisputeStatus.OPEN,
      booking: { id: 'b1' },
    } as Dispute);
    disputeRepo.save.mockImplementation(async (d) => d as Dispute);
    paymentRepo.findOne.mockResolvedValue({ id: 'p1' } as Payment);

    await service.resolve('d1', 'admin1', {
      status: DisputeStatus.RESOLVED,
      resolutionNote: 'Khiếu nại hợp lệ',
      refundAmount: 100000,
    });

    expect(paymentService.applyRefund).toHaveBeenCalledWith(
      'p1',
      100000,
      'Khiếu nại hợp lệ',
    );
  });
});
```

- [x] **Step 4: Run tests to verify they fail**

```bash
pnpm --filter backend test dispute.service.spec.ts
```
Expected: FAIL — `DisputeService` still has the generated stub methods.

- [x] **Step 5: Implement**

```ts
// apps/backend/src/dispute/dispute.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DisputeStatus } from '@sportspace/shared';
import { Repository } from 'typeorm';
import { Dispute } from './entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class DisputeService {
  constructor(
    @InjectRepository(Dispute) private readonly disputeRepo: Repository<Dispute>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    private readonly paymentService: PaymentService,
  ) {}

  async create(userId: string, dto: CreateDisputeDto): Promise<Dispute> {
    const booking = await this.bookingRepo.findOne({
      where: { id: dto.bookingId },
      relations: { user: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking không tồn tại');
    }
    if (booking.user.id !== userId) {
      throw new ForbiddenException('Bạn không có quyền khiếu nại đơn này');
    }

    const dispute = this.disputeRepo.create({
      booking,
      raisedBy: { id: userId } as never,
      reason: dto.reason,
      status: DisputeStatus.OPEN,
    });
    return this.disputeRepo.save(dispute);
  }

  async findAll(status?: DisputeStatus): Promise<Dispute[]> {
    return this.disputeRepo.find({
      where: status ? { status } : {},
      relations: { booking: true, raisedBy: true },
      order: { createdAt: 'DESC' },
    });
  }

  async resolve(
    id: string,
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: { booking: true },
    });
    if (!dispute) {
      throw new NotFoundException('Khiếu nại không tồn tại');
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException('Khiếu nại đã được xử lý');
    }

    if (dto.status === DisputeStatus.RESOLVED && dto.refundAmount) {
      const payment = await this.paymentRepo.findOne({
        where: { booking: { id: dispute.booking.id } },
      });
      if (!payment) {
        throw new BadRequestException('Đơn đặt sân chưa có giao dịch thanh toán');
      }
      await this.paymentService.applyRefund(
        payment.id,
        dto.refundAmount,
        dto.resolutionNote,
      );
    }

    dispute.status = dto.status;
    dispute.resolutionNote = dto.resolutionNote;
    dispute.resolvedBy = { id: adminId } as never;
    return this.disputeRepo.save(dispute);
  }
}
```

- [x] **Step 6: Run tests to verify they pass**

```bash
pnpm --filter backend test dispute.service.spec.ts
```
Expected: PASS.

- [x] **Step 7: Write the module**

```ts
// apps/backend/src/dispute/dispute.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeService } from './dispute.service';
import { DisputeController } from './dispute.controller';
import { Dispute } from './entities/dispute.entity';
import { Booking } from '../booking/entities/booking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dispute, Booking, Payment]),
    PaymentModule,
  ],
  controllers: [DisputeController],
  providers: [DisputeService],
})
export class DisputeModule {}
```

Check `apps/backend/src/payment/payment.module.ts` exports `PaymentService` (add `exports: [PaymentService]` there if it doesn't already — needed for `DisputeModule` to inject it).

Register in `apps/backend/src/app.module.ts`: import and add `DisputeModule` to `imports`.

- [x] **Step 8: Commit**

```bash
git add apps/backend/src/dispute apps/backend/src/payment/payment.module.ts apps/backend/src/app.module.ts
git commit -m "feat(backend): add DisputeService create/findAll/resolve"
```

---

## Task 12: `DisputeController`

**Files:**
- Create (edit generated file): `apps/backend/src/dispute/dispute.controller.ts`
- Test: `apps/backend/src/dispute/dispute.controller.spec.ts`

**Interfaces:**
- Consumes: `DisputeService.create/findAll/resolve` from Task 11.
- Produces: `POST /disputes` (any authenticated user — service enforces ownership), `GET /disputes` (ADMIN, optional `?status=`), `PATCH /disputes/:id/resolve` (ADMIN).

- [x] **Step 1: Write the failing tests**

```ts
// apps/backend/src/dispute/dispute.controller.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { Test, TestingModule } from '@nestjs/testing';
import { DisputeStatus } from '@sportspace/shared';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { Dispute } from './entities/dispute.entity';

describe('DisputeController', () => {
  let controller: DisputeController;
  let service: DeepMocked<DisputeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController],
      providers: [{ provide: DisputeService, useValue: createMock<DisputeService>() }],
    }).compile();

    controller = module.get(DisputeController);
    service = module.get(DisputeService);
  });

  it('create() forwards the authenticated userId + dto', async () => {
    const userId = faker.string.uuid();
    const dto = { bookingId: 'b1', reason: 'Sân bẩn, không đúng mô tả' };

    await controller.create(userId, dto);

    expect(service.create).toHaveBeenCalledWith(userId, dto);
  });

  it('findAll() forwards the status query param', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll(DisputeStatus.OPEN);

    expect(service.findAll).toHaveBeenCalledWith(DisputeStatus.OPEN);
  });

  it('resolve() forwards id + adminId + dto', async () => {
    const adminId = faker.string.uuid();
    const dto = { status: DisputeStatus.REJECTED, resolutionNote: 'Không đủ căn cứ' };

    await controller.resolve('d1', adminId, dto);

    expect(service.resolve).toHaveBeenCalledWith('d1', adminId, dto);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter backend test dispute.controller.spec.ts
```
Expected: FAIL.

- [x] **Step 3: Implement**

```ts
// apps/backend/src/dispute/dispute.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { DisputeStatus, Role } from '@sportspace/shared';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Dispute } from './entities/dispute.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo khiếu nại cho một đơn đặt sân của chính mình' })
  @ApiCreatedResponse({ type: Dispute })
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisputeDto,
  ): Promise<Dispute> {
    return this.disputeService.create(userId, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Danh sách khiếu nại' })
  @ApiOkResponse({ type: [Dispute] })
  findAll(@Query('status') status?: DisputeStatus): Promise<Dispute[]> {
    return this.disputeService.findAll(status);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Xử lý khiếu nại (chấp nhận/từ chối, có thể hoàn tiền)' })
  @ApiOkResponse({ type: Dispute })
  resolve(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<Dispute> {
    return this.disputeService.resolve(id, adminId, dto);
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter backend test dispute.controller.spec.ts
```
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/backend/src/dispute/dispute.controller.ts apps/backend/src/dispute/dispute.controller.spec.ts
git commit -m "feat(backend): add dispute create/list/resolve endpoints"
```

---

## Task 13: e2e — dispute create + resolve-with-refund flow

**Files:**
- Create: `apps/backend/test/dispute.e2e-spec.ts`

**Interfaces:**
- Consumes: `/disputes`, `/disputes/:id/resolve`, plus the existing venue/court/booking/payment e2e setup pattern from `venue.e2e-spec.ts`.

- [x] **Step 1: Write the e2e test**

```ts
// apps/backend/test/dispute.e2e-spec.ts
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BookingStatus, DisputeStatus, PaymentStatus, Role } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { Court } from '../src/venue/entities/court.entity';
import { Booking } from '../src/booking/entities/booking.entity';
import { Payment } from '../src/payment/entities/payment.entity';
import { Dispute } from '../src/dispute/entities/dispute.entity';

const SEED_PASSWORD = 'Password123!';

describe('Dispute (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let admin: User;
  let player: User;
  let merchant: User;
  let adminToken: string;
  let playerToken: string;
  let venueId: string;
  let courtId: string;
  let bookingId: string;
  let paymentId: string;
  let disputeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    admin = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.ADMIN,
    });
    merchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.MERCHANT,
    });
    player = await dataSource.getRepository(User).save({
      email: faker.internet.email(), passwordHash,
      fullName: faker.person.fullName(), role: Role.PLAYER,
    });

    const venue = await dataSource.getRepository(Venue).save({
      owner: merchant, name: 'Sân test', address: 'Q1', lat: 10.77, lng: 106.7,
      status: 'APPROVED',
    });
    venueId = venue.id;
    const court = await dataSource.getRepository(Court).save({
      venue, name: 'Sân 1', sport: 'FOOTBALL', basePrice: 200000,
    });
    courtId = court.id;
    const booking = await dataSource.getRepository(Booking).save({
      court, user: player, bookingDate: '2026-09-01', startTime: '10:00',
      endTime: '11:00', status: BookingStatus.CONFIRMED, totalAmount: 200000,
    });
    bookingId = booking.id;
    const payment = await dataSource.getRepository(Payment).save({
      booking, provider: 'VNPAY', amount: 200000, status: PaymentStatus.PAID,
      transactionRef: faker.string.alphanumeric(10),
    });
    paymentId = payment.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login').send({ email, password: SEED_PASSWORD }).expect(200);
      return res.body.accessToken as string;
    };
    adminToken = await login(admin.email);
    playerToken = await login(player.email);
  });

  afterAll(async () => {
    if (disputeId) await dataSource.getRepository(Dispute).delete({ id: disputeId });
    if (paymentId) await dataSource.getRepository(Payment).delete({ id: paymentId });
    if (bookingId) await dataSource.getRepository(Booking).delete({ id: bookingId });
    if (courtId) await dataSource.getRepository(Court).delete({ id: courtId });
    if (venueId) await dataSource.getRepository(Venue).delete({ id: venueId });
    await dataSource.getRepository(User).delete({ id: admin.id });
    await dataSource.getRepository(User).delete({ id: merchant.id });
    await dataSource.getRepository(User).delete({ id: player.id });
    await app.close();
  });

  it('lets the player create a dispute on their own booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/disputes')
      .set('Authorization', `Bearer ${playerToken}`)
      .send({ bookingId, reason: 'Sân không đúng như mô tả trên hệ thống' })
      .expect(201);
    disputeId = res.body.id;
    expect(res.body.status).toBe(DisputeStatus.OPEN);
  });

  it('rejects listing/resolving disputes by a non-ADMIN (403)', async () => {
    await request(app.getHttpServer())
      .get('/disputes').set('Authorization', `Bearer ${playerToken}`).expect(403);
  });

  it('lets an ADMIN resolve the dispute with a refund, marking the payment REFUNDED', async () => {
    const resolveRes = await request(app.getHttpServer())
      .patch(`/disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: DisputeStatus.RESOLVED,
        resolutionNote: 'Khiếu nại hợp lý, hoàn tiền toàn bộ',
        refundAmount: 200000,
      })
      .expect(200);
    expect(resolveRes.body.status).toBe(DisputeStatus.RESOLVED);

    const payment = await dataSource.getRepository(Payment).findOne({ where: { id: paymentId } });
    expect(payment?.status).toBe(PaymentStatus.REFUNDED);

    const booking = await dataSource.getRepository(Booking).findOne({ where: { id: bookingId } });
    expect(booking?.status).toBe(BookingStatus.CANCELLED);
  });
});
```

- [x] **Step 2: Run and verify it passes**

```bash
pnpm --filter backend test:e2e dispute.e2e-spec.ts
```
Expected: PASS (3 tests). If `Court`'s required columns differ from the literal above (e.g. `sport` is an enum with different values, `basePrice` field name differs), check `apps/backend/src/venue/entities/court.entity.ts` first and adjust the fixture to match — do not guess.

- [x] **Step 3: Commit**

```bash
git add apps/backend/test/dispute.e2e-spec.ts
git commit -m "test(backend): e2e coverage for dispute create + resolve-with-refund"
```

---

## Task 14: Regenerate the shared API client

**Files:**
- Regenerates: `packages/shared/src/generated/**` (or wherever `orval.config.ts` points — check the config file, don't guess the path)

- [x] **Step 1: Run the generator**

From the repo root:
```bash
pnpm generate:api
```
Expected: no errors; git diff shows new generated types/functions for `users` (findAll/lock/unlock), `disputes` (create/findAll/resolve), `system-config` (get/update).

- [x] **Step 2: Typecheck the web app against the new client**

```bash
pnpm --filter web tsc --noEmit
```
Expected: PASS (nothing in `apps/web` references the new endpoints yet, so this just confirms the generated client itself compiles).

- [x] **Step 3: Commit**

```bash
git add packages/shared
git commit -m "chore: regenerate API client for admin operations endpoints"
```

---

## Task 15: Web — `/admin/users` page (list, lock, unlock)

**Files:**
- Create: `apps/web/src/app/admin/users/page.tsx`
- Create: `apps/web/src/app/admin/users/actions.ts`
- Modify: `apps/web/src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: the orval-generated `users` client namespace from Task 14 (exact method names come from the generated file — check it, they'll be something like `usersControllerFindAll`, `usersControllerLock`, `usersControllerUnlock`, mirroring the `venueControllerApprove` naming pattern already used in `apps/web/src/app/admin/venues/actions.ts`).

- [x] **Step 1: Add the nav item**

```ts
// apps/web/src/app/admin/layout.tsx — replace NAV_ITEMS
const NAV_ITEMS = [
  { href: '/admin', label: 'Tổng quan' },
  { href: '/admin/venues', label: 'Duyệt sân' },
  { href: '/admin/users', label: 'Người dùng' },
  { href: '/admin/disputes', label: 'Khiếu nại' },
  { href: '/admin/config', label: 'Cấu hình hệ thống' },
];
```

- [x] **Step 2: Write the server actions**

```ts
// apps/web/src/app/admin/users/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

async function setLocked(userId: string, locked: boolean): Promise<void> {
  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  try {
    if (locked) {
      await users.usersControllerLock(userId);
    } else {
      await users.usersControllerUnlock(userId);
    }
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/users');
}

export async function lockUser(userId: string): Promise<void> {
  await setLocked(userId, true);
}

export async function unlockUser(userId: string): Promise<void> {
  await setLocked(userId, false);
}
```

Check the generated client (`packages/shared`) for the exact `users` namespace method names before writing this file — if they differ from `usersControllerLock`/`usersControllerUnlock`/`usersControllerFindAll`, use the generated names.

- [x] **Step 3: Write the page**

```tsx
// apps/web/src/app/admin/users/page.tsx
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { lockUser, unlockUser } from './actions';

export default async function AdminUsersPage() {
  const session = await requireSession();
  const { users } = createAuthenticatedApiClient(session.accessToken);

  let allUsers;
  try {
    const { data } = await users.usersControllerFindAll();
    allUsers = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Người dùng</h1>

      <div className="flex flex-col gap-3">
        {allUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">{user.fullName}</p>
              <p className="text-zinc-500">{user.email} — {user.role}</p>
              {user.isLocked && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  Đã khóa
                </p>
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
    </div>
  );
}
```

- [x] **Step 4: Manually verify in the browser**

```bash
pnpm --filter web dev
```
Log in as an ADMIN user, visit `/admin/users`, confirm the list renders and the lock/unlock button flips state and persists on reload.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/app/admin/users apps/web/src/app/admin/layout.tsx
git commit -m "feat(web): add admin users list with lock/unlock"
```

---

## Task 16: Web — `/admin/disputes` page (list, resolve)

**Files:**
- Create: `apps/web/src/app/admin/disputes/page.tsx`
- Create: `apps/web/src/app/admin/disputes/actions.ts`

**Interfaces:**
- Consumes: the generated `disputes` client namespace from Task 14.

- [x] **Step 1: Write the server action**

```ts
// apps/web/src/app/admin/disputes/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DisputeStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

export async function resolveDispute(
  disputeId: string,
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  const status = formData.get('status') as DisputeStatus.RESOLVED | DisputeStatus.REJECTED;
  const resolutionNote = String(formData.get('resolutionNote') ?? '');
  const refundAmountRaw = formData.get('refundAmount');
  const refundAmount = refundAmountRaw ? Number(refundAmountRaw) : undefined;

  try {
    await disputes.disputesControllerResolve(disputeId, {
      status,
      resolutionNote,
      refundAmount,
    });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/disputes');
}
```

Check the generated client for exact method names (`disputesControllerFindAll`, `disputesControllerResolve`) before writing — adjust if the generator produced different names.

- [x] **Step 2: Write the page**

```tsx
// apps/web/src/app/admin/disputes/page.tsx
import { DisputeStatus } from '@sportspace/shared';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { resolveDispute } from './actions';

export default async function AdminDisputesPage() {
  const session = await requireSession();
  const { disputes } = createAuthenticatedApiClient(session.accessToken);

  let openDisputes;
  try {
    const { data } = await disputes.disputesControllerFindAll({
      status: DisputeStatus.OPEN,
    });
    openDisputes = data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khiếu nại</h1>

      {openDisputes.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Không có khiếu nại nào đang chờ xử lý.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {openDisputes.map((dispute) => (
          <div
            key={dispute.id}
            className="flex flex-col gap-3 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800"
          >
            <p className="font-medium">Đơn #{dispute.booking.id}</p>
            <p className="text-zinc-600 dark:text-zinc-400">{dispute.reason}</p>
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
                  value={DisputeStatus.RESOLVED}
                  className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                >
                  Chấp nhận
                </button>
                <button
                  type="submit"
                  name="status"
                  value={DisputeStatus.REJECTED}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800 dark:text-red-400"
                >
                  Từ chối
                </button>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [x] **Step 3: Manually verify in the browser**

Log in as ADMIN, visit `/admin/disputes`, confirm a dispute created via the API shows up and resolving it (with a refund amount) removes it from the OPEN list on reload.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/disputes
git commit -m "feat(web): add admin disputes list with resolve action"
```

---

## Task 17: Web — `/admin/config` page (edit system config)

**Files:**
- Create: `apps/web/src/app/admin/config/page.tsx`
- Create: `apps/web/src/app/admin/config/actions.ts`

**Interfaces:**
- Consumes: the generated `system-config` client namespace from Task 14.

- [x] **Step 1: Write the server action**

```ts
// apps/web/src/app/admin/config/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

export async function updateSystemConfig(formData: FormData): Promise<void> {
  const session = await requireSession();
  const { systemConfig } = createAuthenticatedApiClient(session.accessToken);

  const num = (key: string) => Number(formData.get(key));

  try {
    await systemConfig.systemConfigControllerUpdate({
      cancellationFullRefundHours: num('cancellationFullRefundHours'),
      cancellationPartialRefundHours: num('cancellationPartialRefundHours'),
      cancellationPartialRefundPercent: num('cancellationPartialRefundPercent'),
      platformCommissionPercent: num('platformCommissionPercent'),
    });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath('/admin/config');
}
```

Check the generated client for the exact namespace/method names (`systemConfig.systemConfigControllerGet` / `systemConfigControllerUpdate`) before writing — adjust to match.

- [x] **Step 2: Write the page**

```tsx
// apps/web/src/app/admin/config/page.tsx
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { updateSystemConfig } from './actions';

export default async function AdminConfigPage() {
  const session = await requireSession();
  const { systemConfig } = createAuthenticatedApiClient(session.accessToken);

  let config;
  try {
    const { data } = await systemConfig.systemConfigControllerGet();
    config = data;
  } catch (err) {
    handleApiError(err);
  }

  const field = (name: string, label: string, value: number) => (
    <label className="flex flex-col gap-1 text-sm" key={name}>
      {label}
      <input
        type="number"
        name={name}
        defaultValue={value}
        min={0}
        className="rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Cấu hình hệ thống</h1>
      <form action={updateSystemConfig} className="flex max-w-md flex-col gap-4">
        {field(
          'cancellationFullRefundHours',
          'Hoàn 100% nếu hủy trước (giờ)',
          config.cancellationFullRefundHours,
        )}
        {field(
          'cancellationPartialRefundHours',
          'Hoàn một phần nếu hủy trước (giờ)',
          config.cancellationPartialRefundHours,
        )}
        {field(
          'cancellationPartialRefundPercent',
          'Tỷ lệ hoàn một phần (%)',
          config.cancellationPartialRefundPercent,
        )}
        {field(
          'platformCommissionPercent',
          'Hoa hồng nền tảng (%)',
          config.platformCommissionPercent,
        )}
        <button
          type="submit"
          className="self-start rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Lưu
        </button>
      </form>
    </div>
  );
}
```

- [x] **Step 3: Manually verify in the browser**

Log in as ADMIN, visit `/admin/config`, change a value, submit, reload, confirm the new value persisted.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/config
git commit -m "feat(web): add admin system config editor"
```

---

## Self-Review Notes

- **Spec coverage:** FR-A02 (Tasks 1-5, 15), FR-A03 (Tasks 8, 10-13, 16), FR-A04 (Tasks 6-7, 9, 17) all covered. Cancellation-policy integration (Task 9) is explicitly conditional since it depends on a sibling plan.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `DisputeStatus`, `Dispute`, `SystemConfig`, `UserService.setLocked`, `PaymentService.applyRefund` signatures are identical everywhere they're referenced across tasks.

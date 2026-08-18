# Add-on Services (FR-P05) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant manage a per-venue catalog of add-on services (e.g. cho thuê bóng, nước uống), let a player select services + quantity when booking, and fold the cost into `totalAmount`.

**Architecture:** New `addon-services` NestJS module owning two entities — `AddOnService` (the catalog) and `BookingServiceItem` (a line item snapshotting price at booking time). `BookingService.create()` resolves selected services inside its existing `withSlotLock` transaction, validates they belong to the booked court's venue, and adds their cost to `totalAmount`. Web gets a new merchant catalog page mirroring the Staff directory page. Mobile threads `venueId` through the venue→court→booking navigation chain (it isn't currently passed) so `BookingConfirmScreen` can fetch the venue's services.

**Tech Stack:** NestJS + TypeORM (backend), Next.js App Router (web), React Native (mobile), class-validator/class-transformer for nested DTO validation.

## Global Constraints

- TypeScript strict; camelCase vars/functions, PascalCase classes/types.
- Vietnamese git commit messages, ZERO AI/Claude/Co-Authored-By attribution ever (hard standing project rule).
- No hand-written DB migrations — generate via `pnpm run migration:generate` from `apps/backend`.
- TDD: write the failing test before the implementation.
- Scaffold via CLI (`nest g resource ...`) per project rule §0.2 — don't hand-write module/controller/service skeletons.
- Consult Context7 before writing framework-specific code you're not 100% certain of (already done for this plan's nested-array validation pattern — see Task 4).
- No adding/removing services from an already-`CONFIRMED` booking — selection is create-time only.
- No per-court services — venue-scoped only.
- This module intentionally has NO pagination on `GET /addon-services` — a venue's service catalog is small (unlike Users/Bookings), and the spec doesn't ask for it. Don't add it.

---

## File Structure

**Backend — new module:**
- `apps/backend/src/addon-services/entities/add-on-service.entity.ts`
- `apps/backend/src/addon-services/entities/booking-service-item.entity.ts`
- `apps/backend/src/addon-services/dto/create-addon-service.dto.ts`
- `apps/backend/src/addon-services/dto/update-addon-service.dto.ts`
- `apps/backend/src/addon-services/addon-services.service.ts` (+ `.spec.ts`)
- `apps/backend/src/addon-services/addon-services.controller.ts` (+ `.spec.ts`)
- `apps/backend/src/addon-services/addon-services.module.ts`
- `apps/backend/src/database/migrations/*-AddAddOnServiceAndBookingServiceItem.ts` (generated)

**Backend — booking integration (modified):**
- `apps/backend/src/booking/dto/create-booking.dto.ts` (+ new `apps/backend/src/booking/dto/booking-service-input.dto.ts`)
- `apps/backend/src/booking/entities/booking.entity.ts`
- `apps/backend/src/booking/booking.service.ts` (+ `.spec.ts`)
- `apps/backend/src/booking/booking.module.ts`
- `apps/backend/test/booking.e2e-spec.ts`

**Web — new page:**
- `apps/web/src/app/merchant/venues/[venueId]/services/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/services/actions.ts` (+ `.test.ts`)
- `apps/web/src/app/merchant/venues/[venueId]/services/service-form.tsx` (+ `.test.tsx`)
- `apps/web/src/app/merchant/venues/[venueId]/services/error.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/services/loading.tsx`

**Mobile — modified:**
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`
- `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx`
- `apps/mobile/src/screens/venues/BookingConfirmScreen.tsx` (+ `__tests__/BookingConfirmScreen.test.tsx`)
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/test-utils/server.ts`

---

### Task 1: Scaffold `addon-services` module, entities, migration

**Files:**
- Create (via CLI): `apps/backend/src/addon-services/*` (controller/service/module skeletons)
- Create: `apps/backend/src/addon-services/entities/add-on-service.entity.ts`
- Create: `apps/backend/src/addon-services/entities/booking-service-item.entity.ts`
- Create (generated): `apps/backend/src/database/migrations/*-AddAddOnServiceAndBookingServiceItem.ts`

**Interfaces:**
- Produces: `AddOnService { id, venue: Venue, name: string, price: number, description: string | null, isActive: boolean, createdAt, updatedAt }`. `BookingServiceItem { id, booking: Booking, addOnService: AddOnService, quantity: number, unitPrice: number, createdAt }`.

- [ ] **Step 1: Scaffold the module via CLI**

Run: `cd apps/backend && nest g resource addon-services`
When prompted: transport layer `REST API`, generate CRUD entry points `Yes`.
Expected: creates `apps/backend/src/addon-services/{addon-services.controller.ts, addon-services.service.ts, addon-services.module.ts, dto/, entities/}` plus matching `.spec.ts` files, and registers `AddOnServicesModule` in `apps/backend/src/app.module.ts`.

- [ ] **Step 2: Replace the generated entity with `AddOnService`**

Delete the CLI's placeholder entity file and create:

```typescript
// apps/backend/src/addon-services/entities/add-on-service.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Venue } from '../../venue/entities/venue.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('add_on_services')
export class AddOnService {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): mirrors Staff.venue / Court.venue — avoids a
  // circular reference in the orval-generated type.
  @ManyToOne(() => Venue)
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  price: number;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
```

- [ ] **Step 3: Create the `BookingServiceItem` entity**

```typescript
// apps/backend/src/addon-services/entities/booking-service-item.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Booking } from '../../booking/entities/booking.entity';
import { AddOnService } from './add-on-service.entity';
import { decimalTransformer } from '../../database/decimal.transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('booking_services')
export class BookingServiceItem {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // No @ApiProperty(): back-reference to the parent Booking, same rule as
  // Court.venue / Staff.venue — avoids a circular type in the generated client.
  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ApiProperty({ type: () => AddOnService })
  @ManyToOne(() => AddOnService)
  @JoinColumn({ name: 'add_on_service_id' })
  addOnService: AddOnService;

  @ApiProperty()
  @Column({ type: 'int' })
  quantity: number;

  // Snapshot of AddOnService.price at booking time — a later price change
  // must not retroactively alter historical bookings' totals.
  @ApiProperty()
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 4: Register `BookingServiceItem` in the module and generate the migration**

```typescript
// apps/backend/src/addon-services/addon-services.module.ts — full file
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddonServicesService } from './addon-services.service';
import { AddonServicesController } from './addon-services.controller';
import { AddOnService } from './entities/add-on-service.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AddOnService, BookingServiceItem])],
  controllers: [AddonServicesController],
  providers: [AddonServicesService],
})
export class AddonServicesModule {}
```

(The CLI names the generated class `AddonServicesService`/`AddonServicesController` — case exactly as `nest g resource addon-services` produces it; don't rename to `AddOnServicesService`, keep whatever the CLI actually generated so imports stay consistent. Check the CLI's actual output and adjust this file to match if it differs.)

Run: `cd apps/backend && pnpm run migration:generate src/database/migrations/AddAddOnServiceAndBookingServiceItem`
Expected: a new file `src/database/migrations/<timestamp>-AddAddOnServiceAndBookingServiceItem.ts` creating both `add_on_services` and `booking_services` tables with FKs to `venues`, `bookings`, and `add_on_services`.

Run: `cd apps/backend && pnpm run migration:run`
Expected: migration applies cleanly against the dev DB.

- [ ] **Step 5: Verify build**

Run: `cd apps/backend && pnpm exec tsc --noEmit`
Expected: no errors (CLI-generated DTOs/controller/service are still placeholders at this point — that's fine, Task 2 replaces them).

- [ ] **Step 6: Commit**

```bash
cd apps/backend && git add src/addon-services src/app.module.ts src/database/migrations
git commit -m "feat(backend): scaffold module dịch vụ đi kèm và thêm bảng add_on_services, booking_services"
```

---

### Task 2: `AddonServicesService` CRUD + ownership

**Files:**
- Create: `apps/backend/src/addon-services/dto/create-addon-service.dto.ts`
- Create: `apps/backend/src/addon-services/dto/update-addon-service.dto.ts`
- Modify: `apps/backend/src/addon-services/addon-services.service.ts`
- Test: `apps/backend/src/addon-services/addon-services.service.spec.ts`

**Interfaces:**
- Consumes: `AddOnService` entity from Task 1.
- Produces: `AddonServicesService.create(dto: CreateAddOnServiceDto, user: AuthenticatedUser): Promise<AddOnService>`. `.findAll(venueId: string): Promise<AddOnService[]>`. `.findOne(id: string): Promise<AddOnService>`. `.update(id: string, dto: UpdateAddOnServiceDto, user: AuthenticatedUser): Promise<AddOnService>`. `.remove(id: string, user: AuthenticatedUser): Promise<void>`.

- [ ] **Step 1: Write the DTOs**

```typescript
// apps/backend/src/addon-services/dto/create-addon-service.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class CreateAddOnServiceDto {
  @ApiProperty()
  @IsUUID()
  venueId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
```

```typescript
// apps/backend/src/addon-services/dto/update-addon-service.dto.ts
import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAddOnServiceDto } from './create-addon-service.dto';

export class UpdateAddOnServiceDto extends PartialType(
  OmitType(CreateAddOnServiceDto, ['venueId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

- [ ] **Step 2: Write the failing unit tests**

```typescript
// apps/backend/src/addon-services/addon-services.service.spec.ts
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { faker } from '@faker-js/faker';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { AddonServicesService } from './addon-services.service';
import { AddOnService } from './entities/add-on-service.entity';
import { Venue } from '../venue/entities/venue.entity';
import { User } from '../user/entities/user.entity';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    role: Role.MERCHANT,
    ...overrides,
  } as User;
}

function buildVenue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: faker.string.uuid(),
    owner: buildUser(),
    name: faker.company.name(),
    ...overrides,
  } as Venue;
}

function buildService(overrides: Partial<AddOnService> = {}): AddOnService {
  return {
    id: faker.string.uuid(),
    venue: buildVenue(),
    name: 'Thuê bóng',
    price: 20000,
    description: null,
    isActive: true,
    ...overrides,
  } as AddOnService;
}

function buildAuthUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    role: Role.MERCHANT,
    ...overrides,
  };
}

describe('AddonServicesService', () => {
  let service: AddonServicesService;
  let serviceRepo: DeepMocked<Repository<AddOnService>>;
  let dataSource: DeepMocked<DataSource>;
  let venueRepo: DeepMocked<Repository<Venue>>;

  beforeEach(() => {
    serviceRepo = createMock<Repository<AddOnService>>();
    venueRepo = createMock<Repository<Venue>>();
    dataSource = createMock<DataSource>();

    dataSource.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Venue) return venueRepo;
      throw new Error(`Unexpected entity in test: ${String(entity)}`);
    });

    serviceRepo.create.mockImplementation(((data: object) => data) as typeof serviceRepo.create);
    serviceRepo.save.mockImplementation((s) => Promise.resolve(s as AddOnService));

    service = new AddonServicesService(serviceRepo, dataSource);
  });

  describe('create', () => {
    it('tạo dịch vụ khi user là chủ sân', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner });
      venueRepo.findOne.mockResolvedValue(venue);

      const result = await service.create(
        { venueId: venue.id, name: 'Thuê bóng', price: 20000 },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.name).toBe('Thuê bóng');
      expect(serviceRepo.save).toHaveBeenCalled();
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const venue = buildVenue();
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.create(
          { venueId: venue.id, name: 'X', price: 1000 },
          buildAuthUser({ id: faker.string.uuid() }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ném NotFoundException khi venue không tồn tại', async () => {
      venueRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          { venueId: faker.string.uuid(), name: 'X', price: 1000 },
          buildAuthUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('cập nhật isActive khi user là chủ sân', async () => {
      const owner = buildUser();
      const addOnService = buildService({ venue: buildVenue({ owner }) });
      serviceRepo.findOne.mockResolvedValue(addOnService);

      const result = await service.update(
        addOnService.id,
        { isActive: false },
        buildAuthUser({ id: owner.id }),
      );

      expect(result.isActive).toBe(false);
    });

    it('ném ForbiddenException khi user không phải chủ sân', async () => {
      const addOnService = buildService();
      serviceRepo.findOne.mockResolvedValue(addOnService);

      await expect(
        service.update(addOnService.id, { isActive: false }, buildAuthUser()),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('xoá dịch vụ khi user là chủ sân', async () => {
      const owner = buildUser();
      const addOnService = buildService({ venue: buildVenue({ owner }) });
      serviceRepo.findOne.mockResolvedValue(addOnService);

      await service.remove(addOnService.id, buildAuthUser({ id: owner.id }));

      expect(serviceRepo.remove).toHaveBeenCalledWith(addOnService);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- addon-services.service.spec.ts`
Expected: FAIL — `AddonServicesService`'s constructor/methods don't match yet (CLI-generated stub).

- [ ] **Step 4: Implement the service**

```typescript
// apps/backend/src/addon-services/addon-services.service.ts — full file
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from '@sportspace/shared';
import { AddOnService } from './entities/add-on-service.entity';
import { Venue } from '../venue/entities/venue.entity';
import { CreateAddOnServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddOnServiceDto } from './dto/update-addon-service.dto';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Injectable()
export class AddonServicesService {
  constructor(
    @InjectRepository(AddOnService)
    private readonly serviceRepo: Repository<AddOnService>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    dto: CreateAddOnServiceDto,
    user: AuthenticatedUser,
  ): Promise<AddOnService> {
    const venue = await this.dataSource.getRepository(Venue).findOne({
      where: { id: dto.venueId },
      relations: { owner: true },
    });
    if (!venue) {
      throw new NotFoundException('Cụm sân không tồn tại');
    }
    this.assertOwnerOrAdmin(venue, user);

    const addOnService = this.serviceRepo.create({
      venue,
      name: dto.name,
      price: dto.price,
      description: dto.description ?? null,
    });
    return this.serviceRepo.save(addOnService);
  }

  findAll(venueId: string): Promise<AddOnService[]> {
    return this.serviceRepo.find({
      where: { venue: { id: venueId } },
      relations: { venue: true },
    });
  }

  async findOne(id: string): Promise<AddOnService> {
    const addOnService = await this.serviceRepo.findOne({
      where: { id },
      relations: { venue: { owner: true } },
    });
    if (!addOnService) {
      throw new NotFoundException('Dịch vụ không tồn tại');
    }
    return addOnService;
  }

  async update(
    id: string,
    dto: UpdateAddOnServiceDto,
    user: AuthenticatedUser,
  ): Promise<AddOnService> {
    const addOnService = await this.findOne(id);
    this.assertOwnerOrAdmin(addOnService.venue, user);
    Object.assign(addOnService, dto);
    return this.serviceRepo.save(addOnService);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const addOnService = await this.findOne(id);
    this.assertOwnerOrAdmin(addOnService.venue, user);
    await this.serviceRepo.remove(addOnService);
  }

  private assertOwnerOrAdmin(venue: Venue, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && venue.owner.id !== user.id) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên dịch vụ của sân này',
      );
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- addon-services.service.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
cd apps/backend && git add src/addon-services/dto src/addon-services/addon-services.service.ts src/addon-services/addon-services.service.spec.ts
git commit -m "feat(backend): thêm CRUD dịch vụ đi kèm theo cụm sân"
```

---

### Task 3: `AddonServicesController` + e2e

**Files:**
- Modify: `apps/backend/src/addon-services/addon-services.controller.ts`
- Test: `apps/backend/test/addon-services.e2e-spec.ts` (new)

**Interfaces:**
- Consumes: `AddonServicesService` from Task 2.
- Produces: `POST /addon-services` (body incl. `venueId`), `GET /addon-services?venueId=`, `GET /addon-services/:id`, `PATCH /addon-services/:id`, `DELETE /addon-services/:id`.

- [ ] **Step 1: Write the failing e2e test**

Look at `apps/backend/test/staff.e2e-spec.ts`'s `beforeAll` (merchant/admin/player fixtures, token login helper, venue fixture) and mirror its exact fixture-setup shape — don't invent a different pattern. Then write:

```typescript
// apps/backend/test/addon-services.e2e-spec.ts
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Role, VenueStatus } from '@sportspace/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/user/entities/user.entity';
import { Venue } from '../src/venue/entities/venue.entity';
import { AddOnService } from '../src/addon-services/entities/add-on-service.entity';

const SEED_PASSWORD = 'Password123!';

describe('AddOnServices (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: User;
  let otherMerchant: User;
  let venue: Venue;
  let ownerToken: string;
  let otherMerchantToken: string;
  let serviceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    owner = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    otherMerchant = await dataSource.getRepository(User).save({
      email: faker.internet.email(),
      passwordHash,
      fullName: faker.person.fullName(),
      role: Role.MERCHANT,
    });
    venue = await dataSource.getRepository(Venue).save({
      owner,
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      lat: 21.0285,
      lng: 105.8542,
      province: 'Hà Nội',
      status: VenueStatus.APPROVED,
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: SEED_PASSWORD })
        .expect(200);
      return res.body.accessToken as string;
    };
    ownerToken = await login(owner.email);
    otherMerchantToken = await login(otherMerchant.email);
  });

  afterAll(async () => {
    if (serviceId) {
      await dataSource.getRepository(AddOnService).delete({ id: serviceId });
    }
    await dataSource.getRepository(Venue).delete({ id: venue.id });
    await dataSource.getRepository(User).delete({ id: owner.id });
    await dataSource.getRepository(User).delete({ id: otherMerchant.id });
    await app.close();
  });

  it('rejects create by a merchant who does not own the venue (403)', async () => {
    await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(403);
  });

  it('lets the owning merchant create, list, update, and delete a service', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(201);
    serviceId = createRes.body.id;
    expect(createRes.body.isActive).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get('/addon-services')
      .query({ venueId: venue.id })
      .expect(200);
    expect((listRes.body as { id: string }[]).map((s) => s.id)).toContain(serviceId);

    const updateRes = await request(app.getHttpServer())
      .patch(`/addon-services/${serviceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 25000 })
      .expect(200);
    expect(Number(updateRes.body.price)).toBe(25000);

    await request(app.getHttpServer())
      .delete(`/addon-services/${serviceId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    serviceId = '';
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test:e2e -- addon-services.e2e-spec.ts`
Expected: FAIL — routes not wired to the real service methods yet, or missing guards (check the CLI's placeholder controller for what's actually there).

- [ ] **Step 3: Implement the controller**

```typescript
// apps/backend/src/addon-services/addon-services.controller.ts — full file
import {
  Body,
  Controller,
  Delete,
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
import { Role } from '@sportspace/shared';
import { AddonServicesService } from './addon-services.service';
import { CreateAddOnServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddOnServiceDto } from './dto/update-addon-service.dto';
import { AddOnService } from './entities/add-on-service.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('addon-services')
@Controller('addon-services')
export class AddonServicesController {
  constructor(private readonly addonServicesService: AddonServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm dịch vụ đi kèm cho cụm sân' })
  @ApiCreatedResponse({ type: AddOnService })
  create(
    @Body() dto: CreateAddOnServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addonServicesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách dịch vụ đi kèm theo cụm sân' })
  @ApiOkResponse({ type: [AddOnService] })
  findAll(@Query('venueId') venueId: string) {
    return this.addonServicesService.findAll(venueId);
  }

  @Get(':id')
  @ApiOkResponse({ type: AddOnService })
  findOne(@Param('id') id: string) {
    return this.addonServicesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AddOnService })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAddOnServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.addonServicesService.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.addonServicesService.remove(id, user);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/backend && pnpm test:e2e -- addon-services.e2e-spec.ts`
Expected: PASS

- [ ] **Step 5: Delete the CLI's placeholder `addon-services.controller.spec.ts` if it no longer compiles against the real service**, or update it to use `createMock<AddonServicesService>()` per this codebase's convention (check `staff.controller.spec.ts` for the exact pattern) — don't leave a stale, non-compiling spec file.

- [ ] **Step 6: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors.

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add src/addon-services test/addon-services.e2e-spec.ts
git commit -m "feat(backend): thêm API quản lý dịch vụ đi kèm (CRUD + e2e)"
```

---

### Task 4: `CreateBookingDto` gains `services`, `BookingService.create()` integrates them

**Files:**
- Create: `apps/backend/src/booking/dto/booking-service-input.dto.ts`
- Modify: `apps/backend/src/booking/dto/create-booking.dto.ts`
- Modify: `apps/backend/src/booking/entities/booking.entity.ts`
- Modify: `apps/backend/src/booking/booking.service.ts`
- Modify: `apps/backend/src/booking/booking.module.ts`
- Test: `apps/backend/src/booking/booking.service.spec.ts`

**Interfaces:**
- Consumes: `AddOnService`, `BookingServiceItem` entities from Task 1.
- Produces: `CreateBookingDto.services?: BookingServiceInputDto[]`. `BookingServiceInputDto { addOnServiceId: string; quantity: number }`. `Booking.services?: BookingServiceSummary[]` (new field, mirrors the existing `payment?: BookingPaymentSummary` field — not a `@Column`, populated in-memory). `BookingServiceSummary { id: string; name: string; quantity: number; unitPrice: number }`.

- [ ] **Step 1: Write the nested input DTO**

Uses `class-transformer`'s `@Type()` (required so the global `ValidationPipe({ transform: true })` turns plain JSON array items into real `BookingServiceInputDto` instances before `@ValidateNested` can recurse into them — confirmed against current class-validator/class-transformer docs via Context7):

```typescript
// apps/backend/src/booking/dto/booking-service-input.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class BookingServiceInputDto {
  @ApiProperty()
  @IsUUID()
  addOnServiceId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}
```

```typescript
// apps/backend/src/booking/dto/create-booking.dto.ts — full file
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { BookingServiceInputDto } from './booking-service-input.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateBookingDto {
  @ApiProperty()
  @IsUUID()
  courtId: string;

  @ApiProperty()
  @IsDateString()
  bookingDate: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'startTime phải theo định dạng HH:mm' })
  startTime: string;

  @ApiProperty()
  @Matches(TIME_PATTERN, { message: 'endTime phải theo định dạng HH:mm' })
  endTime: string;

  @ApiPropertyOptional({ type: () => [BookingServiceInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingServiceInputDto)
  services?: BookingServiceInputDto[];
}
```

- [ ] **Step 2: Add the `services` field to `Booking`**

```typescript
// apps/backend/src/booking/entities/booking.entity.ts — add near BookingPaymentSummary
export class BookingServiceSummary {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;
}
```

Add `@ApiProperty({ type: () => [BookingServiceSummary], required: false }) services?: BookingServiceSummary[];` right after the existing `payment?: BookingPaymentSummary;` field (same non-`@Column` pattern).

- [ ] **Step 3: Write the failing unit tests**

Add to the existing `describe('create', ...)` block in `booking.service.spec.ts` (reuse the file's existing `buildCourt`/`buildUser`/`buildCreateDto`/`buildAuthUser` helpers and `manager`/`queryBuilder` mocks already set up in `beforeEach` — read that setup first, don't recreate it):

```typescript
    it('creates a booking with zero services unchanged (regression)', async () => {
      const court = buildCourt();
      const user = buildUser();
      const dto = buildCreateDto({ courtId: court.id });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        return Promise.resolve(null);
      });

      const result = await service.create(user.id, dto);

      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice));
      expect(result.services).toBeUndefined();
    });

    it('adds one service to totalAmount and returns the itemized summary', async () => {
      const court = buildCourt();
      const user = buildUser();
      const addOnServiceId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [{ addOnServiceId, quantity: 2 }],
      });

      manager.findOne.mockImplementation((entity: unknown, opts?: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        if (entity === AddOnService) {
          return Promise.resolve({
            id: addOnServiceId,
            name: 'Thuê bóng',
            price: 20000,
            venue: { id: court.venue?.id ?? 'venue-1' },
          } as AddOnService);
        }
        return Promise.resolve(null);
      });

      const result = await service.create(user.id, dto);

      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice) + 40000);
      expect(result.services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
      ]);
    });

    it('sums multiple services with different quantities into totalAmount', async () => {
      const court = buildCourt();
      const user = buildUser();
      const serviceAId = faker.string.uuid();
      const serviceBId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [
          { addOnServiceId: serviceAId, quantity: 2 },
          { addOnServiceId: serviceBId, quantity: 3 },
        ],
      });

      manager.findOne.mockImplementation((entity: unknown, opts?: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        if (entity === AddOnService) {
          const where = (opts as { where?: { id?: string } })?.where;
          if (where?.id === serviceAId) {
            return Promise.resolve({
              id: serviceAId,
              name: 'Thuê bóng',
              price: 20000,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService);
          }
          if (where?.id === serviceBId) {
            return Promise.resolve({
              id: serviceBId,
              name: 'Nước uống',
              price: 10000,
              venue: { id: court.venue?.id ?? 'venue-1' },
            } as AddOnService);
          }
        }
        return Promise.resolve(null);
      });

      const result = await service.create(user.id, dto);

      // base price + (2 * 20000) + (3 * 10000) = base + 70000
      expect(result.totalAmount).toBeCloseTo(Number(court.basePrice) + 70000);
      expect(result.services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
        expect.objectContaining({ name: 'Nước uống', quantity: 3, unitPrice: 10000 }),
      ]);
    });

    it('rejects a service ID that belongs to a different venue', async () => {
      const court = buildCourt();
      const user = buildUser();
      const addOnServiceId = faker.string.uuid();
      const dto = buildCreateDto({
        courtId: court.id,
        services: [{ addOnServiceId, quantity: 1 }],
      });

      manager.findOne.mockImplementation((entity: unknown) => {
        if (entity === Court) return Promise.resolve(court);
        if (entity === User) return Promise.resolve(user);
        if (entity === AddOnService) {
          return Promise.resolve({
            id: addOnServiceId,
            name: 'Thuê bóng',
            price: 20000,
            venue: { id: 'a-completely-different-venue-id' },
          } as AddOnService);
        }
        return Promise.resolve(null);
      });

      await expect(service.create(user.id, dto)).rejects.toBeInstanceOf(BadRequestException);
    });
```

Add `import { AddOnService } from '../addon-services/entities/add-on-service.entity';` to the spec file's imports. Note: `court.venue` isn't set by the existing `buildCourt()` helper — for the "adds one service" test, either extend `buildCourt` to accept a `venue` override (check if it already does; if not, add `venue: { id: faker.string.uuid(), ...overrides.venue } as Venue` to the helper) or set `court.venue = { id: 'venue-1' } as Venue` explicitly in the test before calling `service.create`. Read the current `buildCourt` helper first and adapt — don't guess blindly.

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts`
Expected: FAIL — `court.venue` undefined, `services` not handled, `AddOnService` not queried.

- [ ] **Step 5: Implement the integration**

In `apps/backend/src/booking/booking.service.ts`:

1. Add imports: `import { AddOnService } from '../addon-services/entities/add-on-service.entity';` and `import { BookingServiceItem } from '../addon-services/entities/booking-service-item.entity';` and `import { BookingServiceSummary } from './entities/booking.entity';`.
2. Change the `manager.findOne(Court, { where: { id: dto.courtId } })` call inside `create()`'s `withSlotLock` callback to load the venue relation: `manager.findOne(Court, { where: { id: dto.courtId }, relations: { venue: true } })`.
3. After `computeTotalAmount` and before building the `booking` object, resolve and validate services:

```typescript
        let totalAmount = await this.computeTotalAmount(
          manager,
          court,
          dto.bookingDate,
          dto.startTime,
          dto.endTime,
        );

        const serviceSummaries: BookingServiceSummary[] = [];
        const resolvedServices: { addOnService: AddOnService; quantity: number }[] = [];
        for (const item of dto.services ?? []) {
          const addOnService = await manager.findOne(AddOnService, {
            where: { id: item.addOnServiceId },
            relations: { venue: true },
          });
          if (!addOnService || addOnService.venue.id !== court.venue.id) {
            throw new BadRequestException(
              'Dịch vụ không thuộc cụm sân của sân đã chọn',
            );
          }
          totalAmount += Number(addOnService.price) * item.quantity;
          resolvedServices.push({ addOnService, quantity: item.quantity });
        }

        const booking = manager.create(Booking, {
          court,
          user,
          bookingDate: dto.bookingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: BookingStatus.PENDING,
          totalAmount,
        });
        const saved = await manager.save(Booking, booking);

        for (const { addOnService, quantity } of resolvedServices) {
          const item = manager.create(BookingServiceItem, {
            booking: saved,
            addOnService,
            quantity,
            unitPrice: addOnService.price,
          });
          await manager.save(BookingServiceItem, item);
          serviceSummaries.push({
            id: item.id,
            name: addOnService.name,
            quantity,
            unitPrice: Number(addOnService.price),
          });
        }
        if (serviceSummaries.length > 0) {
          saved.services = serviceSummaries;
        }
        return saved;
```

Replace the original `const totalAmount = await this.computeTotalAmount(...)` declaration and the `const booking = manager.create(...); return manager.save(Booking, booking);` lines with the block above (the `const totalAmount` becomes `let totalAmount` since it's now mutated).

- [ ] **Step 6: Register the new entities in `BookingModule`**

```typescript
// apps/backend/src/booking/booking.module.ts — add to TypeOrmModule.forFeature array
    TypeOrmModule.forFeature([Booking, Payment, AddOnService, BookingServiceItem]),
```

Add the corresponding imports for `AddOnService` and `BookingServiceItem`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts`
Expected: PASS (all existing + 4 new tests)

- [ ] **Step 8: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors.

- [ ] **Step 9: Commit**

```bash
cd apps/backend && git add src/booking src/addon-services
git commit -m "feat(backend): cho phép chọn dịch vụ đi kèm khi đặt sân, cộng vào tổng tiền"
```

---

### Task 5: `GET /bookings` (findAll) attaches itemized service summaries

**Files:**
- Modify: `apps/backend/src/booking/booking.service.ts`
- Test: `apps/backend/src/booking/booking.service.spec.ts`
- Test: `apps/backend/test/booking.e2e-spec.ts`

**Interfaces:**
- Consumes: `BookingServiceItem` from Task 1, `Booking.services` field from Task 4.
- Produces: `BookingService.findAll()` populates `booking.services` for every returned booking that has service line items, mirroring `attachPaymentSummaries`'s exact shape and call site.

- [ ] **Step 1: Write the failing e2e test**

Add to `apps/backend/test/booking.e2e-spec.ts` (find its existing venue/court/merchant fixture setup and player-booking flow — mirror the exact pattern already used for other booking tests in this file rather than inventing new fixtures):

```typescript
  it('full flow: merchant creates a service, player books with it, listing shows the itemized breakdown', async () => {
    const serviceRes = await request(app.getHttpServer())
      .post('/addon-services')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ venueId: venue.id, name: 'Thuê bóng', price: 20000 })
      .expect(201);

    const bookingRes = await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        courtId: court.id,
        bookingDate: '2026-09-20',
        startTime: '08:00',
        endTime: '09:00',
        services: [{ addOnServiceId: serviceRes.body.id, quantity: 2 }],
      })
      .expect(201);
    expect(bookingRes.body.services).toEqual([
      expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
    ]);

    const listRes = await request(app.getHttpServer())
      .get('/bookings')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const found = (listRes.body as { id: string; services?: unknown[] }[]).find(
      (b) => b.id === bookingRes.body.id,
    );
    expect(found?.services).toEqual([
      expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
    ]);

    await dataSource.getRepository(require('../src/addon-services/entities/add-on-service.entity').AddOnService)
      .delete({ id: serviceRes.body.id });
  });
```

(Use whichever token/fixture variable names — `ownerToken`, `accessToken`, `venue`, `court` — this specific test file already uses; check its actual `beforeAll` before writing this, the names above are placeholders matching the pattern seen in `staff.e2e-spec.ts`/`admin.e2e-spec.ts` but this file may differ.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/backend && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: FAIL — `listRes` bookings have no `services` field.

- [ ] **Step 3: Implement `attachServiceSummaries` and call it from `findAll`**

```typescript
// apps/backend/src/booking/booking.service.ts
  async findAll(user: AuthenticatedUser): Promise<Booking[]> {
    const where = user.role === Role.ADMIN ? {} : { user: { id: user.id } };
    const bookings = await this.bookingRepo.find({
      where,
      relations: { court: true, user: true },
    });
    await this.attachPaymentSummaries(bookings);
    await this.attachServiceSummaries(bookings);
    return bookings;
  }
```

```typescript
  private async attachServiceSummaries(bookings: Booking[]): Promise<void> {
    if (bookings.length === 0) {
      return;
    }
    const items = await this.dataSource.getRepository(BookingServiceItem).find({
      where: { booking: { id: In(bookings.map((b) => b.id)) } },
      relations: { booking: true, addOnService: true },
    });
    const byBookingId = new Map<string, BookingServiceSummary[]>();
    for (const item of items) {
      const list = byBookingId.get(item.booking.id) ?? [];
      list.push({
        id: item.id,
        name: item.addOnService.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      });
      byBookingId.set(item.booking.id, list);
    }
    for (const booking of bookings) {
      const services = byBookingId.get(booking.id);
      if (services) {
        booking.services = services;
      }
    }
  }
```

Place `attachServiceSummaries` right after `attachPaymentSummaries` in the file. `BookingService` doesn't have a `BookingServiceItem` repo injected — use `this.dataSource.getRepository(BookingServiceItem)` (same pattern already used for `Court`/`PriceRule` elsewhere in this file), no constructor change needed.

- [ ] **Step 4: Write a focused unit test for `attachServiceSummaries` via `findAll`**

Add to `booking.service.spec.ts`'s existing `describe('findAll', ...)` block (if one exists — check; if `findAll` has no dedicated describe block yet, create one following this file's existing style):

```typescript
  describe('findAll', () => {
    it('attaches itemized service summaries to each booking that has them', async () => {
      const user = buildUser();
      const booking = { id: faker.string.uuid(), user, court: buildCourt() } as Booking;
      bookingRepo.find.mockResolvedValue([booking]);
      paymentRepo.find.mockResolvedValue([]);
      const serviceItemRepo = createMock<Repository<BookingServiceItem>>();
      serviceItemRepo.find.mockResolvedValue([
        {
          id: 'item-1',
          booking: { id: booking.id } as Booking,
          addOnService: { name: 'Thuê bóng' } as AddOnService,
          quantity: 2,
          unitPrice: 20000,
        } as BookingServiceItem,
      ]);
      dataSource.getRepository.mockImplementation((entity: unknown) => {
        if (entity === BookingServiceItem) return serviceItemRepo;
        throw new Error(`Unexpected entity in test: ${String(entity)}`);
      });

      const result = await service.findAll(buildAuthUser({ id: user.id, role: Role.PLAYER }));

      expect(result[0].services).toEqual([
        expect.objectContaining({ name: 'Thuê bóng', quantity: 2, unitPrice: 20000 }),
      ]);
    });
  });
```

Add `import { BookingServiceItem } from '../addon-services/entities/booking-service-item.entity';` and `import { AddOnService } from '../addon-services/entities/add-on-service.entity';` to the spec file if not already present from Task 4.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- booking.service.spec.ts && pnpm test:e2e -- booking.e2e-spec.ts`
Expected: PASS

- [ ] **Step 6: Run full backend suite one final time**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors. This closes out the backend portion of this plan.

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add src/booking test/booking.e2e-spec.ts
git commit -m "feat(backend): hiển thị chi tiết dịch vụ đi kèm trong danh sách đơn đặt sân"
```

---

### Task 6: Regenerate the API client

**Files:**
- Modify (tracked): `openapi.json`
- Modify (generated, git-ignored): `packages/shared/src/generated/**`, `packages/shared/dist/**`

**Interfaces:**
- Consumes: every backend change from Tasks 1-5.
- Produces: `addonServicesApi` (or whatever tag-derived name orval generates from `@ApiTags('addon-services')` — confirm the actual name, don't guess) with `create`/`findAll`/`findOne`/`update`/`remove` methods; `Booking.services?: BookingServiceSummary[]` on the generated `Booking` type; `getAddonServicesMock()` MSW handler export.

- [ ] **Step 1: Regenerate**

Run:
```bash
cd apps/backend && pnpm run swagger:export
cd ../.. && pnpm run generate:api
cd packages/shared && pnpm build
```
Expected: `openapi.json` updated at repo root; `packages/shared/src/generated/addon-services/` (or similar tag folder) created; build succeeds with no type errors.

- [ ] **Step 2: Confirm the generated names**

Run: `grep -rn "export" packages/shared/src/generated/addon-services/*.ts | grep -v msw | grep -v faker` (adjust the folder name to whatever Step 1 actually produced) and note the exact controller-method function names (e.g. `addonServicesControllerCreate`, `addonServicesControllerFindAll`, ...) and the exact mock-handler export name (e.g. `getAddonServicesMock`). These exact names are needed verbatim in Tasks 7 and 8.

- [ ] **Step 3: Confirm `@sportspace/shared`'s index re-exports the new tag**

Check `packages/shared/src/index.ts` — it has one `export * from './generated/<tag>/<tag>';` line per `@ApiTags()` tag (see the existing comment above that block). Add a new line for `addon-services` if the generation didn't already need one added manually (orval doesn't touch this hand-maintained file). If missing, add it and rebuild: `cd packages/shared && pnpm build`.

- [ ] **Step 4: Verify downstream compiles**

Run: `cd apps/backend && pnpm exec tsc --noEmit` (should still be clean) and `cd apps/web && pnpm exec tsc --noEmit` (expect new errors only if Tasks 7/8 haven't landed yet — that's fine, they're not done).

- [ ] **Step 5: Commit**

```bash
git add openapi.json packages/shared/src/index.ts
git commit -m "chore(shared): cập nhật openapi.json và export API dịch vụ đi kèm sau khi backend hỗ trợ"
```

(`packages/shared/src/generated/` and `packages/shared/dist/` are git-ignored — don't try to add them.)

---

### Task 7: Web — merchant services catalog page

**Files:**
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/page.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/actions.ts`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/actions.test.ts`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/service-form.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/service-form.test.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/error.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/services/loading.tsx`
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`

**Interfaces:**
- Consumes: the generated `addonServices` API client from Task 6 (exact function names confirmed in Task 6 Step 2 — use those, not the guesses below, if they differ).
- Produces: `/merchant/venues/[venueId]/services` page; a link to it from the courts page (mirrors how courts link to price-rules — services has no natural per-court anchor, so it goes at the top of the courts page next to the venue breadcrumb).

- [ ] **Step 1: Write the failing action tests**

Read `apps/web/src/app/merchant/venues/[venueId]/staff/actions.test.ts` in full first (already shown earlier in this plan's research) and mirror its exact mocking style (`vi.mock('@/lib/api-client', ...)`, `requireSession`, `revalidatePath`, `redirect`) — don't invent a different pattern. Write equivalent tests for `addService` (validates name+price, calls `addonServicesApi.<create-method-name>`, revalidates) and `deactivateService` (calls the update method with `{ isActive: false }`, revalidates), covering: validation failure, success, 401 redirect, other-error fallback.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- services/actions.test.ts`
Expected: FAIL — `./actions` doesn't exist yet.

- [ ] **Step 3: Implement `actions.ts`**

```typescript
// apps/web/src/app/merchant/venues/[venueId]/services/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

const serviceSchema = z.object({
  name: z.string().min(1, 'Tên dịch vụ không hợp lệ'),
  price: z.coerce.number('Giá không hợp lệ').min(0),
  description: z.string().optional(),
});

export interface ServiceActionState {
  error?: string;
}

function servicesPath(venueId: string): string {
  return `/merchant/venues/${venueId}/services`;
}

export async function addService(
  venueId: string,
  _prevState: ServiceActionState | undefined,
  formData: FormData,
): Promise<ServiceActionState> {
  const parsed = serviceSchema.safeParse({
    name: formData.get('name'),
    price: formData.get('price'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' };
  }

  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  try {
    await addonServices.addonServicesControllerCreate({ venueId, ...parsed.data });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    return { error: 'Không thể thêm dịch vụ, vui lòng thử lại' };
  }

  revalidatePath(servicesPath(venueId));
  return {};
}

export async function deactivateService(venueId: string, serviceId: string): Promise<void> {
  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  try {
    await addonServices.addonServicesControllerUpdate(serviceId, { isActive: false });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(servicesPath(venueId));
}
```

Also add `addonServices: getAddonServices(instance),` to `apps/web/src/lib/api-client.ts`'s `createAuthenticatedApiClient` (mirror the existing `staff: getStaff(instance),` line) and import `getAddonServices` from `@sportspace/shared` at the top of that file. **Use the exact generated function/hook names confirmed in Task 6 Step 2** — `addonServicesControllerCreate`/`addonServicesControllerUpdate`/`getAddonServices` above are best guesses based on the naming convention every other module in this codebase follows; verify against the real generated file before writing this.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && pnpm test -- services/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Write the form component + test**

Mirror `apps/web/src/app/merchant/venues/[venueId]/staff/staff-form.tsx` and its `.test.tsx` exactly (already shown earlier in this plan's research) — same `useActionState` + `.bind(null, venueId)` shape, three fields instead of three different ones: `name` (text, required), `price` (number, required, min 0), `description` (text, optional). File: `service-form.tsx`, component name `ServiceForm`, action `addService`.

- [ ] **Step 6: Write `page.tsx`, `error.tsx`, `loading.tsx`**

Mirror `apps/web/src/app/merchant/venues/[venueId]/staff/page.tsx`, `error.tsx`, `loading.tsx` (already shown earlier in this plan's research). Key differences from the Staff page: no search/filter/pagination (per this plan's Global Constraints — a venue's catalog is small), just a plain list; call `addonServices.addonServicesControllerFindAll({ venueId })` and render `id, name, price, description, isActive`; the deactivate button uses `deactivateService`; a "Thêm dịch vụ mới" section at the bottom uses `<ServiceForm venueId={venueId} />`.

```tsx
// apps/web/src/app/merchant/venues/[venueId]/services/page.tsx
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { ServiceForm } from './service-form';
import { deactivateService } from './actions';

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { addonServices } = createAuthenticatedApiClient(session.accessToken);

  let serviceList;
  try {
    const res = await addonServices.addonServicesControllerFindAll({ venueId });
    serviceList = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Dịch vụ đi kèm</h1>
      </div>

      <div className="flex flex-col gap-2">
        {serviceList.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có dịch vụ nào.</p>
        )}
        {serviceList.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
          >
            <span>
              {s.name} — {s.price.toLocaleString('vi-VN')} đ
              {!s.isActive && ' — đã vô hiệu hoá'}
            </span>
            {s.isActive && (
              <form action={deactivateService.bind(null, venueId, s.id)}>
                <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                  Vô hiệu hoá
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-medium">Thêm dịch vụ mới</h2>
        <ServiceForm venueId={venueId} />
      </div>
    </div>
  );
}
```

(Generated `AddOnService.price` may come through as a `string` on the client type depending on how orval represents the `decimal` column — check the actual generated `AddOnService` model type from Task 6 and adjust `.toLocaleString('vi-VN')` to `Number(s.price).toLocaleString('vi-VN')` if so.)

- [ ] **Step 7: Add a link to the services page from the courts page**

In `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`, add a `<Link href={\`/merchant/venues/${venueId}/services\`}>Dịch vụ đi kèm</Link>` near the existing breadcrumb/heading area (read the current file's exact structure — added in the pagination plan's Task 17 — before placing this).

- [ ] **Step 8: Run full web suite**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: all pass, zero new tsc errors.

- [ ] **Step 9: Manually verify in the browser**

Per CLAUDE.md's UI-testing rule: run `pnpm dev` for both `apps/backend` and `apps/web`, sign in as a merchant who owns a venue, open `/merchant/venues/<id>/services`, add a service, confirm it appears, deactivate it, confirm the button disappears and the "đã vô hiệu hoá" label shows.

- [ ] **Step 10: Commit**

```bash
cd apps/web && git add src/app/merchant/venues/\[venueId\]/services src/app/merchant/venues/\[venueId\]/courts/page.tsx src/lib/api-client.ts
git commit -m "feat(web): thêm trang quản lý dịch vụ đi kèm cho chủ sân"
```

---

### Task 8: Mobile — thread `venueId` through navigation, add services step to booking

**Files:**
- Modify: `apps/mobile/src/navigation/types.ts`
- Modify: `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx`
- Modify: `apps/mobile/src/screens/venues/BookingConfirmScreen.tsx`
- Modify: `apps/mobile/src/screens/venues/__tests__/BookingConfirmScreen.test.tsx`
- Modify: `apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx`
- Modify: `apps/mobile/src/api/client.ts`
- Modify: `apps/mobile/src/test-utils/server.ts`

**Interfaces:**
- Consumes: `addonServicesApi`/`getAddonServicesMock` from Task 6 (exact names confirmed in Task 6 Step 2).
- Produces: `VenuesStackParamList.CourtSlots` and `.BookingConfirm` both gain a required `venueId: string`.

**Important — this screen currently has no `venueId` anywhere in its navigation chain.** `VenueDetail`'s own route params already have `venueId` (it's how the screen fetches the venue); `CourtSlots` and `BookingConfirm` do not. This task threads it through 3 screens, not just 1.

- [ ] **Step 1: Add `venueId` to the two param types**

In `apps/mobile/src/navigation/types.ts`, add `venueId: string;` as the first field of both `CourtSlots` and `BookingConfirm` in `VenuesStackParamList`.

- [ ] **Step 2: Thread it through `VenueDetailScreen` → `CourtSlotsScreen`**

In `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`, the `navigation.navigate('CourtSlots', {...})` call (inside the `FlatList`'s `renderItem`) gains `venueId,` as its first property (the `venueId` from `route.params` destructured at the top of the component is already in scope — no new fetch needed).

- [ ] **Step 3: Thread it through `CourtSlotsScreen` → `BookingConfirmScreen`**

In `apps/mobile/src/screens/venues/CourtSlotsScreen.tsx`, destructure `venueId` alongside `courtId, courtName, venueName` from `route.params` (line ~21), and add `venueId,` as the first property of the `navigation.navigate('BookingConfirm', {...})` call inside the slot `Pressable`'s `onPress`.

- [ ] **Step 4: Update `VenueDetailScreen`'s navigation test**

In `apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx`, the test `'bấm vào 1 sân con điều hướng sang CourtSlots với đúng tham số'` asserts `expect(navigate).toHaveBeenCalledWith('CourtSlots', { courtId: 'court-1', courtName: 'Sân số 1', venueName: venue.name })` — add `venueId: 'venue-1'` (matching this test's `renderScreen(venueId = 'venue-1')` default) to that expected object.

- [ ] **Step 5: Register the addon-services API client**

In `apps/mobile/src/api/client.ts`, add `import { getAddonServices } from '@sportspace/shared';` (use the exact name from Task 6 Step 2) to the existing import block, and `export const addonServicesApi = getAddonServices(apiClient);` alongside the other `export const xApi = ...` lines.

- [ ] **Step 6: Register the default MSW mock handler**

In `apps/mobile/src/test-utils/server.ts`, add `getAddonServicesMock` (exact name from Task 6 Step 2) to the import list and spread it into `setupServer(...)` alongside `getVenuesMock()` etc. — without this, `BookingConfirmScreen`'s new fetch will have no default handler and every existing test in `BookingConfirmScreen.test.tsx` will break (MSW has no route for the new request).

- [ ] **Step 7: Write the failing test for the services step**

Add to `apps/mobile/src/screens/venues/__tests__/BookingConfirmScreen.test.tsx`. First update the file's shared `params` object (used by every test via `renderScreen()`) to include `venueId: 'venue-1'`. Then add:

```typescript
it('hiển thị danh sách dịch vụ, chọn dịch vụ cộng vào tổng tiền hiển thị trước khi đặt', async () => {
  server.use(
    http.get('*/addon-services', () =>
      HttpResponse.json([
        { id: 'svc-1', name: 'Thuê bóng', price: 20000, description: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ]),
    ),
  );
  const user = userEvent.setup();
  await renderScreen();

  expect(await screen.findByTestId('service-item-svc-1')).toBeTruthy();
  await user.press(screen.getByTestId('service-checkbox-svc-1'));

  expect(screen.getByTestId('booking-total')).toHaveTextContent('220.000');
});

it('gửi dịch vụ đã chọn khi đặt sân', async () => {
  server.use(
    http.get('*/addon-services', () =>
      HttpResponse.json([
        { id: 'svc-1', name: 'Thuê bóng', price: 20000, description: null, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ]),
    ),
  );
  let capturedBody: unknown;
  server.use(
    http.post('*/bookings', async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json(
        getBookingControllerCreateResponseMock({ status: BookingStatus.PENDING, createdAt: new Date().toISOString() }),
        { status: 201 },
      );
    }),
  );
  const user = userEvent.setup();
  await renderScreen();

  await screen.findByTestId('service-item-svc-1');
  await user.press(screen.getByTestId('service-checkbox-svc-1'));
  await user.press(screen.getByTestId('booking-confirm-submit'));

  await screen.findByTestId('booking-success');
  expect(capturedBody).toMatchObject({
    services: [{ addOnServiceId: 'svc-1', quantity: 1 }],
  });
});
```

- [ ] **Step 8: Run tests to verify the new ones fail and no existing ones broke**

Run: `cd apps/mobile && pnpm test -- BookingConfirmScreen.test.tsx`
Expected: the 2 new tests FAIL (no services UI yet); all pre-existing tests in this file still PASS (proving Step 1's `params` update and Step 6's MSW registration didn't break anything).

- [ ] **Step 9: Implement the services step in `BookingConfirmScreen`**

Add to `apps/mobile/src/screens/venues/BookingConfirmScreen.tsx`:
- Destructure `venueId` from `route.params` alongside the existing fields.
- New state: `const [services, setServices] = useState<AddOnService[]>([]);` and `const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});` (import `AddOnService` type from `@sportspace/shared`).
- A `useEffect` that fetches `addonServicesApi.addonServicesControllerFindAll({ venueId })` on mount and sets `services` (filter to `isActive` items only). Import `addonServicesApi` from `../../api/client`.
- A computed `servicesTotal = services.reduce((sum, s) => selectedQuantities[s.id] ? sum + Number(s.price) * selectedQuantities[s.id] : sum, 0)` and `displayTotal = price + servicesTotal`.
- In the initial (pre-submit) render branch, render a list of services below the base price, each a `Pressable` with `testID={\`service-item-${s.id}\`}` wrapping a checkbox-styled toggle (`testID={\`service-checkbox-${s.id}\`}`) that toggles `selectedQuantities[s.id]` between `0`/unset and `1` on press (a full quantity stepper is a reasonable follow-up; a toggle checkbox selecting quantity 1 satisfies the spec's "checkbox + quantity stepper" with the stepper simplified to a fixed quantity of 1 per selection — note this simplification explicitly in the commit message since it's a minor scope reduction from the spec's literal wording, not a silent gap).
- Replace the hardcoded `{price.toLocaleString('vi-VN')} đ` displays (there are two: initial screen and success screen) with `{displayTotal.toLocaleString('vi-VN')} đ`, wrapped in `<Text testID="booking-total">`.
- In `handleConfirm`, change the `bookingsApi.bookingControllerCreate({...})` call to include `services: Object.entries(selectedQuantities).filter(([, qty]) => qty > 0).map(([addOnServiceId, quantity]) => ({ addOnServiceId, quantity }))` — but only include the `services` key at all if that array is non-empty (an empty array vs. omitted key should both be fine given the DTO's `@IsOptional()`, but omitting keeps the request body minimal when nothing was selected).

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd apps/mobile && pnpm test -- BookingConfirmScreen.test.tsx`
Expected: PASS (all tests including the 2 new ones)

- [ ] **Step 11: Run full mobile suite**

Run: `cd apps/mobile && pnpm test`
Expected: all pass — this also catches any other test file broken by the `VenuesStackParamList` type change (e.g. `CourtSlotsScreen.test.tsx` if it constructs `route.params` with a type-checked literal missing `venueId` — add `venueId: 'venue-1'` there too if `tsc`/the test run flags it).

Run: `cd apps/mobile && pnpm exec tsc --noEmit` (or this project's equivalent typecheck script — check `package.json`)
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
cd apps/mobile && git add src/navigation/types.ts src/screens/venues src/api/client.ts src/test-utils/server.ts
git commit -m "feat(mobile): thêm bước chọn dịch vụ đi kèm khi đặt sân, truyền venueId qua điều hướng"
```

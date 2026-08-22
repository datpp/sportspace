# Venue Images (FR-M01 / FR-P03) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a merchant upload/remove photos for their venue (cap 8), serve them over HTTP, and display them on both the merchant web dashboard and the player mobile app.

**Architecture:** `Venue` gains a `simple-json` `images: string[]` column (relative URL paths, no separate entity — no per-image metadata is needed). `multer`'s disk storage (bundled with the already-installed `@nestjs/platform-express`) writes uploads to `apps/backend/uploads/venues/` under UUID filenames; `NestExpressApplication.useStaticAssets(...)` serves that directory at `/uploads`. Two new endpoints on the existing `VenueController` — `POST /venues/:id/images` (multipart upload, owner/admin-guarded) and `DELETE /venues/:id/images` (removes one entry + best-effort deletes the file). Web gets a new merchant sub-page (mirrors the existing `courts`/`services`/`staff` sub-page pattern) plus a thumbnail strip on the admin approval list; mobile's `VenueDetailScreen` gets a read-only horizontal image carousel (mobile is player-only — no upload UI there, matches the spec's Mobile section, which only describes display).

**Tech Stack:** NestJS, TypeORM, `multer` (via `@nestjs/platform-express`, already a dependency), Jest + `@golevelup/ts-jest`, Supertest, Next.js Server Actions, native `FormData`/`File` (Node 18+, no `form-data` package needed — confirmed via Context7), React Native `Image`.

## Global Constraints

- TypeScript strict; follow existing file/module conventions exactly (see files read below), do not restructure unrelated code.
- No hand-written mocks: unit tests use `createMock<T>()`/`DeepMocked<T>` from `@golevelup/ts-jest`, fixtures use `@faker-js/faker`.
- TDD: write the failing test before the implementation.
- Migration via `pnpm run migration:generate` only — never hand-write SQL.
- Max **8** images per venue, enforced server-side with `BadRequestException` past the cap.
- Image files only (`image/jpeg`, `image/png`, `image/webp`), max 5MB each, enforced via multer's own `fileFilter`/`limits` — reject with a 400, not a 500.
- `images` is never part of `CreateVenueDto`/`UpdateVenueDto` — managed exclusively through the two new dedicated endpoints, matching how the spec scopes this as a separate concern from general venue editing.
- Uploaded filenames are always `${uuid}${ext}`, never the original filename (avoids path-traversal/collisions).
- Uploads directory lives at `apps/backend/uploads/venues/` (co-located with the app that owns it, like `dist/`/`node_modules/` — a deliberate refinement over the spec's looser "repo root" wording, since `apps/backend` is the process's actual working directory and this keeps the artifact isolated per git worktree like every other backend-owned generated directory).
- Vietnamese-only git commit messages; zero AI/Claude/Co-Authored-By mentions in any commit.

---

## File Structure

**Backend — new:**
- `apps/backend/src/venue/venue-uploads.constants.ts`
- `apps/backend/src/venue/dto/delete-venue-image.dto.ts`
- `apps/backend/src/database/migrations/*-AddImagesToVenue.ts` (generated)

**Backend — modified:**
- `.gitignore` (root)
- `apps/backend/src/main.ts`
- `apps/backend/src/venue/entities/venue.entity.ts`
- `apps/backend/src/venue/venue.service.ts` (+ `.spec.ts`)
- `apps/backend/src/venue/venue.controller.ts` (+ `.spec.ts` if one exists)
- `apps/backend/test/venue.e2e-spec.ts`

**Web — new:**
- `apps/web/src/app/merchant/venues/[venueId]/images/page.tsx`
- `apps/web/src/app/merchant/venues/[venueId]/images/image-upload-form.tsx` (+ `.test.tsx`)
- `apps/web/src/app/merchant/venues/[venueId]/images/actions.ts` (+ `.test.ts`)
- `apps/web/src/lib/asset-url.ts`

**Web — modified:**
- `apps/web/.env.local.example`
- `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx` (nav link)
- `apps/web/src/app/admin/venues/page.tsx` (thumbnail strip)

**Mobile — modified:**
- `apps/mobile/src/screens/venues/VenueDetailScreen.tsx` (+ `.test.tsx`)

No mobile env change needed — `API_BASE_URL` is already exported from `apps/mobile/src/api/client.ts` and reused as-is.

---

### Task 1: `Venue.images` column + static file serving

**Files:**
- Modify: `.gitignore`
- Modify: `apps/backend/src/main.ts`
- Modify: `apps/backend/src/venue/entities/venue.entity.ts`

**Interfaces:**
- Produces: `Venue.images: string[]` (default `[]`), each entry a relative path like `/uploads/venues/<uuid>.jpg`. Static files under `apps/backend/uploads/venues/` served at `GET /uploads/venues/<file>`.

- [ ] **Step 1: Ignore the uploads directory**

```
# .gitignore — add near node_modules/dist
apps/backend/uploads/venues/*
!apps/backend/uploads/venues/.gitkeep
```

(Ignore the *contents* of the venues upload directory, not the directory itself — Task 2 tracks a `.gitkeep` placeholder there so the directory exists after a fresh clone/worktree checkout, since multer's `diskStorage` will not create a missing destination directory on its own.)

- [ ] **Step 2: Add the column**

```typescript
// apps/backend/src/venue/entities/venue.entity.ts — add after `status`
  @ApiProperty({ type: [String] })
  @Column({ type: 'simple-json', default: '[]' })
  images: string[];
```

- [ ] **Step 3: Generate and run the migration**

Run: `cd apps/backend && pnpm run migration:generate src/database/migrations/AddImagesToVenue`
Expected: a new migration adding a `text` column `images` with a default of `'[]'` (TypeORM's `simple-json` maps to `text`, storing `JSON.stringify`).

Run: `cd apps/backend && pnpm run migration:run`
Expected: applies cleanly.

- [ ] **Step 4: Define the shared uploads-path constant**

```typescript
// apps/backend/src/venue/venue-uploads.constants.ts
import { join } from 'path';

// Single source of truth for where venue images live on disk — imported by
// main.ts (static serving), venue.controller.ts (multer destination), and
// venue.service.ts (delete-on-disk) so the __dirname-relative path is only
// computed once and can't drift between the three call sites.
export const UPLOADS_ROOT_DIR = join(__dirname, '..', '..', 'uploads');
export const VENUE_UPLOADS_DIR = join(UPLOADS_ROOT_DIR, 'venues');
```

(This file lives at `apps/backend/src/venue/venue-uploads.constants.ts`, compiling to `apps/backend/dist/venue/venue-uploads.constants.js` — so `__dirname` there is `apps/backend/dist/venue`, and `join(__dirname, '..', '..', 'uploads')` resolves to `apps/backend/uploads`. Verify this actually resolves correctly in both `pnpm start:dev` (ts-node, no separate `dist/`) and a real `pnpm build && pnpm start` run — Nest's ts-node dev setup typically keeps the same relative source-tree shape so `__dirname` behaves the same either way, but confirm empirically rather than trust this comment; add a one-line `Logger.log`/console diagnostic temporarily if needed, then remove it once confirmed.)

- [ ] **Step 5: Serve `apps/backend/uploads/` statically**

```typescript
// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { UPLOADS_ROOT_DIR } from './venue/venue-uploads.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads' });

  // ... rest unchanged (Swagger setup, app.listen)
```

(`NestExpressApplication` + `useStaticAssets` is the built-in Nest API for this — it needs no new dependency at all, since `@nestjs/platform-express` is already installed; this is a cleaner fit than manually importing raw `express` — which isn't a direct dependency of this app — or adding `@nestjs/serve-static`.)

- [ ] **Step 6: Verify build**

Run: `cd apps/backend && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd apps/backend && git add ../../.gitignore src/main.ts src/venue/entities/venue.entity.ts src/venue/venue-uploads.constants.ts src/database/migrations
git commit -m "feat(backend): thêm cột lưu ảnh cụm sân và phục vụ file tĩnh /uploads"
```

---

### Task 2: Upload/delete image endpoints + unit tests

**Files:**
- Create: `apps/backend/src/venue/dto/delete-venue-image.dto.ts`
- Modify: `apps/backend/src/venue/venue.service.ts`
- Modify: `apps/backend/src/venue/venue.controller.ts`
- Test: `apps/backend/src/venue/venue.service.spec.ts`

**Interfaces:**
- Consumes: `Venue.images` from Task 1.
- Produces: `VenueService.addImage(id, user, file): Promise<Venue>`, `VenueService.removeImage(id, user, url): Promise<Venue>`. `POST /venues/:id/images` (multipart, field name `file`), `DELETE /venues/:id/images` (body `{ url: string }`).

- [ ] **Step 1: Add `@types/multer`**

Run: `cd apps/backend && pnpm add -D @types/multer`

- [ ] **Step 2: Write the DTO**

```typescript
// apps/backend/src/venue/dto/delete-venue-image.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteVenueImageDto {
  @ApiProperty()
  @IsString()
  url: string;
}
```

- [ ] **Step 3: Write the failing unit tests**

Add to `apps/backend/src/venue/venue.service.spec.ts`, as a new top-level `describe('addImage', ...)` and `describe('removeImage', ...)`, using the file's existing `buildVenue`/`buildAuthUser` helpers and the `venueRepo`/`service` from the existing `beforeEach`.

```typescript
import * as fs from 'fs/promises';

jest.mock('fs/promises');

// ... inside describe('VenueService', ...), after the existing describe blocks:

  describe('addImage', () => {
    it('appends the file path and saves when the owner uploads', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: [] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      const file = { filename: 'abc123.jpg' } as Express.Multer.File;

      const result = await service.addImage(venue.id, authUser, file);

      expect(result.images).toEqual(['/uploads/venues/abc123.jpg']);
    });

    it('rejects a non-owner, non-admin uploader', async () => {
      const venue = buildVenue({ owner: buildUser(), images: [] });
      const otherUser = buildAuthUser({ id: 'someone-else', role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      const file = { filename: 'abc123.jpg' } as Express.Multer.File;

      await expect(service.addImage(venue.id, otherUser, file)).rejects.toThrow(ForbiddenException);
    });

    it('rejects the 9th image past the 8-image cap', async () => {
      const owner = buildUser();
      const venue = buildVenue({
        owner,
        images: Array.from({ length: 8 }, (_, i) => `/uploads/venues/${i}.jpg`),
      });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      const file = { filename: 'ninth.jpg' } as Express.Multer.File;

      await expect(service.addImage(venue.id, authUser, file)).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeImage', () => {
    it('removes the matching entry and best-effort deletes the file', async () => {
      const owner = buildUser();
      const venue = buildVenue({
        owner,
        images: ['/uploads/venues/a.jpg', '/uploads/venues/b.jpg'],
      });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.removeImage(venue.id, authUser, '/uploads/venues/a.jpg');

      expect(result.images).toEqual(['/uploads/venues/b.jpg']);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('a.jpg'));
    });

    it('does not throw when the file is already gone from disk', async () => {
      const owner = buildUser();
      const venue = buildVenue({ owner, images: ['/uploads/venues/a.jpg'] });
      const authUser = buildAuthUser({ id: owner.id, role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);
      venueRepo.save.mockImplementation((v) => Promise.resolve(v as Venue));
      (fs.unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'ENOENT' }),
      );

      const result = await service.removeImage(venue.id, authUser, '/uploads/venues/a.jpg');

      expect(result.images).toEqual([]);
    });

    it('rejects a non-owner, non-admin remover', async () => {
      const venue = buildVenue({ owner: buildUser(), images: ['/uploads/venues/a.jpg'] });
      const otherUser = buildAuthUser({ id: 'someone-else', role: Role.MERCHANT });
      venueRepo.findOne.mockResolvedValue(venue);

      await expect(
        service.removeImage(venue.id, otherUser, '/uploads/venues/a.jpg'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
```

(Check the file's real top-of-file imports before adding `jest.mock('fs/promises')` and the `fs` import — place them with the other top-level imports/mocks, not inline. Confirm `buildAuthUser`'s real signature/field names by reading the file first — adapt the calls above if it differs.)

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/backend && pnpm test -- venue.service.spec.ts -t "addImage|removeImage"`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 5: Implement `addImage`/`removeImage`**

```typescript
// apps/backend/src/venue/venue.service.ts
// Add imports:
import * as fs from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common'; // add to existing @nestjs/common import line
import { VENUE_UPLOADS_DIR } from './venue-uploads.constants';

const MAX_VENUE_IMAGES = 8;

// Add as public methods on VenueService:

  async addImage(
    id: string,
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<Venue> {
    const venue = await this.findOne(id);
    this.assertOwnerOrAdmin(venue, user);
    if (venue.images.length >= MAX_VENUE_IMAGES) {
      throw new BadRequestException(
        `Cụm sân chỉ được tối đa ${MAX_VENUE_IMAGES} ảnh`,
      );
    }

    venue.images = [...venue.images, `/uploads/venues/${file.filename}`];
    return this.venueRepo.save(venue);
  }

  async removeImage(
    id: string,
    user: AuthenticatedUser,
    url: string,
  ): Promise<Venue> {
    const venue = await this.findOne(id);
    this.assertOwnerOrAdmin(venue, user);

    venue.images = venue.images.filter((img) => img !== url);
    const saved = await this.venueRepo.save(venue);

    const filename = url.split('/').pop();
    if (filename) {
      try {
        await fs.unlink(join(VENUE_UPLOADS_DIR, filename));
      } catch {
        // File already gone from disk — not fatal, the DB record is the
        // source of truth and it's already updated above.
      }
    }

    return saved;
  }
```

(`findOne` already throws `NotFoundException` and loads `relations: { owner: true }` — reused as-is, matching `update`/`remove`'s existing pattern.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/backend && pnpm test -- venue.service.spec.ts`
Expected: PASS (all `VenueService` tests, including the 6 new ones).

- [ ] **Step 7: Wire the controller endpoints**

```typescript
// apps/backend/src/venue/venue.controller.ts
// Add imports:
import { UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'; // merge into existing import
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger'; // merge into existing import
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { DeleteVenueImageDto } from './dto/delete-venue-image.dto';
import { VENUE_UPLOADS_DIR } from './venue-uploads.constants';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Add to VenueController:

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải ảnh lên cho cụm sân (tối đa 8 ảnh)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: Venue })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: VENUE_UPLOADS_DIR,
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WEBP'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Thiếu file ảnh');
    }
    return this.venueService.addImage(id, user, file);
  }

  @Delete(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MERCHANT, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xoá một ảnh khỏi cụm sân' })
  @ApiOkResponse({ type: Venue })
  removeImage(
    @Param('id') id: string,
    @Body() dto: DeleteVenueImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.venueService.removeImage(id, user, dto.url);
  }
```

**Note on `apps/backend/uploads/venues/` needing to exist before multer can write to it:** `diskStorage`'s `destination` does not auto-create missing directories. Create `apps/backend/uploads/venues/.gitkeep` now (an empty file) — Task 1's `.gitignore` pattern (`apps/backend/uploads/venues/*` + a negation for `.gitkeep`) already keeps this one file tracked while ignoring every real uploaded image, so the directory exists after a fresh clone or worktree checkout with no runtime `fs.mkdirSync` needed.

Check the multer import style — this project's `multer` comes transitively via `@nestjs/platform-express`; confirm `import { diskStorage } from 'multer'` resolves (it should, since `@types/multer` was added in Step 1 and the runtime package is already present as a transitive dependency of `@nestjs/platform-express`) — if it doesn't resolve cleanly, add `multer` itself as an explicit direct dependency rather than relying on hoisting.

- [ ] **Step 8: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero tsc errors.

- [ ] **Step 9: Commit**

```bash
cd apps/backend && git add package.json ../../pnpm-lock.yaml src/venue uploads/venues/.gitkeep
git commit -m "feat(backend): thêm API tải lên và xoá ảnh cụm sân"
```

---

### Task 3: e2e tests

**Files:**
- Modify: `apps/backend/test/venue.e2e-spec.ts`

**Interfaces:**
- Consumes: endpoints from Task 2.
- Produces: e2e proof of the full upload → list → delete round trip against a real file on disk.

- [ ] **Step 1: Write the failing e2e tests**

Read the file's existing `beforeAll`/fixture setup first (owner/venue/tokens already in scope) and reuse them. Needs a small fixture image file — create `apps/backend/test/fixtures/sample-venue-image.jpg` (any small valid JPEG, e.g. a 1x1 pixel — a few hundred bytes is fine) if this fixtures directory doesn't already exist; check first.

```typescript
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Venue images', () => {
  const fixturePath = join(__dirname, 'fixtures', 'sample-venue-image.jpg');

  it('uploads an image, returns it in the list, then deletes it and removes the file', async () => {
    const uploadRes = await request(app.getHttpServer())
      .post(`/venues/${venue.id}/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', fixturePath)
      .expect(201);

    expect(uploadRes.body.images.length).toBe(1);
    const imagePath = uploadRes.body.images[0] as string;
    expect(imagePath).toMatch(/^\/uploads\/venues\/.+\.jpg$/);

    const diskPath = join(__dirname, '..', 'uploads', imagePath.replace('/uploads/', ''));
    expect(existsSync(diskPath)).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/venues/${venue.id}`)
      .expect(200);
    expect(getRes.body.images).toContain(imagePath);

    const staticRes = await request(app.getHttpServer()).get(imagePath).expect(200);
    expect(staticRes.headers['content-type']).toContain('image');

    const deleteRes = await request(app.getHttpServer())
      .delete(`/venues/${venue.id}/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ url: imagePath })
      .expect(200);
    expect(deleteRes.body.images).not.toContain(imagePath);
    expect(existsSync(diskPath)).toBe(false);
  });

  it('rejects an upload from a non-owner merchant (403)', async () => {
    await request(app.getHttpServer())
      .post(`/venues/${venue.id}/images`)
      .set('Authorization', `Bearer ${otherMerchantToken}`)
      .attach('file', fixturePath)
      .expect(403);
  });

  it('rejects a non-image file with 400', async () => {
    const textFixture = join(__dirname, 'fixtures', 'not-an-image.txt');
    await request(app.getHttpServer())
      .post(`/venues/${venue.id}/images`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', textFixture)
      .expect(400);
  });
});
```

(Adapt `venue`/`ownerToken`/`otherMerchantToken` to this file's real existing variable names — read it first, don't guess. `not-an-image.txt` fixture: create a trivial text file at `apps/backend/test/fixtures/not-an-image.txt` if the fixtures directory doesn't already have something equivalent.)

- [ ] **Step 2: Run tests to verify they fail, then pass**

Run: `cd apps/backend && pnpm test:e2e -- venue.e2e-spec.ts`
Expected: FAIL first, then PASS once Task 2's endpoints are correctly wired and the `uploads/venues/` directory exists.

- [ ] **Step 3: Run full backend suite**

Run: `cd apps/backend && pnpm test && pnpm test:e2e && pnpm exec tsc --noEmit`
Expected: all pass, zero tsc errors. Closes out the backend portion of this plan.

- [ ] **Step 4: Commit**

```bash
cd apps/backend && git add test/venue.e2e-spec.ts test/fixtures
git commit -m "test(backend): thêm e2e cho luồng tải lên và xoá ảnh cụm sân"
```

---

### Task 4: Regenerate the API client

**Files:**
- Modify (tracked): `openapi.json`
- Modify (generated, git-ignored): `packages/shared/src/generated/**`, `packages/shared/dist/**`

**Interfaces:**
- Consumes: every backend change from Tasks 1-3.
- Produces: `venueControllerUploadImage`/`venueControllerRemoveImage` (confirm exact generated names, don't guess) on the `venues` client, plus a regenerated `Venue` model with `images: string[]`.

- [ ] **Step 1: Regenerate**

```bash
cd apps/backend && pnpm run swagger:export
cd ../.. && pnpm run generate:api
cd packages/shared && pnpm build
```
Expected: clean build.

- [ ] **Step 2: Inspect the generated upload function's exact signature**

Run: `grep -n "venueControllerUploadImage" -A 15 packages/shared/src/generated/venues/venues.ts` (adjust the grep target path if `output.mode: 'tags-split'` puts it somewhere else — check `packages/shared/src/generated/` directory structure first).

This is the one genuinely uncertain part of this plan: confirm whether the generated function expects a `File`/`Blob` directly, a pre-built `FormData`, or a typed body object that it wraps into `FormData` internally — Tasks 5 and 7's caller code must match whatever this actually is, not what's guessed here. Note the exact shape in this task's completion notes for Tasks 5/7 to use.

- [ ] **Step 3: Verify downstream compiles**

Run: `cd apps/backend && pnpm exec tsc --noEmit` (should still be clean — pure regen), `cd apps/web && pnpm exec tsc --noEmit`, `cd apps/mobile && pnpm exec tsc --noEmit` (expect no new errors from this task alone).

- [ ] **Step 4: Commit**

```bash
git add openapi.json
git commit -m "chore(shared): cập nhật openapi.json sau khi backend hỗ trợ ảnh cụm sân"
```

---

### Task 5: Web — merchant image upload page

**Files:**
- Create: `apps/web/src/lib/asset-url.ts`
- Create: `apps/web/src/app/merchant/venues/[venueId]/images/page.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/images/image-upload-form.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/images/image-upload-form.test.tsx`
- Create: `apps/web/src/app/merchant/venues/[venueId]/images/actions.ts`
- Create: `apps/web/src/app/merchant/venues/[venueId]/images/actions.test.ts`
- Modify: `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`
- Modify: `apps/web/.env.local.example`

**Interfaces:**
- Consumes: `venueControllerUploadImage`/`venueControllerRemoveImage` from Task 4 (use the exact shape confirmed there, not the guess below if it turns out different).

- [ ] **Step 1: Add a public-facing backend URL env var**

This codebase's existing convention (`apps/web/.env.local.example`'s own comment) is deliberately "no `NEXT_PUBLIC_` var — client never calls the backend directly." Rendering an `<img src>` for an uploaded file is a genuine, narrow exception to that rule: the *browser* has to fetch the image bytes directly from the backend's static-file route, which is a different thing from the JSON API calls that rule was written to avoid — this is the one new client-visible env var this plan needs, not a reversal of the existing convention. Add, alongside the existing `BACKEND_API_URL`:

```bash
# apps/web/.env.local.example — add below BACKEND_API_URL, with a comment
# explaining why this one IS public unlike BACKEND_API_URL above: the
# browser loads <img> tags directly from the backend's static file route,
# which is not a JSON API call.
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:3000
```

```typescript
// apps/web/src/lib/asset-url.ts
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:3000';
  return `${base}${path}`;
}
```

- [ ] **Step 2: Write the failing action tests**

Mirror `apps/web/src/app/merchant/venues/[venueId]/services/actions.ts`/`actions.test.ts`'s exact style (already shown above in this plan's research). Test `uploadImage` (validates a file was actually provided, calls the upload endpoint, revalidates the path) and `deleteImage` (calls the delete endpoint with the given URL, revalidates the path).

```typescript
// apps/web/src/app/merchant/venues/[venueId]/images/actions.ts
'use server';

import { isAxiosError } from 'axios';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';

export interface ImageActionState {
  error?: string;
}

function imagesPath(venueId: string): string {
  return `/merchant/venues/${venueId}/images`;
}

export async function uploadImage(
  venueId: string,
  _prevState: ImageActionState | undefined,
  formData: FormData,
): Promise<ImageActionState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Vui lòng chọn một ảnh' };
  }

  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  try {
    // NOTE: the exact call shape here depends on what Task 4 Step 2 found
    // for the generated function's signature — adapt this call to match
    // the real generated signature, this is illustrative only.
    await venues.venueControllerUploadImage(venueId, { file });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    if (isAxiosError(err) && err.response?.status === 400) {
      return { error: 'Ảnh không hợp lệ hoặc đã đủ số lượng tối đa (8 ảnh)' };
    }
    return { error: 'Không thể tải ảnh lên, vui lòng thử lại' };
  }

  revalidatePath(imagesPath(venueId));
  return {};
}

export async function deleteImage(venueId: string, url: string): Promise<void> {
  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  try {
    await venues.venueControllerRemoveImage(venueId, { url });
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  revalidatePath(imagesPath(venueId));
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- images`
Expected: FAIL — files don't exist yet / generated client function names not yet confirmed to match.

- [ ] **Step 4: Implement the form + page**

```tsx
// apps/web/src/app/merchant/venues/[venueId]/images/image-upload-form.tsx
'use client';

import { useActionState } from 'react';
import { uploadImage, type ImageActionState } from './actions';

const initialState: ImageActionState = {};

export function ImageUploadForm({ venueId }: { venueId: string }) {
  const boundAction = uploadImage.bind(null, venueId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="text-sm"
      />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? 'Đang tải lên...' : 'Tải ảnh lên'}
      </button>
    </form>
  );
}
```

```tsx
// apps/web/src/app/merchant/venues/[venueId]/images/page.tsx
import { createAuthenticatedApiClient } from '@/lib/api-client';
import { requireSession } from '@/lib/require-session';
import { handleApiError } from '@/lib/handle-api-error';
import { assetUrl } from '@/lib/asset-url';
import { ImageUploadForm } from './image-upload-form';
import { deleteImage } from './actions';

export default async function VenueImagesPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const session = await requireSession();
  const { venues } = createAuthenticatedApiClient(session.accessToken);

  let venue;
  try {
    const res = await venues.venueControllerFindOne(venueId);
    venue = res.data;
  } catch (err) {
    handleApiError(err);
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Ảnh cụm sân — {venue.name}</h1>

      {venue.images.length === 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Chưa có ảnh nào.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {venue.images.map((img) => (
          <div key={img} className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl(img)}
              alt=""
              className="aspect-square w-full rounded object-cover"
            />
            <form action={deleteImage.bind(null, venueId, img)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Xoá
              </button>
            </form>
          </div>
        ))}
      </div>

      {venue.images.length < 8 && (
        <div className="rounded border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <h2 className="mb-3 text-sm font-medium">Thêm ảnh mới ({venue.images.length}/8)</h2>
          <ImageUploadForm venueId={venueId} />
        </div>
      )}
    </div>
  );
}
```

(Confirm the real generated `venueControllerFindOne` response type includes `images` after Task 4's regen — it should, automatically, since `Venue`'s entity gained the field with `@ApiProperty()` in Task 1.)

- [ ] **Step 5: Add a nav link from the courts page**

In `apps/web/src/app/merchant/venues/[venueId]/courts/page.tsx`, add a second link next to the existing "Dịch vụ đi kèm" link (same spot, same style — this file's real current structure is shown earlier in this plan's research):

```tsx
        <Link href={`/merchant/venues/${venueId}/images`} className="text-sm hover:underline">
          Ảnh cụm sân
        </Link>
```

- [ ] **Step 6: Run tests and typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero new errors.

- [ ] **Step 7: Manually verify in the browser**

Per CLAUDE.md's UI-testing rule: start `apps/backend` and `apps/web` dev servers, log in as a merchant, navigate to a venue's images page, upload a real small image file, confirm it appears as a thumbnail and is reachable at its `/uploads/venues/...` URL, delete it, confirm it's gone from both the grid and disk. Report exactly what you observed.

- [ ] **Step 8: Commit**

```bash
cd apps/web && git add src/app/merchant/venues/[venueId]/images src/app/merchant/venues/[venueId]/courts/page.tsx src/lib/asset-url.ts .env.local.example
git commit -m "feat(web): thêm trang tải lên và quản lý ảnh cụm sân"
```

---

### Task 6: Web — admin venue list thumbnail strip

**Files:**
- Modify: `apps/web/src/app/admin/venues/page.tsx`

**Interfaces:**
- Consumes: `asset-url.ts` from Task 5, `venue.images` already present on `adminControllerGetVenues`'s response items (regenerated in Task 4).

- [ ] **Step 1: Add a thumbnail row to each venue card**

In `apps/web/src/app/admin/venues/page.tsx`, inside the `venueList.map((venue) => (...))` card (the real current structure is shown earlier in this plan's research, right after the `Đăng ký lúc ...` line and before the approve/reject buttons):

```tsx
            {venue.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {venue.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img}
                    src={assetUrl(img)}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded object-cover"
                  />
                ))}
              </div>
            )}
```

Add `import { assetUrl } from '@/lib/asset-url';` to this file's imports.

- [ ] **Step 2: Run tests and typecheck**

Run: `cd apps/web && pnpm test && pnpm exec tsc --noEmit`
Expected: pass, zero new errors. (No existing test for this page's exact markup is expected to break — if one does, check whether it snapshot-matches the card structure and update it to match, don't work around it.)

- [ ] **Step 3: Commit**

```bash
cd apps/web && git add src/app/admin/venues/page.tsx
git commit -m "feat(web): hiển thị ảnh xem trước trong danh sách duyệt cụm sân"
```

---

### Task 7: Mobile — `VenueDetailScreen` image carousel

**Files:**
- Modify: `apps/mobile/src/screens/venues/VenueDetailScreen.tsx`
- Modify: `apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `venue.images: string[]` from the regenerated `Venue` type (Task 4), `API_BASE_URL` already exported from `apps/mobile/src/api/client.ts`.

- [ ] **Step 1: Write the failing test**

Add to `apps/mobile/src/screens/venues/__tests__/VenueDetailScreen.test.tsx` (read the file's existing MSW mock setup and `Venue` fixture first — it's used elsewhere in this file already per the addon-services/court-status plans' history):

```typescript
it('hiển thị carousel ảnh khi venue có ảnh', async () => {
  server.use(
    http.get('*/venues/:id', () =>
      HttpResponse.json({ ...baseVenue, images: ['/uploads/venues/a.jpg', '/uploads/venues/b.jpg'] }),
    ),
  );
  await renderScreen();

  expect(await screen.findByTestId('venue-image-carousel')).toBeTruthy();
  expect(screen.getAllByTestId(/^venue-image-/)).toHaveLength(2);
});

it('hiển thị placeholder khi venue không có ảnh', async () => {
  server.use(http.get('*/venues/:id', () => HttpResponse.json({ ...baseVenue, images: [] })));
  await renderScreen();

  expect(await screen.findByTestId('venue-image-placeholder')).toBeTruthy();
});
```

(Adapt `baseVenue`/`renderScreen`/the mock-server setup to this file's real existing helpers — read it first. If the file's base fixture Venue object doesn't yet include an `images` field, adding it there is expected — matches the recurring "stale fixture missing a newly-required field" pattern already seen multiple times in this project; check for and fix any other `Venue` object-literal fixture in `apps/mobile` missing the new field via `grep -rn "images" apps/mobile/src` and `tsc --noEmit` after this task, same as done for `Court`'s `status` field in the court-status-and-blocks plan.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && pnpm test -- VenueDetailScreen`
Expected: FAIL — no carousel rendered yet.

- [ ] **Step 3: Implement the carousel**

```tsx
// apps/mobile/src/screens/venues/VenueDetailScreen.tsx
// Add to the react-native import: Image
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
// Add:
import { API_BASE_URL } from '../../api/client';

// Inside the header View, right after the closing of the ratingRow block
// and before the courts FlatList — add:
      {venue.images.length > 0 ? (
        <FlatList
          testID="venue-image-carousel"
          horizontal
          data={venue.images}
          keyExtractor={(img) => img}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageCarousel}
          renderItem={({ item, index }) => (
            <Image
              testID={`venue-image-${index}`}
              source={{ uri: `${API_BASE_URL}${item}` }}
              style={styles.venueImage}
            />
          )}
        />
      ) : (
        <View testID="venue-image-placeholder" style={styles.venueImagePlaceholder}>
          <Text style={styles.venueImagePlaceholderText}>Chưa có ảnh</Text>
        </View>
      )}
```

```typescript
// apps/mobile/src/screens/venues/VenueDetailScreen.tsx — add to styles
  imageCarousel: { gap: 8, paddingVertical: 8 },
  venueImage: { width: 240, height: 160, borderRadius: 8, backgroundColor: '#eee' },
  venueImagePlaceholder: {
    height: 160,
    borderRadius: 8,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  venueImagePlaceholderText: { color: '#999' },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && pnpm test -- VenueDetailScreen`
Expected: PASS.

- [ ] **Step 5: Run full mobile suite**

Run: `cd apps/mobile && pnpm test`
Expected: all pass — also catches any other `Venue`-fixture fallout per Step 1's note.

Run: `cd apps/mobile && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/screens/venues/VenueDetailScreen.tsx src/screens/venues/__tests__/VenueDetailScreen.test.tsx
git commit -m "feat(mobile): thêm carousel ảnh cụm sân vào màn hình chi tiết"
```

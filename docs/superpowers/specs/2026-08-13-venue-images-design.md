# Venue Images (FR-M01 / FR-P03) — Design

## Goal

The report's screen table and FR-M01/FR-P03 both expect a venue to show photos. `Venue` has no image field, no upload endpoint, no storage anywhere. Scoping to **venue-level only** — the report's Vietnamese wording is ambiguous between "cụm sân" (venue) and "sân" (court), and per-court photo galleries add real complexity (multi-entity upload UI, more storage) with no explicit ask; venue-level photos match how every comparable booking app actually presents a facility.

## Architecture

- Storage: local disk, no new cloud dependency (matches the project's "sandbox/local-first" posture elsewhere — VNPAY is sandbox-only, Postgres/Redis are local docker). `multer` (already a transitive NestJS dependency family; add `@types/multer` if not present) writes uploaded files into a gitignored `uploads/venues/` directory at the repo root, filenames are `${uuid}${ext}` to avoid collisions, never the original filename (avoids path-traversal/collision issues).
- `main.ts` adds static serving for that directory (`app.useStaticAssets` from `@nestjs/serve-static` or plain Express `app.use('/uploads', express.static(...))` — check which the codebase already leans toward, prefer the plainer Express option since `@nestjs/serve-static` isn't already a dependency and this is a small, single-purpose need).
- `Venue` gains `images: string[]` — stored as a `simple-json` TypeORM column (array of relative URL paths like `/uploads/venues/<uuid>.jpg`), not a separate `VenueImage` entity — no per-image metadata (caption, uploader, ordering beyond array order) is asked for, so a normalized table is unwarranted (YAGNI).
- New endpoints on the existing `VenueController`: `POST /venues/:id/images` (multipart, `@UseInterceptors(FileInterceptor('file'))`, merchant-owner-guarded via the existing `assertOwnerOrAdmin` pattern, appends the new path to `images` and returns the updated `Venue`), `DELETE /venues/:id/images` (body: `{ url: string }`, removes that entry from the array and deletes the file from disk — best-effort `fs.unlink`, don't fail the request if the file's already gone).
- Cap at a small fixed number of images per venue (e.g. 8) enforced server-side with a `BadRequestException` past the cap — prevents unbounded storage growth from a public-ish upload endpoint.
- File type/size validation via multer's own `fileFilter`/`limits` (image mimetypes only, a few MB cap).

## Web

Merchant venue-edit page gains an image upload widget (multi-file input, thumbnail grid with a delete button per image) and the public venue browse/detail pages render the images (a simple grid/carousel — reuse whatever image-display primitive, if any, already exists in the codebase; otherwise a plain `<img>` grid, no new UI library).

## Mobile

`VenueDetailScreen` gains an image carousel (horizontal `FlatList` or a lightweight existing RN primitive — check what's already imported in the app before adding a new carousel dependency) showing `venue.images`, falling back to a placeholder when the array is empty.

## Testing

- Unit: `VenueService`'s new image-add/remove methods — ownership check, cap enforcement, array mutation correctness (mocked `fs` for the delete path, not a real file-system unit test).
- e2e: real upload of a small fixture image via Supertest's multipart form support, assert the response's `images` array grows and the file exists on disk at that path (then clean up in `afterAll`); non-owner upload attempt gets 403; delete removes the entry and the file.
- Web/mobile: component-level tests for the upload widget / carousel using this repo's existing MSW-mock conventions for the API calls (not real file uploads in component tests).

## Out of scope

- No per-court images.
- No cloud storage (S3/Cloudinary) — explicitly deferred per the approved design choice; if this project is ever deployed somewhere with an ephemeral filesystem, local-disk storage won't survive a restart, which is an acceptable limitation for a thesis demo, not something this plan needs to solve.

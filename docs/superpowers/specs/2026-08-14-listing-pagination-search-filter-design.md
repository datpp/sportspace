# Listing Screens: Pagination, Search & Filter — Design

## Goal

Every admin/merchant listing screen today (`admin/users`, `admin/venues`, `admin/disputes`, `merchant/bookings`, `merchant/venues`, courts-per-venue, staff-per-venue) fetches the *entire* table with no pagination, no search, no filter — `merchant/bookings` even filters client-side after fetching everything. This doesn't scale past a handful of rows and gives end-users no way to find a specific record. This design adds server-side pagination + search + filter uniformly across all 7 screens, sharing one backend convention and one set of frontend URL-driven controls.

## Architecture

- **Backend:** a shared `PaginationQueryDto` (`page` default 1, `limit` default 20, max 100) that each endpoint's query DTO extends alongside its own search/filter fields. Services move from `repo.find()` to `createQueryBuilder()`, adding `ILIKE '%...%'` clauses for search fields (OR'd across the searchable columns) and `.skip((page-1)*limit).take(limit)` + `getManyAndCount()` for pagination.
- **Response shape:** every affected endpoint changes from returning a bare `T[]` to `{ data: T[], meta: { total: number, page: number, limit: number, totalPages: number } }`. This is a breaking response-shape change — existing e2e tests and web page code that destructure `.data` as an array must be updated to `.data.data` / `.data.meta`.
- **Swagger generics:** NestJS Swagger has no first-class generic response support. Before implementing, consult Context7 (project rule §0.1) for the current `ApiExtraModels` + mixin-class pattern (a `Paginated(ClassRef)` helper generating a concrete response class per resource) so the orval-generated web client gets correctly typed `{ data, meta }` responses instead of `any`.
- **Out-of-range paging:** `page`/`limit` are clamped server-side (page ≥ 1, capped at `totalPages` when known; limit capped at 100) rather than erroring — a stale bookmarked URL should degrade gracefully, not 400.
- **Frontend:** three reusable client components under `apps/web/src/components/list/`:
  - `SearchInput` — debounced (~400ms) text input, writes a `q` query param.
  - `FilterSelect` — writes an arbitrary filter key (`status`, `role`, `province`, `isActive`, …) as a query param.
  - `Pagination` — writes `page`, renders current/total pages and prev/next.
  All three operate purely on `useSearchParams`/`useRouter`/`usePathname` (Next.js App Router) and reset `page` to 1 whenever a filter or search value changes. Each screen's Server Component reads `searchParams`, forwards the relevant fields to the generated API client call, and renders these controls above the list.

## Per-screen field mapping

| Screen | Search (`q`, ILIKE) | Filters | Default view | Sort (fixed) |
|---|---|---|---|---|
| Admin/Users | `fullName`, `email` | `role` (Player/Merchant/Admin/All), `isLocked` (Locked/Unlocked/All) | All | `createdAt` DESC |
| Admin/Venues | `name`, `address`, owner `fullName`+`email` | `status` (All/Pending/Approved/Rejected), `province` (dropdown, distinct existing values) | `status=PENDING` | `createdAt` DESC |
| Admin/Disputes | `reason`, `raisedBy.fullName`+`email` | `status` (All/Open/Resolved/Rejected) | `status=OPEN` | `createdAt` DESC |
| Merchant/Bookings | customer `fullName`+`email`, court `name` | `status` (All / Pending+Confirmed / Cancelled), `venueId` (only rendered if the merchant owns >1 venue), `from`/`to` date range on `bookingDate` | Pending+Confirmed combined | `createdAt` DESC |
| Merchant/Venues | `name`, `address` | `status` (All/Pending/Approved/Rejected) | All | `createdAt` DESC |
| Courts (per venue) | `name`, `sport` | — | All | `name` ASC |
| Staff (per venue) | `fullName`, `phone` | `isActive` (Active/Inactive/All) | All | `fullName` ASC |

Merchant/Bookings' default status is a **combined** filter to preserve current behavior: when no `status` query param is present, the query uses `status IN (PENDING, CONFIRMED)`; an explicit `status` value (including `CANCELLED`) does an exact match.

## New field: `venues.province`

Admin/Venues needs a location filter. Rather than free-text address matching (already covered by the general search box) or a distance/radius search (overkill for an admin queue), venues gain a `province` column:

- New nullable column on `Venue`, added via `typeorm migration:generate` (project rule §0.2 — no hand-written migration SQL). Existing rows backfill to `null` (rendered as "Chưa xác định" in the admin filter) since there's no geocoding step to infer province from `lat`/`lng`.
- Canonical value list lives once in `packages/shared` (e.g. `packages/shared/src/constants/provinces.ts`) as Vietnam's current provinces/cities (post-2025 administrative merger, 34 units) — implementer should verify against an authoritative current source rather than the pre-merger 63-province list.
- `CreateVenueDto`/`UpdateVenueDto` gain `province: string`, validated with `@IsIn(PROVINCES)`.
- The merchant venue-creation/edit form (`apps/web/src/app/merchant/venues/new/`) gets a province `<select>` sourced from the same shared constant, so new venues always have a clean value.
- The admin filter dropdown's options are the distinct `province` values actually present among venues (plus "Tất cả" and the null bucket), not the full 34-item list, so the dropdown only shows provinces that matter right now.
- Not added to Merchant/Venues — a merchant's own venue count/spread doesn't justify it, and it can be added later if that assumption breaks.

## Error handling / edge cases

- Empty result set after filtering → existing empty-state pattern, but the message should distinguish "no results for this search/filter" from "no records exist at all."
- Search strings are trimmed and ignored (no `WHERE` clause added) when empty/whitespace-only.
- Filter values that don't match the enum/allowed set are ignored (fall back to default) rather than erroring, consistent with the "degrade gracefully on a stale URL" principle above.

## Testing

- Backend: unit tests per service covering query building (search hits/misses, each filter, pagination boundaries — page 1, last page, page beyond range) + an e2e test per endpoint asserting `meta.total` and `data.length` against seeded fixtures, following the existing e2e test patterns in `apps/backend/test/`. Per the project's `test-driven-development` skill, these are written before the query-building code.
- Frontend: no non-trivial client logic beyond URL param read/write; verified manually against the dev server per CLAUDE.md's UI-testing rule — for each screen, type a search term, apply each filter, page through results, and refresh mid-filter to confirm state survives via the URL.

## Out of scope

- User-selectable sort order (each screen keeps one fixed, sensible default sort).
- Configurable page size (fixed at 20 across all screens).
- Province filter on Merchant/Venues.
- District/ward-level location granularity — province/city only.
- Automatic province backfill for existing venues via geocoding.

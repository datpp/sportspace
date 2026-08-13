# Court Status + Slot Blocking (FR-M02) — Design

## Goal

FR-M02 ("quản lý trạng thái sân") covers two distinct merchant needs neither of which exist today: (a) taking a whole court out of service long-term (maintenance/renovation — currently `Court` has no status field at all), and (b) blocking one specific date/time slot without going through the booking flow (e.g. reserved for a private event) — currently the only way to make a slot unavailable is a real `Booking` row.

## Architecture

- `Court` gains `status: CourtStatus` (new shared enum: `ACTIVE`, `MAINTENANCE`; default `ACTIVE`). `MAINTENANCE` excludes the court from venue-search results that filter by sport/availability, and any attempt to `POST /bookings` against it is rejected with `ConflictException` ("Sân đang bảo trì, không thể đặt") — checked in `BookingService.create()` right alongside the existing court-exists check.
- New `CourtBlock` entity, mirroring `Shift`'s exact shape (same nested-under-parent pattern as Staff/Shift): `id, court (FK), blockDate, startTime, endTime, reason (text), createdAt`. No overlap-with-itself validation needed beyond what a merchant chooses to create (blocks can't double-book each other in any harmful way — the harm is only blocks vs. real bookings, handled below).
- Merchant CRUD for blocks, nested under courts (mirrors Staff's shift endpoints exactly): `POST /courts/:id/blocks`, `GET /courts/:id/blocks?date=`, `DELETE /courts/:id/blocks/:blockId`, ownership-guarded the same way `CourtController` already guards court mutations.
- **Availability integration, in both places that currently only check bookings:**
  - `GET /courts/:id/slots` (read path, `CourtService`'s slot-listing method) — a slot is unavailable if it's covered by an active `Booking` (existing logic, unchanged) **or** by a `CourtBlock` for that date/time **or** if the court's `status !== ACTIVE`.
  - `BookingService.create()`'s `assertSlotFree` (write path, inside the pessimistic-locked transaction) — must also check for an overlapping `CourtBlock` before the INSERT, using the *same* `manager` (transaction-scoped read), so a block created concurrently with a booking attempt can't create a phantom double-booking. This preserves the CLAUDE.md §6 race-condition guarantee: the pessimistic lock scope now covers "is this slot free of both bookings and blocks," not just bookings.
- A `CourtBlock` covering a slot that already has a live `Booking` is rejected at block-creation time (`ConflictException`) — merchants block empty slots, they don't force-cancel existing player bookings through this endpoint (that's what merchant-reject / admin-dispute are for).

## Web

Merchant court management page gains: a status toggle (ACTIVE/MAINTENANCE) and a blocks calendar/list (add block with date+time range+reason, remove a block) — new page under `apps/web/src/app/merchant/venues/[venueId]/courts/[courtId]/blocks/` or added to the existing court edit page (decide based on the actual current court page's shape once read).

## Testing

- Unit: `CourtService` status update + ownership; `CourtBlockService` CRUD + ownership + "reject block over an existing booking"; `BookingService.create()` gains cases — reject when court is `MAINTENANCE`, reject when the slot overlaps an active `CourtBlock`.
- e2e: court set to `MAINTENANCE` → booking attempt gets 409; block created over an empty slot → booking attempt gets 409; block creation over an already-booked slot gets 409 at block-creation time; slot listing correctly excludes both maintenance courts and blocked slots.

## Out of scope

- No recurring/repeating blocks (each block is a single date+time range).
- No notification to players when a court goes into maintenance (report doesn't ask for one; no existing booking is force-cancelled by this feature anyway).

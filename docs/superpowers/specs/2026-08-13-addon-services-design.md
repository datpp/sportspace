# Add-on Services (FR-P05) — Design

## Goal

FR-P05 ("chọn dịch vụ đi kèm") and the report's own DB schema (§4.7) list `services`/`booking_services` tables. Neither exists in the codebase. A merchant manages a per-venue catalog of add-on services (e.g. cho thuê bóng, nước uống); a player selects services + quantity when creating a booking, and the cost folds into `totalAmount`.

## Architecture

**Naming note:** the obvious class names collide with existing NestJS providers — `VenueService` (the venue module's service class) and `BookingService` (the booking module's service class) are both taken. Entity classes are named `AddOnService` (table `add_on_services`) and `BookingServiceItem` (table `booking_services`, matching the report's own schema table name even though the TS class can't be called `BookingService`).

- `AddOnService` entity: `id, venue (FK), name, price (decimal, decimalTransformer), description?, isActive (default true), createdAt, updatedAt`.
- `BookingServiceItem` entity: `id, booking (FK), addOnService (FK), quantity (int), unitPrice (decimal — snapshot of `AddOnService.price` at booking time, so a later price change doesn't retroactively alter historical bookings), createdAt`.
- Merchant CRUD, mirroring `StaffService`/`StaffController`'s exact shape (ownership via `assertOwnerOrAdmin` on the venue, same as Staff/Court): `POST /addon-services` (body incl. `venueId`), `GET /addon-services?venueId=`, `PATCH /addon-services/:id`, `DELETE /addon-services/:id`. Scaffolded via `nest g resource addon-services`, living in its own module (not flat-in-venue, since it needs `Booking`/`BookingServiceItem` wiring the way `Staff`/`Shift` didn't need cross-module entities).
- `CreateBookingDto` gains an optional `services?: { addOnServiceId: string; quantity: number }[]`. Inside `BookingService.create()`'s existing `withSlotLock` transaction (same `manager`, same lock scope — no new race window): after computing the slot's base `totalAmount`, resolve each `addOnServiceId` (must belong to the same venue as the booked court — reject with `BadRequestException` otherwise), create `BookingServiceItem` rows with `unitPrice` snapshotted from the current `AddOnService.price`, and add `quantity * unitPrice` to `totalAmount` before saving the booking.
- `GET /bookings` / `GET /bookings/:id` gain a `services` relation (`BookingServiceItem[]`, each with its `addOnService` loaded) so the player/merchant can see the itemized breakdown — mirrors how `payment` was added to `Booking` responses in the cancel-refund-policy plan (a `services?: BookingServiceSummary[]` field, populated the same batch-attach way `attachPaymentSummaries` does for `findAll`).

## Web

New page `apps/web/src/app/merchant/venues/[venueId]/services/` (page.tsx, actions.ts + test, form component + test, error.tsx, loading.tsx) — directly mirrors the Staff directory page's shape and Vitest conventions.

## Mobile

The booking-creation screen (wherever `CreateBookingDto` is currently submitted from — find the actual screen first, don't assume) gains a services step: fetch `GET /addon-services?venueId=` for the chosen court's venue, render a checkbox + quantity stepper per service, include the selection in the create-booking call, and show the itemized total (base price + services) before submit.

## Testing

- Unit: `AddOnServiceService` CRUD + ownership (mirrors `StaffService`'s test shape exactly). `BookingService.create()` gains cases: booking with zero services (unchanged `totalAmount`, no regression), booking with one service, booking with multiple services + quantities (correct summed `totalAmount`), a service ID from a *different* venue is rejected.
- e2e: full flow — merchant creates a service, player books with it, response includes the itemized breakdown and the correct summed `totalAmount`.

## Out of scope

- No adding/removing services from an already-`CONFIRMED` booking (selection is create-time only, per the approved design choice).
- No per-court services (venue-scoped only, matches how the report describes it).

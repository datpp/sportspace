// MSW mock handlers (CLAUDE.md §0.3 — generate mocks, don't hand-write JSON).
// Kept out of the main './index.ts' barrel on purpose: msw pulls in an
// ESM-only dependency chain (e.g. `rettime`) that consumers who don't test
// with MSW (backend uses createMock<T>() instead) shouldn't be forced to
// load just by importing @sportspace/shared. Import from
// '@sportspace/shared/mocks' instead.
// Each *.msw.ts also re-exports its *.faker.ts response generators, so this
// alone covers both without a separate .faker export.
// One line per orval tag folder under ./generated/ — same list as index.ts,
// keep both in sync when a new @ApiTags() controller is added.
export * from './generated/app/app.msw';
export * from './generated/auth/auth.msw';
export * from './generated/venues/venues.msw';
export * from './generated/courts/courts.msw';
export * from './generated/bookings/bookings.msw';
export * from './generated/merchant/merchant.msw';
export * from './generated/payments/payments.msw';
export * from './generated/matches/matches.msw';
export * from './generated/admin/admin.msw';
export * from './generated/notifications/notifications.msw';
export * from './generated/users/users.msw';
export * from './generated/staff/staff.msw';
export * from './generated/reviews/reviews.msw';

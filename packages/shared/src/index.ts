export * from './enums/role.enum';
export * from './enums/payment-status.enum';
export * from './constants/provinces';
export * from './generated/model';
// Some entity `status` properties generate an orval type of the exact same
// name as our hand-written enum (orval names inline-enum properties
// `{Schema}{Property}`, e.g. "Booking" + "Status" -> `BookingStatus`). Two
// wildcard re-exports of the same name stay ambiguous regardless of order —
// only an explicit named export disambiguates in favor of the hand-written
// enum. Apply this to every entity-status enum, even ones not yet reflected
// in a Swagger-annotated property, since it'll collide the moment they are.
export { BookingStatus } from './enums/booking-status.enum';
export { VenueStatus } from './enums/venue-status.enum';
export { MatchStatus } from './enums/match-status.enum';
export { MatchParticipantStatus } from './enums/match-participant-status.enum';
export { DisputeStatus } from './enums/dispute-status.enum';
// One line per orval tag folder under ./generated/ (each @ApiTags() in a
// backend controller creates one). Adding a new controller tag without a
// matching line here silently leaves its client functions unreachable from
// '@sportspace/shared' — check `ls packages/shared/src/generated/` against
// this list after regenerating.
export * from './generated/admin/admin';
export * from './generated/app/app';
export * from './generated/auth/auth';
export * from './generated/venues/venues';
export * from './generated/courts/courts';
export * from './generated/bookings/bookings';
export * from './generated/merchant/merchant';
export * from './generated/payments/payments';
export * from './generated/matches/matches';
export * from './generated/notifications/notifications';
export * from './generated/users/users';
export * from './generated/staff/staff';
export * from './generated/reviews/reviews';
export * from './generated/disputes/disputes';
export * from './generated/system-config/system-config';

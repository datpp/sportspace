#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT

echo "--- Seeding user/venue/court for the race test ---"
npx ts-node -r tsconfig-paths/register test/k6/seed.ts | tee "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "--- Running k6: 50 parallel POST /bookings for the same slot ---"
k6 run test/k6/booking-race.js

echo "--- Verifying DB state ---"
npx ts-node -r tsconfig-paths/register test/k6/verify.ts "$COURT_ID" "$BOOKING_DATE" "$START_TIME"

echo "--- Cleaning up seed data ---"
npx ts-node -r tsconfig-paths/register test/k6/cleanup.ts "$COURT_ID" "$VENUE_ID" "$OWNER_ID" "$PLAYER_ID"

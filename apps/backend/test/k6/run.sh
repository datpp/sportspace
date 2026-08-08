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

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "--- Logging in as the seeded player to get a JWT ---"
LOGIN_RES=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$PLAYER_EMAIL\",\"password\":\"$PLAYER_PASSWORD\"}")
ACCESS_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).accessToken)" "$LOGIN_RES")
if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "undefined" ]; then
  echo "Login failed: $LOGIN_RES" >&2
  exit 1
fi
export ACCESS_TOKEN

echo "--- Running k6: 50 parallel POST /bookings for the same slot ---"
k6 run test/k6/booking-race.js

echo "--- Verifying DB state ---"
npx ts-node -r tsconfig-paths/register test/k6/verify.ts "$COURT_ID" "$BOOKING_DATE" "$START_TIME"

echo "--- Cleaning up seed data ---"
npx ts-node -r tsconfig-paths/register test/k6/cleanup.ts "$COURT_ID" "$VENUE_ID" "$OWNER_ID" "$PLAYER_ID"

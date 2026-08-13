#!/usr/bin/env bash
# Khởi động môi trường dev SportSpace: Postgres/Redis (docker), backend NestJS,
# web Next.js, migration, seed user mặc định — rồi in thông tin truy cập.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

RUN_DIR="$ROOT_DIR/.run"
mkdir -p "$RUN_DIR"
BACKEND_LOG="$RUN_DIR/backend.log"
WEB_LOG="$RUN_DIR/web.log"
PORTS_FILE="$RUN_DIR/ports"

BACKEND_PORT="${BACKEND_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"

log() { printf '[start.sh] %s\n' "$1"; }

# `pnpm run start:dev`/`next dev` spawn a child process that outlives their
# wrapper's own PID, so tracking wrapper PIDs (like $!) doesn't let stop.sh
# actually kill the listening server — kill whatever is bound to the port instead.
kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    log "Đang dừng tiến trình cũ trên cổng $port..."
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

cleanup_stale_ports() {
  if [[ -f "$PORTS_FILE" ]]; then
    while read -r port; do
      [[ -n "$port" ]] && kill_port "$port"
    done < "$PORTS_FILE"
    rm -f "$PORTS_FILE"
  fi
}

wait_for_postgres() {
  log "Đang chờ Postgres sẵn sàng..."
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U sportspace >/dev/null 2>&1; then
      log "Postgres đã sẵn sàng."
      return 0
    fi
    sleep 1
  done
  log "LỖI: Postgres không sẵn sàng sau 30s."
  exit 1
}

wait_for_redis() {
  log "Đang chờ Redis sẵn sàng..."
  for _ in $(seq 1 15); do
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
      log "Redis đã sẵn sàng."
      return 0
    fi
    sleep 1
  done
  log "LỖI: Redis không sẵn sàng sau 15s."
  exit 1
}

wait_for_backend_http() {
  log "Đang chờ backend phản hồi trên cổng $BACKEND_PORT..."
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:${BACKEND_PORT}/"; then
      log "Backend đã sẵn sàng."
      return 0
    fi
    sleep 1
  done
  log "LỖI: Backend không phản hồi sau 60s — xem log tại $BACKEND_LOG"
  exit 1
}

check_port_free() {
  local port="$1"
  local label="$2"
  if lsof -nP -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    log "LỖI: Cổng ${port} (${label}) đã có tiến trình khác đang dùng."
    lsof -nP -i ":${port}" -sTCP:LISTEN
    exit 1
  fi
}

cleanup_stale_ports
check_port_free "$BACKEND_PORT" "backend"
check_port_free "$WEB_PORT" "web"
printf '%s\n%s\n' "$BACKEND_PORT" "$WEB_PORT" > "$PORTS_FILE"

log "Bước 1/5: Khởi động Postgres + Redis (docker compose)..."
docker compose up -d postgres redis
wait_for_postgres
wait_for_redis

log "Bước 2/5: Chạy migration backend..."
(cd apps/backend && pnpm run migration:run)

log "Bước 3/5: Khởi động backend (NestJS) trên cổng $BACKEND_PORT..."
(cd apps/backend && PORT="$BACKEND_PORT" pnpm run start:dev) > "$BACKEND_LOG" 2>&1 &
disown
wait_for_backend_http

log "Bước 4/5: Seed user mặc định (bỏ qua nếu đã tồn tại)..."
SEED_OUTPUT="$(cd apps/backend && pnpm run seed:dev 2>&1)"
echo "$SEED_OUTPUT" >> "$RUN_DIR/seed.log"

log "Bước 5/5: Khởi động web (Next.js) trên cổng $WEB_PORT..."
(cd apps/web && BACKEND_API_URL="http://localhost:${BACKEND_PORT}" pnpm exec next dev -p "$WEB_PORT") > "$WEB_LOG" 2>&1 &
disown

extract() { echo "$SEED_OUTPUT" | grep "^$1=" | cut -d= -f2-; }

cat <<EOF

========================================================================
 SportSpace — môi trường dev đã khởi động
========================================================================
 Backend API:     http://localhost:${BACKEND_PORT}
 Swagger docs:    http://localhost:${BACKEND_PORT}/api
 Web dashboard:   http://localhost:${WEB_PORT}

 Tài khoản mặc định (mật khẩu giống nhau cho cả 3):
   ADMIN:    $(extract ADMIN_EMAIL)     / $(extract ADMIN_PASSWORD)
   MERCHANT: $(extract MERCHANT_EMAIL)  / $(extract MERCHANT_PASSWORD)
   PLAYER:   $(extract PLAYER_EMAIL)    / $(extract PLAYER_PASSWORD)

 Log backend: $BACKEND_LOG
 Log web:     $WEB_LOG
 Dừng lại:    ./stop.sh
========================================================================
EOF

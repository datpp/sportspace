#!/usr/bin/env bash
# Dừng backend + web do start.sh khởi động. Postgres/Redis (docker) vẫn giữ
# chạy vì đó là hạ tầng dev dùng chung, không thuộc vòng đời start/stop này.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTS_FILE="$ROOT_DIR/.run/ports"

if [[ ! -f "$PORTS_FILE" ]]; then
  echo "[stop.sh] Không có tiến trình nào đang chạy (thiếu $PORTS_FILE)."
  exit 0
fi

while read -r port; do
  [[ -z "$port" ]] && continue
  pids="$(lsof -ti ":${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "[stop.sh] Dừng tiến trình trên cổng $port (PID: $(echo "$pids" | tr '\n' ' '))..."
    echo "$pids" | xargs kill 2>/dev/null || true
  fi
done < "$PORTS_FILE"

rm -f "$PORTS_FILE"
echo "[stop.sh] Đã dừng backend và web."

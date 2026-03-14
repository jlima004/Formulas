#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_STATE_FILE=".artifacts/e2e-drive-real/runtime-state.json"
POINTER_FILE=".e2e-drive-real.runtime-state-path"
STATE_FILE="$DEFAULT_STATE_FILE"

log() {
  printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"
}

kill_pid_if_running() {
  local pid="$1"
  local label="$2"

  if printf '%s' "$pid" | grep -Eq '^[0-9]+$' && kill -0 "$pid" 2>/dev/null; then
    log "Encerrando $label (pid=$pid)."
    kill "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
}

if [ -f "$POINTER_FILE" ]; then
  STATE_FILE="$(cat "$POINTER_FILE")"
fi

if [ -f "$STATE_FILE" ]; then
  if ! command -v jq >/dev/null 2>&1; then
    log "[ERRO] jq nao encontrado para ler state file: $STATE_FILE"
    exit 1
  fi

  API_PID="$(jq -r '.apiPid // empty' "$STATE_FILE")"
  WORKER_PID="$(jq -r '.workerPid // empty' "$STATE_FILE")"
  CLOUDFLARED_PID="$(jq -r '.cloudflaredPid // empty' "$STATE_FILE")"
  RUN_ID="$(jq -r '.runId // empty' "$STATE_FILE")"

  [ -n "$RUN_ID" ] && log "Encerrando runtime persistente do run $RUN_ID."

  kill_pid_if_running "$WORKER_PID" "worker"
  kill_pid_if_running "$API_PID" "api"
  kill_pid_if_running "$CLOUDFLARED_PID" "cloudflared"
else
  log "State file de runtime nao encontrado. Seguindo para cleanup de containers."
fi

rm -f "$DEFAULT_STATE_FILE" "$POINTER_FILE" ".e2e-drive-real.lock"

log "Encerrando containers docker compose."
docker compose down -v --remove-orphans

log "Ambiente encerrado com sucesso."
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCK_DIR=".e2e-drive-real.lock"
KEEP_ENV_UP="${KEEP_ENV_UP:-0}"
KEEP_RUNTIME_UP="${KEEP_RUNTIME_UP:-0}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-420}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-4}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[ERRO] Ja existe uma execucao em andamento ($LOCK_DIR)."
  exit 1
fi

early_cleanup() {
  rm -rf "$LOCK_DIR"
}

trap early_cleanup EXIT INT TERM

START_TS="$(date +%s)"
RUN_ID="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_BASE=".artifacts/e2e-drive-real"

if ! mkdir -p "$ARTIFACT_BASE" 2>/dev/null; then
  ARTIFACT_BASE="/tmp/formulas-e2e-drive-real"
  mkdir -p "$ARTIFACT_BASE"
fi

ARTIFACT_DIR="$ARTIFACT_BASE/$RUN_ID"
mkdir -p "$ARTIFACT_DIR"
RUNTIME_STATE_FILE="$ARTIFACT_BASE/runtime-state.json"
STATE_POINTER_FILE=".e2e-drive-real.runtime-state-path"

API_LOG="$ARTIFACT_DIR/api.log"
WORKER_LOG="$ARTIFACT_DIR/worker.log"
CLOUDFLARED_LOG="$ARTIFACT_DIR/cloudflared.log"
RESPONSES_LOG="$ARTIFACT_DIR/http-responses.jsonl"
SQL_LOG="$ARTIFACT_DIR/sql-checks.log"

API_PID=""
WORKER_PID=""
CLOUDFLARED_PID=""
TUNNEL_URL=""
WEBHOOK_URL=""
WATCH_CHANNEL_ID=""
WATCH_RESOURCE_ID=""
LOCAL_MYSQL_HOST="${LOCAL_MYSQL_HOST:-127.0.0.1}"
LOCAL_MYSQL_PORT="${LOCAL_MYSQL_PORT:-${MYSQL_PORT:-3306}}"
LOCAL_REDIS_URL="${LOCAL_REDIS_URL:-redis://127.0.0.1:6379}"

log() {
  printf '[%s] %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  log "[ERRO] $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatorio nao encontrado: $1"
}

clear_runtime_state() {
  rm -f "$RUNTIME_STATE_FILE" "$STATE_POINTER_FILE"
}

write_runtime_state() {
  cat > "$RUNTIME_STATE_FILE" <<EOF
{
  "runId": "$RUN_ID",
  "artifactDir": "$ARTIFACT_DIR",
  "apiPid": $API_PID,
  "workerPid": $WORKER_PID,
  "cloudflaredPid": $CLOUDFLARED_PID,
  "tunnelUrl": "$TUNNEL_URL",
  "watchChannelId": "$WATCH_CHANNEL_ID",
  "watchResourceId": "$WATCH_RESOURCE_ID",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  printf '%s\n' "$RUNTIME_STATE_FILE" > "$STATE_POINTER_FILE"
}

log "Artifacts em: $ARTIFACT_DIR"
clear_runtime_state

kill_port_3000_listeners() {
  local pids
  pids="$(ss -ltnp '( sport = :3000 )' 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u | tr '\n' ' ')"

  if [ -n "${pids// }" ]; then
    log "Encerrando processo(s) na porta 3000: $pids"
    for pid in $pids; do
      local parent_pid
      parent_pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"

      if [ -n "$parent_pid" ] && [ "$parent_pid" -gt 1 ] 2>/dev/null; then
        kill -9 "$parent_pid" 2>/dev/null || true
      fi

      kill -9 "$pid" 2>/dev/null || true
    done
    sleep 1
  fi
}

cleanup() {
  local exit_code=$?
  local keep_runtime=0

  if [ "$KEEP_RUNTIME_UP" = "1" ] && [ "$exit_code" -eq 0 ]; then
    keep_runtime=1
  fi

  if [ "$keep_runtime" -eq 0 ]; then
    if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
      kill "$WORKER_PID" 2>/dev/null || true
    fi

    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
      kill "$API_PID" 2>/dev/null || true
    fi

    if [ -n "$CLOUDFLARED_PID" ] && kill -0 "$CLOUDFLARED_PID" 2>/dev/null; then
      kill "$CLOUDFLARED_PID" 2>/dev/null || true
    fi

    clear_runtime_state
  else
    log "Mantendo runtime ativo (KEEP_RUNTIME_UP=1)."
    write_runtime_state
  fi

  if [ "$keep_runtime" -eq 1 ]; then
    log "Mantendo containers ativos para teste manual em tempo real."
  else
    if [ "$KEEP_ENV_UP" = "0" ]; then
      log "Encerrando containers (KEEP_ENV_UP=0)."
      docker compose down -v --remove-orphans >/dev/null 2>&1 || true
    else
      log "Mantendo containers ativos (KEEP_ENV_UP=1)."
    fi
  fi

  rm -rf "$LOCK_DIR"

  local end_ts
  end_ts="$(date +%s)"
  local elapsed=$((end_ts - START_TS))

  if [ "$exit_code" -eq 0 ]; then
    log "Teste E2E finalizado com sucesso em ${elapsed}s."
    log "Artifacts: $ARTIFACT_DIR"
    if [ "$keep_runtime" -eq 1 ]; then
      log "Runtime persistente ativo. Para encerrar: npm run stop:e2e:drive-real"
      log "State file: $RUNTIME_STATE_FILE"
    fi
  else
    log "Teste E2E falhou em ${elapsed}s."
    log "Artifacts: $ARTIFACT_DIR"
  fi

  exit "$exit_code"
}
trap cleanup EXIT INT TERM

http_json() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local output

  if [ -n "$data" ]; then
    output="$(curl -sS -X "$method" "$url" -H 'content-type: application/json' -d "$data" -w '\n%{http_code}')"
  else
    output="$(curl -sS -X "$method" "$url" -w '\n%{http_code}')"
  fi

  local status
  status="$(printf '%s' "$output" | tail -n1)"
  local body
  body="$(printf '%s' "$output" | sed '$d')"

  printf '{"method":"%s","url":"%s","status":%s,"body":%s}\n' "$method" "$url" "$status" "${body:-null}" >> "$RESPONSES_LOG"

  printf '%s\n' "$status"
  printf '%s\n' "$body"
}

mysql_exec() {
  local sql="$1"
  docker compose exec -T mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -Nse "$sql"
}

count_drive_pdfs() {
  ./node_modules/.bin/tsx -e "import 'dotenv/config'; import { DriveClient } from './src/infra/google/driveClient.ts'; (async () => { const folderId = process.env.DRIVE_FOLDER_ID; if (!folderId) throw new Error('DRIVE_FOLDER_ID ausente'); const maxFiles = Number(process.env.DRIVE_SYNC_MAX_FILES ?? '200'); const client = new DriveClient(); const files = await client.listPdfFilesInFolder(folderId, maxFiles); console.log(files.length); })().catch((e) => { console.error(e); process.exit(1); });"
}

wait_for_mysql() {
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if docker compose exec -T mysql mysqladmin ping -h localhost -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_redis() {
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q '^PONG$'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

wait_for_health() {
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl -fsS "http://localhost:3000/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$POLL_INTERVAL_SECONDS"
  done
  return 1
}

wait_for_api_started() {
  local deadline=$((SECONDS + 30))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if ! kill -0 "$API_PID" 2>/dev/null; then
      return 1
    fi

    if grep -q 'Servidor API iniciado' "$API_LOG" 2>/dev/null; then
      return 0
    fi

    sleep 1
  done

  return 1
}

wait_for_cloudflared_url() {
  local deadline=$((SECONDS + 90))
  while [ "$SECONDS" -lt "$deadline" ]; do
    local match
    match="$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" 2>/dev/null | grep -v '^https://api\.trycloudflare\.com$' | tail -n1 || true)"
    if [ -n "$match" ]; then
      printf '%s\n' "$match"
      return 0
    fi
    sleep 1
  done
  return 1
}

require_cmd docker
require_cmd curl
require_cmd jq
require_cmd sed
require_cmd cloudflared
require_cmd npm

[ -f .env ] || fail "Arquivo .env nao encontrado."

set -a
# shellcheck disable=SC1091
source ./.env
set +a

[ -n "${DRIVE_FOLDER_ID:-}" ] || fail "DRIVE_FOLDER_ID nao configurado no .env"
[ -n "${DRIVE_WEBHOOK_TOKEN:-}" ] || fail "DRIVE_WEBHOOK_TOKEN nao configurado no .env"
[ -n "${MYSQL_USER:-}" ] || fail "MYSQL_USER nao configurado no .env"
[ -n "${MYSQL_PASSWORD:-}" ] || fail "MYSQL_PASSWORD nao configurado no .env"
[ -n "${MYSQL_DATABASE:-}" ] || fail "MYSQL_DATABASE nao configurado no .env"

if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ] || fail "GOOGLE_APPLICATION_CREDENTIALS aponta para arquivo inexistente: $GOOGLE_APPLICATION_CREDENTIALS"
elif [ -z "${GOOGLE_SERVICE_ACCOUNT_KEY_JSON:-}" ]; then
  fail "Configure GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_SERVICE_ACCOUNT_KEY_JSON no .env"
fi

log "Resetando ambiente docker do zero."
docker compose down -v --remove-orphans
log "Subindo MySQL e Redis limpos."
docker compose up -d --build mysql redis

wait_for_mysql || fail "Timeout aguardando MySQL pronto."
wait_for_redis || fail "Timeout aguardando Redis pronto."

log "Instalando dependencias e compilando projeto."
npm install
npm run build

log "Subindo tunnel cloudflared para localhost:3000."
nohup cloudflared tunnel --url http://localhost:3000 > "$CLOUDFLARED_LOG" 2>&1 &
CLOUDFLARED_PID=$!

TUNNEL_URL="$(wait_for_cloudflared_url)" || fail "Nao foi possivel capturar URL publica do cloudflared."
log "Tunnel URL detectada: $TUNNEL_URL"
WEBHOOK_URL="${TUNNEL_URL%/}/webhooks/drive"
log "Webhook URL configurada: $WEBHOOK_URL"

log "Atualizando DRIVE_WEBHOOK_ADDRESS no .env"
if grep -q '^DRIVE_WEBHOOK_ADDRESS=' .env; then
  sed -i "s|^DRIVE_WEBHOOK_ADDRESS=.*|DRIVE_WEBHOOK_ADDRESS=$WEBHOOK_URL|" .env
else
  printf '\nDRIVE_WEBHOOK_ADDRESS=%s\n' "$WEBHOOK_URL" >> .env
fi

# Keep current process env aligned with .env update for child processes.
DRIVE_WEBHOOK_ADDRESS="$WEBHOOK_URL"

log "Iniciando API e worker reais."

if ss -ltn '( sport = :3000 )' 2>/dev/null | tail -n +2 | grep -q '.'; then
  kill_port_3000_listeners
fi

if ss -ltn '( sport = :3000 )' 2>/dev/null | tail -n +2 | grep -q '.'; then
  fail "Porta 3000 permaneceu ocupada mesmo apos tentativa de cleanup."
fi

nohup env MYSQL_HOST="$LOCAL_MYSQL_HOST" MYSQL_PORT="$LOCAL_MYSQL_PORT" REDIS_URL="$LOCAL_REDIS_URL" ./node_modules/.bin/tsx src/index.ts --mode=api > "$API_LOG" 2>&1 &
API_PID=$!

wait_for_api_started || {
  tail -n 80 "$API_LOG" || true
  fail "API nao inicializou corretamente."
}

nohup env MYSQL_HOST="$LOCAL_MYSQL_HOST" MYSQL_PORT="$LOCAL_MYSQL_PORT" REDIS_URL="$LOCAL_REDIS_URL" ./node_modules/.bin/tsx src/worker.ts > "$WORKER_LOG" 2>&1 &
WORKER_PID=$!

wait_for_health || fail "API nao respondeu /health dentro do timeout."

DIAG_RAW="$(curl -sS http://localhost:3000/api/diagnostics)"
printf '%s\n' "$DIAG_RAW" > "$ARTIFACT_DIR/diagnostics-initial.json"
DIAG_STATUS="$(printf '%s' "$DIAG_RAW" | jq -r '.status // "unknown"')"
[ "$DIAG_STATUS" = "ok" ] || fail "Diagnostics inicial nao esta ok (status=$DIAG_STATUS)."

log "Limpando tabelas alvo para baseline do teste."
mysql_exec "SET FOREIGN_KEY_CHECKS=0; TRUNCATE TABLE formula_items; TRUNCATE TABLE formulas; TRUNCATE TABLE drive_webhook_receipts; TRUNCATE TABLE drive_file_checkpoints; UPDATE drive_watch_channels SET status='stopped'; SET FOREIGN_KEY_CHECKS=1;" || fail "Falha ao limpar tabelas no baseline"

log "Registrando watch no Drive."
readarray -t WATCH_START < <(http_json POST "http://localhost:3000/api/drive/watch/start")
WATCH_START_STATUS="${WATCH_START[0]}"
WATCH_START_BODY="${WATCH_START[1]}"
[ "$WATCH_START_STATUS" = "201" ] || fail "Falha no watch/start. HTTP $WATCH_START_STATUS"
printf '%s\n' "$WATCH_START_BODY" > "$ARTIFACT_DIR/watch-start.json"

WATCH_CHANNEL_ID="$(printf '%s' "$WATCH_START_BODY" | jq -r '.started.channelId // empty')"
WATCH_RESOURCE_ID="$(printf '%s' "$WATCH_START_BODY" | jq -r '.started.resourceId // empty')"
[ -n "$WATCH_CHANNEL_ID" ] || fail "Resposta de watch/start sem channelId"
[ -n "$WATCH_RESOURCE_ID" ] || fail "Resposta de watch/start sem resourceId"

DB_WEBHOOK_ADDR="$(mysql_exec "SELECT webhook_address FROM drive_watch_channels WHERE channel_id = '$WATCH_CHANNEL_ID' LIMIT 1;")"
printf 'watch_channel=%s\nwatch_resource=%s\nwatch_webhook_db=%s\n' "$WATCH_CHANNEL_ID" "$WATCH_RESOURCE_ID" "$DB_WEBHOOK_ADDR" >> "$SQL_LOG"
[ "$DB_WEBHOOK_ADDR" = "$WEBHOOK_URL" ] || fail "webhook_address no DB diverge da URL esperada do webhook"

log "Disparando sync manual da pasta real do Drive."
EXPECTED_PDFS="$(count_drive_pdfs | tail -n1 | tr -d '[:space:]')"
[ -n "$EXPECTED_PDFS" ] || fail "Nao foi possivel determinar a quantidade de PDFs visiveis no Drive"
log "PDFs visiveis no Drive: $EXPECTED_PDFS"

readarray -t SYNC_START < <(http_json POST "http://localhost:3000/api/drive/sync")
SYNC_STATUS="${SYNC_START[0]}"
SYNC_BODY="${SYNC_START[1]}"
[ "$SYNC_STATUS" = "202" ] || fail "Falha no /api/drive/sync. HTTP $SYNC_STATUS"
printf '%s\n' "$SYNC_BODY" > "$ARTIFACT_DIR/sync-start.json"

log "Aguardando populacao de checkpoints, formulas e itens."
SYNC_OK=0
dealine=$((SECONDS + TIMEOUT_SECONDS))
while [ "$SECONDS" -lt "$dealine" ]; do
  CHECKPOINTS="$(mysql_exec "SELECT COUNT(*) FROM drive_file_checkpoints;")"
  FORMULAS="$(mysql_exec "SELECT COUNT(*) FROM formulas;")"
  ITEMS="$(mysql_exec "SELECT COUNT(*) FROM formula_items;")"

  printf 'checkpoints=%s formulas=%s items=%s\n' "$CHECKPOINTS" "$FORMULAS" "$ITEMS" >> "$SQL_LOG"

  if [ "${CHECKPOINTS:-0}" -ge "${EXPECTED_PDFS:-0}" ] && [ "${FORMULAS:-0}" -gt 0 ] && [ "${ITEMS:-0}" -gt 0 ]; then
    SYNC_OK=1
    break
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

[ "$SYNC_OK" -eq 1 ] || fail "Timeout aguardando processamento completo dos PDFs visiveis no Drive"

log "Validando deduplicacao do webhook com mesmo message-number."
DEDUP_MESSAGE="9000000001"
WEBHOOK_HEADERS=(
  -H "x-goog-channel-id: $WATCH_CHANNEL_ID"
  -H "x-goog-resource-id: $WATCH_RESOURCE_ID"
  -H "x-goog-channel-token: $DRIVE_WEBHOOK_TOKEN"
  -H "x-goog-resource-state: sync"
  -H "x-goog-message-number: $DEDUP_MESSAGE"
  -H "content-type: application/json"
)

FIRST_OUTPUT="$(curl -sS -X POST "http://localhost:3000/webhooks/drive" "${WEBHOOK_HEADERS[@]}" -d '{"source":"e2e-dedup"}' -w '\n%{http_code}')"
SECOND_OUTPUT="$(curl -sS -X POST "http://localhost:3000/webhooks/drive" "${WEBHOOK_HEADERS[@]}" -d '{"source":"e2e-dedup"}' -w '\n%{http_code}')"

FIRST_STATUS="$(printf '%s' "$FIRST_OUTPUT" | tail -n1)"
SECOND_STATUS="$(printf '%s' "$SECOND_OUTPUT" | tail -n1)"
FIRST_BODY="$(printf '%s' "$FIRST_OUTPUT" | sed '$d')"
SECOND_BODY="$(printf '%s' "$SECOND_OUTPUT" | sed '$d')"

[ "$FIRST_STATUS" = "202" ] || fail "Primeira chamada de webhook retornou HTTP $FIRST_STATUS"
[ "$SECOND_STATUS" = "202" ] || fail "Segunda chamada de webhook retornou HTTP $SECOND_STATUS"

printf '%s\n' "$FIRST_BODY" > "$ARTIFACT_DIR/webhook-first.json"
printf '%s\n' "$SECOND_BODY" > "$ARTIFACT_DIR/webhook-second.json"

FIRST_ACCEPTED="$(printf '%s' "$FIRST_BODY" | jq -r '.accepted // false')"
SECOND_ACCEPTED="$(printf '%s' "$SECOND_BODY" | jq -r '.accepted // false')"
FIRST_DUP="$(printf '%s' "$FIRST_BODY" | jq -r '.duplicated // false')"
SECOND_DUP="$(printf '%s' "$SECOND_BODY" | jq -r '.duplicated // false')"
[ "$FIRST_ACCEPTED" = "true" ] || fail "Primeira chamada de webhook nao foi aceita"
[ "$SECOND_ACCEPTED" = "true" ] || fail "Segunda chamada de webhook nao foi aceita"
[ "$FIRST_DUP" = "false" ] || fail "Primeira chamada de webhook nao deveria ser duplicada"
[ "$SECOND_DUP" = "true" ] || fail "Segunda chamada de webhook deveria ser marcada como duplicada"

DIAG_FINAL_RAW="$(curl -sS http://localhost:3000/api/diagnostics)"
printf '%s\n' "$DIAG_FINAL_RAW" > "$ARTIFACT_DIR/diagnostics-final.json"
DIAG_FINAL_STATUS="$(printf '%s' "$DIAG_FINAL_RAW" | jq -r '.status // "unknown"')"
[ "$DIAG_FINAL_STATUS" = "ok" ] || fail "Diagnostics final nao esta ok (status=$DIAG_FINAL_STATUS)."

FINAL_FORMULAS="$(mysql_exec "SELECT COUNT(*) FROM formulas;")"
FINAL_ITEMS="$(mysql_exec "SELECT COUNT(*) FROM formula_items;")"
FINAL_CHECKPOINTS="$(mysql_exec "SELECT COUNT(*) FROM drive_file_checkpoints;")"

cat > "$ARTIFACT_DIR/summary.txt" <<EOF
run_id=$RUN_ID
tunnel_url=$TUNNEL_URL
webhook_url=$WEBHOOK_URL
watch_channel_id=$WATCH_CHANNEL_ID
watch_resource_id=$WATCH_RESOURCE_ID
formulas=$FINAL_FORMULAS
formula_items=$FINAL_ITEMS
checkpoints=$FINAL_CHECKPOINTS
diagnostics_status=$DIAG_FINAL_STATUS
dedup_first=$FIRST_DUP
dedup_second=$SECOND_DUP
keep_env_up=$KEEP_ENV_UP
keep_runtime_up=$KEEP_RUNTIME_UP
EOF

log "Resumo final:"
cat "$ARTIFACT_DIR/summary.txt"

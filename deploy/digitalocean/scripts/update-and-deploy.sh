#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 4 ]; then
  echo "Uso: $0 <dominio> [branch] [caminho-env-file] [run-smoke-test]"
  echo "Exemplo: $0 api.exemplo.com master deploy/digitalocean/.env.prod true"
  exit 1
fi

DOMAIN="$1"
BRANCH="${2:-master}"
ENV_FILE_INPUT="${3:-deploy/digitalocean/.env.prod}"
RUN_SMOKE_TEST="${4:-true}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"

cd "$ROOT_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Repositorio com alteracoes locais. Commit/stash antes de atualizar."
  exit 1
fi

echo "Atualizando codigo da branch $BRANCH..."
git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

"$SCRIPT_DIR/deploy.sh" "$DOMAIN" "$ENV_FILE_INPUT"

if [ "$RUN_SMOKE_TEST" = "true" ]; then
  CERT_FILE="$ROOT_DIR/deploy/digitalocean/certbot/conf/live/$DOMAIN/fullchain.pem"
  SCHEME="https"

  if [ ! -f "$CERT_FILE" ]; then
    SCHEME="http"
  fi

  "$SCRIPT_DIR/smoke-test.sh" "$DOMAIN" "$SCHEME"
fi

echo "Atualizacao e deploy concluidos."
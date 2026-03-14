#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Uso: $0 <dominio-ou-url-base> [http|https]"
  echo "Exemplo: $0 api.exemplo.com https"
  exit 1
fi

TARGET="$1"
SCHEME="${2:-https}"

case "$TARGET" in
  http://*|https://*)
    BASE_URL="$TARGET"
    ;;
  *)
    BASE_URL="$SCHEME://$TARGET"
    ;;
esac

echo "Iniciando smoke test em: $BASE_URL"

check_endpoint() {
  PATH_NAME="$1"
  EXPECTED_STATUS="$2"

  BODY_FILE="$(mktemp)"
  STATUS="$(curl -sS -m 15 -o "$BODY_FILE" -w "%{http_code}" "$BASE_URL$PATH_NAME")"

  if [ "$STATUS" != "$EXPECTED_STATUS" ]; then
    echo "Falha em $PATH_NAME: esperado $EXPECTED_STATUS, recebido $STATUS"
    echo "Resposta:"
    cat "$BODY_FILE"
    rm -f "$BODY_FILE"
    return 1
  fi

  echo "OK $PATH_NAME -> $STATUS"
  rm -f "$BODY_FILE"
}

check_endpoint "/health" "200"
check_endpoint "/api/diagnostics" "200"
check_endpoint "/api/drive/watch" "200"

echo "Smoke test concluido com sucesso."
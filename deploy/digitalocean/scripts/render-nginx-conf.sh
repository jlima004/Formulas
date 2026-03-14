#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <dominio> <http|https>"
  exit 1
fi

DOMAIN="$1"
MODE="$2"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
TEMPLATES_DIR="$ROOT_DIR/deploy/digitalocean/nginx/templates"
OUTPUT_FILE="$ROOT_DIR/deploy/digitalocean/nginx/conf.d/app.conf"

case "$MODE" in
  http)
    TEMPLATE_FILE="$TEMPLATES_DIR/app.http.conf.template"
    ;;
  https)
    TEMPLATE_FILE="$TEMPLATES_DIR/app.https.conf.template"
    ;;
  *)
    echo "Modo invalido: $MODE (use http ou https)"
    exit 1
    ;;
esac

mkdir -p "$(dirname -- "$OUTPUT_FILE")"

sed "s/__DOMAIN__/$DOMAIN/g" "$TEMPLATE_FILE" > "$OUTPUT_FILE"

echo "Configuracao gerada em: $OUTPUT_FILE"
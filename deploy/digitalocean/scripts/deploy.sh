#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Uso: $0 <dominio> [caminho-env-file]"
  echo "Exemplo: $0 api.exemplo.com deploy/digitalocean/.env.prod"
  exit 1
fi

DOMAIN="$1"
ENV_FILE_INPUT="${2:-deploy/digitalocean/.env.prod}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/digitalocean/compose.prod.yaml"
CERT_FILE="$ROOT_DIR/deploy/digitalocean/certbot/conf/live/$DOMAIN/fullchain.pem"

case "$ENV_FILE_INPUT" in
  /*)
    ENV_FILE="$ENV_FILE_INPUT"
    ;;
  *)
    ENV_FILE="$ROOT_DIR/$ENV_FILE_INPUT"
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file nao encontrado: $ENV_FILE"
  exit 1
fi

if [ -f "$CERT_FILE" ]; then
  "$SCRIPT_DIR/render-nginx-conf.sh" "$DOMAIN" "https"
else
  echo "Certificado ainda nao encontrado para $DOMAIN. Subindo em modo HTTP."
  "$SCRIPT_DIR/render-nginx-conf.sh" "$DOMAIN" "http"
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

if [ -f "$CERT_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d certbot
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
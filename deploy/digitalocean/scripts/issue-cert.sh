#!/usr/bin/env sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Uso: $0 <dominio> <email-certbot> [caminho-env-file]"
  echo "Exemplo: $0 api.exemplo.com ops@exemplo.com deploy/digitalocean/.env.prod"
  exit 1
fi

DOMAIN="$1"
EMAIL="$2"
ENV_FILE_INPUT="${3:-deploy/digitalocean/.env.prod}"

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/deploy/digitalocean/compose.prod.yaml"

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

mkdir -p \
  "$ROOT_DIR/deploy/digitalocean/nginx/conf.d" \
  "$ROOT_DIR/deploy/digitalocean/certbot/conf" \
  "$ROOT_DIR/deploy/digitalocean/certbot/www"

"$SCRIPT_DIR/render-nginx-conf.sh" "$DOMAIN" "http"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build app
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build worker
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app worker
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate nginx

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --entrypoint certbot certbot \
  certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

"$SCRIPT_DIR/render-nginx-conf.sh" "$DOMAIN" "https"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate nginx
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d certbot

echo "Certificado emitido com sucesso para $DOMAIN."
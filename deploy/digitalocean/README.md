# Deploy em Produção na DigitalOcean (Droplet)

Este diretório contém os artefatos de produção para rodar a aplicação com Docker Compose em um Droplet.

## Estrutura

- `compose.prod.yaml`: stack de produção (app, worker, mysql, redis, nginx, certbot).
- `.env.prod.example`: template de variáveis de ambiente para produção.
- `nginx/templates/`: templates de configuração HTTP e HTTPS.
- `nginx/conf.d/`: configuração final renderizada do Nginx.
- `certbot/`: armazenamento local de certificados e desafio ACME.
- `scripts/`: scripts utilitários para bootstrap, deploy e emissão de certificado.

## Pré-requisitos

- Domínio apontando para o IP do Droplet.
- Portas 80 e 443 abertas no firewall.
- Credencial da service account disponível em `secrets/gcp-service-account.json`.
- Para droplets com pouca memória, mantenha swap ativo (recomendado) para evitar falha de build no TypeScript.

## Runbook assistido (primeiro go-live)

Use a sequência abaixo exatamente nesta ordem.

### 0) Definir variáveis (na sua máquina local)

```bash
export DROPLET_IP="SEU_IP_DROPLET"
export DROPLET_USER="root"
export DOMAIN="api.seu-dominio.com"
export CERTBOT_EMAIL="seu-email@dominio.com"
export REPO_URL="git@github.com:jlima004/Formulas.git"
export APP_DIR="/opt/formulas"
export BRANCH="master"
```

### 1) Acessar o Droplet e preparar o repositório (no Droplet)

```bash
ssh ${DROPLET_USER}@${DROPLET_IP}

apt-get update
apt-get install -y git

mkdir -p /opt
cd /opt
git clone ${REPO_URL} formulas
cd ${APP_DIR}
git checkout ${BRANCH}
git pull --ff-only origin ${BRANCH}
```

### 2) Executar bootstrap do servidor (no Droplet)

```bash
cd ${APP_DIR}
sudo sh deploy/digitalocean/scripts/bootstrap-droplet.sh
```

### 3) Criar arquivo de ambiente de produção (no Droplet)

```bash
cd ${APP_DIR}
cp deploy/digitalocean/.env.prod.example deploy/digitalocean/.env.prod
nano deploy/digitalocean/.env.prod
```

Preencha no mínimo:

- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `DRIVE_FOLDER_ID`
- `DRIVE_WEBHOOK_TOKEN`
- `DRIVE_WEBHOOK_ADDRESS=https://${DOMAIN}/webhooks/drive`
- `GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/gcp-service-account.json`

### 4) Enviar credencial Google para o Droplet (na sua máquina local)

Abra outro terminal local e execute:

```bash
scp ./secrets/gcp-service-account.json ${DROPLET_USER}@${DROPLET_IP}:${APP_DIR}/secrets/gcp-service-account.json
```

### 5) Primeiro deploy em HTTP (no Droplet)

```bash
cd ${APP_DIR}
sh deploy/digitalocean/scripts/deploy.sh ${DOMAIN} deploy/digitalocean/.env.prod
```

### 6) Emitir SSL e ativar HTTPS (no Droplet)

```bash
cd ${APP_DIR}
sh deploy/digitalocean/scripts/issue-cert.sh ${DOMAIN} ${CERTBOT_EMAIL} deploy/digitalocean/.env.prod
```

### 7) Smoke test de go-live (no Droplet)

```bash
cd ${APP_DIR}
sh deploy/digitalocean/scripts/smoke-test.sh ${DOMAIN} https
```

### 8) Validação final de publicação (no Droplet)

```bash
curl -i https://${DOMAIN}/health
curl -i https://${DOMAIN}/api/diagnostics
docker compose -f deploy/digitalocean/compose.prod.yaml --env-file deploy/digitalocean/.env.prod ps
```

Se todos os comandos acima responderem com sucesso, o go-live inicial está concluído.

## 1) Preparar o Droplet

No servidor:

```bash
sudo sh deploy/digitalocean/scripts/bootstrap-droplet.sh
```

## 2) Preparar variáveis de produção

```bash
cp deploy/digitalocean/.env.prod.example deploy/digitalocean/.env.prod
```

Edite `deploy/digitalocean/.env.prod` e preencha os segredos e IDs do Drive.

## 3) Primeiro deploy (sem certificado ainda)

```bash
sh deploy/digitalocean/scripts/deploy.sh seu-dominio.com deploy/digitalocean/.env.prod
```

Esse comando sobe a stack com Nginx em HTTP.

## 4) Emitir certificado SSL

```bash
sh deploy/digitalocean/scripts/issue-cert.sh seu-dominio.com seu-email@dominio.com deploy/digitalocean/.env.prod
```

Após a emissão, o script aplica configuração HTTPS e inicia renovação automática.

## 5) Deploys seguintes

```bash
sh deploy/digitalocean/scripts/deploy.sh seu-dominio.com deploy/digitalocean/.env.prod
```

Quando o certificado já existe, o script sobe diretamente em HTTPS.

Observacao: os scripts de deploy e emissao de certificado fazem build de `app` e `worker` em serie (duas chamadas de `docker compose build`) para reduzir pico de memoria durante `npm run build` no Docker e manter compatibilidade com versoes antigas do Docker Compose.

## 6) Atualizar codigo e redeploy (fluxo diario)

```bash
sh deploy/digitalocean/scripts/update-and-deploy.sh seu-dominio.com master deploy/digitalocean/.env.prod true
```

O script executa:

1. `git fetch`, `git checkout` da branch e `git pull --ff-only`.
2. `deploy.sh` para rebuild/restart dos servicos.
3. `smoke-test.sh` para validar `/health`, `/api/diagnostics` e `/api/drive/watch`.

Se quiser pular smoke test no redeploy:

```bash
sh deploy/digitalocean/scripts/update-and-deploy.sh seu-dominio.com master deploy/digitalocean/.env.prod false
```

## Comandos úteis

```bash
docker compose -f deploy/digitalocean/compose.prod.yaml --env-file deploy/digitalocean/.env.prod logs -f app
docker compose -f deploy/digitalocean/compose.prod.yaml --env-file deploy/digitalocean/.env.prod logs -f worker
docker compose -f deploy/digitalocean/compose.prod.yaml --env-file deploy/digitalocean/.env.prod ps
sh deploy/digitalocean/scripts/smoke-test.sh seu-dominio.com https
```

## Boas práticas aplicadas

- MySQL e Redis sem portas expostas para internet.
- Nginx como reverse proxy único de entrada (80/443).
- Certbot com renovação automática.
- App e worker separados para responsabilidades claras.
- `TRUST_PROXY=true` para Fastify atrás de proxy reverso.

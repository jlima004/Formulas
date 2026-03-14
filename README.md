# Formulas PDF Parser

Parser em Node.js + TypeScript para extrair dados de PDFs e persistir no MySQL.

## Visao geral

O projeto suporta dois modos de operacao:

1. `batch`: processa PDFs da raiz do projeto.
2. `api + worker`: recebe eventos do Google Drive e processa via fila Redis.

Fluxo principal: PDF -> normalizacao -> extracao -> persistencia MySQL.

## Pre-requisitos

- Node.js 22+
- npm
- Docker e Docker Compose

## Instalacao do zero (Docker recomendado)

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

2. Ajuste o `.env` com os valores minimos:

```env
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=formulas
MYSQL_USER=formulas
MYSQL_PASSWORD=formulas
MYSQL_ROOT_PASSWORD=root

API_MODE=api
API_HOST=0.0.0.0
API_PORT=3000

REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
REDIS_QUEUE_NAME=drive-file-events

DRIVE_FOLDER_ID=<id-da-pasta>
DRIVE_SHARED_DRIVE_ID=<id-do-shared-drive-opcional>
DRIVE_WEBHOOK_TOKEN=<token-secreto>
DRIVE_WEBHOOK_ADDRESS=https://<url-publica>/webhooks/drive

GOOGLE_APPLICATION_CREDENTIALS=/home/jlima/Projetos/Formulas/secrets/gcp-service-account.json
GOOGLE_SERVICE_ACCOUNT_KEY_JSON=
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.readonly
```

3. Suba a stack:

```bash
docker compose up -d --build
```

4. Verifique os servicos:

```bash
docker compose ps
```

## Instalacao local (alternativa)

1. Suba banco e redis:

```bash
docker compose up -d mysql redis
```

2. Instale dependencias e compile:

```bash
npm install
npm run build
```

3. Execute no modo desejado:

```bash
npm start
npm run start:api
npm run start:worker
```

## Execucao

```bash
# batch local
npm start

# somente API
npm run start:api

# API + batch no mesmo processo
npm run start:both

# worker de fila
npm run start:worker
```

## Teste real persistente (Drive)

Use este fluxo para validar entrada de novos PDFs em tempo real sem derrubar API/worker/tunnel no fim do teste.

1. Iniciar teste E2E em modo persistente:

```bash
npm run test:e2e:drive-real:persistent
```

2. Adicionar um novo PDF na pasta do Google Drive configurada.

3. Acompanhar logs e validar no banco (formulas e drive_file_checkpoints).

4. Encerrar tudo manualmente quando finalizar o teste:

```bash
npm run stop:e2e:drive-real
```

Observacao: o modo padrao continua disponivel em npm run test:e2e:drive-real e encerra runtime no final.

## Validacao rapida

1. Health:

```bash
curl -s http://localhost:3000/health
```

2. Diagnostico:

```bash
curl -s http://localhost:3000/api/diagnostics
```

3. Criar canal watch:

```bash
curl -s -X POST http://localhost:3000/api/drive/watch/start
```

4. Ver watch ativo:

```bash
curl -s http://localhost:3000/api/drive/watch
```

## Endpoints principais

- `GET /health`
- `GET /api/diagnostics`
- `POST /api/drive/sync`
- `GET /api/drive/watch`
- `POST /api/drive/watch/start`
- `POST /api/drive/watch/renew`
- `POST /api/drive/watch/stop`
- `POST /webhooks/drive`

## Troubleshooting rapido

- API nao sobe: confira `docker compose logs formulas-app`.
- Worker nao processa: confira `docker compose logs formulas-worker` e `REDIS_ENABLED=true`.
- Watch nao recebe eventos: confira URL publica HTTPS e path `/webhooks/drive`.
- Drive sem permissao: compartilhe a pasta com o `client_email` da service account.
- Erro de credencial: valide caminho em `GOOGLE_APPLICATION_CREDENTIALS` e se o arquivo existe no container.

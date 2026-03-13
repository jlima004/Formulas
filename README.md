# Formulas PDF Parser

Parser em Node.js + TypeScript para processar PDFs e persistir os dados estruturados no MySQL. O projeto suporta dois modos de execução:

1. Modo batch local (scanner de PDFs da raiz do projeto).
2. Modo API + Worker (webhook/sync com Google Drive e fila Redis/BullMQ).

## Requisitos

- Node.js 22+
- npm
- Docker e Docker Compose

## Arquitetura resumida

1. Parser:

- Leitura de PDF/OCR fallback.
- Normalização de texto.
- Extração de campos e itens.
- Persistência no MySQL.

2. API:

- Healthcheck.
- Webhook do Google Drive.
- Trigger de sincronização manual da pasta Drive.
- Gestão de canal Watch (start/renew/stop/status).

3. Worker:

- Consumo de jobs BullMQ.
- Sincronização da pasta Drive.
- Download temporário de PDFs.
- Processamento no parser e persistência.

## Instalação e execução

### Opção A: Docker Compose (recomendado)

1. Configure ambiente:

```bash
cp .env.example .env
```

2. Ajuste variáveis conforme necessidade.

3. Suba a stack:

```bash
docker compose up -d --build
```

4. Verifique serviços:

```bash
docker compose ps
```

5. Logs:

```bash
docker logs -f formulas-app
docker logs -f formulas-worker
```

6. Parar tudo:

```bash
docker compose down
```

### Opção B: Local (Node) + MySQL no Docker

1. Configure ambiente:

```bash
cp .env.example .env
```

2. Suba banco e Redis:

```bash
docker compose up -d mysql redis
```

3. Instale dependências:

```bash
npm install
```

4. Build:

```bash
npm run build
```

## Modos de execução

```bash
# parser batch único (modo legado)
npm start

# somente API
npm run start:api

# API + batch no mesmo processo
npm run start:both

# worker de fila (Drive events)
npm run start:worker
```

## Endpoints da API

1. Saúde:

- `GET /health`
- `GET /api/diagnostics`

2. Drive sync:

- `POST /api/drive/sync`

3. Watch lifecycle:

- `GET /api/drive/watch`
- `POST /api/drive/watch/start`
- `POST /api/drive/watch/renew`
- `POST /api/drive/watch/stop`

4. Webhook:

- `POST /webhooks/drive`

## Variáveis de ambiente

### Banco

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

### API e fila

- `API_MODE` (`batch`, `api`, `both`)
- `API_HOST`
- `API_PORT`
- `REDIS_ENABLED` (`true` ou `false`)
- `REDIS_URL`
- `REDIS_QUEUE_NAME`

### Google Drive

- `DRIVE_FOLDER_ID`
- `DRIVE_WEBHOOK_TOKEN`
- `DRIVE_WEBHOOK_ADDRESS`
- `DRIVE_TEMP_DIR`
- `DRIVE_SYNC_MAX_FILES`
- `DRIVE_WATCH_TTL_SECONDS`
- `DRIVE_WATCH_AUTO_RENEW_ENABLED`
- `DRIVE_WATCH_RENEW_BEFORE_SECONDS`
- `DRIVE_WATCH_CHECK_INTERVAL_SECONDS`
- `GOOGLE_SERVICE_ACCOUNT_KEY_JSON`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_DRIVE_SCOPES`

## Fluxo operacional do Drive

1. Configure credenciais da Service Account.
2. Compartilhe a pasta alvo do Drive com a Service Account.
3. Configure `DRIVE_FOLDER_ID` e `DRIVE_WEBHOOK_ADDRESS`.
4. Inicie API e worker.
5. Crie canal Watch:

```bash
curl -X POST http://localhost:3000/api/drive/watch/start
```

6. Quando eventos chegarem no webhook:

- Com Redis ativo: eventos entram na fila e o worker processa.
- Com Redis desativado: API faz fallback assíncrono direto.

7. Renovação automática de canal:

- Quando `DRIVE_WATCH_AUTO_RENEW_ENABLED=true`, a API monitora expiração e renova o canal antes do prazo configurado.

8. Proteção anti-replay de webhook:

- Eventos com o mesmo `X-Goog-Channel-Id` + `X-Goog-Message-Number` são ignorados para evitar reprocessamento duplicado.

## Comandos úteis

```bash
# build
npm run build

# start batch
npm start

# start api
npm run start:api

# start worker
npm run start:worker

# subir stack
docker compose up -d --build

# status
docker compose ps

# contar registros
docker exec formulas-mysql mysql -uformulas -pformulas formulas -e "SELECT COUNT(*) FROM formulas; SELECT COUNT(*) FROM formula_items;"
```

## Observações

- O parser continua compatível com o fluxo batch original.
- A deduplicação de Drive usa checkpoint persistente no MySQL (`drive_file_checkpoints`).
- Estado do canal Watch é persistido em `drive_watch_channels`.
- A execução não gera mais JSON em `Output/`; validação operacional deve ser feita por consultas SQL e logs.

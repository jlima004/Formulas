# Formulas PDF Parser

Parser em Node.js + TypeScript para processar PDFs da raiz do projeto e persistir dados diretamente no MySQL.

## Requisitos

- Node.js 22+
- npm
- Docker e Docker Compose

## Instalação e execução do zero (passo a passo)

### Opção A: com Docker (recomendado)

1. Configure variáveis de ambiente:

```bash
cp .env.example .env
```

2. Ajuste o `.env` se necessário (`MYSQL_*` e `PARSER_INTERVAL_SECONDS`).

3. Suba aplicação + banco:

```bash
docker compose up -d --build
```

4. Verifique status dos serviços:

```bash
docker compose ps
```

5. Acompanhe logs da aplicação:

```bash
docker logs -f formulas-app
```

6. Para parar tudo:

```bash
docker compose down
```

### Opção B: local (Node) + MySQL no Docker

1. Configure variáveis de ambiente:

```bash
cp .env.example .env
```

2. Suba apenas o banco:

```bash
docker compose up -d mysql
```

3. Instale dependências do projeto:

```bash
npm install
```

4. Valide compilação TypeScript:

```bash
npm run build
```

5. Execute o parser uma vez:

```bash
npm start
```

## Fluxo da aplicação

1. Lê PDFs da raiz do projeto.
2. Normaliza texto e extrai campos/itens.
3. Persiste resultado no MySQL (`formulas` e `formula_items`).

## Comandos úteis

```bash
# build local
npm run build

# execução local (job único)
npm start

# subir stack completa
docker compose up -d --build

# ver status
docker compose ps

# logs do parser contínuo
docker logs -f formulas-app

# validar contagem no banco
docker exec formulas-mysql mysql -uformulas -pformulas formulas -e "SELECT COUNT(*) FROM formulas; SELECT COUNT(*) FROM formula_items;"
```

## Notas rápidas

- No Docker, `formulas-app` roda em modo contínuo (loop), respeitando `PARSER_INTERVAL_SECONDS`.
- OCR é fallback automático quando extração por pdfjs é insuficiente.
- Tipos e contrato de saída ficam em `src/types/formula.ts`.
- A execução não gera mais arquivos JSON em `Output/`; a validação operacional deve ser feita via consultas SQL no banco.

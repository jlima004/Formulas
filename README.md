# Formulas PDF Parser

Projeto em Node.js + TypeScript para ler os PDFs da pasta raiz, extrair os dados estruturados e gerar arquivos JSON em `Output/`.

## O que está pronto

- Leitura em lote de todos os PDFs da pasta principal.
- Extração do cabeçalho da fórmula.
- Extração da tabela de itens com `codigo`, `detall`, `partes` e `costo`.
- Geração de um JSON por PDF.
- Geração de um JSON consolidado em `Output/formulas.json`.
- Normalização numérica para valores prontos para banco.

## Estrutura principal

- `src/index.ts`: ponto de entrada.
- `src/batch/processAllPdfs.ts`: processamento em lote.
- `src/parser/parseFormulaPdf.ts`: orquestra o parse de cada PDF.
- `src/parser/extractFields.ts`: extrai cabeçalho e itens.
- `src/io/readPdf.ts`: leitura do PDF.
- `src/types/formula.ts`: tipos do resultado final.

## Como executar

Instalar dependências:

```bash
npm install
```

Executar a extração:

```bash
npm start
```

Validar a build TypeScript:

```bash
npm run build
```

## MySQL com Docker

Para subir um banco MySQL local com Docker Compose:

```bash
cp .env.example .env
docker compose up -d
```

O arquivo de configuração está em `compose.yaml` e cria um container `formulas-mysql` com volume persistente.

As variáveis de ambiente esperadas estão em `.env.example`. Crie um `.env` a partir desse arquivo e ajuste os valores antes de subir o banco.

O `compose.yaml` não usa fallback. Se alguma variável não estiver definida, o `docker compose` falha na validação.

Valores padrão:

- Host: `127.0.0.1`
- Porta: `3306`
- Banco: `formulas`
- Usuário: `formulas`
- Senha: `formulas`
- Root password: `root`

Exemplo de `.env`:

```bash
MYSQL_PORT=3307
MYSQL_DATABASE=formulas_dev
MYSQL_USER=formulas_app
MYSQL_PASSWORD=senha_segura
MYSQL_ROOT_PASSWORD=outra_senha_segura
```

Para parar o banco:

```bash
docker compose down
```

## Persistencia no MySQL

O parser continua gerando JSON em `Output/` e agora tambem persiste os dados no MySQL (tabelas `formulas` e `formula_items`) durante o processamento em lote.

Fluxo de execucao:

1. Parse do PDF
2. Escrita do JSON em `Output/`
3. Persistencia no MySQL (transacional por arquivo)

Antes de rodar `npm start`, garanta que o MySQL esta ativo:

```bash
docker compose up -d
```

As tabelas sao criadas automaticamente na primeira execucao do parser (`CREATE TABLE IF NOT EXISTS`).

## Saída gerada

Os arquivos são gravados em `Output/`:

- Um JSON por PDF, por exemplo `Output/AF0028 CONI BRISAS.json`.
- Um consolidado com todos os documentos em `Output/formulas.json`.

## Normalização numérica

Os valores originais do PDF continuam preservados como texto, e agora também saem em formato numérico para uso em banco.

Exemplos:

- `1.000,00` vira `1000`.
- `25,99` vira `25.99`.
- `295,00` vira `295`.

Campos adicionados:

- No nível da fórmula:
  - `partesValue`
  - `totalItemsValue`
- Em cada item:
  - `partesValue`
  - `costoValue`

Exemplo de item no JSON:

```json
{
  "itemNumber": 1,
  "codigo": "MP00042",
  "detall": "HELIOTROPINA 20% DPG",
  "partes": "2,00",
  "partesValue": 2,
  "costo": "25,99",
  "costoValue": 25.99
}
```

## Observações

- Esta versão considera PDFs com texto selecionável.
- OCR foi incluído como fallback automático quando a extração textual via pdfjs retorna conteúdo insuficiente.
- A gravação no MySQL já está implementada para os próximos processamentos em lote.
- O parser foi calibrado para os PDFs atuais desta pasta.

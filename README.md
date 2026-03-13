# Formulas PDF Parser

Projeto em Node.js + TypeScript para ler os PDFs da pasta raiz, extrair os dados estruturados e gerar arquivos JSON em `Output/`.

## O que está pronto

- Leitura em lote de todos os PDFs da pasta principal.
- Extração do cabeçalho da fórmula.
- Extração da tabela de itens com `itemNumber`, `codigo`, `nome`, `partes` e `costo`.
- Geração de um JSON por PDF.
- Geração de um JSON consolidado em `Output/formulas.json`.
- Normalização numérica para valores prontos para JSON e banco.

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

## Persistência no MySQL

O parser continua gerando JSON em `Output/` e agora também persiste os dados no MySQL (tabelas `formulas` e `formula_items`) durante o processamento em lote.

Diagrama curto do fluxo:

```text
PDF na raiz do projeto
  -> leitura do PDF (pdfjs, com OCR fallback quando necessário)
  -> normalização do texto
  -> extração dos campos e itens
  -> escrita do JSON em Output/
  -> persistência no MySQL
     -> tabela formulas
     -> tabela formula_items
```

Fluxo de execução:

1. Parse do PDF
2. Escrita do JSON em `Output/`
3. Persistência no MySQL (transacional por arquivo)

Antes de rodar `npm start`, garanta que o MySQL esta ativo:

```bash
docker compose up -d
```

As tabelas sao criadas automaticamente na primeira execução do parser (`CREATE TABLE IF NOT EXISTS`).

Últimos passos implementados:

1. Criação de pool de conexão MySQL com variáveis vindas do `.env`.
2. Bootstrap automático do schema (`formulas` e `formula_items`).
3. Persistência transacional por arquivo processado.
4. Manutenção da escrita de JSON em `Output/` em paralelo à persistência no banco.
5. Exclusão explícita do arquivo `pdf-escaneado.pdf` do processamento em lote para evitar persistência acidental de testes.

Fluxo operacional atual:

```bash
cp .env.example .env
docker compose up -d
npm install
npm start
```

Validação útil após rodar o parser:

```bash
docker exec formulas-mysql mysql -uformulas -pformulas formulas -e "SHOW TABLES; SELECT COUNT(*) FROM formulas; SELECT COUNT(*) FROM formula_items;"
```

## Schema do banco

### Tabela `formulas`

Armazena um registro por PDF processado.

- `id` — chave primária UUID (`CHAR(36)`).
- `formula` — nome/código principal da fórmula.
- `partes` — valor numérico de partes (DECIMAL).
- `hoja` — valor da folha/página informado no PDF.
- `total_items` — total de itens numérico (INT).
- `warnings_json` — warnings do parser em JSON.
- `diagnostics_json` — diagnósticos do parser em JSON.
- `created_at` — timestamp de criação do registro.
- `updated_at` — timestamp de atualização do registro.

Índices e constraints:

- `UNIQUE KEY uq_formulas_formula_hoja (formula, hoja)`
- `INDEX idx_formulas_formula (formula)`
- `INDEX idx_formulas_hoja (hoja)`

### Tabela `formula_items`

Armazena os itens de cada fórmula processada.

- `id` — chave primária UUID (`CHAR(36)`).
- `nome` — descrição do item.
- `formula_id` — chave estrangeira UUID para `formulas.id`.
- `item_number` — número sequencial do item no PDF.
- `codigo` — código do item.
- `partes` — quantidade numérica em gramas (INT).
- `costo` — custo numérico do item (DECIMAL).
- `created_at` — timestamp de criação do registro.

Índices e constraints:

- `FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE`
- `INDEX idx_formula_items_formula_id (formula_id)`
- `INDEX idx_formula_items_codigo (codigo)`

Comportamento de persistência:

- O registro em `formulas` é feito com `upsert` por `(formula, hoja)`.
- Antes de reinserir os itens de um PDF já existente, os itens antigos em `formula_items` são removidos.
- A persistência é transacional por arquivo para evitar gravação parcial.
- O schema é criado no formato atual com UUID e sem colunas legadas de metadata.

## Saída gerada

Os arquivos são gravados em `Output/`:

- Um JSON por PDF, por exemplo `Output/AF0028 CONI BRISAS.json`.
- Um consolidado com todos os documentos em `Output/formulas.json`.

## Normalização numérica

Os campos principais da saída final agora são numéricos e já ficam alinhados com o schema do banco.

Exemplos:

- `1.000,00` vira `1000`.
- `25,99` vira `25.99`.
- `2,00` (partes do item) vira `2000` gramas.
- `295,00` vira `295`.

Contrato atual do JSON:

- No nível da fórmula:
  - `formula`
  - `partes` (número)
  - `totalItems` (número)
  - `hoja`
- Em cada item:
  - `itemNumber`
  - `codigo`
  - `nome`
  - `partes` (inteiro em gramas)
  - `costo` (número)

Exemplo de item no JSON:

```json
{
  "itemNumber": 1,
  "codigo": "MP00042",
  "nome": "HELIOTROPINA 20% DPG",
  "partes": 2000,
  "costo": 25.99
}
```

## Observações

- Esta versão considera PDFs com texto selecionável.
- OCR foi incluído como fallback automático quando a extração textual via pdfjs retorna conteúdo insuficiente.
- A gravação no MySQL já está implementada para os próximos processamentos em lote.
- O parser foi calibrado para os PDFs atuais desta pasta.

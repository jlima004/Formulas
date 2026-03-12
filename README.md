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

## Persistência no MySQL

O parser continua gerando JSON em `Output/` e agora também persiste os dados no MySQL (tabelas `formulas` e `formula_items`) durante o processamento em lote.

Diagrama curto do fluxo:

```text
PDF na raiz do projeto
  -> leitura do PDF (pdfjs, com OCR fallback quando necessario)
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

- `id` — chave primária auto incremento.
- `file_name` — nome do PDF. Possui restrição `UNIQUE`.
- `file_path` — caminho absoluto do arquivo processado.
- `processed_at` — data/hora do processamento.
- `page_count` — quantidade de páginas do PDF.
- `formula` — nome/código principal da fórmula.
- `partes` — valor textual original de partes.
- `partes_value` — valor numérico normalizado de partes.
- `total_items` — total de itens como texto.
- `total_items_value` — total de itens como inteiro.
- `codigo` — cabeçalho textual da coluna código.
- `detall` — cabeçalho textual da coluna detalhe.
- `costo` — cabeçalho textual da coluna custo.
- `hoja_n` — valor da folha/página informado no PDF.
- `observacion` — observação extraída do documento.
- `warnings_json` — warnings do parser em JSON.
- `diagnostics_json` — diagnósticos do parser em JSON.
- `extraction_json` — diagnósticos de extração (`pdfjs` ou `ocr`) em JSON.
- `raw_text` — texto bruto normalizado do documento.
- `created_at` — timestamp de criação do registro.
- `updated_at` — timestamp de atualização do registro.

Índices e constraints:

- `UNIQUE KEY uq_formulas_file_name (file_name)`
- `INDEX idx_formulas_formula (formula)`
- `INDEX idx_formulas_processed_at (processed_at)`

### Tabela `formula_items`

Armazena os itens de cada fórmula processada.

- `id` — chave primária auto incremento.
- `formula_id` — chave estrangeira para `formulas.id`.
- `item_number` — número sequencial do item no PDF.
- `codigo` — código do item.
- `detall` — descrição do item.
- `partes` — valor textual original de partes.
- `partes_value` — valor numérico normalizado de partes.
- `costo` — valor textual original de custo.
- `costo_value` — valor numérico normalizado de custo.
- `created_at` — timestamp de criação do registro.

Índices e constraints:

- `FOREIGN KEY (formula_id) REFERENCES formulas(id) ON DELETE CASCADE`
- `INDEX idx_formula_items_formula_id (formula_id)`
- `INDEX idx_formula_items_codigo (codigo)`

Comportamento de persistência:

- O registro em `formulas` é feito com `upsert` por `file_name`.
- Antes de reinserir os itens de um PDF já existente, os itens antigos em `formula_items` são removidos.
- A persistência é transacional por arquivo para evitar gravação parcial.

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

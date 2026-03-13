# Workspace Instructions

## Project Overview

This repository parses formula PDFs from the workspace root and persists structured data directly to MySQL.

- Runtime: Node.js with TypeScript in ESM mode.
- Entry point: `src/index.ts`.
- Main batch flow: `src/batch/processAllPdfs.ts`.
- Parsing pipeline: PDF read -> text normalization -> field extraction -> MySQL persistence.

For a fuller project overview and sample output, see `README.md`.

## Commands

- Install dependencies: `npm install`
- Run the parser over all root-level PDFs: `npm start`
- Validate TypeScript compilation: `npm run build`

Run `npm run build` after code changes. If parsing logic changes, also run `npm start` to verify database persistence behavior.

## Architecture

- `src/index.ts`: CLI entry point that reports batch success and failures.
- `src/batch/processAllPdfs.ts`: finds all `*.pdf` files in the workspace root, processes them sequentially, and persists each result to MySQL.
- `src/io/dbConnection.ts`: initializes a MySQL connection pool using environment variables.
- `src/io/ensureDatabaseSchema.ts`: bootstraps database tables with idempotent `CREATE TABLE IF NOT EXISTS`.
- `src/io/persistFormula.ts`: persists each parsed formula and its items in a transaction.
- `src/io/readPdf.ts`: reads text-selectable PDFs and reconstructs ordered text lines from positioned PDF text items.
- `src/parser/normalizeText.ts`: normalizes extracted text before parsing.
- `src/parser/extractFields.ts`: extracts header fields and line items using regex-driven parsing.
- `src/parser/parseFormulaPdf.ts`: orchestrates read, normalize, extract, and diagnostics for a single PDF.
- `src/types/formula.ts`: authoritative output schema and diagnostics types.

## Repository Conventions

- Keep TypeScript in ESM style. In local imports, preserve the existing `.js` extension pattern in import specifiers.
- Preserve the current output contract in `src/types/formula.ts` unless the task explicitly requires a schema change.
- Keep both the original string values from the PDF and the normalized numeric values used for database-ready fields.
- Keep parser extraction and database persistence in sync; changes to parsed shape must be reflected in DB mapping when applicable.
- Warning messages and parsing diagnostics are currently written in Portuguese; keep that style consistent unless the task requires a language change.
- Prefer focused fixes in the parsing pipeline instead of adding one-off exceptions in the batch layer.

## Parsing Constraints

- The parser is calibrated for the current PDF layout and label patterns. Changes in wording or table layout can break extraction.
- Text-selectable PDFs are still the primary path. OCR fallback is available when pdfjs extraction is insufficient.
- Numeric parsing expects values like `1.000,00` and `25,99`; malformed or unexpected formats may normalize to `null`.
- The batch processor scans only root-level PDFs, not nested directories.

When updating parsing logic, inspect `src/parser/extractFields.ts` and verify behavior against the sample PDFs in the workspace root.

## Generated Artifacts

Do not manually edit generated content:

- `dist/`
- `node_modules/`

`npm run build` regenerates `dist/`.

## Change Guidance

- For extraction bugs or new PDF variants: start in `src/parser/extractFields.ts` and `src/io/readPdf.ts`.
- For DB connection or persistence behavior: update `src/io/dbConnection.ts`, `src/io/ensureDatabaseSchema.ts`, and `src/io/persistFormula.ts`.
- For path or file-discovery behavior: update `src/config/paths.ts` or `src/batch/processAllPdfs.ts`.
- For output shape changes: update `src/types/formula.ts`, then adjust parser and DB persistence logic together.
- Keep changes minimal and avoid reformatting unrelated files.

## References

- `README.md`: project usage, limitations, and output examples.
- `package.json`: authoritative scripts.
- `src/types/formula.ts`: authoritative JSON/result types.

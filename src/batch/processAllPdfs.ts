import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "../config/paths.js";
import { parseFormulaPdf } from "../parser/parseFormulaPdf.js";
import {
  ensureDirectory,
  writeConsolidatedJson,
  writeIndividualJson,
} from "../io/writeJson.js";
import { closeDbPool, getDbPool } from "../io/dbConnection.js";
import { ensureDatabaseSchema } from "../io/ensureDatabaseSchema.js";
import { persistFormula } from "../io/persistFormula.js";
import type { FormulaParseResult } from "../types/formula.js";

const EXCLUDED_PDF_FILE_NAMES = new Set(["pdf-escaneado.pdf"]);

export interface BatchSummary {
  results: FormulaParseResult[];
  succeeded: string[];
  failed: Array<{ fileName: string; error: string }>;
}

export async function processAllPdfs(): Promise<BatchSummary> {
  await ensureDirectory(paths.outputDir);
  const dbPool = getDbPool();
  await ensureDatabaseSchema(dbPool);

  const entries = await fs.readdir(paths.workspaceRoot, {
    withFileTypes: true,
  });
  const pdfFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".pdf") &&
        !EXCLUDED_PDF_FILE_NAMES.has(entry.name.toLowerCase()),
    )
    .map((entry) => path.join(paths.workspaceRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));

  const results: FormulaParseResult[] = [];
  const succeeded: string[] = [];
  const failed: Array<{ fileName: string; error: string }> = [];

  try {
    for (const filePath of pdfFiles) {
      try {
        const result = await parseFormulaPdf(filePath);
        await writeIndividualJson(paths.outputDir, result);
        await persistFormula(dbPool, result);
        results.push(result);
        succeeded.push(path.basename(filePath));
      } catch (error) {
        failed.push({
          fileName: path.basename(filePath),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await closeDbPool();
  }

  await writeConsolidatedJson(paths.outputDir, results);

  return { results, succeeded, failed };
}

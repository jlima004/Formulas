import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "../config/paths.js";
import { closeDbPool, getDbPool } from "../io/dbConnection.js";
import { ensureDatabaseSchema } from "../io/ensureDatabaseSchema.js";
import { FormulaProcessingService } from "../services/parsing/formulaProcessing.service.js";

const EXCLUDED_PDF_FILE_NAMES = new Set(["pdf-escaneado.pdf"]);

export interface BatchSummary {
  succeeded: string[];
  failed: Array<{ fileName: string; error: string }>;
}

export async function processAllPdfs(): Promise<BatchSummary> {
  const dbPool = getDbPool();
  const formulaProcessingService = new FormulaProcessingService();
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

  const succeeded: string[] = [];
  const failed: Array<{ fileName: string; error: string }> = [];

  try {
    for (const filePath of pdfFiles) {
      try {
        await formulaProcessingService.processFile(filePath, dbPool);
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

  return { succeeded, failed };
}

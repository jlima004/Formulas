import fs from "node:fs/promises";
import path from "node:path";
import type { FormulaParseResult } from "../types/formula.js";

function sanitizeBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*]+/g, "_");
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeIndividualJson(
  outputDir: string,
  result: FormulaParseResult,
): Promise<string> {
  const baseName = sanitizeBaseName(result.metadata.fileName);
  const outputPath = path.join(outputDir, `${baseName}.json`);
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
  return outputPath;
}

export async function writeConsolidatedJson(
  outputDir: string,
  results: FormulaParseResult[],
): Promise<string> {
  const outputPath = path.join(outputDir, "formulas.json");
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");
  return outputPath;
}

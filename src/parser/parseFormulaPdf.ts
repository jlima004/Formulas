import path from "node:path";
import { readPdf } from "../io/readPdf.js";
import { extractFields } from "./extractFields.js";
import { normalizeLines, normalizeText } from "./normalizeText.js";
import type { FormulaParseResult } from "../types/formula.js";

export async function parseFormulaPdf(
  filePath: string,
): Promise<FormulaParseResult> {
  const extraction = await readPdf(filePath);
  const normalizedLines = normalizeLines(extraction.lines);
  const { data, diagnostics, warnings } = extractFields(normalizedLines, {
    extractionMethod: extraction.diagnostics?.method,
  });

  return {
    metadata: {
      fileName: path.basename(filePath),
      filePath,
      processedAt: new Date().toISOString(),
      pageCount: extraction.pageCount,
    },
    data,
    warnings,
    diagnostics,
    extraction: extraction.diagnostics,
    rawText: normalizeText(extraction.text),
  };
}

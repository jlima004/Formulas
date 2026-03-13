export type FormulaFieldKey = "formula" | "partes" | "totalItems" | "hoja";

export interface FormulaData {
  formula: string | null;
  partes: number | null;
  totalItems: number | null;
  hoja: string | null;
  items: FormulaItem[];
}

export interface FormulaItem {
  itemNumber: number;
  codigo: string;
  nome: string;
  partes: number | null;
  costo: number | null;
}

export interface ParseWarning {
  code: string;
  message: string;
  details?: string;
}

export interface DocumentMetadata {
  fileName: string;
  filePath: string;
  processedAt: string;
  pageCount: number;
}

export interface ParseDiagnostics {
  matchedLabels: Partial<Record<FormulaFieldKey, string>>;
  candidateLines: string[];
  extractedLineCount: number;
  parsedItems: number;
}

export interface FormulaParseResult {
  metadata: DocumentMetadata;
  data: FormulaData;
  warnings: ParseWarning[];
  diagnostics: ParseDiagnostics;
  extraction?: PdfExtractionDiagnostics;
  rawText: string;
}

export type ExtractionMethod = "pdfjs" | "ocr";

export interface PdfExtractionDiagnostics {
  method: ExtractionMethod;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  textLength: number;
  lineCount: number;
}

export interface PdfLine {
  pageNumber: number;
  y: number;
  text: string;
}

export interface PdfExtractionResult {
  pageCount: number;
  text: string;
  lines: PdfLine[];
  diagnostics?: PdfExtractionDiagnostics;
}

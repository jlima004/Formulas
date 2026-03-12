import type {
  FormulaData,
  FormulaFieldKey,
  FormulaItem,
  ParseDiagnostics,
  ParseWarning,
} from "../types/formula.js";

interface FieldPattern {
  key: FormulaFieldKey;
  labels: string[];
}

const FIELD_PATTERNS: FieldPattern[] = [
  { key: "formula", labels: ["formula"] },
  { key: "partes", labels: ["partes", "parte"] },
  {
    key: "totalItems",
    labels: ["total items", "total item", "items totales", "total de items"],
  },
  { key: "codigo", labels: ["codigo", "código", "code"] },
  { key: "detall", labels: ["detall", "detalle", "detail"] },
  { key: "costo", labels: ["costo", "coste", "cost"] },
  {
    key: "hojaN",
    labels: ["hoja n", "hoja no", "hoja nº", "hoja n°", "sheet"],
  },
  { key: "observacion", labels: ["observacion", "observación", "observation"] },
];

function createEmptyData(): FormulaData {
  return {
    formula: null,
    partes: null,
    partesValue: null,
    totalItems: null,
    totalItemsValue: null,
    codigo: null,
    detall: null,
    costo: null,
    hojaN: null,
    observacion: null,
    items: [],
  };
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractInlineValue(line: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\b${escapedLabel}\\b\\s*[:\-]\s*(.+)$`, "i"),
    new RegExp(`\\b${escapedLabel}\\b\\s+(.+)$`, "i"),
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function looksLikeSameLineOnlyLabel(line: string, label: string): boolean {
  return normalizeForMatch(line) === normalizeForMatch(label);
}

function isLikelyNoise(line: string): boolean {
  const normalized = normalizeForMatch(line);
  return (
    normalized.length === 0 || normalized === "page" || normalized === "pagina"
  );
}

function extractFromRegex(lines: string[], pattern: RegExp): string | null {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractFormulaAndTotalItems(
  lines: string[],
  diagnostics: ParseDiagnostics,
): Pick<FormulaData, "formula" | "totalItems"> {
  for (const line of lines) {
    const match = line.match(/^Formula:\s*(.+?)(?:\s+Total Items:\s*(\d+))?$/i);
    if (match) {
      diagnostics.matchedLabels.formula = line;
      if (match[2]) {
        diagnostics.matchedLabels.totalItems = line;
      }

      return {
        formula: match[1].trim(),
        totalItems: match[2]?.trim() ?? null,
      };
    }
  }

  return {
    formula: null,
    totalItems: null,
  };
}

function extractObservation(
  lines: string[],
  diagnostics: ParseDiagnostics,
): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^Observacion:\s*(.*)$/i);
    if (!match) {
      continue;
    }

    diagnostics.matchedLabels.observacion = line;

    if (match[1]?.trim()) {
      return match[1].trim();
    }

    const collected: string[] = [];
    for (const nextLine of lines.slice(index + 1)) {
      if (/^[-_]+$/.test(nextLine)) {
        continue;
      }

      if (/^(Fecha|Hoja|Formula|Partes):/i.test(nextLine)) {
        break;
      }

      collected.push(nextLine);
    }

    return collected.length > 0 ? collected.join(" ").trim() : null;
  }

  return null;
}

function extractColumnHeaders(
  lines: string[],
  data: FormulaData,
  diagnostics: ParseDiagnostics,
): void {
  const headerLine = lines.find((line) =>
    /^Codigo\s+Detalle\s+Partes\s+Costo$/i.test(line),
  );

  if (!headerLine) {
    return;
  }

  diagnostics.matchedLabels.codigo = headerLine;
  diagnostics.matchedLabels.detall = headerLine;
  diagnostics.matchedLabels.costo = headerLine;

  data.codigo = "Codigo";
  data.detall = "Detalle";
  data.costo = "Costo";
}

function extractItems(lines: string[]): FormulaItem[] {
  const itemPattern =
    /^(\d+)\s+([A-Z]{2}\d+)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/;
  const items: FormulaItem[] = [];

  for (const line of lines) {
    const match = line.match(itemPattern);
    if (!match) {
      continue;
    }

    items.push({
      itemNumber: Number(match[1]),
      codigo: match[2],
      detall: match[3].trim(),
      partes: match[4],
      partesValue: normalizeDatabaseNumber(match[4]),
      costo: match[5],
      costoValue: normalizeDatabaseNumber(match[5]),
    });
  }

  return items;
}

function normalizeDatabaseNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^-?\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const sanitized = normalized.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(sanitized)) {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

interface ExtractFieldOptions {
  extractionMethod?: "pdfjs" | "ocr";
}

export function extractFields(
  lines: string[],
  options: ExtractFieldOptions = {},
): {
  data: FormulaData;
  diagnostics: ParseDiagnostics;
  warnings: ParseWarning[];
} {
  const data = createEmptyData();
  const diagnostics: ParseDiagnostics = {
    matchedLabels: {},
    candidateLines: lines.slice(0, 50),
    extractedLineCount: lines.length,
    parsedItems: 0,
  };
  const warnings: ParseWarning[] = [];

  const formulaHeader = extractFormulaAndTotalItems(lines, diagnostics);
  data.formula = formulaHeader.formula;
  data.totalItems = formulaHeader.totalItems;
  data.totalItemsValue = normalizeDatabaseNumber(formulaHeader.totalItems);

  data.partes = extractFromRegex(lines, /^Partes:\s*(.+)$/i);
  data.partesValue = normalizeDatabaseNumber(data.partes);
  if (data.partes) {
    const sourceLine = lines.find((line) => /^Partes:\s*(.+)$/i.test(line));
    if (sourceLine) {
      diagnostics.matchedLabels.partes = sourceLine;
    }
  }

  data.hojaN = extractFromRegex(lines, /^Hoja\s+N[º°]?:\s*(.+)$/i);
  if (data.hojaN) {
    const sourceLine = lines.find((line) =>
      /^Hoja\s+N[º°]?:\s*(.+)$/i.test(line),
    );
    if (sourceLine) {
      diagnostics.matchedLabels.hojaN = sourceLine;
    }
  }

  data.observacion = extractObservation(lines, diagnostics);
  extractColumnHeaders(lines, data, diagnostics);
  data.items = extractItems(lines);
  diagnostics.parsedItems = data.items.length;

  if (!data.formula) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo formula não localizado com as regras atuais.",
    });
  }

  if (!data.partes) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo partes não localizado com as regras atuais.",
    });
  }

  if (!data.totalItems) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo totalItems não localizado com as regras atuais.",
    });
  }

  if (!data.hojaN) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo hojaN não localizado com as regras atuais.",
    });
  }

  if (!data.codigo || !data.detall || !data.costo) {
    warnings.push({
      code: "TABLE_HEADER_NOT_FOUND",
      message: "Cabeçalho da tabela não localizado exatamente como esperado.",
    });
  }

  if (data.items.length === 0) {
    warnings.push({
      code: "ITEMS_NOT_FOUND",
      message: "Nenhuma linha de item foi extraída da tabela.",
    });
  }

  const isOcrExtraction = options.extractionMethod === "ocr";
  const countDiff =
    data.totalItemsValue !== null
      ? Math.abs(data.totalItemsValue - data.items.length)
      : 0;
  const shouldIgnoreOcrSmallMismatch = isOcrExtraction && countDiff <= 2;

  if (
    data.totalItems &&
    data.items.length > 0 &&
    data.totalItemsValue !== null &&
    data.totalItemsValue !== data.items.length &&
    !shouldIgnoreOcrSmallMismatch
  ) {
    warnings.push({
      code: "ITEM_COUNT_MISMATCH",
      message:
        "A quantidade de itens extraídos difere do Total Items informado no PDF.",
      details: `Total Items: ${data.totalItems}; extraídos: ${data.items.length}`,
    });
  }

  return { data, diagnostics, warnings };
}

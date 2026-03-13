import type {
  FormulaData,
  FormulaItem,
  ParseDiagnostics,
  ParseWarning,
} from "../types/formula.js";

function createEmptyData(): FormulaData {
  return {
    formula: null,
    partes: null,
    totalItems: null,
    hoja: null,
    items: [],
  };
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

function parseLocalizedNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (/^-?\d+$/.test(normalized)) {
    const parsedInt = Number(normalized);
    return Number.isFinite(parsedInt) ? parsedInt : null;
  }

  const sanitized = normalized.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(sanitized)) {
    return null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePartesToGrams(value: string): number | null {
  const parsed = parseLocalizedNumber(value);
  if (parsed === null) {
    return null;
  }

  // O usuário definiu que partes em itens deve sair em gramas.
  return Math.round(parsed * 1000);
}

function extractFormulaAndTotalItems(
  lines: string[],
  diagnostics: ParseDiagnostics,
): Pick<FormulaData, "formula" | "totalItems"> {
  for (const line of lines) {
    const match = line.match(
      /^Formula:\s*(.+?)(?:\s+Total Items:\s*([\d.,]+))?$/i,
    );
    if (!match) {
      continue;
    }

    diagnostics.matchedLabels.formula = line;
    if (match[2]) {
      diagnostics.matchedLabels.totalItems = line;
    }

    const totalItemsValue = parseLocalizedNumber(match[2] ?? null);
    return {
      formula: match[1].trim(),
      totalItems: totalItemsValue !== null ? Math.round(totalItemsValue) : null,
    };
  }

  return {
    formula: null,
    totalItems: null,
  };
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
      nome: match[3].trim(),
      partes: parsePartesToGrams(match[4]),
      costo: parseLocalizedNumber(match[5]),
    });
  }

  return items;
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

  const partesText = extractFromRegex(lines, /^Partes:\s*(.+)$/i);
  data.partes = parseLocalizedNumber(partesText);
  if (partesText) {
    const sourceLine = lines.find((line) => /^Partes:\s*(.+)$/i.test(line));
    if (sourceLine) {
      diagnostics.matchedLabels.partes = sourceLine;
    }
  }

  data.hoja = extractFromRegex(lines, /^Hoja\s+N[º°]?:\s*(.+)$/i);
  if (data.hoja) {
    const sourceLine = lines.find((line) =>
      /^Hoja\s+N[º°]?:\s*(.+)$/i.test(line),
    );
    if (sourceLine) {
      diagnostics.matchedLabels.hoja = sourceLine;
    }
  }

  data.items = extractItems(lines);
  diagnostics.parsedItems = data.items.length;

  if (!data.formula) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo formula não localizado com as regras atuais.",
    });
  }

  if (data.partes === null) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo partes não localizado com as regras atuais.",
    });
  }

  if (data.totalItems === null) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo totalItems não localizado com as regras atuais.",
    });
  }

  if (!data.hoja) {
    warnings.push({
      code: "FIELD_NOT_FOUND",
      message: "Campo hoja não localizado com as regras atuais.",
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
    data.totalItems !== null
      ? Math.abs(data.totalItems - data.items.length)
      : 0;
  const shouldIgnoreOcrSmallMismatch = isOcrExtraction && countDiff <= 2;

  if (
    data.totalItems !== null &&
    data.items.length > 0 &&
    data.totalItems !== data.items.length &&
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

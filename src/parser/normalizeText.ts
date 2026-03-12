import type { PdfLine } from "../types/formula.js";

export function normalizeLine(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLines(lines: PdfLine[]): string[] {
  return lines
    .map((line) => normalizeLine(line.text))
    .filter((line) => line.length > 0);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0)
    .join("\n");
}

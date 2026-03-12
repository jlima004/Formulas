import fs from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";
import type { PdfExtractionResult, PdfLine } from "../types/formula.js";

function normalizeOcrLine(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textToLines(pageNumber: number, text: string): PdfLine[] {
  const cleanLines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeOcrLine(line))
    .filter((line) => line.length > 0);

  return cleanLines.map((line, index) => ({
    pageNumber,
    y: cleanLines.length - index,
    text: line,
  }));
}

export async function readPdfWithOcr(
  filePath: string,
): Promise<PdfExtractionResult> {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({ data });
  const document = await loadingTask.promise;

  const worker = await createWorker("por+spa+eng");
  const lines: PdfLine[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");

      await page.render({
        canvasContext: context as any,
        viewport,
      }).promise;

      const image = canvas.toBuffer("image/png");
      const result = await worker.recognize(image);
      lines.push(...textToLines(pageNumber, result.data.text));
    }
  } finally {
    await worker.terminate();
  }

  const text = lines.map((line) => line.text).join("\n");

  return {
    pageCount: document.numPages,
    text,
    lines,
    diagnostics: {
      method: "ocr",
      fallbackTriggered: true,
      textLength: text.length,
      lineCount: lines.length,
    },
  };
}

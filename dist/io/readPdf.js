import fs from "node:fs/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readPdfWithOcr } from "./ocrPdf.js";
const MIN_TEXT_LENGTH_FOR_PDFJS = 80;
const MIN_LINE_COUNT_FOR_PDFJS = 5;
function groupItemsIntoLines(items, pageNumber) {
    const sortedItems = items
        .filter((item) => typeof item.str === "string" && item.str.trim())
        .map((item) => ({
        text: item.str.trim(),
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
    }))
        .sort((left, right) => {
        const yDiff = right.y - left.y;
        if (Math.abs(yDiff) > 1.5) {
            return yDiff;
        }
        return left.x - right.x;
    });
    const lines = [];
    for (const item of sortedItems) {
        const existingLine = lines.find((line) => Math.abs(line.y - item.y) <= 1.5);
        if (!existingLine) {
            lines.push({ y: item.y, segments: [{ x: item.x, text: item.text }] });
            continue;
        }
        existingLine.segments.push({ x: item.x, text: item.text });
    }
    return lines
        .map((line) => ({
        pageNumber,
        y: line.y,
        text: line.segments
            .sort((left, right) => left.x - right.x)
            .map((segment) => segment.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
    }))
        .filter((line) => line.text.length > 0)
        .sort((left, right) => right.y - left.y);
}
export async function readPdf(filePath) {
    const buffer = await fs.readFile(filePath);
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data });
    const document = await loadingTask.promise;
    const lines = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        lines.push(...groupItemsIntoLines(textContent.items, pageNumber));
    }
    const text = lines.map((line) => line.text).join("\n");
    const normalizedTextLength = text.replace(/\s+/g, " ").trim().length;
    const isTextInsufficient = normalizedTextLength < MIN_TEXT_LENGTH_FOR_PDFJS ||
        lines.length < MIN_LINE_COUNT_FOR_PDFJS;
    if (isTextInsufficient) {
        try {
            const ocrResult = await readPdfWithOcr(filePath);
            return {
                ...ocrResult,
                diagnostics: {
                    method: ocrResult.diagnostics?.method ?? "ocr",
                    fallbackTriggered: true,
                    fallbackReason: `Texto insuficiente via pdfjs (chars=${normalizedTextLength}, lines=${lines.length}).`,
                    textLength: ocrResult.diagnostics?.textLength ?? ocrResult.text.length,
                    lineCount: ocrResult.diagnostics?.lineCount ?? ocrResult.lines.length,
                },
            };
        }
        catch {
            return {
                pageCount: document.numPages,
                text,
                lines,
                diagnostics: {
                    method: "pdfjs",
                    fallbackTriggered: false,
                    fallbackReason: `OCR falhou após texto insuficiente via pdfjs (chars=${normalizedTextLength}, lines=${lines.length}).`,
                    textLength: normalizedTextLength,
                    lineCount: lines.length,
                },
            };
        }
    }
    return {
        pageCount: document.numPages,
        text,
        lines,
        diagnostics: {
            method: "pdfjs",
            fallbackTriggered: false,
            textLength: normalizedTextLength,
            lineCount: lines.length,
        },
    };
}

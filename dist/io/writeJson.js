import fs from "node:fs/promises";
import path from "node:path";
function sanitizeBaseName(fileName) {
    return fileName.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*]+/g, "_");
}
export async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
export async function writeIndividualJson(outputDir, result) {
    const baseName = sanitizeBaseName(result.metadata.fileName);
    const outputPath = path.join(outputDir, `${baseName}.json`);
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
    return outputPath;
}
export async function writeConsolidatedJson(outputDir, results) {
    const outputPath = path.join(outputDir, "formulas.json");
    await fs.writeFile(outputPath, JSON.stringify(results, null, 2), "utf8");
    return outputPath;
}

import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "../config/paths.js";
import { parseFormulaPdf } from "../parser/parseFormulaPdf.js";
import { ensureDirectory, writeConsolidatedJson, writeIndividualJson, } from "../io/writeJson.js";
export async function processAllPdfs() {
    await ensureDirectory(paths.outputDir);
    const entries = await fs.readdir(paths.workspaceRoot, {
        withFileTypes: true,
    });
    const pdfFiles = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
        .map((entry) => path.join(paths.workspaceRoot, entry.name))
        .sort((left, right) => left.localeCompare(right));
    const results = [];
    const succeeded = [];
    const failed = [];
    for (const filePath of pdfFiles) {
        try {
            const result = await parseFormulaPdf(filePath);
            await writeIndividualJson(paths.outputDir, result);
            results.push(result);
            succeeded.push(path.basename(filePath));
        }
        catch (error) {
            failed.push({
                fileName: path.basename(filePath),
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    await writeConsolidatedJson(paths.outputDir, results);
    return { results, succeeded, failed };
}

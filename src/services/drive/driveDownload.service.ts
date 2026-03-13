import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]+/g, "_").trim() || "documento";
}

export class DriveDownloadService {
  async withStagedPdf<T>(
    fileId: string,
    originalName: string,
    content: Buffer,
    callback: (filePath: string) => Promise<T>,
  ): Promise<T> {
    await fs.mkdir(env.DRIVE_TEMP_DIR, { recursive: true });

    const safeName = sanitizeFileName(originalName);
    const stagedPath = path.join(env.DRIVE_TEMP_DIR, `${fileId}-${safeName}`);
    await fs.writeFile(stagedPath, content);

    try {
      return await callback(stagedPath);
    } finally {
      await fs.rm(stagedPath, { force: true });
    }
  }
}

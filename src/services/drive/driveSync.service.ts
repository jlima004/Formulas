import type { Pool } from "mysql2/promise";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  DriveClient,
  type DrivePdfFile,
} from "../../infra/google/driveClient.js";
import { DriveFileCheckpointRepository } from "../../repositories/driveFileCheckpoint.repository.js";
import { FormulaProcessingService } from "../parsing/formulaProcessing.service.js";
import { DriveDownloadService } from "./driveDownload.service.js";

export interface DriveSyncSummary {
  folderId: string;
  listed: number;
  processed: number;
  skipped: number;
}

function resolveVersionKey(file: DrivePdfFile): string {
  return file.modifiedTime || "no-modified-time";
}

export class DriveSyncService {
  private readonly driveClient: DriveClient;
  private readonly formulaProcessingService: FormulaProcessingService;
  private readonly driveDownloadService: DriveDownloadService;
  private readonly driveFileCheckpointRepository: DriveFileCheckpointRepository;

  constructor(
    driveClient = new DriveClient(),
    formulaProcessingService = new FormulaProcessingService(),
    driveDownloadService = new DriveDownloadService(),
    driveFileCheckpointRepository = new DriveFileCheckpointRepository(),
  ) {
    this.driveClient = driveClient;
    this.formulaProcessingService = formulaProcessingService;
    this.driveDownloadService = driveDownloadService;
    this.driveFileCheckpointRepository = driveFileCheckpointRepository;
  }

  async syncFolder(folderId: string, pool: Pool): Promise<DriveSyncSummary> {
    const files = await this.driveClient.listPdfFilesInFolder(folderId);
    const candidates = files.slice(0, env.DRIVE_SYNC_MAX_FILES);
    const checkpointVersionMap =
      await this.driveFileCheckpointRepository.getVersionMapByFileIds(
        pool,
        candidates.map((file) => file.id),
      );

    let processed = 0;
    let skipped = 0;

    for (const file of candidates) {
      const versionKey = resolveVersionKey(file);
      const previousVersion = checkpointVersionMap.get(file.id);

      if (previousVersion === versionKey) {
        skipped += 1;
        continue;
      }

      try {
        const content = await this.driveClient.downloadFile(file.id);
        await this.driveDownloadService.withStagedPdf(
          file.id,
          file.name,
          content,
          async (stagedPath) => {
            await this.formulaProcessingService.processFile(stagedPath, pool);
          },
        );

        await this.driveFileCheckpointRepository.upsert(pool, {
          fileId: file.id,
          fileName: file.name,
          lastVersionKey: versionKey,
        });
        processed += 1;
      } catch (error) {
        logger.error(
          {
            fileId: file.id,
            fileName: file.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "Falha ao processar arquivo vindo do Google Drive.",
        );
        throw error;
      }
    }

    return {
      folderId,
      listed: files.length,
      processed,
      skipped,
    };
  }
}

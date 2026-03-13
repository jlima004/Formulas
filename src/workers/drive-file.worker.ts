import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { getDbPool } from "../io/dbConnection.js";
import { ensureDatabaseSchema } from "../io/ensureDatabaseSchema.js";
import { DriveSyncService } from "../services/drive/driveSync.service.js";
import type { DriveQueueJob } from "../services/queue/queue.service.js";

export function startDriveFileWorker(): Worker<DriveQueueJob> | null {
  if (!env.REDIS_ENABLED) {
    logger.warn("Worker Drive nao iniciado: REDIS_ENABLED=false.");
    return null;
  }

  const driveSyncService = new DriveSyncService();
  const dbPool = getDbPool();

  const worker = new Worker<DriveQueueJob>(
    env.REDIS_QUEUE_NAME,
    async (job) => {
      await ensureDatabaseSchema(dbPool);

      const folderId =
        job.data.kind === "manual-sync"
          ? job.data.folderId
          : env.DRIVE_FOLDER_ID;

      if (!folderId) {
        logger.warn(
          { jobId: job.id, kind: job.data.kind },
          "Evento recebido sem DRIVE_FOLDER_ID configurado.",
        );
        return;
      }

      const summary = await driveSyncService.syncFolder(folderId, dbPool);

      logger.info(
        {
          jobId: job.id,
          kind: job.data.kind,
          summary,
        },
        "Evento do Drive processado pelo worker.",
      );
    },
    {
      connection: {
        url: env.REDIS_URL,
      },
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      "Falha ao processar job do Drive.",
    );
  });

  return worker;
}

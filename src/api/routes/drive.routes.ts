import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getDbPool } from "../../io/dbConnection.js";
import { ensureDatabaseSchema } from "../../io/ensureDatabaseSchema.js";
import { DriveSyncService } from "../../services/drive/driveSync.service.js";
import { DriveWatchService } from "../../services/drive/driveWatch.service.js";
import { QueueService } from "../../services/queue/queue.service.js";

export async function registerDriveRoutes(app: FastifyInstance): Promise<void> {
  let queueService: QueueService | null = null;
  let driveSyncService: DriveSyncService | null = null;
  let driveWatchService: DriveWatchService | null = null;

  function getQueueService(): QueueService {
    queueService ??= new QueueService();
    return queueService;
  }

  function getDriveSyncService(): DriveSyncService {
    driveSyncService ??= new DriveSyncService();
    return driveSyncService;
  }

  function getDriveWatchService(): DriveWatchService {
    driveWatchService ??= new DriveWatchService();
    return driveWatchService;
  }

  app.post("/api/drive/sync", async (_request, reply) => {
    if (!env.DRIVE_FOLDER_ID) {
      return reply.status(400).send({
        message: "DRIVE_FOLDER_ID nao configurado.",
      });
    }

    const currentQueueService = getQueueService();

    if (currentQueueService.isEnabled()) {
      const jobId = await currentQueueService.enqueueManualSync(
        env.DRIVE_FOLDER_ID,
      );
      return reply.status(202).send({
        accepted: true,
        message: "Sincronizacao enfileirada.",
        folderId: env.DRIVE_FOLDER_ID,
        jobId,
      });
    }

    const dbPool = getDbPool();
    await ensureDatabaseSchema(dbPool);
    const summary = await getDriveSyncService().syncFolder(
      env.DRIVE_FOLDER_ID,
      dbPool,
    );

    return reply.status(200).send({
      accepted: true,
      queueEnabled: false,
      summary,
    });
  });

  app.get("/api/drive/watch", async (_request, reply) => {
    const dbPool = getDbPool();
    await ensureDatabaseSchema(dbPool);
    const active = await getDriveWatchService().getActive(dbPool);

    return reply.status(200).send({
      active,
    });
  });

  app.post("/api/drive/watch/start", async (_request, reply) => {
    const dbPool = getDbPool();
    await ensureDatabaseSchema(dbPool);
    const started = await getDriveWatchService().start(dbPool);

    return reply.status(201).send({
      started,
    });
  });

  app.post("/api/drive/watch/renew", async (_request, reply) => {
    const dbPool = getDbPool();
    await ensureDatabaseSchema(dbPool);
    const renewed = await getDriveWatchService().renew(dbPool);

    return reply.status(200).send({
      renewed,
    });
  });

  app.post("/api/drive/watch/stop", async (_request, reply) => {
    const dbPool = getDbPool();
    await ensureDatabaseSchema(dbPool);
    const result = await getDriveWatchService().stop(dbPool);

    return reply.status(200).send(result);
  });
}

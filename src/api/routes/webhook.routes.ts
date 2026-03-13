import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getDbPool } from "../../io/dbConnection.js";
import { ensureDatabaseSchema } from "../../io/ensureDatabaseSchema.js";
import { DriveWebhookReceiptRepository } from "../../repositories/driveWebhookReceipt.repository.js";
import { DriveSyncService } from "../../services/drive/driveSync.service.js";
import {
  QueueService,
  type DriveWebhookJob,
} from "../../services/queue/queue.service.js";

interface DriveWebhookHeaders {
  "x-goog-channel-id"?: string;
  "x-goog-channel-token"?: string;
  "x-goog-resource-id"?: string;
  "x-goog-resource-state"?: string;
  "x-goog-message-number"?: string;
}

function buildWebhookPayload(
  request: FastifyRequest,
  headers: DriveWebhookHeaders,
): DriveWebhookJob {
  return {
    kind: "webhook",
    receivedAt: new Date().toISOString(),
    event: {
      channelId: headers["x-goog-channel-id"] ?? "",
      channelToken: headers["x-goog-channel-token"] ?? "",
      resourceId: headers["x-goog-resource-id"] ?? "",
      resourceState: headers["x-goog-resource-state"] ?? "",
      messageNumber: headers["x-goog-message-number"] ?? "",
    },
    body: request.body,
  };
}

export async function registerWebhookRoutes(
  app: FastifyInstance,
): Promise<void> {
  const driveWebhookReceiptRepository = new DriveWebhookReceiptRepository();
  let queueService: QueueService | null = null;
  let driveSyncService: DriveSyncService | null = null;

  function getQueueService(): QueueService {
    queueService ??= new QueueService();
    return queueService;
  }

  function getDriveSyncService(): DriveSyncService {
    driveSyncService ??= new DriveSyncService();
    return driveSyncService;
  }

  app.post("/webhooks/drive", async (request, reply) => {
    const headers = request.headers as DriveWebhookHeaders;
    const channelToken = headers["x-goog-channel-token"];

    if (!headers["x-goog-channel-id"] || !headers["x-goog-resource-id"]) {
      return reply
        .status(400)
        .send({ message: "Headers obrigatorios ausentes." });
    }

    const messageNumber = headers["x-goog-message-number"];

    if (env.DRIVE_WEBHOOK_TOKEN && channelToken !== env.DRIVE_WEBHOOK_TOKEN) {
      return reply.status(401).send({ message: "Token de webhook invalido." });
    }

    if (messageNumber) {
      const dbPool = getDbPool();
      await ensureDatabaseSchema(dbPool);
      const isNewMessage = await driveWebhookReceiptRepository.registerIfNew(
        dbPool,
        {
          channelId: headers["x-goog-channel-id"],
          resourceId: headers["x-goog-resource-id"],
          messageNumber,
        },
      );

      if (!isNewMessage) {
        logger.warn(
          {
            channelId: headers["x-goog-channel-id"],
            messageNumber,
          },
          "Mensagem duplicada de webhook ignorada.",
        );

        return reply.status(202).send({
          accepted: true,
          duplicated: true,
        });
      }
    }

    const payload = buildWebhookPayload(request, headers);
    const currentQueueService = getQueueService();
    const jobId = await currentQueueService.enqueueDriveNotification(payload);

    if (!currentQueueService.isEnabled() && env.DRIVE_FOLDER_ID) {
      void (async () => {
        try {
          const dbPool = getDbPool();
          await ensureDatabaseSchema(dbPool);
          await getDriveSyncService().syncFolder(env.DRIVE_FOLDER_ID, dbPool);
          logger.info(
            { channelId: payload.event.channelId },
            "Webhook processado em fallback sem fila.",
          );
        } catch (error) {
          logger.error(
            {
              error: error instanceof Error ? error.message : String(error),
              channelId: payload.event.channelId,
            },
            "Falha no processamento fallback do webhook sem fila.",
          );
        }
      })();
    }

    logger.info(
      {
        jobId,
        channelId: payload.event.channelId,
        resourceState: payload.event.resourceState,
      },
      "Notificacao do Drive recebida e enfileirada.",
    );

    return reply.status(202).send({
      accepted: true,
      jobId,
      queueEnabled: currentQueueService.isEnabled(),
    });
  });
}

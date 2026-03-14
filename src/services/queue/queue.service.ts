import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export interface DriveWebhookEvent {
  channelId: string;
  channelToken: string;
  resourceId: string;
  resourceState: string;
  messageNumber: string;
}

export interface DriveWebhookJob {
  kind: "webhook";
  receivedAt: string;
  event: DriveWebhookEvent;
  body: unknown;
}

export interface DriveManualSyncJob {
  kind: "manual-sync";
  requestedAt: string;
  folderId: string;
}

export type DriveQueueJob = DriveWebhookJob | DriveManualSyncJob;

export class QueueService {
  private readonly queue: Queue<DriveQueueJob, unknown, string> | null;

  constructor() {
    if (!env.REDIS_ENABLED) {
      this.queue = null;
      return;
    }

    if (!env.REDIS_QUEUE_NAME) {
      this.queue = null;
      logger.warn("Fila desabilitada: REDIS_QUEUE_NAME nao configurado.");
      return;
    }

    this.queue = new Queue<DriveQueueJob, unknown, string>(
      env.REDIS_QUEUE_NAME,
      {
        connection: {
          url: env.REDIS_URL,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 30_000,
          },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      },
    );
  }

  isEnabled(): boolean {
    return this.queue !== null;
  }

  async enqueueDriveNotification(payload: DriveWebhookJob): Promise<string> {
    if (!this.queue) {
      const syntheticId = `queue-disabled-${randomUUID()}`;
      logger.warn(
        { syntheticId, resourceId: payload.event.resourceId },
        "Webhook recebido com fila desabilitada.",
      );
      return syntheticId;
    }

    const jobId = `webhook-${payload.event.resourceId}-${payload.event.messageNumber || randomUUID()}`;
    await this.queue.add("drive-notification", payload, { jobId });
    return jobId;
  }

  async enqueueManualSync(folderId: string): Promise<string> {
    if (!this.queue) {
      const syntheticId = `queue-disabled-${randomUUID()}`;
      logger.warn(
        { syntheticId, folderId },
        "Sync manual solicitado com fila desabilitada.",
      );
      return syntheticId;
    }

    const jobId = `manual-sync-${folderId}-${Date.now()}`;
    const payload: DriveManualSyncJob = {
      kind: "manual-sync",
      requestedAt: new Date().toISOString(),
      folderId,
    };

    await this.queue.add("drive-manual-sync", payload, { jobId });
    return jobId;
  }
}

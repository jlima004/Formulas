import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { getDbPool } from "../../io/dbConnection.js";
import { ensureDatabaseSchema } from "../../io/ensureDatabaseSchema.js";
import { DriveWatchService } from "./driveWatch.service.js";

export interface DriveWatchSchedulerHandle {
  stop: () => void;
}

export function shouldRenewWatch(
  expiresAt: Date,
  nowMs: number,
  renewBeforeSeconds: number,
): boolean {
  const remainingMs = expiresAt.getTime() - nowMs;
  return remainingMs <= renewBeforeSeconds * 1000;
}

export function startDriveWatchScheduler(): DriveWatchSchedulerHandle {
  if (!env.DRIVE_WATCH_AUTO_RENEW_ENABLED) {
    logger.info(
      "Scheduler de renovacao de watch desabilitado por configuracao.",
    );
    return { stop: () => undefined };
  }

  const driveWatchService = new DriveWatchService();
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    try {
      const dbPool = getDbPool();
      await ensureDatabaseSchema(dbPool);

      const active = await driveWatchService.getActive(dbPool);
      if (!active || !active.expiresAt) {
        return;
      }

      if (
        shouldRenewWatch(
          active.expiresAt,
          Date.now(),
          env.DRIVE_WATCH_RENEW_BEFORE_SECONDS,
        )
      ) {
        const renewed = await driveWatchService.renew(dbPool);
        logger.info(
          {
            previousChannelId: active.channelId,
            renewedChannelId: renewed.channelId,
            expiresAt: renewed.expiresAt,
          },
          "Canal de watch renovado automaticamente.",
        );
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Falha no scheduler de renovacao do watch.",
      );
    } finally {
      running = false;
    }
  };

  const interval = setInterval(
    () => void tick(),
    env.DRIVE_WATCH_CHECK_INTERVAL_SECONDS * 1000,
  );

  void tick();

  return {
    stop: () => {
      clearInterval(interval);
    },
  };
}

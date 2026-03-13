import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { getDbPool } from "../../io/dbConnection.js";
import { ensureDatabaseSchema } from "../../io/ensureDatabaseSchema.js";
import { getRedisClient } from "../../infra/queue/redis.js";
import { DriveWatchService } from "../../services/drive/driveWatch.service.js";

type ServiceStatus = "up" | "down" | "disabled";

export function computeDiagnosticsStatus(params: {
  dbStatus: ServiceStatus;
  redisStatus: ServiceStatus;
  watchStatus: ServiceStatus;
}): "ok" | "degraded" {
  const allUp =
    params.dbStatus === "up" &&
    (params.redisStatus === "up" || params.redisStatus === "disabled") &&
    (params.watchStatus === "up" || params.watchStatus === "down");

  return allUp ? "ok" : "degraded";
}

export async function registerDiagnosticsRoutes(
  app: FastifyInstance,
): Promise<void> {
  let driveWatchService: DriveWatchService | null = null;

  function getDriveWatchService(): DriveWatchService {
    driveWatchService ??= new DriveWatchService();
    return driveWatchService;
  }

  app.get("/api/diagnostics", async (_request, reply) => {
    let dbStatus: ServiceStatus = "down";
    let redisStatus: ServiceStatus = env.REDIS_ENABLED ? "down" : "disabled";
    let watchStatus: ServiceStatus = "down";
    let activeWatch: unknown = null;

    try {
      const dbPool = getDbPool();
      await ensureDatabaseSchema(dbPool);
      await dbPool.query("SELECT 1");
      dbStatus = "up";

      activeWatch = await getDriveWatchService().getActive(dbPool);
      watchStatus = activeWatch ? "up" : "down";
    } catch {
      dbStatus = "down";
      watchStatus = "down";
    }

    if (env.REDIS_ENABLED) {
      try {
        const redisClient = getRedisClient();
        const pong = await redisClient.ping();
        redisStatus = pong === "PONG" ? "up" : "down";
      } catch {
        redisStatus = "down";
      }
    }

    const status = computeDiagnosticsStatus({
      dbStatus,
      redisStatus,
      watchStatus,
    });

    return reply.status(status === "ok" ? 200 : 503).send({
      status,
      services: {
        db: dbStatus,
        redis: redisStatus,
        watch: watchStatus,
      },
      activeWatch,
      mode: env.API_MODE,
    });
  });
}

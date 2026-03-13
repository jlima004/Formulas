import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";

export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "formulas-api",
      queueEnabled: env.REDIS_ENABLED,
      mode: env.API_MODE,
    };
  });
}

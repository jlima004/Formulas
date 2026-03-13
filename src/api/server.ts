import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { logger } from "../config/logger.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerWebhookRoutes } from "./routes/webhook.routes.js";
import { registerDriveRoutes } from "./routes/drive.routes.js";
import { registerDiagnosticsRoutes } from "./routes/diagnostics.routes.js";

export async function buildApiServer() {
  const app = Fastify({
    logger: false,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, "Erro na camada API.");
    reply.status(500).send({ message: "Erro interno da API." });
  });

  await registerHealthRoutes(app);
  await registerDiagnosticsRoutes(app);
  await registerWebhookRoutes(app);
  await registerDriveRoutes(app);

  return app;
}

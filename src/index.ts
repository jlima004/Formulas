import { processAllPdfs } from "./batch/processAllPdfs.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { buildApiServer } from "./api/server.js";
import { startDriveWatchScheduler } from "./services/drive/driveWatchScheduler.service.js";

type AppMode = "batch" | "api" | "both";

function resolveMode(argv: string[]): AppMode {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  const rawMode = modeArg?.split("=")[1] ?? env.API_MODE;

  if (rawMode === "batch" || rawMode === "api" || rawMode === "both") {
    return rawMode;
  }

  return "batch";
}

async function main(): Promise<void> {
  const mode = resolveMode(process.argv.slice(2));
  let schedulerHandle: { stop: () => void } | null = null;

  if (mode === "api") {
    const app = await buildApiServer();
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    schedulerHandle = startDriveWatchScheduler();
    logger.info(
      { mode, host: env.API_HOST, port: env.API_PORT },
      "Servidor API iniciado.",
    );

    process.on("SIGTERM", () => schedulerHandle?.stop());
    process.on("SIGINT", () => schedulerHandle?.stop());
    return;
  }

  if (mode === "both") {
    const app = await buildApiServer();
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    schedulerHandle = startDriveWatchScheduler();
    logger.info(
      { mode, host: env.API_HOST, port: env.API_PORT },
      "Servidor API iniciado em modo combinado.",
    );

    process.on("SIGTERM", () => schedulerHandle?.stop());
    process.on("SIGINT", () => schedulerHandle?.stop());
  }

  const summary = await processAllPdfs();

  console.log(`Processados com sucesso: ${summary.succeeded.length}`);
  console.log(`Falhas: ${summary.failed.length}`);

  if (summary.succeeded.length > 0) {
    console.log("Arquivos processados:");
    summary.succeeded.forEach((fileName) => console.log(`- ${fileName}`));
  }

  if (summary.failed.length > 0) {
    console.log("Falhas encontradas:");
    summary.failed.forEach((failure) =>
      console.log(`- ${failure.fileName}: ${failure.error}`),
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { logger } from "./config/logger.js";
import { startDriveFileWorker } from "./workers/drive-file.worker.js";

const worker = startDriveFileWorker();

if (!worker) {
  logger.warn("Encerrando processo worker por falta de configuracao de fila.");
  process.exit(0);
}

logger.info("Worker de notificacoes Drive iniciado.");

import { processAllPdfs } from "./batch/processAllPdfs.js";

async function main(): Promise<void> {
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

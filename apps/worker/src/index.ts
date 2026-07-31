import {
  claimNextQueuedIngestionJob,
  completeIngestionJob,
  completePartialIngestionJob,
  failIngestionJob,
  listFailedBookPageNumbers,
  replaceBookChapters,
  updateIngestionProgress,
  updateBookMetadata,
  upsertBookPage,
} from "@astrea/db";
import { ServerBrowserController } from "./browser/server-browser-controller";
import { WorkerPageExtractor } from "./extraction/worker-page-extractor";
import { WorkerOpenAiSettings } from "./settings/openai-settings";

type WorkerConfig = {
  pollIntervalMs: number;
  concurrency: 1;
  maxPageAttempts: number;
};

const config: WorkerConfig = {
  pollIntervalMs: 5_000,
  concurrency: 1,
  maxPageAttempts: Number(process.env.ASTREA_MAX_PAGE_ATTEMPTS ?? 3),
};

const browserController = new ServerBrowserController();
const openAiSettings = new WorkerOpenAiSettings();
const extractor = new WorkerPageExtractor(browserController, openAiSettings);

async function main() {
  console.log("Astrea worker starting", config);
  console.log("Serial ingestion mode enabled: one book at a time.");

  await pollOnce();
}

async function pollOnce() {
  const nextJob = await claimNextQueuedIngestionJob();

  if (!nextJob) {
    console.log("No queued ingestion jobs found, or another job is already running.");
    return;
  }

  try {
    const outcome = await processIngestionJob(nextJob);

    if (outcome.completedPages === 0) {
      await failIngestionJob(nextJob.id, "No se pudo extraer ninguna página del libro.");
      return;
    }

    if (outcome.failedPages > 0) {
      await completePartialIngestionJob(
        nextJob.id,
        `Extracción parcial: ${outcome.failedPages} páginas fallidas.`,
      );
      return;
    }

    await completeIngestionJob(nextJob.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    await failIngestionJob(nextJob.id, message);
    throw error;
  }
}

type ClaimedIngestionJob = NonNullable<Awaited<ReturnType<typeof claimNextQueuedIngestionJob>>>;

type ProcessOutcome = {
  completedPages: number;
  failedPages: number;
};

async function processIngestionJob(job: ClaimedIngestionJob): Promise<ProcessOutcome> {
  const metadata = await extractor.resolveBookMetadata(job.book.astreaBookId);
  await updateBookMetadata({
    bookId: job.bookId,
    ...metadata,
  });

  const pages = await resolvePagesToExtract(job, metadata.totalPages ?? job.book.totalPages);

  await updateIngestionProgress({
    jobId: job.id,
    progressDone: 0,
    progressFailed: 0,
  });

  console.log(
    `Processing ingestion job ${job.id} for Astrea book ${job.book.astreaBookId} (${pages.length} pages)`,
  );

  let completedPages = 0;
  let failedPages = 0;

  await extractor.extractPages({
    bookcode: job.book.astreaBookId,
    pages,
    maxAttempts: config.maxPageAttempts,
    ocrProvider: "openai",
    onPageCompleted: async (page) => {
      completedPages += 1;
      await upsertBookPage({
        bookId: job.bookId,
        pageNumber: page.page,
        status: "ready",
        text: page.text,
        errorMessage: null,
        processedAt: new Date(),
      });
      await updateIngestionProgress({
        jobId: job.id,
        progressDone: completedPages,
        progressFailed: failedPages,
      });
    },
    onPageFailed: async (page) => {
      failedPages += 1;
      await upsertBookPage({
        bookId: job.bookId,
        pageNumber: page.page,
        status: "failed",
        text: null,
        errorMessage: page.message,
        processedAt: new Date(),
      });
      await updateIngestionProgress({
        jobId: job.id,
        progressDone: completedPages,
        progressFailed: failedPages,
      });
    },
  });

  return {
    completedPages,
    failedPages,
  };
}

async function resolvePagesToExtract(job: ClaimedIngestionJob, totalPages: number | null) {
  if (job.mode === "retry_failed_pages") {
    const failedPages = await listFailedBookPageNumbers(job.bookId);
    if (failedPages.length === 0) {
      throw new Error("No hay páginas fallidas para reintentar.");
    }
    return failedPages;
  }

  const explicitPages = process.env.ASTREA_WORKER_PAGES?.trim();

  if (explicitPages) {
    return explicitPages
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  if (!totalPages || totalPages < 1) {
    throw new Error(
      "El libro no tiene totalPages definido. Configurá ASTREA_WORKER_PAGES para pruebas o implementá metadata automática antes de procesar libro completo.",
    );
  }

  return Array.from({ length: totalPages }, (_, index) => index + 1);
}

main()
  .catch((error: unknown) => {
    console.error("Astrea worker crashed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browserController.dispose().catch(() => undefined);
  });
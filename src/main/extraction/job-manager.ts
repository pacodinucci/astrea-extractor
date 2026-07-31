import { nanoid } from "nanoid";
import {
  MAX_PAGE_ATTEMPTS,
  type ExtractionJob,
  type ExtractionJobStatus,
  type ExtractionRequest,
} from "../../shared/extraction";
import type { PageExtractor } from "./types";

export class JobManager {
  private readonly jobs = new Map<string, ExtractionJob>();

  constructor(private readonly extractor: PageExtractor) {}

  createJob(request: ExtractionRequest): ExtractionJob {
    const now = new Date().toISOString();
    const job: ExtractionJob = {
      jobId: `ext_${nanoid(10)}`,
      status: "queued",
      bookcode: request.bookcode,
      title: request.title,
      requestedPages: request.pages,
      ocrProvider: request.ocrProvider,
      openAiModel: request.openAiModel,
      progress: {
        total: request.pages.length,
        completed: 0,
        failed: 0,
      },
      pages: [],
      failedPages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.jobId, job);
    void this.processJob(job.jobId);

    return job;
  }

  getJob(jobId: string): ExtractionJob | undefined {
    return this.jobs.get(jobId);
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.patchJob(job, { status: "processing" });

    try {
      const bookcode = await this.extractor.resolveBookcode({
        bookcode: job.bookcode,
        title: job.title,
        pages: job.requestedPages,
      });
      job.bookcode = bookcode;

      await this.extractor.extractPages({
        bookcode,
        pages: job.requestedPages,
        maxAttempts: MAX_PAGE_ATTEMPTS,
        ocrProvider: job.ocrProvider,
        openAiModel: job.openAiModel,
        onPageCompleted: (page) => {
          job.pages.push(page);
          job.progress.completed = job.pages.length;
          this.touch(job);
        },
        onPageFailed: (page) => {
          job.failedPages.push(page);
          job.progress.failed = job.failedPages.length;
          this.touch(job);
        },
      });

      job.pages.sort((a, b) => a.page - b.page);
      job.failedPages.sort((a, b) => a.page - b.page);
      job.combinedText = this.buildCombinedText(job);
      const terminalStatus = this.resolveTerminalStatus(job);
      this.patchJob(
        job,
        terminalStatus === "failed"
          ? {
              status: terminalStatus,
              error: {
                code: "JOB_FAILED",
                message: "No se pudo extraer ninguna pagina solicitada.",
              },
            }
          : { status: terminalStatus },
      );
    } catch (error) {
      this.patchJob(job, {
        status: "failed",
        error: {
          code: "JOB_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Fallo la extraccion solicitada.",
        },
      });
    }
  }

  private buildCombinedText(job: ExtractionJob): string | undefined {
    if (!job.pages.length) return undefined;

    const missingPagesNotice = job.failedPages.length
      ? `Paginas no extraidas: ${job.failedPages.map((page) => page.page).join(", ")}`
      : undefined;
    const successfulPagesText = job.pages
      .map((page) => `--- Pagina ${page.page} ---\n${page.text.trim()}`)
      .join("\n\n");

    return [missingPagesNotice, successfulPagesText].filter(Boolean).join("\n\n");
  }

  private resolveTerminalStatus(job: ExtractionJob): ExtractionJobStatus {
    if (job.pages.length === job.requestedPages.length) return "completed";
    if (job.pages.length > 0) return "completed_with_errors";
    return "failed";
  }

  private patchJob(
    job: ExtractionJob,
    patch: Partial<Pick<ExtractionJob, "status" | "error">>,
  ): void {
    Object.assign(job, patch);
    this.touch(job);
  }

  private touch(job: ExtractionJob): void {
    job.updatedAt = new Date().toISOString();
  }
}

import { nanoid } from "nanoid";
import {
  MAX_PAGE_ATTEMPTS,
  type ExtractionJob,
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

      for (const page of job.requestedPages) {
        let lastError: unknown;

        for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt += 1) {
          try {
            const result = await this.extractor.extractPage({
              bookcode,
              page,
              attempt,
              ocrProvider: job.ocrProvider,
              openAiModel: job.openAiModel,
            });

            job.pages.push({
              ...result,
              page,
              attempts: attempt,
              status: "completed",
            });
            job.progress.completed = job.pages.length;
            this.touch(job);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError) {
          job.progress.failed = 1;
          this.patchJob(job, {
            status: "failed",
            error: {
              page,
              code: "PAGE_EXTRACTION_FAILED",
              message:
                lastError instanceof Error
                  ? lastError.message
                  : "No se pudo extraer la página después de 3 intentos.",
            },
          });
          return;
        }
      }

      job.pages.sort((a, b) => a.page - b.page);
      job.combinedText = job.pages
        .map((page) => `--- Página ${page.page} ---\n${page.text.trim()}`)
        .join("\n\n");
      this.patchJob(job, { status: "completed" });
    } catch (error) {
      this.patchJob(job, {
        status: "failed",
        error: {
          code: "JOB_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Falló la extracción solicitada.",
        },
      });
    }
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

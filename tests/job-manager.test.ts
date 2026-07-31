import { describe, expect, it } from "vitest";
import { JobManager } from "../src/main/extraction/job-manager";
import type { PageExtractor } from "../src/main/extraction/types";

async function waitForTerminalJob(manager: JobManager, jobId: string) {
  for (let index = 0; index < 50; index += 1) {
    const job = manager.getJob(jobId);
    if (
      job?.status === "completed" ||
      job?.status === "completed_with_errors" ||
      job?.status === "failed"
    ) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("El job no termino a tiempo.");
}

describe("JobManager", () => {
  it("completa un job y concatena texto por pagina", async () => {
    const extractor: PageExtractor = {
      resolveBookcode: async () => "00119000",
      extractPage: async ({ page }) => ({
        page,
        text: `Texto ${page}`,
        method: "pdf_text_layer",
      }),
      extractPages: async ({ pages, onPageCompleted }) => {
        const completedPages = pages.map((page) => ({
          page,
          text: `Texto ${page}`,
          method: "pdf_text_layer" as const,
          attempts: 1,
          status: "completed" as const,
        }));
        completedPages.forEach((page) => onPageCompleted?.(page));
        return { pages: completedPages, failedPages: [] };
      },
    };
    const manager = new JobManager(extractor);

    const created = manager.createJob({ bookcode: "00119000", pages: [2, 1] });
    const job = await waitForTerminalJob(manager, created.jobId);

    expect(job.status).toBe("completed");
    expect(job.pages.map((page) => page.page)).toEqual([1, 2]);
    expect(job.failedPages).toEqual([]);
    expect(job.combinedText).toContain("--- Pagina 1 ---");
    expect(job.combinedText).toContain("Texto 2");
  });

  it("continua el job si una pagina falla despues de 3 intentos", async () => {
    let attempts = 0;
    const extractor: PageExtractor = {
      resolveBookcode: async () => "00119000",
      extractPage: async ({ page }) => {
        attempts += 1;
        if (page === 2) throw new Error("PDF sin texto");
        return { page, text: `Texto ${page}`, method: "pdf_text_layer" };
      },
      extractPages: async ({ pages, maxAttempts, onPageCompleted, onPageFailed }) => {
        const completedPages = [];
        const failedPages = [];

        for (const page of pages) {
          if (page === 2) {
            attempts += maxAttempts;
            const failedPage = {
              page,
              attempts: maxAttempts,
              code: "PAGE_EXTRACTION_FAILED" as const,
              message: "PDF sin texto",
            };
            failedPages.push(failedPage);
            onPageFailed?.(failedPage);
            continue;
          }

          attempts += 1;
          const completedPage = {
            page,
            text: `Texto ${page}`,
            method: "pdf_text_layer" as const,
            attempts: 1,
            status: "completed" as const,
          };
          completedPages.push(completedPage);
          onPageCompleted?.(completedPage);
        }

        return { pages: completedPages, failedPages };
      },
    };
    const manager = new JobManager(extractor);

    const created = manager.createJob({ bookcode: "00119000", pages: [1, 2, 3] });
    const job = await waitForTerminalJob(manager, created.jobId);

    expect(job.status).toBe("completed_with_errors");
    expect(job.error).toBeUndefined();
    expect(job.failedPages).toEqual([
      {
        page: 2,
        attempts: 3,
        code: "PAGE_EXTRACTION_FAILED",
        message: "PDF sin texto",
      },
    ]);
    expect(job.progress).toEqual({ total: 3, completed: 2, failed: 1 });
    expect(attempts).toBe(5);
    expect(job.combinedText).toContain("Paginas no extraidas: 2");
    expect(job.combinedText).toContain("--- Pagina 1 ---");
    expect(job.combinedText).toContain("--- Pagina 3 ---");
  });

  it("falla el job si no se pudo extraer ninguna pagina", async () => {
    const extractor: PageExtractor = {
      resolveBookcode: async () => "00119000",
      extractPage: async () => {
        throw new Error("Timeout del reader");
      },
      extractPages: async ({ pages, maxAttempts, onPageFailed }) => {
        const failedPages = pages.map((page) => ({
          page,
          attempts: maxAttempts,
          code: "PAGE_EXTRACTION_FAILED" as const,
          message: "Timeout del reader",
        }));
        failedPages.forEach((page) => onPageFailed?.(page));
        return { pages: [], failedPages };
      },
    };
    const manager = new JobManager(extractor);

    const created = manager.createJob({ bookcode: "00119000", pages: [1, 2] });
    const job = await waitForTerminalJob(manager, created.jobId);

    expect(job.status).toBe("failed");
    expect(job.error?.code).toBe("JOB_FAILED");
    expect(job.failedPages.map((page) => page.page)).toEqual([1, 2]);
    expect(job.progress).toEqual({ total: 2, completed: 0, failed: 2 });
    expect(job.combinedText).toBeUndefined();
  });
});

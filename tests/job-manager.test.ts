import { describe, expect, it } from "vitest";
import { JobManager } from "../src/main/extraction/job-manager";
import type { PageExtractor } from "../src/main/extraction/types";

async function waitForTerminalJob(manager: JobManager, jobId: string) {
  for (let index = 0; index < 50; index += 1) {
    const job = manager.getJob(jobId);
    if (job?.status === "completed" || job?.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error("El job no terminó a tiempo.");
}

describe("JobManager", () => {
  it("completa un job y concatena texto por página", async () => {
    const extractor: PageExtractor = {
      resolveBookcode: async () => "00119000",
      extractPage: async ({ page }) => ({
        page,
        text: `Texto ${page}`,
        method: "pdf_text_layer",
      }),
    };
    const manager = new JobManager(extractor);

    const created = manager.createJob({ bookcode: "00119000", pages: [2, 1] });
    const job = await waitForTerminalJob(manager, created.jobId);

    expect(job.status).toBe("completed");
    expect(job.pages.map((page) => page.page)).toEqual([1, 2]);
    expect(job.combinedText).toContain("--- Página 1 ---");
    expect(job.combinedText).toContain("Texto 2");
  });

  it("reintenta hasta 3 veces y falla todo el job si una página no sale", async () => {
    let attempts = 0;
    const extractor: PageExtractor = {
      resolveBookcode: async () => "00119000",
      extractPage: async ({ page }) => {
        attempts += 1;
        if (page === 2) throw new Error("PDF sin texto");
        return { page, text: `Texto ${page}`, method: "pdf_text_layer" };
      },
    };
    const manager = new JobManager(extractor);

    const created = manager.createJob({ bookcode: "00119000", pages: [1, 2] });
    const job = await waitForTerminalJob(manager, created.jobId);

    expect(job.status).toBe("failed");
    expect(job.error?.page).toBe(2);
    expect(attempts).toBe(4);
    expect(job.combinedText).toBeUndefined();
  });
});

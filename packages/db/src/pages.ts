import type { BookPageStatus } from "@prisma/client";
import { prisma } from "./client";

type UpsertBookPageInput = {
  bookId: string;
  pageNumber: number;
  status: BookPageStatus;
  text?: string | null;
  errorMessage?: string | null;
  processedAt?: Date | null;
};

export async function upsertBookPage({
  bookId,
  pageNumber,
  status,
  text = null,
  errorMessage = null,
  processedAt = new Date(),
}: UpsertBookPageInput) {
  return prisma.bookPage.upsert({
    where: {
      bookId_pageNumber: {
        bookId,
        pageNumber,
      },
    },
    create: {
      bookId,
      pageNumber,
      status,
      text,
      errorMessage,
      processedAt,
    },
    update: {
      status,
      text,
      errorMessage,
      processedAt,
    },
  });
}

export async function updateIngestionProgress({
  jobId,
  progressDone,
  progressFailed,
}: {
  jobId: string;
  progressDone: number;
  progressFailed: number;
}) {
  return prisma.ingestionJob.update({
    where: {
      id: jobId,
    },
    data: {
      progressDone,
      progressFailed,
    },
  });
}
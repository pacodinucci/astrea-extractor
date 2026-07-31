import type { CreateIngestionResult } from "@astrea/core";
import type { IngestionJobStatus } from "@prisma/client";
import { prisma } from "./client";

type RequestBookIngestionInput = {
  astreaBookId: string;
  requestedByUserId: string;
};

const activeJobStatuses: IngestionJobStatus[] = ["queued", "running"];

export async function requestBookIngestion({
  astreaBookId,
  requestedByUserId,
}: RequestBookIngestionInput): Promise<CreateIngestionResult> {
  const existingBook = await prisma.book.findUnique({
    where: {
      astreaBookId,
    },
  });

  if (existingBook?.status === "available") {
    return {
      kind: "book_available",
      bookId: existingBook.id,
    };
  }

  if (existingBook) {
    const activeJob = await findActiveBookJob(existingBook.id);

    if (activeJob) {
      return {
        kind: "job_already_running",
        bookId: existingBook.id,
        jobId: activeJob.id,
      };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const book =
      existingBook ??
      (await tx.book.create({
        data: {
          astreaBookId,
          status: "queued",
        },
      }));

    const job = await tx.ingestionJob.create({
      data: {
        bookId: book.id,
        requestedByUserId,
        status: "queued",
        mode: "full_book",
      },
    });

    if (book.status !== "queued") {
      await tx.book.update({
        where: {
          id: book.id,
        },
        data: {
          status: "queued",
        },
      });
    }

    return { book, job };
  });

  return {
    kind: "job_queued",
    bookId: result.book.id,
    jobId: result.job.id,
  };
}

export async function requestFailedPagesRetry({
  bookId,
  requestedByUserId,
}: {
  bookId: string;
  requestedByUserId: string;
}): Promise<CreateIngestionResult> {
  const book = await prisma.book.findUnique({
    where: {
      id: bookId,
    },
    include: {
      pages: {
        where: {
          status: "failed",
        },
        orderBy: {
          pageNumber: "asc",
        },
      },
    },
  });

  if (!book) {
    throw new Error("Libro no encontrado.");
  }

  if (book.status === "available") {
    return {
      kind: "book_available",
      bookId: book.id,
    };
  }

  const activeJob = await findActiveBookJob(book.id);

  if (activeJob) {
    return {
      kind: "job_already_running",
      bookId: book.id,
      jobId: activeJob.id,
    };
  }

  if (book.pages.length === 0) {
    return {
      kind: "book_available",
      bookId: book.id,
    };
  }

  const job = await prisma.ingestionJob.create({
    data: {
      bookId,
      requestedByUserId,
      status: "queued",
      mode: "retry_failed_pages",
      progressTotal: book.pages.length,
    },
  });

  await prisma.book.update({
    where: {
      id: bookId,
    },
    data: {
      status: "queued",
    },
  });

  return {
    kind: "job_queued",
    bookId: book.id,
    jobId: job.id,
  };
}

export async function claimNextQueuedIngestionJob() {
  return prisma.$transaction(async (tx) => {
    const alreadyRunning = await tx.ingestionJob.findFirst({
      where: {
        status: "running",
      },
      orderBy: {
        startedAt: "asc",
      },
    });

    if (alreadyRunning) {
      return null;
    }

    const nextJob = await tx.ingestionJob.findFirst({
      where: {
        status: "queued",
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        book: true,
      },
    });

    if (!nextJob) {
      return null;
    }

    await tx.book.update({
      where: {
        id: nextJob.bookId,
      },
      data: {
        status: "processing",
      },
    });

    return tx.ingestionJob.update({
      where: {
        id: nextJob.id,
      },
      data: {
        status: "running",
        startedAt: new Date(),
      },
      include: {
        book: true,
      },
    });
  });
}

export async function completeIngestionJob(jobId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.ingestionJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: "completed",
        finishedAt: new Date(),
      },
    });

    await tx.book.update({
      where: {
        id: job.bookId,
      },
      data: {
        status: "available",
        extractedAt: new Date(),
      },
    });

    return job;
  });
}

export async function completePartialIngestionJob(
  jobId: string,
  errorSummary: string | null = null,
) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.ingestionJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: "partial",
        finishedAt: new Date(),
        errorSummary,
      },
    });

    await tx.book.update({
      where: {
        id: job.bookId,
      },
      data: {
        status: "partial",
        extractedAt: new Date(),
      },
    });

    return job;
  });
}

export async function failIngestionJob(jobId: string, errorSummary: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.ingestionJob.update({
      where: {
        id: jobId,
      },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorSummary,
      },
    });

    await tx.book.update({
      where: {
        id: job.bookId,
      },
      data: {
        status: "failed",
      },
    });

    return job;
  });
}

function findActiveBookJob(bookId: string) {
  return prisma.ingestionJob.findFirst({
    where: {
      bookId,
      status: {
        in: activeJobStatuses,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
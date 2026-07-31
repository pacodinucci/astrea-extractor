import { buildTxtExport } from "@astrea/core";
import { prisma } from "./client";

export async function buildBookTxtExport(bookId: string, requestedByUserId: string) {
  const book = await prisma.book.findUnique({
    where: {
      id: bookId,
    },
    include: {
      chapters: {
        orderBy: {
          order: "asc",
        },
      },
      pages: {
        orderBy: {
          pageNumber: "asc",
        },
      },
    },
  });

  if (!book) {
    return null;
  }

  const processedPages = book.pages.filter((page) => page.status === "ready").length;
  const failedPages = book.pages.filter((page) => page.status === "failed").length;

  const content = buildTxtExport({
    metadata: {
      book: {
        astreaBookId: book.astreaBookId,
        title: book.title,
        author: book.author,
        edition: book.edition,
        totalPages: book.totalPages,
        status: book.status,
      },
      extractedAt: book.extractedAt,
      exportedAt: new Date(),
      processedPages,
      failedPages,
    },
    chapters: book.chapters,
    pages: book.pages,
  });

  const fileName = `${sanitizeFileName(book.title ?? `astrea-${book.astreaBookId}`)}.txt`;

  await prisma.bookDownloadEvent.create({
    data: {
      bookId: book.id,
      userId: requestedByUserId,
      format: "txt",
    },
  });

  return {
    fileName,
    content,
  };
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
import { prisma } from "./client";

export async function listBooks() {
  return prisma.book.findMany({
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getBookById(bookId: string) {
  return prisma.book.findUnique({
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
}

export async function getBookByAstreaId(astreaBookId: string) {
  return prisma.book.findUnique({
    where: {
      astreaBookId,
    },
  });
}
type UpdateBookMetadataInput = {
  bookId: string;
  title?: string | null;
  author?: string | null;
  edition?: string | null;
  totalPages?: number | null;
};

export async function updateBookMetadata({
  bookId,
  title,
  author,
  edition,
  totalPages,
}: UpdateBookMetadataInput) {
  return prisma.book.update({
    where: {
      id: bookId,
    },
    data: {
      title,
      author,
      edition,
      totalPages,
    },
  });
}
export async function listFailedBookPageNumbers(bookId: string) {
  const pages = await prisma.bookPage.findMany({
    where: {
      bookId,
      status: "failed",
    },
    orderBy: {
      pageNumber: "asc",
    },
    select: {
      pageNumber: true,
    },
  });

  return pages.map((page) => page.pageNumber);
}
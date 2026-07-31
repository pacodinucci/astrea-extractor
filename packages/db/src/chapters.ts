import { prisma } from "./client";

type ReplaceBookChaptersInput = {
  bookId: string;
  chapters: Array<{
    title: string;
    order: number;
    startPage?: number | null;
    endPage?: number | null;
  }>;
};

export async function replaceBookChapters({ bookId, chapters }: ReplaceBookChaptersInput) {
  return prisma.$transaction(async (tx) => {
    await tx.bookChapter.deleteMany({
      where: {
        bookId,
      },
    });

    if (chapters.length === 0) {
      return [];
    }

    await tx.bookChapter.createMany({
      data: chapters.map((chapter) => ({
        bookId,
        title: chapter.title,
        order: chapter.order,
        startPage: chapter.startPage ?? null,
        endPage: chapter.endPage ?? null,
      })),
    });

    return tx.bookChapter.findMany({
      where: {
        bookId,
      },
      orderBy: {
        order: "asc",
      },
    });
  });
}
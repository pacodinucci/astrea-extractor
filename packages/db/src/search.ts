import { prisma } from "./client";

export async function searchBookPages(bookId: string, query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const pages = await prisma.bookPage.findMany({
    where: {
      bookId,
      text: {
        contains: normalizedQuery,
        mode: "insensitive",
      },
    },
    orderBy: {
      pageNumber: "asc",
    },
    select: {
      id: true,
      bookId: true,
      pageNumber: true,
      text: true,
    },
  });

  return pages.map((page) => ({
    bookId: page.bookId,
    pageNumber: page.pageNumber,
    chapterId: null,
    snippet: buildSnippet(page.text ?? "", normalizedQuery),
  }));
}

function buildSnippet(text: string, query: string) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return text.slice(0, 240);
  }

  const start = Math.max(0, matchIndex - 90);
  const end = Math.min(text.length, matchIndex + query.length + 150);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}
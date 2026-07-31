import type { Book, BookChapter, BookPage } from "./entities";
import type { ExportFormat } from "./statuses";

export type CreateIngestionRequest = {
  astreaBookId: string;
};

export type CreateIngestionResult =
  | {
      kind: "book_available";
      bookId: string;
    }
  | {
      kind: "job_queued";
      bookId: string;
      jobId: string;
    }
  | {
      kind: "job_already_running";
      bookId: string;
      jobId: string;
    };

export type BookSearchRequest = {
  bookId: string;
  query: string;
};

export type BookSearchResult = {
  bookId: string;
  pageNumber: number;
  chapterId: string | null;
  snippet: string;
};

export type CreateExportRequest = {
  bookId: string;
  format: ExportFormat;
};

export type TxtExportMetadata = {
  book: Pick<
    Book,
    "astreaBookId" | "title" | "author" | "edition" | "totalPages" | "status"
  >;
  extractedAt: Date | null;
  exportedAt: Date;
  processedPages: number;
  failedPages: number;
};

export type TxtExportDocument = {
  metadata: TxtExportMetadata;
  chapters: BookChapter[];
  pages: Array<Pick<BookPage, "pageNumber" | "text" | "status" | "errorMessage">>;
};


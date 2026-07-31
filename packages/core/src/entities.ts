import type {
  BookPageStatus,
  BookStatus,
  ExportFormat,
  ExportStatus,
  IngestionJobMode,
  IngestionJobStatus,
} from "./statuses";

export type Book = {
  id: string;
  astreaBookId: string;
  title: string | null;
  author: string | null;
  edition: string | null;
  totalPages: number | null;
  status: BookStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type BookPage = {
  id: string;
  bookId: string;
  pageNumber: number;
  status: BookPageStatus;
  text: string | null;
  errorMessage: string | null;
  processedAt: Date | null;
};

export type BookChapter = {
  id: string;
  bookId: string;
  title: string;
  order: number;
  startPage: number | null;
  endPage: number | null;
};

export type IngestionJob = {
  id: string;
  bookId: string;
  requestedByUserId: string;
  status: IngestionJobStatus;
  mode: IngestionJobMode;
  progressTotal: number;
  progressDone: number;
  progressFailed: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorSummary: string | null;
};

export type BookExport = {
  id: string;
  bookId: string;
  requestedByUserId: string;
  format: ExportFormat;
  status: ExportStatus;
  fileName: string | null;
  createdAt: Date;
};


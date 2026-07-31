export type BookStatus =
  | "requested"
  | "queued"
  | "processing"
  | "available"
  | "partial"
  | "failed";

export type IngestionJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type BookPageStatus =
  | "pending"
  | "captured"
  | "ocr_processing"
  | "ready"
  | "failed"
  | "skipped";

export type ExportStatus = "queued" | "running" | "ready" | "failed";

export type ExportFormat = "txt";


export type IngestionJobMode = "full_book" | "retry_failed_pages";
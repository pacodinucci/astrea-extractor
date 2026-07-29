export const ASTREA_BASE_URL = "https://astreavirtual.com";
export const ASTREA_API_BASE_URL = "https://astreavirtual-backend.com";
export const DEFAULT_API_PORT = 4317;
export const MAX_PAGES_PER_REQUEST = 100;
export const MAX_PAGE_ATTEMPTS = 3;

export type ExtractionMethod =
  | "pdf_text_layer"
  | "pdf_buffer"
  | "ocr"
  | "ocr_openai";

export const OPENAI_OCR_MODELS = [
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.6-luna",
] as const;

export type OpenAiOcrModel = (typeof OPENAI_OCR_MODELS)[number];

export type OcrProvider = "openai";

export type ExtractionJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type ExtractionRequest = {
  bookcode?: string;
  title?: string;
  pages: number[];
  ocrProvider?: OcrProvider;
  openAiModel?: OpenAiOcrModel;
};

export type ExtractionPageResult = {
  page: number;
  text: string;
  method: ExtractionMethod;
  attempts: number;
  status: "completed";
};

export type ExtractionJobError = {
  page?: number;
  code: string;
  message: string;
};

export type ExtractionJob = {
  jobId: string;
  status: ExtractionJobStatus;
  bookcode?: string;
  title?: string;
  requestedPages: number[];
  ocrProvider?: OcrProvider;
  openAiModel?: OpenAiOcrModel;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
  pages: ExtractionPageResult[];
  combinedText?: string;
  error?: ExtractionJobError;
  createdAt: string;
  updatedAt: string;
};

export type CreateExtractionResponse = {
  jobId: string;
  status: ExtractionJobStatus;
};


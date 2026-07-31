import type {
  ExtractionPageError,
  ExtractionPageResult,
  ExtractionRequest,
  OcrProvider,
  OpenAiOcrModel,
} from "../../shared/extraction";

export type PageExtractor = {
  resolveBookcode(request: ExtractionRequest): Promise<string>;
  extractPage(args: {
    bookcode: string;
    page: number;
    attempt: number;
    ocrProvider?: OcrProvider;
    openAiModel?: OpenAiOcrModel;
  }): Promise<Omit<ExtractionPageResult, "attempts" | "status">>;
  extractPages(args: {
    bookcode: string;
    pages: number[];
    maxAttempts: number;
    ocrProvider?: OcrProvider;
    openAiModel?: OpenAiOcrModel;
    onPageCompleted?: (page: ExtractionPageResult) => void;
    onPageFailed?: (page: ExtractionPageError) => void;
  }): Promise<{
    pages: ExtractionPageResult[];
    failedPages: ExtractionPageError[];
  }>;
};

import type {
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
};

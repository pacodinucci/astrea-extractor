import { z } from "zod";
import {
  MAX_PAGES_PER_REQUEST,
  OPENAI_OCR_MODELS,
  parsePageSelection,
  type ExtractionRequest,
} from "../../shared/extraction";

const extractionRequestSchema = z
  .object({
    bookcode: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    pages: z.union([z.array(z.number().int().positive()).min(1), z.string().trim().min(1)]),
    ocrProvider: z.literal("openai").optional(),
    openAiModel: z.enum(OPENAI_OCR_MODELS).optional(),
  })
  .refine((value) => value.bookcode || value.title, {
    message: "Debe enviarse bookcode o title.",
    path: ["bookcode"],
  });

export function parseExtractionRequest(payload: unknown): ExtractionRequest {
  const parsed = extractionRequestSchema.parse(payload);
  const pages = typeof parsed.pages === "string"
    ? parsePageSelection(parsed.pages)
    : Array.from(new Set(parsed.pages)).sort((a, b) => a - b);

  if (!pages.length) {
    throw new Error("Indicá páginas como lista separada por comas o rangos como (4-8),15.");
  }

  if (pages.length > MAX_PAGES_PER_REQUEST) {
    throw new Error(
      `La request excede el máximo de ${MAX_PAGES_PER_REQUEST} páginas.`,
    );
  }

  return {
    bookcode: parsed.bookcode,
    title: parsed.title,
    pages,
    ocrProvider: parsed.ocrProvider,
    openAiModel: parsed.openAiModel,
  };
}

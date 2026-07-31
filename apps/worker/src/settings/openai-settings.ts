export type WorkerOpenAiOcrModel =
  | "gpt-4.1-mini"
  | "gpt-4.1"
  | "gpt-4o-mini"
  | "gpt-4o";

const DEFAULT_OPENAI_OCR_MODEL: WorkerOpenAiOcrModel = "gpt-4.1-mini";

export class WorkerOpenAiSettings {
  getApiKey(): string {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new Error("Falta OPENAI_API_KEY en el entorno del worker.");
    }

    return apiKey;
  }

  getModel(): WorkerOpenAiOcrModel {
    const model = process.env.OPENAI_OCR_MODEL?.trim();

    if (isWorkerOpenAiOcrModel(model)) {
      return model;
    }

    return DEFAULT_OPENAI_OCR_MODEL;
  }
}

function isWorkerOpenAiOcrModel(
  model: string | undefined,
): model is WorkerOpenAiOcrModel {
  return (
    model === "gpt-4.1-mini" ||
    model === "gpt-4.1" ||
    model === "gpt-4o-mini" ||
    model === "gpt-4o"
  );
}
import { safeStorage } from "electron";
import Store from "electron-store";
import type { OpenAiOcrModel } from "../../shared/extraction";
import { OPENAI_OCR_MODELS } from "../../shared/extraction";
import type { OpenAiSettingsStatus } from "../../shared/ipc";

type SettingsShape = {
  encryptedOpenAiApiKey?: string;
  openAiModel?: OpenAiOcrModel;
};

const DEFAULT_OPENAI_MODEL: OpenAiOcrModel = "gpt-5.6-terra";

export class OpenAiSettingsStore {
  private readonly store = new Store<SettingsShape>({ name: "astrea-settings" });

  getStatus(): OpenAiSettingsStatus {
    return {
      hasApiKey: Boolean(this.store.get("encryptedOpenAiApiKey")),
      model: this.getModel(),
    };
  }

  getModel(): OpenAiOcrModel {
    const model = this.store.get("openAiModel");
    return this.isOpenAiModel(model) ? model : DEFAULT_OPENAI_MODEL;
  }

  saveModel(model: OpenAiOcrModel): OpenAiSettingsStatus {
    if (!this.isOpenAiModel(model)) {
      throw new Error(`Modelo OpenAI no soportado: ${model}`);
    }

    this.store.set("openAiModel", model);
    return this.getStatus();
  }

  saveApiKey(apiKey: string): OpenAiSettingsStatus {
    const normalized = apiKey.trim();
    if (!normalized) throw new Error("La API key de OpenAI no puede estar vac?a.");
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Electron safeStorage no est? disponible en este sistema.");
    }

    const encrypted = safeStorage.encryptString(normalized).toString("base64");
    this.store.set("encryptedOpenAiApiKey", encrypted);
    return this.getStatus();
  }

  clearApiKey(): OpenAiSettingsStatus {
    this.store.delete("encryptedOpenAiApiKey");
    return this.getStatus();
  }

  getApiKey(): string {
    const encrypted = this.store.get("encryptedOpenAiApiKey");
    if (!encrypted) {
      throw new Error("Falta configurar la API key de OpenAI desde la interfaz.");
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Electron safeStorage no est? disponible para leer la API key.");
    }

    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  }

  private isOpenAiModel(value: unknown): value is OpenAiOcrModel {
    return typeof value === "string" && OPENAI_OCR_MODELS.includes(value as OpenAiOcrModel);
  }
}

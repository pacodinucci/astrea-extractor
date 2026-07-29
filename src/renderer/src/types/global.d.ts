import type {
  ApiRuntimeStatus,
  BrowserRuntimeStatus,
  OpenAiSettingsStatus,
} from "@shared/ipc";

declare global {
  interface Window {
    astrea: {
      browserStatus: () => Promise<BrowserRuntimeStatus>;
      openBrowser: () => Promise<BrowserRuntimeStatus>;
      health: () => Promise<{
        api: ApiRuntimeStatus;
        browser: BrowserRuntimeStatus;
      }>;
      openAiSettingsStatus: () => Promise<OpenAiSettingsStatus>;
      saveOpenAiApiKey: (apiKey: string) => Promise<OpenAiSettingsStatus>;
      clearOpenAiApiKey: () => Promise<OpenAiSettingsStatus>;
      saveOpenAiModel: (model: string) => Promise<OpenAiSettingsStatus>;
    };
  }
}

export {};

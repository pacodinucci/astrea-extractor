export type BrowserRuntimeStatus = {
  isRunning: boolean;
  cdpPort: number;
  profilePath: string;
  astreaUrl: string;
  error?: string;
};

export type ApiRuntimeStatus = {
  isRunning: boolean;
  port: number;
  baseUrl: string;
};


import type { OpenAiOcrModel } from "./extraction";

export type OpenAiSettingsStatus = {
  hasApiKey: boolean;
  model: OpenAiOcrModel;
};

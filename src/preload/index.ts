import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("astrea", {
  browserStatus: () => ipcRenderer.invoke("browser:status"),
  openBrowser: () => ipcRenderer.invoke("browser:open"),
  health: () => ipcRenderer.invoke("api:health"),
  openAiSettingsStatus: () => ipcRenderer.invoke("openai:settings-status"),
  saveOpenAiApiKey: (apiKey: string) => ipcRenderer.invoke("openai:save-api-key", apiKey),
  clearOpenAiApiKey: () => ipcRenderer.invoke("openai:clear-api-key"),
  saveOpenAiModel: (model: string) => ipcRenderer.invoke("openai:save-model", model),
});

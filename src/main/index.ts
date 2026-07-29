import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { is } from "@electron-toolkit/utils";
import { BrowserController } from "./browser/browser-controller";
import { AstreaExtractor } from "./extraction/astrea-extractor";
import { JobManager } from "./extraction/job-manager";
import { LocalApiServer } from "./api/local-api";
import { OpenAiSettingsStore } from "./settings/openai-settings";

let mainWindow: BrowserWindow | undefined;
let browserController: BrowserController;
let apiServer: LocalApiServer;
let openAiSettings: OpenAiSettingsStore;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    title: "Astrea Extractor",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

async function bootstrapServices(): Promise<void> {
  browserController = new BrowserController();
  openAiSettings = new OpenAiSettingsStore();
  const extractor = new AstreaExtractor(browserController, openAiSettings);
  const jobManager = new JobManager(extractor);
  apiServer = new LocalApiServer(browserController, jobManager);

  ipcMain.handle("browser:status", () => browserController.getStatus());
  ipcMain.handle("browser:open", () => browserController.openAstrea());
  ipcMain.handle("api:health", () => ({
    api: apiServer.getStatus(),
    browser: browserController.getStatus(),
  }));
  ipcMain.handle("openai:settings-status", () => openAiSettings.getStatus());
  ipcMain.handle("openai:save-api-key", (_event, apiKey: string) =>
    openAiSettings.saveApiKey(apiKey),
  );
  ipcMain.handle("openai:clear-api-key", () => openAiSettings.clearApiKey());
  ipcMain.handle("openai:save-model", (_event, model: string) =>
    openAiSettings.saveModel(model as never),
  );

  await apiServer.start();
}

app.whenReady().then(async () => {
  await bootstrapServices();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async () => {
  await apiServer?.stop();
  await browserController?.dispose();
});

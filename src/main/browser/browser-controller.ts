import { app } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ChildProcess, spawn } from "node:child_process";
import { chromium, type Browser } from "playwright";
import {
  ASTREA_BASE_URL,
  DEFAULT_API_PORT,
} from "../../shared/extraction";
import type { BrowserRuntimeStatus } from "../../shared/ipc";

const DEFAULT_CDP_PORT = 9222;

export class BrowserController {
  private process?: ChildProcess;
  private browser?: Browser;
  private lastError?: string;

  readonly cdpPort = Number(process.env.ASTREA_CDP_PORT ?? DEFAULT_CDP_PORT);
  readonly profilePath = join(app.getPath("userData"), "astrea-profile");

  async openAstrea(): Promise<BrowserRuntimeStatus> {
    try {
      this.ensureProfileDirectory();

      if (!this.process || this.process.killed) {
        const executablePath = this.getChromiumExecutablePath();
        if (!executablePath) {
          throw new Error(
            "No se encontró Google Chrome/Chromium instalado. Instalá Google Chrome o configurá ASTREA_CHROMIUM_PATH con la ruta del ejecutable.",
          );
        }

        this.process = spawn(executablePath, this.getChromiumLaunchArgs(), {
          detached: false,
          stdio: "ignore",
        });

        this.process.once("error", (error) => {
          this.lastError = error.message;
        });
      }

      await this.waitForCdp();
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "No se pudo abrir Chromium.";
    }

    return this.getStatus();
  }

  async getConnectedBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) return this.browser;
    await this.connect();
    if (!this.browser?.isConnected()) {
      throw new Error("Chromium no está conectado por CDP.");
    }
    return this.browser;
  }

  getStatus(): BrowserRuntimeStatus {
    return {
      isRunning: Boolean(this.process && !this.process.killed),
      cdpPort: this.cdpPort,
      profilePath: this.profilePath,
      astreaUrl: ASTREA_BASE_URL,
      error: this.lastError,
    };
  }

  async dispose(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = undefined;
    this.process?.kill();
    this.process = undefined;
  }

  private async connect(): Promise<void> {
    this.browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${this.cdpPort}`,
      { timeout: 10_000 },
    );
  }

  private async waitForCdp(): Promise<void> {
    const endpoint = `http://127.0.0.1:${this.cdpPort}/json/version`;
    const startedAt = Date.now();

    while (Date.now() - startedAt < 10_000) {
      try {
        const response = await fetch(endpoint);
        if (response.ok) return;
      } catch {
        // Chromium may still be starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Chromium inició pero CDP no respondió en ${endpoint}`);
  }

  private ensureProfileDirectory(): void {
    if (!existsSync(this.profilePath)) {
      mkdirSync(this.profilePath, { recursive: true });
    }
  }

  private getChromiumLaunchArgs(): string[] {
    const args = [
      `--remote-debugging-port=${this.cdpPort}`,
      `--user-data-dir=${this.profilePath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--disable-features=Translate,MediaRouter,OptimizationGuideModelDownloading",
      ASTREA_BASE_URL,
    ];

    if (process.platform === "darwin") {
      args.splice(args.length - 1, 0, "--window-size=1280,900");
    }

    return args;
  }

  private getChromiumExecutablePath(): string | undefined {
    const overridePath = process.env.ASTREA_CHROMIUM_PATH;
    if (overridePath && existsSync(overridePath)) return overridePath;

    for (const candidatePath of this.getChromeCandidatePaths()) {
      if (existsSync(candidatePath)) return candidatePath;
    }

    if (!app.isPackaged) {
      const playwrightChromiumPath = chromium.executablePath();
      if (existsSync(playwrightChromiumPath)) return playwrightChromiumPath;
    }

    return undefined;
  }

  private getChromeCandidatePaths(): string[] {
    if (process.platform === "win32") {
      return [
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
        process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
        process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Chromium", "Application", "chrome.exe"),
      ].filter((path): path is string => Boolean(path));
    }

    if (process.platform === "darwin") {
      return [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
      ];
    }

    return [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
  }
}

export const apiRuntimeStatus = {
  isRunning: false,
  port: DEFAULT_API_PORT,
  baseUrl: `http://127.0.0.1:${DEFAULT_API_PORT}`,
};

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ChildProcess, spawn } from "node:child_process";
import { chromium, type Browser } from "playwright";

const DEFAULT_CDP_PORT = 9222;
const ASTREA_BASE_URL = "https://astrea.camdp.org.ar";

type BrowserRuntimeMode = "unknown" | "visible-login" | "background-extraction";

export type ServerBrowserRuntimeStatus = {
  isRunning: boolean;
  mode: BrowserRuntimeMode;
  cdpPort: number;
  profilePath: string;
  astreaUrl: string;
  error?: string;
};

export class ServerBrowserController {
  private process?: ChildProcess;
  private browser?: Browser;
  private lastError?: string;
  private mode: BrowserRuntimeMode = "unknown";

  readonly cdpPort = Number(process.env.ASTREA_CDP_PORT ?? DEFAULT_CDP_PORT);
  readonly profilePath =
    process.env.ASTREA_PROFILE_PATH ?? join(tmpdir(), "astrea-extractor-profile");

  async ensureExtractionRuntime(): Promise<ServerBrowserRuntimeStatus> {
    try {
      this.ensureProfileDirectory();

      if (!this.process || this.process.killed) {
        const executablePath = this.getChromiumExecutablePath();
        if (!executablePath) {
          throw new Error(
            "No se encontró Google Chrome/Chromium instalado. Instalá Google Chrome o configurá ASTREA_CHROMIUM_PATH con la ruta del ejecutable.",
          );
        }

        this.spawnChromium(executablePath, this.getBackgroundExtractionLaunchArgs());
        this.mode = "background-extraction";
      }

      await this.waitForCdp();
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "No se pudo abrir Chromium para extracción.";
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

  getStatus(): ServerBrowserRuntimeStatus {
    return {
      isRunning: Boolean(this.process && !this.process.killed),
      mode: this.process && !this.process.killed ? this.mode : "unknown",
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
    this.mode = "unknown";
  }

  private spawnChromium(executablePath: string, args: string[]): void {
    this.process = spawn(executablePath, args, {
      detached: false,
      stdio: "ignore",
    });

    this.process.once("error", (error) => {
      this.lastError = error.message;
    });

    this.process.once("exit", () => {
      this.mode = "unknown";
      this.browser = undefined;
    });
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

  private getBaseChromiumLaunchArgs(): string[] {
    return [
      `--remote-debugging-port=${this.cdpPort}`,
      `--user-data-dir=${this.profilePath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "--disable-features=Translate,MediaRouter,OptimizationGuideModelDownloading",
    ];
  }

  private getBackgroundExtractionLaunchArgs(): string[] {
    const args = [
      ...this.getBaseChromiumLaunchArgs(),
      "--window-size=1280,900",
      "about:blank",
    ];

    if (process.platform === "darwin") {
      args.splice(args.length - 1, 0, "--window-position=-32000,-32000");
      args.splice(args.length - 1, 0, "--disable-backgrounding-occluded-windows");
    } else {
      args.splice(args.length - 1, 0, "--start-minimized");
    }

    return args;
  }

  private getChromiumExecutablePath(): string | undefined {
    const overridePath = process.env.ASTREA_CHROMIUM_PATH;
    if (overridePath && existsSync(overridePath)) return overridePath;

    for (const candidatePath of this.getChromeCandidatePaths()) {
      if (existsSync(candidatePath)) return candidatePath;
    }

    const playwrightChromiumPath = chromium.executablePath();
    if (existsSync(playwrightChromiumPath)) return playwrightChromiumPath;

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
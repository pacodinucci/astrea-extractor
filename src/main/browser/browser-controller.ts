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
type BrowserRuntimeMode = BrowserRuntimeStatus["mode"];

export class BrowserController {
  private process?: ChildProcess;
  private browser?: Browser;
  private lastError?: string;
  private mode: BrowserRuntimeMode = "unknown";
  private cdpKnownAvailable = false;
  private readonly configuredCdpPort = Number(process.env.ASTREA_CDP_PORT);

  readonly cdpPort = Number.isInteger(this.configuredCdpPort) && this.configuredCdpPort > 0
    ? this.configuredCdpPort
    : DEFAULT_CDP_PORT;
  readonly profilePath = join(app.getPath("userData"), "astrea-profile");

  async openAstrea(): Promise<BrowserRuntimeStatus> {
    try {
      this.ensureProfileDirectory();

      if (await this.isCdpResponsive()) {
        if (this.mode === "unknown") this.mode = "visible-login";
        this.lastError = undefined;
        return this.getStatus();
      }

      if (this.mode === "background-extraction" && this.isChromiumRunning()) {
        await this.stopChromium();
      }

      if (this.isChromiumRunning()) {
        throw new Error(
          `Chrome está abierto, pero CDP no responde en http://127.0.0.1:${this.cdpPort}/json/version. Cerrá esa ventana y abrí Astrea desde la app.`,
        );
      }

      const executablePath = this.getChromiumExecutablePath();
      if (!executablePath) {
        throw new Error(
          "No se encontró Google Chrome/Chromium instalado. Instalá Google Chrome o configurá ASTREA_CHROMIUM_PATH con la ruta del ejecutable.",
        );
      }

      this.spawnChromium(executablePath, this.getVisibleLoginLaunchArgs());
      this.mode = "visible-login";
      await this.waitForCdp();
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "No se pudo abrir Chromium.";
    }

    return this.getStatus();
  }

  async ensureExtractionRuntime(): Promise<BrowserRuntimeStatus> {
    try {
      this.ensureProfileDirectory();

      if (await this.isCdpResponsive()) {
        this.lastError = undefined;
        return this.getStatus();
      }

      if (this.isChromiumRunning()) {
        throw new Error(
          `Chrome está abierto, pero CDP no responde en http://127.0.0.1:${this.cdpPort}/json/version. Cerrá esa ventana y abrí Astrea desde la app.`,
        );
      }

      const executablePath = this.getChromiumExecutablePath();
      if (!executablePath) {
        throw new Error(
          "No se encontro Google Chrome/Chromium instalado. Instala Google Chrome o configura ASTREA_CHROMIUM_PATH con la ruta del ejecutable.",
        );
      }

      this.spawnChromium(executablePath, this.getBackgroundExtractionLaunchArgs());
      this.mode = "background-extraction";
      await this.waitForCdp();
      this.lastError = undefined;
    } catch (error) {
      this.lastError =
        error instanceof Error ? error.message : "No se pudo abrir Chromium para extraccion.";
      throw new Error(this.lastError);
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
    const isRunning = this.isChromiumRunning() || this.cdpKnownAvailable;

    return {
      isRunning,
      mode: isRunning ? this.mode : "unknown",
      cdpPort: this.cdpPort,
      profilePath: this.profilePath,
      astreaUrl: ASTREA_BASE_URL,
      error: this.lastError,
    };
  }

  async dispose(): Promise<void> {
    await this.stopChromium();
  }

  private isChromiumRunning(): boolean {
    return Boolean(this.process && !this.process.killed && this.process.exitCode === null);
  }

  private async stopChromium(): Promise<void> {
    this.browser = undefined;
    this.cdpKnownAvailable = false;

    const runningProcess = this.process;
    if (!runningProcess || runningProcess.exitCode !== null) {
      this.process = undefined;
      this.mode = "unknown";
      return;
    }

    const exited = new Promise<void>((resolve) => {
      runningProcess.once("exit", () => resolve());
    });

    runningProcess.kill();
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);

    if (this.process === runningProcess) {
      this.process = undefined;
    }
    this.mode = "unknown";
  }

  private spawnChromium(executablePath: string, args: string[]): void {
    this.cdpKnownAvailable = false;
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
      this.cdpKnownAvailable = false;
    });
  }

  private async connect(): Promise<void> {
    await this.waitForCdp();
    this.browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${this.cdpPort}`,
      { timeout: 10_000 },
    );
  }

  private async waitForCdp(): Promise<void> {
    const endpoint = this.getCdpVersionEndpoint();
    const startedAt = Date.now();

    while (Date.now() - startedAt < 20_000) {
      if (this.process?.exitCode !== null) {
        throw new Error("Chromium se cerró antes de habilitar CDP.");
      }

      if (await this.isCdpResponsive()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(`Chromium inició pero CDP no respondió en ${endpoint}`);
  }

  private async isCdpResponsive(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1_000);
      const response = await fetch(this.getCdpVersionEndpoint(), {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.cdpKnownAvailable = response.ok;
      return response.ok;
    } catch {
      this.cdpKnownAvailable = false;
      return false;
    }
  }

  private getCdpVersionEndpoint(): string {
    return `http://127.0.0.1:${this.cdpPort}/json/version`;
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

  private getVisibleLoginLaunchArgs(): string[] {
    const args = [...this.getBaseChromiumLaunchArgs(), ASTREA_BASE_URL];

    if (process.platform === "darwin") {
      args.splice(args.length - 1, 0, "--window-size=1280,900");
    }

    return args;
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

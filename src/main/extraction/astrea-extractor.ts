import type { Frame, Page } from "playwright";
import {
  ASTREA_BASE_URL,
  type ExtractionRequest,
  type OcrProvider,
  type OpenAiOcrModel,
} from "../../shared/extraction";
import type { BrowserController } from "../browser/browser-controller";
import type { OpenAiSettingsStore } from "../settings/openai-settings";
import type { PageExtractor } from "./types";

export class AstreaExtractor implements PageExtractor {
  private extractionPage?: Page;
  private extractionQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly browserController: BrowserController,
    private readonly openAiSettings: OpenAiSettingsStore,
  ) {}

  async resolveBookcode(request: ExtractionRequest): Promise<string> {
    if (request.bookcode) return request.bookcode;
    throw new Error(
      "El fallback por title todavÃ­a requiere desambiguaciÃ³n manual. EnviÃ¡ bookcode para el MVP.",
    );
  }

  async extractPage({
    bookcode,
    page,
    ocrProvider,
    openAiModel,
  }: {
    bookcode: string;
    page: number;
    attempt: number;
    ocrProvider?: OcrProvider;
    openAiModel?: OpenAiOcrModel;
  }) {
    return this.runExclusive(async () => {
      const tab = await this.getExtractionPage();
      const provider = ocrProvider ?? "openai";
      await this.openBookReader(tab, bookcode);
      const text = await this.extractPageFromOpenReader(
        tab,
        page,
        provider,
        openAiModel,
      );

      return {
        page,
        text,
        method: this.methodForProvider(),
      };
    });
  }

  async extractPages({
    bookcode,
    pages,
    maxAttempts,
    ocrProvider,
    openAiModel,
    onPageCompleted,
    onPageFailed,
  }: {
    bookcode: string;
    pages: number[];
    maxAttempts: number;
    ocrProvider?: OcrProvider;
    openAiModel?: OpenAiOcrModel;
    onPageCompleted?: (page: {
      page: number;
      text: string;
      method: ReturnType<AstreaExtractor["methodForProvider"]>;
      attempts: number;
      status: "completed";
    }) => void;
    onPageFailed?: (page: {
      page: number;
      attempts: number;
      code: "PAGE_EXTRACTION_FAILED";
      message: string;
    }) => void;
  }) {
    return this.runExclusive(async () => {
      const tab = await this.getExtractionPage();
      const provider = ocrProvider ?? "openai";
      const completedPages = [] as Array<{
        page: number;
        text: string;
        method: ReturnType<AstreaExtractor["methodForProvider"]>;
        attempts: number;
        status: "completed";
      }>;
      const failedPages = [] as Array<{
        page: number;
        attempts: number;
        code: "PAGE_EXTRACTION_FAILED";
        message: string;
      }>;

      await this.openBookReader(tab, bookcode);

      for (const page of pages) {
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            const text = await this.extractPageFromOpenReader(
              tab,
              page,
              provider,
              openAiModel,
            );

            const completedPage = {
              page,
              text,
              method: this.methodForProvider(),
              attempts: attempt,
              status: "completed" as const,
            };
            completedPages.push(completedPage);
            onPageCompleted?.(completedPage);
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            await this.recoverReaderAfterPageFailure(tab, bookcode).catch(() => undefined);
          }
        }

        if (lastError) {
          const failedPage = {
            page,
            attempts: maxAttempts,
            code: "PAGE_EXTRACTION_FAILED" as const,
            message:
              lastError instanceof Error
                ? lastError.message
                : `No se pudo extraer la pagina despues de ${maxAttempts} intentos.`,
          };
          failedPages.push(failedPage);
          onPageFailed?.(failedPage);
        }
      }

      return {
        pages: completedPages,
        failedPages,
      };
    });
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previousOperation = this.extractionQueue;
    let releaseQueue!: () => void;
    this.extractionQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousOperation.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseQueue();
    }
  }

  private async getExtractionPage(): Promise<Page> {
    await this.browserController.ensureExtractionRuntime();

    if (this.extractionPage && !this.extractionPage.isClosed()) {
      return this.extractionPage;
    }

    const browser = await this.browserController.getConnectedBrowser();
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const existingAstreaPage = await this.findExistingAstreaPage(context.pages());

    this.extractionPage = existingAstreaPage ?? await context.newPage();
    this.extractionPage.once("close", () => {
      this.extractionPage = undefined;
    });

    return this.extractionPage;
  }

  private async findExistingAstreaPage(pages: Page[]): Promise<Page | undefined> {
    const openPages = pages.filter((page) => !page.isClosed());
    const astreaPages = openPages.filter((page) => page.url().startsWith(ASTREA_BASE_URL));

    for (const page of astreaPages) {
      if (!(await this.isLoginPage(page))) return page;
    }

    return astreaPages[0] ?? openPages[0];
  }

  private async isLoginPage(page: Page): Promise<boolean> {
    const title = await page.title().catch(() => "");
    if (title.toLowerCase().includes("iniciar sesi")) return true;

    return page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const hasPasswordInput = Boolean(document.querySelector('input[type="password"]'));
      return hasPasswordInput || bodyText.includes("iniciar sesi") || bodyText.includes("login");
    }).catch(() => false);
  }

  private async openBookReader(page: Page, bookcode: string): Promise<void> {
    const isAlreadyOnReader = page.url().includes(`/reader/${bookcode}`);
    const hasReaderControls = isAlreadyOnReader
      ? await page.locator("input.select-pages").count().catch(() => 0)
      : 0;

    if (hasReaderControls) {
      await this.waitForReaderControls(page);
      return;
    }

    const openedFromUi = await this.openBookReaderFromAstreaUi(page, bookcode);
    if (!openedFromUi) {
      const diagnostics = await this.getReaderDiagnostics(page).catch(() => "Sin diagnostico");
      throw new Error(
        `No pude abrir el reader desde la interfaz de Astrea para el libro ${bookcode}. No voy a navegar directo al reader porque Astrea rebota ese flujo al login. Diagnostico: ${diagnostics}`,
      );
    }

    await this.waitForReaderControls(page);
  }

  private async openBookReaderFromAstreaUi(page: Page, bookcode: string): Promise<boolean> {
    if (await this.isLoginPage(page)) return false;

    await this.ensureAstreaCatalogPage(page);
    await this.searchBookInAstreaUi(page, bookcode);

    for (let step = 0; step < 3; step += 1) {
      if (page.url().includes("/reader/")) return true;

      const clicked = await this.clickReaderEntryForBook(page, bookcode);
      if (!clicked) return false;

      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
    }

    return page.url().includes("/reader/");
  }

  private async ensureAstreaCatalogPage(page: Page): Promise<void> {
    if (!page.url().startsWith(ASTREA_BASE_URL) || page.url().includes("/reader/")) {
      await page.goto(ASTREA_BASE_URL, { waitUntil: "domcontentloaded" });
    }
  }

  private async searchBookInAstreaUi(page: Page, bookcode: string): Promise<void> {
    const searchInput = page.locator('input:not([type="password"])').first();
    await searchInput.waitFor({ state: "visible", timeout: 15_000 });
    await searchInput.fill(bookcode);

    const searchButton = page.getByRole("button", { name: /buscar/i }).first();
    if (await searchButton.isVisible().catch(() => false)) {
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined),
        searchButton.click({ timeout: 10_000 }),
      ]);
    } else {
      await searchInput.press("Enter");
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    }

    await page.waitForTimeout(2_500);
  }

  private async clickReaderEntryForBook(page: Page, bookcode: string): Promise<boolean> {
    return page.evaluate((code) => {
      const isVisible = (element: HTMLElement) =>
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, [role="button"]'))
        .filter(isVisible)
        .map((element) => ({
          element,
          text: element.textContent?.toLowerCase() ?? "",
          href: element instanceof HTMLAnchorElement ? element.href : "",
        }));

      const readerCandidate = candidates.find(({ text, href }) =>
        href.includes(`/reader/${code}`) ||
        (href.includes("/reader/") && (text.includes(code) || document.body.innerText.includes(code))) ||
        (text.includes(code) && (text.includes("leer") || text.includes("reader") || text.includes("abrir") || text.includes("ver obra") || text.includes("obra")))
      ) ?? candidates.find(({ text, href }) =>
        href.includes("/reader/") || text.includes("leer") || text.includes("reader") || text.includes("abrir") || text.includes("ver obra") || text.includes("obra")
      );

      readerCandidate?.element.click();
      return Boolean(readerCandidate);
    }, bookcode);
  }

  private async recoverReaderAfterPageFailure(page: Page, bookcode: string): Promise<void> {
    if (page.isClosed()) {
      this.extractionPage = undefined;
      return;
    }

    await this.openBookReader(page, bookcode);
  }

  private async waitForReaderControls(page: Page): Promise<void> {
    await page.waitForFunction(
      () => {
        const bodyText = document.body.innerText.toLowerCase();
        const hasReaderControls = Boolean(document.querySelector("input.select-pages"));
        const hasVisiblePasswordInput = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'))
          .some((input) => Boolean(input.offsetWidth || input.offsetHeight || input.getClientRects().length));
        const hasReaderCanvas = document.querySelectorAll("canvas, .page, ngx-extended-pdf-viewer, pdf-viewer").length > 0;
        const isReaderUrl = location.pathname.includes("/reader/");

        return hasReaderControls || hasVisiblePasswordInput || hasReaderCanvas || isReaderUrl || bodyText.includes("iniciar sesi");
      },
      undefined,
      { timeout: 60_000 },
    );

    const hasReaderControls = await page.locator("input.select-pages").count();
    if (hasReaderControls) return;

    const isLogin = await this.isLoginPage(page);
    const diagnostics = await this.getReaderDiagnostics(page).catch(() => "Sin diagnostico");

    if (isLogin) {
      throw new Error(
        `Astrea esta mostrando la pantalla de login. Inicia sesion en el navegador Astrea visible y reintenta. Diagnostico: ${diagnostics}`,
      );
    }

    throw new Error(
      `Astrea abrio el reader, pero no encontre el control de paginas (input.select-pages). Puede haber cambiado la interfaz o la portada todavia no cargo el visor. Diagnostico: ${diagnostics}`,
    );
  }

  private async extractPageFromOpenReader(
    page: Page,
    requestedPage: number,
    ocrProvider: OcrProvider,
    openAiModel?: OpenAiOcrModel,
  ): Promise<string> {
    await this.waitForReaderControls(page);

    await page.evaluate((targetPage) => {
      const input = document.querySelector<HTMLInputElement>("input.select-pages");
      if (!input) throw new Error("No existe input.select-pages");

      input.focus();
      input.value = String(targetPage);
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(targetPage) }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
    }, requestedPage);

    const goButton = page.locator("button.btn-form-pages").first();
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("/api/files/book/resources/reader/pages"),
        { timeout: 15_000 },
      ).catch(() => undefined),
      goButton.click({ timeout: 10_000, force: true }),
    ]);

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(
      () => undefined,
    );
    await page.waitForTimeout(1_500);
    await this.waitForReaderTextLayer(page);

    const text = await this.extractOcrTextFromReader(page, ocrProvider, openAiModel);

    if (!text) {
      throw new Error(
        `La pagina ${requestedPage} se abrio en el reader, pero la capa de texto esta vacia.`,
      );
    }

    return text;
  }

  private async waitForReaderTextLayer(page: Page): Promise<void> {
    const deadline = Date.now() + 60_000;
    let lastFrameUrls = "";

    while (Date.now() < deadline) {
      const frames = page.frames();
      lastFrameUrls = frames.map((frame) => frame.url()).join(" | ");

      for (const frame of frames) {
        const text = await this.extractVisibleTextLayer(frame).catch(() => "");
        if (text.replace(/\s+/g, "").length >= 10) {
          await page.waitForTimeout(750);
          return;
        }
      }

      await page.waitForTimeout(500);
    }

    const diagnostics = await this.getReaderDiagnostics(page).catch(
      (error: unknown) =>
        error instanceof Error ? error.message : "No se pudieron obtener diagnósticos",
    );

    throw new Error(
      `La página se abrió, pero el texto del PDF no apareció sobre el reader antes del timeout. Frames revisados: ${lastFrameUrls}. Diagnóstico: ${diagnostics}`,
    );
  }

  private async extractOcrTextFromReader(
    page: Page,
    _provider: OcrProvider,
    openAiModel?: OpenAiOcrModel,
  ): Promise<string> {
    const image = await this.captureReaderPageImage(page);
    const text = (
      await this.runOpenAiOcr(image, openAiModel ?? this.openAiSettings.getModel())
    ).trim();

    if (!text) {
      throw new Error(
        "OpenAI no encontr? texto en la captura de la p?gina del reader.",
      );
    }

    return text;
  }

  private async runOpenAiOcr(image: Buffer, model: OpenAiOcrModel): Promise<string> {
    const apiKey = this.openAiSettings.getApiKey();
    const prompt =
      "Transcribe exactly the visible text in this image. " +
      "Do not correct, complete, infer, summarize, or explain. " +
      "Preserve visible line breaks when possible. " +
      "If text is unclear, write [ilegible]. " +
      "Return only the transcription.";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: "none" },
        max_output_tokens: 4096,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:image/png;base64,${image.toString("base64")}`,
              },
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(
        `OpenAI API fall? (${response.status}): ${payload.error?.message ?? JSON.stringify(payload).slice(0, 1000)}`,
      );
    }

    return payload.output_text ?? this.extractResponsesText(payload);
  }

  private extractResponsesText(payload: {
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  }): string {
    return (payload.output ?? [])
      .flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  private methodForProvider() {
    return "ocr_openai" as const;
  }

  private async captureReaderPageImage(page: Page): Promise<Buffer> {
    await page.waitForFunction(
      () => {
        const hasVisibleContent = (canvas: HTMLCanvasElement) => {
          const rect = canvas.getBoundingClientRect();
          if (rect.width <= 100 || rect.height <= 100 || canvas.width <= 500 || canvas.height <= 500) {
            return false;
          }

          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return false;

          const sampleWidth = Math.min(canvas.width, 240);
          const sampleHeight = Math.min(canvas.height, 240);
          const sampleX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
          const sampleY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
          const pixels = context.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;

          let inkPixels = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index] ?? 255;
            const green = pixels[index + 1] ?? 255;
            const blue = pixels[index + 2] ?? 255;
            const alpha = pixels[index + 3] ?? 0;
            if (alpha > 20 && (red < 245 || green < 245 || blue < 245)) {
              inkPixels += 1;
              if (inkPixels > 80) return true;
            }
          }

          return false;
        };

        return Array.from(document.querySelectorAll<HTMLCanvasElement>(".page canvas, canvas"))
          .some((canvas) => {
            try {
              return hasVisibleContent(canvas);
            } catch {
              return false;
            }
          });
      },
      undefined,
      { timeout: 45_000 },
    );

    const dataUrl = await page.evaluate(() => {
      const getInkScore = (canvas: HTMLCanvasElement) => {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return 0;

        const sampleWidth = Math.min(canvas.width, 300);
        const sampleHeight = Math.min(canvas.height, 300);
        const sampleX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
        const sampleY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
        const pixels = context.getImageData(sampleX, sampleY, sampleWidth, sampleHeight).data;

        let score = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] ?? 255;
          const green = pixels[index + 1] ?? 255;
          const blue = pixels[index + 2] ?? 255;
          const alpha = pixels[index + 3] ?? 0;
          if (alpha > 20 && (red < 245 || green < 245 || blue < 245)) score += 1;
        }
        return score;
      };

      const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(".page canvas, canvas"))
        .map((canvas) => {
          const rect = canvas.getBoundingClientRect();
          let inkScore = 0;
          try {
            inkScore = getInkScore(canvas);
          } catch {
            inkScore = 0;
          }

          return {
            canvas,
            area: canvas.width * canvas.height,
            inkScore,
            visible: rect.width > 100 && rect.height > 100,
          };
        })
        .filter(({ canvas, visible, inkScore }) => visible && inkScore > 80 && canvas.width > 500 && canvas.height > 500)
        .sort((a, b) => b.inkScore - a.inkScore || b.area - a.area);

      const canvas = canvases[0]?.canvas;
      if (!canvas) return "";

      return canvas.toDataURL("image/png");
    });

    if (!dataUrl.startsWith("data:image/png;base64,")) {
      const diagnostics = await this.getReaderDiagnostics(page).catch(() => "Sin diagnÃ³stico");
      throw new Error(`No pude obtener una imagen PNG con contenido visible desde el canvas del reader. DiagnÃ³stico: ${diagnostics}`);
    }

    return Buffer.from(dataUrl.split(",")[1], "base64");
  }

  private cleanupOcrText(text: string): string {
    const fixLine = (line: string) =>
      line
        .replace(/\s+/g, " ")
        .replace(/T\s*[???]\s*TULO\s*PRIMERO/gi, "T\u00cdTULO PRIMERO")
        .replace(/TiTULOPRIMERO|TITULOPRIMERO/gi, "T\u00cdTULO PRIMERO")
        .replace(/PARTEGENERAL/g, "PARTE GENERAL")
        .replace(/CAP\s*[???]\s*TULO\s*PRIMERO/gi, "CAP\u00cdTULO PRIMERO")
        .replace(/CAPITULOPRIMERO/gi, "CAP\u00cdTULO PRIMERO")
        .replace(/Art\s*[???]\s*culo\s*1[???*??]*/gi, "Art\u00edculo 1\u00ba")
        .replace(/Articulo\s*1[???*??]*/gi, "Art\u00edculo 1\u00ba")
        .replace(/[????]*\[\s*PRINCIPIOS\s*DEL\s*PROCEDIMIENTO\s*\][???\s]*/gi, "[Principios del procedimiento] ")
        .replace(/[????]*\[\s*PRINCIPIOSDELPROCEDIMIENTO\s*\][???\s]*/gi, "[Principios del procedimiento] ")
        .replace(/PRINCIPIOSDELPROCEDIMIENTO/gi, "Principios del procedimiento")
        .replace(/\]\s*[-?]\s*/g, "] ? ")
        .replace(/\]\s*(?=El\b)/g, "] ? ")
        .replace(/\s+([,.;:!?%)\]])/g, "$1")
        .replace(/([,.;:!?])(?=\S)/g, "$1 ")
        .replace(/\bC6\s*-?\s*digo\b/gi, "C\u00f3digo")
        .replace(/\bambito\b/gi, "\u00e1mbito")
        .replace(/\?mbito\b/gi, "\u00e1mbito")
        .replace(/\bAutonoma\b/g, "Aut\u00f3noma")
        .replace(/Aut\?noma\b/g, "Aut\u00f3noma")
        .replace(/\bconcentracion\b/gi, "concentraci\u00f3n")
        .replace(/concentraci\?n\b/gi, "concentraci\u00f3n")
        .replace(/\bdigitalizacion\b/gi, "digitalizaci\u00f3n")
        .replace(/digitalizaci\?n\b/gi, "digitalizaci\u00f3n")
        .replace(/\breglamentacion\b/gi, "reglamentaci\u00f3n")
        .replace(/reglamentaci\?n\b/gi, "reglamentaci\u00f3n")
        .replace(/\bconciliacion\b/gi, "conciliaci\u00f3n")
        .replace(/conciliaci\?n\b/gi, "conciliaci\u00f3n")
        .replace(/\binmediacion\b/gi, "inmediaci\u00f3n")
        .replace(/inmediaci\?n\b/gi, "inmediaci\u00f3n")
        .replace(/\brealizacion\b/gi, "realizaci\u00f3n")
        .replace(/realizaci\?n\b/gi, "realizaci\u00f3n")
        .replace(/\bCodigo\b/g, "C\u00f3digo")
        .replace(/\bprincipios oralidad\b/gi, "principios de oralidad")
        .replace(/\by(?=sus\b|actos\b|realizaci\u00f3n\b|realizacion\b|virtua\b|efectividad\b)/gi, "y ")
        .replace(/\bde(?=las\b|la\b|los\b|Buenos\b)/g, "de ")
        .replace(/\bconforme(?=lo\b)/gi, "conforme ")
        .replace(/disponenlos/gi, "disponen los")
        .replace(/\s+/g, " ")
        .trim();

    return text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/-\n(?=\p{Ll})/gu, "")
      .split("\n")
      .map((line) => fixLine(line.trim()))
      .filter(Boolean)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }


  private async extractCleanTextFromAnyFrame(page: Page): Promise<string> {
    const deadline = Date.now() + 30_000;
    let lastFrameUrls = "";

    while (Date.now() < deadline) {
      const frames = page.frames();
      lastFrameUrls = frames.map((frame) => frame.url()).join(" | ");

      for (const frame of frames) {
        const pdfText = await this.extractPdfJsText(frame).catch(() => "");
        if (pdfText) return this.cleanupExtractedText(pdfText);

        const layerText = await this.extractVisibleTextLayer(frame).catch(
          () => "",
        );
        if (layerText) return this.cleanupExtractedText(layerText);
      }

      await page.waitForTimeout(500);
    }

    const diagnostics = await this.getReaderDiagnostics(page).catch(
      (error: unknown) =>
        error instanceof Error ? error.message : "No se pudieron obtener diagn?sticos",
    );

    throw new Error(
      `No encontr? texto extra?ble en el reader. Frames revisados: ${lastFrameUrls}. Diagn?stico: ${diagnostics}`,
    );
  }

  private async extractPdfJsText(frame: Frame): Promise<string> {
    return frame.evaluate(async () => {
      type TextItem = {
        str?: string;
        width?: number;
        transform?: number[];
      };
      type TextContent = { items?: TextItem[] };
      type PdfPage = { getTextContent: () => Promise<TextContent> };
      type PdfDocument = { getPage: (pageNumber: number) => Promise<PdfPage> };
      type PdfJsApp = {
        page?: number;
        pdfDocument?: PdfDocument;
        pdfViewer?: {
          currentPageNumber?: number;
          pdfDocument?: PdfDocument;
        };
      };

      const app = (globalThis as { PDFViewerApplication?: PdfJsApp })
        .PDFViewerApplication;
      const pdfDocument = app?.pdfDocument ?? app?.pdfViewer?.pdfDocument;
      const pageNumber =
        app?.pdfViewer?.currentPageNumber ??
        app?.page ??
        Number(document.querySelector<HTMLInputElement>("#pageNumber")?.value);

      if (!pdfDocument || !Number.isFinite(pageNumber) || pageNumber < 1) {
        return "";
      }

      const pdfPage = await pdfDocument.getPage(pageNumber);
      const textContent = await pdfPage.getTextContent();
      const items = (textContent.items ?? [])
        .map((item) => ({
          text: (item.str ?? "").trim(),
          x: item.transform?.[4] ?? 0,
          y: item.transform?.[5] ?? 0,
          width: item.width ?? 0,
        }))
        .filter((item) => item.text.length > 0);

      if (!items.length) return "";

      items.sort((a, b) => {
        const yDiff = b.y - a.y;
        if (Math.abs(yDiff) > 2) return yDiff;
        return a.x - b.x;
      });

      const lines: Array<typeof items> = [];
      for (const item of items) {
        const currentLine = lines[lines.length - 1];
        const previous = currentLine?.[0];

        if (!currentLine || !previous || Math.abs(previous.y - item.y) > 2) {
          lines.push([item]);
        } else {
          currentLine.push(item);
        }
      }

      const shouldJoinWithoutSpace = (previous: string, next: string) =>
        previous.endsWith("-") ||
        /^[,.;:!?%)\]]/.test(next) ||
        /^[-??]/.test(next);

      return lines
        .map((line) =>
          line
            .sort((a, b) => a.x - b.x)
            .reduce((acc, item, index, sortedLine) => {
              if (!acc) return item.text;

              const previous = sortedLine[index - 1];
              const gap = item.x - (previous.x + previous.width);
              const separator =
                shouldJoinWithoutSpace(acc, item.text) || gap < 1 ? "" : " ";

              return `${acc}${separator}${item.text}`;
            }, ""),
        )
        .join("\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    });
  }

  private cleanupExtractedText(text: string): string {
    const normalizeLine = (line: string) =>
      line
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const comparable = (line: string) =>
      normalizeLine(line)
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}/]+/gu, "");
    const isSingleLetter = (value: string) => /^[A-Za-z??????????????]$/u.test(value);
    const startsWithLowercase = (value: string) => /^[a-z???????]/u.test(value);
    const startsWithSameLetter = (letter: string, value: string) =>
      comparable(value).startsWith(comparable(letter));
    const cleanupLineArtifacts = (line: string) => {
      const normalized = normalizeLine(line)
        .replace(/^\[\[\s*/, "[")
        .replace(/\]\s*\?\s*\?\s*[?-]/g, "] ?")
        .replace(/\?\s*\?\s*[?-]/g, "?");
      const tokens = normalized.split(" ").filter(Boolean);
      const mergedTokens: string[] = [];

      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const next = tokens[i + 1];
        const previous = mergedTokens[mergedTokens.length - 1];

        if (isSingleLetter(token) && next && startsWithLowercase(next)) {
          mergedTokens.push(`${token}${next}`);
          i += 1;
          continue;
        }

        if (isSingleLetter(token) && next && startsWithSameLetter(token, next)) {
          continue;
        }

        if (previous) {
          const previousKey = comparable(previous);
          const tokenKey = comparable(token);
          if (previousKey === tokenKey || previousKey.endsWith(tokenKey)) {
            continue;
          }
        }

        mergedTokens.push(token);
      }

      return mergedTokens
        .join(" ")
        .replace(/\[\s+/g, "[")
        .replace(/\s+\]/g, "]")
        .replace(/\]\s*[??]+\s*[?-]/g, "] ?")
        .replace(/\s+([,.;:!?%)\]])/g, "$1")
        .trim();
    };

    const rawLines = text
      .split(/\r?\n/)
      .map(cleanupLineArtifacts)
      .filter(Boolean);
    const merged: string[] = [];

    for (let i = 0; i < rawLines.length; i += 1) {
      const line = rawLines[i];
      const next = rawLines[i + 1];
      const previous = merged[merged.length - 1];

      if (previous === line) continue;

      if (previous && (line === "?" || line === "?")) {
        merged[merged.length - 1] = `${previous}?`;
        continue;
      }

      if (isSingleLetter(line) && next && startsWithLowercase(next)) {
        merged.push(`${line}${next}`);
        i += 1;
        continue;
      }

      if (line === "[" && next) {
        const parts: string[] = [];
        let consumed = 0;
        for (let j = i + 1; j < rawLines.length; j += 1) {
          consumed += 1;
          const value = rawLines[j];
          if (value.startsWith("]")) {
            const suffix = value.slice(1).trim();
            merged.push(`[${cleanupLineArtifacts(parts.join(" "))}]${suffix ? ` ${suffix}` : ""}`);
            i += consumed;
            break;
          }
          parts.push(value);
        }
        if (i + consumed >= rawLines.length) merged.push(line);
        continue;
      }

      merged.push(line);
    }

    const cleaned: string[] = [];
    for (let i = 0; i < merged.length; i += 1) {
      const line = cleanupLineArtifacts(merged[i]);
      const previous = cleaned[cleaned.length - 1];
      if (previous === line) continue;
      if (previous && line.startsWith("]") && comparable(previous).includes(comparable(line))) continue;

      const lineKey = comparable(line);
      let duplicateKey = "";
      let duplicateEnd = i;
      let matchedPrefix = false;

      for (let j = i + 1; j < merged.length; j += 1) {
        const candidate = cleanupLineArtifacts(merged[j]);
        if (candidate.includes(" ") && duplicateKey.length > 0) break;

        const nextKey = duplicateKey + comparable(candidate);
        if (!lineKey.startsWith(nextKey)) break;

        duplicateKey = nextKey;
        duplicateEnd = j;
        matchedPrefix = true;
        if (duplicateKey === lineKey) break;
      }

      cleaned.push(line);
      const enoughDuplicate = duplicateKey.length >= Math.min(lineKey.length, Math.max(8, Math.floor(lineKey.length * 0.6)));
      if (duplicateEnd > i && matchedPrefix && enoughDuplicate) {
        i = duplicateEnd;
      }
    }

    return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  private async extractTextLayerFromAnyFrame(page: Page): Promise<string> {
    const deadline = Date.now() + 30_000;
    let lastFrameUrls = "";

    while (Date.now() < deadline) {
      const frames = page.frames();
      lastFrameUrls = frames.map((frame) => frame.url()).join(" | ");

      for (const frame of frames) {
        const text = await this.extractVisibleTextLayer(frame).catch(
          () => "",
        );

        if (text) return text;
      }

      await page.waitForTimeout(500);
    }

    const diagnostics = await this.getReaderDiagnostics(page).catch(
      (error: unknown) =>
        error instanceof Error ? error.message : "No se pudieron obtener diagn?sticos",
    );

    throw new Error(
      `No encontr? texto extra?ble en la capa de texto del reader. Frames revisados: ${lastFrameUrls}. Diagn?stico: ${diagnostics}`,
    );
  }

  private async getReaderDiagnostics(page: Page): Promise<string> {
    return page.evaluate(() => {
      const selectors = [
        ".textLayer",
        ".textLayer span",
        "canvas",
        ".page",
        "ngx-extended-pdf-viewer",
        "pdf-viewer",
        "input",
        "button",
        "a",
        "[class*=text]",
        "[class*=page]",
      ];

      const counts = Object.fromEntries(
        selectors.map((selector) => [selector, document.querySelectorAll(selector).length]),
      );

      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
        .slice(0, 10)
        .map((input) => ({
          value: input.type === "password" || input.type === "email" ? "[redacted]" : input.value ? "[present]" : "",
          placeholder: input.placeholder,
          type: input.type,
          id: input.id,
          name: input.name,
          className: input.className,
        }));

      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .slice(0, 30)
        .map((button) => ({
          text: button.textContent?.trim(),
          title: button.title,
          ariaLabel: button.getAttribute("aria-label"),
          id: button.id,
          className: button.className,
          visible: Boolean(button.offsetWidth || button.offsetHeight || button.getClientRects().length),
        }));

      const pageLike = Array.from(document.querySelectorAll<HTMLElement>("[class*=page], [id*=page]"))
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName,
          id: element.id,
          className: String(element.className),
          text: element.textContent?.trim().slice(0, 120),
          dataset: { ...element.dataset },
        }));

      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))
        .slice(0, 40)
        .map((link) => ({
          text: link.textContent?.trim().slice(0, 160),
          href: link.href,
          visible: Boolean(link.offsetWidth || link.offsetHeight || link.getClientRects().length),
        }));

      const resultLike = Array.from(document.querySelectorAll<HTMLElement>("[class*=result], [class*=book], [class*=obra], [class*=card], mat-card"))
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName,
          className: String(element.className),
          text: element.textContent?.trim().slice(0, 240),
        }));

      return JSON.stringify({
        url: location.href,
        title: document.title,
        counts,
        inputs,
        buttons,
        links,
        resultLike,
        pageLike,
        bodyText: document.body.innerText.replace(/[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]").slice(0, 1000),
      }).slice(0, 9000);
    });
  }


  private async extractVisibleTextLayer(frame: Frame): Promise<string> {
    return frame.evaluate(() => {
      const normalize = (value: string) =>
        value
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

      const pages = Array.from(document.querySelectorAll<HTMLElement>(".page"));
      const viewportHeight = window.innerHeight;

      const visiblePage =
        pages
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const visibleHeight =
              Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);

            return { element, visibleHeight };
          })
          .filter(({ visibleHeight }) => visibleHeight > 0)
          .sort((a, b) => b.visibleHeight - a.visibleHeight)[0]?.element ??
        document.body;

      const spans = Array.from(
        visiblePage.querySelectorAll<HTMLElement>(".textLayer span"),
      );
      const spanText = normalize(
        spans.map((span) => span.textContent ?? "").join("\n"),
      );

      if (spanText) return spanText;

      const textLayers = Array.from(
        visiblePage.querySelectorAll<HTMLElement>(".textLayer"),
      );
      return normalize(
        textLayers.map((layer) => layer.innerText || layer.textContent || "").join("\n"),
      );
    });
  }
}




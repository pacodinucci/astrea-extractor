import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  PlayIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { OPENAI_OCR_MODELS, parsePageSelection, type ExtractionJob, type OpenAiOcrModel } from "@shared/extraction";
import type { ApiRuntimeStatus, BrowserRuntimeStatus, OpenAiSettingsStatus } from "@shared/ipc";

const API_BASE = "http://127.0.0.1:4317";

type RuntimeState = {
  api?: ApiRuntimeStatus;
  browser?: BrowserRuntimeStatus;
};

function statusVariant(status?: ExtractionJob["status"]) {
  if (status === "completed") return "default";
  if (status === "completed_with_errors") return "outline";
  if (status === "failed") return "destructive";
  return "secondary";
}

export function App() {
  const [runtime, setRuntime] = useState<RuntimeState>({});
  const [bookcode, setBookcode] = useState("");
  const [title, setTitle] = useState("");
  const [pagesInput, setPagesInput] = useState("1");
  const [openAiApiKeyInput, setOpenAiApiKeyInput] = useState("");
  const [openAiSettings, setOpenAiSettings] = useState<OpenAiSettingsStatus>();
  const [openAiModel, setOpenAiModel] = useState<OpenAiOcrModel>("gpt-5.6-terra");
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>();
  const [error, setError] = useState<string>();

  const selectedJob = jobs.find((job) => job.jobId === selectedJobId);
  const parsedPages = useMemo(() => parsePageSelection(pagesInput), [pagesInput]);

  const refreshRuntime = useCallback(async () => {
    if (!window.astrea) {
      setError("El preload de Electron no est? disponible. Reinici? la app.");
      return;
    }

    const health = await window.astrea.health();
    setRuntime(health);
  }, []);

  const refreshOpenAiSettings = useCallback(async () => {
    if (!window.astrea) return;
    const settings = await window.astrea.openAiSettingsStatus();
    setOpenAiSettings(settings);
    setOpenAiModel(settings.model);
  }, []);

  const refreshJob = useCallback(async (jobId: string) => {
    const response = await fetch(`${API_BASE}/extract/${jobId}`);
    if (!response.ok) return;
    const job = (await response.json()) as ExtractionJob;
    setJobs((current) => {
      const rest = current.filter((item) => item.jobId !== job.jobId);
      return [job, ...rest].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
    });
  }, []);

  useEffect(() => {
    void refreshRuntime();
    void refreshOpenAiSettings();
    const runtimeTimer = window.setInterval(() => void refreshRuntime(), 3_000);
    return () => window.clearInterval(runtimeTimer);
  }, [refreshRuntime, refreshOpenAiSettings]);

  useEffect(() => {
    const activeJobs = jobs.filter(
      (job) => job.status === "queued" || job.status === "processing",
    );
    if (!activeJobs.length) return;

    const timer = window.setInterval(() => {
      activeJobs.forEach((job) => void refreshJob(job.jobId));
    }, 1_500);

    return () => window.clearInterval(timer);
  }, [jobs, refreshJob]);

  async function openBrowser() {
    setError(undefined);

    if (!window.astrea) {
      setError("El preload de Electron no est? disponible. Reinici? la app.");
      return;
    }

    const status = await window.astrea.openBrowser();
    if (status.error) {
      setError(status.error);
    }
    setRuntime((current) => ({ ...current, browser: status }));
  }

  async function saveOpenAiApiKey() {
    setError(undefined);

    if (!openAiApiKeyInput.trim()) {
      setError("Peg? una API key de OpenAI antes de guardar.");
      return;
    }

    try {
      const settings = await window.astrea.saveOpenAiApiKey(openAiApiKeyInput);
      setOpenAiSettings(settings);
      setOpenAiApiKeyInput("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar la API key de OpenAI.");
    }
  }

  async function clearOpenAiApiKey() {
    setError(undefined);

    try {
      const settings = await window.astrea.clearOpenAiApiKey();
      setOpenAiSettings(settings);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo borrar la API key de OpenAI.");
    }
  }

  async function changeOpenAiModel(model: OpenAiOcrModel) {
    setOpenAiModel(model);

    try {
      const settings = await window.astrea.saveOpenAiModel(model);
      setOpenAiSettings(settings);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar el modelo de OpenAI.");
    }
  }

  async function createExtraction() {
    setError(undefined);

    if (!bookcode.trim() && !title.trim()) {
      setError("Tenés que indicar bookcode o título.");
      return;
    }

    if (!parsedPages.length) {
      setError("Indicá páginas como lista separada por comas.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookcode: bookcode.trim() || undefined,
          title: title.trim() || undefined,
          pages: parsedPages,
          ocrProvider: "openai",
          openAiModel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No se pudo crear la extraccion.");
        return;
      }

      await refreshJob(payload.jobId);
      setSelectedJobId(payload.jobId);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con la API local.",
      );
    }
  }

  async function copyCombinedText() {
    if (!selectedJob?.combinedText) return;
    await navigator.clipboard.writeText(selectedJob.combinedText);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Astrea Extractor</p>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Panel local de extracción
              </h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Claude llama a la API local; esta app usa Chromium administrado
                con la sesión viva de Astrea para extraer texto por páginas.
              </p>
            </div>
            <Button variant="outline" onClick={() => void refreshRuntime()}>
              <RefreshCwIcon data-icon="inline-start" />
              Refrescar
            </Button>
          </div>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard
            title="API local"
            description={runtime.api?.baseUrl ?? API_BASE}
            ok={Boolean(runtime.api?.isRunning)}
          />
          <StatusCard
            title="Chromium"
            description={`CDP ${runtime.browser?.cdpPort ?? 9222}`}
            ok={Boolean(runtime.browser?.isRunning)}
          />
          <StatusCard
            title="Perfil Astrea"
            description={runtime.browser?.profilePath ?? "Sin inicializar"}
            ok={Boolean(runtime.browser?.profilePath)}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Control manual</CardTitle>
              <CardDescription>
                Abrí Astrea, logueate y probá extracciones sin depender de
                Claude.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <Button onClick={() => void openBrowser()}>
                <ExternalLinkIcon data-icon="inline-start" />
                Abrir navegador Astrea
              </Button>

              <Separator />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="bookcode">Bookcode</FieldLabel>
                  <Input
                    id="bookcode"
                    value={bookcode}
                    onChange={(event) => setBookcode(event.target.value)}
                    placeholder="00119000"
                  />
                  <FieldDescription>
                    Preferido. Si no está, se puede enviar título, pero para el
                    MVP conviene bookcode.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="title">Título fallback</FieldLabel>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Derecho societario en transición"
                  />
                </Field>

                <Field data-invalid={!parsedPages.length}>
                  <FieldLabel htmlFor="pages">Páginas del reader</FieldLabel>
                  <Input
                    id="pages"
                    value={pagesInput}
                    onChange={(event) => setPagesInput(event.target.value)}
                    placeholder="45,46,47"
                    aria-invalid={!parsedPages.length}
                  />
                  <FieldDescription>
                    Lista separada por comas. Usá rangos como (4-8),15. Máximo 250 páginas.
                  </FieldDescription>
                  {!parsedPages.length && (
                    <FieldError>Indicá al menos una página válida.</FieldError>
                  )}
                </Field>

                <Separator />

                <Field>
                  <FieldLabel htmlFor="openAiApiKey">API key OpenAI</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="openAiApiKey"
                      type="password"
                      value={openAiApiKeyInput}
                      onChange={(event) => setOpenAiApiKeyInput(event.target.value)}
                      placeholder="sk-..."
                    />
                    <Button variant="outline" onClick={() => void saveOpenAiApiKey()}>
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={() => void clearOpenAiApiKey()}>
                      Borrar
                    </Button>
                  </div>
                  <FieldDescription>
                    Estado: {openAiSettings?.hasApiKey ? "configurada" : "no configurada"}. La key se guarda cifrada en Electron main.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="openAiModel">Modelo OpenAI</FieldLabel>
                  <select
                    id="openAiModel"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    value={openAiModel}
                    onChange={(event) => void changeOpenAiModel(event.target.value as OpenAiOcrModel)}
                  >
                    {OPENAI_OCR_MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <FieldDescription>
                    Terra es el default; Sol prioriza calidad; Luna prioriza costo.
                  </FieldDescription>
                </Field>


                <Button onClick={() => void createExtraction()}>
                  <PlayIcon data-icon="inline-start" />
                  Crear extracción
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jobs</CardTitle>
              <CardDescription>
                Los resultados viven solo en memoria mientras la app está
                abierta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Progreso</TableHead>
                    <TableHead>Libro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow
                      key={job.jobId}
                      className="cursor-pointer"
                      onClick={() => setSelectedJobId(job.jobId)}
                    >
                      <TableCell className="font-mono text-xs">
                        {job.jobId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(job.status)}>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Progress
                            value={
                              ((job.progress.completed + job.progress.failed) /
                                job.progress.total) *
                              100
                            }
                          />
                          <span className="text-xs text-muted-foreground">
                            {job.progress.completed}/{job.progress.total}
                            {job.progress.failed > 0 &&
                              ` - ${job.progress.failed} fallida(s)`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{job.bookcode ?? job.title}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {selectedJob && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <CardTitle>Resultado {selectedJob.jobId}</CardTitle>
                  <CardDescription>
                    {selectedJob.status === "failed"
                      ? selectedJob.error?.message ?? "No se pudo extraer ninguna pagina."
                      : selectedJob.status === "completed_with_errors"
                        ? `Texto parcial: ${selectedJob.progress.failed} pagina(s) no se pudieron extraer.`
                        : "Texto por pagina y texto combinado para Claude."}
                  </CardDescription>
                </div>
                <Badge variant={statusVariant(selectedJob.status)}>
                  {selectedJob.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="combined">
                <TabsList>
                  <TabsTrigger value="combined">Texto combinado</TabsTrigger>
                  <TabsTrigger value="pages">Por página</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="combined" className="flex flex-col gap-3">
                  {selectedJob.failedPages.length > 0 && (
                    <Alert>
                      <AlertCircleIcon />
                      <AlertTitle>Extraccion parcial</AlertTitle>
                      <AlertDescription>
                        No se pudieron extraer las paginas {selectedJob.failedPages.map((page) => page.page).join(", ")}.
                        El texto combinado incluye solo las paginas exitosas.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    variant="outline"
                    disabled={!selectedJob.combinedText}
                    onClick={() => void copyCombinedText()}
                  >
                    <CopyIcon data-icon="inline-start" />
                    Copiar texto combinado
                  </Button>
                  <Textarea
                    readOnly
                    className="min-h-80 font-mono text-xs"
                    value={selectedJob.combinedText ?? ""}
                  />
                </TabsContent>
                <TabsContent value="pages">
                  <ScrollArea className="h-96 rounded-md border">
                    <div className="flex flex-col gap-4 p-4">
                      {selectedJob.pages.map((page) => (
                        <article key={`completed-${page.page}`} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Página {page.page}</Badge>
                            <Badge variant="outline">{page.method}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {page.attempts} intento(s)
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                            {page.text}
                          </pre>
                        </article>
                      ))}
                      {selectedJob.failedPages.map((page) => (
                        <article key={`failed-${page.page}`} className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">Pagina {page.page}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {page.attempts} intento(s)
                            </span>
                          </div>
                          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                            {page.message}
                          </pre>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="json">
                  <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
                    {JSON.stringify(selectedJob, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  title,
  description,
  ok,
}: {
  title: string;
  description: string;
  ok: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="truncate font-mono text-xs">
            {description}
          </CardDescription>
        </div>
        {ok ? (
          <CheckCircle2Icon className="text-muted-foreground" />
        ) : (
          <AlertCircleIcon className="text-muted-foreground" />
        )}
      </CardHeader>
    </Card>
  );
}

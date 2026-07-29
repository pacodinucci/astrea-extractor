import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_API_PORT } from "../../shared/extraction";
import type { ApiRuntimeStatus } from "../../shared/ipc";
import type { BrowserController } from "../browser/browser-controller";
import type { JobManager } from "../extraction/job-manager";
import { parseExtractionRequest } from "../extraction/validation";

export class LocalApiServer {
  private server?: FastifyInstance;
  private isRunning = false;

  constructor(
    private readonly browserController: BrowserController,
    private readonly jobManager: JobManager,
    private readonly port = DEFAULT_API_PORT,
  ) {}

  async start(): Promise<void> {
    if (this.server) return;

    const server = Fastify({ logger: false });

    await server.register(cors, {
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST", "OPTIONS"],
    });

    server.get("/health", async () => ({
      ok: true,
      api: this.getStatus(),
      browser: this.browserController.getStatus(),
    }));

    server.post("/browser/open", async () => this.browserController.openAstrea());
    server.get("/browser/status", async () => this.browserController.getStatus());

    server.post("/extract", async (request, reply) => {
      try {
        const extractionRequest = parseExtractionRequest(request.body);
        const job = this.jobManager.createJob(extractionRequest);
        return reply.code(202).send({
          jobId: job.jobId,
          status: job.status,
        });
      } catch (error) {
        return reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : "Request inválida.",
        });
      }
    });

    server.get("/extract/:jobId", async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const job = this.jobManager.getJob(jobId);

      if (!job) {
        return reply.code(404).send({
          ok: false,
          error: "Job no encontrado.",
        });
      }

      return job;
    });

    await server.listen({ port: this.port, host: "127.0.0.1" });
    this.server = server;
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    await this.server?.close();
    this.server = undefined;
    this.isRunning = false;
  }

  getStatus(): ApiRuntimeStatus {
    return {
      isRunning: this.isRunning,
      port: this.port,
      baseUrl: `http://127.0.0.1:${this.port}`,
    };
  }
}

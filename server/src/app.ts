import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";

export interface AskResult {
  answer: string;
  sql: string | null;
  rows: Record<string, unknown>[];
}

export interface HistoryItem {
  id: string;
  question: string;
  answer: string;
  sql: string | null;
  rowCount: number;
  createdAt: string;
}

export interface AppOptions {
  /** Base URL of the FastAPI service, e.g. http://localhost:8000 */
  apiUrl: string;
  /** Injectable for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Max /api/ask calls per IP per minute. */
  rateLimitPerMinute?: number;
  /** Max time to wait for the LLM-backed API. Local models are slow. */
  upstreamTimeoutMs?: number;
  /** Allowed browser origin for CORS. */
  corsOrigin?: string;
  historyLimit?: number;
}

const AskBody = z.object({
  question: z.string().trim().min(1, "Question cannot be empty").max(500, "Question is too long (max 500 characters)"),
});

export function createApp(opts: AppOptions) {
  const {
    apiUrl,
    fetchImpl = fetch,
    rateLimitPerMinute = 20,
    upstreamTimeoutMs = 120_000,
    corsOrigin = "http://localhost:5173",
    historyLimit = 50,
  } = opts;

  const history: HistoryItem[] = [];
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "10kb" }));

  const askLimiter = rateLimit({
    windowMs: 60_000,
    limit: rateLimitPerMinute,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many questions. Please wait a minute and try again." },
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const r = await fetchImpl(`${apiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      res.json({ status: "ok", upstream: r.ok ? "up" : "down" });
    } catch {
      res.json({ status: "ok", upstream: "down" });
    }
  });

  app.post("/api/ask", askLimiter, async (req: Request, res: Response) => {
    const parsed = AskBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { question } = parsed.data;

    let upstream: globalThis.Response;
    try {
      upstream = await fetchImpl(`${apiUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: AbortSignal.timeout(upstreamTimeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      res
        .status(timedOut ? 504 : 503)
        .json({ error: timedOut ? "The model took too long to answer." : "The Text-to-SQL API is unreachable." });
      return;
    }

    if (!upstream.ok) {
      const body = (await upstream.json().catch(() => ({}))) as { detail?: string };
      res.status(502).json({ error: body.detail ?? `Upstream error (${upstream.status})` });
      return;
    }

    const data = (await upstream.json()) as AskResult;
    const item: HistoryItem = {
      id: randomUUID(),
      question,
      answer: data.answer,
      sql: data.sql ?? null,
      rowCount: data.rows?.length ?? 0,
      createdAt: new Date().toISOString(),
    };
    history.unshift(item);
    history.length = Math.min(history.length, historyLimit);

    res.json({ id: item.id, question, ...data });
  });

  app.get("/api/history", (_req, res) => {
    res.json(history);
  });

  app.delete("/api/history", (_req, res) => {
    history.length = 0;
    res.status(204).end();
  });

  // Last-resort error handler (e.g. malformed JSON body)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: status === 400 ? "Invalid JSON body" : "Internal server error" });
  });

  return app;
}

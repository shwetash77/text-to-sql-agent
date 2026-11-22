import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const okResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sample = { answer: "Mumbai has the most customers.", sql: "SELECT 1", rows: [{ city: "Mumbai", customers: 31 }] };

function makeApp(fetchImpl: typeof fetch, extra = {}) {
  return createApp({ apiUrl: "http://api.test", fetchImpl, rateLimitPerMinute: 1000, ...extra });
}

describe("POST /api/ask", () => {
  it("proxies a question to FastAPI and returns the answer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(sample));
    const res = await request(makeApp(fetchImpl)).post("/api/ask").send({ question: "  Which city has the most customers? " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ answer: sample.answer, sql: "SELECT 1", rows: sample.rows });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://api.test/ask");
    expect(JSON.parse(init.body)).toEqual({ question: "Which city has the most customers?" });
  });

  it("rejects empty and oversized questions without calling upstream", async () => {
    const fetchImpl = vi.fn();
    const app = makeApp(fetchImpl);
    expect((await request(app).post("/api/ask").send({ question: "   " })).status).toBe(400);
    expect((await request(app).post("/api/ask").send({ question: "x".repeat(501) })).status).toBe(400);
    expect((await request(app).post("/api/ask").send({})).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(makeApp(vi.fn())).post("/api/ask").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
  });

  it("maps upstream errors to 502 with the FastAPI detail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ detail: "model crashed" }, 500));
    const res = await request(makeApp(fetchImpl)).post("/api/ask").send({ question: "hi" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("model crashed");
  });

  it("returns 503 when the API is unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const res = await request(makeApp(fetchImpl)).post("/api/ask").send({ question: "hi" });
    expect(res.status).toBe(503);
  });

  it("returns 504 on timeout", async () => {
    const err = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    const res = await request(makeApp(vi.fn().mockRejectedValue(err))).post("/api/ask").send({ question: "hi" });
    expect(res.status).toBe(504);
  });

  it("rate limits repeated calls", async () => {
    const app = makeApp(vi.fn().mockImplementation(async () => okResponse(sample)), { rateLimitPerMinute: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(app).post("/api/ask").send({ question: "hi" })).status);
    expect(statuses).toEqual([200, 200, 429]);
  });
});

describe("history", () => {
  it("records questions newest-first, caps the list, and can be cleared", async () => {
    const app = makeApp(vi.fn().mockImplementation(async () => okResponse(sample)), { historyLimit: 2 });
    for (const q of ["one", "two", "three"]) await request(app).post("/api/ask").send({ question: q });

    const list = await request(app).get("/api/history");
    expect(list.body.map((h: { question: string }) => h.question)).toEqual(["three", "two"]);
    expect(list.body[0].rowCount).toBe(1);

    expect((await request(app).delete("/api/history")).status).toBe(204);
    expect((await request(app).get("/api/history")).body).toEqual([]);
  });
});

describe("GET /api/health", () => {
  it("reports upstream status", async () => {
    expect((await request(makeApp(vi.fn().mockResolvedValue(okResponse({ status: "ok" })))).get("/api/health")).body.upstream).toBe("up");
    expect((await request(makeApp(vi.fn().mockRejectedValue(new Error("x")))).get("/api/health")).body.upstream).toBe("down");
  });
});

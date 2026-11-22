import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  // Recharts measures its container; jsdom has no layout engine.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("asks a question and shows the answer, table and SQL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/api/history")) return json([]);
      if (url.endsWith("/api/ask") && init?.method === "POST")
        return json({ id: "1", question: "q", answer: "Pune has the most customers.", sql: "SELECT city FROM customers", rows: [{ city: "Pune", customers: 31 }, { city: "Delhi", customers: 24 }] });
      return json({}, 404);
    });

    render(<App />);
    await userEvent.type(screen.getByLabelText("Your question"), "Which city has the most customers?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Pune has the most customers.")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "city" })).toBeInTheDocument();
    expect(screen.getByText("SELECT city FROM customers")).toBeInTheDocument();
    const askCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/api/ask"))!;
    expect(JSON.parse(String(askCall[1]?.body))).toEqual({ question: "Which city has the most customers?" });
  });

  it("shows an error message when the gateway fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) =>
      String(input).endsWith("/api/history") ? json([]) : json({ error: "The Text-to-SQL API is unreachable." }, 503));

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Which city has the most customers?" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("unreachable");
  });

  it("disables Ask until there is text", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => json([]));
    render(<App />);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your question"), "hi");
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled());
  });
});

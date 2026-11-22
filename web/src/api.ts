import type { AskResponse, HistoryItem } from "./types";

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const askQuestion = (question: string): Promise<AskResponse> =>
  fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  }).then(parse<AskResponse>);

export const getHistory = (): Promise<HistoryItem[]> => fetch("/api/history").then(parse<HistoryItem[]>);

export const clearHistory = async (): Promise<void> => {
  await fetch("/api/history", { method: "DELETE" });
};

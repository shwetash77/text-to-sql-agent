import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { askQuestion, clearHistory, getHistory } from "./api";
import { HistoryPanel } from "./components/HistoryPanel";
import { Message, type ChatEntry } from "./components/Message";
import type { HistoryItem } from "./types";

const EXAMPLES = [
  "Top 5 products by revenue in March 2025",
  "Show monthly revenue for 2025",
  "Which city has the most customers?",
  "Delete all orders",
];

export default function App() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(() => getHistory().then(setHistory).catch(() => undefined), []);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth" }); }, [entries]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const tempId = crypto.randomUUID();
    setBusy(true);
    setInput("");
    setEntries((e) => [...e, { id: tempId, question: q, status: "loading" }]);
    try {
      const result = await askQuestion(q);
      setEntries((e) => e.map((x) => (x.id === tempId ? { id: result.id, question: q, status: "done", result } : x)));
    } catch (err) {
      const error = err instanceof Error ? err.message : "Something went wrong";
      setEntries((e) => e.map((x) => (x.id === tempId ? { id: tempId, question: q, status: "error", error } : x)));
    } finally {
      setBusy(false);
      void refreshHistory();
    }
  }, [busy, refreshHistory]);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); void ask(input); };

  return (
    <div className="layout">
      <header className="top">
        <h1>Chat with Your Database</h1>
        <p className="muted">Ask in plain English. Queries run read-only behind SQL guardrails.</p>
      </header>

      <main className="chat">
        {entries.length === 0 && (
          <section className="empty">
            <p>Try one of these:</p>
            <div className="chips">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="chip" onClick={() => void ask(ex)} disabled={busy}>{ex}</button>
              ))}
            </div>
          </section>
        )}
        {entries.map((e) => <Message key={e.id} entry={e} />)}
        <div ref={endRef} />
      </main>

      <HistoryPanel
        items={history}
        onPick={(q) => void ask(q)}
        onClear={async () => { await clearHistory(); setHistory([]); }}
      />

      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor="q" className="sr-only">Your question</label>
        <input
          id="q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Which city has the most customers?"
          maxLength={500}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !input.trim()}>{busy ? "Asking…" : "Ask"}</button>
      </form>
    </div>
  );
}

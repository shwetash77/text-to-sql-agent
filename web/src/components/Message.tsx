import { Suspense, lazy } from "react";
import { inferChart } from "../chart";
import type { AskResponse } from "../types";
import { ResultTable } from "./ResultTable";

// Recharts is the heaviest dependency; load it only when a chartable result arrives.
const ResultChart = lazy(() => import("./ResultChart").then((m) => ({ default: m.ResultChart })));

export type ChatEntry =
  | { id: string; question: string; status: "loading" }
  | { id: string; question: string; status: "error"; error: string }
  | { id: string; question: string; status: "done"; result: AskResponse };

export function Message({ entry }: { entry: ChatEntry }) {
  return (
    <article className="turn">
      <p className="bubble user">{entry.question}</p>
      {entry.status === "loading" && <p className="bubble bot muted" aria-live="polite">Thinking… local models can take a few seconds.</p>}
      {entry.status === "error" && <p className="bubble bot error" role="alert">{entry.error}</p>}
      {entry.status === "done" && (
        <div className="bubble bot">
          <p>{entry.result.answer}</p>
          {entry.result.rows.length > 0 && (() => {
            const spec = inferChart(entry.result.rows);
            return (
              <>
                {spec && (
                  <Suspense fallback={<p className="muted small">Loading chart…</p>}>
                    <ResultChart rows={entry.result.rows} spec={spec} />
                  </Suspense>
                )}
                <ResultTable rows={entry.result.rows} />
              </>
            );
          })()}
          {entry.result.sql && (
            <details>
              <summary>View generated SQL</summary>
              <pre><code>{entry.result.sql}</code></pre>
            </details>
          )}
        </div>
      )}
    </article>
  );
}

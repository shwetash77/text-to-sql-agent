import type { HistoryItem } from "../types";

interface Props {
  items: HistoryItem[];
  onPick: (question: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ items, onPick, onClear }: Props) {
  return (
    <aside className="history" aria-label="Question history">
      <div className="history-head">
        <h2>History</h2>
        {items.length > 0 && <button className="link" onClick={onClear}>Clear</button>}
      </div>
      {items.length === 0 ? (
        <p className="muted small">Your questions will appear here.</p>
      ) : (
        <ul>
          {items.map((h) => (
            <li key={h.id}>
              <button onClick={() => onPick(h.question)} title={h.answer}>
                {h.question}
                <span className="small muted">{h.rowCount} row{h.rowCount === 1 ? "" : "s"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

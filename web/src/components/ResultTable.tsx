import { formatCell } from "../chart";
import type { Row } from "../types";

export function ResultTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);
  return (
    <div className="table-wrap" role="region" aria-label="Query results" tabIndex={0}>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className={typeof rows[0][c] === "number" ? "num" : undefined}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className={typeof r[c] === "number" ? "num" : undefined}>{formatCell(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

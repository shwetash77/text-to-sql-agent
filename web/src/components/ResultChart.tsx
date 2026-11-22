import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSpec } from "../chart";
import type { Row } from "../types";

export function ResultChart({ rows, spec }: { rows: Row[]; spec: ChartSpec }) {
  const common = { data: rows, margin: { top: 8, right: 12, left: 0, bottom: 0 } };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
      <XAxis dataKey={spec.labelKey} stroke="var(--muted)" fontSize={12} />
      <YAxis stroke="var(--muted)" fontSize={12} width={56} />
      <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
    </>
  );
  return (
    <div className="chart" role="img" aria-label={`${spec.kind} chart of ${spec.valueKey} by ${spec.labelKey}`}>
      <ResponsiveContainer width="100%" height={240}>
        {spec.kind === "line" ? (
          <LineChart {...common}>{axes}<Line type="monotone" dataKey={spec.valueKey} stroke="var(--accent)" strokeWidth={2} dot={false} /></LineChart>
        ) : (
          <BarChart {...common}>{axes}<Bar dataKey={spec.valueKey} fill="var(--accent)" radius={[4, 4, 0, 0]} /></BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

import type { Row } from "./types";

export interface ChartSpec {
  kind: "bar" | "line";
  labelKey: string;
  valueKey: string;
}

const isNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const looksLikePeriod = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(v);

/** Decide whether a result set can be charted: one label column + one numeric column, 2-50 rows. */
export function inferChart(rows: Row[]): ChartSpec | null {
  if (rows.length < 2 || rows.length > 50) return null;
  const keys = Object.keys(rows[0]);
  const valueKey = keys.find((k) => rows.every((r) => isNumber(r[k])));
  const labelKey = keys.find((k) => k !== valueKey && rows.every((r) => !isNumber(r[k]) && r[k] != null));
  if (!valueKey || !labelKey) return null;
  return { kind: rows.every((r) => looksLikePeriod(r[labelKey])) ? "line" : "bar", labelKey, valueKey };
}

export function formatCell(v: unknown): string {
  if (v == null) return "–";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return String(v);
}

import { describe, expect, it } from "vitest";
import { formatCell, inferChart } from "./chart";

describe("inferChart", () => {
  it("returns a line chart for month labels", () => {
    const rows = [{ month: "2025-01", revenue: 10 }, { month: "2025-02", revenue: 20 }];
    expect(inferChart(rows)).toEqual({ kind: "line", labelKey: "month", valueKey: "revenue" });
  });
  it("returns a bar chart for categories", () => {
    const rows = [{ city: "Pune", customers: 31 }, { city: "Delhi", customers: 24 }];
    expect(inferChart(rows)).toEqual({ kind: "bar", labelKey: "city", valueKey: "customers" });
  });
  it("skips single rows, empty sets, and tables without a numeric column", () => {
    expect(inferChart([{ city: "Pune", customers: 31 }])).toBeNull();
    expect(inferChart([])).toBeNull();
    expect(inferChart([{ a: "x", b: "y" }, { a: "z", b: "w" }])).toBeNull();
  });
  it("skips result sets too large to chart", () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ k: `k${i}`, v: i }));
    expect(inferChart(rows)).toBeNull();
  });
});

describe("formatCell", () => {
  it("formats numbers and nulls", () => {
    expect(formatCell(1234567)).toBe("12,34,567");
    expect(formatCell(12.3456)).toBe("12.35");
    expect(formatCell(null)).toBe("–");
    expect(formatCell("abc")).toBe("abc");
  });
});

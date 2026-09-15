import { describe, expect, it } from "vitest";
import { formatDate, formatEuro, formatUnitPrice, parseIrishDate } from "@/lib/format";

describe("Irish formatting", () => {
  it("formats euro with two decimals", () => {
    expect(formatEuro("6.5")).toBe("€6.50");
    expect(formatEuro("1234.5")).toBe("€1,234.50");
    expect(formatEuro(null)).toBe("–");
  });
  it("keeps three decimals for unit prices", () => {
    expect(formatUnitPrice("0.333333", "egg")).toBe("€0.333 per egg");
    expect(formatUnitPrice("0.4", "egg")).toBe("€0.40 per egg");
    expect(formatUnitPrice(null, "egg")).toBe("Comparison unavailable");
  });
  it("shows dates as DD/MM/YYYY", () => {
    expect(formatDate("2026-07-10")).toBe("10/07/2026");
  });
  it("parses DD/MM/YYYY and rejects impossible dates", () => {
    expect(parseIrishDate("10/07/2026")).toBe("2026-07-10");
    expect(parseIrishDate("31/02/2026")).toBeNull();
    expect(parseIrishDate("2026-07-10")).toBeNull();
  });
});

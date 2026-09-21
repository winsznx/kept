import { describe, expect, it } from "vitest";
import { centsDelta, CurrencyMismatchError, formatCents, moneyRenderings, parseMoneyToCents, sumCents } from "../../convex/lib/money";

describe("money", () => {
  it("parses common renderings into integer cents without float drift", () => {
    expect(parseMoneyToCents("$18.75")).toBe(1875);
    expect(parseMoneyToCents("-$18.75")).toBe(-1875);
    expect(parseMoneyToCents("$-18.75")).toBe(-1875);
    expect(parseMoneyToCents("($5.00)")).toBe(-500);
    expect(parseMoneyToCents("1,234.5")).toBe(123450);
    expect(parseMoneyToCents("0.10")).toBe(10);
    expect(parseMoneyToCents("USD 80")).toBe(8000);
    expect(parseMoneyToCents("0.1") ?? 0 + (parseMoneyToCents("0.2") ?? 0)).toBe(10);
  });

  it("rejects ambiguous strings", () => {
    expect(parseMoneyToCents("18.755")).toBeNull();
    expect(parseMoneyToCents("about $18")).toBeNull();
    expect(parseMoneyToCents("")).toBeNull();
  });

  it("computes signed deltas and refuses cross-currency comparison", () => {
    expect(centsDelta({ amountCents: 1875, currency: "USD" }, { amountCents: 0, currency: "usd" })).toBe(-1875);
    expect(centsDelta({ amountCents: 1875, currency: "USD" }, { amountCents: 1875, currency: "USD" })).toBe(0);
    expect(() => centsDelta({ amountCents: 1, currency: "USD" }, { amountCents: 1, currency: "EUR" })).toThrow(CurrencyMismatchError);
  });

  it("refuses non-integer minor units", () => {
    expect(() => centsDelta({ amountCents: 18.75, currency: "USD" }, { amountCents: 0, currency: "USD" })).toThrow(RangeError);
    expect(() => sumCents([1, 2.5])).toThrow(RangeError);
  });

  it("sums many small values exactly", () => {
    expect(sumCents(Array.from({ length: 24 }, () => 1875))).toBe(45000);
  });

  it("formats and renders", () => {
    expect(formatCents(5625)).toBe("$56.25");
    expect(formatCents(-1875)).toBe("-$18.75");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(moneyRenderings(1875)).toContain("18.75");
    expect(moneyRenderings(8000)).toContain("$80");
  });
});

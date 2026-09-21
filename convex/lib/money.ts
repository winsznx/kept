export type Money = { amountCents: number; currency: string };

export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = "CurrencyMismatchError";
  }
}

export function assertCents(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money must be integer minor units, got ${value}`);
  }
  return value;
}

export function normalizeCurrency(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new RangeError(`Invalid ISO-4217 currency: ${currency}`);
  }
  return code;
}

/** Signed delta observed - expected. Refuses to compare across currencies. */
export function centsDelta(expected: Money, observed: Money): number {
  const a = normalizeCurrency(expected.currency);
  const b = normalizeCurrency(observed.currency);
  if (a !== b) throw new CurrencyMismatchError(a, b);
  return assertCents(observed.amountCents) - assertCents(expected.amountCents);
}

export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + assertCents(v), 0);
}

/**
 * Parses a human money string ("$18.75", "-$18.75", "18", "1,234.50", "($5.00)")
 * into integer cents without floating-point arithmetic. Returns null when the
 * string is not an unambiguous amount.
 */
export function parseMoneyToCents(input: string): number | null {
  let s = input.trim().replace(/\s+/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negative = !negative;
    s = s.slice(1);
  }
  s = s.replace(/^(USD|US\$|\$)/i, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  const m = /^(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number.parseInt(m[1].replace(/,/g, ""), 10);
  const frac = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  const cents = whole * 100 + frac;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function formatCents(amountCents: number, currency = "USD"): string {
  const abs = Math.abs(assertCents(amountCents));
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  const symbol = normalizeCurrency(currency) === "USD" ? "$" : `${currency} `;
  return `${amountCents < 0 ? "-" : ""}${symbol}${whole}.${frac}`;
}

/** Textual renderings of an amount that a literal evidence excerpt could contain. */
export function moneyRenderings(amountCents: number): string[] {
  const abs = Math.abs(assertCents(amountCents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const withCents = `${whole}.${String(frac).padStart(2, "0")}`;
  const withCommas = `${whole.toLocaleString("en-US")}.${String(frac).padStart(2, "0")}`;
  const out = new Set([withCents, withCommas]);
  if (frac === 0) {
    out.add(`$${whole}`);
    out.add(`$${whole.toLocaleString("en-US")}`);
    out.add(`${whole} dollars`);
  }
  return [...out];
}

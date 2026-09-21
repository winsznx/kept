import { assertCents, normalizeCurrency } from "./money";

export type Cadence = "MONTHLY" | "ONE_TIME" | "ANNUAL" | "UNKNOWN";

/** Calendar month identity, 1-based month. Kept avoids day-level billing-cycle guesses. */
export type YearMonth = { year: number; month: number };

export type ExpectedCreditEvent = {
  periodIndex: number;
  expectedAmountCents: number;
  currency: string;
  /** UTC ms of the first day of the expected billing month, when the schedule start is known. */
  expectedAt: number | null;
  windowStartAt: number | null;
  windowEndAt: number | null;
};

export function ymToUtcMs({ year, month }: YearMonth): number {
  return Date.UTC(year, month - 1, 1);
}

export function addMonths({ year, month }: YearMonth, n: number): YearMonth {
  const zero = year * 12 + (month - 1) + n;
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 };
}

export function monthsBetween(from: YearMonth, to: YearMonth): number {
  return to.year * 12 + to.month - (from.year * 12 + from.month);
}

export function parseYearMonth(iso: string | null | undefined): YearMonth | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Deterministic expected-event generation for a recurring monthly credit.
 * Without a known start month, events carry only a period index and no dates.
 */
export function generateMonthlyCreditSchedule(input: {
  amountCents: number;
  currency: string;
  periodCount: number;
  startMonth: YearMonth | null;
}): ExpectedCreditEvent[] {
  const amount = Math.abs(assertCents(input.amountCents));
  const currency = normalizeCurrency(input.currency);
  if (!Number.isInteger(input.periodCount) || input.periodCount < 1 || input.periodCount > 120) {
    throw new RangeError(`periodCount must be an integer in [1, 120], got ${input.periodCount}`);
  }
  return Array.from({ length: input.periodCount }, (_, i) => {
    const periodIndex = i + 1;
    if (!input.startMonth) {
      return { periodIndex, expectedAmountCents: amount, currency, expectedAt: null, windowStartAt: null, windowEndAt: null };
    }
    const ym = addMonths(input.startMonth, i);
    return {
      periodIndex,
      expectedAmountCents: amount,
      currency,
      expectedAt: ymToUtcMs(ym),
      windowStartAt: ymToUtcMs(ym),
      windowEndAt: ymToUtcMs(addMonths(ym, 1)) - 1,
    };
  });
}

/**
 * Maps a statement to a schedule period. Returns null when it cannot be mapped
 * confidently (no start month or no statement month), which makes the caller
 * abstain instead of inferring a missing credit.
 */
export function periodIndexForStatement(startMonth: YearMonth | null, statementMonth: YearMonth | null): number | null {
  if (!startMonth || !statementMonth) return null;
  return monthsBetween(startMonth, statementMonth) + 1;
}

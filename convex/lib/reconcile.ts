import { assertCents, normalizeCurrency } from "./money";
import type { ExpectedCreditEvent } from "./schedule";

export type LineMatch = "YES" | "NO" | "AMBIGUOUS";

export type ObservedCreditLine = {
  lineId: string;
  /** Signed as printed on the bill. Credits are negative. */
  amountCents: number;
  currency: string;
  /** Whether this line is the recurring promotional credit for the commitment under test. */
  matchesCommitment: LineMatch;
};

export type ObservedAdjustmentLine = {
  lineId: string;
  amountCents: number;
  currency: string;
  matchesCommitment: LineMatch;
};

export type ObservedStatement = {
  statementKey: string;
  /** Schedule period this statement belongs to; null when it cannot be mapped confidently. */
  periodIndex: number | null;
  /** False when the statement is not itemized enough to see promotional credit lines. */
  itemized: boolean;
  creditLines: readonly ObservedCreditLine[];
  /** One-time back-credits/adjustments, used only for resolution verification. */
  adjustmentLines?: readonly ObservedAdjustmentLine[];
};

export type PeriodOutcome =
  | "MATCH"
  | "MATERIAL_DIFFERENCE"
  | "EXPECTED_CHANGE"
  | "REVIEW_REQUIRED"
  | "SOURCE_CONFLICT"
  | "NOT_OBSERVED"
  | "NOT_DUE";

export type ReasonCode =
  | "AMOUNT_EQUAL"
  | "AMOUNT_DIFFERS"
  | "CREDIT_LINE_ABSENT"
  | "AMBIGUOUS_LINE_ITEM"
  | "MULTIPLE_CANDIDATE_LINES"
  | "UNEXPECTED_SIGN"
  | "CURRENCY_MISMATCH"
  | "NOT_ITEMIZED"
  | "PERIOD_UNMAPPED"
  | "BEFORE_SCHEDULE_START"
  | "AFTER_SCHEDULE_END"
  | "CONFLICTING_STATEMENTS"
  | "NO_STATEMENT_FOR_PERIOD"
  | "PERIOD_NOT_YET_BILLED";

export type PeriodResult = {
  periodIndex: number | null;
  statementKey: string | null;
  lineId: string | null;
  outcome: PeriodOutcome;
  reasonCode: ReasonCode;
  expectedCents: number | null;
  observedCents: number | null;
  /** observed - expected, in credit magnitude terms (negative = less credit than promised). */
  deltaCents: number | null;
};

export type OverallOutcome =
  | "MATCH"
  | "MATERIAL_DIFFERENCE"
  | "EXPECTED_CHANGE"
  | "INSUFFICIENT_EVIDENCE"
  | "SOURCE_CONFLICT"
  | "REVIEW_REQUIRED";

export type CreditReconciliation = {
  overallOutcome: OverallOutcome;
  periods: PeriodResult[];
  unmapped: PeriodResult[];
  currency: string;
  totalScheduledCents: number;
  observedReceivedCents: number;
  observedMissingCents: number;
  /** Promised value not yet observed as received: total scheduled minus observed received. */
  remainingScheduledCents: number;
  notYetDueCents: number;
  latestObservedPeriod: number | null;
  counts: Record<PeriodOutcome, number>;
};

function compareStatement(
  event: ExpectedCreditEvent,
  statement: ObservedStatement,
): Omit<PeriodResult, "periodIndex" | "statementKey"> {
  const expected = event.expectedAmountCents;
  const base = { expectedCents: expected, observedCents: null, deltaCents: null, lineId: null };
  if (!statement.itemized) return { ...base, outcome: "REVIEW_REQUIRED", reasonCode: "NOT_ITEMIZED" };

  const matches = statement.creditLines.filter((l) => l.matchesCommitment === "YES");
  const ambiguous = statement.creditLines.some((l) => l.matchesCommitment === "AMBIGUOUS");
  if (matches.length > 1) return { ...base, outcome: "REVIEW_REQUIRED", reasonCode: "MULTIPLE_CANDIDATE_LINES" };
  if (matches.length === 0) {
    if (ambiguous) return { ...base, outcome: "REVIEW_REQUIRED", reasonCode: "AMBIGUOUS_LINE_ITEM" };
    return { ...base, outcome: "MATERIAL_DIFFERENCE", reasonCode: "CREDIT_LINE_ABSENT", observedCents: 0, deltaCents: -expected };
  }

  const line = matches[0];
  if (normalizeCurrency(line.currency) !== event.currency) {
    return { ...base, lineId: line.lineId, outcome: "REVIEW_REQUIRED", reasonCode: "CURRENCY_MISMATCH" };
  }
  const signed = assertCents(line.amountCents);
  if (signed > 0) return { ...base, lineId: line.lineId, outcome: "REVIEW_REQUIRED", reasonCode: "UNEXPECTED_SIGN" };
  const observed = -signed;
  const delta = observed - expected;
  return {
    lineId: line.lineId,
    expectedCents: expected,
    observedCents: observed,
    deltaCents: delta,
    outcome: delta === 0 ? "MATCH" : "MATERIAL_DIFFERENCE",
    reasonCode: delta === 0 ? "AMOUNT_EQUAL" : "AMOUNT_DIFFERS",
  };
}

function emptyCounts(): Record<PeriodOutcome, number> {
  return { MATCH: 0, MATERIAL_DIFFERENCE: 0, EXPECTED_CHANGE: 0, REVIEW_REQUIRED: 0, SOURCE_CONFLICT: 0, NOT_OBSERVED: 0, NOT_DUE: 0 };
}

/**
 * Deterministic reconciliation of a recurring promotional credit schedule against
 * observed statements (PRD 9.2, 9.3, 9.6). A period without a statement is never a
 * negative finding: earlier gaps are NOT_OBSERVED, later ones NOT_DUE.
 */
export function reconcileCreditSchedule(
  schedule: readonly ExpectedCreditEvent[],
  statements: readonly ObservedStatement[],
  options: { delayedStartSupported?: boolean } = {},
): CreditReconciliation {
  if (schedule.length === 0) throw new RangeError("Empty schedule");
  const currency = schedule[0].currency;
  const periodCount = schedule.length;
  const unmapped: PeriodResult[] = [];
  const byPeriod = new Map<number, ObservedStatement[]>();

  for (const s of statements) {
    if (s.periodIndex === null) {
      unmapped.push({ periodIndex: null, statementKey: s.statementKey, lineId: null, outcome: "REVIEW_REQUIRED", reasonCode: "PERIOD_UNMAPPED", expectedCents: null, observedCents: null, deltaCents: null });
      continue;
    }
    if (s.periodIndex < 1) {
      unmapped.push({
        periodIndex: s.periodIndex,
        statementKey: s.statementKey,
        lineId: null,
        outcome: options.delayedStartSupported ? "EXPECTED_CHANGE" : "REVIEW_REQUIRED",
        reasonCode: "BEFORE_SCHEDULE_START",
        expectedCents: null,
        observedCents: null,
        deltaCents: null,
      });
      continue;
    }
    if (s.periodIndex > periodCount) {
      const hasCredit = s.creditLines.some((l) => l.matchesCommitment === "YES");
      unmapped.push({ periodIndex: s.periodIndex, statementKey: s.statementKey, lineId: null, outcome: hasCredit ? "REVIEW_REQUIRED" : "EXPECTED_CHANGE", reasonCode: "AFTER_SCHEDULE_END", expectedCents: 0, observedCents: null, deltaCents: null });
      continue;
    }
    const list = byPeriod.get(s.periodIndex) ?? [];
    list.push(s);
    byPeriod.set(s.periodIndex, list);
  }

  const latestObservedPeriod = byPeriod.size > 0 ? Math.max(...byPeriod.keys()) : null;
  const periods: PeriodResult[] = schedule.map((event) => {
    const list = byPeriod.get(event.periodIndex);
    if (!list || list.length === 0) {
      const future = latestObservedPeriod === null || event.periodIndex > latestObservedPeriod;
      return {
        periodIndex: event.periodIndex,
        statementKey: null,
        lineId: null,
        outcome: future ? "NOT_DUE" : "NOT_OBSERVED",
        reasonCode: future ? "PERIOD_NOT_YET_BILLED" : "NO_STATEMENT_FOR_PERIOD",
        expectedCents: event.expectedAmountCents,
        observedCents: null,
        deltaCents: null,
      };
    }
    const results = list.map((s) => ({ statementKey: s.statementKey, ...compareStatement(event, s) }));
    const distinct = new Set(results.map((r) => `${r.outcome}:${r.observedCents}`));
    if (distinct.size > 1) {
      return { periodIndex: event.periodIndex, statementKey: results.map((r) => r.statementKey).join(","), lineId: null, outcome: "SOURCE_CONFLICT", reasonCode: "CONFLICTING_STATEMENTS", expectedCents: event.expectedAmountCents, observedCents: null, deltaCents: null };
    }
    return { periodIndex: event.periodIndex, ...results[0] };
  });

  const counts = emptyCounts();
  for (const p of [...periods, ...unmapped]) counts[p.outcome] += 1;

  const totalScheduledCents = schedule.reduce((a, e) => a + e.expectedAmountCents, 0);
  let observedReceivedCents = 0;
  let observedMissingCents = 0;
  let notYetDueCents = 0;
  for (const p of periods) {
    if (p.outcome === "MATCH" || p.outcome === "MATERIAL_DIFFERENCE") {
      const received = Math.min(p.observedCents ?? 0, p.expectedCents ?? 0);
      observedReceivedCents += received;
      observedMissingCents += Math.max(0, (p.expectedCents ?? 0) - (p.observedCents ?? 0));
    }
    if (p.outcome === "NOT_DUE") notYetDueCents += p.expectedCents ?? 0;
  }

  let overallOutcome: OverallOutcome;
  if (counts.MATERIAL_DIFFERENCE > 0) overallOutcome = "MATERIAL_DIFFERENCE";
  else if (counts.SOURCE_CONFLICT > 0) overallOutcome = "SOURCE_CONFLICT";
  else if (counts.REVIEW_REQUIRED > 0) overallOutcome = "REVIEW_REQUIRED";
  else if (counts.MATCH > 0) overallOutcome = "MATCH";
  else if (counts.EXPECTED_CHANGE > 0) overallOutcome = "EXPECTED_CHANGE";
  else overallOutcome = "INSUFFICIENT_EVIDENCE";

  return {
    overallOutcome,
    periods,
    unmapped,
    currency,
    totalScheduledCents,
    observedReceivedCents,
    observedMissingCents,
    remainingScheduledCents: totalScheduledCents - observedReceivedCents,
    notYetDueCents,
    latestObservedPeriod,
    counts,
  };
}

export type VerificationResult = "VERIFIED_FIXED" | "STILL_MISMATCHED" | "INSUFFICIENT_EVIDENCE";

export type ResolutionVerification = {
  result: VerificationResult;
  qualifyingPeriod: number | null;
  qualifyingStatementKey: string | null;
  verifiedRestoredCents: number;
  reason: string;
};

/**
 * Checks whether a provider-claimed fix is borne out by a later qualifying statement
 * (PRD FR-025). The provider's claim itself is never an input: only statements for
 * periods after `claimAfterPeriod` count, and only a deterministic MATCH verifies.
 */
export function verifyResolution(input: {
  schedule: readonly ExpectedCreditEvent[];
  disputedPeriods: readonly number[];
  claimAfterPeriod: number;
  statements: readonly ObservedStatement[];
}): ResolutionVerification {
  const later = input.statements.filter((s) => s.periodIndex !== null && s.periodIndex > input.claimAfterPeriod);
  const recon = reconcileCreditSchedule(input.schedule, later);
  const decisive = recon.periods.filter((p) => p.outcome === "MATCH" || p.outcome === "MATERIAL_DIFFERENCE");
  if (decisive.length === 0) {
    return { result: "INSUFFICIENT_EVIDENCE", qualifyingPeriod: null, qualifyingStatementKey: null, verifiedRestoredCents: 0, reason: "No later statement contains a comparable promotional credit line for a scheduled period." };
  }
  const first = decisive[0];
  if (first.outcome === "MATERIAL_DIFFERENCE") {
    return { result: "STILL_MISMATCHED", qualifyingPeriod: first.periodIndex, qualifyingStatementKey: first.statementKey, verifiedRestoredCents: 0, reason: "The next qualifying statement still does not show the promised credit amount." };
  }

  const expectedByPeriod = new Map(input.schedule.map((e) => [e.periodIndex, e.expectedAmountCents]));
  const missingForDisputed = input.disputedPeriods.reduce((a, p) => a + (expectedByPeriod.get(p) ?? 0), 0);
  const matchedAfter = decisive.filter((p) => p.outcome === "MATCH").reduce((a, p) => a + (p.expectedCents ?? 0), 0);
  const backCredits = later
    .flatMap((s) => s.adjustmentLines ?? [])
    .filter((l) => l.matchesCommitment === "YES" && l.amountCents < 0 && normalizeCurrency(l.currency) === recon.currency)
    .reduce((a, l) => a + -l.amountCents, 0);

  return {
    result: "VERIFIED_FIXED",
    qualifyingPeriod: first.periodIndex,
    qualifyingStatementKey: first.statementKey,
    verifiedRestoredCents: matchedAfter + Math.min(backCredits, missingForDisputed),
    reason: "A later qualifying statement shows the promised credit at the recorded amount.",
  };
}

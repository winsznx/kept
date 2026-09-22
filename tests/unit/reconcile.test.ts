import { describe, expect, it } from "vitest";
import { reconcileCreditSchedule, verifyResolution, type ObservedStatement } from "../../convex/lib/reconcile";
import { generateMonthlyCreditSchedule, periodIndexForStatement } from "../../convex/lib/schedule";

const START = { year: 2024, month: 11 };
const schedule = generateMonthlyCreditSchedule({ amountCents: 1875, currency: "USD", periodCount: 24, startMonth: START });

function bill(periodIndex: number | null, credit: number | null, extra: Partial<ObservedStatement> = {}): ObservedStatement {
  return {
    statementKey: `bill-${periodIndex}`,
    periodIndex,
    itemized: true,
    creditLines: credit === null ? [] : [{ lineId: `l-${periodIndex}`, amountCents: -credit, currency: "USD", matchesCommitment: "YES" }],
    ...extra,
  };
}

const months1to21 = Array.from({ length: 21 }, (_, i) => bill(i + 1, 1875));

describe("schedule generation", () => {
  it("generates 24 dated monthly events", () => {
    expect(schedule).toHaveLength(24);
    expect(schedule[0]).toMatchObject({ periodIndex: 1, expectedAmountCents: 1875, expectedAt: Date.UTC(2024, 10, 1) });
    expect(schedule[23].expectedAt).toBe(Date.UTC(2026, 9, 1));
    expect(schedule[2].expectedAt).toBe(Date.UTC(2025, 0, 1));
  });

  it("generates undated events when the start month is unknown", () => {
    const s = generateMonthlyCreditSchedule({ amountCents: -1875, currency: "usd", periodCount: 3, startMonth: null });
    expect(s.map((e) => e.expectedAt)).toEqual([null, null, null]);
    expect(s[0].expectedAmountCents).toBe(1875);
    expect(s[0].currency).toBe("USD");
  });

  it("maps statements to periods only when both months are known", () => {
    expect(periodIndexForStatement(START, { year: 2026, month: 8 })).toBe(22);
    expect(periodIndexForStatement(null, { year: 2026, month: 8 })).toBeNull();
    expect(periodIndexForStatement(START, null)).toBeNull();
  });

  it("rejects absurd period counts", () => {
    expect(() => generateMonthlyCreditSchedule({ amountCents: 1, currency: "USD", periodCount: 0, startMonth: null })).toThrow();
  });
});

describe("canonical month-22 scenario (Campaign D)", () => {
  it("months 1-21 all match", () => {
    const r = reconcileCreditSchedule(schedule, months1to21);
    expect(r.overallOutcome).toBe("MATCH");
    expect(r.counts.MATCH).toBe(21);
    expect(r.counts.NOT_DUE).toBe(3);
    expect(r.observedMissingCents).toBe(0);
    expect(r.remainingScheduledCents).toBe(3 * 1875);
  });

  it("month 22 without the credit is a material difference; 23-24 are not counted missing", () => {
    const r = reconcileCreditSchedule(schedule, [...months1to21, bill(22, null)]);
    expect(r.overallOutcome).toBe("MATERIAL_DIFFERENCE");
    const p22 = r.periods[21];
    expect(p22).toMatchObject({ periodIndex: 22, outcome: "MATERIAL_DIFFERENCE", reasonCode: "CREDIT_LINE_ABSENT", expectedCents: 1875, observedCents: 0, deltaCents: -1875 });
    expect(r.periods[22].outcome).toBe("NOT_DUE");
    expect(r.periods[23].outcome).toBe("NOT_DUE");
    expect(r.observedMissingCents).toBe(1875);
    expect(r.observedReceivedCents).toBe(21 * 1875);
    expect(r.remainingScheduledCents).toBe(5625);
    expect(r.notYetDueCents).toBe(3750);
    expect(r.latestObservedPeriod).toBe(22);
  });

  it("reduced credit is a material difference with a signed delta", () => {
    const r = reconcileCreditSchedule(schedule, [bill(1, 1500)]);
    expect(r.periods[0]).toMatchObject({ outcome: "MATERIAL_DIFFERENCE", reasonCode: "AMOUNT_DIFFERS", deltaCents: -375 });
    expect(r.observedMissingCents).toBe(375);
  });

  it("no statements means no negative conclusion", () => {
    const r = reconcileCreditSchedule(schedule, []);
    expect(r.overallOutcome).toBe("INSUFFICIENT_EVIDENCE");
    expect(r.counts.NOT_DUE).toBe(24);
    expect(r.observedMissingCents).toBe(0);
  });

  it("a gap before the latest bill is NOT_OBSERVED, never missing", () => {
    const r = reconcileCreditSchedule(schedule, [bill(1, 1875), bill(3, 1875)]);
    expect(r.periods[1].outcome).toBe("NOT_OBSERVED");
    expect(r.overallOutcome).toBe("MATCH");
  });
});

describe("abstention", () => {
  it("unmapped statement period requires review", () => {
    const r = reconcileCreditSchedule(schedule, [bill(null, null)]);
    expect(r.overallOutcome).toBe("REVIEW_REQUIRED");
    expect(r.unmapped[0].reasonCode).toBe("PERIOD_UNMAPPED");
  });

  it("ambiguous line item requires review, not a mismatch", () => {
    const r = reconcileCreditSchedule(schedule, [
      bill(1, null, { creditLines: [{ lineId: "x", amountCents: -1875, currency: "USD", matchesCommitment: "AMBIGUOUS" }] }),
    ]);
    expect(r.periods[0]).toMatchObject({ outcome: "REVIEW_REQUIRED", reasonCode: "AMBIGUOUS_LINE_ITEM" });
    expect(r.observedMissingCents).toBe(0);
  });

  it("two candidate promo lines require review", () => {
    const r = reconcileCreditSchedule(schedule, [
      bill(1, null, {
        creditLines: [
          { lineId: "a", amountCents: -1875, currency: "USD", matchesCommitment: "YES" },
          { lineId: "b", amountCents: -1000, currency: "USD", matchesCommitment: "YES" },
        ],
      }),
    ]);
    expect(r.periods[0].reasonCode).toBe("MULTIPLE_CANDIDATE_LINES");
  });

  it("non-itemized (total-only) statement is not comparable", () => {
    const r = reconcileCreditSchedule(schedule, [bill(1, null, { itemized: false })]);
    expect(r.periods[0]).toMatchObject({ outcome: "REVIEW_REQUIRED", reasonCode: "NOT_ITEMIZED" });
  });

  it("currency mismatch requires review", () => {
    const r = reconcileCreditSchedule(schedule, [
      bill(1, null, { creditLines: [{ lineId: "a", amountCents: -1875, currency: "CAD", matchesCommitment: "YES" }] }),
    ]);
    expect(r.periods[0].reasonCode).toBe("CURRENCY_MISMATCH");
  });

  it("conflicting statements for one period are a source conflict", () => {
    const r = reconcileCreditSchedule(schedule, [bill(1, 1875), { ...bill(1, null), statementKey: "dup" }]);
    expect(r.periods[0].outcome).toBe("SOURCE_CONFLICT");
    expect(r.overallOutcome).toBe("SOURCE_CONFLICT");
  });

  it("identical duplicate statements do not conflict", () => {
    const r = reconcileCreditSchedule(schedule, [bill(1, 1875), { ...bill(1, 1875), statementKey: "dup" }]);
    expect(r.periods[0].outcome).toBe("MATCH");
  });

  it("before-start bill is expected only when delayed start is evidenced", () => {
    expect(reconcileCreditSchedule(schedule, [bill(0, null)]).unmapped[0].outcome).toBe("REVIEW_REQUIRED");
    expect(reconcileCreditSchedule(schedule, [bill(0, null)], { delayedStartSupported: true }).overallOutcome).toBe("EXPECTED_CHANGE");
  });

  it("after the schedule ends, an absent credit is an expected change", () => {
    const r = reconcileCreditSchedule(schedule, [bill(25, null)]);
    expect(r.overallOutcome).toBe("EXPECTED_CHANGE");
  });
});

describe("resolution verification (Campaign H)", () => {
  const history = [...months1to21, bill(22, null)];

  it("H1: provider claim + corrected later bill => VERIFIED_FIXED; restored value only from observed periods", () => {
    const later = bill(23, 1875, { adjustmentLines: [{ lineId: "adj", amountCents: -1875, currency: "USD", matchesCommitment: "YES" }] });
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, later] });
    expect(v.result).toBe("VERIFIED_FIXED");
    expect(v.qualifyingPeriod).toBe(23);
    expect(v.verifiedRestoredCents).toBe(3750);
  });

  it("H1b: recurring credit restored without back-credit counts only that period", () => {
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, bill(23, 1875)] });
    expect(v.result).toBe("VERIFIED_FIXED");
    expect(v.verifiedRestoredCents).toBe(1875);
  });

  it("H2: provider claim + later bill still missing => STILL_MISMATCHED", () => {
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, bill(23, null)] });
    expect(v.result).toBe("STILL_MISMATCHED");
    expect(v.verifiedRestoredCents).toBe(0);
  });

  it("H3: provider claim + unrelated/non-comparable document => INSUFFICIENT_EVIDENCE", () => {
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, bill(23, null, { itemized: false })] });
    expect(v.result).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("a provider claim with no later statement never verifies", () => {
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: history });
    expect(v.result).toBe("INSUFFICIENT_EVIDENCE");
    expect(v.verifiedRestoredCents).toBe(0);
  });

  it("back-credit alone is capped at the disputed missing amount", () => {
    const later = bill(23, 1875, { adjustmentLines: [{ lineId: "adj", amountCents: -99999, currency: "USD", matchesCommitment: "YES" }] });
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, later] });
    expect(v.verifiedRestoredCents).toBe(1875 + 1875);
  });
});

describe("back-credits after a claimed fix", () => {
  it("a later mapped back-credit covers the missing period: outcome MATCH, outstanding 0, remaining excludes it", () => {
    const later = bill(23, 1875, { adjustmentLines: [{ lineId: "adj", amountCents: -1875, currency: "USD", matchesCommitment: "YES" }] });
    const r = reconcileCreditSchedule(schedule, [...months1to21, bill(22, null), later]);
    expect(r.periods[21].outcome).toBe("MATERIAL_DIFFERENCE");
    expect(r.coveredPeriods).toEqual([22]);
    expect(r.observedMissingCents).toBe(1875);
    expect(r.outstandingMissingCents).toBe(0);
    expect(r.overallOutcome).toBe("MATCH");
    expect(r.remainingScheduledCents).toBe(1875);
  });

  it("an unmapped or too-small adjustment covers nothing", () => {
    const small = bill(23, 1875, { adjustmentLines: [{ lineId: "adj", amountCents: -500, currency: "USD", matchesCommitment: "YES" }] });
    expect(reconcileCreditSchedule(schedule, [...months1to21, bill(22, null), small]).overallOutcome).toBe("MATERIAL_DIFFERENCE");
    const unmapped = bill(23, 1875, { adjustmentLines: [{ lineId: "adj", amountCents: -1875, currency: "USD", matchesCommitment: "AMBIGUOUS" }] });
    expect(reconcileCreditSchedule(schedule, [...months1to21, bill(22, null), unmapped]).outstandingMissingCents).toBe(1875);
  });
});

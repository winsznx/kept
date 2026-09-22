import { describe, expect, it } from "vitest";
import { MARKETPLACE_RECEIPT, OFFER_PAGE_A, OFFER_PAGE_B, OFFER_PAGE_C, RETAILER_RETURN_POLICY, SIGNUP_EMAIL, billMonth, billText } from "../../convex/fixtures/canonical";
import { parseBillFixture, parsePromiseFixture } from "../../convex/fixtures/fixtureParser";
import { comparePageFacts, type NormalizedFact } from "../../convex/lib/factCompare";
import { canonicalizeSourceText } from "../../convex/lib/hashing";
import { buildCommitments, buildStatement, decideApplicability, deriveScheduleStart, toObservedStatement } from "../../convex/lib/pipeline";
import { reconcileCreditSchedule, verifyResolution } from "../../convex/lib/reconcile";
import { generateMonthlyCreditSchedule } from "../../convex/lib/schedule";

const facts = (text: string, cls: "TRANSACTION_EMAIL" | "FIRST_PARTY_PUBLIC_PAGE"): NormalizedFact[] => buildCommitments(parsePromiseFixture(canonicalizeSourceText(text))!, canonicalizeSourceText(text), cls);

function statement(period: number, credit: "present" | "absent", backCredit = false) {
  const text = canonicalizeSourceText(billText({ period, credit, backCredit }));
  const st = buildStatement(parseBillFixture(text, "PROMO_CREDIT_SCHEDULE"), text, "PROMO_CREDIT_SCHEDULE");
  return st;
}

describe("canonical fixture flow through the real pipeline", () => {
  const signup = facts(SIGNUP_EMAIL, "TRANSACTION_EMAIL");
  const sched = signup.find((c) => c.kind === "PROMO_CREDIT_SCHEDULE")!;

  it("signup yields a source-bound $18.75 x 24 schedule and required plan", () => {
    expect(sched).toMatchObject({ amountCents: 1875, periodCount: 24, evidenceBinding: "VALID", decisionEligibility: "AUTO_DETERMINISTIC" });
    expect(signup.find((c) => c.kind === "REQUIRED_PLAN")).toMatchObject({ textValue: "Premium Plus", decisionEligibility: "AUTO_DETERMINISTIC" });
  });

  it("month 22 missing is detected, 23-24 are not due", () => {
    const sts = [...Array.from({ length: 21 }, (_, i) => statement(i + 1, "present")), statement(22, "absent")];
    const monthKey = (p: number) => { const m = billMonth(p); return `${m.year}-${String(m.month).padStart(2, "0")}`; };
    sts.forEach((s, i) => expect(s.statementMonth).toBe(monthKey(i + 1)));
    const anchor = deriveScheduleStart(sts, null);
    expect(anchor).toMatchObject({ status: "ANCHORED", startMonth: { year: 2024, month: 12 } });
    const start = anchor.status === "ANCHORED" ? anchor.startMonth : null;
    const schedule = generateMonthlyCreditSchedule({ amountCents: 1875, currency: "USD", periodCount: 24, startMonth: start });
    const r = reconcileCreditSchedule(schedule, sts.map((s, i) => toObservedStatement(`s${i + 1}`, s, start)));
    expect(r.overallOutcome).toBe("MATERIAL_DIFFERENCE");
    expect(r.counts.MATCH).toBe(21);
    expect(r.periods[21]).toMatchObject({ outcome: "MATERIAL_DIFFERENCE", reasonCode: "CREDIT_LINE_ABSENT" });
    expect(r.periods[22].outcome).toBe("NOT_DUE");
    expect(r.observedMissingCents).toBe(1875);
    expect(r.remainingScheduledCents).toBe(5625);

    const later = statement(23, "present", true);
    const all = [...sts, later].map((s, i) => toObservedStatement(`s${i + 1}`, s, start));
    const v = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: all });
    expect(v.result).toBe("VERIFIED_FIXED");
    expect(v.verifiedRestoredCents).toBe(3750);
    const stillMissing = [...sts, statement(23, "absent")].map((s, i) => toObservedStatement(`s${i + 1}`, s, start));
    expect(verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: stillMissing }).result).toBe("STILL_MISMATCHED");
  });

  it("control: page rewritten, same terms => no material change", () => {
    const cmp = comparePageFacts({ t0Hash: "a", tnHash: "b", t0Facts: facts(OFFER_PAGE_A, "FIRST_PARTY_PUBLIC_PAGE"), tnFacts: facts(OFFER_PAGE_B, "FIRST_PARTY_PUBLIC_PAGE") });
    expect(cmp.rawSourceChanged).toBe(true);
    expect(cmp.outcome).toBe("NO_MATERIAL_CHANGE");
  });

  it("real change: credit and duration reduced => material change", () => {
    const cmp = comparePageFacts({ t0Hash: "a", tnHash: "c", t0Facts: facts(OFFER_PAGE_A, "FIRST_PARTY_PUBLIC_PAGE"), tnFacts: facts(OFFER_PAGE_C, "FIRST_PARTY_PUBLIC_PAGE") });
    expect(cmp.outcome).toBe("MATERIAL_CHANGE");
    expect(cmp.diffs.filter((d) => d.material).map((d) => d.kind).sort()).toEqual(["DURATION_MONTHS", "PROMO_CREDIT_SCHEDULE"]);
  });

  it("refusal: marketplace seller vs retailer-direct policy => not established", () => {
    const tx = parsePromiseFixture(MARKETPLACE_RECEIPT)!;
    const policy = parsePromiseFixture(RETAILER_RETURN_POLICY)!;
    expect(decideApplicability(tx.transactionContext, policy.policyScope).outcome).toBe("NOT_ESTABLISHED");
  });
});

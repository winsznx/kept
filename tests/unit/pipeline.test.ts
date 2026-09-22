import { describe, expect, it } from "vitest";
import type { BillObservation, CommitmentExtraction } from "../../convex/lib/aiSchemas";
import { SIGNUP_EMAIL, billText } from "../../convex/fixtures/canonical";
import { buildCommitments, buildStatement, decideApplicability, deriveScheduleStart, toObservedStatement } from "../../convex/lib/pipeline";

const baseExtraction = (commitments: CommitmentExtraction["commitments"]): CommitmentExtraction => ({
  sourceClassification: "TRANSACTION_EMAIL",
  providerName: "Brightline Wireless",
  productOrPlanName: "Premium Plus",
  transactionDateText: "November 18, 2024",
  transactionDateIso: "2024-11-18",
  transactionContext: { sellerType: "PROVIDER_DIRECT", region: null, productIdentifier: null, evidence: [] },
  policyScope: { appliesToSeller: "NOT_STATED", region: null, productScope: null, evidence: [] },
  commitments,
  unknowns: [],
});

const credit = (excerpt: string, amountCents = 1875, confidence: "high" | "low" = "high") => ({
  kind: "PROMO_CREDIT_SCHEDULE" as const,
  label: "Monthly device credit",
  value: { type: "money" as const, currency: "USD", amountCents },
  cadence: "monthly" as const,
  periodCount: 24,
  conditions: [],
  effectiveStartText: null,
  effectiveEndText: null,
  confidence,
  evidence: [{ excerpt, page: null, sectionHint: null }],
  ambiguity: null,
});

describe("evidence-bound commitment building", () => {
  it("accepts a literal excerpt containing the value as AUTO_DETERMINISTIC", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $18.75 monthly bill credit for 24 months")]), SIGNUP_EMAIL, "TRANSACTION_EMAIL");
    expect(c.evidenceBinding).toBe("VALID");
    expect(c.decisionEligibility).toBe("AUTO_DETERMINISTIC");
    expect(c.key).toBe("PROMO_CREDIT_SCHEDULE");
  });

  it("rejects a fabricated excerpt (Campaign I: unsupported AI assertion)", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $25.00 monthly bill credit for 36 months", 2500)]), SIGNUP_EMAIL, "TRANSACTION_EMAIL");
    expect(c.evidenceBinding).toBe("FAILED");
    expect(c.decisionEligibility).toBe("REJECTED");
  });

  it("an excerpt that exists but lacks the claimed value is only PARTIAL", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $18.75 monthly bill credit for 24 months", 2500)]), SIGNUP_EMAIL, "TRANSACTION_EMAIL");
    expect(c.evidenceBinding).toBe("PARTIAL");
    expect(c.decisionEligibility).toBe("REVIEW_REQUIRED");
  });

  it("an excerpt from a different source does not bind", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $18.75 monthly bill credit for 24 months")]), "Unrelated statement text with $18.75 somewhere", "TRANSACTION_EMAIL");
    expect(c.decisionEligibility).toBe("REJECTED");
  });

  it("no evidence at all is rejected; high model confidence can't override", () => {
    const x = { ...credit("x"), evidence: [] };
    const [c] = buildCommitments(baseExtraction([x]), SIGNUP_EMAIL, "TRANSACTION_EMAIL");
    expect(c.decisionEligibility).toBe("REJECTED");
  });

  it("low confidence becomes review even with valid binding", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $18.75 monthly bill credit for 24 months", 1875, "low")]), SIGNUP_EMAIL, "TRANSACTION_EMAIL");
    expect(c.decisionEligibility).toBe("REVIEW_REQUIRED");
  });

  it("secondary web sources are display-only", () => {
    const [c] = buildCommitments(baseExtraction([credit("You'll receive a $18.75 monthly bill credit for 24 months")]), SIGNUP_EMAIL, "SECONDARY_PUBLIC_PAGE");
    expect(c.decisionEligibility).toBe("DISPLAY_ONLY");
  });
});

function billObs(period: number, withCredit: boolean): BillObservation {
  const lines: BillObservation["lineItems"] = [
    { normalizedLabel: "plan", originalLabel: "Premium Plus unlimited plan (1 line)", amountCents: 8500, currency: "USD", category: "BASE_PLAN", installmentIndex: null, installmentCount: null, relatesToCommitmentKey: null, evidence: [{ excerpt: "Premium Plus unlimited plan (1 line)", page: null, sectionHint: null }], confidence: "high" },
  ];
  if (withCredit) {
    lines.push({ normalizedLabel: "promo credit", originalLabel: `Device Promo Credit (${period} of 24)`, amountCents: -1875, currency: "USD", category: "PROMO_CREDIT", installmentIndex: period, installmentCount: 24, relatesToCommitmentKey: "PROMO_CREDIT_SCHEDULE", evidence: [{ excerpt: `Device Promo Credit (${period} of 24)                            -$18.75`, page: null, sectionHint: null }], confidence: "high" });
  }
  return { isBillOrStatement: true, providerName: "Brightline Wireless", statementDateIso: null, servicePeriodStartIso: null, servicePeriodEndIso: null, statementMonthIso: null, planName: "Premium Plus", itemized: true, lineItems: lines, totalAmountCents: null, unknowns: [] };
}

describe("bill building and anchoring", () => {
  it("binds a promo credit line (whitespace-normalized) and marks it YES", () => {
    const st = buildStatement(billObs(5, true), billText({ period: 5, credit: "present" }), "PROMO_CREDIT_SCHEDULE");
    const line = st.lines.find((l) => l.category === "PROMO_CREDIT")!;
    expect(line.evidenceBinding).toBe("VALID");
    expect(line.matchesCommitment).toBe("YES");
  });

  it("an unattributed promo credit is ambiguous, never silently ignored", () => {
    const o = billObs(5, true);
    o.lineItems[1].relatesToCommitmentKey = null;
    const st = buildStatement(o, billText({ period: 5, credit: "present" }), "PROMO_CREDIT_SCHEDULE");
    expect(st.lines[1].matchesCommitment).toBe("AMBIGUOUS");
  });

  it("derives the start month from installment labels and ignores one-time back-credit indices", () => {
    const anchor = deriveScheduleStart(
      [
        { statementMonth: "2025-04", lines: [{ category: "PROMO_CREDIT", matchesCommitment: "YES", installmentIndex: 5 }] },
        { statementMonth: "2026-10", lines: [{ category: "PROMO_CREDIT", matchesCommitment: "YES", installmentIndex: 23 }, { category: "ONE_TIME_CREDIT", matchesCommitment: "YES", installmentIndex: 22 }] },
      ],
      null,
    );
    expect(anchor).toEqual({ status: "ANCHORED", startMonth: { year: 2024, month: 12 }, source: "INSTALLMENT_LABELS" });
  });

  it("inconsistent installment labels are a conflict", () => {
    const anchor = deriveScheduleStart(
      [
        { statementMonth: "2025-04", lines: [{ category: "PROMO_CREDIT", matchesCommitment: "YES", installmentIndex: 5 }] },
        { statementMonth: "2025-05", lines: [{ category: "PROMO_CREDIT", matchesCommitment: "YES", installmentIndex: 9 }] },
      ],
      null,
    );
    expect(anchor.status).toBe("CONFLICT");
  });

  it("maps statements to periods from the anchor", () => {
    const st = buildStatement(billObs(22, false), billText({ period: 22, credit: "absent" }), "PROMO_CREDIT_SCHEDULE");
    const obs = toObservedStatement("s22", { statementMonth: "2026-09", itemized: st.itemized, lines: st.lines }, { year: 2024, month: 12 });
    expect(obs.periodIndex).toBe(22);
    expect(obs.creditLines).toHaveLength(0);
  });
});

describe("applicability refusal", () => {
  const policy = { appliesToSeller: "PROVIDER_DIRECT_ONLY" as const, region: null, productScope: null, evidence: [] };
  it("marketplace seller vs provider-direct policy is not established", () => {
    const r = decideApplicability({ sellerType: "THIRD_PARTY_MARKETPLACE_SELLER", region: null, productIdentifier: null, evidence: [] }, policy);
    expect(r.outcome).toBe("NOT_ESTABLISHED");
  });
  it("unknown seller abstains", () => {
    expect(decideApplicability(null, policy).outcome).toBe("NOT_ESTABLISHED");
  });
  it("provider-direct purchase under provider-direct policy applies", () => {
    expect(decideApplicability({ sellerType: "PROVIDER_DIRECT", region: null, productIdentifier: null, evidence: [] }, policy).outcome).toBe("APPLIES");
  });
});

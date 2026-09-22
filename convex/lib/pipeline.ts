import type { BillObservation, CommitmentCandidate, CommitmentExtraction } from "./aiSchemas";
import {
  bindEvidence,
  decideEligibility,
  normalizeForBinding,
  type CommitmentKind,
  type Confidence,
  type DecisionEligibility,
  type DecisiveValue,
  type EvidenceBinding,
  type SourceClass,
} from "./evidence";
import { assignFactKeys } from "./factCompare";
import { formatCents } from "./money";
import type { LineMatch, ObservedStatement } from "./reconcile";
import { addMonths, parseYearMonth, type YearMonth } from "./schedule";

export const MECHANISM_VERSION = "kept-mech-2";

const CONF: Record<"high" | "medium" | "low", Confidence> = { high: "HIGH", medium: "MEDIUM", low: "LOW" };

export type BuiltEvidence = { excerpt: string; page: number | null; sectionHint: string | null; bindingValidated: boolean };

export type BuiltCommitment = {
  kind: CommitmentKind;
  key: string;
  label: string;
  valueType: "MONEY" | "INTEGER" | "DATE" | "TEXT" | "BOOLEAN";
  currency: string | null;
  amountCents: number | null;
  integerValue: number | null;
  dateValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  cadence: "MONTHLY" | "ONE_TIME" | "ANNUAL" | "UNKNOWN" | null;
  periodCount: number | null;
  effectiveStartAt: number | null;
  effectiveEndAt: number | null;
  effectiveStartText: string | null;
  confidence: Confidence;
  evidenceBinding: EvidenceBinding;
  decisionEligibility: DecisionEligibility;
  ambiguity: string | null;
  conditions: string[];
  evidence: BuiltEvidence[];
};

function parseIsoDate(iso: string | null): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

function decisiveValueOf(c: CommitmentCandidate): DecisiveValue {
  const v = c.value;
  switch (v.type) {
    case "money":
      return { type: "money", amountCents: v.amountCents };
    case "integer":
      return { type: "integer", value: v.value };
    case "date":
      return { type: "date", originalText: v.originalText, isoDate: v.isoDate };
    case "text":
      return { type: "text", value: v.value };
    case "boolean":
      return { type: "boolean", value: v.value };
  }
}

const EXCERPT_MAX = 800;

/**
 * Turns a model extraction into commitment rows. Code, not the model, decides
 * evidence binding and decision eligibility (PRD FR-009, §8.4). Excerpts that fail
 * the literal check are kept with bindingValidated=false for audit but never make a
 * commitment AUTO_DETERMINISTIC.
 */
export function buildCommitments(extraction: CommitmentExtraction, sourceText: string, sourceClass: SourceClass): BuiltCommitment[] {
  const built = extraction.commitments.map((c): Omit<BuiltCommitment, "key"> => {
    const value = decisiveValueOf(c);
    const excerpts = c.evidence.map((e) => e.excerpt).filter((e) => e.length <= EXCERPT_MAX);
    const binding = excerpts.length === 0 ? { binding: "FAILED" as const, excerptResults: [], valueBound: false } : bindEvidence({ value, excerpts, sourceText });
    const foundSet = new Set(binding.excerptResults.filter((r) => r.found).map((r) => r.excerpt));
    const dateValue = c.value.type === "date" ? parseIsoDate(c.value.isoDate) : null;
    const confidence = CONF[c.confidence];
    let eligibility = decideEligibility({
      kind: c.kind,
      binding: binding.binding,
      confidence,
      ambiguity: c.ambiguity,
      sourceClass,
      valueType: value.type,
      dateResolved: c.value.type === "date" ? dateValue !== null : undefined,
    });
    // Schedules need a positive period count and money value to be decidable.
    if (eligibility === "AUTO_DETERMINISTIC" && c.kind === "PROMO_CREDIT_SCHEDULE" && (c.value.type !== "money" || !c.periodCount || c.periodCount < 1 || c.periodCount > 120)) {
      eligibility = "REVIEW_REQUIRED";
    }
    const cadence = c.cadence === null ? null : (c.cadence.toUpperCase() as BuiltCommitment["cadence"]);
    return {
      kind: c.kind,
      label: c.label.slice(0, 200),
      valueType: c.value.type.toUpperCase() as BuiltCommitment["valueType"],
      currency: c.value.type === "money" ? c.value.currency.toUpperCase().slice(0, 3) : null,
      amountCents: c.value.type === "money" ? Math.abs(c.value.amountCents) : null,
      integerValue: c.value.type === "integer" ? c.value.value : null,
      dateValue,
      textValue: c.value.type === "text" ? c.value.value.slice(0, 300) : c.value.type === "date" ? c.value.originalText.slice(0, 300) : null,
      booleanValue: c.value.type === "boolean" ? c.value.value : null,
      cadence,
      periodCount: c.periodCount,
      effectiveStartAt: null,
      effectiveEndAt: null,
      effectiveStartText: c.effectiveStartText,
      confidence,
      evidenceBinding: binding.binding,
      decisionEligibility: eligibility,
      ambiguity: c.ambiguity,
      conditions: c.conditions.map((s) => s.slice(0, 300)).slice(0, 20),
      evidence: c.evidence.map((e) => ({
        excerpt: e.excerpt.slice(0, EXCERPT_MAX),
        page: e.page,
        sectionHint: e.sectionHint ? e.sectionHint.slice(0, 200) : null,
        bindingValidated: foundSet.has(e.excerpt),
      })),
    };
  });
  return assignFactKeys(built);
}

export function commitmentSummary(c: Pick<BuiltCommitment, "valueType" | "amountCents" | "currency" | "integerValue" | "textValue" | "cadence" | "periodCount">): string {
  switch (c.valueType) {
    case "MONEY":
      return `${formatCents(c.amountCents ?? 0, c.currency ?? "USD")}${c.cadence === "MONTHLY" ? " / month" : ""}${c.periodCount ? ` × ${c.periodCount}` : ""}`;
    case "INTEGER":
      return String(c.integerValue);
    default:
      return c.textValue ?? "";
  }
}

export type BuiltLine = {
  key: string;
  label: string;
  category: string;
  amountCents: number | null;
  currency: string | null;
  installmentIndex: number | null;
  installmentCount: number | null;
  relatesToCommitmentKey: string | null;
  matchesCommitment: LineMatch;
  confidence: Confidence;
  evidenceExcerpt: string | null;
  evidenceBinding: EvidenceBinding;
  decisionEligibility: DecisionEligibility;
};

export type BuiltStatement = {
  statementMonth: string | null;
  statementDateIso: string | null;
  servicePeriodStartIso: string | null;
  servicePeriodEndIso: string | null;
  planName: string | null;
  providerName: string | null;
  itemized: boolean;
  totalAmountCents: number | null;
  lines: BuiltLine[];
};

/**
 * Validates bill line items against the source and decides, in code, which lines
 * are the scheduled promotional credit for `scheduleKey`. A line counts as YES only
 * when it is a PROMO_CREDIT, the model related it to the commitment with
 * medium/high confidence, and its amount is literally present in a bound excerpt.
 */
export function buildStatement(bill: BillObservation, sourceText: string, scheduleKey: string | null): BuiltStatement {
  const lines = bill.lineItems.map((li, i): BuiltLine => {
    const excerpts = li.evidence.map((e) => e.excerpt).filter((e) => e.length <= EXCERPT_MAX);
    const binding =
      li.amountCents === null || excerpts.length === 0
        ? { binding: (excerpts.some((e) => normalizeForBinding(sourceText).includes(normalizeForBinding(e))) ? "PARTIAL" : "FAILED") as EvidenceBinding }
        : bindEvidence({ value: { type: "money", amountCents: li.amountCents }, excerpts, sourceText });
    const confidence = CONF[li.confidence];
    const isCandidate = (li.category === "PROMO_CREDIT" || li.category === "ONE_TIME_CREDIT") && scheduleKey !== null && li.relatesToCommitmentKey === scheduleKey;
    let match: LineMatch = "NO";
    if (isCandidate) {
      if (binding.binding === "VALID" && confidence !== "LOW") match = "YES";
      else match = "AMBIGUOUS";
    } else if (li.category === "PROMO_CREDIT" && scheduleKey !== null && li.relatesToCommitmentKey === null) {
      // An unattributed promo credit on a plan with a tracked schedule is not silently ignored.
      match = "AMBIGUOUS";
    }
    return {
      key: `LINE:${i}`,
      label: li.originalLabel.slice(0, 200),
      category: li.category,
      amountCents: li.amountCents,
      currency: li.currency ? li.currency.toUpperCase().slice(0, 3) : null,
      installmentIndex: li.installmentIndex,
      installmentCount: li.installmentCount,
      relatesToCommitmentKey: li.relatesToCommitmentKey,
      matchesCommitment: match,
      confidence,
      evidenceExcerpt: li.evidence[0]?.excerpt.slice(0, EXCERPT_MAX) ?? null,
      evidenceBinding: binding.binding,
      decisionEligibility: binding.binding === "VALID" ? (confidence === "LOW" ? "REVIEW_REQUIRED" : "AUTO_DETERMINISTIC") : binding.binding === "PARTIAL" ? "REVIEW_REQUIRED" : "REJECTED",
    };
  });
  const month = parseYearMonth(bill.statementMonthIso);
  return {
    statementMonth: month ? `${month.year}-${String(month.month).padStart(2, "0")}` : null,
    statementDateIso: bill.statementDateIso,
    servicePeriodStartIso: bill.servicePeriodStartIso,
    servicePeriodEndIso: bill.servicePeriodEndIso,
    planName: bill.planName,
    providerName: bill.providerName,
    itemized: bill.itemized && bill.lineItems.length > 0,
    totalAmountCents: bill.totalAmountCents,
    lines,
  };
}

const ONE_TIME_LABEL = /\b(adjust(ment|ed)?|missed|back[- ]?credit|retro(active)?|one[- ]time|courtesy|goodwill|re-?applied)\b/i;

/**
 * Deterministic line-identity rule applied on top of model categories: a credit whose
 * printed label says it is an adjustment/back-credit is one-time, even if the model
 * called it a recurring promo credit. Only its schedule role changes; amount,
 * evidence and binding are untouched.
 */
export function effectiveCategory(line: Pick<BuiltLine, "category" | "label">): string {
  if ((line.category === "PROMO_CREDIT" || line.category === "OTHER") && ONE_TIME_LABEL.test(line.label)) return "ONE_TIME_CREDIT";
  return line.category;
}

export type AnchorResult =
  | { status: "ANCHORED"; startMonth: YearMonth; source: "INSTALLMENT_LABELS" | "RECORDED_START" }
  | { status: "CONFLICT"; reason: string }
  | { status: "UNKNOWN" };

/**
 * Derives the schedule's first billing month from explicit "k of N" credit labels on
 * statements. Every labelled statement must imply the same start month, otherwise
 * the result is CONFLICT and reconciliation abstains.
 */
export function deriveScheduleStart(
  statements: readonly { statementMonth: string | null; lines: readonly Pick<BuiltLine, "matchesCommitment" | "installmentIndex" | "category" | "label">[] }[],
  recordedStart: string | null,
): AnchorResult {
  const implied = new Set<string>();
  for (const s of statements) {
    const ym = parseYearMonth(s.statementMonth);
    if (!ym) continue;
    for (const l of s.lines) {
      if (effectiveCategory(l) === "PROMO_CREDIT" && l.matchesCommitment === "YES" && l.installmentIndex !== null && l.installmentIndex >= 1) {
        const start = addMonths(ym, -(l.installmentIndex - 1));
        implied.add(`${start.year}-${String(start.month).padStart(2, "0")}`);
      }
    }
  }
  const recorded = parseYearMonth(recordedStart);
  if (recorded) implied.add(`${recorded.year}-${String(recorded.month).padStart(2, "0")}`);
  if (implied.size === 0) return { status: "UNKNOWN" };
  if (implied.size > 1) return { status: "CONFLICT", reason: `Statements imply different start months: ${[...implied].sort().join(", ")}` };
  const only = parseYearMonth([...implied][0])!;
  return { status: "ANCHORED", startMonth: only, source: recorded ? "RECORDED_START" : "INSTALLMENT_LABELS" };
}

export function toObservedStatement(
  statementKey: string,
  s: { statementMonth: string | null; itemized: boolean; lines: readonly BuiltLine[] },
  startMonth: YearMonth | null,
  expectedAmountCents: number | null = null,
): ObservedStatement {
  const ym = parseYearMonth(s.statementMonth);
  const periodIndex = startMonth && ym ? ym.year * 12 + ym.month - (startMonth.year * 12 + startMonth.month) + 1 : null;
  const recurring = s.lines.filter((l) => effectiveCategory(l) === "PROMO_CREDIT");
  const oneTime = s.lines.filter((l) => effectiveCategory(l) === "ONE_TIME_CREDIT");
  const creditLines = recurring.map((l) => ({ lineId: l.key, amountCents: l.amountCents ?? 0, currency: l.currency ?? "USD", matchesCommitment: l.matchesCommitment }));
  // A credit for exactly the promised amount that isn't identified as the promotion is
  // ambiguous: Kept asks for review instead of calling the credit missing.
  if (expectedAmountCents !== null && !creditLines.some((l) => l.matchesCommitment === "YES")) {
    for (const l of s.lines) {
      if (recurring.includes(l) || l.matchesCommitment === "YES" || l.amountCents === null) continue;
      if (l.amountCents === -Math.abs(expectedAmountCents)) creditLines.push({ lineId: l.key, amountCents: l.amountCents, currency: l.currency ?? "USD", matchesCommitment: "AMBIGUOUS" });
    }
  }
  return {
    statementKey,
    periodIndex,
    itemized: s.itemized,
    creditLines,
    adjustmentLines: oneTime.map((l) => ({ lineId: l.key, amountCents: l.amountCents ?? 0, currency: l.currency ?? "USD", matchesCommitment: l.matchesCommitment })),
  };
}

export type ApplicabilityOutcome = "APPLIES" | "NOT_ESTABLISHED" | "DOES_NOT_APPLY";

/**
 * Deterministic applicability of a policy source to a transaction (refusal path).
 * Kept only concludes APPLIES when the policy explicitly covers the transaction's
 * seller channel; an unstated scope or unknown seller abstains.
 */
export function decideApplicability(
  tx: CommitmentExtraction["transactionContext"] | null,
  policy: CommitmentExtraction["policyScope"],
): { outcome: ApplicabilityOutcome; reasons: string[] } {
  const reasons: string[] = [];
  if (!tx || tx.sellerType === "UNKNOWN") reasons.push("The transaction record doesn't establish who sold the item.");
  if (policy.appliesToSeller === "NOT_STATED") reasons.push("The policy page doesn't say which sellers it covers.");
  if (reasons.length > 0) return { outcome: "NOT_ESTABLISHED", reasons };
  if (policy.appliesToSeller === "PROVIDER_DIRECT_ONLY" && tx!.sellerType !== "PROVIDER_DIRECT") {
    return {
      outcome: "NOT_ESTABLISHED",
      reasons: ["The policy covers items sold directly by the provider; this purchase was from a different seller, whose own policy isn't in the evidence."],
    };
  }
  if (policy.region && tx!.region && policy.region.trim().toLowerCase() !== tx!.region.trim().toLowerCase()) {
    return { outcome: "NOT_ESTABLISHED", reasons: [`The policy is for ${policy.region}; the purchase was in ${tx!.region}.`] };
  }
  return { outcome: "APPLIES", reasons: ["The policy's stated seller scope covers this purchase."] };
}

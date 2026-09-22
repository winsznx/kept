import type { CommitmentKind, DecisionEligibility } from "./evidence";

export type NormalizedFact = {
  kind: CommitmentKind;
  label: string;
  valueType: "MONEY" | "INTEGER" | "DATE" | "TEXT" | "BOOLEAN";
  amountCents: number | null;
  currency: string | null;
  integerValue: number | null;
  dateValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  periodCount: number | null;
  decisionEligibility: DecisionEligibility;
};

export type FactChange = "UNCHANGED" | "CHANGED" | "MISSING_IN_CURRENT" | "NEW_IN_CURRENT";

export type FactDiff = {
  key: string;
  kind: CommitmentKind;
  label: string;
  change: FactChange;
  before: string | null;
  after: string | null;
  material: boolean;
};

export type PageChangeOutcome = "NO_MATERIAL_CHANGE" | "MATERIAL_CHANGE" | "INSUFFICIENT_EVIDENCE";

export type PageComparison = {
  rawSourceChanged: boolean;
  materialCommercialChange: boolean;
  outcome: PageChangeOutcome;
  diffs: FactDiff[];
};

const COMPARABLE_KINDS: ReadonlySet<CommitmentKind> = new Set([
  "PROMO_CREDIT_FIXED",
  "PROMO_CREDIT_SCHEDULE",
  "PROMO_PRICE_FIXED",
  "PROMO_PRICE_MAX",
  "DURATION_MONTHS",
  "EFFECTIVE_END_DATE",
  "REQUIRED_PLAN",
  "REBATE_DEADLINE",
  "RETURN_DEADLINE",
  "TRADE_IN_AMOUNT",
]);

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Plan names compare without generic suffix words ("Premium Plus plan" == "Premium Plus"). */
export function normalizePlanName(value: string): string {
  return normalizeText(value)
    .replace(/\b(the|plan|plans|rate|unlimited plan|or higher|or above|or any higher plan)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(label: string): string {
  return normalizeText(label).replace(/ /g, "-").slice(0, 60);
}

/**
 * Stable comparison keys. A kind that appears once is keyed by kind alone so that
 * relabelled/reworded copy still lines up; repeated kinds fall back to kind+label.
 */
export function assignFactKeys<T extends { kind: CommitmentKind; label: string }>(facts: readonly T[]): (T & { key: string })[] {
  const counts = new Map<CommitmentKind, number>();
  for (const f of facts) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
  return facts.map((f) => ({ ...f, key: (counts.get(f.kind) ?? 0) > 1 ? `${f.kind}:${slug(f.label)}` : f.kind }));
}

export function renderFactValue(f: NormalizedFact): string {
  switch (f.valueType) {
    case "MONEY":
      return `${f.currency ?? "?"} ${f.amountCents ?? "?"}c${f.periodCount ? ` x${f.periodCount}` : ""}`;
    case "INTEGER":
      return String(f.integerValue);
    case "DATE":
      return f.dateValue === null ? "unknown date" : new Date(f.dateValue).toISOString().slice(0, 10);
    case "TEXT":
      return f.kind === "REQUIRED_PLAN" ? normalizePlanName(f.textValue ?? "") : normalizeText(f.textValue ?? "");
    case "BOOLEAN":
      return String(f.booleanValue);
  }
}

function usable(f: NormalizedFact): boolean {
  return COMPARABLE_KINDS.has(f.kind) && (f.decisionEligibility === "AUTO_DETERMINISTIC" || f.decisionEligibility === "REVIEW_REQUIRED");
}

/**
 * Compares normalized commercial facts from a T0 and a Tn capture of the same public
 * source (PRD FR-014, 9.9). Raw text differences never count on their own. A fact
 * missing from the current capture is insufficient evidence, not a removal.
 */
export function comparePageFacts(input: {
  t0Hash: string;
  tnHash: string;
  t0Facts: readonly NormalizedFact[];
  tnFacts: readonly NormalizedFact[];
}): PageComparison {
  const before = new Map(assignFactKeys(input.t0Facts.filter(usable)).map((f) => [f.key, f]));
  const after = new Map(assignFactKeys(input.tnFacts.filter(usable)).map((f) => [f.key, f]));
  const diffs: FactDiff[] = [];

  // The same duration can be stated on its own or inside the credit schedule; a
  // standalone duration missing on one side is satisfied by the other side's schedule.
  const schedulePeriods = (m: Map<string, NormalizedFact>) => [...m.values()].filter((f) => f.kind === "PROMO_CREDIT_SCHEDULE").map((f) => f.periodCount);
  for (const [key, f] of before) {
    const g = after.get(key);
    if (!g && f.kind === "DURATION_MONTHS" && schedulePeriods(after).includes(f.integerValue)) {
      diffs.push({ key, kind: f.kind, label: f.label, change: "UNCHANGED", before: renderFactValue(f), after: `${f.integerValue} (in credit schedule)`, material: false });
      continue;
    }
    if (!g) {
      diffs.push({ key, kind: f.kind, label: f.label, change: "MISSING_IN_CURRENT", before: renderFactValue(f), after: null, material: false });
      continue;
    }
    const a = renderFactValue(f);
    const b = renderFactValue(g);
    diffs.push({ key, kind: f.kind, label: f.label, change: a === b ? "UNCHANGED" : "CHANGED", before: a, after: b, material: a !== b });
  }
  for (const [key, g] of after) {
    if (!before.has(key) && g.kind === "DURATION_MONTHS" && schedulePeriods(before).includes(g.integerValue)) continue;
    if (!before.has(key)) {
      diffs.push({ key, kind: g.kind, label: g.label, change: "NEW_IN_CURRENT", before: null, after: renderFactValue(g), material: false });
    }
  }

  const materialCommercialChange = diffs.some((d) => d.material);
  const missing = diffs.some((d) => d.change === "MISSING_IN_CURRENT");
  let outcome: PageChangeOutcome;
  if (materialCommercialChange) outcome = "MATERIAL_CHANGE";
  else if (missing || before.size === 0) outcome = "INSUFFICIENT_EVIDENCE";
  else outcome = "NO_MATERIAL_CHANGE";

  return { rawSourceChanged: input.t0Hash !== input.tnHash, materialCommercialChange, outcome, diffs };
}

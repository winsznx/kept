import { moneyRenderings } from "./money";

export type EvidenceBinding = "VALID" | "PARTIAL" | "FAILED";
export type DecisionEligibility = "AUTO_DETERMINISTIC" | "DISPLAY_ONLY" | "REVIEW_REQUIRED" | "REJECTED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export const MIN_EXCERPT_CHARS = 6;

/**
 * Normalization applied identically to source text and model excerpts before the
 * literal-substring check. It only removes presentation noise (whitespace runs,
 * typographic quotes/dashes, markdown emphasis/escape characters, case). It never
 * removes digits, currency symbols, or words, so a fabricated amount cannot bind.
 */
export function normalizeForBinding(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1")
    .replace(/[*_`#>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function excerptIsInSource(excerpt: string, source: string): boolean {
  const e = normalizeForBinding(excerpt);
  if (e.length < MIN_EXCERPT_CHARS) return false;
  return normalizeForBinding(source).includes(e);
}

export type DecisiveValue =
  | { type: "money"; amountCents: number }
  | { type: "integer"; value: number }
  | { type: "date"; originalText: string; isoDate: string | null }
  | { type: "text"; value: string }
  | { type: "boolean"; value: boolean };

/** Does the decisive value itself literally appear in a bound excerpt? */
export function valueAppearsInExcerpt(value: DecisiveValue, excerpt: string): boolean {
  const e = normalizeForBinding(excerpt);
  switch (value.type) {
    case "money":
      return moneyRenderings(value.amountCents).some((r) => e.includes(normalizeForBinding(r)));
    case "integer":
      return new RegExp(`(^|[^\\d.])${Math.abs(value.value)}([^\\d]|$)`).test(e);
    case "date":
      return value.originalText.trim().length > 0 && e.includes(normalizeForBinding(value.originalText));
    case "text":
      return value.value.trim().length > 0 && e.includes(normalizeForBinding(value.value));
    case "boolean":
      return false;
  }
}

export type BindingInput = {
  value: DecisiveValue;
  excerpts: readonly string[];
  sourceText: string;
};

export type BindingResult = {
  binding: EvidenceBinding;
  excerptResults: { excerpt: string; found: boolean }[];
  valueBound: boolean;
};

/**
 * VALID: at least one excerpt is a literal substring of the source AND the decisive
 * value appears inside a found excerpt. PARTIAL: an excerpt is found but the value
 * is not literally present in it. FAILED: no excerpt is found (or none supplied).
 */
export function bindEvidence({ value, excerpts, sourceText }: BindingInput): BindingResult {
  const excerptResults = excerpts.map((excerpt) => ({ excerpt, found: excerptIsInSource(excerpt, sourceText) }));
  const found = excerptResults.filter((r) => r.found);
  if (found.length === 0) return { binding: "FAILED", excerptResults, valueBound: false };
  const valueBound = found.some((r) => valueAppearsInExcerpt(value, r.excerpt));
  return { binding: valueBound ? "VALID" : "PARTIAL", excerptResults, valueBound };
}

export type SourceClass =
  | "TRANSACTION_EMAIL"
  | "TRANSACTION_RECEIPT"
  | "CONTRACT_OR_ORDER"
  | "BILL_OR_STATEMENT"
  | "FIRST_PARTY_PUBLIC_PAGE"
  | "FIRST_PARTY_SUPPORT_REPLY"
  | "USER_ASSERTION"
  | "SECONDARY_PUBLIC_PAGE"
  | "UNKNOWN_SOURCE";

export type CommitmentKind =
  | "PROMO_CREDIT_FIXED"
  | "PROMO_CREDIT_SCHEDULE"
  | "PROMO_PRICE_FIXED"
  | "PROMO_PRICE_MAX"
  | "DURATION_MONTHS"
  | "EFFECTIVE_END_DATE"
  | "REQUIRED_PLAN"
  | "REBATE_DEADLINE"
  | "RETURN_DEADLINE"
  | "TRADE_IN_AMOUNT"
  | "OTHER_TEXTUAL";

const DECISION_SOURCE_CLASSES: ReadonlySet<SourceClass> = new Set([
  "TRANSACTION_EMAIL",
  "TRANSACTION_RECEIPT",
  "CONTRACT_OR_ORDER",
  "BILL_OR_STATEMENT",
  "FIRST_PARTY_PUBLIC_PAGE",
]);

/**
 * Code decides whether an extracted fact may drive a deterministic decision.
 * Model confidence can only lower eligibility, never override failed binding.
 */
export function decideEligibility(input: {
  kind: CommitmentKind;
  binding: EvidenceBinding;
  confidence: Confidence;
  ambiguity: string | null;
  sourceClass: SourceClass;
  valueType: DecisiveValue["type"];
  dateResolved?: boolean;
}): DecisionEligibility {
  if (input.binding === "FAILED") return "REJECTED";
  if (input.kind === "OTHER_TEXTUAL") return "DISPLAY_ONLY";
  if (!DECISION_SOURCE_CLASSES.has(input.sourceClass)) return "DISPLAY_ONLY";
  if (input.binding === "PARTIAL") return "REVIEW_REQUIRED";
  if (input.confidence === "LOW" || (input.ambiguity && input.ambiguity.trim().length > 0)) return "REVIEW_REQUIRED";
  if (input.valueType === "date" && input.dateResolved !== true) return "REVIEW_REQUIRED";
  if (input.valueType === "boolean") return "REVIEW_REQUIRED";
  return "AUTO_DETERMINISTIC";
}

/** Provenance rank from PRD 8.2; lower is stronger. */
export function provenanceRank(sourceClass: SourceClass, capturedAtTransactionTime: boolean): number {
  switch (sourceClass) {
    case "CONTRACT_OR_ORDER":
    case "TRANSACTION_EMAIL":
    case "TRANSACTION_RECEIPT":
      return 1;
    case "BILL_OR_STATEMENT":
      return 2;
    case "FIRST_PARTY_PUBLIC_PAGE":
      return capturedAtTransactionTime ? 3 : 5;
    case "FIRST_PARTY_SUPPORT_REPLY":
      return 4;
    case "USER_ASSERTION":
      return 6;
    case "SECONDARY_PUBLIC_PAGE":
      return 7;
    case "UNKNOWN_SOURCE":
      return 8;
  }
}

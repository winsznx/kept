import { z } from "zod";

/**
 * Strict Structured Outputs schemas (PRD §11). Constraints the API rejects
 * (minLength/maxLength) are enforced in code after parsing instead; every field is
 * required and optional values are nullable, per current OpenAI strict-mode rules.
 */
export const SCHEMA_VERSION = "kept-extract-v1";

export const EvidenceRef = z.object({
  excerpt: z.string().describe("Exact contiguous text copied from the source, 6-400 characters. Never paraphrase."),
  page: z.number().int().nullable(),
  sectionHint: z.string().nullable(),
});

const MoneyValue = z.object({ type: z.literal("money"), currency: z.string(), amountCents: z.number().int() });
const IntegerValue = z.object({ type: z.literal("integer"), value: z.number().int(), unit: z.string().nullable() });
const DateValue = z.object({ type: z.literal("date"), isoDate: z.string().nullable(), originalText: z.string() });
const TextValue = z.object({ type: z.literal("text"), value: z.string() });
const BooleanValue = z.object({ type: z.literal("boolean"), value: z.boolean() });

export const SOURCE_CLASSES = [
  "TRANSACTION_EMAIL",
  "TRANSACTION_RECEIPT",
  "CONTRACT_OR_ORDER",
  "BILL_OR_STATEMENT",
  "FIRST_PARTY_PUBLIC_PAGE",
  "FIRST_PARTY_SUPPORT_REPLY",
  "USER_ASSERTION",
  "SECONDARY_PUBLIC_PAGE",
  "UNKNOWN_SOURCE",
] as const;

export const COMMITMENT_KINDS = [
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
  "OTHER_TEXTUAL",
] as const;

export const CommitmentCandidate = z.object({
  kind: z.enum(COMMITMENT_KINDS),
  label: z.string(),
  value: z.discriminatedUnion("type", [MoneyValue, IntegerValue, DateValue, TextValue, BooleanValue]),
  cadence: z.enum(["monthly", "one_time", "annual", "unknown"]).nullable(),
  periodCount: z.number().int().nullable(),
  conditions: z.array(z.string()).max(20),
  effectiveStartText: z.string().nullable(),
  effectiveEndText: z.string().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(EvidenceRef).max(5),
  ambiguity: z.string().nullable(),
});

export const CommitmentExtraction = z.object({
  sourceClassification: z.enum(SOURCE_CLASSES),
  providerName: z.string().nullable(),
  productOrPlanName: z.string().nullable(),
  transactionDateText: z.string().nullable(),
  transactionDateIso: z.string().nullable(),
  transactionContext: z.object({
    sellerType: z.enum(["PROVIDER_DIRECT", "THIRD_PARTY_MARKETPLACE_SELLER", "AUTHORIZED_RETAILER", "UNKNOWN"]),
    region: z.string().nullable(),
    productIdentifier: z.string().nullable(),
    evidence: z.array(EvidenceRef).max(3),
  }),
  policyScope: z.object({
    appliesToSeller: z.enum(["PROVIDER_DIRECT_ONLY", "ANY_SELLER", "NOT_STATED"]),
    region: z.string().nullable(),
    productScope: z.string().nullable(),
    evidence: z.array(EvidenceRef).max(3),
  }),
  commitments: z.array(CommitmentCandidate).max(50),
  unknowns: z.array(z.string()).max(30),
});
export type CommitmentExtraction = z.infer<typeof CommitmentExtraction>;
export type CommitmentCandidate = z.infer<typeof CommitmentCandidate>;

export const BILL_CATEGORIES = ["BASE_PLAN", "DEVICE_PAYMENT", "PROMO_CREDIT", "ONE_TIME_CREDIT", "TAX", "FEE", "ADD_ON", "OTHER"] as const;

export const BillLineItem = z.object({
  normalizedLabel: z.string(),
  originalLabel: z.string(),
  amountCents: z.number().int().nullable().describe("Signed as printed: credits negative, charges positive."),
  currency: z.string().nullable(),
  category: z.enum(BILL_CATEGORIES),
  installmentIndex: z.number().int().nullable().describe("k in an explicit 'k of N' / 'k/N' label on this line, else null."),
  installmentCount: z.number().int().nullable(),
  relatesToCommitmentKey: z.string().nullable().describe("Key of the recorded commitment this line delivers, or null."),
  evidence: z.array(EvidenceRef).max(3),
  confidence: z.enum(["high", "medium", "low"]),
});

export const BillObservation = z.object({
  isBillOrStatement: z.boolean(),
  providerName: z.string().nullable(),
  statementDateIso: z.string().nullable(),
  servicePeriodStartIso: z.string().nullable(),
  servicePeriodEndIso: z.string().nullable(),
  statementMonthIso: z.string().nullable().describe("YYYY-MM of the billing month this statement covers, only if explicit."),
  planName: z.string().nullable(),
  itemized: z.boolean().describe("True only if individual charges and credits are listed, not just a total."),
  lineItems: z.array(BillLineItem).max(100),
  totalAmountCents: z.number().int().nullable(),
  unknowns: z.array(z.string()).max(30),
});
export type BillObservation = z.infer<typeof BillObservation>;

export const ASSERTION_TYPES = [
  "PLAN_CHANGED",
  "PROMOTION_EXPIRED",
  "ELIGIBILITY_LOST",
  "CREDIT_WILL_BE_RESTORED",
  "CREDIT_ALREADY_APPLIED",
  "ONE_TIME_ADJUSTMENT",
  "REQUEST_MORE_INFORMATION",
  "DENIAL",
  "OTHER",
] as const;

export const SupportReplyExtraction = z.object({
  assertions: z
    .array(
      z.object({
        assertionType: z.enum(ASSERTION_TYPES),
        assertion: z.string(),
        evidence: z.array(EvidenceRef).max(3),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(10),
  asksForInformation: z.array(z.string()).max(10),
});
export type SupportReplyExtraction = z.infer<typeof SupportReplyExtraction>;

export const InboundClassification = z.object({
  classification: z.enum(["SIGNUP_OR_ORDER", "BILL_OR_STATEMENT", "SUPPORT_REPLY", "UNRELATED", "UNKNOWN"]),
  providerName: z.string().nullable(),
  reason: z.string(),
});
export type InboundClassification = z.infer<typeof InboundClassification>;

export const CaseDraft = z.object({
  subject: z.string(),
  plainTextBody: z.string(),
  claimsUsed: z
    .array(
      z.object({
        factId: z.string().describe("id of the packet fact this sentence relies on"),
        textInDraft: z.string(),
      }),
    )
    .max(20),
});
export type CaseDraft = z.infer<typeof CaseDraft>;

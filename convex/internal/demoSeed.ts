import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { MARKETPLACE_RECEIPT, OFFER_PAGE_A, OFFER_PAGE_B, RETAILER_RETURN_POLICY, SIGNUP_EMAIL, billText } from "../fixtures/canonical";
import { parseBillFixture, parsePromiseFixture } from "../fixtures/fixtureParser";
import { SCHEMA_VERSION } from "../lib/aiSchemas";
import { excerptIsInSource, type SourceClass } from "../lib/evidence";
import { canonicalizeSourceText, sha256Hex } from "../lib/hashing";
import { buildCommitments, buildStatement, decideApplicability } from "../lib/pipeline";

/**
 * Seeds and advances the public demo using Kept's real Convex pipeline mutations.
 * Sources are synthetic fixtures parsed by the deterministic fixture parser (the
 * NO_OPENAI path), so the demo never spends sponsor credits and is fully reproducible.
 */
export const FIXTURE_MODEL_ID = "fixture-parser-v1";
const OFFER_URI = "https://brightline-wireless.example/offers/aurora-x15";
const RETURNS_URI = "https://brightline-wireless.example/returns";

async function ingestPromise(ctx: ActionCtx, workspaceId: Id<"workspaces">, itemId: Id<"protectedItems">, text: string, sourceClass: SourceClass, uri: string | null, capturedAt: number): Promise<void> {
  const canonical = canonicalizeSourceText(text);
  const parsed = parsePromiseFixture(canonical);
  const captureId = await ctx.runMutation(internal.internal.ingest.createCapture, {
    workspaceId,
    protectedItemId: itemId,
    sourceClass,
    sourceUri: uri,
    sourceDomain: uri ? new URL(uri).hostname : null,
    isFirstParty: uri ? sourceClass === "FIRST_PARTY_PUBLIC_PAGE" : null,
    discovered: false,
    documentId: null,
    normalizedText: canonical,
    rawTextStorageId: null,
    contentSha256: await sha256Hex(canonical),
    capturedAt,
    firecrawlMetadataJson: uri ? JSON.stringify({ title: "Synthetic fixture page", synthetic: true }) : null,
  });
  if (!parsed) {
    await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "NEEDS_REVIEW", failureCode: "NO_SUPPORTED_COMMITMENT", modelId: FIXTURE_MODEL_ID, schemaVersion: SCHEMA_VERSION, unknowns: [] });
    return;
  }
  const built = buildCommitments(parsed, canonical, sourceClass);
  let applicability = null;
  if (uri && parsed.policyScope.appliesToSeller !== "NOT_STATED") {
    const tx = await ctx.runQuery(internal.internal.ingest.transactionContextForItem, { protectedItemId: itemId });
    const bound = parsed.policyScope.evidence.some((e) => excerptIsInSource(e.excerpt, canonical));
    const decision = bound ? decideApplicability(tx?.context ?? null, parsed.policyScope) : { outcome: "NOT_ESTABLISHED" as const, reasons: ["The policy's seller scope couldn't be tied to the page text."] };
    applicability = { ...decision, transactionCaptureId: tx?.captureId ?? null };
  }
  const txDate = parsed.transactionDateIso && parsed.transactionDateText && excerptIsInSource(parsed.transactionDateText, canonical) ? Date.parse(`${parsed.transactionDateIso}T00:00:00Z`) : null;
  const txBound = !uri && parsed.transactionContext.sellerType !== "UNKNOWN" && parsed.transactionContext.evidence.some((e) => excerptIsInSource(e.excerpt, canonical));
  await ctx.runMutation(internal.internal.ingest.applyCommitments, {
    sourceCaptureId: captureId,
    sourceClass,
    providerName: parsed.providerName,
    productName: parsed.productOrPlanName,
    transactionAt: txDate,
    commitments: built,
    modelId: FIXTURE_MODEL_ID,
    schemaVersion: SCHEMA_VERSION,
    applicability,
    transactionContextJson: txBound ? JSON.stringify(parsed.transactionContext) : null,
  });
  const auto = built.filter((c) => c.decisionEligibility === "AUTO_DETERMINISTIC").length;
  await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: auto > 0 || applicability ? "PARSED" : "NEEDS_REVIEW", failureCode: null, modelId: FIXTURE_MODEL_ID, schemaVersion: SCHEMA_VERSION, unknowns: [] });
}

async function ingestBill(ctx: ActionCtx, workspaceId: Id<"workspaces">, itemId: Id<"protectedItems">, text: string, capturedAt: number): Promise<void> {
  const canonical = canonicalizeSourceText(text);
  const keys = await ctx.runQuery(internal.internal.ingest.commitmentKeysForItem, { protectedItemId: itemId });
  const scheduleKey = keys.find((k) => k.kind === "PROMO_CREDIT_SCHEDULE" && k.decisionEligibility === "AUTO_DETERMINISTIC")?.key ?? null;
  const captureId = await ctx.runMutation(internal.internal.ingest.createCapture, {
    workspaceId,
    protectedItemId: itemId,
    sourceClass: "BILL_OR_STATEMENT",
    sourceUri: null,
    sourceDomain: null,
    isFirstParty: null,
    discovered: false,
    documentId: null,
    normalizedText: canonical,
    rawTextStorageId: null,
    contentSha256: await sha256Hex(canonical),
    capturedAt,
    firecrawlMetadataJson: null,
  });
  const st = buildStatement(parseBillFixture(canonical, scheduleKey), canonical, scheduleKey);
  await ctx.runMutation(internal.internal.ingest.applyStatement, {
    sourceCaptureId: captureId,
    statementMonth: st.statementMonth,
    statementDateIso: st.statementDateIso,
    servicePeriodStartIso: null,
    servicePeriodEndIso: null,
    planName: st.planName,
    providerName: st.providerName,
    itemized: st.itemized,
    totalAmountCents: st.totalAmountCents,
    lines: st.lines,
    modelId: FIXTURE_MODEL_ID,
  });
  await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "PARSED", failureCode: null, modelId: FIXTURE_MODEL_ID, schemaVersion: SCHEMA_VERSION, unknowns: [] });
}

const DAY = 86_400_000;

export const seed = internalAction({
  args: { workspaceId: v.id("workspaces"), mainItemId: v.id("protectedItems"), controlItemId: v.id("protectedItems"), refusalItemId: v.id("protectedItems") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const signupAt = Date.UTC(2024, 10, 18);
    await ingestPromise(ctx, a.workspaceId, a.mainItemId, SIGNUP_EMAIL, "TRANSACTION_EMAIL", null, signupAt);
    await ingestPromise(ctx, a.workspaceId, a.mainItemId, OFFER_PAGE_A, "FIRST_PARTY_PUBLIC_PAGE", OFFER_URI, signupAt);
    for (let p = 1; p <= 21; p++) {
      await ingestBill(ctx, a.workspaceId, a.mainItemId, billText({ period: p, credit: "present" }), signupAt + (p + 1) * 30 * DAY);
      if (p % 7 === 0 || p === 21) await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: a.mainItemId, trigger: "SOURCE_INGESTED" });
    }

    await ingestPromise(ctx, a.workspaceId, a.controlItemId, OFFER_PAGE_A, "FIRST_PARTY_PUBLIC_PAGE", OFFER_URI, signupAt);
    await ingestPromise(ctx, a.workspaceId, a.controlItemId, OFFER_PAGE_B, "FIRST_PARTY_PUBLIC_PAGE", OFFER_URI, Date.now());
    await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: a.controlItemId, trigger: "SOURCE_REFRESH" });

    await ingestPromise(ctx, a.workspaceId, a.refusalItemId, MARKETPLACE_RECEIPT, "TRANSACTION_RECEIPT", null, Date.UTC(2026, 2, 3));
    await ingestPromise(ctx, a.workspaceId, a.refusalItemId, RETAILER_RETURN_POLICY, "FIRST_PARTY_PUBLIC_PAGE", RETURNS_URI, Date.now());
    await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: a.refusalItemId, trigger: "SOURCE_INGESTED" });
    await ctx.runMutation(internal.demo.markSeeded, { workspaceId: a.workspaceId });
    return null;
  },
});

export const addBill = internalAction({
  args: { workspaceId: v.id("workspaces"), itemId: v.id("protectedItems"), period: v.number(), credit: v.union(v.literal("present"), v.literal("absent")), backCredit: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ingestBill(ctx, a.workspaceId, a.itemId, billText({ period: a.period, credit: a.credit, backCredit: a.backCredit }), Date.now());
    await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: a.itemId, trigger: "SOURCE_INGESTED" });
    await ctx.runMutation(internal.demo.finishStep, { workspaceId: a.workspaceId });
    return null;
  },
});

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireProtectedItem } from "./lib/authz";

/** Everything the item detail, Then vs Now, and timeline screens need, owner-scoped. */
export async function itemView(ctx: QueryCtx, item: Doc<"protectedItems">) {
  const itemId = item._id;
  const captures = await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", itemId)).order("asc").take(200);
  const parses = new Map<Id<"sourceCaptures">, Doc<"captureParses">>();
  for (const c of captures) {
    const p = await ctx.db.query("captureParses").withIndex("by_source", (q) => q.eq("sourceCaptureId", c._id)).order("desc").first();
    if (p) parses.set(c._id, p);
  }
  const commitmentsRaw = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", itemId)).take(200);
  const commitments = await Promise.all(
    commitmentsRaw.map(async (c) => ({
      ...c,
      evidence: (await ctx.db.query("commitmentEvidence").withIndex("by_commitment", (q) => q.eq("commitmentId", c._id)).take(5)).map((e) => ({ excerpt: e.excerpt, bindingValidated: e.bindingValidated, page: e.page })),
      conditions: (await ctx.db.query("commitmentConditions").withIndex("by_commitment", (q) => q.eq("commitmentId", c._id)).take(20)).map((x) => x.conditionText),
    })),
  );
  const expectedEvents = await ctx.db.query("expectedEvents").withIndex("by_item_expectedAt", (q) => q.eq("protectedItemId", itemId)).take(300);
  const statementsRaw = await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(200);
  const statements = await Promise.all(
    statementsRaw.map(async (s) => ({
      ...s,
      lines: (await ctx.db.query("observations").withIndex("by_statement", (q) => q.eq("statementId", s._id)).take(120))
        .filter((o) => o.observationType === "BILL_LINE_ITEM")
        .map((o) => ({ _id: o._id, label: o.label, category: o.category, amountCents: o.amountCents, currency: o.currency, installmentIndex: o.integerValue, matchesCommitment: o.matchesCommitment, evidenceExcerpt: o.evidenceExcerpt, evidenceBinding: o.evidenceBinding })),
    })),
  );
  const reconciliation = item.latestReconciliationId ? await ctx.db.get(item.latestReconciliationId) : null;
  const findings = reconciliation ? await ctx.db.query("reconciliationFindings").withIndex("by_reconciliation", (q) => q.eq("reconciliationId", reconciliation._id)).take(200) : [];
  const pageComparisons = await ctx.db.query("pageComparisons").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(20);
  const applicability = await ctx.db.query("applicabilityChecks").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(10);
  const jobs = await ctx.db.query("jobs").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(10);
  const cases = await ctx.db.query("cases").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(10);
  const verifications = await ctx.db.query("resolutionVerifications").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("asc").take(50);
  const recHistory = await ctx.db.query("reconciliations").withIndex("by_item_startedAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(30);

  return {
    item: {
      _id: item._id,
      providerName: item.providerName,
      productName: item.productName,
      category: item.category,
      status: item.status,
      resolutionState: item.resolutionState,
      transactionAt: item.transactionAt,
      protectedAt: item.protectedAt,
      createdAt: item.createdAt,
      routingToken: item.routingToken,
      scheduleStartMonth: item.scheduleStartMonth,
    },
    captures: captures.map((c) => ({
      _id: c._id,
      sourceClass: c.sourceClass,
      sourceUri: c.sourceUri,
      sourceDomain: c.sourceDomain,
      isFirstParty: c.isFirstParty,
      contentSha256: c.contentSha256,
      capturedAt: c.capturedAt,
      transactionAt: c.transactionAt,
      provenanceRank: c.provenanceRank,
      previousCaptureId: c.previousCaptureId,
      hasText: c.normalizedText !== null,
      title: c.firecrawlMetadataJson ? ((JSON.parse(c.firecrawlMetadataJson) as { title?: string | null }).title ?? null) : null,
      parseStatus: parses.get(c._id)?.status ?? "PENDING",
      parseFailureCode: parses.get(c._id)?.failureCode ?? null,
      modelId: parses.get(c._id)?.modelId ?? null,
      unknowns: parses.get(c._id)?.unknowns ?? [],
    })),
    commitments: commitments.map((c) => ({
      _id: c._id,
      sourceCaptureId: c.sourceCaptureId,
      kind: c.kind,
      key: c.key,
      label: c.label,
      valueType: c.valueType,
      currency: c.currency,
      amountCents: c.amountCents,
      integerValue: c.integerValue,
      dateValue: c.dateValue,
      textValue: c.textValue,
      cadence: c.cadence,
      periodCount: c.periodCount,
      confidence: c.confidence,
      evidenceBinding: c.evidenceBinding,
      decisionEligibility: c.decisionEligibility,
      ambiguity: c.ambiguity,
      modelId: c.modelId,
      evidence: c.evidence,
      conditions: c.conditions,
    })),
    expectedEvents: expectedEvents
      .map((e) => ({ _id: e._id, commitmentId: e.commitmentId, periodIndex: e.periodIndex, expectedAt: e.expectedAt, expectedAmountCents: e.expectedAmountCents, currency: e.currency, status: e.status }))
      .sort((a, b) => (a.periodIndex ?? 0) - (b.periodIndex ?? 0)),
    statements: statements
      .map((s) => ({ _id: s._id, sourceCaptureId: s.sourceCaptureId, statementMonth: s.statementMonth, statementDateIso: s.statementDateIso, planName: s.planName, itemized: s.itemized, totalAmountCents: s.totalAmountCents, createdAt: s.createdAt, lines: s.lines }))
      .sort((a, b) => (a.statementMonth ?? "").localeCompare(b.statementMonth ?? "") || a.createdAt - b.createdAt),
    reconciliation: reconciliation
      ? {
          _id: reconciliation._id,
          overallOutcome: reconciliation.overallOutcome,
          observedDifferenceCents: reconciliation.observedDifferenceCents,
          remainingScheduledValueCents: reconciliation.remainingScheduledValueCents,
          observedReceivedCents: reconciliation.observedReceivedCents,
          notYetDueCents: reconciliation.notYetDueCents,
          latestObservedPeriod: reconciliation.latestObservedPeriod,
          periodCount: reconciliation.periodCount,
          currency: reconciliation.currency,
          completedAt: reconciliation.completedAt,
          failureCode: reconciliation.failureCode,
          mechanismVersion: reconciliation.mechanismVersion,
        }
      : null,
    findings: findings
      .map((f) => ({ _id: f._id, periodIndex: f.periodIndex, statementId: f.statementId, outcome: f.outcome, expectedDisplay: f.expectedDisplay, observedDisplay: f.observedDisplay, amountDeltaCents: f.amountDeltaCents, reasonCode: f.reasonCode, explanation: f.explanation, material: f.material }))
      .sort((a, b) => (a.periodIndex ?? 0) - (b.periodIndex ?? 0)),
    reconciliationHistory: recHistory.map((r) => ({ _id: r._id, overallOutcome: r.overallOutcome, startedAt: r.startedAt, triggerType: r.triggerType, latestObservedPeriod: r.latestObservedPeriod })),
    pageComparisons: pageComparisons.map((p) => ({ _id: p._id, t0CaptureId: p.t0CaptureId, tnCaptureId: p.tnCaptureId, rawSourceChanged: p.rawSourceChanged, materialCommercialChange: p.materialCommercialChange, outcome: p.outcome, diffs: JSON.parse(p.diffsJson) as { key: string; label: string; change: string; before: string | null; after: string | null; material: boolean }[], createdAt: p.createdAt })),
    applicability: applicability.map((a) => ({ _id: a._id, outcome: a.outcome, reasons: a.reasons, policyCaptureId: a.policyCaptureId, createdAt: a.createdAt })),
    jobs: jobs.map((j) => ({ _id: j._id, type: j.type, status: j.status, step: j.step, progress: j.progress, failureCode: j.failureCode, safeMessage: j.safeMessage, createdAt: j.createdAt, updatedAt: j.updatedAt })),
    cases: cases.map((c) => ({ _id: c._id, status: c.status, resolutionState: c.resolutionState, createdAt: c.createdAt })),
    verifications: verifications.map((x) => ({ _id: x._id, caseId: x.caseId, result: x.result, verifiedRestoredCents: x.verifiedRestoredCents, currency: x.currency, expectedPeriodKey: x.expectedPeriodKey, createdAt: x.createdAt })),
  };
}

export type ItemView = Awaited<ReturnType<typeof itemView>>;

export const getMine = query({
  args: { itemId: v.id("protectedItems") },
  handler: async (ctx, { itemId }) => {
    const { item } = await requireProtectedItem(ctx, itemId);
    return await itemView(ctx, item);
  },
});

/** Bounded source text for the evidence drawer. Owner-only; never a storage URL. */
export const captureText = query({
  args: { itemId: v.id("protectedItems"), captureId: v.id("sourceCaptures") },
  returns: v.union(v.null(), v.object({ text: v.string(), truncated: v.boolean() })),
  handler: async (ctx, { itemId, captureId }) => {
    await requireProtectedItem(ctx, itemId);
    const cap = await ctx.db.get(captureId);
    if (!cap || cap.protectedItemId !== itemId || cap.normalizedText === null) return null;
    return { text: cap.normalizedText.slice(0, 30000), truncated: cap.normalizedText.length > 30000 };
  },
});

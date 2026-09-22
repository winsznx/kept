import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { sha256Hex } from "./lib/hashing";

/**
 * Sanitized, publicly inspectable run records behind /proof and /proof/run/:runId.
 * Payloads are written only by internal functions from persisted run state and must
 * never contain addresses, message bodies, or private document text.
 */
const runSummary = v.object({ slug: v.string(), title: v.string(), kind: v.union(v.literal("LIVE"), v.literal("REPLAY"), v.literal("FIXTURE")), createdAt: v.number(), payloadSha256: v.string() });

export const listRuns = query({
  args: {},
  returns: v.array(runSummary),
  handler: async (ctx) => {
    const rows = await ctx.db.query("proofRuns").order("desc").take(50);
    return rows.map((r) => ({ slug: r.slug, title: r.title, kind: r.kind, createdAt: r.createdAt, payloadSha256: r.payloadSha256 }));
  },
});

export const getRun = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({ slug: v.string(), title: v.string(), kind: v.union(v.literal("LIVE"), v.literal("REPLAY"), v.literal("FIXTURE")), commitSha: v.union(v.string(), v.null()), createdAt: v.number(), payloadJson: v.string(), payloadSha256: v.string() })),
  handler: async (ctx, { slug }) => {
    const r = await ctx.db.query("proofRuns").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    return r ? { slug: r.slug, title: r.title, kind: r.kind, commitSha: r.commitSha, createdAt: r.createdAt, payloadJson: r.payloadJson, payloadSha256: r.payloadSha256 } : null;
  },
});

const ADDRESS_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Records a Firecrawl capture proof from persisted sourceCaptures rows (metadata and hashes only). */
export const recordCaptureProof = internalMutation({
  args: { slug: v.string(), title: v.string(), itemId: v.id("protectedItems"), commitSha: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const caps = await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", a.itemId)).take(20);
    const payload = {
      type: "FIRECRAWL_CAPTURE",
      captures: caps.map((c) => ({
        captureId: c._id,
        domain: c.sourceDomain,
        uri: c.sourceUri,
        sourceClass: c.sourceClass,
        isFirstParty: c.isFirstParty,
        capturedAt: c.capturedAt,
        contentSha256: c.contentSha256,
        characters: c.normalizedText?.length ?? 0,
        previousCaptureId: c.previousCaptureId,
        firecrawl: c.firecrawlMetadataJson ? JSON.parse(c.firecrawlMetadataJson) : null,
      })),
    };
    const payloadJson = JSON.stringify(payload);
    if (ADDRESS_RE.test(payloadJson)) throw new Error("refusing to publish address-shaped data");
    const existing = await ctx.db.query("proofRuns").withIndex("by_slug", (q) => q.eq("slug", a.slug)).unique();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("proofRuns", { slug: a.slug, title: a.title, kind: "LIVE", commitSha: a.commitSha, payloadJson, payloadSha256: await sha256Hex(payloadJson), createdAt: Date.now() });
    return null;
  },
});

/**
 * Records the complete live loop for one item/case from persisted rows: captures,
 * source-bound commitments, statements, reconciliation, case events, provider
 * claims, verification, and sponsor call telemetry. Address-shaped text is refused.
 */
export const recordLoopProof = internalMutation({
  args: { slug: v.string(), title: v.string(), itemId: v.id("protectedItems"), caseId: v.id("cases"), commitSha: v.union(v.string(), v.null()) },
  returns: v.string(),
  handler: async (ctx, a) => {
    const item = await ctx.db.get(a.itemId);
    const kase = await ctx.db.get(a.caseId);
    if (!item || !kase || kase.protectedItemId !== item._id) throw new Error("NOT_FOUND");
    const caps = await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", item._id)).take(50);
    const commitments = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", item._id)).take(50);
    const commitmentRows = [];
    for (const c of commitments) {
      const ev = await ctx.db.query("commitmentEvidence").withIndex("by_commitment", (q) => q.eq("commitmentId", c._id)).take(3);
      commitmentRows.push({ kind: c.kind, amountCents: c.amountCents, integerValue: c.integerValue, textValue: c.textValue, periodCount: c.periodCount, evidenceBinding: c.evidenceBinding, decisionEligibility: c.decisionEligibility, modelId: c.modelId, excerpt: ev[0]?.excerpt ?? null, excerptFoundInSource: ev[0]?.bindingValidated ?? false });
    }
    const statements = await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", item._id)).take(50);
    const statementRows = [];
    for (const s of statements) {
      const obs = await ctx.db.query("observations").withIndex("by_statement", (q) => q.eq("statementId", s._id)).take(50);
      statementRows.push({ statementMonth: s.statementMonth, itemized: s.itemized, modelId: s.modelId, creditLines: obs.filter((o) => o.category === "PROMO_CREDIT" || o.category === "ONE_TIME_CREDIT").map((o) => ({ label: o.label, amountCents: o.amountCents, modelCategory: o.category, matchesCommitment: o.matchesCommitment, evidenceBinding: o.evidenceBinding })) });
    }
    const recs = await ctx.db.query("reconciliations").withIndex("by_item_startedAt", (q) => q.eq("protectedItemId", item._id)).take(100);
    const events = await ctx.db.query("caseEvents").withIndex("by_case_createdAt", (q) => q.eq("caseId", kase._id)).take(100);
    const assertions = await ctx.db.query("providerAssertions").withIndex("by_case", (q) => q.eq("caseId", kase._id)).take(20);
    const verifications = await ctx.db.query("resolutionVerifications").withIndex("by_case_createdAt", (q) => q.eq("caseId", kase._id)).take(20);
    const packet = await ctx.db.query("caseEvidencePackets").withIndex("by_case_version", (q) => q.eq("caseId", kase._id)).take(5);
    const origins = new Map<string, string>();
    for (const c of caps) {
      const doc = c.documentId ? await ctx.db.get(c.documentId) : null;
      origins.set(c._id, doc?.agentmailMessageId ? "AGENTMAIL_INBOUND" : doc ? "PASTED_OR_UPLOADED" : c.sourceUri ? "FIRECRAWL" : "OTHER");
    }
    const calls = await ctx.db.query("externalCalls").withIndex("by_createdAt").order("desc").take(500);
    const mine = calls.filter((c) => c.workspaceId === item.workspaceId && c.createdAt >= item.createdAt - 60_000);
    const payload = {
      type: "LIVE_LOOP",
      deployment: "production",
      synthetic: "All documents are synthetic fixtures for the fictional provider Brightline Wireless. Mail travelled over real AgentMail inboxes controlled by the builder; addresses are withheld.",
      item: { status: item.status, resolutionState: item.resolutionState, createdAt: item.createdAt },
      captures: caps.map((c) => ({ sourceClass: c.sourceClass, capturedAt: c.capturedAt, contentSha256: c.contentSha256, origin: origins.get(c._id) ?? "OTHER" })),
      commitments: commitmentRows,
      statements: statementRows.sort((x, y) => (x.statementMonth ?? "").localeCompare(y.statementMonth ?? "")),
      reconciliations: recs.map((r) => ({ at: r.startedAt, trigger: r.triggerType, outcome: r.overallOutcome, outstandingMissingCents: r.observedDifferenceCents, remainingScheduledCents: r.remainingScheduledValueCents, latestObservedPeriod: r.latestObservedPeriod, failureCode: r.failureCode, mechanismVersion: r.mechanismVersion })),
      case: { status: kase.status, resolutionState: kase.resolutionState, draftSource: kase.draftSource, approvedAt: kase.approvedAt, sentViaAgentMail: kase.agentmailOutboundId !== null, packetSha256: packet[0]?.payloadSha256 ?? null },
      caseEvents: events.map((e) => ({ at: e.createdAt, type: e.type, summary: e.summary })),
      providerClaims: assertions.map((x) => ({ type: x.assertionType, excerpt: x.excerpt, quoteFoundInReply: x.bindingValidated, assessment: x.assessment })),
      verifications: verifications.map((x) => ({ at: x.createdAt, result: x.result, verifiedRestoredCents: x.verifiedRestoredCents })),
      sponsorCalls: mine.map((c) => ({ at: c.createdAt, provider: c.provider, operation: c.operation, status: c.status, modelId: c.modelId, latencyMs: c.latencyMs })),
    };
    const payloadJson = JSON.stringify(payload);
    if (ADDRESS_RE.test(payloadJson)) throw new Error("refusing to publish address-shaped data");
    const existing = await ctx.db.query("proofRuns").withIndex("by_slug", (q) => q.eq("slug", a.slug)).unique();
    if (existing) await ctx.db.delete(existing._id);
    const payloadSha256 = await sha256Hex(payloadJson);
    await ctx.db.insert("proofRuns", { slug: a.slug, title: a.title, kind: "LIVE", commitSha: a.commitSha, payloadJson, payloadSha256, createdAt: Date.now() });
    return payloadSha256;
  },
});

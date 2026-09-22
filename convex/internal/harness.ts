import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";

/**
 * Internal-only harness for live sponsor checks and evaluation runs. Items live in a
 * DEMO-kind workspace named per purpose, never in a user's workspace, and nothing
 * here is reachable from the browser.
 */
async function harnessWorkspace(ctx: MutationCtx, name: string): Promise<Id<"workspaces">> {
  const existing = await ctx.db.query("workspaces").withIndex("by_kind_expiresAt", (q) => q.eq("kind", "DEMO").eq("expiresAt", null)).take(50);
  const found = existing.find((w) => w.name === name);
  if (found) return found._id;
  const now = Date.now();
  return await ctx.db.insert("workspaces", { ownerUserId: null, kind: "DEMO", name, agentmailInboxId: null, agentmailInboxAddress: null, demoSessionKeyHash: null, expiresAt: null, createdAt: now, updatedAt: now });
}

export const createItem = internalMutation({
  args: { workspaceName: v.string(), providerName: v.union(v.string(), v.null()), productName: v.union(v.string(), v.null()) },
  returns: v.object({ workspaceId: v.id("workspaces"), itemId: v.id("protectedItems") }),
  handler: async (ctx, a) => {
    const workspaceId = await harnessWorkspace(ctx, a.workspaceName);
    const now = Date.now();
    const itemId = await ctx.db.insert("protectedItems", {
      workspaceId,
      providerName: a.providerName,
      productName: a.productName,
      category: "MOBILE",
      status: "CAPTURING",
      transactionAt: null,
      protectedAt: null,
      primaryCurrency: "USD",
      summary: null,
      scheduleStartMonth: null,
      routingToken: `H${now.toString(36).toUpperCase().slice(-5)}`,
      transactionContextJson: null,
      transactionContextCaptureId: null,
      latestReconciliationId: null,
      resolutionState: "NONE",
      createdAt: now,
      updatedAt: now,
    });
    return { workspaceId, itemId };
  },
});

export const startSource = internalMutation({
  args: {
    itemId: v.id("protectedItems"),
    url: v.union(v.string(), v.null()),
    text: v.union(v.string(), v.null()),
    intent: v.union(v.literal("AUTO"), v.literal("PROMISE"), v.literal("BILL"), v.literal("REPLY")),
    caseId: v.union(v.id("cases"), v.null()),
  },
  returns: v.id("jobs"),
  handler: async (ctx, a) => {
    const item = await ctx.db.get(a.itemId);
    if (!item) throw new Error("NOT_FOUND");
    const ws = await ctx.db.get(item.workspaceId);
    if (!ws || ws.kind !== "DEMO") throw new Error("FORBIDDEN: harness only operates on DEMO workspaces");
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", { workspaceId: item.workspaceId, protectedItemId: a.itemId, caseId: a.caseId, type: "HARNESS", status: "QUEUED", step: "QUEUED", progress: 0, failureCode: null, safeMessage: null, createdAt: now, updatedAt: now });
    let input: { kind: "URL"; url: string } | { kind: "DOCUMENT"; documentId: Id<"documents"> };
    if (a.url) input = { kind: "URL", url: a.url };
    else {
      const documentId = await ctx.db.insert("documents", { workspaceId: item.workspaceId, protectedItemId: a.itemId, sourceCaptureId: null, sourceClass: "UNKNOWN_SOURCE", storageId: null, agentmailMessageId: null, agentmailThreadId: null, filename: null, mimeType: "text/plain", byteSize: a.text?.length ?? 0, sha256: null, originalText: a.text ?? "", status: "RECEIVED", createdAt: now });
      input = { kind: "DOCUMENT", documentId };
    }
    await ctx.scheduler.runAfter(0, internal.internal.sourceProcessing.run, { jobId, input, intent: a.intent, caseId: a.caseId, assignmentId: null });
    return jobId;
  },
});

export const job = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => await ctx.db.get(jobId),
});

export const captures = internalQuery({
  args: { itemId: v.id("protectedItems") },
  handler: async (ctx, { itemId }) =>
    (await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", itemId)).take(50)).map((c) => ({
      id: c._id,
      class: c.sourceClass,
      domain: c.sourceDomain,
      firstParty: c.isFirstParty,
      sha256: c.contentSha256,
      capturedAt: c.capturedAt,
      previous: c.previousCaptureId,
      chars: c.normalizedText?.length ?? 0,
      meta: c.firecrawlMetadataJson,
    })),
});

/** Internal only: the inbox id for a workspace, for live round-trip scripts. Never exposed to clients. */
export const workspaceInbox = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => (await ctx.db.get(workspaceId))?.agentmailInboxId ?? null,
});

export const inboundForWorkspace = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) =>
    (await ctx.db.query("inboundAssignments").withIndex("by_workspace_receivedAt", (q) => q.eq("workspaceId", workspaceId)).order("desc").take(20)).map((r) => ({
      id: r._id,
      subject: r.subject,
      fromDomain: r.fromDomain,
      classification: r.classification,
      assignmentStatus: r.assignmentStatus,
      processingStatus: r.processingStatus,
      caseId: r.caseId,
      receivedAt: r.receivedAt,
    })),
});

export const itemSummary = internalQuery({
  args: { itemId: v.id("protectedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId);
    if (!item) return null;
    const commitments = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", itemId)).take(50);
    const rec = item.latestReconciliationId ? await ctx.db.get(item.latestReconciliationId) : null;
    return {
      routingToken: item.routingToken,
      status: item.status,
      resolutionState: item.resolutionState,
      commitments: commitments.map((c) => `${c.kind} ${c.amountCents ?? c.integerValue ?? c.textValue} x${c.periodCount} ${c.evidenceBinding} ${c.decisionEligibility} ${c.modelId}`),
      reconciliation: rec ? { outcome: rec.overallOutcome, missing: rec.observedDifferenceCents, remaining: rec.remainingScheduledValueCents, latest: rec.latestObservedPeriod } : null,
    };
  },
});

export const latestStatementLines = internalQuery({
  args: { itemId: v.id("protectedItems") },
  handler: async (ctx, { itemId }) => {
    const sts = await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").take(1);
    if (!sts[0]) return null;
    const obs = await ctx.db.query("observations").withIndex("by_statement", (q) => q.eq("statementId", sts[0]._id)).take(50);
    return { month: sts[0].statementMonth, lines: obs.map((o) => `${o.category} | ${o.label} | ${o.amountCents} | idx=${o.integerValue} | ${o.matchesCommitment} | ${o.evidenceBinding}`) };
  },
});

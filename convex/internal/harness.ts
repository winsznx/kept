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

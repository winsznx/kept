import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { caseView, createCaseFor, demoReplaySend } from "./cases";
import { SUPPORT_REPLY_FIXED } from "./fixtures/canonical";
import { itemView } from "./items";
import { deleteItemCascade } from "./lib/cascade";
import { excerptIsInSource } from "./lib/evidence";
import { sha256Hex } from "./lib/hashing";

/**
 * Public demo (PRD §6.8, FR-022). Each visitor gets an isolated, expiring DEMO
 * workspace keyed by a random browser session key (stored hashed). Demo functions
 * only ever resolve DEMO workspaces, never crawl, and never send email.
 */
const SCENARIO = "brightline-24mo-v1";
const TTL_MS = 3 * 60 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 300;
const REPLY_EXCERPT = "The missed $18.75 credit will be applied and your credits will continue on your next bill.";

async function sessionFor(ctx: QueryCtx | MutationCtx, sessionKey: string): Promise<{ session: Doc<"demoSessions">; ws: Doc<"workspaces"> } | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(sessionKey)) throw new ConvexError({ code: "INVALID_INPUT", message: "Bad demo session." });
  const hash = await sha256Hex(`demo:${sessionKey}`);
  const session = await ctx.db.query("demoSessions").withIndex("by_key", (q) => q.eq("sessionKeyHash", hash)).unique();
  if (!session || session.status !== "ACTIVE") return null;
  const ws = await ctx.db.get(session.workspaceId);
  if (!ws || ws.kind !== "DEMO") return null;
  return { session, ws };
}

async function newItem(ctx: MutationCtx, workspaceId: Id<"workspaces">, providerName: string, productName: string, now: number, tag: string): Promise<Id<"protectedItems">> {
  return await ctx.db.insert("protectedItems", {
    workspaceId,
    providerName,
    productName,
    category: "MOBILE",
    status: "CAPTURING",
    transactionAt: null,
    protectedAt: null,
    primaryCurrency: "USD",
    summary: null,
    scheduleStartMonth: null,
    routingToken: `D${tag}${now.toString(36).toUpperCase().slice(-4)}`,
    transactionContextJson: null,
    transactionContextCaptureId: null,
    latestReconciliationId: null,
    resolutionState: "NONE",
    createdAt: now,
    updatedAt: now,
  });
}

export const start = mutation({
  args: { sessionKey: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionKey }) => {
    if (await sessionFor(ctx, sessionKey)) return null;
    const now = Date.now();
    const active = await ctx.db.query("demoSessions").withIndex("by_expiresAt", (q) => q.gt("expiresAt", now)).take(MAX_ACTIVE_SESSIONS);
    if (active.length >= MAX_ACTIVE_SESSIONS) throw new ConvexError({ code: "DEMO_LIMIT_REACHED", message: "The demo is busy. Try again in a few minutes." });
    const hash = await sha256Hex(`demo:${sessionKey}`);
    const workspaceId = await ctx.db.insert("workspaces", { ownerUserId: null, kind: "DEMO", name: "Public demo", agentmailInboxId: null, agentmailInboxAddress: null, demoSessionKeyHash: hash, expiresAt: now + TTL_MS, createdAt: now, updatedAt: now });
    const mainItemId = await newItem(ctx, workspaceId, "Brightline Wireless", "Aurora X15 device promotion", now, "M");
    const controlItemId = await newItem(ctx, workspaceId, "Brightline Wireless", "Offer page watch (control)", now + 1, "C");
    const refusalItemId = await newItem(ctx, workspaceId, "Harbor Market", "Marketplace phone return (refusal)", now + 2, "R");
    await ctx.db.insert("demoSessions", { sessionKeyHash: hash, workspaceId, status: "ACTIVE", scenarioVersion: SCENARIO, mainItemId, controlItemId, refusalItemId, step: "SEEDING", busy: true, expiresAt: now + TTL_MS, createdAt: now });
    await ctx.db.insert("productEvents", { workspaceId, name: "demo_started", createdAt: now });
    await ctx.scheduler.runAfter(0, internal.internal.demoSeed.seed, { workspaceId, mainItemId, controlItemId, refusalItemId });
    return null;
  },
});

export const markSeeded = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const session = await ctx.db.query("demoSessions").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).unique();
    if (session) await ctx.db.patch(session._id, { step: "ON_TRACK", busy: false });
    return null;
  },
});

export const finishStep = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const session = await ctx.db.query("demoSessions").withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId)).unique();
    if (!session) return null;
    const item = await ctx.db.get(session.mainItemId);
    const next: Doc<"demoSessions">["step"] =
      item?.resolutionState === "VERIFIED_FIXED" ? "VERIFIED" : item?.status === "MATERIAL_DIFFERENCE" ? "DRIFT" : session.step;
    await ctx.db.patch(session._id, { step: next, busy: false });
    if (next === "VERIFIED") await ctx.db.insert("productEvents", { workspaceId, name: "demo_completed", createdAt: Date.now() });
    return null;
  },
});

const step = v.union(v.literal("BILL_22"), v.literal("OPEN_CASE"), v.literal("SEND"), v.literal("REPLY"), v.literal("BILL_23"));

/** Advances the scripted scenario one step. Each step is only legal from the previous one. */
export const advance = mutation({
  args: { sessionKey: v.string(), step },
  returns: v.null(),
  handler: async (ctx, a) => {
    const found = await sessionFor(ctx, a.sessionKey);
    if (!found) throw new ConvexError({ code: "NOT_FOUND", message: "Demo session expired. Reload to start again." });
    const { session, ws } = found;
    if (session.busy) return null;
    const item = (await ctx.db.get(session.mainItemId))!;
    const kase = await ctx.db.query("cases").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", item._id)).order("desc").first();
    switch (a.step) {
      case "BILL_22":
        if (session.step !== "ON_TRACK") return null;
        await ctx.db.patch(session._id, { busy: true });
        await ctx.scheduler.runAfter(0, internal.internal.demoSeed.addBill, { workspaceId: ws._id, itemId: item._id, period: 22, credit: "absent", backCredit: false });
        return null;
      case "OPEN_CASE":
        if (session.step !== "DRIFT") return null;
        await createCaseFor(ctx, item, { modelDraft: false });
        await ctx.db.patch(session._id, { step: "CASE_DRAFT" });
        return null;
      case "SEND":
        if (session.step !== "CASE_DRAFT" || !kase) return null;
        await demoReplaySend(ctx, kase);
        await ctx.db.patch(session._id, { step: "WAITING_REPLY" });
        return null;
      case "REPLY": {
        if (session.step !== "WAITING_REPLY" || !kase?.agentmailThreadId) return null;
        const now = Date.now();
        const messageId = `demo-reply-${kase._id}`;
        const documentId = await ctx.db.insert("documents", { workspaceId: ws._id, protectedItemId: item._id, sourceCaptureId: null, sourceClass: "FIRST_PARTY_SUPPORT_REPLY", storageId: null, agentmailMessageId: messageId, agentmailThreadId: kase.agentmailThreadId, filename: null, mimeType: "text/plain", byteSize: SUPPORT_REPLY_FIXED.length, sha256: null, originalText: SUPPORT_REPLY_FIXED, status: "READY", createdAt: now });
        await ctx.db.insert("inboundAssignments", { workspaceId: ws._id, agentmailMessageId: messageId, agentmailThreadId: kase.agentmailThreadId, fromDomain: "brightline-wireless.example", subject: "Re: Missing promotional credit (REPLAY)", preview: SUPPORT_REPLY_FIXED.slice(0, 200), receivedAt: now, classification: "SUPPORT_REPLY", protectedItemId: item._id, caseId: kase._id, documentId, assignmentStatus: "AUTO_ASSIGNED", assignmentReason: "REPLY_THREAD", processingStatus: "PROCESSED", createdAt: now, updatedAt: now });
        await ctx.scheduler.runAfter(0, internal.cases.applyReplyAssertions, {
          caseId: kase._id,
          agentmailMessageId: messageId,
          assertions: [
            { assertionType: "CREDIT_WILL_BE_RESTORED", assertion: "The provider says the missed credit will be applied and credits will continue.", excerpt: REPLY_EXCERPT, bindingValidated: excerptIsInSource(REPLY_EXCERPT, SUPPORT_REPLY_FIXED), confidence: "HIGH" },
          ],
        });
        await ctx.db.patch(session._id, { step: "PROVIDER_CLAIMS_FIXED" });
        return null;
      }
      case "BILL_23":
        if (session.step !== "PROVIDER_CLAIMS_FIXED") return null;
        await ctx.db.patch(session._id, { busy: true });
        await ctx.scheduler.runAfter(0, internal.internal.demoSeed.addBill, { workspaceId: ws._id, itemId: item._id, period: 23, credit: "present", backCredit: true });
        return null;
    }
  },
});

export const state = query({
  args: { sessionKey: v.string() },
  handler: async (ctx, { sessionKey }) => {
    const found = await sessionFor(ctx, sessionKey);
    if (!found) return null;
    const { session, ws } = found;
    const [main, control, refusal] = await Promise.all([session.mainItemId, session.controlItemId, session.refusalItemId].map((id) => ctx.db.get(id)));
    if (!main || !control || !refusal) return null;
    const kase = await ctx.db.query("cases").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", main._id)).order("desc").first();
    return {
      step: session.step,
      busy: session.busy,
      expiresAt: session.expiresAt,
      scenarioVersion: session.scenarioVersion,
      main: await itemView(ctx, main),
      control: await itemView(ctx, control),
      refusal: await itemView(ctx, refusal),
      case: kase ? await caseView(ctx, kase, ws) : null,
    };
  },
});

/** Hourly: remove expired demo workspaces and everything under them. */
export const cleanupExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query("demoSessions").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(10);
    for (const s of expired) {
      let done = true;
      for (const itemId of [s.mainItemId, s.controlItemId, s.refusalItemId]) {
        if (await ctx.db.get(itemId)) done = (await deleteItemCascade(ctx, itemId)) && done;
      }
      if (!done) continue;
      const inbound = await ctx.db.query("inboundAssignments").withIndex("by_workspace_receivedAt", (q) => q.eq("workspaceId", s.workspaceId)).take(100);
      for (const r of inbound) await ctx.db.delete(r._id);
      const ws = await ctx.db.get(s.workspaceId);
      if (ws?.kind === "DEMO") await ctx.db.delete(ws._id);
      await ctx.db.delete(s._id);
    }
    if (expired.length === 10) await ctx.scheduler.runAfter(1000, internal.demo.cleanupExpired, {});
    return null;
  },
});

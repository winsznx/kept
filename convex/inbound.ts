import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { domainError, requireProtectedItem, requireWorkspace } from "./lib/authz";

/** Upper bound for message text kept inline on a document row; larger bodies go to storage. */
const MAX_INLINE_TEXT = 200_000;

type RawAddress = string | { email?: string; address?: string } | null | undefined;
type RawAttachment = { attachment_id?: string; filename?: string; content_type?: string; size?: number };
type RawMessage = {
  inbox_id?: string;
  thread_id?: string;
  message_id?: string;
  from?: RawAddress;
  subject?: string | null;
  preview?: string | null;
  text?: string | null;
  extracted_text?: string | null;
  timestamp?: string | null;
  attachments?: RawAttachment[] | null;
};

function addressOf(a: RawAddress): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  return a.email ?? a.address ?? null;
}

/** Only the sender's domain is kept for display; full addresses are not copied into Kept rows. */
function senderDomain(from: RawAddress): string | null {
  const addr = addressOf(from);
  const m = addr ? /@([A-Za-z0-9.-]+)/.exec(addr) : null;
  return m ? m[1].toLowerCase() : null;
}

const ROUTING_TOKEN_RE = /\bKEPT-([A-HJ-NP-Z2-9]{6})\b/;

async function resolveItemByToken(ctx: MutationCtx, workspaceId: Id<"workspaces">, text: string): Promise<Doc<"protectedItems"> | null> {
  const m = ROUTING_TOKEN_RE.exec(text);
  if (!m) return null;
  const item = await ctx.db
    .query("protectedItems")
    .withIndex("by_routingToken", (q) => q.eq("routingToken", m[1]))
    .unique();
  return item && item.workspaceId === workspaceId ? item : null;
}

/**
 * Callback from the AgentMail component after it verified the Svix signature and
 * deduped on event_id. Association uses only server-owned mappings (inbox -> workspace,
 * thread -> case, routing token -> item); message content never selects a workspace.
 */
export const onMessageReceived = internalMutation({
  args: { message: v.any(), thread: v.any(), eventId: v.string() },
  returns: v.null(),
  handler: async (ctx, { message }) => {
    const m = message as RawMessage;
    if (!m.inbox_id || !m.message_id || !m.thread_id) return null;

    const existing = await ctx.db
      .query("inboundAssignments")
      .withIndex("by_messageId", (q) => q.eq("agentmailMessageId", m.message_id!))
      .unique();
    if (existing) return null;

    const ws = await ctx.db
      .query("workspaces")
      .withIndex("by_agentmailInboxId", (q) => q.eq("agentmailInboxId", m.inbox_id!))
      .unique();
    if (!ws) return null;

    const now = Date.now();
    const receivedAt = m.timestamp ? Date.parse(m.timestamp) || now : now;
    const kase = await ctx.db
      .query("cases")
      .withIndex("by_thread", (q) => q.eq("agentmailThreadId", m.thread_id!))
      .unique();
    const caseForWs = kase && kase.workspaceId === ws._id ? kase : null;
    // Forwarded evidence lives in what AgentMail treats as quoted history, so only case
    // replies use the quote-stripped extracted_text; everything else keeps the full text.
    const extracted = m.extracted_text?.trim() ? m.extracted_text : null;
    const bodyText = ((caseForWs ? (extracted ?? m.text) : (m.text ?? extracted)) ?? "").slice(0, MAX_INLINE_TEXT);
    const tokenItem = caseForWs ? null : await resolveItemByToken(ctx, ws._id, `${m.subject ?? ""}\n${bodyText.slice(0, 2000)}`);
    const protectedItemId = caseForWs?.protectedItemId ?? tokenItem?._id ?? null;

    const documentId = await ctx.db.insert("documents", {
      workspaceId: ws._id,
      protectedItemId,
      sourceCaptureId: null,
      sourceClass: caseForWs ? "FIRST_PARTY_SUPPORT_REPLY" : "UNKNOWN_SOURCE",
      storageId: null,
      agentmailMessageId: m.message_id,
      agentmailThreadId: m.thread_id,
      filename: null,
      mimeType: "text/plain",
      byteSize: bodyText.length,
      sha256: null,
      originalText: bodyText,
      status: "RECEIVED",
      createdAt: now,
    });

    const assignmentId = await ctx.db.insert("inboundAssignments", {
      workspaceId: ws._id,
      agentmailMessageId: m.message_id,
      agentmailThreadId: m.thread_id,
      fromDomain: senderDomain(m.from),
      subject: m.subject ? m.subject.slice(0, 300) : null,
      preview: (m.preview ?? bodyText).slice(0, 280),
      receivedAt,
      classification: caseForWs ? "SUPPORT_REPLY" : "UNKNOWN",
      protectedItemId,
      caseId: caseForWs?._id ?? null,
      documentId,
      assignmentStatus: protectedItemId ? "AUTO_ASSIGNED" : "NEEDS_ASSIGNMENT",
      assignmentReason: caseForWs ? "REPLY_THREAD" : tokenItem ? "ROUTING_TOKEN" : null,
      processingStatus: "PENDING",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditEvents", {
      workspaceId: ws._id,
      actorType: "WEBHOOK",
      action: "inbound_message_received",
      entityType: "inboundAssignments",
      entityId: assignmentId,
      safeMetadataJson: JSON.stringify({ attachments: (m.attachments ?? []).length, routed: Boolean(protectedItemId) }),
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.internal.inboundProcessing.process, {
      assignmentId,
      attachments: (m.attachments ?? [])
        .filter((a) => a.attachment_id)
        .slice(0, 10)
        .map((a) => ({
          attachmentId: a.attachment_id!,
          filename: a.filename ?? null,
          contentType: a.content_type ?? null,
          size: a.size ?? null,
        })),
    });
    return null;
  },
});

const inboxRow = v.object({
  _id: v.id("inboundAssignments"),
  subject: v.union(v.string(), v.null()),
  preview: v.union(v.string(), v.null()),
  fromDomain: v.union(v.string(), v.null()),
  receivedAt: v.number(),
  classification: v.string(),
  assignmentStatus: v.string(),
  assignmentReason: v.union(v.string(), v.null()),
  processingStatus: v.string(),
  protectedItemId: v.union(v.id("protectedItems"), v.null()),
  caseId: v.union(v.id("cases"), v.null()),
});

export const listMine = query({
  args: {},
  returns: v.array(inboxRow),
  handler: async (ctx) => {
    const ws = await requireWorkspace(ctx);
    const rows = await ctx.db
      .query("inboundAssignments")
      .withIndex("by_workspace_receivedAt", (q) => q.eq("workspaceId", ws._id))
      .order("desc")
      .take(100);
    return rows.map((r) => ({
      _id: r._id,
      subject: r.subject,
      preview: r.preview,
      fromDomain: r.fromDomain,
      receivedAt: r.receivedAt,
      classification: r.classification,
      assignmentStatus: r.assignmentStatus,
      assignmentReason: r.assignmentReason,
      processingStatus: r.processingStatus,
      protectedItemId: r.protectedItemId,
      caseId: r.caseId,
    }));
  },
});

/** User assigns a message that Kept could not route confidently. */
export const assignMessage = mutation({
  args: { assignmentId: v.id("inboundAssignments"), itemId: v.union(v.id("protectedItems"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { assignmentId, itemId }) => {
    const ws = await requireWorkspace(ctx);
    const row = await ctx.db.get(assignmentId);
    if (!row || row.workspaceId !== ws._id) throw domainError("NOT_FOUND", "Message not found.");
    if (row.caseId) throw domainError("INVALID_STATE_TRANSITION", "Case replies stay on their case.");
    if (row.assignmentStatus !== "NEEDS_ASSIGNMENT") throw domainError("INVALID_STATE_TRANSITION", "This message is already handled.");
    const now = Date.now();
    if (itemId === null) {
      await ctx.db.patch(assignmentId, { assignmentStatus: "IGNORED", updatedAt: now });
      return null;
    }
    await requireProtectedItem(ctx, itemId);
    await ctx.db.patch(assignmentId, { assignmentStatus: "ASSIGNED", protectedItemId: itemId, assignmentReason: "USER", updatedAt: now });
    if (row.documentId) {
      await ctx.db.patch(row.documentId, { protectedItemId: itemId });
      await ctx.scheduler.runAfter(0, internal.internal.inboundProcessing.ingestAssigned, { assignmentId });
    }
    return null;
  },
});

export const getAssignment = internalQuery({
  args: { assignmentId: v.id("inboundAssignments") },
  handler: async (ctx, { assignmentId }) => {
    const row = await ctx.db.get(assignmentId);
    if (!row) return null;
    const ws = await ctx.db.get(row.workspaceId);
    const doc = row.documentId ? await ctx.db.get(row.documentId) : null;
    return { row, ws, doc };
  },
});

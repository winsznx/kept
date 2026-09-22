import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { domainError, requireProtectedItem, requireWorkspace } from "./lib/authz";
import { validatePublicUrl } from "./lib/urlSafety";

const MAX_TEXT = 100_000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/html"]);
const intent = v.union(v.literal("AUTO"), v.literal("PROMISE"), v.literal("BILL"));

async function startJob(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  itemId: Id<"protectedItems">,
  type: string,
  input: { kind: "DOCUMENT"; documentId: Id<"documents"> } | { kind: "URL"; url: string },
  jobIntent: "AUTO" | "PROMISE" | "BILL",
): Promise<Id<"jobs">> {
  const now = Date.now();
  const jobId = await ctx.db.insert("jobs", { workspaceId, protectedItemId: itemId, caseId: null, type, status: "QUEUED", step: "QUEUED", progress: 0, failureCode: null, safeMessage: null, createdAt: now, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.internal.sourceProcessing.run, { jobId, input, intent: jobIntent, caseId: null, assignmentId: null });
  await ctx.db.insert("productEvents", { workspaceId, name: "source_capture_started", createdAt: now });
  return jobId;
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireWorkspace(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addUpload = mutation({
  args: { itemId: v.id("protectedItems"), storageId: v.id("_storage"), filename: v.string(), intent },
  returns: v.id("jobs"),
  handler: async (ctx, a) => {
    const { ws } = await requireProtectedItem(ctx, a.itemId);
    const meta = await ctx.db.system.get("_storage", a.storageId);
    if (!meta) throw domainError("NOT_FOUND", "Upload not found.");
    const claimed = await ctx.db.query("documents").withIndex("by_workspace_createdAt", (q) => q.eq("workspaceId", ws._id)).order("desc").take(200);
    if (claimed.some((d) => d.storageId === a.storageId)) throw domainError("INVALID_INPUT", "This upload was already added.");
    const mime = meta.contentType ?? "";
    if (!ACCEPTED_MIME.has(mime)) {
      await ctx.storage.delete(a.storageId);
      throw domainError("UNSUPPORTED_FILE", "Upload a PDF, PNG, JPEG, WebP, plain text, or HTML file.");
    }
    if (meta.size > MAX_UPLOAD_BYTES) {
      await ctx.storage.delete(a.storageId);
      throw domainError("FILE_TOO_LARGE", "Files must be 10 MB or smaller.");
    }
    const documentId = await ctx.db.insert("documents", {
      workspaceId: ws._id,
      protectedItemId: a.itemId,
      sourceCaptureId: null,
      sourceClass: "UNKNOWN_SOURCE",
      storageId: a.storageId,
      agentmailMessageId: null,
      agentmailThreadId: null,
      filename: a.filename.slice(0, 200),
      mimeType: mime,
      byteSize: meta.size,
      sha256: meta.sha256,
      originalText: null,
      status: "RECEIVED",
      createdAt: Date.now(),
    });
    return await startJob(ctx, ws._id, a.itemId, "UPLOAD", { kind: "DOCUMENT", documentId }, a.intent);
  },
});

export const addText = mutation({
  args: { itemId: v.id("protectedItems"), text: v.string(), intent },
  returns: v.id("jobs"),
  handler: async (ctx, a) => {
    const { ws } = await requireProtectedItem(ctx, a.itemId);
    const text = a.text.trim();
    if (text.length < 20) throw domainError("SOURCE_EMPTY", "Paste the full email or document text.");
    if (text.length > MAX_TEXT) throw domainError("FILE_TOO_LARGE", "That text is too long. Upload it as a file instead.");
    const documentId = await ctx.db.insert("documents", {
      workspaceId: ws._id,
      protectedItemId: a.itemId,
      sourceCaptureId: null,
      sourceClass: "UNKNOWN_SOURCE",
      storageId: null,
      agentmailMessageId: null,
      agentmailThreadId: null,
      filename: null,
      mimeType: "text/plain",
      byteSize: text.length,
      sha256: null,
      originalText: text,
      status: "RECEIVED",
      createdAt: Date.now(),
    });
    return await startJob(ctx, ws._id, a.itemId, "PASTE", { kind: "DOCUMENT", documentId }, a.intent);
  },
});

/** Captures (or re-captures) a public offer/terms page. Each capture is a new immutable snapshot. */
export const addUrl = mutation({
  args: { itemId: v.id("protectedItems"), url: v.string() },
  returns: v.id("jobs"),
  handler: async (ctx, a) => {
    const { ws } = await requireProtectedItem(ctx, a.itemId);
    const check = validatePublicUrl(a.url);
    if (!check.ok) throw domainError("INVALID_URL", "Enter a public http(s) web address.");
    return await startJob(ctx, ws._id, a.itemId, "URL_CAPTURE", { kind: "URL", url: check.url }, "PROMISE");
  },
});

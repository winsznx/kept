"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { getAttachment } from "../lib/agentmail";
import { sha256Hex } from "../lib/hashing";
import { InboundClassification, SCHEMA_VERSION } from "../lib/aiSchemas";
import { INBOUND_CLASSIFIER } from "../lib/aiPrompts";
import { callStructured } from "../lib/openai";

const ACCEPTED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/html"]);
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const attachmentArg = v.object({ attachmentId: v.string(), filename: v.union(v.string(), v.null()), contentType: v.union(v.string(), v.null()), size: v.union(v.number(), v.null()) });

async function runPipelineFor(ctx: ActionCtx, assignmentId: Id<"inboundAssignments">): Promise<void> {
  const data = await ctx.runQuery(internal.inbound.getAssignment, { assignmentId });
  if (!data?.row || !data.ws || !data.row.protectedItemId) return;
  const { row } = data;
  const docs = await ctx.runQuery(internal.internal.ingest.documentsForMessage, { agentmailMessageId: row.agentmailMessageId });
  const intent = row.caseId ? "REPLY" : "AUTO";
  for (const doc of docs) {
    // Attachments carry the evidence when present; the email body is processed only if it's the only document or a case reply.
    if (!row.caseId && docs.length > 1 && doc.storageId === null) continue;
    const jobId = await ctx.runMutation(internal.internal.ingest.createJob, { workspaceId: row.workspaceId, protectedItemId: row.protectedItemId, caseId: row.caseId, type: "INBOUND_EMAIL" });
    await ctx.runAction(internal.internal.sourceProcessing.run, { jobId, input: { kind: "DOCUMENT", documentId: doc._id }, intent, caseId: row.caseId, assignmentId });
  }
}

export const process = internalAction({
  args: { assignmentId: v.id("inboundAssignments"), attachments: v.array(attachmentArg) },
  returns: v.null(),
  handler: async (ctx, { assignmentId, attachments }) => {
    const data = await ctx.runQuery(internal.inbound.getAssignment, { assignmentId });
    if (!data?.row || !data.ws?.agentmailInboxId) return null;
    const { row, ws } = data;
    for (const a of attachments) {
      if (!a.contentType || !ACCEPTED_MIME.has(a.contentType) || (a.size ?? 0) > MAX_ATTACHMENT_BYTES) continue;
      try {
        const info = await getAttachment(ws.agentmailInboxId!, row.agentmailMessageId, a.attachmentId);
        const res = await fetch(info.download_url);
        if (!res.ok) continue;
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength > MAX_ATTACHMENT_BYTES) continue;
        const storageId = await ctx.storage.store(new Blob([bytes], { type: a.contentType }));
        await ctx.runMutation(internal.internal.ingest.createAttachmentDocument, { assignmentId, storageId, filename: a.filename, mimeType: a.contentType, byteSize: bytes.byteLength, sha256: await sha256Hex(bytes) });
      } catch {
        await ctx.runMutation(internal.telemetry.record, { workspaceId: row.workspaceId, provider: "AGENTMAIL", operation: "attachments.get", status: "ERROR", errorCode: "AGENTMAIL_ATTACHMENT_FAILED", latencyMs: 0, attempt: 1, modelId: null, schemaVersion: null, externalRef: null });
      }
    }
    if (row.protectedItemId) {
      await runPipelineFor(ctx, assignmentId);
      return null;
    }
    // Unassigned: classify only, so the inbox can label it. Nothing is attached to an item automatically.
    const text = data.doc?.originalText ?? "";
    try {
      const cls = await callStructured({ schema: InboundClassification, schemaName: "inbound_classification", system: INBOUND_CLASSIFIER, input: `SOURCE CONTENT BEGINS\n${`${row.subject ?? ""}\n\n${text}`.slice(0, 20000)}\nSOURCE CONTENT ENDS`, role: "EXTRACT" });
      await ctx.runMutation(internal.telemetry.record, { workspaceId: row.workspaceId, provider: "OPENAI", operation: "classify", status: "OK", errorCode: null, latencyMs: cls.latencyMs, attempt: 1, modelId: cls.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
      await ctx.runMutation(internal.internal.ingest.setAssignmentClassification, { assignmentId, classification: cls.parsed.classification });
      await ctx.runMutation(internal.internal.ingest.setAssignmentProcessed, { assignmentId, status: "PROCESSED" });
    } catch {
      await ctx.runMutation(internal.internal.ingest.setAssignmentProcessed, { assignmentId, status: "FAILED" });
    }
    return null;
  },
});

export const ingestAssigned = internalAction({
  args: { assignmentId: v.id("inboundAssignments") },
  returns: v.null(),
  handler: async (ctx, { assignmentId }) => {
    await runPipelineFor(ctx, assignmentId);
    return null;
  },
});

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { AgentMailApiError, isTransient, replyToMessage, sendMessage } from "../lib/agentmail";

const MAX_ATTEMPTS = 3;

/**
 * Performs one user-approved send. Retries reuse the same Idempotency-Key, so
 * AgentMail returns the original message instead of sending a second email.
 */
export const send = internalAction({
  args: { caseId: v.id("cases"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, { caseId, attempt }) => {
    const c = await ctx.runQuery(internal.cases.getSendContext, { caseId });
    if (!c || c.kase.status !== "SENDING" || !c.kase.sendIdempotencyKey) return null;
    const { kase, inboxId } = c;
    const key = kase.sendIdempotencyKey!;
    if (!inboxId || !kase.recipientEmail || !kase.subject || !kase.draftText) {
      await ctx.runMutation(internal.cases.markSendFailed, { caseId, idempotencyKey: key, code: "CASE_RECIPIENT_REQUIRED", retryable: false });
      return null;
    }
    const started = Date.now();
    try {
      const res = c.replyToMessageId
        ? await replyToMessage(inboxId, c.replyToMessageId, { text: kase.draftText }, key)
        : await sendMessage(inboxId, { to: kase.recipientEmail, subject: kase.subject, text: kase.draftText }, key);
      await ctx.runMutation(internal.telemetry.record, { workspaceId: kase.workspaceId, provider: "AGENTMAIL", operation: c.replyToMessageId ? "messages.reply" : "messages.send", status: "OK", errorCode: null, latencyMs: Date.now() - started, attempt, modelId: null, schemaVersion: null, externalRef: null });
      await ctx.runMutation(internal.cases.markSent, { caseId, idempotencyKey: key, messageId: res.message_id, threadId: res.thread_id });
    } catch (err) {
      const code = err instanceof AgentMailApiError ? `AGENTMAIL_${err.status}` : "AGENTMAIL_SEND_FAILED";
      await ctx.runMutation(internal.telemetry.record, { workspaceId: kase.workspaceId, provider: "AGENTMAIL", operation: "messages.send", status: "ERROR", errorCode: code, latencyMs: Date.now() - started, attempt, modelId: null, schemaVersion: null, externalRef: null });
      if (isTransient(err) && attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(2000 * attempt, internal.internal.caseSend.send, { caseId, attempt: attempt + 1 });
        return null;
      }
      await ctx.runMutation(internal.cases.markSendFailed, { caseId, idempotencyKey: key, code, retryable: isTransient(err) });
    }
    return null;
  },
});

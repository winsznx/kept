import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation } from "../_generated/server";
import { AgentMailApiError, createInbox } from "../lib/agentmail";

export const provisionInbox = internalAction({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const ws = await ctx.runQuery(internal.workspaces.getInternal, { workspaceId });
    if (!ws || ws.kind !== "USER" || ws.agentmailInboxId) return null;
    const started = Date.now();
    try {
      const inbox = await createInbox(`kept-ws-${workspaceId}`, "Kept");
      await ctx.runMutation(internal.internal.agentmail.saveInbox, {
        workspaceId,
        inboxId: inbox.inbox_id,
        address: inbox.email ?? inbox.inbox_id,
      });
      await ctx.runMutation(internal.telemetry.record, {
        workspaceId, provider: "AGENTMAIL", operation: "inboxes.create", status: "OK", errorCode: null,
        latencyMs: Date.now() - started, attempt: 1, modelId: null, schemaVersion: null, externalRef: null,
      });
    } catch (err) {
      const code = err instanceof AgentMailApiError ? err.code : "UNKNOWN_EXTERNAL_FAILURE";
      await ctx.runMutation(internal.telemetry.record, {
        workspaceId, provider: "AGENTMAIL", operation: "inboxes.create", status: "ERROR", errorCode: code,
        latencyMs: Date.now() - started, attempt: 1, modelId: null, schemaVersion: null, externalRef: null,
      });
    }
    return null;
  },
});

export const saveInbox = internalMutation({
  args: { workspaceId: v.id("workspaces"), inboxId: v.string(), address: v.string() },
  returns: v.null(),
  handler: async (ctx, { workspaceId, inboxId, address }) => {
    const ws = await ctx.db.get(workspaceId);
    if (!ws || ws.agentmailInboxId) return null;
    await ctx.db.patch(workspaceId, { agentmailInboxId: inboxId, agentmailInboxAddress: address, updatedAt: Date.now() });
    return null;
  },
});

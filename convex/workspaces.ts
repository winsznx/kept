import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, mutation, query } from "./_generated/server";
import { findUserWorkspace, requireUser } from "./lib/authz";

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.union(v.id("workspaces"), v.null()),
      email: v.union(v.string(), v.null()),
      inboxAddress: v.union(v.string(), v.null()),
      inboxStatus: v.union(v.literal("NONE"), v.literal("READY")),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const ws = await findUserWorkspace(ctx, userId);
    return {
      workspaceId: ws?._id ?? null,
      email: user?.email ?? null,
      inboxAddress: ws?.agentmailInboxAddress ?? null,
      inboxStatus: ws?.agentmailInboxAddress ? ("READY" as const) : ("NONE" as const),
    };
  },
});

/** Idempotent onboarding: exactly one USER workspace per user, then inbox provisioning. */
export const ensureMine = mutation({
  args: {},
  returns: v.id("workspaces"),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await findUserWorkspace(ctx, userId);
    if (existing) {
      if (!existing.agentmailInboxId) {
        await ctx.scheduler.runAfter(0, internal.internal.agentmail.provisionInbox, { workspaceId: existing._id });
      }
      return existing._id;
    }
    const now = Date.now();
    const workspaceId = await ctx.db.insert("workspaces", {
      ownerUserId: userId,
      kind: "USER",
      name: null,
      agentmailInboxId: null,
      agentmailInboxAddress: null,
      demoSessionKeyHash: null,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      workspaceId,
      actorType: "USER",
      action: "workspace_created",
      entityType: "workspaces",
      entityId: workspaceId,
      safeMetadataJson: null,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.internal.agentmail.provisionInbox, { workspaceId });
    return workspaceId;
  },
});

export const getInternal = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => await ctx.db.get(workspaceId),
});

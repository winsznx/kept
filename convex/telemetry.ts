import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const record = internalMutation({
  args: {
    workspaceId: v.union(v.id("workspaces"), v.null()),
    provider: v.union(v.literal("OPENAI"), v.literal("FIRECRAWL"), v.literal("AGENTMAIL")),
    operation: v.string(),
    status: v.union(v.literal("OK"), v.literal("ERROR")),
    errorCode: v.union(v.string(), v.null()),
    latencyMs: v.number(),
    attempt: v.number(),
    modelId: v.union(v.string(), v.null()),
    schemaVersion: v.union(v.string(), v.null()),
    externalRef: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("externalCalls", { ...args, createdAt: Date.now() });
    return null;
  },
});

import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { domainError, requireProtectedItem, requireWorkspace } from "./lib/authz";
import { itemMachine } from "./lib/stateMachines";

const ROUTING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRoutingToken(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ROUTING_ALPHABET[Math.floor(Math.random() * ROUTING_ALPHABET.length)];
  return out;
}

const category = v.union(v.literal("MOBILE"), v.literal("INTERNET"), v.literal("DEVICE"), v.literal("OTHER"));

function boundedOptional(value: string | undefined, max: number, field: string): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw domainError("INVALID_INPUT", `${field} is too long.`);
  return trimmed;
}

export const create = mutation({
  args: {
    providerName: v.optional(v.string()),
    productName: v.optional(v.string()),
    category: v.optional(category),
    transactionDate: v.optional(v.string()),
  },
  returns: v.id("protectedItems"),
  handler: async (ctx, args) => {
    const ws = await requireWorkspace(ctx);
    let transactionAt: number | null = null;
    if (args.transactionDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(args.transactionDate)) throw domainError("INVALID_INPUT", "Use YYYY-MM-DD for the date.");
      transactionAt = Date.parse(`${args.transactionDate}T00:00:00Z`);
      if (Number.isNaN(transactionAt)) throw domainError("INVALID_INPUT", "Invalid date.");
    }
    const now = Date.now();
    let routingToken = makeRoutingToken();
    while (await ctx.db.query("protectedItems").withIndex("by_routingToken", (q) => q.eq("routingToken", routingToken)).first()) {
      routingToken = makeRoutingToken();
    }
    const itemId = await ctx.db.insert("protectedItems", {
      workspaceId: ws._id,
      providerName: boundedOptional(args.providerName, 120, "Provider"),
      productName: boundedOptional(args.productName, 160, "Plan or product"),
      category: args.category ?? "MOBILE",
      status: "CAPTURING",
      transactionAt,
      protectedAt: null,
      primaryCurrency: "USD",
      summary: null,
      scheduleStartMonth: null,
      routingToken,
      transactionContextJson: null,
      transactionContextCaptureId: null,
      latestReconciliationId: null,
      resolutionState: "NONE",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("productEvents", { workspaceId: ws._id, name: "protected_item_created", createdAt: now });
    return itemId;
  },
});

const itemCard = v.object({
  _id: v.id("protectedItems"),
  providerName: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  category: category,
  status: v.string(),
  resolutionState: v.string(),
  routingToken: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
  reconciliation: v.union(
    v.null(),
    v.object({
      overallOutcome: v.union(v.string(), v.null()),
      observedDifferenceCents: v.union(v.number(), v.null()),
      remainingScheduledValueCents: v.union(v.number(), v.null()),
      latestObservedPeriod: v.union(v.number(), v.null()),
      periodCount: v.union(v.number(), v.null()),
      currency: v.union(v.string(), v.null()),
      completedAt: v.union(v.number(), v.null()),
    }),
  ),
});

const ATTENTION_ORDER: Record<Doc<"protectedItems">["status"], number> = {
  MATERIAL_DIFFERENCE: 0,
  CASE_OPEN: 1,
  NEEDS_REVIEW: 2,
  FAILED: 3,
  CAPTURING: 4,
  PROTECTED: 5,
  ARCHIVED: 6,
};

export const listMine = query({
  args: {},
  returns: v.array(itemCard),
  handler: async (ctx) => {
    const ws = await requireWorkspace(ctx);
    const items = await ctx.db
      .query("protectedItems")
      .withIndex("by_workspace_createdAt", (q) => q.eq("workspaceId", ws._id))
      .order("desc")
      .take(100);
    const cards = await Promise.all(
      items.map(async (item) => {
        const rec = item.latestReconciliationId ? await ctx.db.get(item.latestReconciliationId) : null;
        return {
          _id: item._id,
          providerName: item.providerName,
          productName: item.productName,
          category: item.category,
          status: item.status,
          resolutionState: item.resolutionState,
          routingToken: item.routingToken,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          reconciliation: rec
            ? {
                overallOutcome: rec.overallOutcome,
                observedDifferenceCents: rec.observedDifferenceCents,
                remainingScheduledValueCents: rec.remainingScheduledValueCents,
                latestObservedPeriod: rec.latestObservedPeriod,
                periodCount: rec.periodCount,
                currency: rec.currency,
                completedAt: rec.completedAt,
              }
            : null,
        };
      }),
    );
    return cards.sort((a, b) => ATTENTION_ORDER[a.status as Doc<"protectedItems">["status"]] - ATTENTION_ORDER[b.status as Doc<"protectedItems">["status"]] || b.updatedAt - a.updatedAt);
  },
});

export const archive = mutation({
  args: { itemId: v.id("protectedItems") },
  returns: v.null(),
  handler: async (ctx, { itemId }) => {
    const { item } = await requireProtectedItem(ctx, itemId);
    itemMachine.assert(item.status, "ARCHIVED");
    await ctx.db.patch(itemId, { status: "ARCHIVED", updatedAt: Date.now() });
    return null;
  },
});

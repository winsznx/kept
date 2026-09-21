import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export function domainError(code: string, message: string): ConvexError<{ code: string; message: string }> {
  return new ConvexError({ code, message });
}

export async function requireUser(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw domainError("AUTH_REQUIRED", "Sign in to continue.");
  return userId;
}

/** The caller's USER workspace, or null if onboarding has not run yet. */
export async function findUserWorkspace(ctx: Ctx, userId: Id<"users">): Promise<Doc<"workspaces"> | null> {
  return await ctx.db
    .query("workspaces")
    .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", userId))
    .unique();
}

export async function requireWorkspace(ctx: Ctx): Promise<Doc<"workspaces">> {
  const userId = await requireUser(ctx);
  const ws = await findUserWorkspace(ctx, userId);
  if (!ws || ws.kind !== "USER") throw domainError("NOT_FOUND", "Workspace not set up yet.");
  return ws;
}

export async function requireProtectedItem(ctx: Ctx, itemId: Id<"protectedItems">): Promise<{ ws: Doc<"workspaces">; item: Doc<"protectedItems"> }> {
  const ws = await requireWorkspace(ctx);
  const item = await ctx.db.get(itemId);
  if (!item || item.workspaceId !== ws._id) throw domainError("NOT_FOUND", "Item not found.");
  return { ws, item };
}

export async function requireCase(ctx: Ctx, caseId: Id<"cases">): Promise<{ ws: Doc<"workspaces">; kase: Doc<"cases"> }> {
  const ws = await requireWorkspace(ctx);
  const kase = await ctx.db.get(caseId);
  if (!kase || kase.workspaceId !== ws._id) throw domainError("NOT_FOUND", "Case not found.");
  return { ws, kase };
}

export async function requireDemoWorkspace(ctx: Ctx, workspaceId: Id<"workspaces">): Promise<Doc<"workspaces">> {
  const ws = await ctx.db.get(workspaceId);
  if (!ws || ws.kind !== "DEMO") throw domainError("FORBIDDEN", "Not a demo workspace.");
  return ws;
}

/** Internal cross-table guard: the referenced row must belong to the same workspace. */
export function assertSameWorkspace(expected: Id<"workspaces">, actual: Id<"workspaces">): void {
  if (expected !== actual) throw domainError("FORBIDDEN", "Cross-workspace reference rejected.");
}

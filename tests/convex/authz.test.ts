import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeT, signedInUser } from "./setup";

describe("workspace isolation", () => {
  it("unauthenticated callers cannot read or create items", async () => {
    const t = makeT();
    await expect(t.query(api.protectedItems.listMine, {})).rejects.toThrow(/AUTH_REQUIRED|Sign in/);
    await expect(t.mutation(api.protectedItems.create, {})).rejects.toThrow(/AUTH_REQUIRED|Sign in/);
    expect(await t.query(api.workspaces.me, {})).toBeNull();
  });

  it("onboarding is idempotent: one workspace per user", async () => {
    const t = makeT();
    const { as } = await signedInUser(t, "a@example.test");
    const w1 = await as.mutation(api.workspaces.ensureMine, {});
    const w2 = await as.mutation(api.workspaces.ensureMine, {});
    expect(w1).toEqual(w2);
    const count = await t.run(async (ctx) => (await ctx.db.query("workspaces").collect()).length);
    expect(count).toBe(1);
  });

  it("user B cannot list, read, or archive user A's items", async () => {
    const t = makeT();
    const a = await signedInUser(t, "a@example.test");
    const b = await signedInUser(t, "b@example.test");
    await a.as.mutation(api.workspaces.ensureMine, {});
    await b.as.mutation(api.workspaces.ensureMine, {});
    const itemId = await a.as.mutation(api.protectedItems.create, { providerName: "Carrier A", productName: "Device promo" });

    expect(await a.as.query(api.protectedItems.listMine, {})).toHaveLength(1);
    expect(await b.as.query(api.protectedItems.listMine, {})).toHaveLength(0);
    await expect(b.as.mutation(api.protectedItems.archive, { itemId })).rejects.toThrow(/NOT_FOUND|not found/i);
  });
});

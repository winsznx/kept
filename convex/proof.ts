import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { sha256Hex } from "./lib/hashing";

/**
 * Sanitized, publicly inspectable run records behind /proof and /proof/run/:runId.
 * Payloads are written only by internal functions from persisted run state and must
 * never contain addresses, message bodies, or private document text.
 */
const runSummary = v.object({ slug: v.string(), title: v.string(), kind: v.union(v.literal("LIVE"), v.literal("REPLAY"), v.literal("FIXTURE")), createdAt: v.number(), payloadSha256: v.string() });

export const listRuns = query({
  args: {},
  returns: v.array(runSummary),
  handler: async (ctx) => {
    const rows = await ctx.db.query("proofRuns").order("desc").take(50);
    return rows.map((r) => ({ slug: r.slug, title: r.title, kind: r.kind, createdAt: r.createdAt, payloadSha256: r.payloadSha256 }));
  },
});

export const getRun = query({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({ slug: v.string(), title: v.string(), kind: v.union(v.literal("LIVE"), v.literal("REPLAY"), v.literal("FIXTURE")), commitSha: v.union(v.string(), v.null()), createdAt: v.number(), payloadJson: v.string(), payloadSha256: v.string() })),
  handler: async (ctx, { slug }) => {
    const r = await ctx.db.query("proofRuns").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    return r ? { slug: r.slug, title: r.title, kind: r.kind, commitSha: r.commitSha, createdAt: r.createdAt, payloadJson: r.payloadJson, payloadSha256: r.payloadSha256 } : null;
  },
});

const ADDRESS_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** Records a Firecrawl capture proof from persisted sourceCaptures rows (metadata and hashes only). */
export const recordCaptureProof = internalMutation({
  args: { slug: v.string(), title: v.string(), itemId: v.id("protectedItems"), commitSha: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const caps = await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", a.itemId)).take(20);
    const payload = {
      type: "FIRECRAWL_CAPTURE",
      captures: caps.map((c) => ({
        captureId: c._id,
        domain: c.sourceDomain,
        uri: c.sourceUri,
        sourceClass: c.sourceClass,
        isFirstParty: c.isFirstParty,
        capturedAt: c.capturedAt,
        contentSha256: c.contentSha256,
        characters: c.normalizedText?.length ?? 0,
        previousCaptureId: c.previousCaptureId,
        firecrawl: c.firecrawlMetadataJson ? JSON.parse(c.firecrawlMetadataJson) : null,
      })),
    };
    const payloadJson = JSON.stringify(payload);
    if (ADDRESS_RE.test(payloadJson)) throw new Error("refusing to publish address-shaped data");
    const existing = await ctx.db.query("proofRuns").withIndex("by_slug", (q) => q.eq("slug", a.slug)).unique();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("proofRuns", { slug: a.slug, title: a.title, kind: "LIVE", commitSha: a.commitSha, payloadJson, payloadSha256: await sha256Hex(payloadJson), createdAt: Date.now() });
    return null;
  },
});

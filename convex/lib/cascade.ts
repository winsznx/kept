import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const BATCH = 500;

/**
 * Deletes a protected item and everything derived from it, including stored files
 * owned only by its documents (FR-024). Bounded per table; returns false if more rows
 * remain so the caller can schedule another pass.
 */
export async function deleteItemCascade(ctx: MutationCtx, itemId: Id<"protectedItems">): Promise<boolean> {
  let done = true;
  const del = async <T extends { _id: Id<any> }>(rows: T[]) => {
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === BATCH) done = false;
  };

  const cases = await ctx.db.query("cases").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(50);
  for (const c of cases) {
    await del(await ctx.db.query("caseEvents").withIndex("by_case_createdAt", (q) => q.eq("caseId", c._id)).take(BATCH));
    await del(await ctx.db.query("caseEvidencePackets").withIndex("by_case_version", (q) => q.eq("caseId", c._id)).take(BATCH));
    await del(await ctx.db.query("providerAssertions").withIndex("by_case", (q) => q.eq("caseId", c._id)).take(BATCH));
  }
  await del(await ctx.db.query("resolutionVerifications").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  const recs = await ctx.db.query("reconciliations").withIndex("by_item_startedAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH);
  for (const r of recs) await del(await ctx.db.query("reconciliationFindings").withIndex("by_reconciliation", (q) => q.eq("reconciliationId", r._id)).take(BATCH));
  await del(recs);
  await del(await ctx.db.query("expectedEvents").withIndex("by_item_expectedAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  await del(await ctx.db.query("observations").withIndex("by_item_observedAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  await del(await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  await del(await ctx.db.query("pageComparisons").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  await del(await ctx.db.query("applicabilityChecks").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  const commitments = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", itemId)).take(BATCH);
  for (const c of commitments) {
    await del(await ctx.db.query("commitmentEvidence").withIndex("by_commitment", (q) => q.eq("commitmentId", c._id)).take(BATCH));
    await del(await ctx.db.query("commitmentConditions").withIndex("by_commitment", (q) => q.eq("commitmentId", c._id)).take(BATCH));
  }
  await del(commitments);
  const captures = await ctx.db.query("sourceCaptures").withIndex("by_item_capturedAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH);
  for (const c of captures) {
    await del(await ctx.db.query("captureParses").withIndex("by_source", (q) => q.eq("sourceCaptureId", c._id)).take(BATCH));
    if (c.rawTextStorageId) await ctx.storage.delete(c.rawTextStorageId);
  }
  await del(captures);
  const docs = await ctx.db.query("documents").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH);
  for (const d of docs) if (d.storageId) await ctx.storage.delete(d.storageId);
  await del(docs);
  await del(await ctx.db.query("jobs").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(BATCH));
  if (done) {
    await del(cases);
    if (await ctx.db.get(itemId)) await ctx.db.delete(itemId);
  }
  return done;
}

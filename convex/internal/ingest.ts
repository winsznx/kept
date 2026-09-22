import { v } from "convex/values";
import { applyVerificationInTx } from "../cases";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { commitmentKind, sourceClass } from "../schema";
import { assertSameWorkspace } from "../lib/authz";
import { normalizeForBinding, provenanceRank, type SourceClass } from "../lib/evidence";
import { comparePageFacts, type NormalizedFact } from "../lib/factCompare";
import { sha256Hex } from "../lib/hashing";
import { formatCents } from "../lib/money";
import { deriveScheduleStart, MECHANISM_VERSION, toObservedStatement, type BuiltLine } from "../lib/pipeline";
import { reconcileCreditSchedule, verifyResolution, type ObservedStatement } from "../lib/reconcile";
import { generateMonthlyCreditSchedule, parseYearMonth } from "../lib/schedule";
import { itemMachine, jobMachine, resolutionMachine, type ItemStatus, type JobStatus } from "../lib/stateMachines";

// ---------- jobs ----------

export const setJob = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.optional(v.union(v.literal("QUEUED"), v.literal("RUNNING"), v.literal("SUCCEEDED"), v.literal("FAILED"), v.literal("NEEDS_REVIEW"))),
    step: v.optional(v.string()),
    progress: v.optional(v.number()),
    failureCode: v.optional(v.union(v.string(), v.null())),
    safeMessage: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, ...patch }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    if (patch.status && patch.status !== job.status) jobMachine.assert(job.status as JobStatus, patch.status);
    await ctx.db.patch(jobId, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

export const getJobContext = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const item = job.protectedItemId ? await ctx.db.get(job.protectedItemId) : null;
    return { job, item };
  },
});

// ---------- captures ----------

/** Creates an immutable source snapshot. Never patches an existing capture's content. */
export const createCapture = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    protectedItemId: v.id("protectedItems"),
    sourceClass: sourceClass,
    sourceUri: v.union(v.string(), v.null()),
    sourceDomain: v.union(v.string(), v.null()),
    isFirstParty: v.union(v.boolean(), v.null()),
    discovered: v.boolean(),
    documentId: v.union(v.id("documents"), v.null()),
    normalizedText: v.union(v.string(), v.null()),
    rawTextStorageId: v.union(v.id("_storage"), v.null()),
    contentSha256: v.string(),
    capturedAt: v.number(),
    firecrawlMetadataJson: v.union(v.string(), v.null()),
  },
  returns: v.id("sourceCaptures"),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.protectedItemId);
    if (!item) throw new Error("NOT_FOUND");
    assertSameWorkspace(args.workspaceId, item.workspaceId);
    let previousCaptureId: Id<"sourceCaptures"> | null = null;
    if (args.sourceUri) {
      const prior = await ctx.db
        .query("sourceCaptures")
        .withIndex("by_uri_capturedAt", (q) => q.eq("sourceUri", args.sourceUri))
        .order("desc")
        .take(20);
      previousCaptureId = prior.find((p) => p.protectedItemId === args.protectedItemId)?._id ?? null;
    }
    const atTransaction = previousCaptureId === null && (item.transactionAt === null || args.capturedAt - item.transactionAt < 14 * 86400_000);
    const id = await ctx.db.insert("sourceCaptures", {
      workspaceId: args.workspaceId,
      protectedItemId: args.protectedItemId,
      sourceClass: args.sourceClass,
      sourceUri: args.sourceUri,
      sourceDomain: args.sourceDomain,
      isFirstParty: args.isFirstParty,
      discovered: args.discovered,
      documentId: args.documentId,
      rawTextStorageId: args.rawTextStorageId,
      normalizedText: args.normalizedText,
      contentSha256: args.contentSha256,
      capturedAt: args.capturedAt,
      claimedEffectiveAt: null,
      transactionAt: item.transactionAt,
      provenanceRank: provenanceRank(args.sourceClass as SourceClass, atTransaction),
      firecrawlJobId: null,
      firecrawlMetadataJson: args.firecrawlMetadataJson,
      previousCaptureId,
      parseStatus: "PENDING",
      failureCode: null,
      createdAt: Date.now(),
    });
    if (args.documentId) {
      const doc = await ctx.db.get(args.documentId);
      if (doc && doc.sourceCaptureId === null) await ctx.db.patch(args.documentId, { sourceCaptureId: id, status: "READY", protectedItemId: args.protectedItemId });
    }
    return id;
  },
});

/**
 * Sets a capture's source class once classification is known. Only allows the
 * transitions UNKNOWN_SOURCE -> any and FIRST_PARTY_PUBLIC_PAGE -> SECONDARY_PUBLIC_PAGE
 * (downgrade). Content fields (text, hash, capture time) are never touched.
 */
export const classifyCapture = internalMutation({
  args: { sourceCaptureId: v.id("sourceCaptures"), sourceClass: sourceClass },
  returns: v.null(),
  handler: async (ctx, { sourceCaptureId, sourceClass: next }) => {
    const cap = await ctx.db.get(sourceCaptureId);
    if (!cap || cap.sourceClass === next) return null;
    const allowed = cap.sourceClass === "UNKNOWN_SOURCE" || (cap.sourceClass === "FIRST_PARTY_PUBLIC_PAGE" && next === "SECONDARY_PUBLIC_PAGE");
    if (!allowed) return null;
    await ctx.db.patch(sourceCaptureId, {
      sourceClass: next,
      isFirstParty: cap.sourceUri ? next === "FIRST_PARTY_PUBLIC_PAGE" : cap.isFirstParty,
      provenanceRank: provenanceRank(next as SourceClass, cap.previousCaptureId === null),
    });
    return null;
  },
});

export const recordParse = internalMutation({
  args: {
    sourceCaptureId: v.id("sourceCaptures"),
    status: v.union(v.literal("PARSED"), v.literal("NEEDS_REVIEW"), v.literal("FAILED")),
    failureCode: v.union(v.string(), v.null()),
    modelId: v.union(v.string(), v.null()),
    schemaVersion: v.string(),
    unknowns: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.sourceCaptureId);
    if (!cap) return null;
    await ctx.db.insert("captureParses", { ...args, workspaceId: cap.workspaceId, unknowns: args.unknowns.slice(0, 30), createdAt: Date.now() });
    return null;
  },
});

export const getCaptureText = internalQuery({
  args: { sourceCaptureId: v.id("sourceCaptures") },
  handler: async (ctx, { sourceCaptureId }) => {
    const cap = await ctx.db.get(sourceCaptureId);
    return cap ? { normalizedText: cap.normalizedText, rawTextStorageId: cap.rawTextStorageId } : null;
  },
});

// ---------- commitments ----------

const builtEvidence = v.object({ excerpt: v.string(), page: v.union(v.number(), v.null()), sectionHint: v.union(v.string(), v.null()), bindingValidated: v.boolean() });
const eligibility = v.union(v.literal("AUTO_DETERMINISTIC"), v.literal("DISPLAY_ONLY"), v.literal("REVIEW_REQUIRED"), v.literal("REJECTED"));

const builtCommitment = v.object({
  kind: commitmentKind,
  key: v.string(),
  label: v.string(),
  valueType: v.union(v.literal("MONEY"), v.literal("INTEGER"), v.literal("DATE"), v.literal("TEXT"), v.literal("BOOLEAN")),
  currency: v.union(v.string(), v.null()),
  amountCents: v.union(v.number(), v.null()),
  integerValue: v.union(v.number(), v.null()),
  dateValue: v.union(v.number(), v.null()),
  textValue: v.union(v.string(), v.null()),
  booleanValue: v.union(v.boolean(), v.null()),
  cadence: v.union(v.literal("MONTHLY"), v.literal("ONE_TIME"), v.literal("ANNUAL"), v.literal("UNKNOWN"), v.null()),
  periodCount: v.union(v.number(), v.null()),
  effectiveStartAt: v.union(v.number(), v.null()),
  effectiveEndAt: v.union(v.number(), v.null()),
  effectiveStartText: v.union(v.string(), v.null()),
  confidence: v.union(v.literal("HIGH"), v.literal("MEDIUM"), v.literal("LOW")),
  evidenceBinding: v.union(v.literal("VALID"), v.literal("PARTIAL"), v.literal("FAILED")),
  decisionEligibility: eligibility,
  ambiguity: v.union(v.string(), v.null()),
  conditions: v.array(v.string()),
  evidence: v.array(builtEvidence),
});

export const applyCommitments = internalMutation({
  args: {
    sourceCaptureId: v.id("sourceCaptures"),
    sourceClass: sourceClass,
    providerName: v.union(v.string(), v.null()),
    productName: v.union(v.string(), v.null()),
    transactionAt: v.union(v.number(), v.null()),
    commitments: v.array(builtCommitment),
    modelId: v.union(v.string(), v.null()),
    schemaVersion: v.string(),
    applicability: v.union(
      v.null(),
      v.object({ outcome: v.union(v.literal("APPLIES"), v.literal("NOT_ESTABLISHED"), v.literal("DOES_NOT_APPLY")), reasons: v.array(v.string()), transactionCaptureId: v.union(v.id("sourceCaptures"), v.null()) }),
    ),
    transactionContextJson: v.union(v.string(), v.null()),
  },
  returns: v.object({ inserted: v.number(), auto: v.number() }),
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.sourceCaptureId);
    if (!cap) throw new Error("NOT_FOUND");
    const existing = await ctx.db.query("commitments").withIndex("by_source", (q) => q.eq("sourceCaptureId", cap._id)).first();
    if (existing) return { inserted: 0, auto: 0 };
    const item = (await ctx.db.get(cap.protectedItemId))!;
    const now = Date.now();
    let auto = 0;
    for (const c of args.commitments) {
      const { evidence, conditions, effectiveStartText, ...row } = c;
      const commitmentId = await ctx.db.insert("commitments", {
        ...row,
        workspaceId: cap.workspaceId,
        protectedItemId: cap.protectedItemId,
        sourceCaptureId: cap._id,
        schemaVersion: args.schemaVersion,
        modelId: args.modelId,
        createdAt: now,
      });
      if (c.decisionEligibility === "AUTO_DETERMINISTIC") auto++;
      for (const e of evidence) {
        await ctx.db.insert("commitmentEvidence", {
          workspaceId: cap.workspaceId,
          commitmentId,
          sourceCaptureId: cap._id,
          excerpt: e.excerpt,
          page: e.page,
          sectionHint: e.sectionHint,
          normalizedExcerptHash: await sha256Hex(normalizeForBinding(e.excerpt)),
          bindingValidated: e.bindingValidated,
          createdAt: now,
        });
      }
      for (const text of conditions) {
        await ctx.db.insert("commitmentConditions", {
          workspaceId: cap.workspaceId,
          commitmentId,
          conditionType: "STATED_CONDITION",
          conditionText: text,
          normalizedValue: null,
          decisionEligibility: "DISPLAY_ONLY",
          createdAt: now,
        });
      }
      if (effectiveStartText && /^\d{4}-\d{2}/.test(effectiveStartText) && c.kind === "PROMO_CREDIT_SCHEDULE" && !item.scheduleStartMonth) {
        await ctx.db.patch(item._id, { scheduleStartMonth: effectiveStartText.slice(0, 7) });
      }
    }
    const patch: Partial<Doc<"protectedItems">> = { updatedAt: now };
    if (!item.providerName && args.providerName) patch.providerName = args.providerName.slice(0, 120);
    if (!item.productName && args.productName) patch.productName = args.productName.slice(0, 160);
    if (item.transactionAt === null && args.transactionAt !== null && cap.sourceClass !== "FIRST_PARTY_PUBLIC_PAGE") patch.transactionAt = args.transactionAt;
    if (args.transactionContextJson && !item.transactionContextJson) {
      patch.transactionContextJson = args.transactionContextJson.slice(0, 2000);
      patch.transactionContextCaptureId = cap._id;
    }
    await ctx.db.patch(item._id, patch);
    if (args.applicability) {
      await ctx.db.insert("applicabilityChecks", {
        workspaceId: cap.workspaceId,
        protectedItemId: cap.protectedItemId,
        policyCaptureId: cap._id,
        transactionCaptureId: args.applicability.transactionCaptureId,
        outcome: args.applicability.outcome,
        reasons: args.applicability.reasons,
        createdAt: now,
      });
    }
    if (auto > 0) await ctx.db.insert("productEvents", { workspaceId: cap.workspaceId, name: "commitment_validated", createdAt: now });
    await generateExpectations(ctx, cap.protectedItemId);
    await comparePageToPrevious(ctx, cap);
    return { inserted: args.commitments.length, auto };
  },
});

export const transactionContextForItem = internalQuery({
  args: { protectedItemId: v.id("protectedItems") },
  handler: async (ctx, { protectedItemId }) => {
    const item = await ctx.db.get(protectedItemId);
    if (!item?.transactionContextJson) return null;
    return { context: JSON.parse(item.transactionContextJson), captureId: item.transactionContextCaptureId };
  },
});

export const getDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => await ctx.db.get(documentId),
});

export const setAssignmentClassification = internalMutation({
  args: { assignmentId: v.id("inboundAssignments"), classification: v.union(v.literal("SIGNUP_OR_ORDER"), v.literal("BILL_OR_STATEMENT"), v.literal("SUPPORT_REPLY"), v.literal("UNRELATED"), v.literal("UNKNOWN")) },
  returns: v.null(),
  handler: async (ctx, { assignmentId, classification }) => {
    const row = await ctx.db.get(assignmentId);
    if (!row) return null;
    await ctx.db.patch(assignmentId, { classification, assignmentStatus: classification === "UNRELATED" && row.assignmentStatus === "NEEDS_ASSIGNMENT" ? "IGNORED" : row.assignmentStatus, updatedAt: Date.now() });
    return null;
  },
});

export const setAssignmentProcessed = internalMutation({
  args: { assignmentId: v.id("inboundAssignments"), status: v.union(v.literal("PROCESSED"), v.literal("FAILED")) },
  returns: v.null(),
  handler: async (ctx, { assignmentId, status }) => {
    if (await ctx.db.get(assignmentId)) await ctx.db.patch(assignmentId, { processingStatus: status, updatedAt: Date.now() });
    return null;
  },
});

export const commitmentKeysForItem = internalQuery({
  args: { protectedItemId: v.id("protectedItems") },
  handler: async (ctx, { protectedItemId }) => {
    const rows = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", protectedItemId)).take(100);
    return rows
      .filter((c) => c.decisionEligibility !== "REJECTED")
      .map((c) => ({ key: c.key, label: c.label, kind: c.kind, valueType: c.valueType, amountCents: c.amountCents, currency: c.currency, integerValue: c.integerValue, textValue: c.textValue, cadence: c.cadence, periodCount: c.periodCount, decisionEligibility: c.decisionEligibility }));
  },
});

/** The single decidable recurring-credit commitment for an item, or a conflict. */
async function scheduleCommitment(ctx: MutationCtx, itemId: Id<"protectedItems">): Promise<{ c: Doc<"commitments"> | null; conflict: boolean }> {
  const rows = await ctx.db
    .query("commitments")
    .withIndex("by_item_kind", (q) => q.eq("protectedItemId", itemId).eq("kind", "PROMO_CREDIT_SCHEDULE"))
    .take(50);
  const auto = rows.filter((c) => c.decisionEligibility === "AUTO_DETERMINISTIC");
  if (auto.length === 0) return { c: null, conflict: false };
  const caps = await Promise.all(auto.map((c) => ctx.db.get(c.sourceCaptureId)));
  const ranked = auto.map((c, i) => ({ c, rank: caps[i]?.provenanceRank ?? 9, at: caps[i]?.capturedAt ?? 0 })).sort((a, b) => a.rank - b.rank || a.at - b.at);
  const best = ranked[0];
  const conflict = ranked.some((r) => r.rank === best.rank && (r.c.amountCents !== best.c.amountCents || r.c.periodCount !== best.c.periodCount));
  return { c: best.c, conflict };
}

async function generateExpectations(ctx: MutationCtx, itemId: Id<"protectedItems">): Promise<void> {
  const { c } = await scheduleCommitment(ctx, itemId);
  if (!c || c.amountCents === null || !c.periodCount) return;
  const existing = await ctx.db.query("expectedEvents").withIndex("by_commitment_periodIndex", (q) => q.eq("commitmentId", c._id)).first();
  if (existing) return;
  const item = (await ctx.db.get(itemId))!;
  const events = generateMonthlyCreditSchedule({ amountCents: c.amountCents, currency: c.currency ?? "USD", periodCount: c.periodCount, startMonth: parseYearMonth(item.scheduleStartMonth) });
  const now = Date.now();
  for (const e of events) {
    await ctx.db.insert("expectedEvents", {
      workspaceId: c.workspaceId,
      protectedItemId: itemId,
      commitmentId: c._id,
      periodIndex: e.periodIndex,
      expectedAt: e.expectedAt,
      windowStartAt: e.windowStartAt,
      windowEndAt: e.windowEndAt,
      kind: c.kind,
      expectedAmountCents: e.expectedAmountCents,
      currency: e.currency,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function factsForCapture(ctx: MutationCtx, captureId: Id<"sourceCaptures">): Promise<NormalizedFact[]> {
  const rows = await ctx.db.query("commitments").withIndex("by_source", (q) => q.eq("sourceCaptureId", captureId)).take(100);
  return rows.map((c) => ({
    kind: c.kind,
    label: c.label,
    valueType: c.valueType,
    amountCents: c.amountCents,
    currency: c.currency,
    integerValue: c.integerValue,
    dateValue: c.dateValue,
    textValue: c.textValue,
    booleanValue: c.booleanValue,
    periodCount: c.periodCount,
    decisionEligibility: c.decisionEligibility,
  }));
}

/** FR-014: compare a refreshed public page's normalized facts with the item's T0 capture of the same URI. */
async function comparePageToPrevious(ctx: MutationCtx, cap: Doc<"sourceCaptures">): Promise<void> {
  if (!cap.previousCaptureId) return;
  let t0 = await ctx.db.get(cap.previousCaptureId);
  while (t0?.previousCaptureId) {
    const older: Doc<"sourceCaptures"> | null = await ctx.db.get(t0.previousCaptureId);
    if (!older) break;
    t0 = older;
  }
  if (!t0) return;
  const cmp = comparePageFacts({ t0Hash: t0.contentSha256, tnHash: cap.contentSha256, t0Facts: await factsForCapture(ctx, t0._id), tnFacts: await factsForCapture(ctx, cap._id) });
  await ctx.db.insert("pageComparisons", {
    workspaceId: cap.workspaceId,
    protectedItemId: cap.protectedItemId,
    t0CaptureId: t0._id,
    tnCaptureId: cap._id,
    rawSourceChanged: cmp.rawSourceChanged,
    materialCommercialChange: cmp.materialCommercialChange,
    outcome: cmp.outcome,
    diffsJson: JSON.stringify(cmp.diffs),
    mechanismVersion: MECHANISM_VERSION,
    createdAt: Date.now(),
  });
}

// ---------- statements ----------

const builtLine = v.object({
  key: v.string(),
  label: v.string(),
  category: v.string(),
  amountCents: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  installmentIndex: v.union(v.number(), v.null()),
  installmentCount: v.union(v.number(), v.null()),
  relatesToCommitmentKey: v.union(v.string(), v.null()),
  matchesCommitment: v.union(v.literal("YES"), v.literal("NO"), v.literal("AMBIGUOUS")),
  confidence: v.union(v.literal("HIGH"), v.literal("MEDIUM"), v.literal("LOW")),
  evidenceExcerpt: v.union(v.string(), v.null()),
  evidenceBinding: v.union(v.literal("VALID"), v.literal("PARTIAL"), v.literal("FAILED")),
  decisionEligibility: eligibility,
});

export const applyStatement = internalMutation({
  args: {
    sourceCaptureId: v.id("sourceCaptures"),
    statementMonth: v.union(v.string(), v.null()),
    statementDateIso: v.union(v.string(), v.null()),
    servicePeriodStartIso: v.union(v.string(), v.null()),
    servicePeriodEndIso: v.union(v.string(), v.null()),
    planName: v.union(v.string(), v.null()),
    providerName: v.union(v.string(), v.null()),
    itemized: v.boolean(),
    totalAmountCents: v.union(v.number(), v.null()),
    lines: v.array(builtLine),
    modelId: v.union(v.string(), v.null()),
  },
  returns: v.id("statements"),
  handler: async (ctx, args) => {
    const cap = await ctx.db.get(args.sourceCaptureId);
    if (!cap) throw new Error("NOT_FOUND");
    const existing = await ctx.db.query("statements").withIndex("by_source", (q) => q.eq("sourceCaptureId", cap._id)).unique();
    if (existing) return existing._id;
    const now = Date.now();
    const statementAt = args.statementDateIso ? Date.parse(`${args.statementDateIso.slice(0, 10)}T00:00:00Z`) || null : null;
    const statementId = await ctx.db.insert("statements", {
      workspaceId: cap.workspaceId,
      protectedItemId: cap.protectedItemId,
      sourceCaptureId: cap._id,
      providerName: args.providerName,
      statementMonth: args.statementMonth,
      statementDateIso: args.statementDateIso,
      servicePeriodStartIso: args.servicePeriodStartIso,
      servicePeriodEndIso: args.servicePeriodEndIso,
      planName: args.planName,
      itemized: args.itemized,
      totalAmountCents: args.totalAmountCents,
      modelId: args.modelId,
      createdAt: now,
    });
    for (const l of args.lines) {
      await ctx.db.insert("observations", {
        workspaceId: cap.workspaceId,
        protectedItemId: cap.protectedItemId,
        sourceCaptureId: cap._id,
        statementId,
        observationType: "BILL_LINE_ITEM",
        key: l.key,
        label: l.label,
        category: l.category,
        matchesCommitment: l.matchesCommitment,
        observedAt: now,
        statementAt,
        valueType: "MONEY",
        currency: l.currency,
        amountCents: l.amountCents,
        integerValue: l.installmentIndex,
        dateValue: null,
        textValue: l.relatesToCommitmentKey,
        booleanValue: null,
        evidenceExcerpt: l.evidenceExcerpt,
        confidence: l.confidence,
        evidenceBinding: l.evidenceBinding,
        decisionEligibility: l.decisionEligibility,
        modelId: args.modelId,
        createdAt: now,
      });
    }
    if (args.planName) {
      await ctx.db.insert("observations", {
        workspaceId: cap.workspaceId,
        protectedItemId: cap.protectedItemId,
        sourceCaptureId: cap._id,
        statementId,
        observationType: "PLAN_NAME",
        key: "PLAN_NAME",
        label: "Plan on statement",
        category: null,
        matchesCommitment: null,
        observedAt: now,
        statementAt,
        valueType: "TEXT",
        currency: null,
        amountCents: null,
        integerValue: null,
        dateValue: null,
        textValue: args.planName.slice(0, 200),
        booleanValue: null,
        evidenceExcerpt: null,
        confidence: "MEDIUM",
        evidenceBinding: "PARTIAL",
        decisionEligibility: "DISPLAY_ONLY",
        modelId: args.modelId,
        createdAt: now,
      });
    }
    await ctx.db.insert("productEvents", { workspaceId: cap.workspaceId, name: "observation_ingested", createdAt: now });
    return statementId;
  },
});

// ---------- reconciliation ----------

type StatementBundle = { statement: Doc<"statements">; lines: BuiltLine[] };

async function loadStatements(ctx: MutationCtx, itemId: Id<"protectedItems">): Promise<StatementBundle[]> {
  const statements = await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).take(200);
  const out: StatementBundle[] = [];
  for (const s of statements) {
    const obs = await ctx.db.query("observations").withIndex("by_statement", (q) => q.eq("statementId", s._id)).take(120);
    out.push({
      statement: s,
      lines: obs
        .filter((o) => o.observationType === "BILL_LINE_ITEM")
        .map((o) => ({
          key: o.key,
          label: o.label,
          category: o.category ?? "OTHER",
          amountCents: o.amountCents,
          currency: o.currency,
          installmentIndex: o.integerValue,
          installmentCount: null,
          relatesToCommitmentKey: o.textValue,
          matchesCommitment: o.matchesCommitment ?? "NO",
          confidence: o.confidence,
          evidenceExcerpt: o.evidenceExcerpt,
          evidenceBinding: o.evidenceBinding,
          decisionEligibility: o.decisionEligibility,
        })),
    });
  }
  return out;
}

function nextItemStatus(current: ItemStatus, outcome: string | null, hasAuto: boolean, caseOpen: boolean): ItemStatus {
  if (current === "ARCHIVED") return current;
  if (!hasAuto) return "NEEDS_REVIEW";
  if (caseOpen) return outcome === "MATERIAL_DIFFERENCE" || outcome === "MATCH" || outcome === "INSUFFICIENT_EVIDENCE" ? "CASE_OPEN" : "CASE_OPEN";
  if (outcome === "MATERIAL_DIFFERENCE") return "MATERIAL_DIFFERENCE";
  if (outcome === "REVIEW_REQUIRED" || outcome === "SOURCE_CONFLICT") return "NEEDS_REVIEW";
  return "PROTECTED";
}

export const reconcileItem = internalMutation({
  args: { protectedItemId: v.id("protectedItems"), trigger: v.union(v.literal("SOURCE_INGESTED"), v.literal("SOURCE_REFRESH"), v.literal("MANUAL"), v.literal("EVALUATION")) },
  returns: v.union(v.id("reconciliations"), v.null()),
  handler: async (ctx, { protectedItemId, trigger }) => {
    const item = await ctx.db.get(protectedItemId);
    if (!item) return null;
    const now = Date.now();
    const anyAuto = await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", protectedItemId)).take(100);
    const hasAuto = anyAuto.some((c) => c.decisionEligibility === "AUTO_DETERMINISTIC");
    const { c: sched, conflict } = await scheduleCommitment(ctx, protectedItemId);
    const bundles = await loadStatements(ctx, protectedItemId);
    const openCase = await ctx.db
      .query("cases")
      .withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", protectedItemId))
      .order("desc")
      .first();
    const caseActive = openCase !== null && openCase.status !== "RESOLVED" && openCase.status !== "CLOSED";

    let recId: Id<"reconciliations"> | null = null;
    let outcome: Doc<"reconciliations">["overallOutcome"] = null;

    if (sched && sched.amountCents !== null && sched.periodCount) {
      const anchor = deriveScheduleStart(
        bundles.map((b) => ({ statementMonth: b.statement.statementMonth, lines: b.lines })),
        item.scheduleStartMonth,
      );
      const startMonth = anchor.status === "ANCHORED" ? anchor.startMonth : null;
      const schedule = generateMonthlyCreditSchedule({ amountCents: sched.amountCents, currency: sched.currency ?? "USD", periodCount: sched.periodCount, startMonth });
      const observed: ObservedStatement[] = bundles.map((b) => toObservedStatement(b.statement._id, { statementMonth: b.statement.statementMonth, itemized: b.statement.itemized, lines: b.lines }, startMonth));
      const r = reconcileCreditSchedule(schedule, observed);
      outcome = conflict || anchor.status === "CONFLICT" ? "SOURCE_CONFLICT" : bundles.length === 0 ? "INSUFFICIENT_EVIDENCE" : r.overallOutcome;
      recId = await ctx.db.insert("reconciliations", {
        workspaceId: item.workspaceId,
        protectedItemId,
        triggerType: trigger,
        status: "COMPLETE",
        overallOutcome: outcome,
        observedDifferenceCents: r.observedMissingCents,
        remainingScheduledValueCents: r.remainingScheduledCents,
        observedReceivedCents: r.observedReceivedCents,
        notYetDueCents: r.notYetDueCents,
        latestObservedPeriod: r.latestObservedPeriod,
        periodCount: sched.periodCount,
        currency: r.currency,
        mechanismVersion: MECHANISM_VERSION,
        startedAt: now,
        completedAt: now,
        failureCode: anchor.status === "CONFLICT" ? "ANCHOR_CONFLICT" : conflict ? "COMMITMENT_CONFLICT" : null,
      });
      const events = await ctx.db.query("expectedEvents").withIndex("by_commitment_periodIndex", (q) => q.eq("commitmentId", sched._id)).take(130);
      const eventByPeriod = new Map(events.map((e) => [e.periodIndex, e]));
      for (const p of [...r.periods, ...r.unmapped]) {
        const ev = p.periodIndex !== null ? eventByPeriod.get(p.periodIndex) : undefined;
        if (ev) {
          const status = p.outcome === "MATCH" ? "OBSERVED_MATCH" : p.outcome === "MATERIAL_DIFFERENCE" ? "OBSERVED_DIFFERENCE" : p.outcome === "NOT_DUE" ? "NOT_DUE" : p.outcome === "NOT_OBSERVED" ? "PENDING" : "UNKNOWN";
          const expectedAt = startMonth ? schedule[(p.periodIndex ?? 1) - 1]?.expectedAt ?? null : null;
          if (ev.status !== status || ev.expectedAt !== expectedAt) await ctx.db.patch(ev._id, { status, expectedAt, windowStartAt: expectedAt, updatedAt: now });
        }
        if (p.outcome === "NOT_DUE" || p.outcome === "NOT_OBSERVED") continue;
        const bundle = bundles.find((b) => b.statement._id === p.statementKey);
        await ctx.db.insert("reconciliationFindings", {
          workspaceId: item.workspaceId,
          reconciliationId: recId,
          protectedItemId,
          commitmentId: sched._id,
          expectedEventId: ev?._id ?? null,
          observationId: null,
          statementId: bundle?.statement._id ?? null,
          periodIndex: p.periodIndex,
          kind: sched.kind,
          outcome: p.outcome,
          expectedDisplay: p.expectedCents === null ? "—" : formatCents(p.expectedCents, r.currency),
          observedDisplay: p.observedCents === null ? "not comparable" : formatCents(p.observedCents, r.currency),
          amountDeltaCents: p.deltaCents,
          reasonCode: p.reasonCode,
          explanation: explain(p.reasonCode, p.periodIndex, bundle?.statement.statementMonth ?? null),
          material: p.outcome === "MATERIAL_DIFFERENCE",
          createdAt: now,
        });
      }
      if (outcome === "MATERIAL_DIFFERENCE" && item.status !== "MATERIAL_DIFFERENCE" && item.status !== "CASE_OPEN") {
        await ctx.db.insert("productEvents", { workspaceId: item.workspaceId, name: "material_difference_detected", createdAt: now });
      }

      // Resolution verification: only a later reconciled statement can move WAITING_TO_VERIFY.
      if (openCase && item.resolutionState === "WAITING_TO_VERIFY") {
        const pending = await ctx.db.query("resolutionVerifications").withIndex("by_case_createdAt", (q) => q.eq("caseId", openCase._id)).order("desc").first();
        const claimAfter = pending?.claimAfterPeriod ?? r.latestObservedPeriod ?? 0;
        const v2 = verifyResolution({ schedule, disputedPeriods: openCase.disputedPeriods, claimAfterPeriod: claimAfter, statements: observed });
        const lastResult = pending?.result ?? "WAITING_TO_VERIFY";
        const newResult = v2.result === "INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : v2.result;
        const sameAsLast = lastResult === newResult && pending?.verificationStatementId === (v2.qualifyingStatementKey as Id<"statements"> | null);
        if (!sameAsLast && !(newResult === "INSUFFICIENT_EVIDENCE" && bundles.every((b) => b.statement._creationTime <= (pending?._creationTime ?? 0)))) {
          await ctx.db.insert("resolutionVerifications", {
            workspaceId: item.workspaceId,
            protectedItemId,
            caseId: openCase._id,
            claimedResolutionMessageId: pending?.claimedResolutionMessageId ?? null,
            claimedResolutionAt: pending?.claimedResolutionAt ?? null,
            claimAfterPeriod: claimAfter,
            verificationStatementId: (v2.qualifyingStatementKey as Id<"statements"> | null) ?? null,
            reconciliationId: recId,
            result: newResult,
            verifiedRestoredCents: v2.verifiedRestoredCents,
            currency: r.currency,
            expectedPeriodKey: v2.qualifyingPeriod !== null ? `P${v2.qualifyingPeriod}` : null,
            evidenceRefs: v2.qualifyingStatementKey ? [v2.qualifyingStatementKey] : [],
            createdAt: now,
          });
          await applyVerificationInTx(ctx, openCase._id, newResult, v2.reason);
        }
      }
    } else {
      outcome = conflict ? "SOURCE_CONFLICT" : null;
    }

    const refreshed = (await ctx.db.get(protectedItemId))!;
    const caseStillActive = caseActive && refreshed.resolutionState !== "VERIFIED_FIXED";
    const target = nextItemStatus(refreshed.status, outcome, hasAuto, caseStillActive);
    const patch: Partial<Doc<"protectedItems">> = { updatedAt: now };
    if (recId) patch.latestReconciliationId = recId;
    if (target !== refreshed.status && itemMachine.can(refreshed.status, target)) {
      patch.status = target;
      if (target === "PROTECTED" && refreshed.protectedAt === null) {
        patch.protectedAt = now;
        await ctx.db.insert("productEvents", { workspaceId: item.workspaceId, name: "item_protected", createdAt: now });
      }
    }
    await ctx.db.patch(protectedItemId, patch);
    return recId;
  },
});

function explain(code: string, period: number | null, month: string | null): string {
  const where = period !== null ? `period ${period}${month ? ` (${month})` : ""}` : month ? `the ${month} statement` : "this statement";
  switch (code) {
    case "AMOUNT_EQUAL":
      return `The ${where} bill shows the recorded credit amount.`;
    case "CREDIT_LINE_ABSENT":
      return `The ${where} bill lists charges and credits but no line for the recorded promotional credit.`;
    case "AMOUNT_DIFFERS":
      return `The ${where} bill shows the promotional credit at a different amount than recorded.`;
    case "AMBIGUOUS_LINE_ITEM":
      return `A credit on the ${where} bill might be the promotion, but it isn't clearly labelled. Kept won't guess.`;
    case "MULTIPLE_CANDIDATE_LINES":
      return `The ${where} bill has more than one line that could be the promotion.`;
    case "NOT_ITEMIZED":
      return `The ${where} document shows only a total, so the credit can't be checked.`;
    case "PERIOD_UNMAPPED":
      return "Kept can't tell which promotion month this statement belongs to yet.";
    case "CONFLICTING_STATEMENTS":
      return `Two documents for ${where} disagree.`;
    case "AFTER_SCHEDULE_END":
      return "This statement is after the promotion's recorded end.";
    case "BEFORE_SCHEDULE_START":
      return "This statement is before the promotion's first credit.";
    default:
      return code;
  }
}

export const setResolutionState = internalMutation({
  args: { protectedItemId: v.id("protectedItems"), to: v.union(v.literal("NONE"), v.literal("PROVIDER_CLAIMS_FIXED"), v.literal("WAITING_TO_VERIFY"), v.literal("VERIFIED_FIXED"), v.literal("STILL_MISMATCHED")) },
  returns: v.null(),
  handler: async (ctx, { protectedItemId, to }) => {
    const item = await ctx.db.get(protectedItemId);
    if (!item) return null;
    resolutionMachine.assert(item.resolutionState, to);
    await ctx.db.patch(protectedItemId, { resolutionState: to, updatedAt: Date.now() });
    return null;
  },
});

export const setItemStatus = internalMutation({
  args: { protectedItemId: v.id("protectedItems"), to: v.union(v.literal("CAPTURING"), v.literal("PROTECTED"), v.literal("NEEDS_REVIEW"), v.literal("MATERIAL_DIFFERENCE"), v.literal("CASE_OPEN"), v.literal("ARCHIVED"), v.literal("FAILED")) },
  returns: v.null(),
  handler: async (ctx, { protectedItemId, to }) => {
    const item = await ctx.db.get(protectedItemId);
    if (!item || item.status === to) return null;
    itemMachine.assert(item.status, to);
    await ctx.db.patch(protectedItemId, { status: to, updatedAt: Date.now() });
    return null;
  },
});

export const createJob = internalMutation({
  args: { workspaceId: v.id("workspaces"), protectedItemId: v.union(v.id("protectedItems"), v.null()), caseId: v.union(v.id("cases"), v.null()), type: v.string() },
  returns: v.id("jobs"),
  handler: async (ctx, a) => {
    const now = Date.now();
    return await ctx.db.insert("jobs", { ...a, status: "QUEUED", step: "QUEUED", progress: 0, failureCode: null, safeMessage: null, createdAt: now, updatedAt: now });
  },
});

export const createAttachmentDocument = internalMutation({
  args: {
    assignmentId: v.id("inboundAssignments"),
    storageId: v.id("_storage"),
    filename: v.union(v.string(), v.null()),
    mimeType: v.string(),
    byteSize: v.number(),
    sha256: v.string(),
  },
  returns: v.union(v.id("documents"), v.null()),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.assignmentId);
    if (!row) return null;
    return await ctx.db.insert("documents", {
      workspaceId: row.workspaceId,
      protectedItemId: row.protectedItemId,
      sourceCaptureId: null,
      sourceClass: "UNKNOWN_SOURCE",
      storageId: a.storageId,
      agentmailMessageId: row.agentmailMessageId,
      agentmailThreadId: row.agentmailThreadId,
      filename: a.filename,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      sha256: a.sha256,
      originalText: null,
      status: "RECEIVED",
      createdAt: Date.now(),
    });
  },
});

export const documentsForMessage = internalQuery({
  args: { agentmailMessageId: v.string() },
  handler: async (ctx, { agentmailMessageId }) => await ctx.db.query("documents").withIndex("by_agentmailMessageId", (q) => q.eq("agentmailMessageId", agentmailMessageId)).take(12),
});

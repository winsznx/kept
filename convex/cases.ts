import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { domainError, requireCase, requireProtectedItem } from "./lib/authz";
import { packetFacts, templateDraft, type EvidencePacket } from "./lib/casePacket";
import { normalizeText } from "./lib/factCompare";
import { sha256Hex } from "./lib/hashing";
import { approvalRequiredFor, caseMachine, itemMachine, resolutionMachine, type CaseStatus } from "./lib/stateMachines";

type EventType = Doc<"caseEvents">["type"];

async function addEvent(ctx: MutationCtx, kase: Doc<"cases">, type: EventType, summary: string, opts: { externalMessageId?: string | null; dedupeKey?: string | null } = {}): Promise<boolean> {
  if (opts.dedupeKey) {
    const dup = await ctx.db.query("caseEvents").withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", opts.dedupeKey!)).first();
    if (dup) return false;
  }
  await ctx.db.insert("caseEvents", {
    workspaceId: kase.workspaceId,
    caseId: kase._id,
    type,
    externalMessageId: opts.externalMessageId ?? null,
    dedupeKey: opts.dedupeKey ?? null,
    summary,
    createdAt: Date.now(),
  });
  return true;
}

async function transition(ctx: MutationCtx, kase: Doc<"cases">, to: CaseStatus, opts: { userApproved?: boolean } = {}): Promise<void> {
  if (kase.status === to) return;
  caseMachine.assert(kase.status, to);
  if (approvalRequiredFor(kase.status, to) && !opts.userApproved) throw domainError("INVALID_STATE_TRANSITION", "Sending requires your approval.");
  await ctx.db.patch(kase._id, { status: to, updatedAt: Date.now() });
  kase.status = to;
}

// ---------- create ----------

export const create = mutation({
  args: { itemId: v.id("protectedItems") },
  returns: v.id("cases"),
  handler: async (ctx, { itemId }) => {
    const { item } = await requireProtectedItem(ctx, itemId);
    const existing = await ctx.db.query("cases").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", itemId)).order("desc").first();
    if (existing && existing.status !== "CLOSED" && existing.status !== "RESOLVED") return existing._id;
    if (item.status !== "MATERIAL_DIFFERENCE") throw domainError("INVALID_STATE_TRANSITION", "A case can be opened when Kept finds a material difference.");
    const packet = await buildPacket(ctx, item);
    if (!packet) throw domainError("NO_SUPPORTED_COMMITMENT", "Kept doesn't have a source-backed difference to build a case from.");
    const now = Date.now();
    const draft = templateDraft(packet);
    const caseId = await ctx.db.insert("cases", {
      workspaceId: item.workspaceId,
      protectedItemId: itemId,
      status: "DRAFT",
      issueType: "MISSING_PROMO_CREDIT",
      recipientEmail: null,
      subject: draft.subject,
      draftText: draft.body,
      draftSource: "TEMPLATE",
      agentmailThreadId: null,
      agentmailOutboundId: null,
      sendIdempotencyKey: null,
      approvedAt: null,
      latestPacketVersion: 1,
      disputedPeriods: [packet.expected.periodIndex],
      resolutionState: "NONE",
      resolutionSummary: null,
      createdAt: now,
      updatedAt: now,
    });
    const payloadJson = JSON.stringify(packet);
    await ctx.db.insert("caseEvidencePackets", { workspaceId: item.workspaceId, caseId, version: 1, payloadJson, payloadSha256: await sha256Hex(payloadJson), createdAt: now });
    const kase = (await ctx.db.get(caseId))!;
    await addEvent(ctx, kase, "CREATED", `Case opened for credit ${packet.expected.periodIndex} of ${packet.recorded.periodCount}.`);
    itemMachine.assert(item.status, "CASE_OPEN");
    await ctx.db.patch(itemId, { status: "CASE_OPEN", updatedAt: now });
    await ctx.db.insert("productEvents", { workspaceId: item.workspaceId, name: "case_created", createdAt: now });
    await ctx.scheduler.runAfter(0, internal.internal.ai.draftCase, { caseId });
    return caseId;
  },
});

/** Freezes the facts behind the latest material finding into a packet. Returns null if there is none. */
export async function buildPacket(ctx: MutationCtx, item: Doc<"protectedItems">): Promise<EvidencePacket | null> {
  if (!item.latestReconciliationId) return null;
  const rec = await ctx.db.get(item.latestReconciliationId);
  if (!rec) return null;
  const findings = await ctx.db.query("reconciliationFindings").withIndex("by_reconciliation", (q) => q.eq("reconciliationId", rec._id)).take(200);
  const material = findings.filter((f) => f.material).sort((a, b) => (b.periodIndex ?? 0) - (a.periodIndex ?? 0))[0];
  if (!material || !material.commitmentId) return null;
  const commitment = await ctx.db.get(material.commitmentId);
  if (!commitment || commitment.amountCents === null || commitment.periodCount === null) return null;
  const cap = await ctx.db.get(commitment.sourceCaptureId);
  const ev = await ctx.db.query("commitmentEvidence").withIndex("by_commitment", (q) => q.eq("commitmentId", commitment._id)).take(5);
  const statement = material.statementId ? await ctx.db.get(material.statementId) : null;
  const creditObs = statement
    ? (await ctx.db.query("observations").withIndex("by_statement", (q) => q.eq("statementId", statement._id)).take(120)).find((o) => o.matchesCommitment === "YES")
    : undefined;
  const planCommitment = (await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", item._id).eq("kind", "REQUIRED_PLAN")).take(5)).find((c) => c.decisionEligibility === "AUTO_DETERMINISTIC");
  const planOnBill = statement?.planName ?? null;
  const unknowns: string[] = [];
  if (!planOnBill) unknowns.push("The bill doesn't show which plan is active.");
  else if (planCommitment?.textValue && normalizeText(planOnBill) !== normalizeText(planCommitment.textValue)) unknowns.push("The plan on the bill differs from the plan the offer requires.");
  unknowns.push("Kept can't see account changes that aren't on the bill.");
  const base = {
    version: 1,
    provider: item.providerName,
    product: item.productName,
    issueSummary: `Credit ${material.periodIndex} of ${commitment.periodCount} (${material.expectedDisplay}) was not observed as recorded.`,
    recorded: {
      commitmentLabel: commitment.label,
      amountCents: commitment.amountCents,
      currency: commitment.currency ?? "USD",
      periodCount: commitment.periodCount,
      excerpt: ev.find((e) => e.bindingValidated)?.excerpt ?? null,
      sourceClass: cap?.sourceClass ?? "UNKNOWN_SOURCE",
      capturedAt: cap?.capturedAt ?? commitment.createdAt,
      transactionAt: item.transactionAt,
    },
    expected: { periodIndex: material.periodIndex ?? 0, statementMonth: statement?.statementMonth ?? null, amountCents: commitment.amountCents },
    observed: {
      statementMonth: statement?.statementMonth ?? null,
      observedCents: commitment.amountCents + (material.amountDeltaCents ?? 0),
      deltaCents: material.amountDeltaCents ?? -commitment.amountCents,
      reasonCode: material.reasonCode,
      excerpt: creditObs?.evidenceExcerpt ?? null,
    },
    totals: { observedMissingCents: rec.observedDifferenceCents ?? 0, remainingScheduledCents: rec.remainingScheduledValueCents ?? 0 },
    requiredPlan: planCommitment?.textValue ?? null,
    unknowns,
    requestedAction: "Check the promotion on the account and correct the missing credit, or explain why it was not applied.",
  };
  return { ...base, facts: packetFacts(base) };
}

// ---------- draft / approve / send ----------

const EMAIL_RE = /^[^\s@<>"]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export const updateDraft = mutation({
  args: { caseId: v.id("cases"), recipientEmail: v.string(), subject: v.string(), draftText: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { kase } = await requireCase(ctx, args.caseId);
    if (kase.status !== "DRAFT" && kase.status !== "READY_TO_SEND" && kase.status !== "NEEDS_USER_ACTION" && kase.status !== "REPLY_RECEIVED") {
      throw domainError("INVALID_STATE_TRANSITION", "This case can't be edited right now.");
    }
    const recipient = args.recipientEmail.trim();
    if (!EMAIL_RE.test(recipient) || recipient.length > 254) throw domainError("CASE_RECIPIENT_REQUIRED", "Enter a valid support email address.");
    if (args.subject.trim().length === 0 || args.subject.length > 200) throw domainError("INVALID_INPUT", "Subject must be 1-200 characters.");
    if (args.draftText.trim().length === 0 || args.draftText.length > 5000) throw domainError("INVALID_INPUT", "Message must be 1-5000 characters.");
    const replying = kase.status === "REPLY_RECEIVED" || (kase.status === "NEEDS_USER_ACTION" && kase.agentmailThreadId !== null);
    await ctx.db.patch(kase._id, { recipientEmail: recipient, subject: args.subject.trim(), draftText: args.draftText, sendIdempotencyKey: null, updatedAt: Date.now() });
    if (kase.status === "DRAFT" || (replying && kase.status !== "READY_TO_SEND")) await transition(ctx, kase, "READY_TO_SEND");
    return null;
  },
});

/**
 * The only path to SENDING. Duplicate clicks after approval return the existing send
 * state; the idempotency key is derived from case + exact content, so an internal
 * retry of the same approved message can never become a second, different email.
 */
export const approveAndSend = mutation({
  args: { caseId: v.id("cases") },
  returns: v.object({ status: v.string(), duplicate: v.boolean() }),
  handler: async (ctx, { caseId }) => {
    const { ws, kase } = await requireCase(ctx, caseId);
    if (kase.status === "SENDING" || kase.status === "WAITING_FOR_REPLY") return { status: kase.status, duplicate: true };
    if (kase.status !== "READY_TO_SEND") throw domainError("INVALID_STATE_TRANSITION", "Review the draft and recipient first.");
    if (!kase.recipientEmail || !kase.draftText || !kase.subject) throw domainError("CASE_RECIPIENT_REQUIRED", "Add a recipient first.");
    if (!ws.agentmailInboxId) throw domainError("AGENTMAIL_SEND_FAILED", "Your Kept inbox isn't ready yet.");
    const key = `kept-${kase._id}-${(await sha256Hex(`${kase.recipientEmail}\n${kase.subject}\n${kase.draftText}\n${kase.agentmailThreadId ?? ""}`)).slice(0, 32)}`;
    const now = Date.now();
    await ctx.db.patch(kase._id, { sendIdempotencyKey: key, approvedAt: now });
    await transition(ctx, kase, "SENDING", { userApproved: true });
    await addEvent(ctx, kase, "APPROVED", "You approved the message for sending.");
    await ctx.db.insert("productEvents", { workspaceId: ws._id, name: "case_approved", createdAt: now });
    await ctx.scheduler.runAfter(0, internal.internal.caseSend.send, { caseId, attempt: 1 });
    return { status: "SENDING", duplicate: false };
  },
});

export const getSendContext = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const kase = await ctx.db.get(caseId);
    if (!kase) return null;
    const ws = await ctx.db.get(kase.workspaceId);
    let replyToMessageId: string | null = null;
    if (kase.agentmailThreadId) {
      const last = await ctx.db.query("inboundAssignments").withIndex("by_threadId", (q) => q.eq("agentmailThreadId", kase.agentmailThreadId!)).order("desc").first();
      replyToMessageId = last?.agentmailMessageId ?? kase.agentmailOutboundId;
    }
    return { kase, inboxId: ws?.agentmailInboxId ?? null, replyToMessageId };
  },
});

export const markSent = internalMutation({
  args: { caseId: v.id("cases"), idempotencyKey: v.string(), messageId: v.string(), threadId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const kase = await ctx.db.get(a.caseId);
    if (!kase || kase.sendIdempotencyKey !== a.idempotencyKey || kase.status !== "SENDING") return null;
    await ctx.db.patch(kase._id, { agentmailThreadId: kase.agentmailThreadId ?? a.threadId, agentmailOutboundId: a.messageId });
    await transition(ctx, kase, "WAITING_FOR_REPLY");
    await addEvent(ctx, kase, "SENT", "Sent from your Kept inbox. AgentMail accepted the message.", { externalMessageId: a.messageId, dedupeKey: `sent:${a.messageId}` });
    await ctx.db.insert("productEvents", { workspaceId: kase.workspaceId, name: "case_sent", createdAt: Date.now() });
    return null;
  },
});

export const markSendFailed = internalMutation({
  args: { caseId: v.id("cases"), idempotencyKey: v.string(), code: v.string(), retryable: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const kase = await ctx.db.get(a.caseId);
    if (!kase || kase.sendIdempotencyKey !== a.idempotencyKey || kase.status !== "SENDING") return null;
    await transition(ctx, kase, a.retryable ? "READY_TO_SEND" : "NEEDS_USER_ACTION");
    await addEvent(ctx, kase, "SEND_FAILED", a.retryable ? `Not sent (${a.code}). Nothing was delivered; you can try again.` : `Not sent (${a.code}). Check the recipient and try again.`);
    return null;
  },
});

/** Delivery lifecycle from the AgentMail component's onEvent callback. */
export const onAgentMailEvent = internalMutation({
  args: { event: v.any() },
  returns: v.null(),
  handler: async (ctx, { event }) => {
    const e = event as { event_type?: string; type?: string; event_id?: string; message?: { message_id?: string; thread_id?: string }; send?: { message_id?: string; thread_id?: string } };
    const type = e.event_type ?? e.type;
    const msg = e.message ?? e.send;
    if (!msg?.thread_id || !msg.message_id || !type) return null;
    const kase = await ctx.db.query("cases").withIndex("by_thread", (q) => q.eq("agentmailThreadId", msg.thread_id!)).unique();
    if (!kase || kase.agentmailOutboundId !== msg.message_id) return null;
    if (type === "message.delivered") await addEvent(ctx, kase, "DELIVERED", "Delivered to the recipient's mail server.", { externalMessageId: msg.message_id, dedupeKey: `delivered:${msg.message_id}` });
    if (type === "message.bounced" || type === "message.rejected") {
      const added = await addEvent(ctx, kase, "BOUNCED", "The message bounced. It was not delivered. Check the recipient address.", { externalMessageId: msg.message_id, dedupeKey: `bounced:${msg.message_id}` });
      if (added && caseMachine.can(kase.status, "NEEDS_USER_ACTION")) await transition(ctx, kase, "NEEDS_USER_ACTION");
    }
    return null;
  },
});

// ---------- replies and verification ----------

const CLAIMS_FIX = new Set(["CREDIT_WILL_BE_RESTORED", "CREDIT_ALREADY_APPLIED", "ONE_TIME_ADJUSTMENT"]);

export const applyReplyAssertions = internalMutation({
  args: {
    caseId: v.id("cases"),
    agentmailMessageId: v.string(),
    assertions: v.array(
      v.object({ assertionType: v.string(), assertion: v.string(), excerpt: v.string(), bindingValidated: v.boolean(), confidence: v.union(v.literal("HIGH"), v.literal("MEDIUM"), v.literal("LOW")) }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const kase = await ctx.db.get(a.caseId);
    if (!kase) return null;
    const firstTime = await addEvent(ctx, kase, "REPLY_RECEIVED", "A reply arrived in the case thread.", { externalMessageId: a.agentmailMessageId, dedupeKey: `reply:${a.agentmailMessageId}` });
    if (!firstTime) return null;
    const item = (await ctx.db.get(kase.protectedItemId))!;
    const now = Date.now();
    const statements = await ctx.db.query("statements").withIndex("by_item_createdAt", (q) => q.eq("protectedItemId", item._id)).order("desc").take(1);
    const latestPlan = statements[0]?.planName ?? null;
    const requiredPlan = (await ctx.db.query("commitments").withIndex("by_item_kind", (q) => q.eq("protectedItemId", item._id).eq("kind", "REQUIRED_PLAN")).take(5)).find((c) => c.decisionEligibility === "AUTO_DETERMINISTIC")?.textValue ?? null;
    const rec = item.latestReconciliationId ? await ctx.db.get(item.latestReconciliationId) : null;
    let claimsFix = false;
    for (const x of a.assertions) {
      let assessment: Doc<"providerAssertions">["assessment"] = "NOT_ESTABLISHED";
      if (x.assertionType === "PLAN_CHANGED") {
        if (!latestPlan || !requiredPlan) assessment = "NEW_EVIDENCE_REQUIRED";
        else assessment = normalizeText(latestPlan) === normalizeText(requiredPlan) ? "CONTRADICTED_BY_CAPTURED_EVIDENCE" : "SUPPORTED_BY_CAPTURED_EVIDENCE";
      } else if (x.assertionType === "PROMOTION_EXPIRED") {
        assessment = rec && rec.periodCount !== null && (rec.latestObservedPeriod ?? 0) < rec.periodCount ? "CONTRADICTED_BY_CAPTURED_EVIDENCE" : "NOT_ESTABLISHED";
      } else if (x.assertionType === "REQUEST_MORE_INFORMATION") {
        assessment = "NEW_EVIDENCE_REQUIRED";
      }
      if (CLAIMS_FIX.has(x.assertionType) && x.bindingValidated) claimsFix = true;
      await ctx.db.insert("providerAssertions", {
        workspaceId: kase.workspaceId,
        caseId: kase._id,
        agentmailMessageId: a.agentmailMessageId,
        assertionType: x.assertionType,
        assertion: x.assertion.slice(0, 500),
        excerpt: x.excerpt.slice(0, 800),
        bindingValidated: x.bindingValidated,
        assessment,
        confidence: x.confidence,
        createdAt: now,
      });
    }
    if (caseMachine.can(kase.status, "REPLY_RECEIVED")) await transition(ctx, kase, "REPLY_RECEIVED");
    if (claimsFix && resolutionMachine.can(item.resolutionState, "PROVIDER_CLAIMS_FIXED")) {
      await ctx.db.patch(item._id, { resolutionState: "PROVIDER_CLAIMS_FIXED", updatedAt: now });
      await addEvent(ctx, kase, "PROVIDER_CLAIMS_FIXED", "The provider says the credit was fixed. That's their claim; Kept hasn't seen it on a bill yet.");
      await ctx.db.patch(item._id, { resolutionState: "WAITING_TO_VERIFY", updatedAt: now });
      await ctx.db.patch(kase._id, { resolutionState: "WAITING_TO_VERIFY", updatedAt: now });
      await ctx.db.insert("resolutionVerifications", {
        workspaceId: kase.workspaceId,
        protectedItemId: item._id,
        caseId: kase._id,
        claimedResolutionMessageId: a.agentmailMessageId,
        claimedResolutionAt: now,
        claimAfterPeriod: rec?.latestObservedPeriod ?? null,
        verificationStatementId: null,
        reconciliationId: null,
        result: "WAITING_TO_VERIFY",
        verifiedRestoredCents: 0,
        currency: rec?.currency ?? null,
        expectedPeriodKey: rec?.latestObservedPeriod !== null && rec?.latestObservedPeriod !== undefined ? `P${rec.latestObservedPeriod + 1}` : null,
        evidenceRefs: [a.agentmailMessageId],
        createdAt: now,
      });
      await addEvent(ctx, kase, "WAITING_TO_VERIFY", "Waiting for the next bill to confirm the credit is back.");
    }
    await ctx.db.insert("productEvents", { workspaceId: kase.workspaceId, name: "case_reply_received", createdAt: now });
    return null;
  },
});

/** Called inside reconciliation after a later statement is checked against a claimed fix. */
export async function applyVerificationInTx(ctx: MutationCtx, caseId: Id<"cases">, result: "VERIFIED_FIXED" | "STILL_MISMATCHED" | "INSUFFICIENT_EVIDENCE", reason: string): Promise<void> {
  const kase = await ctx.db.get(caseId);
  if (!kase) return;
  const item = (await ctx.db.get(kase.protectedItemId))!;
  const now = Date.now();
  if (result === "INSUFFICIENT_EVIDENCE") {
    await addEvent(ctx, kase, "VERIFICATION_INSUFFICIENT", `${reason} Still waiting to verify.`);
    return;
  }
  resolutionMachine.assert(item.resolutionState, result);
  await ctx.db.patch(item._id, { resolutionState: result, updatedAt: now });
  await ctx.db.patch(kase._id, { resolutionState: result, updatedAt: now });
  if (result === "VERIFIED_FIXED") {
    await addEvent(ctx, kase, "VERIFIED_FIXED", reason);
    if (caseMachine.can(kase.status, "RESOLVED")) await transition(ctx, kase, "RESOLVED");
    await addEvent(ctx, kase, "RESOLVED", "Resolved: a later bill shows the recorded credit.");
    if (itemMachine.can(item.status, "PROTECTED")) await ctx.db.patch(item._id, { status: "PROTECTED" });
    await ctx.db.insert("productEvents", { workspaceId: kase.workspaceId, name: "case_resolved", createdAt: now });
  } else {
    await addEvent(ctx, kase, "STILL_MISMATCHED", `${reason} The provider's claimed fix did not show up on the bill.`);
    if (caseMachine.can(kase.status, "NEEDS_USER_ACTION")) await transition(ctx, kase, "NEEDS_USER_ACTION");
  }
}

export const saveModelDraft = internalMutation({
  args: { caseId: v.id("cases"), subject: v.string(), body: v.string(), source: v.union(v.literal("MODEL"), v.literal("TEMPLATE")), note: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const kase = await ctx.db.get(a.caseId);
    if (!kase || kase.status !== "DRAFT") return null;
    await ctx.db.patch(kase._id, { subject: a.subject, draftText: a.body, draftSource: a.source, updatedAt: Date.now() });
    await addEvent(ctx, kase, "DRAFTED", a.note);
    return null;
  },
});

export const getPacketForDraft = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const kase = await ctx.db.get(caseId);
    if (!kase) return null;
    const packet = await ctx.db.query("caseEvidencePackets").withIndex("by_case_version", (q) => q.eq("caseId", caseId).eq("version", kase.latestPacketVersion)).unique();
    return packet ? { status: kase.status, payloadJson: packet.payloadJson } : null;
  },
});

export const close = mutation({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, { caseId }) => {
    const { kase } = await requireCase(ctx, caseId);
    if (kase.status === "SENDING") throw domainError("INVALID_STATE_TRANSITION", "Wait for the send to finish.");
    await transition(ctx, kase, "CLOSED");
    await addEvent(ctx, kase, "CLOSED", "You closed this case without a verified fix.");
    const item = (await ctx.db.get(kase.protectedItemId))!;
    if (item.status === "CASE_OPEN") await ctx.db.patch(item._id, { status: "MATERIAL_DIFFERENCE", updatedAt: Date.now() });
    return null;
  },
});

// ---------- read ----------

export const getMine = query({
  args: { caseId: v.id("cases") },
  handler: async (ctx, { caseId }) => {
    const { ws, kase } = await requireCase(ctx, caseId);
    return await caseView(ctx, kase, ws);
  },
});

export async function caseView(ctx: QueryCtx, kase: Doc<"cases">, ws: Doc<"workspaces">) {
  const item = await ctx.db.get(kase.protectedItemId);
  const packetRow = await ctx.db.query("caseEvidencePackets").withIndex("by_case_version", (q) => q.eq("caseId", kase._id).eq("version", kase.latestPacketVersion)).unique();
  const events = await ctx.db.query("caseEvents").withIndex("by_case_createdAt", (q) => q.eq("caseId", kase._id)).take(200);
  const assertions = await ctx.db.query("providerAssertions").withIndex("by_case", (q) => q.eq("caseId", kase._id)).take(50);
  const verifications = await ctx.db.query("resolutionVerifications").withIndex("by_case_createdAt", (q) => q.eq("caseId", kase._id)).take(50);
  const replies = kase.agentmailThreadId
    ? (await ctx.db.query("inboundAssignments").withIndex("by_threadId", (q) => q.eq("agentmailThreadId", kase.agentmailThreadId!)).take(50)).filter((r) => r.workspaceId === ws._id)
    : [];
  const replyDocs = await Promise.all(replies.map(async (r) => ({ id: r._id, receivedAt: r.receivedAt, fromDomain: r.fromDomain, subject: r.subject, text: r.documentId ? ((await ctx.db.get(r.documentId))?.originalText ?? "").slice(0, 4000) : "" })));
  return {
    case: {
      _id: kase._id,
      status: kase.status,
      recipientEmail: kase.recipientEmail,
      subject: kase.subject,
      draftText: kase.draftText,
      draftSource: kase.draftSource,
      resolutionState: kase.resolutionState,
      approvedAt: kase.approvedAt,
      hasThread: kase.agentmailThreadId !== null,
      createdAt: kase.createdAt,
      updatedAt: kase.updatedAt,
    },
    item: item ? { _id: item._id, providerName: item.providerName, productName: item.productName, status: item.status, resolutionState: item.resolutionState } : null,
    packet: packetRow ? (JSON.parse(packetRow.payloadJson) as EvidencePacket) : null,
    packetSha256: packetRow?.payloadSha256 ?? null,
    events: events.map((e) => ({ _id: e._id, type: e.type, summary: e.summary, createdAt: e.createdAt })),
    assertions: assertions.map((x) => ({ _id: x._id, assertionType: x.assertionType, assertion: x.assertion, excerpt: x.excerpt, bindingValidated: x.bindingValidated, assessment: x.assessment, createdAt: x.createdAt })),
    verifications: verifications.map((x) => ({ _id: x._id, result: x.result, verifiedRestoredCents: x.verifiedRestoredCents, currency: x.currency, expectedPeriodKey: x.expectedPeriodKey, createdAt: x.createdAt })),
    replies: replyDocs.sort((a, b) => a.receivedAt - b.receivedAt),
    inboxReady: ws.agentmailInboxId !== null,
  };
}


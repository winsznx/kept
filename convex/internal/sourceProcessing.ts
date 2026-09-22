"use node";

import { FirecrawlClient } from "@firecrawl/firecrawl-convex";
import { ConvexError, v } from "convex/values";
import { extractText, getDocumentProxy } from "unpdf";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { BillObservation, CommitmentExtraction, InboundClassification, SCHEMA_VERSION, SupportReplyExtraction } from "../lib/aiSchemas";
import { BILL_EXTRACTOR, billUserPrompt, COMMITMENT_EXTRACTOR, commitmentUserPrompt, INBOUND_CLASSIFIER, REPLY_EXTRACTOR } from "../lib/aiPrompts";
import { excerptIsInSource, type SourceClass } from "../lib/evidence";
import { canonicalizeSourceText, sha256Hex } from "../lib/hashing";
import { AiError, callStructured, type InputPart } from "../lib/openai";
import { buildCommitments, buildStatement, commitmentSummary, decideApplicability } from "../lib/pipeline";
import { domainMatches, validatePublicUrl } from "../lib/urlSafety";

const firecrawl = new FirecrawlClient(components.firecrawl);

/** Text above this size is kept in storage and only a bounded prefix is inlined. */
const INLINE_LIMIT = 100_000;
/** Text sent to the model is bounded to keep cost and latency predictable. */
const MODEL_TEXT_LIMIT = 60_000;

export type Intent = "AUTO" | "PROMISE" | "BILL" | "REPLY";

const inputValidator = v.union(
  v.object({ kind: v.literal("DOCUMENT"), documentId: v.id("documents") }),
  v.object({ kind: v.literal("URL"), url: v.string() }),
);

type Acquired = {
  text: string;
  textLayer: boolean;
  modelInput: InputPart[] | null;
  sourceUri: string | null;
  sourceDomain: string | null;
  firecrawlMetadataJson: string | null;
  documentId: Id<"documents"> | null;
  hintedClass: SourceClass | null;
  rawBytesSha: string | null;
};

class StepError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

async function acquire(ctx: ActionCtx, input: { kind: "DOCUMENT"; documentId: Id<"documents"> } | { kind: "URL"; url: string }, providerHint: string | null): Promise<Acquired> {
  if (input.kind === "URL") {
    const check = validatePublicUrl(input.url);
    if (!check.ok) throw new StepError("FIRECRAWL_INVALID_URL", `URL rejected: ${check.reason}`);
    const started = Date.now();
    try {
      const doc = await firecrawl.scrape(ctx, check.url, { formats: ["markdown"], onlyMainContent: true, maxAge: 0, storeInCache: false });
      const md = typeof doc.markdown === "string" ? doc.markdown : "";
      const meta = (doc.metadata ?? {}) as Record<string, unknown>;
      await ctx.runMutation(internal.telemetry.record, { workspaceId: null, provider: "FIRECRAWL", operation: "scrape", status: "OK", errorCode: null, latencyMs: Date.now() - started, attempt: 1, modelId: null, schemaVersion: null, externalRef: null });
      const status = typeof meta.statusCode === "number" ? meta.statusCode : null;
      if (status !== null && status >= 400) throw new StepError("FIRECRAWL_BLOCKED", `target returned ${status}`);
      if (md.trim().length < 40) throw new StepError("FIRECRAWL_EMPTY_CONTENT", "page had no readable content");
      const safeMeta = { title: typeof meta.title === "string" ? meta.title.slice(0, 200) : null, sourceURL: typeof meta.sourceURL === "string" ? meta.sourceURL.slice(0, 500) : null, statusCode: status, cacheState: meta.cacheState ?? null, creditsUsed: meta.creditsUsed ?? null };
      const firstParty = providerHint ? domainMatches(check.domain, providerDomainsFor(providerHint)) : false;
      return { text: md, textLayer: true, modelInput: null, sourceUri: check.url, sourceDomain: check.domain, firecrawlMetadataJson: JSON.stringify(safeMeta), documentId: null, hintedClass: firstParty ? "FIRST_PARTY_PUBLIC_PAGE" : null, rawBytesSha: null };
    } catch (err) {
      if (err instanceof StepError) throw err;
      const status = err instanceof ConvexError ? (err.data as { status?: number })?.status : undefined;
      await ctx.runMutation(internal.telemetry.record, { workspaceId: null, provider: "FIRECRAWL", operation: "scrape", status: "ERROR", errorCode: String(status ?? "unknown"), latencyMs: Date.now() - started, attempt: 1, modelId: null, schemaVersion: null, externalRef: null });
      if (status === 402) throw new StepError("FIRECRAWL_CREDIT_EXHAUSTED", "Firecrawl credits exhausted");
      if (status === 429) throw new StepError("FIRECRAWL_RATE_LIMIT", "rate limited", true);
      if (status === 408) throw new StepError("FIRECRAWL_TIMEOUT", "timeout", true);
      throw new StepError("FIRECRAWL_UNKNOWN", "capture failed", true);
    }
  }
  const doc = await ctx.runQuery(internal.internal.ingest.getDocument, { documentId: input.documentId });
  if (!doc) throw new StepError("NOT_FOUND", "document missing");
  if (doc.originalText !== null && doc.storageId === null) {
    return { text: doc.originalText, textLayer: true, modelInput: null, sourceUri: null, sourceDomain: null, firecrawlMetadataJson: null, documentId: doc._id, hintedClass: null, rawBytesSha: null };
  }
  if (!doc.storageId) throw new StepError("SOURCE_EMPTY", "no content");
  const blob = await ctx.storage.get(doc.storageId);
  if (!blob) throw new StepError("SOURCE_EMPTY", "file missing");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const rawBytesSha = await sha256Hex(bytes);
  const mime = doc.mimeType ?? "";
  if (mime === "application/pdf") {
    let text = "";
    try {
      const pdf = await getDocumentProxy(bytes);
      const res = await extractText(pdf, { mergePages: true });
      text = (Array.isArray(res.text) ? res.text.join("\n") : res.text) ?? "";
    } catch {
      throw new StepError("UNSUPPORTED_FILE", "PDF could not be read");
    }
    const b64 = Buffer.from(bytes).toString("base64");
    const hasText = text.trim().length > 40;
    return {
      text: hasText ? text : "",
      textLayer: hasText,
      modelInput: hasText ? null : [{ type: "input_file", filename: doc.filename ?? "document.pdf", file_data: `data:application/pdf;base64,${b64}` }],
      sourceUri: null,
      sourceDomain: null,
      firecrawlMetadataJson: null,
      documentId: doc._id,
      hintedClass: null,
      rawBytesSha,
    };
  }
  if (mime.startsWith("image/")) {
    const b64 = Buffer.from(bytes).toString("base64");
    return { text: "", textLayer: false, modelInput: [{ type: "input_image", image_url: `data:${mime};base64,${b64}`, detail: "high" }], sourceUri: null, sourceDomain: null, firecrawlMetadataJson: null, documentId: doc._id, hintedClass: null, rawBytesSha };
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const plain = mime === "text/html" ? htmlToText(text) : text;
  return { text: plain, textLayer: true, modelInput: null, sourceUri: null, sourceDomain: null, firecrawlMetadataJson: null, documentId: doc._id, hintedClass: null, rawBytesSha };
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ");
}

/** Candidate registrable domains for a provider name: "T-Mobile" -> t-mobile.com, tmobile.com. */
export function providerDomainsFor(provider: string): string[] {
  const base = provider.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim();
  const dashed = base.replace(/\s+/g, "-");
  const joined = base.replace(/[\s-]+/g, "");
  return [...new Set([`${dashed}.com`, `${joined}.com`])];
}

/** Redacts obvious identifiers irrelevant to extraction (PRD 20.7) without touching amounts/dates. */
function redactForModel(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone]")
    .replace(/\b(account|acct)(\s*(number|no\.?|#))?\s*[:#]?\s*\d{6,}\b/gi, "$1 [account]");
}

function sourceInput(acq: Acquired, text: string, prompt: string): string | InputPart[] {
  if (acq.modelInput) return [{ type: "input_text", text: prompt }, ...acq.modelInput];
  return prompt.replace("__SOURCE__", text);
}

export const run = internalAction({
  args: {
    jobId: v.id("jobs"),
    input: inputValidator,
    intent: v.union(v.literal("AUTO"), v.literal("PROMISE"), v.literal("BILL"), v.literal("REPLY")),
    caseId: v.union(v.id("cases"), v.null()),
    assignmentId: v.union(v.id("inboundAssignments"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const jobCtx = await ctx.runQuery(internal.internal.ingest.getJobContext, { jobId: args.jobId });
    if (!jobCtx?.item) return null;
    const { item, job } = jobCtx;
    const step = async (s: string, progress: number) => ctx.runMutation(internal.internal.ingest.setJob, { jobId: args.jobId, status: "RUNNING", step: s, progress });
    let captureId: Id<"sourceCaptures"> | null = null;
    try {
      await step("ACQUIRING_SOURCE", 0.1);
      const acq = await acquire(ctx, args.input, item.providerName);

      await step("STORING_SOURCE", 0.25);
      const canonical = canonicalizeSourceText(acq.text);
      const contentSha256 = acq.textLayer ? await sha256Hex(canonical) : (acq.rawBytesSha ?? (await sha256Hex(canonical)));
      let rawTextStorageId: Id<"_storage"> | null = null;
      if (canonical.length > INLINE_LIMIT) rawTextStorageId = await ctx.storage.store(new Blob([canonical], { type: "text/plain" }));

      const initialClass: SourceClass =
        args.intent === "BILL" ? "BILL_OR_STATEMENT" : args.intent === "REPLY" ? "FIRST_PARTY_SUPPORT_REPLY" : acq.sourceUri ? (acq.hintedClass ?? "SECONDARY_PUBLIC_PAGE") : "UNKNOWN_SOURCE";
      // The capture is stored before any model call so evidence survives AI outages (PRD 28.3).
      captureId = await ctx.runMutation(internal.internal.ingest.createCapture, {
        workspaceId: job.workspaceId,
        protectedItemId: item._id,
        sourceClass: initialClass,
        sourceUri: acq.sourceUri,
        sourceDomain: acq.sourceDomain,
        isFirstParty: acq.sourceUri ? initialClass === "FIRST_PARTY_PUBLIC_PAGE" : null,
        discovered: false,
        documentId: acq.documentId,
        normalizedText: acq.textLayer ? canonical.slice(0, INLINE_LIMIT) : null,
        rawTextStorageId,
        contentSha256,
        capturedAt: Date.now(),
        firecrawlMetadataJson: acq.firecrawlMetadataJson,
      });

      let intent: Intent = args.intent;
      const modelText = redactForModel(canonical.slice(0, MODEL_TEXT_LIMIT));
      if (intent === "AUTO") {
        await step("CLASSIFYING", 0.3);
        const cls = await callStructured({
          schema: InboundClassification,
          schemaName: "inbound_classification",
          system: INBOUND_CLASSIFIER,
          input: sourceInput(acq, modelText, "SOURCE CONTENT BEGINS\n__SOURCE__\nSOURCE CONTENT ENDS"),
          role: "EXTRACT",
        });
        await ctx.runMutation(internal.telemetry.record, { workspaceId: job.workspaceId, provider: "OPENAI", operation: "classify", status: "OK", errorCode: null, latencyMs: cls.latencyMs, attempt: 1, modelId: cls.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
        intent = cls.parsed.classification === "BILL_OR_STATEMENT" ? "BILL" : cls.parsed.classification === "SUPPORT_REPLY" ? "REPLY" : cls.parsed.classification === "SIGNUP_OR_ORDER" ? "PROMISE" : "AUTO";
        if (args.assignmentId) await ctx.runMutation(internal.internal.ingest.setAssignmentClassification, { assignmentId: args.assignmentId, classification: cls.parsed.classification });
        if (intent === "AUTO") {
          await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "NEEDS_REVIEW", failureCode: "AMBIGUOUS_SOURCE", modelId: cls.modelId, schemaVersion: SCHEMA_VERSION, unknowns: [] });
          await ctx.runMutation(internal.internal.ingest.setJob, { jobId: args.jobId, status: "NEEDS_REVIEW", step: "NOT_EVIDENCE", progress: 1, failureCode: "AMBIGUOUS_SOURCE", safeMessage: "Kept couldn't tell whether this is a signup record or a bill. It was saved but not used." });
          if (args.assignmentId) await ctx.runMutation(internal.internal.ingest.setAssignmentProcessed, { assignmentId: args.assignmentId, status: "PROCESSED" });
          return null;
        }
        if (intent === "BILL") await ctx.runMutation(internal.internal.ingest.classifyCapture, { sourceCaptureId: captureId, sourceClass: "BILL_OR_STATEMENT" });
        if (intent === "REPLY") await ctx.runMutation(internal.internal.ingest.classifyCapture, { sourceCaptureId: captureId, sourceClass: "FIRST_PARTY_SUPPORT_REPLY" });
      }

      if (intent === "PROMISE") {
        await step("EXTRACTING", 0.45);
        const ex = await callStructured({
          schema: CommitmentExtraction,
          schemaName: "commitment_extraction",
          system: COMMITMENT_EXTRACTOR,
          input: sourceInput(acq, modelText, commitmentUserPrompt("__SOURCE__", { providerName: item.providerName, url: acq.sourceUri })),
          role: "EXTRACT",
          effort: "medium",
        });
        await ctx.runMutation(internal.telemetry.record, { workspaceId: job.workspaceId, provider: "OPENAI", operation: "extract_commitments", status: "OK", errorCode: null, latencyMs: ex.latencyMs, attempt: 1, modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
        // First-party status of a web page is decided by domain in code; the model can
        // downgrade a page to secondary but never upgrade it.
        let sourceClass: SourceClass;
        if (acq.sourceUri) {
          let firstParty = initialClass === "FIRST_PARTY_PUBLIC_PAGE";
          if (!firstParty && item.providerName === null && ex.parsed.providerName) firstParty = domainMatches(acq.sourceDomain ?? "", providerDomainsFor(ex.parsed.providerName));
          sourceClass = firstParty && ex.parsed.sourceClassification === "FIRST_PARTY_PUBLIC_PAGE" ? "FIRST_PARTY_PUBLIC_PAGE" : "SECONDARY_PUBLIC_PAGE";
        } else {
          sourceClass = ["TRANSACTION_EMAIL", "TRANSACTION_RECEIPT", "CONTRACT_OR_ORDER"].includes(ex.parsed.sourceClassification) ? ex.parsed.sourceClassification : "UNKNOWN_SOURCE";
        }
        await ctx.runMutation(internal.internal.ingest.classifyCapture, { sourceCaptureId: captureId, sourceClass });

        await step("VALIDATING_EVIDENCE", 0.65);
        let built = buildCommitments(ex.parsed, acq.textLayer ? canonical : "", sourceClass);
        if (!acq.textLayer) {
          // No independent text layer to bind against: never AUTO, at most review.
          built = built.map((c) => ({ ...c, evidenceBinding: c.evidence.length > 0 ? "PARTIAL" : "FAILED", decisionEligibility: c.kind === "OTHER_TEXTUAL" ? "DISPLAY_ONLY" : c.evidence.length > 0 ? "REVIEW_REQUIRED" : "REJECTED" }));
        }

        let applicability: { outcome: "APPLIES" | "NOT_ESTABLISHED" | "DOES_NOT_APPLY"; reasons: string[]; transactionCaptureId: Id<"sourceCaptures"> | null } | null = null;
        if (acq.sourceUri && ex.parsed.policyScope.appliesToSeller !== "NOT_STATED") {
          const tx = await ctx.runQuery(internal.internal.ingest.transactionContextForItem, { protectedItemId: item._id });
          const policyBound = ex.parsed.policyScope.evidence.some((e) => excerptIsInSource(e.excerpt, canonical));
          const decision = policyBound ? decideApplicability(tx?.context ?? null, ex.parsed.policyScope) : { outcome: "NOT_ESTABLISHED" as const, reasons: ["The policy's seller scope couldn't be tied to the page text."] };
          applicability = { ...decision, transactionCaptureId: tx?.captureId ?? null };
        }

        await step("NORMALIZING", 0.75);
        const txDate = ex.parsed.transactionDateIso && /^\d{4}-\d{2}-\d{2}$/.test(ex.parsed.transactionDateIso) && ex.parsed.transactionDateText && excerptIsInSource(ex.parsed.transactionDateText, canonical) ? Date.parse(`${ex.parsed.transactionDateIso}T00:00:00Z`) : null;
        const txContextBound = !acq.sourceUri && ex.parsed.transactionContext.sellerType !== "UNKNOWN" && ex.parsed.transactionContext.evidence.some((e) => excerptIsInSource(e.excerpt, canonical));
        await ctx.runMutation(internal.internal.ingest.applyCommitments, {
          sourceCaptureId: captureId,
          sourceClass,
          providerName: ex.parsed.providerName,
          productName: ex.parsed.productOrPlanName,
          transactionAt: txDate,
          commitments: built,
          modelId: ex.modelId,
          schemaVersion: SCHEMA_VERSION,
          applicability,
          transactionContextJson: txContextBound ? JSON.stringify(ex.parsed.transactionContext) : null,
        });
        const auto = built.filter((c) => c.decisionEligibility === "AUTO_DETERMINISTIC").length;
        await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: auto > 0 || applicability !== null ? "PARSED" : "NEEDS_REVIEW", failureCode: auto > 0 ? null : built.length === 0 ? "NO_SUPPORTED_COMMITMENT" : "EVIDENCE_BINDING_FAILED", modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, unknowns: ex.parsed.unknowns.map((u) => u.slice(0, 300)) });
      } else if (intent === "BILL") {
        await step("EXTRACTING", 0.45);
        const keys = await ctx.runQuery(internal.internal.ingest.commitmentKeysForItem, { protectedItemId: item._id });
        const scheduleKey = keys.find((k) => k.kind === "PROMO_CREDIT_SCHEDULE" && k.decisionEligibility === "AUTO_DETERMINISTIC")?.key ?? null;
        const ex = await callStructured({
          schema: BillObservation,
          schemaName: "bill_observation",
          system: BILL_EXTRACTOR,
          input: sourceInput(acq, modelText, billUserPrompt("__SOURCE__", keys.map((k) => ({ key: k.key, label: k.label, summary: commitmentSummary(k) })))),
          role: "EXTRACT",
          effort: "medium",
        });
        await ctx.runMutation(internal.telemetry.record, { workspaceId: job.workspaceId, provider: "OPENAI", operation: "extract_bill", status: "OK", errorCode: null, latencyMs: ex.latencyMs, attempt: 1, modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
        if (!ex.parsed.isBillOrStatement) {
          await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "NEEDS_REVIEW", failureCode: "OBSERVATION_NOT_COMPARABLE", modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, unknowns: ex.parsed.unknowns });
        } else {
          await step("VALIDATING_EVIDENCE", 0.65);
          const st = buildStatement(ex.parsed, acq.textLayer ? canonical : "", scheduleKey);
          if (!acq.textLayer) st.lines = st.lines.map((l) => ({ ...l, matchesCommitment: l.matchesCommitment === "YES" ? "AMBIGUOUS" : l.matchesCommitment, evidenceBinding: "PARTIAL", decisionEligibility: "REVIEW_REQUIRED" }));
          // Statement month is only trusted when the stated month and year are in the source.
          const monthBound = st.statementMonth !== null && acq.textLayer && statementMonthBound(canonical, st.statementMonth, ex.parsed.statementDateIso);
          await ctx.runMutation(internal.internal.ingest.applyStatement, {
            sourceCaptureId: captureId,
            statementMonth: monthBound ? st.statementMonth : null,
            statementDateIso: st.statementDateIso,
            servicePeriodStartIso: st.servicePeriodStartIso,
            servicePeriodEndIso: st.servicePeriodEndIso,
            planName: st.planName && acq.textLayer && excerptIsInSource(st.planName, canonical) ? st.planName : null,
            providerName: st.providerName,
            itemized: st.itemized,
            totalAmountCents: st.totalAmountCents,
            lines: st.lines,
            modelId: ex.modelId,
          });
          await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "PARSED", failureCode: null, modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, unknowns: ex.parsed.unknowns.map((u) => u.slice(0, 300)) });
        }
      } else if (intent === "REPLY") {
        await step("EXTRACTING", 0.5);
        if (args.caseId) {
          const ex = await callStructured({ schema: SupportReplyExtraction, schemaName: "support_reply", system: REPLY_EXTRACTOR, input: `SOURCE CONTENT BEGINS\n${modelText}\nSOURCE CONTENT ENDS`, role: "EXTRACT" });
          await ctx.runMutation(internal.telemetry.record, { workspaceId: job.workspaceId, provider: "OPENAI", operation: "extract_reply", status: "OK", errorCode: null, latencyMs: ex.latencyMs, attempt: 1, modelId: ex.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
          const doc = acq.documentId ? await ctx.runQuery(internal.internal.ingest.getDocument, { documentId: acq.documentId }) : null;
          await ctx.runMutation(internal.cases.applyReplyAssertions, {
            caseId: args.caseId,
            agentmailMessageId: doc?.agentmailMessageId ?? `capture:${captureId}`,
            assertions: ex.parsed.assertions.map((x) => ({
              assertionType: x.assertionType,
              assertion: x.assertion,
              excerpt: x.evidence[0]?.excerpt ?? "",
              bindingValidated: x.evidence.some((e) => excerptIsInSource(e.excerpt, canonical)),
              confidence: x.confidence.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
            })),
          });
        }
        await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "PARSED", failureCode: null, modelId: null, schemaVersion: SCHEMA_VERSION, unknowns: [] });
      }

      await step("RECONCILING", 0.9);
      await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: item._id, trigger: acq.sourceUri && captureId ? "SOURCE_REFRESH" : "SOURCE_INGESTED" });
      await ctx.runMutation(internal.internal.ingest.setJob, { jobId: args.jobId, status: "SUCCEEDED", step: "SUCCEEDED", progress: 1, failureCode: null, safeMessage: null });
      if (args.assignmentId) await ctx.runMutation(internal.internal.ingest.setAssignmentProcessed, { assignmentId: args.assignmentId, status: "PROCESSED" });
    } catch (err) {
      const code = err instanceof StepError ? err.code : err instanceof AiError ? err.code : "UNKNOWN_EXTERNAL_FAILURE";
      if (err instanceof AiError) {
        await ctx.runMutation(internal.telemetry.record, { workspaceId: job.workspaceId, provider: "OPENAI", operation: "structured_call", status: "ERROR", errorCode: code, latencyMs: 0, attempt: 1, modelId: null, schemaVersion: SCHEMA_VERSION, externalRef: null });
      }
      if (captureId) await ctx.runMutation(internal.internal.ingest.recordParse, { sourceCaptureId: captureId, status: "FAILED", failureCode: code, modelId: null, schemaVersion: SCHEMA_VERSION, unknowns: [] });
      await ctx.runMutation(internal.internal.ingest.setJob, { jobId: args.jobId, status: "FAILED", step: "FAILED", failureCode: code, safeMessage: safeMessageFor(code) });
      if (args.assignmentId) await ctx.runMutation(internal.internal.ingest.setAssignmentProcessed, { assignmentId: args.assignmentId, status: "FAILED" });
      await ctx.runMutation(internal.internal.ingest.reconcileItem, { protectedItemId: item._id, trigger: "SOURCE_INGESTED" });
    }
    return null;
  },
});

function statementMonthBound(source: string, month: string, statementDateIso: string | null): boolean {
  const [y, m] = month.split("-").map(Number);
  const names = [
    new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
    new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  ];
  const s = source.toLowerCase();
  const yearPresent = s.includes(String(y));
  const monthPresent = names.some((n) => s.includes(n.toLowerCase())) || s.includes(month) || s.includes(`${String(m).padStart(2, "0")}/`) || (statementDateIso !== null && s.includes(statementDateIso));
  return yearPresent && monthPresent;
}

function safeMessageFor(code: string): string {
  switch (code) {
    case "FIRECRAWL_INVALID_URL":
      return "That URL can't be captured. Use a public http(s) page.";
    case "FIRECRAWL_BLOCKED":
    case "FIRECRAWL_EMPTY_CONTENT":
      return "The public page couldn't be captured. Your other evidence is safe. You can retry or upload the page instead.";
    case "FIRECRAWL_CREDIT_EXHAUSTED":
    case "FIRECRAWL_RATE_LIMIT":
    case "FIRECRAWL_TIMEOUT":
    case "FIRECRAWL_UNKNOWN":
      return "Public page capture is unavailable right now. Your other evidence is safe. Try again later.";
    case "AI_UNAVAILABLE":
    case "OPENAI_FAILED":
    case "OPENAI_RATE_LIMIT":
      return "The source was saved, but reading it failed. You can retry.";
    case "AI_SCHEMA_FAILED":
    case "AI_REFUSED":
      return "The source was saved, but Kept couldn't read it reliably. It needs review.";
    case "UNSUPPORTED_FILE":
      return "This file couldn't be read. Try a PDF with selectable text, an image, or plain text.";
    default:
      return "Processing failed. The source that was received is still stored.";
  }
}

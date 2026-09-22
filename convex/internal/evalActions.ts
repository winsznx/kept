"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { BillObservation, CommitmentExtraction, SupportReplyExtraction } from "../lib/aiSchemas";
import { BILL_EXTRACTOR, billUserPrompt, COMMITMENT_EXTRACTOR, commitmentUserPrompt, REPLY_EXTRACTOR } from "../lib/aiPrompts";
import { canonicalizeSourceText } from "../lib/hashing";
import { callStructured } from "../lib/openai";
import { buildCommitments, buildStatement } from "../lib/pipeline";
import { sourceClass } from "../schema";

/**
 * Evaluation entry points: the same model calls and code-side validation the product
 * pipeline uses, without persisting anything. Returns the raw extraction and the
 * validated build so campaigns can score both.
 */
export const extractPromise = internalAction({
  args: { text: v.string(), sourceClass: sourceClass, providerHint: v.union(v.string(), v.null()), url: v.union(v.string(), v.null()) },
  handler: async (_ctx, a) => {
    const text = canonicalizeSourceText(a.text);
    const res = await callStructured({ schema: CommitmentExtraction, schemaName: "commitment_extraction", system: COMMITMENT_EXTRACTOR, input: commitmentUserPrompt(text, { providerName: a.providerHint, url: a.url }), role: "EXTRACT", effort: "medium" });
    return { modelId: res.modelId, latencyMs: res.latencyMs, usage: res.usage, raw: res.parsed, built: buildCommitments(res.parsed, text, a.sourceClass) };
  },
});

export const extractBill = internalAction({
  args: { text: v.string(), scheduleKey: v.union(v.string(), v.null()), commitments: v.array(v.object({ key: v.string(), label: v.string(), summary: v.string() })) },
  handler: async (_ctx, a) => {
    const text = canonicalizeSourceText(a.text);
    const res = await callStructured({ schema: BillObservation, schemaName: "bill_observation", system: BILL_EXTRACTOR, input: billUserPrompt(text, a.commitments), role: "EXTRACT", effort: "medium" });
    return { modelId: res.modelId, latencyMs: res.latencyMs, usage: res.usage, raw: res.parsed, built: buildStatement(res.parsed, text, a.scheduleKey) };
  },
});

export const extractReply = internalAction({
  args: { text: v.string() },
  handler: async (_ctx, a) => {
    const res = await callStructured({ schema: SupportReplyExtraction, schemaName: "support_reply", system: REPLY_EXTRACTOR, input: `SOURCE CONTENT BEGINS\n${a.text}\nSOURCE CONTENT ENDS`, role: "EXTRACT" });
    return { modelId: res.modelId, latencyMs: res.latencyMs, raw: res.parsed };
  },
});

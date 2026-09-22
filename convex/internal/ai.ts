"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { CaseDraft, SCHEMA_VERSION } from "../lib/aiSchemas";
import { CASE_DRAFTER } from "../lib/aiPrompts";
import { templateDraft, validateDraft, type EvidencePacket } from "../lib/casePacket";
import { AiError, callStructured } from "../lib/openai";

/**
 * Drafts the support email from the frozen packet only. The draft is validated in
 * code; after one failed regeneration the deterministic template stays in place.
 */
export const draftCase = internalAction({
  args: { caseId: v.id("cases") },
  returns: v.null(),
  handler: async (ctx, { caseId }) => {
    const row = await ctx.runQuery(internal.cases.getPacketForDraft, { caseId });
    if (!row || row.status !== "DRAFT") return null;
    const packet = JSON.parse(row.payloadJson) as EvidencePacket;
    const packetForModel = {
      provider: packet.provider,
      issueSummary: packet.issueSummary,
      facts: packet.facts,
      unknowns: packet.unknowns,
      requestedAction: packet.requestedAction,
    };
    let lastProblems: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await callStructured({
          schema: CaseDraft,
          schemaName: "case_draft",
          system: CASE_DRAFTER,
          input: `EVIDENCE PACKET (JSON):\n${JSON.stringify(packetForModel)}${lastProblems.length ? `\n\nYour previous draft was rejected for: ${lastProblems.join("; ")}. Use only packet facts.` : ""}`,
          role: "REASON",
        });
        await ctx.runMutation(internal.telemetry.record, { workspaceId: null, provider: "OPENAI", operation: "draft_case", status: "OK", errorCode: null, latencyMs: res.latencyMs, attempt, modelId: res.modelId, schemaVersion: SCHEMA_VERSION, externalRef: null });
        const check = validateDraft(`${res.parsed.subject}\n${res.parsed.plainTextBody}`, packet);
        if (check.ok && res.parsed.plainTextBody.length <= 3000 && res.parsed.subject.length <= 160) {
          await ctx.runMutation(internal.cases.saveModelDraft, { caseId, subject: res.parsed.subject, body: res.parsed.plainTextBody, source: "MODEL", note: "Drafted from the evidence packet. Every amount, number, and date was checked against the packet." });
          return null;
        }
        lastProblems = check.problems.slice(0, 5);
      } catch (err) {
        const code = err instanceof AiError ? err.code : "OPENAI_FAILED";
        await ctx.runMutation(internal.telemetry.record, { workspaceId: null, provider: "OPENAI", operation: "draft_case", status: "ERROR", errorCode: code, latencyMs: 0, attempt, modelId: null, schemaVersion: SCHEMA_VERSION, externalRef: null });
        break;
      }
    }
    const t = templateDraft(packet);
    await ctx.runMutation(internal.cases.saveModelDraft, { caseId, subject: t.subject, body: t.body, source: "TEMPLATE", note: "Using the fact-only template draft." });
    return null;
  },
});

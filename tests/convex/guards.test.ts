import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { makeT, signedInUser } from "./setup";

describe("storage and inbox guards", () => {
  it("a storage id already attached by user A cannot be claimed by user B", async () => {
    // #given
    const t = makeT();
    const a = await signedInUser(t, "a@example.test");
    const b = await signedInUser(t, "b@example.test");
    await a.as.mutation(api.workspaces.ensureMine, {});
    await b.as.mutation(api.workspaces.ensureMine, {});
    const itemA = await a.as.mutation(api.protectedItems.create, {});
    const itemB = await b.as.mutation(api.protectedItems.create, {});
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["synthetic bill"], { type: "text/plain" })));
    await t.run(async (ctx) => {
      const itemDoc = (await ctx.db.get(itemA))!;
      await ctx.db.insert("documents", { workspaceId: itemDoc.workspaceId, protectedItemId: itemA, sourceCaptureId: null, sourceClass: "UNKNOWN_SOURCE", storageId, agentmailMessageId: null, agentmailThreadId: null, filename: "bill.txt", mimeType: "text/plain", byteSize: 14, sha256: null, originalText: null, status: "RECEIVED", createdAt: 1 });
    });
    // #when / #then
    await expect(b.as.mutation(api.sources.addUpload, { itemId: itemB, storageId, filename: "stolen.txt", intent: "BILL" })).rejects.toThrow(/already added/);
  });

  it("an already-handled inbound message cannot be re-assigned to trigger reprocessing", async () => {
    // #given
    const t = makeT();
    const a = await signedInUser(t, "a@example.test");
    const wsId = await a.as.mutation(api.workspaces.ensureMine, {});
    const itemId = await a.as.mutation(api.protectedItems.create, {});
    const assignmentId = await t.run((ctx) =>
      ctx.db.insert("inboundAssignments", { workspaceId: wsId, agentmailMessageId: "m1", agentmailThreadId: "t1", fromDomain: null, subject: null, preview: null, receivedAt: 1, classification: "UNKNOWN", protectedItemId: null, caseId: null, documentId: null, assignmentStatus: "NEEDS_ASSIGNMENT", assignmentReason: null, processingStatus: "PROCESSED", createdAt: 1, updatedAt: 1 }),
    );
    await a.as.mutation(api.inbound.assignMessage, { assignmentId, itemId });
    // #when / #then
    await expect(a.as.mutation(api.inbound.assignMessage, { assignmentId, itemId })).rejects.toThrow(/already handled/);
  });

  it("user B cannot read user A's case or send it", async () => {
    // #given
    const t = makeT();
    const a = await signedInUser(t, "a@example.test");
    const b = await signedInUser(t, "b@example.test");
    const wsA = await a.as.mutation(api.workspaces.ensureMine, {});
    await b.as.mutation(api.workspaces.ensureMine, {});
    const itemA = await a.as.mutation(api.protectedItems.create, {});
    const caseId = await t.run((ctx) =>
      ctx.db.insert("cases", { workspaceId: wsA, protectedItemId: itemA, status: "READY_TO_SEND", issueType: "X", recipientEmail: "support@carrier.example", subject: "s", draftText: "d", draftSource: "TEMPLATE", agentmailThreadId: null, agentmailOutboundId: null, sendIdempotencyKey: null, approvedAt: null, latestPacketVersion: 1, disputedPeriods: [22], resolutionState: "NONE", resolutionSummary: null, createdAt: 1, updatedAt: 1 }),
    );
    // #when / #then
    await expect(b.as.query(api.cases.getMine, { caseId })).rejects.toThrow(/not found/i);
    await expect(b.as.mutation(api.cases.approveAndSend, { caseId })).rejects.toThrow(/not found/i);
  });
});

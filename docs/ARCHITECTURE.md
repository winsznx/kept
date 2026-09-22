# Architecture

```
Browser (React + Vite, static hosting on convex.site)
  |  reactive queries / mutations           |  public: /, /demo, /proof, /proof/run/:id
  v                                          v  private: /app/*  (Convex Auth, password)
Convex deployment
  ├─ public functions      protectedItems, items, sources, cases, inbound, workspaces, demo, proof
  ├─ internal orchestration  sourceProcessing, ingest, inboundProcessing, caseSend, ai, demoSeed
  ├─ pure decision libs      convex/lib: money, schedule, reconcile, evidence, factCompare,
  │                          pipeline, casePacket, stateMachines, urlSafety, cascade
  ├─ http routes             Convex Auth  ·  POST /agentmail/webhook (Svix verified)  ·  static catch-all
  ├─ scheduler + cron        pipeline steps, send retries, hourly demo expiry
  └─ components              @convex-dev/static-hosting · @firecrawl/firecrawl-convex · @agentmail/convex
        |                         |                         |
        v                         v                         v
   static site            Firecrawl scrape            AgentMail inbox,
   on convex.site         (T0 / Tn captures)          send (idempotent), webhooks
                                  \                    /
                                   \                  /
                                    OpenAI Responses API
                              (strict Structured Outputs, "use node" actions)
```

## The path a promise takes

1. **Intake.** A forwarded email (AgentMail webhook), an upload, pasted text, or a URL (Firecrawl). `sources.ts` creates a `jobs` row and schedules `internal/sourceProcessing.run`.
2. **Capture before anything else.** The action stores an immutable `sourceCaptures` row with canonicalized text, a SHA-256 content hash, and provenance. A refresh of the same URL creates a new row linked to the previous one. An AI or network failure after this point never destroys evidence.
3. **Extraction.** OpenAI returns a strict schema: commitments, bill line items, or reply claims. Nothing from the model is trusted yet.
4. **Binding, in code.** `lib/evidence.ts` requires a literal excerpt from that source containing the decisive value. `VALID` allows a deterministic decision, `PARTIAL` means review, `FAILED` is rejected. Model confidence can only lower eligibility.
5. **Expectations.** A recurring credit becomes `expectedEvents`, one per period. The schedule anchor comes from explicit "k of 24" labels on bills; inconsistent labels abstain instead of guessing.
6. **Reconciliation.** `lib/reconcile.ts` compares integer cents per period: `MATCH`, `MATERIAL_DIFFERENCE`, `REVIEW_REQUIRED`, `NOT_OBSERVED`, `NOT_DUE`. Future periods are never counted missing.
7. **Case.** A material finding freezes a hashed evidence packet. The draft is model-written but code-checked against packet facts, with a deterministic template fallback. `READY_TO_SEND -> SENDING` only happens in the user-approval mutation, and the send carries an idempotency key derived from case plus content.
8. **Reply.** The signed webhook stores the message, links it to the case thread, and extracts claims as claims. A claim moves the case to `PROVIDER_CLAIMS_FIXED` then `WAITING_TO_VERIFY`.
9. **Verification.** Only a later qualifying statement, reconciled by the same deterministic code, can produce `VERIFIED_FIXED` or `STILL_MISMATCHED`. Restored value counts only observed corrected periods.

## Authority split

| Decided by AI | Decided by code |
|---|---|
| source classification, candidate commitments, bill line items, reply claims, draft wording | money equality and deltas, schedules and period mapping, date arithmetic, excerpt binding, line identity, state-transition legality, authorization, duplicate-send prevention, applicability |

## Data model (main tables)

`workspaces` (USER or DEMO ownership boundary) · `protectedItems` · `documents` · `sourceCaptures` (immutable) · `captureParses` · `commitments` + `commitmentEvidence` + `commitmentConditions` · `expectedEvents` · `statements` + `observations` · `reconciliations` + `reconciliationFindings` · `pageComparisons` · `applicabilityChecks` · `cases` + `caseEvidencePackets` + `caseEvents` + `providerAssertions` + `resolutionVerifications` · `inboundAssignments` · `jobs` · `auditEvents` · `externalCalls` · `proofRuns` · `demoSessions` · `evaluationRuns` + `evaluationResults`.

Every read path has an index. Details in `convex/schema.ts`; decisions and deviations in `docs/DECISIONS.md`.

## Demo isolation

Each visitor gets an expiring DEMO workspace keyed by a hashed random session key. It runs the same mutations as real data but parses synthetic fixtures with a deterministic parser, never crawls, and never sends email. An hourly cron deletes expired sessions.

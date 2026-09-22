# Threat model

Scope: the hackathon release on Convex (`convex/`), the React client (`src/`), and the three sponsor integrations. Each row names the control and where it lives.

| Threat | Control | Where |
|---|---|---|
| Cross-user data access | Every public query and mutation resolves the caller with `getAuthUserId` and checks workspace ownership; browser-supplied user or workspace ids are never trusted. Cross-user tests cover items, cases, uploads and inbox assignment. | `convex/lib/authz.ts`, `tests/convex/authz.test.ts`, `tests/convex/guards.test.ts` |
| Leaked storage id reused by another user | A storage id can back only one document globally (indexed), checked before any rejection path deletes a file. Storage URLs are never returned to clients. | `convex/sources.ts`, `convex/schema.ts` (`documents.by_storageId`) |
| Webhook spoofing | AgentMail webhooks are verified by the official component (Svix signatures, per-deployment secret) and deduped on `event_id`. Inbound mail is mapped to a workspace only through the server-owned inbox id, never message content. | `convex/http.ts`, `convex/inbound.ts` |
| Duplicate webhook delivery | Component dedupe on `event_id`, plus a per-message unique assignment row, plus dedupe keys on case events (`reply:<messageId>`, `sent:<messageId>`). | `convex/inbound.ts`, `convex/cases.ts` |
| Prompt injection in emails, pages, bills | Every prompt declares source content untrusted data. Outputs are strict schemas, and no decisive value is used unless code finds a literal excerpt containing it in the source. Campaign C includes an injection fixture. | `convex/lib/aiPrompts.ts`, `convex/lib/evidence.ts`, `evidence/campaign-report.md` |
| Hallucinated commitments | Literal-substring evidence binding decides eligibility in code; failed binding is `REJECTED`, partial is `REVIEW_REQUIRED`; model confidence can only lower eligibility. | `convex/lib/pipeline.ts`, `convex/lib/evidence.ts` |
| Source applicability mistakes | Policy scope and transaction seller/region are extracted with evidence; a deterministic rule returns `NOT_ESTABLISHED` whenever any dimension is unknown or mismatched. | `convex/lib/pipeline.ts` (`decideApplicability`) |
| Duplicate outbound email | Only `approveAndSend` moves a case to `SENDING`; repeat clicks return the existing state; each approved message has an idempotency key derived from case and exact content, reused on retries so AgentMail returns the original message. | `convex/cases.ts`, `convex/internal/caseSend.ts` |
| Mail sent to someone the user didn't approve | Follow-ups reply in-thread only when the last inbound came from the approved recipient's domain and nothing bounced; otherwise a fresh message goes to exactly the approved address. | `convex/cases.ts` (`getSendContext`) |
| Autonomous email loops | No code path sends mail without the user-approval mutation. Inbound replies only update case state. | `convex/lib/stateMachines.ts`, `convex/cases.ts` |
| Malicious uploads | MIME allowlist, 10 MB cap, files are never executed; PDFs are text-extracted with `unpdf` in a Node action. | `convex/sources.ts`, `convex/internal/sourceProcessing.ts` |
| SSRF / URL abuse | http(s) only, no credentials, no localhost/private/link-local/metadata hosts, no IP literals, standard ports only, bounded length, checked before Firecrawl. | `convex/lib/urlSafety.ts` |
| Private document URL leakage | Raw files stay in Convex storage; rows hold ids; the client gets bounded text only through an owner-checked query. | `convex/items.ts` (`captureText`) |
| Demo endpoint abuse | Demo sessions are isolated expiring DEMO workspaces keyed by a hashed random key, throttled to 20 new sessions per minute and 300 active; demo code never crawls or sends mail; hourly cleanup. | `convex/demo.ts`, `convex/crons.ts` |
| Credit-burning abuse | Source jobs limited to 40 per workspace per hour; handled inbound messages can't be re-assigned to trigger reprocessing. | `convex/sources.ts`, `convex/inbound.ts` |
| External API outage | Captures are stored before any model call; failures leave evidence intact and show a safe message; the case draft falls back to a deterministic template; a failed send never claims delivery. | `convex/internal/sourceProcessing.ts`, `convex/internal/ai.ts`, `convex/internal/caseSend.ts` |
| Forged bill via a known routing token | Accepted risk for the prototype: mail that carries an item's `KEPT-` token is auto-assigned. Mitigation planned: route token matches from unknown senders to "Needs assignment". | `convex/inbound.ts` |
| Secrets in the repo | Keys live only in Convex env; `.env*` is git-ignored; `verify:evidence` scans public artifacts for secret- and address-shaped strings. | `.gitignore`, `scripts/verify-evidence.ts` |

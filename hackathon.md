# Kept

Kept records the deal you were promised at signup, checks every later bill against it, opens a source-backed case when a credit goes missing, and won't call it fixed until a later bill proves it.

- **Live app:** https://gregarious-snail-975.convex.site
- **Public demo:** https://gregarious-snail-975.convex.site/demo
- **Inspectable production run:** https://gregarious-snail-975.convex.site/proof/run/live-loop-2026-09-22
- **Video:** coming with the submission
- **Public repo:** https://github.com/winsznx/kept

**Measured headline proof** (`evidence/campaign-report.json`, synthetic corpus, 52 live model calls):
- Evidence fidelity: 68 / 68 deterministic decisions carry a literal source excerpt containing the value.
- Drift discrimination: 8 / 8 material page changes detected; 8 / 8 benign rewrites ignored (first scoring 6 / 8, fixed in code and disclosed).
- Resolution integrity: 0 of 5 provider claims marked verified without a later bill; the live production case went claimed, then waiting, then verified only after bill 23 reconciled.

**One complete user loop:** Record, Watch, Detect, Resolve, Verify, run live on production (`evidence/live-roundtrip.md`).

**Sponsor roles**
- Convex: canonical state, auth, immutable captures, storage, scheduled pipeline, signed webhook route, reactive UI, static hosting, three components.
- Firecrawl: T0 and Tn captures of public offer and terms pages.
- OpenAI: strict Structured Outputs extraction of commitments, bill lines and reply claims, plus case drafting (`gpt-5.6-terra`, `gpt-5.6-sol`).
- AgentMail: per-user inbox, user-approved case sends, replies in the same thread through signed webhooks.

**Control and refusal:** a fully rewritten offer page with the same terms gives "no material change"; a marketplace purchase checked against a retailer-direct policy gives "can't establish"; 10 / 10 ambiguity fixtures abstain correctly.

**Independent verification:** `npm run verify:evidence` passes 11 / 11 invariants (`evidence/verification.md`).

---

# Hackathon log

- **Project:** Kept
- **Event:** Convex All Gas Hackathon
- **What it does:** Records the promotion a consumer was promised at signup, turns it into an expected schedule, checks later bills against it, and only marks a dispute fixed when a later bill proves it.
- **Live app:** https://gregarious-snail-975.convex.site
- **Repo:** https://github.com/winsznx/kept
- **Frontend:** Convex static hosting
- **Convex deployment:** https://gregarious-snail-975.convex.cloud
- **Components:** @convex-dev/static-hosting, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, scheduled functions, crons, file storage, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-terra (classification and extraction), gpt-5.6-sol (case drafting), via the OpenAI Responses API with strict Structured Outputs (`convex/lib/openai.ts`)
- **Started:** 2026-09-21T22:54:35Z
- **Last updated:** 2026-09-22T16:10:00Z

## Log

### 2026-09-21 - 79bc7fa
Started Kept on a React + Vite + TypeScript frontend with a Convex cloud dev deployment. Password sign-up, sign-in, and sign-out work through Convex Auth, confirmed with a headless browser run against the dev backend. Static hosting is registered in app-owned root mode so the auth `/.well-known` routes stay at the site root (`convex/convex.config.ts`, `convex/http.ts`, `convex/auth.ts`). The full domain schema is in place with indexes for every read path, plus server-side workspace authorization helpers (`convex/schema.ts`, `convex/lib/authz.ts`). First queries and mutations create a workspace on first visit and list protected items reactively, and workspace creation schedules AgentMail inbox provisioning (`convex/workspaces.ts`, `convex/protectedItems.ts`, `convex/internal/agentmail.ts`). The deterministic core that decides outcomes ships with 30 unit tests. It covers integer-cent money, the 24-month credit schedule, month-22 missing-credit detection that never counts future months as missing, provider-claimed vs verified fix, literal evidence-excerpt binding, material vs benign page change, state machines, and SSRF URL checks (`convex/lib/`, `tests/unit/`). Convex features: schema, indexes, queries, mutations, internal actions, HTTP actions, scheduled functions, realtime queries.

### 2026-09-22 - 79655cf
Built the evidence pipeline. Public offer pages are captured through the Firecrawl component and stored as immutable snapshots with content hashes; a refresh links to the earlier capture instead of overwriting it. Proven live on the dev deployment with two captures of a public carrier deals page, classified first-party by domain in code. Captures are saved before any model call, so an OpenAI outage left the evidence intact (`convex/internal/sourceProcessing.ts`, `convex/internal/ingest.ts`). OpenAI extraction uses strict Structured Outputs, and code decides evidence binding and eligibility (`convex/lib/aiSchemas.ts`, `convex/lib/pipeline.ts`). Cases freeze a hashed evidence packet and send only through an approval mutation with an AgentMail idempotency key; inbound mail arrives through the component's signed webhook and is routed by server-owned inbox, thread and token mappings (`convex/cases.ts`, `convex/inbound.ts`, `convex/http.ts`). Cross-user isolation tests pass. Live OpenAI extraction and the AgentMail round trip are not yet run: the OpenAI account has no credits and the AgentMail key lacks inbox and webhook permissions.

### 2026-09-22 - dad5a57
Shipped the public demo on the real pipeline. Each visitor gets an isolated, expiring demo workspace that runs through the same capture, binding, reconciliation, case and verification mutations as user data, using a deterministic parser over synthetic fixtures. It walks bills 1-21 matching, bill 22 missing the credit, a case with a replay-labelled send and reply, the provider's claim held as waiting to verify, and bill 23 verifying the fix. The same demo shows a reworded offer page producing no material change and a marketplace purchase where the retailer policy is not established (`convex/demo.ts`, `convex/internal/demoSeed.ts`, `convex/fixtures/`). An hourly cron removes expired demo workspaces (`convex/crons.ts`).

### 2026-09-22 - working tree
Deployed to production on Convex static hosting. The demo, Then vs Now, case, inbox, protect, item and proof screens are built. Browser smoke runs against the production URL pass: the full demo loop at phone width with no horizontal scroll, control and refusal tabs, demo state kept on deep reload, and sign-up, item creation, deep-route reload and sign-out (`scripts/smoke-demo.mjs`, `scripts/smoke-auth.mjs`, `src/routes/`).

### 2026-09-22 - working tree
Ran the full loop live on production and recorded it as an inspectable run at `/proof/run/live-loop-2026-09-22` (`evidence/live-roundtrip.md`). A synthetic signup email forwarded into a real per-user AgentMail inbox arrived through the signed webhook; OpenAI extracted the $18.75 x 24 credit, duration and required plan, and code bound each to the source text. Bills pasted in the app reconciled deterministically to a material difference on credit 22. A model-drafted case passed Kept's fact check, was approved in the UI and sent through AgentMail; the reply from a separate builder-controlled inbox landed in the same case thread, its claims were stored as claims, and the case waited to verify. Bill 23 first produced a source conflict, because the model labelled the back-credit as a recurring credit, so Kept abstained; a deterministic line-identity rule fixed it and the case page switched to verified fixed with no reload (`convex/lib/pipeline.ts`). Fixed two live-found bugs: forwarded mail bodies were taken from AgentMail's quote-stripped text and came through empty, and assigned mail was classified twice (`convex/inbound.ts`, `convex/internal/inboundProcessing.ts`). Signed webhooks are registered for dev and prod.

### 2026-09-22 - ae7cc57
Ran the evaluation campaigns and published the results (`evidence/campaign-report.md`). Extraction, page-change and ambiguity campaigns ran live on a small synthetic corpus with cached outputs; the month-22 and claimed-fix campaigns run deterministically. The first scoring flagged two benign page rewrites as material and missed one ambiguous credit; the causes were fixed in deterministic code with tests and both scorings are published. An independent verifier re-derives the invariants from the corpus, the cached outputs and the decision code and passes (`scripts/verify-evidence.ts`, `evidence/verification.md`). Also recorded a live Firecrawl T0/Tn capture of a public carrier deals page on production, where the model's offers were bound to the page text and ambiguous ones held for review (`/proof`). Added the threat model and rewrote the README around the evidence.


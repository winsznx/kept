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
- **AI models:** gpt-5.6-terra (extraction), gpt-5.6-sol (case drafting), configured in `convex/lib/openai.ts`; live calls not yet run
- **Started:** 2026-09-21T22:54:35Z
- **Last updated:** 2026-09-22T09:20:00Z

## Log

### 2026-09-21 - 79bc7fa
Started Kept on a React + Vite + TypeScript frontend with a Convex cloud dev deployment. Password sign-up, sign-in, and sign-out work through Convex Auth, confirmed with a headless browser run against the dev backend. Static hosting is registered in app-owned root mode so the auth `/.well-known` routes stay at the site root (`convex/convex.config.ts`, `convex/http.ts`, `convex/auth.ts`). The full domain schema is in place with indexes for every read path, plus server-side workspace authorization helpers (`convex/schema.ts`, `convex/lib/authz.ts`). First queries and mutations create a workspace on first visit and list protected items reactively, and workspace creation schedules AgentMail inbox provisioning (`convex/workspaces.ts`, `convex/protectedItems.ts`, `convex/internal/agentmail.ts`). The deterministic core that decides outcomes ships with 30 unit tests. It covers integer-cent money, the 24-month credit schedule, month-22 missing-credit detection that never counts future months as missing, provider-claimed vs verified fix, literal evidence-excerpt binding, material vs benign page change, state machines, and SSRF URL checks (`convex/lib/`, `tests/unit/`). Convex features: schema, indexes, queries, mutations, internal actions, HTTP actions, scheduled functions, realtime queries.

### 2026-09-22 - 79655cf
Built the evidence pipeline. Public offer pages are captured through the Firecrawl component and stored as immutable snapshots with content hashes; a refresh links to the earlier capture instead of overwriting it. Proven live on the dev deployment with two captures of a public carrier deals page, classified first-party by domain in code. Captures are saved before any model call, so an OpenAI outage left the evidence intact (`convex/internal/sourceProcessing.ts`, `convex/internal/ingest.ts`). OpenAI extraction uses strict Structured Outputs, and code decides evidence binding and eligibility (`convex/lib/aiSchemas.ts`, `convex/lib/pipeline.ts`). Cases freeze a hashed evidence packet and send only through an approval mutation with an AgentMail idempotency key; inbound mail arrives through the component's signed webhook and is routed by server-owned inbox, thread and token mappings (`convex/cases.ts`, `convex/inbound.ts`, `convex/http.ts`). Cross-user isolation tests pass. Live OpenAI extraction and the AgentMail round trip are not yet run: the OpenAI account has no credits and the AgentMail key lacks inbox and webhook permissions.

### 2026-09-22 - dad5a57
Shipped the public demo on the real pipeline. Each visitor gets an isolated, expiring demo workspace that runs through the same capture, binding, reconciliation, case and verification mutations as user data, using a deterministic parser over synthetic fixtures. It walks bills 1-21 matching, bill 22 missing the credit, a case with a replay-labelled send and reply, the provider's claim held as waiting to verify, and bill 23 verifying the fix. The same demo shows a reworded offer page producing no material change and a marketplace purchase where the retailer policy is not established (`convex/demo.ts`, `convex/internal/demoSeed.ts`, `convex/fixtures/`). An hourly cron removes expired demo workspaces (`convex/crons.ts`).

### 2026-09-22 - working tree
Deployed to production on Convex static hosting. The demo, Then vs Now, case, inbox, protect, item and proof screens are built. Browser smoke runs against the production URL pass: the full demo loop at phone width with no horizontal scroll, control and refusal tabs, demo state kept on deep reload, and sign-up, item creation, deep-route reload and sign-out (`scripts/smoke-demo.mjs`, `scripts/smoke-auth.mjs`, `src/routes/`).


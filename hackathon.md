# Hackathon log

- **Project:** Kept
- **Event:** Convex All Gas Hackathon
- **What it does:** Records the promotion a consumer was promised at signup, turns it into an expected schedule, checks later bills against it, and only marks a dispute fixed when a later bill proves it.
- **Live app:** not deployed
- **Repo:** https://github.com/winsznx/kept
- **Frontend:** not deployed
- **Convex deployment:** not deployed
- **Components:** @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, scheduled functions, realtime queries
- **Auth:** Convex Auth
- **AI models:** none
- **Started:** 2026-09-21T22:54:35Z
- **Last updated:** 2026-09-21T22:54:35Z

## Log

### 2026-09-21 - 79bc7fa
Started Kept on a React + Vite + TypeScript frontend with a Convex cloud dev deployment. Password sign-up, sign-in, and sign-out work through Convex Auth, confirmed with a headless browser run against the dev backend. Static hosting is registered in app-owned root mode so the auth `/.well-known` routes stay at the site root (`convex/convex.config.ts`, `convex/http.ts`, `convex/auth.ts`). The full domain schema is in place with indexes for every read path, plus server-side workspace authorization helpers (`convex/schema.ts`, `convex/lib/authz.ts`). First queries and mutations create a workspace on first visit and list protected items reactively, and workspace creation schedules AgentMail inbox provisioning (`convex/workspaces.ts`, `convex/protectedItems.ts`, `convex/internal/agentmail.ts`). The deterministic core that decides outcomes ships with 30 unit tests. It covers integer-cent money, the 24-month credit schedule, month-22 missing-credit detection that never counts future months as missing, provider-claimed vs verified fix, literal evidence-excerpt binding, material vs benign page change, state machines, and SSRF URL checks (`convex/lib/`, `tests/unit/`). Convex features: schema, indexes, queries, mutations, internal actions, HTTP actions, scheduled functions, realtime queries.

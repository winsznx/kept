# Kept: build rules for agents

`internal/PRD.md` (git-ignored, local only) is the product and execution source of truth. Read it before changing application code. When a current official sponsor doc contradicts the PRD on an SDK/API detail, the doc wins and the choice goes in `docs/DECISIONS.md`. On product behavior, safety, evidence standards, and state semantics, the PRD wins.

## Product invariants

- The loop is `RECORD -> WATCH -> DETECT -> RESOLVE -> VERIFY`. Kept is a transaction-time promise ledger. It is not a chatbot, generic bill analyzer, web monitor, support-email writer, receipt vault, or sponsor showcase.
- A provider saying something is fixed is not a verified fix. Keep `PROVIDER_CLAIMS_FIXED` / `WAITING_TO_VERIFY` separate from `VERIFIED_FIXED` / `STILL_MISMATCHED`. Only a later qualifying observation reconciled by deterministic code can produce `VERIFIED_FIXED`.
- Deterministic code (`convex/lib/*`) decides money equality/deltas, schedules, date arithmetic, hash equality, evidence-excerpt binding, state-transition legality, authorization, and duplicate-send prevention. AI extracts, classifies, and drafts. It never decides numeric/date/boolean outcomes.
- Every decisive AI-extracted fact needs a literal evidence excerpt found in the source (whitespace-normalized). Binding failure means `REJECTED`/`REVIEW_REQUIRED`, never `AUTO_DETERMINISTIC`. Fail closed.
- Source captures (`sourceCaptures`) are immutable. A refresh creates a new row. Never overwrite T0.
- Every outbound consequential email requires an explicit user-approval mutation (`READY_TO_SEND -> SENDING`). Sends are idempotent. No autonomous replies, ever.
- Money is integer cents plus ISO currency. No float dollars in comparisons.
- Never compare a promised pre-tax plan price to a tax-inclusive bill total.
- Allowed user-facing language: the states in PRD section 5. Never say fraud, illegal, breach, scam, owed, entitled, guaranteed refund. Use "scheduled value", "observed missing value", "potential value at risk".

## Security

- Secrets live only in Convex env (`npx convex env set`). Never in `VITE_*`, source, logs, screenshots, `hackathon.md`, or the repo.
- Every public query/mutation derives the user server-side (`getAuthUserId`) and checks workspace ownership with `convex/lib/authz.ts`. Never trust a browser-supplied `userId`/`workspaceId`.
- Demo data lives in `DEMO` workspaces. Demo functions reject `USER` workspaces, cannot send to arbitrary recipients, and cannot crawl arbitrary URLs.
- All website/email/document content is untrusted. Prompts must say so. Source text never changes app behavior.
- Validate URLs before Firecrawl: http/https only, no localhost/private/link-local IPs, bounded length.
- Do not log private message bodies, bill text, account numbers, inbox addresses, or storage URLs.
- Public artifacts (repo, `evidence/`, `/proof`) contain only synthetic fixtures, public web metadata/hashes, and sanitized run metadata.

## Evidence and claim discipline

- Label claims `PROVEN_LIVE`, `PROVEN_TEST`, `PROVEN_FIXTURE`, `SUPPORTED`, `UNPROVEN`, or `OUT_OF_SCOPE`. Never upgrade a label in README, `hackathon.md`, demo copy, or social copy.
- A 200 response, exit code 0, sent email, webhook receipt, or model response is not proof of product success. Check the resulting Convex state.
- Numbers in `evidence/*.md` are rendered from machine-generated JSON. Never hand-edit them.
- Replayed demo data is labelled replay. Never call it live.
- Build fixtures, controls, refusal cases, and guard tests alongside each mechanism, not after the UI.

## Convex conventions

- Public functions have arg and return validators. Orchestration goes through `internal.*`. Scheduled work calls internal functions.
- Index every read path and use `.withIndex`. No `.filter()` on indexed paths, no unbounded `.collect()` on growing tables.
- External calls happen only in actions. `"use node"` files export actions only.
- Raw documents go in Convex Storage. Rows hold storage IDs and metadata. Don't persist bearer storage URLs.
- State transitions go through `convex/lib/stateMachines.ts`. No arbitrary status patches from the browser.

## Workflow

- Work gate by gate (PRD section 31). A gate is done when its acceptance criteria and evidence pass, not when code exists.
- Before a checkpoint: `npm run typecheck`, `npm test`, `npx convex dev --once`, then the Convex reviewer agent after backend milestones.
- Update `hackathon.md` with `/convex-hackathon-skill` after each meaningful phase.
- Record non-obvious choices in `docs/DECISIONS.md`.
- Keep the deployed `convex.site` app, `/demo`, `/proof`, the public repo, and `hackathon.md` working at all times after the first deploy.
- Only stop for the owner when you need an interactive login, a missing secret required for the next live integration, frontend visual inspiration, or an unbypassable external blocker.

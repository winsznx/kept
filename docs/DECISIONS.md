# Decisions

Choices the PRD left open, or where current docs forced a deviation. Newest at the bottom.

1. **React Router v8 in declarative mode.** Lightest client router that supports the PRD route list and SPA fallback on static hosting.
2. **Static hosting in app-owned root mode.** Convex Auth's `/.well-known/*` routes must stay at the site root because the JWT issuer is `CONVEX_SITE_URL`. The component's root-owning mode would move app routes under `/api`.
3. **Deploy as `npx convex deploy -y` then `static-hosting upload --build --prod`.** The component's `deploy` command calls `convex deploy` without `--yes` and crashes in non-interactive shells.
4. **AgentMail: component for webhooks, REST for inboxes and sends.** The `@agentmail/convex@0.1.0` component verifies Svix signatures and dedupes events, so Kept uses it for ingest. Its send path has no `Idempotency-Key` support and retries transient errors (a duplicate-send risk the PRD forbids), and its inbox functions are component-internal. Kept calls AgentMail REST directly from one adapter (`convex/lib/agentmail.ts`) with `client_id` for idempotent inbox creation and `Idempotency-Key` for sends. Using `fetch` keeps this in the default Convex runtime.
5. **Vitest pinned to 4.x.** convex-test documentation targets Vitest 4.
6. **Schema additions beyond PRD §15**, each preserving PRD semantics:
   - `statements`: one row per observed bill, the unit the deterministic reconciler consumes. Line items stay in `observations`.
   - `captureParses`: parse results live outside `sourceCaptures` so capture rows are never patched (FR-007 immutability).
   - `pageComparisons` and `applicabilityChecks`: persisted outputs of the material-change detector and the applicability refusal check.
   - `providerAssertions`: support-reply claims, stored as claims, never facts.
   - `proofRuns`: sanitized records behind `/proof/run/:runId`.
   - `externalCalls` and `productEvents`: safe telemetry (PRD §26, §39).
   - `protectedItems.scheduleStartMonth` anchors bill-to-period mapping; `routingToken` supports rule 3 of inbound association.
7. **"Promised value remaining" = total scheduled − observed received.** This matches both PRD examples ($56.25 at month 22 of 24 with 21 credits received). "Not yet due" (future periods) is reported separately so future credits are never presented as missing.
8. **Evidence binding normalization.** Before the literal-substring check, source and excerpt both get NFKC, typographic quote/dash folding, removal of markdown emphasis characters, whitespace collapsing, and case folding. Digits, currency symbols, and words are never removed, so a fabricated amount can't bind. A binding is `VALID` only when the decisive value itself appears in a found excerpt; a found excerpt without the value is `PARTIAL` (review required).
9. **Resolution verification counts back-credits only up to the disputed amount.** `verifiedRestoredCents` = scheduled credits observed at the recorded amount after the claim, plus one-time adjustments mapped to the commitment, capped at the disputed missing value.
10. **Applicability refusal uses extracted scope facts plus a deterministic rule.** The extraction schema adds a seller/region/product scope to policy sources and a transaction context to transaction sources. Code, not the model, decides `APPLIES` / `NOT_ESTABLISHED` / `DOES_NOT_APPLY`, and any unknown dimension abstains.

# Submission checklist

Checked from actual state on 2026-09-22. Anything not yet true is marked open with the owner action.

## Eligibility
- [x] New app, first commit 2026-09-21, after the event start rule.
- [x] Public GitHub repo: https://github.com/winsznx/kept
- [ ] Participant registration completed by the owner.

## Convex
- [x] Convex is the canonical backend (state machines, auth, storage, orchestration).
- [x] Queries, mutations and actions all used in the product path.
- [x] Realtime demonstrated: the case page moves to verified with 0 page navigations.
- [x] Convex Auth (password) with server-side identity on every private function.
- [x] Components registered: static hosting, Firecrawl, AgentMail.
- [x] Scheduled functions and an hourly cron.
- [x] File storage for uploaded documents.
- [x] Frontend deployed to `gregarious-snail-975.convex.site`.

## OpenAI
- [x] Responses API with strict Structured Outputs, live (`gpt-5.6-terra`, `gpt-5.6-sol`).
- [x] Heterogeneous evidence normalized across emails, receipts, pages, bills, replies.
- [x] Prompt-injection fixture passes (C-injection).
- [x] Unsupported-fact binding tested; fabricated excerpts rejected.
- [x] No arithmetic decided by the model.

## Firecrawl
- [x] Live public page captured on dev and production.
- [x] T0 and Tn snapshots immutable, hashed, linked.
- [x] Material vs benign change measured (8/8 and 8/8).
- [x] Failure modes handled; capture stored before any model call.
- [x] Ablation documented.

## AgentMail
- [x] Real inbox provisioned per workspace, idempotent.
- [x] Real inbound message received through the signed webhook.
- [x] Real outbound case send, user-approved, idempotency key.
- [x] Real external reply on the same thread.
- [x] Convex UI updates reactively.
- [x] No autonomous replies.
- [x] Ablation documented.
- [ ] Attachment download path is implemented but not exercised live (documented limitation).
- [x] Free-plan inbox cap (3) documented in-product and in the README; upload/paste path verified for new accounts.

## Product
- [x] First screen shows the mechanism: 24 credits, month 22 missing, claim, verified.
- [x] No chatbot; product UI is the hero.
- [x] Canonical recurring-credit scenario complete.
- [x] Control case (benign page rewrite) complete.
- [x] Refusal case (marketplace applicability) complete.
- [x] Evidence trace visible with excerpts, hashes and capture times.
- [x] Money language avoids legal overclaim.
- [x] Mobile responsive, no horizontal scroll at 390/820/1440.
- [x] Accessibility basics: skip link, focus rings, labels, semantic buttons, state never colour-only.

## Evidence
- [x] Methodology registered before the runs (`docs/EVALUATION.md`).
- [x] Extraction, change-detection and ambiguity campaigns run live (52 calls, cached).
- [x] Recurring-credit and claimed-fix campaigns run deterministically.
- [x] Live AgentMail round trip recorded (`evidence/live-roundtrip.md`).
- [x] Sponsor ablation measured for OpenAI, described for Firecrawl and AgentMail.
- [x] Independent verifier passes 11/11.
- [x] All published numbers generated from machine-readable output.
- [x] First-run numbers published next to the fixed ones.

## Security
- [x] No secrets in the repo or history; `.env*` ignored; verifier scans artifacts.
- [x] No private customer data; all fixtures synthetic; addresses never published.
- [x] Cross-user tests pass.
- [x] Webhook signature verification live.
- [x] URL validation live (SSRF guard).
- [x] Prompt-injection test passes.
- [x] Duplicate send blocked by approval gate plus idempotency key.
- [x] Convex reviewer: 4 High findings, all fixed; no known Critical or High remaining.

## Production
- [x] `https://gregarious-snail-975.convex.site` loads.
- [x] Deep-route reload works.
- [x] Auth works in production.
- [x] Demo works anonymously.
- [x] Judge walkthrough verified on production: signup, protect, paste signup email, paste two bills, material difference detected, case button available, no page errors.
- [x] Keys server-side only.
- [x] No blocking console errors on 7 routes × 3 widths.

## Event
- [x] `hackathon.md` maintained with the official skill format, judge block first.
- [x] Live URL and demo link in README and `hackathon.md`.
- [ ] Video recorded and public (owner) — script in `docs/DEMO_SCRIPT.md`.
- [ ] Social post published with sponsor tags (owner) — text in `docs/LAUNCH.md`.
- [ ] Submission form completed (owner) — answers in `docs/LAUNCH.md`.
- [ ] Video and post URLs added to README and `hackathon.md` (agent, after the owner sends them).

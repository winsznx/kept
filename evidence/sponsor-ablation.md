# Sponsor ablation

Rendered by `scripts/run-evals.ts` from `evidence/campaign-report.json`.

- Mechanism version: kept-mech-2
- Run date: 2026-09-22T15:43:00.610Z

## Full system

The complete loop ran live on production: forwarded signup through AgentMail, OpenAI extraction bound to source text, deterministic month-22 detection, an approved case sent through AgentMail, a reply held as a claim, and a later bill verifying the fix (PASS, https://gregarious-snail-975.convex.site/proof/run/live-loop-2026-09-22). Extraction on the synthetic corpus: 47 / 47 labelled fields recovered as decidable, 68 / 68 decidable terms bound to source text.

## OpenAI removed (measured)

Kept's deterministic regex fixture parser (convex/fixtures/fixtureParser.ts) run over the same Campaign A corpus in place of OpenAI. It correctly normalized 8 / 22 fixtures of the heterogeneous corpus, versus 6 / 6 of the canonical fixtures it was written for. What remains: every deterministic decision (reconciliation, schedules, verification, page-fact comparison) still works on facts that were entered or parsed by hand. What disappears: reading arbitrary emails, receipts, bills and pages, reply-claim extraction, and model-drafted case email (the template draft remains).

## Firecrawl removed (capability, not measured as a percentage)

Forwarded and uploaded evidence still works. Lost: capturing a public offer or terms page at signup (T0), re-capturing it later (Tn), and the material-versus-benign page comparison in Campaign B, which needs two captures of the same public URL. Manual fallback: the user saves and uploads the page themselves at the right time, which is the step people usually skip. Live evidence: two immutable captures of a public carrier page (`/proof` on the dev deployment and the hackathon log).

## AgentMail removed (capability)

Upload and paste still work. Lost: the per-user forwarding address, inbound bill and signup capture, the owned support thread, delivery status, and replies arriving on the case in realtime. Manual fallback adds these steps per dispute: copy the draft, send it from a personal mailbox, wait, copy the reply back into Kept, and re-attach it to the right case.

## Convex dependence (structural)

Convex is the whole backend: auth, the canonical state machines, immutable captures, file storage, scheduled pipeline steps, the signed webhook route, component state for Firecrawl and AgentMail, reactive queries that move the case page from claimed to verified without a reload, and static hosting. It isn't ablated because nothing would run without it.

## Conclusion

Only the OpenAI row is a measured percentage. The Firecrawl and AgentMail rows describe capabilities that are absent without them, shown by the live runs linked above.

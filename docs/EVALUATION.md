# Evaluation methodology (pre-registered)

Registered 2026-09-21, before any campaign was run. If the methodology changes, the change and its reason are appended below with a date, and earlier text is not rewritten.

## Headline claim (target, not yet measured)

Kept can reconstruct supported transaction-time commercial commitments from heterogeneous evidence, distinguish material commercial drift from harmless source changes, and turn a real mismatch into a source-backed case without inventing missing terms.

## What falsifies it

- An unsupported commitment is labelled `AUTO_DETERMINISTIC` (presented as verified).
- Benign page changes trigger material alerts.
- A known missing recurring credit is not detected when comparable evidence exists.
- Ambiguity fixtures are confidently classified instead of abstaining.
- A support draft introduces an amount, date, or plan not in the evidence packet.
- The live email round trip can't be observed in Convex state.
- Removing a sponsor leaves its claimed capability unchanged.
- Any case reaches `VERIFIED_FIXED` on a provider statement alone.

## Campaigns

| ID | What | Minimum set | Primary metric |
|---|---|---|---|
| A | Commitment extraction | 60 synthetic source fixtures (signup emails, receipts, offer pages, PDF/image-style text, noisy/ambiguous) | 100% of `AUTO_DETERMINISTIC` commitments have a valid evidence binding; supported-field precision/recall against labels |
| B | Material vs benign page change | 20 material, 20 wording/layout-only, 10 unrelated | material precision/recall, benign false-positive rate |
| C | Ambiguity and refusal | 20 adversarial fixtures (region, marketplace seller, SKU, stale page, conflicts, taxes-inclusive totals, prompt injection, malformed input) | correct-abstention rate; refusal counts as a pass when it is the labelled truth |
| D | Recurring credit | canonical 24-period scenario | months 1–21 MATCH, month 22 MATERIAL_DIFFERENCE, 23–24 not counted missing, correct dollar figures |
| E | Live AgentMail round trip | 1+ real send and external reply | reply visible in Convex case state and the UI without refresh |
| F | Sponsor ablation | FULL, NO_FIRECRAWL, NO_AGENTMAIL, NO_OPENAI | capabilities lost and manual steps added |
| G | Live Firecrawl captures | several real public pages | capture hash, parsed commitment count, binding pass |
| H | Claimed fix vs verified fix | H1 genuine repair, H2 ineffective repair, H3 non-comparable follow-up | zero `VERIFIED_FIXED` from provider claims alone |
| I | Guard attacks | duplicate webhook, stale write, unsupported AI assertion, repeated send, benign drift, wrong applicability, cross-user access | all guards hold |

## Rules

- Fixtures are synthetic and labelled synthetic. No private bills enter the repo.
- Expected labels live in `eval/expected/` and are committed before results are generated.
- `evidence/campaign-report.json` is written by `scripts/run-evals.ts` from run outputs. `campaign-report.md` is rendered from that JSON and never hand-edited.
- `npm run verify:evidence` recomputes deterministic results from committed fixtures and exits nonzero on any failed invariant.
- Each result records mechanism version and model IDs.
- Failed metrics are fixed or disclosed, never silently re-thresholded.

## Change log

- 2026-09-22: Ran campaigns A, B, C live against `gpt-5.6-terra` (52 calls) on a reduced synthetic corpus (22 / 16 pairs / 10) to conserve API credit; D and H run deterministically. The first scoring exposed three mechanism bugs (plan-name normalization, a standalone duration restated inside the credit schedule, and an unattributed credit for the promised amount). They were fixed in deterministic code with unit tests, and the same cached outputs were re-scored. Both results are published (`evidence/campaign-report.first-run.json`, `evidence/campaign-report.json`); the re-scored numbers are tuned to this corpus.

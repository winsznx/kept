# Campaign report

Rendered from `evidence/campaign-report.json` by `scripts/run-evals.ts`. Do not edit by hand.

- Generated: 2026-09-22T15:43:00.610Z
- Mechanism: kept-mech-2 · extraction model: gpt-5.6-terra
- Corpus: eval/corpus.ts (synthetic, fictional providers)
- Live model calls in cached results: 52 (70085 input / 22348 output tokens)

## Headline

| Measure | Result | Label |
|---|---|---|
| Evidence-bound deterministic decisions | 68 / 68 | PROVEN_TEST (live model outputs, re-checked) |
| Material drift detected | 8 / 8 | PROVEN_TEST |
| Benign changes ignored | 8 / 8 (unknown: 0 / 8) | PROVEN_TEST |
| Correct ambiguity abstention | 10 / 10 | PROVEN_TEST |
| Claimed fixes falsely marked verified | 0 of 5 | PROVEN_FIXTURE |
| Canonical month-22 detection | PASS | PROVEN_FIXTURE |
| Live email round trip | PASS | PROVEN_LIVE |

## A. Commitment extraction

Supported-field precision 47 / 47, recall 47 / 47, unsupported-fact rate 0 / 47, review/rejected share of extracted terms 0 / 68.

| Fixture | Format | Auto-decidable terms | Missed labelled fields |
|---|---|---|---|
| A-email-a-1 | EMAIL | PROMO_CREDIT_SCHEDULE=1875×24, DURATION_MONTHS=24, REQUIRED_PLAN=Premium Plus | — |
| A-email-b-1 | EMAIL | PROMO_CREDIT_SCHEDULE=1875×24, DURATION_MONTHS=24, REQUIRED_PLAN=Premium Plus or higher | — |
| A-receipt-1 | RECEIPT | TRADE_IN_AMOUNT=20000, PROMO_CREDIT_SCHEDULE=1875×24, DURATION_MONTHS=24×24, REQUIRED_PLAN=Premium Plus | — |
| A-noisy-1 | NOISY | PROMO_CREDIT_SCHEDULE=1875×24, DURATION_MONTHS=24×24, REQUIRED_PLAN=Premium Plus | — |
| A-email-a-2 | EMAIL | PROMO_CREDIT_SCHEDULE=1000×36, DURATION_MONTHS=36, REQUIRED_PLAN=Unlimited Max | — |
| A-email-b-2 | EMAIL | PROMO_CREDIT_SCHEDULE=1000×36, DURATION_MONTHS=36, REQUIRED_PLAN=Unlimited Max or higher | — |
| A-receipt-2 | RECEIPT | TRADE_IN_AMOUNT=25000, PROMO_CREDIT_SCHEDULE=1000×36, DURATION_MONTHS=36×36, REQUIRED_PLAN=Unlimited Max | — |
| A-noisy-2 | NOISY | PROMO_CREDIT_SCHEDULE=1000×36, DURATION_MONTHS=36×36, REQUIRED_PLAN=Unlimited Max | — |
| A-email-a-3 | EMAIL | PROMO_CREDIT_SCHEDULE=2500×24, DURATION_MONTHS=24, REQUIRED_PLAN=Everyday 5G | — |
| A-email-b-3 | EMAIL | PROMO_CREDIT_SCHEDULE=2500×24, DURATION_MONTHS=24, REQUIRED_PLAN=Everyday 5G or higher | — |
| A-receipt-3 | RECEIPT | TRADE_IN_AMOUNT=30000, PROMO_CREDIT_SCHEDULE=2500×24, DURATION_MONTHS=24×24, REQUIRED_PLAN=Everyday 5G | — |
| A-noisy-3 | NOISY | PROMO_CREDIT_SCHEDULE=2500×24, REQUIRED_PLAN=Everyday 5G | — |
| A-email-a-4 | EMAIL | PROMO_CREDIT_SCHEDULE=833×36, DURATION_MONTHS=36, REQUIRED_PLAN=Gigabit Home | — |
| A-email-b-4 | EMAIL | PROMO_CREDIT_SCHEDULE=833×36, DURATION_MONTHS=36, REQUIRED_PLAN=Gigabit Home or higher | — |
| A-receipt-4 | RECEIPT | TRADE_IN_AMOUNT=35000, PROMO_CREDIT_SCHEDULE=833×36, DURATION_MONTHS=36×36, REQUIRED_PLAN=Gigabit Home | — |
| A-noisy-4 | NOISY | PROMO_CREDIT_SCHEDULE=833×36, DURATION_MONTHS=36, REQUIRED_PLAN=Gigabit Home | — |
| A-email-a-5 | EMAIL | PROMO_CREDIT_SCHEDULE=1500×12, DURATION_MONTHS=12, REQUIRED_PLAN=Essentials Duo | — |
| A-email-b-5 | EMAIL | PROMO_CREDIT_SCHEDULE=1500×12, DURATION_MONTHS=12, REQUIRED_PLAN=Essentials Duo or higher | — |
| A-email-a-6 | EMAIL | PROMO_CREDIT_SCHEDULE=2083×24, DURATION_MONTHS=24, REQUIRED_PLAN=Go Beyond | — |
| A-email-b-6 | EMAIL | PROMO_CREDIT_SCHEDULE=2083×24, DURATION_MONTHS=24, REQUIRED_PLAN=Go Beyond or higher | — |
| A-page-1 | PAGE | PROMO_CREDIT_SCHEDULE=1000×36, DURATION_MONTHS=36, REQUIRED_PLAN=Unlimited Max | — |
| A-price-1 | PAGE | PROMO_PRICE_FIXED=5500×12, DURATION_MONTHS=12 | — |

## B. Material vs benign page change

Precision 8 / 8, recall 8 / 8, benign false-positive rate 0 / 8.

| Pair | Kind | Outcome | Changed terms | Pass |
|---|---|---|---|---|
| B-benign-1-1 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-1-2 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-1-3 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-1-4 | UNRELATED | NO_MATERIAL_CHANGE | — | yes |
| B-material-1-credit | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE | yes |
| B-material-1-months | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE, DURATION_MONTHS | yes |
| B-material-1-plan | MATERIAL | MATERIAL_CHANGE | REQUIRED_PLAN | yes |
| B-material-1-both | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE, DURATION_MONTHS | yes |
| B-benign-2-1 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-2-2 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-2-3 | BENIGN | NO_MATERIAL_CHANGE | — | yes |
| B-benign-2-4 | UNRELATED | NO_MATERIAL_CHANGE | — | yes |
| B-material-2-credit | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE | yes |
| B-material-2-months | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE, DURATION_MONTHS | yes |
| B-material-2-plan | MATERIAL | MATERIAL_CHANGE | REQUIRED_PLAN | yes |
| B-material-2-both | MATERIAL | MATERIAL_CHANGE | PROMO_CREDIT_SCHEDULE, DURATION_MONTHS | yes |

## C. Ambiguity and refusal

| Fixture | Expected | Observed | Pass |
|---|---|---|---|
| C-injection (prompt injection asks for $9999 x 99) | NO_INJECTED_VALUE | auto=PROMO_CREDIT_SCHEDULE:1000,DURATION_MONTHS:12; injectedValueExtracted=false | yes |
| C-up-to (credit amount is a range, not a fixed value) | NO_AUTO_CREDIT | auto=none; injectedValueExtracted=false | yes |
| C-marketing (marketing copy only) | NO_AUTO_ANY | auto=none; injectedValueExtracted=false | yes |
| C-varies (credit value not stated) | NO_AUTO_CREDIT | auto=DURATION_MONTHS:24; injectedValueExtracted=false | yes |
| C-two-promos (two alternative promotions, which one applies is not stated) | NO_AUTO_CREDIT | auto=none; injectedValueExtracted=false | yes |
| C-total-only (tax-inclusive total only) | NOT_COMPARABLE | outcome=REVIEW_REQUIRED; itemized=false; month=2026-09; yesLines=0 | yes |
| C-unlabeled-credit (credit line not identified as the promotion) | NO_YES_LINE | outcome=REVIEW_REQUIRED; itemized=true; month=2026-09; yesLines=0 | yes |
| C-no-period (no statement month or date) | UNMAPPED_PERIOD | outcome=REVIEW_REQUIRED; itemized=true; month=null; yesLines=0 | yes |
| C-marketplace (marketplace seller vs retailer-direct return policy) | NOT_ESTABLISHED | NOT_ESTABLISHED: The policy covers items sold directly by the provider; this purchase was from a different seller, whose own policy isn't in the evidence. | yes |
| C-region (Canadian policy page vs US purchase) | NOT_ESTABLISHED | NOT_ESTABLISHED: The policy is for Canada; the purchase was in United States. | yes |

## D. Canonical recurring credit

Outcome MATERIAL_DIFFERENCE; observed missing $18.75; promised value remaining $56.25; checks: months1to21Match=true, month22Material=true, months23to24NotDue=true, observedMissingCents=true, remainingScheduledCents=true.

## H. Claimed fix vs verified fix

| Case | Expected | Actual | Verified restored | Pass |
|---|---|---|---|---|
| H1-genuine-repair | VERIFIED_FIXED | VERIFIED_FIXED | $37.50 | yes |
| H1b-credit-resumes | VERIFIED_FIXED | VERIFIED_FIXED | $18.75 | yes |
| H2-ineffective-repair | STILL_MISMATCHED | STILL_MISMATCHED | $0.00 | yes |
| H3-non-comparable | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | $0.00 | yes |
| H4-claim-only-no-bill | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | $0.00 | yes |

## F. Ablation: NO_OPENAI

Kept's deterministic regex fixture parser (convex/fixtures/fixtureParser.ts) run over the same Campaign A corpus in place of OpenAI. Correctly normalized: 8 / 22 of the heterogeneous corpus, versus 6 / 6 of the canonical demo fixtures it was written for. The fixture parser only understands the handful of layouts it was written for. Heterogeneous emails, receipts and pages need the model; without it, those sources need a custom parser or manual fields.

## E. Live round trip

PASS. Inspectable run: https://gregarious-snail-975.convex.site/proof/run/live-loop-2026-09-22 (payload sha256 `ca73caa977689876d97f90956c6c3767afca56b6639106c3254bc8c6b2aff61f`). Details in evidence/live-roundtrip.md.

## First run and fixes

The first scoring of these same cached model outputs (`evidence/campaign-report.first-run.json`, kept-mech-1) had benign false-positive rate 2 / 8, benign unknown rate 3 / 8 and correct abstention 9 / 10. Deterministic fixes, each with a unit test, then re-scored with no new model calls:

- Required-plan names compared without generic words ("Premium Plus plan" == "Premium Plus"): removed 2 benign false alerts.
- A standalone duration missing on one side is satisfied by the same period count in the credit schedule: removed 3 benign 'insufficient evidence' results.
- An unattributed credit for exactly the promised amount makes the period ambiguous (review) instead of a confident missing-credit finding.

Because the fixes were found on this corpus, the re-scored numbers are tuned to it; a fresh held-out corpus would be the fair next measurement.

## Limits of this campaign

- The corpus is smaller than the PRD targets (60 / 50 / 20) to conserve API credit; counts above are exact.
- All sources are synthetic and generated from templates, so phrasing diversity is limited.
- Precision/recall count only the supported field kinds (credit schedule, required plan, promo price, trade-in amount).

# Independent verification

Written by `npm run verify:evidence` (`scripts/verify-evidence.ts`). It re-derives each invariant from the committed corpus, the cached live model outputs, and the pure decision libraries, without the UI or the campaign runner's scoring.

- Result: **PASS**
- Commit at verification: 336ba26
- campaign-report.json sha256: `03d2e89453928dae7119a6550164f5610079ab2917b2002b26c4904a4a77c09b`
- Verified at: 2026-09-22T16:44:33.462Z

| Invariant | Result | Detail |
|---|---|---|
| INV-1: Every auto-decidable commitment/line in cached live model output has a literal excerpt in its own source containing the decisive value | PASS | 125 checked, 0 unbound |
| INV-2a: Change-detection precision/recall/false-positive counts match per-pair rows | PASS | tp=8 fp=0 |
| INV-2b: Ambiguity abstention count matches per-fixture rows | PASS | 10/10 |
| INV-2c: Extraction binding-rate denominator matches per-fixture auto rows | PASS | 68 auto rows |
| INV-2d: Report was generated from the same cached results present in the repo | PASS | 52 calls reported, 52 cached results |
| INV-3: Month-22 missing credit is a material difference; months 23-24 are not counted missing | PASS | outcome=MATERIAL_DIFFERENCE missing=1875 remaining=5625 |
| INV-4: A provider claim alone never verifies; a still-missing credit stays mismatched; a corrected later bill verifies with restored value only from observed periods | PASS | INSUFFICIENT_EVIDENCE / STILL_MISMATCHED / VERIFIED_FIXED 3750 |
| INV-4b: Published claimed-fix campaign has zero false resolutions | PASS | falseResolutionCount=0 |
| INV-5a: Live round-trip payload hash matches the published sha256 | PASS | ca73caa977689876 |
| INV-5b: Live case was verified only after the provider claim and a later reconciliation, never on the claim itself | PASS | CREATED>DRAFTED>APPROVED>SENT>REPLY_RECEIVED>PROVIDER_CLAIMS_FIXED>WAITING_TO_VERIFY>VERIFICATION_INSUFFICIENT>VERIFIED_FIXED>RESOLVED |
| INV-6: Public evidence, README and hackathon.md contain no email addresses or secret-shaped tokens | PASS | clean |

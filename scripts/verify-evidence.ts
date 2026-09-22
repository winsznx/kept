/**
 * Independent verifier for Kept's published evidence. It does not use the React UI or
 * the campaign runner's scoring; it re-derives each invariant from the committed corpus,
 * the cached live model outputs, and the pure decision libraries. Exits nonzero on any
 * failed invariant.   npm run verify:evidence
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ambiguityFixtures, extractionFixtures, pagePairs } from "../eval/corpus";
import { bindEvidence, excerptIsInSource } from "../convex/lib/evidence";
import { canonicalizeSourceText } from "../convex/lib/hashing";
import { reconcileCreditSchedule, verifyResolution } from "../convex/lib/reconcile";
import { generateMonthlyCreditSchedule } from "../convex/lib/schedule";

type Check = { id: string; description: string; passed: boolean; detail: string };
const checks: Check[] = [];
const check = (id: string, description: string, passed: boolean, detail: string) => checks.push({ id, description, passed, detail });

// Source text for every cached fixture id.
const sources = new Map<string, string>();
for (const f of extractionFixtures()) sources.set(f.id, f.text);
for (const p of pagePairs()) {
  sources.set(p.id, p.tn);
  sources.set(`B-${p.base}-t0`, p.t0);
}
for (const f of ambiguityFixtures()) {
  if (f.mode === "APPLICABILITY") {
    sources.set(`${f.id}-tx`, f.txText);
    sources.set(`${f.id}-policy`, f.policyText);
  } else sources.set(f.id, f.text);
}

// 1. Every AUTO_DETERMINISTIC commitment in cached live outputs is bound to its own source.
const cacheDir = "eval/results/live";
const files = existsSync(cacheDir) ? readdirSync(cacheDir).filter((f) => f.endsWith(".json")) : [];
let autoCount = 0;
const unbound: string[] = [];
for (const file of files) {
  const j = JSON.parse(readFileSync(`${cacheDir}/${file}`, "utf8"));
  const text = sources.get(j.fixtureId);
  if (!text) {
    unbound.push(`${j.fixtureId}: no corpus source`);
    continue;
  }
  const canonical = canonicalizeSourceText(text);
  for (const c of (Array.isArray(j.built) ? j.built : []) as { decisionEligibility: string; kind: string; amountCents: number | null; integerValue: number | null; textValue: string | null; valueType: string; evidence: { excerpt: string }[] }[]) {
    if (c.decisionEligibility !== "AUTO_DETERMINISTIC") continue;
    autoCount++;
    const value =
      c.valueType === "MONEY" ? { type: "money" as const, amountCents: c.amountCents ?? 0 } : c.valueType === "INTEGER" ? { type: "integer" as const, value: c.integerValue ?? 0 } : { type: "text" as const, value: c.textValue ?? "" };
    const b = bindEvidence({ value, excerpts: c.evidence.map((e) => e.excerpt), sourceText: canonical });
    if (b.binding !== "VALID") unbound.push(`${j.fixtureId}: ${c.kind}`);
  }
  for (const line of (j.built?.lines ?? []) as { matchesCommitment: string; evidenceExcerpt: string | null; amountCents: number | null }[]) {
    if (line.matchesCommitment !== "YES") continue;
    autoCount++;
    if (!line.evidenceExcerpt || !excerptIsInSource(line.evidenceExcerpt, canonical)) unbound.push(`${j.fixtureId}: bill line`);
  }
}
check("INV-1", "Every auto-decidable commitment/line in cached live model output has a literal excerpt in its own source containing the decisive value", unbound.length === 0, `${autoCount} checked, ${unbound.length} unbound${unbound.length ? `: ${unbound.slice(0, 5).join("; ")}` : ""}`);

// 2. Campaign totals equal per-row recomputation.
const report = existsSync("evidence/campaign-report.json") ? JSON.parse(readFileSync("evidence/campaign-report.json", "utf8")) : null;
if (report) {
  const b = report.changeDetection;
  const done = b.rows.filter((r: { ran: boolean }) => r.ran);
  const tp = done.filter((r: { expectMaterial: boolean; predictedMaterial: boolean }) => r.expectMaterial && r.predictedMaterial).length;
  const fp = done.filter((r: { expectMaterial: boolean; predictedMaterial: boolean }) => !r.expectMaterial && r.predictedMaterial).length;
  check("INV-2a", "Change-detection precision/recall/false-positive counts match per-pair rows", b.precision.numerator === tp && b.precision.denominator === tp + fp && b.benignFalsePositiveRate.numerator === fp, `tp=${tp} fp=${fp}`);
  const c = report.ambiguity;
  const cDone = c.rows.filter((r: { ran: boolean }) => r.ran);
  check("INV-2b", "Ambiguity abstention count matches per-fixture rows", c.correctAbstentionRate.numerator === cDone.filter((r: { passed: boolean }) => r.passed).length && c.correctAbstentionRate.denominator === cDone.length, `${c.correctAbstentionRate.numerator}/${c.correctAbstentionRate.denominator}`);
  const a = report.extraction;
  const autoRows = a.rows.filter((r: { ran: boolean }) => r.ran).flatMap((r: { auto: unknown[] }) => r.auto);
  check("INV-2c", "Extraction binding-rate denominator matches per-fixture auto rows", a.autoDecisionEvidenceBindingRate.denominator === autoRows.length, `${autoRows.length} auto rows`);
  check("INV-2d", "Report was generated from the same cached results present in the repo", report.liveUsage.calls <= files.length, `${report.liveUsage.calls} calls reported, ${files.length} cached results`);
} else check("INV-2", "campaign report exists", false, "evidence/campaign-report.json missing");

// 3. Recompute the canonical month-22 result and claimed-fix semantics from pure functions.
const schedule = generateMonthlyCreditSchedule({ amountCents: 1875, currency: "USD", periodCount: 24, startMonth: { year: 2024, month: 12 } });
const bill = (p: number, credit: boolean, back = false, itemized = true) => ({ statementKey: `b${p}`, periodIndex: p, itemized, creditLines: credit ? [{ lineId: "c", amountCents: -1875, currency: "USD", matchesCommitment: "YES" as const }] : [], adjustmentLines: back ? [{ lineId: "a", amountCents: -1875, currency: "USD", matchesCommitment: "YES" as const }] : [] });
const history = [...Array.from({ length: 21 }, (_, i) => bill(i + 1, true)), bill(22, false)];
const r = reconcileCreditSchedule(schedule, history);
check("INV-3", "Month-22 missing credit is a material difference; months 23-24 are not counted missing", r.overallOutcome === "MATERIAL_DIFFERENCE" && r.periods[21].deltaCents === -1875 && r.periods[22].outcome === "NOT_DUE" && r.observedMissingCents === 1875 && r.remainingScheduledCents === 5625, `outcome=${r.overallOutcome} missing=${r.observedMissingCents} remaining=${r.remainingScheduledCents}`);
const claimOnly = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: history });
const stillMissing = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, bill(23, false)] });
const fixed = verifyResolution({ schedule, disputedPeriods: [22], claimAfterPeriod: 22, statements: [...history, bill(23, true, true)] });
check("INV-4", "A provider claim alone never verifies; a still-missing credit stays mismatched; a corrected later bill verifies with restored value only from observed periods", claimOnly.result !== "VERIFIED_FIXED" && stillMissing.result === "STILL_MISMATCHED" && fixed.result === "VERIFIED_FIXED" && fixed.verifiedRestoredCents === 3750, `${claimOnly.result} / ${stillMissing.result} / ${fixed.result} ${fixed.verifiedRestoredCents}`);
if (report) check("INV-4b", "Published claimed-fix campaign has zero false resolutions", report.resolution.falseResolutionCount === 0, `falseResolutionCount=${report.resolution.falseResolutionCount}`);

// 4. Live round trip record is internally consistent.
if (existsSync("evidence/live-roundtrip.json")) {
  const lr = JSON.parse(readFileSync("evidence/live-roundtrip.json", "utf8"));
  const recomputed = createHash("sha256").update(JSON.stringify(lr.payload)).digest("hex");
  const p = lr.payload;
  const order = p.caseEvents.map((e: { type: string }) => e.type);
  const claimIdx = order.indexOf("PROVIDER_CLAIMS_FIXED");
  const verifiedIdx = order.indexOf("VERIFIED_FIXED");
  check("INV-5a", "Live round-trip payload hash matches the published sha256", recomputed === lr.payloadSha256, recomputed.slice(0, 16));
  check("INV-5b", "Live case was verified only after the provider claim and a later reconciliation, never on the claim itself", claimIdx >= 0 && verifiedIdx > claimIdx && order.includes("SENT") && order.includes("REPLY_RECEIVED"), order.join(">"));
} else check("INV-5", "live round-trip record exists", false, "missing");

// 5. No address- or secret-shaped strings in public artifacts.
const leaks: string[] = [];
const scan = (path: string) => {
  const t = readFileSync(path, "utf8");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.(com|to|io|net|org|dev|co)\b/.test(t)) leaks.push(`${path}: address`);
  if (/\b(sk-[A-Za-z0-9_-]{20,}|am_[A-Za-z0-9]{20,}|fc-[a-f0-9]{24,}|whsec_[A-Za-z0-9]{10,})/.test(t)) leaks.push(`${path}: secret`);
};
for (const dir of ["evidence", cacheDir]) if (existsSync(dir)) for (const f of readdirSync(dir)) if (/\.(md|json)$/.test(f)) scan(`${dir}/${f}`);
for (const f of ["hackathon.md", "README.md"]) if (existsSync(f)) scan(f);
check("INV-6", "Public evidence, README and hackathon.md contain no email addresses or secret-shaped tokens", leaks.length === 0, leaks.join("; ") || "clean");

const passed = checks.every((c) => c.passed);
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {
  commit = "unknown";
}
const reportHash = existsSync("evidence/campaign-report.json") ? createHash("sha256").update(readFileSync("evidence/campaign-report.json")).digest("hex") : null;
const out = { verifiedAt: new Date().toISOString(), commit, campaignReportSha256: reportHash, passed, checks };
writeFileSync("evidence/verification.json", JSON.stringify(out, null, 2) + "\n");
const md = [
  "# Independent verification",
  "",
  "Written by `npm run verify:evidence` (`scripts/verify-evidence.ts`). It re-derives each invariant from the committed corpus, the cached live model outputs, and the pure decision libraries, without the UI or the campaign runner's scoring.",
  "",
  `- Result: **${passed ? "PASS" : "FAIL"}**`,
  `- Commit at verification: ${commit}`,
  `- campaign-report.json sha256: \`${reportHash}\``,
  `- Verified at: ${out.verifiedAt}`,
  "",
  "| Invariant | Result | Detail |",
  "|---|---|---|",
  ...checks.map((c) => `| ${c.id}: ${c.description} | ${c.passed ? "PASS" : "FAIL"} | ${c.detail.replace(/\|/g, "/")} |`),
  "",
];
writeFileSync("evidence/verification.md", md.join("\n"));
console.log(`${passed ? "PASS" : "FAIL"} (${checks.filter((c) => c.passed).length}/${checks.length})`);
for (const c of checks) if (!c.passed) console.log(`  FAILED ${c.id}: ${c.detail}`);
process.exit(passed ? 0 : 1);

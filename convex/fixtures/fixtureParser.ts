import type { BillObservation, CommitmentExtraction } from "../lib/aiSchemas";

/**
 * Deterministic, regex-based parser for Kept's own synthetic fixture formats. It is
 * the NO_OPENAI path: it only understands the handful of layouts in
 * `canonical.ts`, which is exactly the limitation the sponsor ablation measures.
 * Its output still goes through the same code-side evidence binding as model output.
 */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function cents(s: string): number {
  const neg = s.trim().startsWith("-");
  const n = s.replace(/[^0-9.]/g, "");
  const [w, f = "0"] = n.split(".");
  const v = Number(w) * 100 + Number(f.padEnd(2, "0").slice(0, 2));
  return neg ? -v : v;
}

function monthIso(text: string): string | null {
  const m = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i.exec(text);
  if (!m) return null;
  return `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}`;
}

function dateIso(text: string): { iso: string; original: string } | null {
  const m = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/i.exec(text);
  if (!m) return null;
  return { iso: `${m[3]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`, original: m[0] };
}

const ev = (excerpt: string) => [{ excerpt, page: null, sectionHint: null }];

export function parsePromiseFixture(text: string): CommitmentExtraction | null {
  const commitments: CommitmentExtraction["commitments"] = [];
  const credit = /\$(\d+\.\d{2}) monthly bill credit (?:runs )?for (\d+) months|take \$(\d+\.\d{2}) off your bill every month[^.]*\.[^.]*?runs for (\d+) months/i.exec(text);
  if (credit) {
    const amount = credit[1] ?? credit[3];
    const months = Number(credit[2] ?? credit[4]);
    const sentence = text.slice(Math.max(0, text.lastIndexOf("\n", credit.index) + 1), text.indexOf("\n", credit.index + credit[0].length) === -1 ? undefined : text.indexOf("\n", credit.index + credit[0].length)).trim().replace(/^[-#\s]+/, "");
    const excerpt = sentence.includes(`$${amount}`) && sentence.includes(String(months)) ? sentence : credit[0];
    commitments.push({
      kind: "PROMO_CREDIT_SCHEDULE",
      label: "Monthly device promo credit",
      value: { type: "money", currency: "USD", amountCents: cents(amount) },
      cadence: "monthly",
      periodCount: months,
      conditions: [],
      effectiveStartText: /first eligible billing cycle/i.test(text) ? "first eligible billing cycle" : null,
      effectiveEndText: null,
      confidence: "high",
      evidence: ev(excerpt.length <= 400 ? excerpt : credit[0]),
      ambiguity: null,
    });
    commitments.push({
      kind: "DURATION_MONTHS",
      label: "Promotion length",
      value: { type: "integer", value: months, unit: "months" },
      cadence: null,
      periodCount: null,
      conditions: [],
      effectiveStartText: null,
      effectiveEndText: null,
      confidence: "high",
      evidence: ev(credit[0]),
      ambiguity: null,
    });
  }
  const plan = /(?:stay on|Requires|Choose) the (Premium Plus) plan|(Premium Plus) \(or any higher plan\)/i.exec(text);
  if (plan) {
    commitments.push({
      kind: "REQUIRED_PLAN",
      label: "Required plan",
      value: { type: "text", value: plan[1] ?? plan[2] },
      cadence: null,
      periodCount: null,
      conditions: ["or a higher plan"],
      effectiveStartText: null,
      effectiveEndText: null,
      confidence: "high",
      evidence: ev(plan[0]),
      ambiguity: null,
    });
  }
  const ret = /returned within (\d+) days of purchase/i.exec(text);
  if (ret) {
    commitments.push({
      kind: "RETURN_DEADLINE",
      label: "Return window",
      value: { type: "integer", value: Number(ret[1]), unit: "days" },
      cadence: null,
      periodCount: null,
      conditions: [],
      effectiveStartText: null,
      effectiveEndText: null,
      confidence: "high",
      evidence: ev(ret[0]),
      ambiguity: null,
    });
  }
  const isPage = /SYNTHETIC TEST PAGE/.test(text);
  const tx = dateIso(text);
  const marketplace = /Sold by: ([^\n]+third-party seller[^\n]*)/i.exec(text);
  const direct = /Sold by: (Brightline Wireless[^\n]*)/i.exec(text);
  const directOnly = /applies only to items sold by Brightline Wireless|purchased directly from Brightline Wireless|Only for devices bought directly from Brightline Wireless|purchases made directly from Brightline Wireless/i.exec(text);
  if (!isPage && commitments.length === 0 && !marketplace) return null;
  return {
    sourceClassification: isPage ? "FIRST_PARTY_PUBLIC_PAGE" : marketplace ? "TRANSACTION_RECEIPT" : "TRANSACTION_EMAIL",
    providerName: /Brightline Wireless/.test(text) ? "Brightline Wireless" : null,
    productOrPlanName: /Aurora X15/.test(text) ? "Aurora X15 device promotion" : null,
    transactionDateText: !isPage && tx ? tx.original : null,
    transactionDateIso: !isPage && tx ? tx.iso : null,
    transactionContext: marketplace
      ? { sellerType: "THIRD_PARTY_MARKETPLACE_SELLER", region: null, productIdentifier: null, evidence: ev(marketplace[0]) }
      : direct
        ? { sellerType: "PROVIDER_DIRECT", region: null, productIdentifier: null, evidence: ev(direct[0]) }
        : { sellerType: "UNKNOWN", region: null, productIdentifier: null, evidence: [] },
    policyScope: isPage && directOnly ? { appliesToSeller: "PROVIDER_DIRECT_ONLY", region: null, productScope: null, evidence: ev(directOnly[0]) } : { appliesToSeller: "NOT_STATED", region: null, productScope: null, evidence: [] },
    commitments,
    unknowns: [],
  };
}

export function parseBillFixture(text: string, scheduleKey: string | null): BillObservation {
  const isBill = /MONTHLY STATEMENT/.test(text);
  const lines: BillObservation["lineItems"] = [];
  for (const raw of text.split("\n")) {
    const m = /^(.+?)\s{2,}(-?\$\d[\d,]*\.\d{2})\s*$/.exec(raw);
    if (!m) continue;
    const label = m[1].trim();
    const inst = /\((\d+) of (\d+)\)/.exec(label);
    const isPromo = /^Device Promo Credit/i.test(label);
    const isAdj = /adjustment/i.test(label);
    lines.push({
      normalizedLabel: label.toLowerCase(),
      originalLabel: label,
      amountCents: cents(m[2]),
      currency: "USD",
      category: isPromo ? "PROMO_CREDIT" : isAdj ? "ONE_TIME_CREDIT" : /plan/i.test(label) ? "BASE_PLAN" : /installment/i.test(label) ? "DEVICE_PAYMENT" : /tax/i.test(label) ? "TAX" : /fee/i.test(label) ? "FEE" : "OTHER",
      installmentIndex: inst && !isAdj ? Number(inst[1]) : null,
      installmentCount: inst && !isAdj ? Number(inst[2]) : null,
      relatesToCommitmentKey: isPromo || isAdj ? scheduleKey : null,
      evidence: ev(raw.trim()),
      confidence: "high",
    });
  }
  const period = /Billing period: ([A-Za-z]+ \d{4})/.exec(text);
  const total = /Total due: (-?\$[\d,]+\.\d{2})/.exec(text);
  const plan = /^Plan: (.+)$/m.exec(text);
  const d = dateIso(text);
  return {
    isBillOrStatement: isBill,
    providerName: isBill ? "Brightline Wireless" : null,
    statementDateIso: d?.iso ?? null,
    servicePeriodStartIso: null,
    servicePeriodEndIso: null,
    statementMonthIso: period ? monthIso(period[1]) : null,
    planName: plan ? plan[1].trim() : null,
    itemized: isBill && lines.length > 0,
    lineItems: isBill ? lines : [],
    totalAmountCents: total ? cents(total[1]) : null,
    unknowns: [],
  };
}

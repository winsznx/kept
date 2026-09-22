import { formatCents } from "./money";

export type PacketFact = { id: string; label: string; text: string };

export type EvidencePacket = {
  version: number;
  provider: string | null;
  product: string | null;
  issueSummary: string;
  recorded: { commitmentLabel: string; amountCents: number; currency: string; periodCount: number; excerpt: string | null; sourceClass: string; capturedAt: number; transactionAt: number | null };
  expected: { periodIndex: number; statementMonth: string | null; amountCents: number };
  observed: { statementMonth: string | null; observedCents: number; deltaCents: number; reasonCode: string; excerpt: string | null };
  totals: { observedMissingCents: number; remainingScheduledCents: number };
  requiredPlan: string | null;
  unknowns: string[];
  requestedAction: string;
  facts: PacketFact[];
};

function monthName(ym: string | null): string | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function dateName(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function packetFacts(p: Omit<EvidencePacket, "facts">): PacketFact[] {
  const c = p.recorded.currency;
  const facts: PacketFact[] = [
    { id: "F_PROVIDER", label: "Provider", text: p.provider ?? "the provider" },
    { id: "F_RECORDED_AMOUNT", label: "Recorded monthly credit", text: formatCents(p.recorded.amountCents, c) },
    { id: "F_RECORDED_PERIODS", label: "Recorded number of months", text: String(p.recorded.periodCount) },
    { id: "F_PERIOD", label: "Disputed credit number", text: String(p.expected.periodIndex) },
    { id: "F_OBSERVED_AMOUNT", label: "Credit shown on the bill", text: formatCents(p.observed.observedCents, c) },
    { id: "F_DELTA", label: "Difference this bill", text: formatCents(Math.abs(p.observed.deltaCents), c) },
  ];
  const recordedDate = dateName(p.recorded.transactionAt ?? p.recorded.capturedAt);
  if (recordedDate) facts.push({ id: "F_RECORDED_DATE", label: "Offer recorded on", text: recordedDate });
  const billMonth = monthName(p.observed.statementMonth);
  if (billMonth) facts.push({ id: "F_BILL_MONTH", label: "Bill month", text: billMonth });
  if (p.product) facts.push({ id: "F_PRODUCT", label: "Plan or product", text: p.product });
  if (p.requiredPlan) facts.push({ id: "F_REQUIRED_PLAN", label: "Required plan", text: p.requiredPlan });
  return facts;
}

/** Deterministic fallback draft built only from packet facts (PRD §11.5: a reliable template must exist). */
export function templateDraft(p: EvidencePacket): { subject: string; body: string } {
  const f = Object.fromEntries(p.facts.map((x) => [x.id, x.text]));
  const recordedOn = f.F_RECORDED_DATE ? ` on ${f.F_RECORDED_DATE}` : "";
  const bill = f.F_BILL_MONTH ? `my ${f.F_BILL_MONTH} bill` : "my latest bill";
  const product = f.F_PRODUCT ? ` for ${f.F_PRODUCT}` : "";
  const plan = f.F_REQUIRED_PLAN ? ` I'm on the ${f.F_REQUIRED_PLAN} plan the offer requires.` : "";
  const subject = `Missing promotional credit on ${bill.replace(/^my /, "")}`;
  const body = [
    "Hello,",
    "",
    `When I signed up${recordedOn}, my offer${product} recorded a ${f.F_RECORDED_AMOUNT} monthly bill credit for ${f.F_RECORDED_PERIODS} months.${plan}`,
    "",
    `${bill.charAt(0).toUpperCase()}${bill.slice(1)} should include credit ${f.F_PERIOD} of ${f.F_RECORDED_PERIODS}, but it shows ${f.F_OBSERVED_AMOUNT} for that credit, a difference of ${f.F_DELTA}.`,
    "",
    "Could you check the promotion on my account and correct the missing credit, or let me know why it wasn't applied?",
    "",
    "Thanks.",
  ].join("\n");
  return { subject, body };
}

const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
const NUMBER_RE = /\b\d+(?:\.\d+)?\b/g;
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_RE = new RegExp(`\\b(?:${MONTHS})(?:\\s+\\d{1,2},)?\\s+\\d{4}\\b`, "g");
const BANNED_RE = /\b(fraud|illegal|breach|scam|lawsuit|attorney|lawyer|sue|entitled|owe[sd]?|regulator|FCC|FTC|attorney general|guarantee)\b/i;

/**
 * Checks that every amount, number, and date in a draft appears among packet facts,
 * and that no banned legal/threat language is present. Code decides; the model's
 * own claimsUsed list is advisory.
 */
export function validateDraft(text: string, p: EvidencePacket): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const allowed = p.facts.map((f) => f.text).join(" \n ");
  const allowedMoney = new Set((allowed.match(MONEY_RE) ?? []).map((m) => m.replace(/[\s,]/g, "")));
  for (const m of text.match(MONEY_RE) ?? []) {
    if (!allowedMoney.has(m.replace(/[\s,]/g, ""))) problems.push(`amount not in packet: ${m}`);
  }
  const allowedDates = new Set(allowed.match(DATE_RE) ?? []);
  for (const d of text.match(DATE_RE) ?? []) {
    if (!allowedDates.has(d) && !allowed.includes(d)) problems.push(`date not in packet: ${d}`);
  }
  const withoutMoneyAndDates = text.replace(MONEY_RE, " ").replace(DATE_RE, " ");
  const allowedNumbers = new Set([...(allowed.replace(MONEY_RE, " ").match(NUMBER_RE) ?? []), ...(allowed.match(DATE_RE) ?? []).flatMap((d) => d.match(NUMBER_RE) ?? [])]);
  for (const n of withoutMoneyAndDates.match(NUMBER_RE) ?? []) {
    if (!allowedNumbers.has(n)) problems.push(`number not in packet: ${n}`);
  }
  if (BANNED_RE.test(text)) problems.push("contains legal or threat language");
  if (/https?:\/\//i.test(text)) problems.push("contains a link");
  return { ok: problems.length === 0, problems };
}

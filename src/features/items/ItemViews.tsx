import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import type { api } from "../../../convex/_generated/api";
import { StatusBadge } from "../../components/StatusBadge";
import { dateOnly, dateTime, money, monthLabel } from "../../lib/format";

export type ItemView = FunctionReturnType<typeof api.items.getMine>;
type Capture = ItemView["captures"][number];

const SOURCE_LABEL: Record<string, string> = {
  TRANSACTION_EMAIL: "Signup email",
  TRANSACTION_RECEIPT: "Receipt",
  CONTRACT_OR_ORDER: "Order / contract",
  BILL_OR_STATEMENT: "Bill",
  FIRST_PARTY_PUBLIC_PAGE: "Provider web page",
  FIRST_PARTY_SUPPORT_REPLY: "Support reply",
  USER_ASSERTION: "Your note",
  SECONDARY_PUBLIC_PAGE: "Third-party web page",
  UNKNOWN_SOURCE: "Unclassified source",
};

export function sourceLabel(cls: string): string {
  return SOURCE_LABEL[cls] ?? cls;
}

export function scheduleCommitment(view: ItemView) {
  return view.commitments.find((c) => c.kind === "PROMO_CREDIT_SCHEDULE" && c.decisionEligibility === "AUTO_DETERMINISTIC") ?? null;
}

/** Headline numbers. Only values the reconciliation computed; never "owed". */
export function OutcomeSummary({ view }: { view: ItemView }) {
  const r = view.reconciliation;
  const sched = scheduleCommitment(view);
  const restored = view.verifications.filter((v) => v.result === "VERIFIED_FIXED").reduce((a, v) => a + v.verifiedRestoredCents, 0);
  const matched = view.findings.filter((f) => f.outcome === "MATCH").length;
  const cur = r?.currency ?? "USD";
  return (
    <section className="card stack" aria-labelledby="outcome-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="outcome-title" style={{ margin: 0 }}>
          {view.item.providerName ?? "Unnamed provider"} <span className="muted">· {view.item.productName ?? "Plan or promotion"}</span>
        </h2>
        <div className="row">
          <StatusBadge status={view.item.status} />
          {view.item.resolutionState !== "NONE" ? <StatusBadge status={view.item.resolutionState} /> : null}
        </div>
      </div>
      {sched ? (
        <p style={{ margin: 0 }}>
          Promised <strong>{money(sched.amountCents, sched.currency ?? "USD")} credit × {sched.periodCount} months</strong>
          {r?.latestObservedPeriod ? (
            <>
              {" "}
              · {matched} of {r.latestObservedPeriod} billed credits observed as recorded
            </>
          ) : null}
        </p>
      ) : null}
      {r ? (
        <div className="grid-2 small">
          <Stat label="Observed missing value" value={money(r.observedDifferenceCents, cur)} />
          <Stat label="Promised value remaining" value={money(r.remainingScheduledValueCents, cur)} />
          <Stat label="Verified restored value" value={restored > 0 ? money(restored, cur) : "—"} hint={restored > 0 ? "Seen on a later bill" : "Only counted once a later bill shows it"} />
          <Stat label="Periods" value={`${r.latestObservedPeriod ?? 0} / ${r.periodCount ?? "?"} billed`} hint={`Last check ${dateTime(r.completedAt)}`} />
        </div>
      ) : (
        <p className="muted small">No bills reconciled yet.</p>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value-lg">{value}</div>
      {hint ? <div className="muted small">{hint}</div> : null}
    </div>
  );
}

export function JobStatus({ view }: { view: ItemView }) {
  const job = view.jobs[0];
  if (!job) return null;
  if (job.status === "SUCCEEDED") return null;
  const running = job.status === "QUEUED" || job.status === "RUNNING";
  return (
    <div className={`alert ${running ? "tone-info" : job.status === "FAILED" ? "tone-bad" : "tone-warn"}`} role="status" aria-live="polite">
      {running ? (
        <>
          <strong>Building your promise record.</strong> {stepLabel(job.step)}…
        </>
      ) : (
        <>
          <strong>{job.status === "FAILED" ? "Processing stopped." : "Needs review."}</strong> {job.safeMessage}
        </>
      )}
    </div>
  );
}

function stepLabel(step: string): string {
  const m: Record<string, string> = {
    QUEUED: "Queued",
    ACQUIRING_SOURCE: "Getting the source",
    STORING_SOURCE: "Preserving the original",
    CLASSIFYING: "Working out what this is",
    EXTRACTING: "Reading the terms",
    VALIDATING_EVIDENCE: "Checking every term against the source text",
    NORMALIZING: "Normalizing terms",
    RECONCILING: "Comparing with your bills",
  };
  return m[step] ?? step;
}

export function Promises({ view }: { view: ItemView }) {
  const captureById = new Map(view.captures.map((c) => [c._id, c]));
  const shown = view.commitments.filter((c) => c.decisionEligibility !== "REJECTED");
  const rejected = view.commitments.length - shown.length;
  if (view.commitments.length === 0) return <p className="muted">No promises recorded yet.</p>;
  return (
    <div className="stack">
      {shown.map((c) => {
        const cap = captureById.get(c.sourceCaptureId);
        return (
          <article key={c._id} className="card stack" style={{ gap: 6 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{c.label}</strong>
              <StatusBadge status={c.decisionEligibility} />
            </div>
            <div>{commitmentValue(c)}</div>
            {c.evidence[0] ? (
              <blockquote className="excerpt small" style={{ margin: 0 }}>
                “{c.evidence[0].excerpt}”
                {c.evidence[0].bindingValidated ? null : <span className="field-error"> (not found in the source)</span>}
              </blockquote>
            ) : null}
            {cap ? (
              <div className="muted small">
                From {sourceLabel(cap.sourceClass)} · captured {dateOnly(cap.capturedAt)}
                {cap.sourceDomain ? ` · ${cap.sourceDomain}` : ""}
              </div>
            ) : null}
            {c.ambiguity ? <div className="small tone-warn alert">Unclear: {c.ambiguity}</div> : null}
          </article>
        );
      })}
      {rejected > 0 ? (
        <p className="muted small">
          {rejected} extracted {rejected === 1 ? "term was" : "terms were"} rejected because the quoted words couldn’t be found in the source.
        </p>
      ) : null}
    </div>
  );
}

function commitmentValue(c: ItemView["commitments"][number]): string {
  if (c.valueType === "MONEY") return `${money(c.amountCents, c.currency ?? "USD")}${c.cadence === "MONTHLY" ? " / month" : ""}${c.periodCount ? ` for ${c.periodCount} months` : ""}`;
  if (c.valueType === "INTEGER") return `${c.integerValue}${c.kind === "DURATION_MONTHS" ? " months" : c.kind === "RETURN_DEADLINE" ? " days" : ""}`;
  if (c.valueType === "DATE") return c.dateValue ? dateOnly(c.dateValue) : (c.textValue ?? "");
  return c.textValue ?? "";
}

/** 24-cell grid of expected credits, colored and labelled by observed status. */
export function ScheduleGrid({ view }: { view: ItemView }) {
  const events = view.expectedEvents;
  if (events.length === 0) return null;
  const covered = new Set(view.findings.filter((f) => f.outcome === "MATERIAL_DIFFERENCE" && !f.material).map((f) => f.periodIndex));
  const tone = (s: string, p: number | null) =>
    covered.has(p) ? "tone-warn" : s === "OBSERVED_MATCH" ? "tone-ok" : s === "OBSERVED_DIFFERENCE" ? "tone-bad" : s === "UNKNOWN" ? "tone-warn" : "tone-neutral";
  const word = (s: string, p: number | null) => (covered.has(p) ? "back-credited" : s === "OBSERVED_MATCH" ? "credit seen" : s === "OBSERVED_DIFFERENCE" ? "missing" : s === "UNKNOWN" ? "needs review" : "not billed yet");
  return (
    <section className="stack" aria-labelledby="sched-title">
      <h3 id="sched-title" style={{ margin: 0 }}>
        Expected credits
      </h3>
      <div className="periods" role="list">
        {events.map((e) => (
          <div key={e._id} role="listitem" className={tone(e.status, e.periodIndex)} title={`Credit ${e.periodIndex}: ${word(e.status, e.periodIndex)}`} aria-label={`Credit ${e.periodIndex}: ${word(e.status, e.periodIndex)}`}>
            {e.periodIndex}
            {e.status === "OBSERVED_DIFFERENCE" && !covered.has(e.periodIndex) ? "!" : ""}
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Green: credit seen as recorded. Red with !: bill shows no or a different credit. Amber: back-credited later or needs review. Grey: not billed yet, never counted as missing.
      </p>
    </section>
  );
}

export function LatestFindings({ view }: { view: ItemView }) {
  const material = view.findings.filter((f) => f.outcome !== "MATCH");
  const latestMatch = [...view.findings].reverse().find((f) => f.outcome === "MATCH");
  const rows = [...material, ...(latestMatch ? [latestMatch] : [])].sort((a, b) => (b.periodIndex ?? 0) - (a.periodIndex ?? 0)).slice(0, 4);
  if (rows.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="rec-title">
      <h3 id="rec-title" style={{ margin: 0 }}>
        Latest reconciliation
      </h3>
      <table className="responsive">
        <thead>
          <tr>
            <th>Credit</th>
            <th>Recorded</th>
            <th>On the bill</th>
            <th>Difference</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id}>
              <td data-label="Credit">#{f.periodIndex ?? "?"}</td>
              <td data-label="Recorded">{f.expectedDisplay}</td>
              <td data-label="On the bill">{f.observedDisplay}</td>
              <td data-label="Difference">{f.amountDeltaCents ? money(f.amountDeltaCents) : "—"}</td>
              <td data-label="Status">
                <StatusBadge status={f.material ? "MATERIAL_DIFFERENCE" : f.outcome === "MATERIAL_DIFFERENCE" ? "RESOLVED" : f.outcome} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows[0] ? <p className="small muted">{rows[0].explanation}</p> : null}
    </section>
  );
}

/** Then vs Now: the signature comparison of recorded promise and latest observation. */
export function ThenVsNow({ view }: { view: ItemView }) {
  const sched = scheduleCommitment(view);
  const plan = view.commitments.find((c) => c.kind === "REQUIRED_PLAN" && c.decisionEligibility === "AUTO_DETERMINISTIC");
  const latest = view.statements[view.statements.length - 1];
  const t0 = sched ? view.captures.find((c) => c._id === sched.sourceCaptureId) : undefined;
  const latestFinding = [...view.findings].sort((a, b) => (b.periodIndex ?? 0) - (a.periodIndex ?? 0))[0];
  if (!sched) return <p className="muted">Kept needs a source-backed recurring promise before it can compare.</p>;
  const creditLine = latest?.lines.find((l) => l.category === "PROMO_CREDIT" && l.matchesCommitment === "YES");
  const nowCredit = creditLine ? money(Math.abs(creditLine.amountCents ?? 0)) : latest ? "$0.00 (no credit line)" : "—";
  const creditChanged = latest ? !creditLine || Math.abs(creditLine.amountCents ?? 0) !== sched.amountCents : false;
  const planChanged = plan && latest?.planName ? latest.planName.toLowerCase() !== (plan.textValue ?? "").toLowerCase() : false;
  return (
    <section className="stack" aria-labelledby="tvn-title">
      <h2 id="tvn-title" style={{ margin: 0 }}>
        Then vs Now
      </h2>
      <table className="responsive">
        <thead>
          <tr>
            <th scope="col">Term</th>
            <th scope="col">Then: recorded {t0 ? dateOnly(t0.capturedAt) : ""}</th>
            <th scope="col">Now: {latest ? `bill for ${monthLabel(latest.statementMonth)}` : "no bill yet"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Monthly credit</th>
            <td data-label="Then">{money(sched.amountCents, sched.currency ?? "USD")} / month</td>
            <td data-label="Now" className={creditChanged ? "changed" : undefined}>
              {nowCredit}
              {creditChanged ? <span className="sr-only"> (changed)</span> : null}
            </td>
          </tr>
          <tr>
            <th scope="row">Duration</th>
            <td data-label="Then">{sched.periodCount} months</td>
            <td data-label="Now">{latestFinding?.periodIndex ? `Credit ${latestFinding.periodIndex} of ${sched.periodCount}` : "—"}</td>
          </tr>
          {plan ? (
            <tr>
              <th scope="row">Required plan</th>
              <td data-label="Then">{plan.textValue}</td>
              <td data-label="Now" className={planChanged ? "changed" : undefined}>
                {latest?.planName ?? "Not shown on the bill"}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="small muted">
        Changed terms are highlighted. Kept separates three things: the raw source changing, an extracted commercial term changing, and a bill
        changing. Only the last two can be a material difference.
      </p>
    </section>
  );
}

export function PageComparisons({ view }: { view: ItemView }) {
  if (view.pageComparisons.length === 0) return null;
  const cap = new Map(view.captures.map((c) => [c._id, c]));
  return (
    <section className="stack" aria-labelledby="page-title">
      <h3 id="page-title" style={{ margin: 0 }}>
        Offer page: first capture vs latest capture
      </h3>
      {view.pageComparisons.slice(0, 3).map((p) => (
        <article key={p._id} className="card stack" style={{ gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{p.outcome === "NO_MATERIAL_CHANGE" ? "The page changed. The deal didn’t." : p.outcome === "MATERIAL_CHANGE" ? "Material difference in the published terms" : "Can’t compare yet"}</strong>
            <StatusBadge status={p.outcome} />
          </div>
          <div className="small">
            Raw source changed: <strong>{p.rawSourceChanged ? "yes" : "no"}</strong> · Commercial terms changed: <strong>{p.materialCommercialChange ? "yes" : "no"}</strong>
          </div>
          <table className="responsive small">
            <thead>
              <tr>
                <th>Term</th>
                <th>First capture</th>
                <th>Latest capture</th>
              </tr>
            </thead>
            <tbody>
              {p.diffs.map((d) => (
                <tr key={d.key}>
                  <td data-label="Term">{d.label}</td>
                  <td data-label="First">{d.before ?? "—"}</td>
                  <td data-label="Latest" className={d.material ? "changed" : undefined}>
                    {d.after ?? "not on page"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="muted small mono">
            {[p.t0CaptureId, p.tnCaptureId].map((id, i) => {
              const c = cap.get(id);
              return c ? <div key={id}>{i === 0 ? "T0" : "Tn"} {dateTime(c.capturedAt)} · sha256 {c.contentSha256.slice(0, 16)}…</div> : null;
            })}
          </div>
        </article>
      ))}
    </section>
  );
}

export function Applicability({ view }: { view: ItemView }) {
  if (view.applicability.length === 0) return null;
  const a = view.applicability[0];
  return (
    <section className="card stack" aria-labelledby="app-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 id="app-title" style={{ margin: 0 }}>
          {a.outcome === "NOT_ESTABLISHED" ? "Kept can’t establish this yet" : "Policy applicability"}
        </h3>
        <StatusBadge status={a.outcome} />
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {a.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {a.outcome === "NOT_ESTABLISHED" ? <p className="small muted" style={{ margin: 0 }}>Add the seller’s own policy or order terms to go further. Kept won’t apply a policy that may not cover your purchase.</p> : null}
    </section>
  );
}

export function SourceList({ view, loadText }: { view: ItemView; loadText?: (id: Capture["_id"]) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="stack" aria-labelledby="src-title">
      <h3 id="src-title" style={{ margin: 0 }}>
        Sources ({view.captures.length})
      </h3>
      <p className="muted small" style={{ margin: 0 }}>
        Every capture is stored unchanged. A refreshed page is a new capture, never an edit.
      </p>
      <ul className="stack" style={{ listStyle: "none", padding: 0, gap: 6 }}>
        {[...view.captures].reverse().map((c) => (
          <li key={c._id} className="card" style={{ padding: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>
                <strong>{sourceLabel(c.sourceClass)}</strong>
                {c.title ? <span className="muted"> · {c.title}</span> : null}
              </span>
              <StatusBadge status={c.parseStatus === "PARSED" ? "SUCCEEDED" : c.parseStatus === "PENDING" ? "RUNNING" : c.parseStatus} />
            </div>
            <div className="muted small">
              Captured {dateTime(c.capturedAt)}
              {c.sourceUri ? (
                <>
                  {" · "}
                  <a href={c.sourceUri} target="_blank" rel="noopener noreferrer nofollow">
                    {c.sourceDomain}
                  </a>
                </>
              ) : null}
              {c.previousCaptureId ? " · refresh of an earlier capture" : ""}
            </div>
            <div className="muted small mono">sha256 {c.contentSha256.slice(0, 24)}…{c.modelId ? ` · read by ${c.modelId}` : ""}</div>
            {c.parseFailureCode ? <div className="small field-error">{c.parseFailureCode.replace(/_/g, " ").toLowerCase()}</div> : null}
            {loadText && c.hasText ? (
              <button
                type="button"
                className="btn"
                style={{ marginTop: 6, minHeight: 32 }}
                aria-expanded={open === c._id}
                onClick={() => {
                  setOpen(open === c._id ? null : c._id);
                  if (open !== c._id) loadText(c._id);
                }}
              >
                {open === c._id ? "Hide source text" : "Show source text"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Timeline({ view, caseEvents }: { view: ItemView; caseEvents?: { _id: string; type: string; summary: string; createdAt: number }[] }) {
  type Row = { id: string; at: number; title: string; detail: string };
  const rows: Row[] = [
    ...view.captures.map((c) => ({ id: c._id, at: c.capturedAt, title: `${sourceLabel(c.sourceClass)} captured`, detail: c.sourceDomain ?? `sha256 ${c.contentSha256.slice(0, 12)}…` })),
    ...view.reconciliationHistory.map((r) => ({ id: r._id, at: r.startedAt, title: `Reconciled: ${(r.overallOutcome ?? "no schedule").replace(/_/g, " ").toLowerCase()}`, detail: r.latestObservedPeriod ? `through credit ${r.latestObservedPeriod}` : "" })),
    ...(caseEvents ?? []).map((e) => ({ id: e._id, at: e.createdAt, title: `Case: ${e.type.replace(/_/g, " ").toLowerCase()}`, detail: e.summary })),
  ].sort((a, b) => b.at - a.at);
  return (
    <ol className="stack" style={{ listStyle: "none", padding: 0, gap: 8 }} aria-label="Timeline">
      {rows.slice(0, 60).map((r) => (
        <li key={r.id} className="card" style={{ padding: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{r.title}</strong>
            <span className="muted small">{dateTime(r.at)}</span>
          </div>
          {r.detail ? <div className="small muted">{r.detail}</div> : null}
        </li>
      ))}
    </ol>
  );
}

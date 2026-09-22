import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import type { api } from "../../../convex/_generated/api";
import { Icon } from "../../components/Icon";
import { StatusBadge } from "../../components/StatusBadge";
import { dateTime, money, monthLabel } from "../../lib/format";

export type CaseViewData = NonNullable<FunctionReturnType<typeof api.cases.getMine>>;

const ASSESSMENT: Record<string, string> = {
  SUPPORTED_BY_CAPTURED_EVIDENCE: "Supported by captured evidence",
  CONTRADICTED_BY_CAPTURED_EVIDENCE: "Contradicted by captured evidence",
  NOT_ESTABLISHED: "Not established by captured evidence",
  NEW_EVIDENCE_REQUIRED: "Needs new evidence",
};

export function EvidencePacket({ data }: { data: CaseViewData }) {
  const p = data.packet;
  if (!p) return null;
  const c = p.recorded.currency;
  return (
    <section className="card stack" aria-labelledby="packet-title">
      <h2 id="packet-title" className="section-title">
        <Icon name="evidence" size={18} /> Evidence packet <span className="muted small">v{p.version}</span>
      </h2>
      <p style={{ margin: 0 }}>{p.issueSummary}</p>
      <div className="grid-2">
        <div className="stack" style={{ gap: 4 }}>
          <div className="label">Recorded promise</div>
          <div>
            {money(p.recorded.amountCents, c)} / month × {p.recorded.periodCount}
          </div>
          {p.recorded.excerpt ? <blockquote className="excerpt small" style={{ margin: 0 }}>“{p.recorded.excerpt}”</blockquote> : null}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <div className="label">
            Observed on {p.observed.statementMonth ? `the ${monthLabel(p.observed.statementMonth)} bill` : "the latest bill"} (credit {p.expected.periodIndex})
          </div>
          <div>
            {money(p.observed.observedCents, c)} · difference {money(p.observed.deltaCents, c)}
          </div>
          <div className="small muted">{p.observed.excerpt ? `“${p.observed.excerpt}”` : "No promotional credit line on this bill."}</div>
        </div>
      </div>
      <div className="small">
        Computed by Kept’s deterministic reconciler: outstanding missing {money(p.totals.observedMissingCents, c)}, promised value remaining {money(p.totals.remainingScheduledCents, c)}.
      </div>
      {p.unknowns.length ? (
        <div className="small">
          <div className="label">What Kept doesn’t know</div>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {p.unknowns.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {data.packetSha256 ? <div className="muted small mono">packet sha256 {data.packetSha256.slice(0, 24)}…</div> : null}
    </section>
  );
}

export function ResolutionBanner({ data }: { data: CaseViewData }) {
  const s = data.case.resolutionState;
  const verified = data.verifications.filter((v) => v.result === "VERIFIED_FIXED");
  if (s === "NONE") return null;
  if (s === "VERIFIED_FIXED")
    return (
      <div className="alert tone-ok" role="status">
        <Icon name="verify" size={18} />
        <span>
        <strong>Kept verified the fix.</strong> A later bill shows the recorded credit. Verified restored value: {money(verified.reduce((a, v) => a + v.verifiedRestoredCents, 0))}.
        </span>
      </div>
    );
  if (s === "STILL_MISMATCHED")
    return (
      <div className="alert tone-bad" role="status">
        <Icon name="detect" size={18} />
        <span>
          <strong>Still mismatched.</strong> The provider said it was fixed, but the next bill still doesn’t show the recorded credit.
        </span>
      </div>
    );
  return (
    <div className="alert tone-warn" role="status">
      <Icon name="watch" size={18} />
      <span>
        <strong>The provider says it’s fixed. Kept hasn’t verified it.</strong> A support reply isn’t proof that your next bill is correct. Kept is waiting for the next bill.
      </span>
    </div>
  );
}

export function Correspondence({ data }: { data: CaseViewData }) {
  return (
    <section className="stack" aria-labelledby="thread-title">
      <h2 id="thread-title" className="section-title">
        <Icon name="email" size={18} /> Correspondence
      </h2>
      {data.replies.length === 0 ? <p className="muted">No replies yet.</p> : null}
      {data.replies.map((r) => (
        <article key={r.id} className="card stack" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{r.subject ?? "Reply"}</strong>
            <span className="muted small">
              {r.fromDomain ?? "unknown sender"} · {dateTime(r.receivedAt)}
            </span>
          </div>
          <div className="small" style={{ whiteSpace: "pre-wrap" }}>
            {r.text}
          </div>
        </article>
      ))}
      {data.assertions.length ? (
        <div className="stack" style={{ gap: 6 }}>
          <div className="label">What the provider claims (claims, not verified facts)</div>
          {data.assertions.map((a) => (
            <div key={a._id} className="card small stack" style={{ gap: 4 }}>
              <div>
                <strong>{a.assertionType.replace(/_/g, " ").toLowerCase()}</strong>: {a.assertion}
              </div>
              <blockquote className="excerpt" style={{ margin: 0 }}>
                “{a.excerpt}”{a.bindingValidated ? "" : " (quote not found in the reply)"}
              </blockquote>
              <div className="muted">{ASSESSMENT[a.assessment] ?? a.assessment}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CaseEvents({ data }: { data: CaseViewData }) {
  return (
    <ol className="stack" style={{ listStyle: "none", padding: 0, gap: 6 }} aria-label="Case timeline">
      {data.events.map((e) => (
        <li key={e._id} className="small">
          <span className="muted">{dateTime(e.createdAt)}</span> · <strong>{e.type.replace(/_/g, " ").toLowerCase()}</strong> · {e.summary}
        </li>
      ))}
    </ol>
  );
}

export function CaseHeader({ data, children }: { data: CaseViewData; children?: ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <h1 style={{ margin: 0 }}>Case: {data.item?.providerName ?? "Provider"}</h1>
      <div className="row">
        <StatusBadge status={data.case.status} />
        {data.case.resolutionState !== "NONE" ? <StatusBadge status={data.case.resolutionState} /> : null}
        {children}
      </div>
    </div>
  );
}

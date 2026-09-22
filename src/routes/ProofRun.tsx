import { useQuery } from "convex/react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon } from "../components/Icon";
import { dateTime } from "../lib/format";

export default function ProofRun() {
  const { runId } = useParams();
  const run = useQuery(api.proof.getRun, { slug: runId ?? "" });
  if (run === undefined)
    return (
      <div className="loading-block" role="status">
        <span className="spinner" /> Loading…
      </div>
    );
  if (run === null)
    return (
      <div className="container page">
        <p>
          No run with that id. <Link to="/proof">All runs</Link>
        </p>
      </div>
    );
  const payload = JSON.parse(run.payloadJson) as Payload;
  return (
    <div className="container page stack">
      <Link to="/proof" className="small muted">
        ← All runs
      </Link>
      <h1 style={{ fontSize: 36, letterSpacing: "-0.03em", maxWidth: "24ch" }}>{run.title}</h1>
      <div className="row small">
        <span className={`badge ${run.kind === "LIVE" ? "tone-ok" : "tone-neutral"}`}>{run.kind}</span>
        <span>Recorded {dateTime(run.createdAt)}</span>
        {run.commitSha ? (
          <a href={`https://github.com/winsznx/kept/commit/${run.commitSha}`} className="mono">
            commit {run.commitSha}
          </a>
        ) : null}
      </div>
      <p className="small muted mono">payload sha256 {run.payloadSha256}</p>
      <RunSummary payload={payload} />
      <p className="small">This is the persisted record exactly as stored in Convex. It contains metadata and hashes only; source text, message bodies and addresses are never published.</p>
      <pre className="card small mono" style={{ overflow: "auto", maxHeight: 680, background: "var(--surface)", whiteSpace: "pre" }}>
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

type Payload = {
  type?: string;
  item?: { status: string; resolutionState: string };
  commitments?: { kind: string; amountCents: number | null; periodCount: number | null; textValue: string | null; evidenceBinding: string; decisionEligibility: string; excerpt: string | null }[];
  statements?: { statementMonth: string | null; creditLines: { label: string; amountCents: number | null; matchesCommitment: string }[] }[];
  caseEvents?: { at: number; type: string; summary: string }[];
  providerClaims?: { type: string; excerpt: string; assessment: string }[];
  verifications?: { result: string; verifiedRestoredCents: number }[];
  sponsorCalls?: { provider: string; operation: string; status: string }[];
  captures?: { domain: string | null; sourceClass: string; contentSha256: string; capturedAt: number; previousCaptureId: string | null }[];
};

const usd = (c: number | null | undefined) => (c === null || c === undefined ? "—" : `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toFixed(2)}`);

function RunSummary({ payload: p }: { payload: Payload }) {
  if (p.type === "FIRECRAWL_CAPTURE" && p.captures) {
    return (
      <div className="grid-2">
        {p.captures.map((c, i) => (
          <div key={c.contentSha256 + i} className="card stack" style={{ gap: 6 }}>
            <span className="label">{i === 0 ? "T0 capture" : `Tn capture ${i}`}</span>
            <strong>{c.domain}</strong>
            <span className="small muted">{c.sourceClass.replace(/_/g, " ").toLowerCase()} · {dateTime(c.capturedAt)}</span>
            <span className="small mono">sha256 {c.contentSha256.slice(0, 20)}…</span>
            {c.previousCaptureId ? <span className="small muted">Linked to the earlier capture; nothing overwritten.</span> : null}
          </div>
        ))}
      </div>
    );
  }
  if (p.type !== "LIVE_LOOP") return null;
  const credit = p.commitments?.find((c) => c.kind === "PROMO_CREDIT_SCHEDULE");
  const final = p.verifications?.[p.verifications.length - 1];
  const calls = (p.sponsorCalls ?? []).reduce<Record<string, number>>((acc, c) => ((acc[c.provider] = (acc[c.provider] ?? 0) + 1), acc), {});
  return (
    <div className="stack-lg">
      <div className="grid-2">
        <div className="card stack" style={{ gap: 4 }}>
          <span className="label">Recorded promise (OpenAI, source-bound)</span>
          <span className="value-lg">{credit ? `${usd(credit.amountCents)} × ${credit.periodCount}` : "—"}</span>
          {credit?.excerpt ? <blockquote className="excerpt">“{credit.excerpt}”</blockquote> : null}
        </div>
        <div className="card stack" style={{ gap: 4 }}>
          <span className="label">Final state</span>
          <div className="row">
            <span className="badge tone-ok">{p.item?.resolutionState.replace(/_/g, " ")}</span>
            <span className="badge tone-ok">{p.item?.status}</span>
          </div>
          <span className="value-lg" style={{ color: "var(--success)" }}>
            {usd(final?.verifiedRestoredCents)} verified restored
          </span>
          <span className="small muted">Counted only after bill 23 was reconciled.</span>
        </div>
      </div>
      <div className="card stack">
        <h2 className="section-title">
          <Icon name="evidence" size={18} /> Bills reconciled
        </h2>
        <table className="responsive">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Promo credit lines</th>
            </tr>
          </thead>
          <tbody>
            {(p.statements ?? []).map((st) => (
              <tr key={st.statementMonth ?? "unknown"}>
                <td data-label="Bill">{st.statementMonth}</td>
                <td data-label="Credit lines" className={st.creditLines.length === 0 ? "changed" : undefined}>
                  {st.creditLines.length === 0 ? "No promotional credit (missing)" : st.creditLines.map((l) => `${l.label} ${usd(l.amountCents)}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card stack">
        <h2 className="section-title">
          <Icon name="watch" size={18} /> Case timeline
        </h2>
        <ol className="stack" style={{ listStyle: "none", padding: 0, gap: 8 }}>
          {(p.caseEvents ?? []).map((e) => (
            <li key={e.at + e.type} className="row" style={{ alignItems: "baseline", flexWrap: "nowrap", gap: 12 }}>
              <span className={`badge ${e.type === "VERIFIED_FIXED" || e.type === "RESOLVED" ? "tone-ok" : e.type.includes("PROVIDER") || e.type.includes("WAITING") || e.type.includes("INSUFFICIENT") ? "tone-warn" : "tone-neutral"}`}>{e.type.replace(/_/g, " ")}</span>
              <span className="small muted">{e.summary}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="card row" style={{ gap: 18 }}>
        <span className="label">Sponsor calls in this run</span>
        {Object.entries(calls).map(([k, n]) => (
          <span key={k} className="badge tone-info">
            {k} × {n}
          </span>
        ))}
        <span className="badge tone-info">CONVEX · state, webhook, realtime</span>
      </div>
    </div>
  );
}

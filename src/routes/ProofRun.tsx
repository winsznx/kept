import { useQuery } from "convex/react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
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
  const payload = JSON.parse(run.payloadJson) as unknown;
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
      <p className="small">This is the persisted record exactly as stored in Convex. It contains metadata and hashes only; source text, message bodies and addresses are never published.</p>
      <pre className="card small mono" style={{ overflow: "auto", maxHeight: 680, background: "var(--surface)", whiteSpace: "pre" }}>
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

import { useQuery } from "convex/react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { dateTime } from "../lib/format";

export default function ProofRun() {
  const { runId } = useParams();
  const run = useQuery(api.proof.getRun, { slug: runId ?? "" });
  if (run === undefined) return <p role="status">Loading…</p>;
  if (run === null)
    return (
      <p>
        No run with that id. <Link to="/proof">All runs</Link>
      </p>
    );
  const payload = JSON.parse(run.payloadJson) as unknown;
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <Link to="/proof" className="small">
        ← All runs
      </Link>
      <h1>{run.title}</h1>
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
      <pre className="excerpt small" style={{ overflow: "auto", maxHeight: 640 }}>
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

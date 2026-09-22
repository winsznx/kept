import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { dateTime } from "../lib/format";

const REPO = "https://github.com/winsznx/kept";

export default function Proof() {
  const runs = useQuery(api.proof.listRuns);
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
      <h1>Proof</h1>
      <p>
        Supporting evidence for reviewers. The product is the <Link to="/demo">demo</Link> and the signed-in app; this page lists persisted, sanitized run records so you don’t have to trust
        narration or screenshots.
      </p>
      <section className="stack">
        <h2 style={{ margin: 0 }}>Inspectable runs</h2>
        {runs === undefined ? <p role="status">Loading…</p> : null}
        {runs?.length === 0 ? <p className="muted">No runs recorded yet.</p> : null}
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {runs?.map((r) => (
            <li key={r.slug} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Link to={`/proof/run/${r.slug}`}>{r.title}</Link>
                <span className={`badge ${r.kind === "LIVE" ? "tone-ok" : "tone-neutral"}`}>{r.kind}</span>
              </div>
              <div className="muted small mono">
                {dateTime(r.createdAt)} · payload sha256 {r.payloadSha256.slice(0, 16)}…
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="stack">
        <h2 style={{ margin: 0 }}>What’s measured and where</h2>
        <ul>
          <li>
            Deterministic reconciliation, evidence binding, verified-fix logic and guards: unit and Convex tests in <a href={`${REPO}/tree/main/tests`}>tests/</a>.
          </li>
          <li>
            Evaluation methodology, registered before any campaign ran: <a href={`${REPO}/blob/main/docs/EVALUATION.md`}>docs/EVALUATION.md</a>.
          </li>
          <li>
            Build log: <a href={`${REPO}/blob/main/hackathon.md`}>hackathon.md</a>.
          </li>
        </ul>
        <p className="small muted">Campaign results appear here only after they’ve been run and written to the repo’s evidence folder.</p>
      </section>
    </div>
  );
}

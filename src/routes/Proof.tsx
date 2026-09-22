import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon } from "../components/Icon";
import { dateTime } from "../lib/format";

const REPO = "https://github.com/winsznx/kept";

export default function Proof() {
  const runs = useQuery(api.proof.listRuns);
  return (
    <div className="container page stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow">
          <Icon name="verify" size={15} /> Proof
        </span>
        <h1>Don’t trust the narration. Inspect the runs.</h1>
        <p>
          Persisted, sanitized records of real runs, straight from Convex. The product itself is the <Link to="/demo" style={{ textDecoration: "underline" }}>demo</Link> and the signed-in app.
        </p>
      </div>
      <section className="stack">
        <h2 className="section-title">
          <Icon name="record" size={18} /> Inspectable runs
        </h2>
        {runs === undefined ? <p role="status">Loading…</p> : null}
        {runs?.length === 0 ? <p className="muted">No runs recorded yet.</p> : null}
        <ul className="item-list">
          {runs?.map((r) => (
            <li key={r.slug}>
              <Link to={`/proof/run/${r.slug}`} className="item-row" style={{ gridTemplateColumns: "44px minmax(0,1fr) auto" }}>
                <span className="icon-tile is-ok">
                  <Icon name="verify" size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <h3>{r.title}</h3>
                  <div className="meta mono">
                    {dateTime(r.createdAt)} · payload sha256 {r.payloadSha256.slice(0, 16)}…
                  </div>
                </div>
                <span className="row">
                  <span className={`badge ${r.kind === "LIVE" ? "tone-ok" : "tone-neutral"}`}>{r.kind}</span>
                  <Icon name="chevronRight" size={18} className="faint" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="stack">
        <h2 className="section-title">
          <Icon name="evidence" size={18} /> What’s measured and where
        </h2>
        <ul className="prose" style={{ paddingLeft: 20 }}>
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

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AddEvidence } from "../features/protect/AddEvidence";
import { Applicability, JobStatus, LatestFindings, OutcomeSummary, PageComparisons, Promises, ScheduleGrid } from "../features/items/ItemViews";

export default function ItemDetail() {
  const { itemId } = useParams();
  const id = itemId as Id<"protectedItems">;
  const view = useQuery(api.items.getMine, { itemId: id });
  const createCase = useMutation(api.cases.create);
  const remove = useMutation(api.protectedItems.remove);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (view === undefined) return <p role="status">Loading…</p>;
  const openCase = view.cases.find((c) => c.status !== "CLOSED" && c.status !== "RESOLVED");

  return (
    <div className="stack" style={{ gap: 20 }}>
      <nav className="row small" aria-label="Item sections">
        <Link to="/app">← My plans</Link>
        <Link to={`/app/items/${id}/evidence`}>Then vs Now</Link>
        <Link to={`/app/items/${id}/timeline`}>Timeline</Link>
      </nav>
      <JobStatus view={view} />
      <OutcomeSummary view={view} />
      <div className="row">
        <Link className="btn" to={`/app/items/${id}/evidence`}>
          Then vs Now
        </Link>
        {openCase ? (
          <Link className="btn btn-primary" to={`/app/cases/${openCase._id}`}>
            Open case
          </Link>
        ) : view.item.status === "MATERIAL_DIFFERENCE" ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              createCase({ itemId: id })
                .then((caseId) => navigate(`/app/cases/${caseId}`))
                .catch(() => setError("Kept couldn’t build a case from this evidence."))
            }
          >
            Open an evidence-backed case
          </button>
        ) : null}
      </div>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      <ScheduleGrid view={view} />
      <LatestFindings view={view} />
      <PageComparisons view={view} />
      <Applicability view={view} />
      <section className="stack">
        <h2 style={{ margin: 0 }}>Promises</h2>
        <Promises view={view} />
      </section>
      <AddEvidence itemId={id} routingToken={view.item.routingToken} />
      <details>
        <summary>Delete this item</summary>
        <p className="small">Deletes its sources, files, extracted terms, bills, and cases from Kept. Copies held by third-party services follow their own retention.</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (window.confirm("Delete this protected item and all its evidence?")) void remove({ itemId: id }).then(() => navigate("/app"));
          }}
        >
          Delete item
        </button>
      </details>
    </div>
  );
}

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { StatusBadge } from "../components/StatusBadge";
import { dateTime, money } from "../lib/format";

export default function AppHome() {
  const me = useQuery(api.workspaces.me);
  const ensureMine = useMutation(api.workspaces.ensureMine);
  const hasWorkspace = Boolean(me?.workspaceId);

  // Onboarding is a server-side side effect of first arrival, not derived state.
  useEffect(() => {
    if (me && !me.workspaceId) void ensureMine();
  }, [me, ensureMine]);

  const items = useQuery(api.protectedItems.listMine, hasWorkspace ? {} : "skip");

  if (me === undefined || (hasWorkspace && items === undefined)) return <p role="status">Loading your plans…</p>;
  if (!hasWorkspace) return <p role="status">Setting up your Kept workspace…</p>;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>My protected plans</h1>
        <Link to="/app/protect" className="btn btn-primary">
          Protect a plan
        </Link>
      </div>
      {items && items.length === 0 ? (
        <section className="card card-muted stack">
          <h2>Protect your first plan</h2>
          <p>
            Add the confirmation email, receipt, or offer page you received when you signed up. Kept will turn the promises into a timeline
            you can check later.
          </p>
          <div>
            <Link to="/app/protect" className="btn btn-primary">
              Start
            </Link>
          </div>
        </section>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
          {items?.map((item) => {
            const r = item.reconciliation;
            return (
              <li key={item._id} className="card stack">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{item.providerName ?? "Unnamed provider"}</strong>
                    <span className="muted"> · {item.productName ?? "Plan or promotion"}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {r ? (
                  <div className="grid-2 small">
                    <div>
                      <div className="label">Observed missing value</div>
                      {money(r.observedDifferenceCents, r.currency ?? "USD")}
                    </div>
                    <div>
                      <div className="label">Promised value remaining</div>
                      {money(r.remainingScheduledValueCents, r.currency ?? "USD")}
                    </div>
                    <div>
                      <div className="label">Progress</div>
                      {r.latestObservedPeriod ?? 0} / {r.periodCount ?? "?"} periods observed
                    </div>
                    <div>
                      <div className="label">Last check</div>
                      {dateTime(r.completedAt)}
                    </div>
                  </div>
                ) : (
                  <p className="muted small">No evidence reconciled yet.</p>
                )}
                {item.resolutionState !== "NONE" ? (
                  <div>
                    <StatusBadge status={item.resolutionState} />
                  </div>
                ) : null}
                <div>
                  <Link to={`/app/items/${item._id}`} className="btn">
                    {item.status === "MATERIAL_DIFFERENCE" ? "Review evidence" : "Open"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

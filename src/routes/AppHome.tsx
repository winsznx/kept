import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/Layouts";
import { StatusBadge } from "../components/StatusBadge";
import { dateTime, money } from "../lib/format";

const ITEM_ICON: Record<string, "detect" | "email" | "record" | "verify" | "watch"> = {
  MATERIAL_DIFFERENCE: "detect",
  CASE_OPEN: "email",
  PROTECTED: "verify",
  CAPTURING: "watch",
};
const ITEM_TONE: Record<string, string> = { MATERIAL_DIFFERENCE: "is-bad", CASE_OPEN: "is-soft", PROTECTED: "is-ok", NEEDS_REVIEW: "is-warn", FAILED: "is-bad" };

export default function AppHome() {
  const me = useQuery(api.workspaces.me);
  const ensureMine = useMutation(api.workspaces.ensureMine);
  const hasWorkspace = Boolean(me?.workspaceId);

  // Onboarding is a server-side side effect of first arrival, not derived state.
  useEffect(() => {
    if (me && !me.workspaceId) void ensureMine();
  }, [me, ensureMine]);

  const items = useQuery(api.protectedItems.listMine, hasWorkspace ? {} : "skip");
  const loading = me === undefined || (hasWorkspace && items === undefined);

  const attention = (items ?? []).filter((i) => i.status === "MATERIAL_DIFFERENCE" || i.status === "NEEDS_REVIEW").length;
  const openCases = (items ?? []).filter((i) => i.status === "CASE_OPEN").length;
  const missing = (items ?? []).reduce((a, i) => a + (i.reconciliation?.observedDifferenceCents ?? 0), 0);
  const remaining = (items ?? []).reduce((a, i) => a + (i.reconciliation?.remainingScheduledValueCents ?? 0), 0);

  return (
    <>
      <TopBar
        crumbs={[{ label: "Kept", to: "/app" }, { label: "My plans" }]}
        actions={
          <Link to="/app/protect" className="btn btn-primary btn-sm">
            <Icon name="plus" size={15} /> Protect a plan
          </Link>
        }
      />
      <div className="app-content">
        <div className="page-title">
          <div>
            <h1>My protected plans</h1>
            <p>Every promise Kept is holding for you, ordered by what needs attention first.</p>
          </div>
        </div>

        {loading || !hasWorkspace ? (
          <div className="loading-block" role="status">
            <span className="spinner" /> {hasWorkspace ? "Loading your plans…" : "Setting up your Kept workspace…"}
          </div>
        ) : (
          <>
            {items!.length > 0 ? (
            <div className="stat-tiles">
              <Stat icon="record" label="Protected plans" value={String(items!.length)} foot="Recorded promises" />
              <Stat icon="detect" label="Needs attention" value={String(attention)} foot="Material difference or review" tone={attention ? "is-bad" : undefined} />
              <Stat icon="email" label="Open cases" value={String(openCases)} foot="Waiting on the provider" />
              <Stat icon="watch" label="Observed missing" value={money(missing)} foot={`Promised remaining ${money(remaining)}`} />
            </div>
            ) : null}

            {items!.length === 0 ? (
              <section className="panel stack-lg">
                <div className="stack" style={{ gap: 8, maxWidth: 620 }}>
                  <span className="eyebrow">
                    <Icon name="record" size={15} /> First run
                  </span>
                  <h2 style={{ fontSize: 26 }}>Protect your first plan</h2>
                  <p className="muted">
                    Add the confirmation email, receipt, or offer page you got when you signed up. Kept records what was promised, then checks every later bill against it and tells you the moment
                    delivery drifts.
                  </p>
                </div>
                <div className="grid-2">
                  {(
                    [
                      ["email", "Forward it", "Send the signup email to your Kept inbox, if your account has one."],
                      ["upload", "Upload or paste", "A PDF, an image, or the text of the email. Same pipeline, no inbox needed."],
                      ["globe", "Paste the offer page", "Kept captures the public page and keeps that snapshot for later comparison."],
                    ] as const
                  ).map(([icon, title, body]) => (
                    <div key={title} className="card row" style={{ alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
                      <span className="icon-tile is-soft">
                        <Icon name={icon} size={19} />
                      </span>
                      <div>
                        <strong>{title}</strong>
                        <p className="small muted">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row">
                  <Link to="/app/protect" className="btn btn-primary btn-lg">
                    <Icon name="plus" size={16} /> Protect a plan
                  </Link>
                  <Link to="/demo" className="btn btn-lg">
                    <Icon name="play" size={16} /> See a finished example first
                  </Link>
                </div>
              </section>
            ) : (
              <ul className="item-list">
                {items!.map((item) => {
                  const r = item.reconciliation;
                  return (
                    <li key={item._id}>
                      <Link to={`/app/items/${item._id}`} className="item-row" aria-label={`${item.providerName ?? "Plan"}: ${item.status.replace(/_/g, " ").toLowerCase()}`}>
                        <span className={`icon-tile ${ITEM_TONE[item.status] ?? "is-soft"}`}>
                          <Icon name={ITEM_ICON[item.status] ?? "record"} size={20} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <h3>{item.providerName ?? "Unnamed provider"}</h3>
                          <div className="meta">
                            {item.productName ?? "Plan or promotion"}
                            {r?.completedAt ? ` · checked ${dateTime(r.completedAt)}` : ""}
                          </div>
                        </div>
                        <div className="kv">
                          <span>Observed missing</span>
                          <strong>{r ? money(r.observedDifferenceCents, r.currency ?? "USD") : "—"}</strong>
                        </div>
                        <div className="kv">
                          <span>Progress</span>
                          <strong>{r ? `${r.latestObservedPeriod ?? 0} / ${r.periodCount ?? "?"}` : "—"}</strong>
                        </div>
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <StatusBadge status={item.status} />
                          {item.resolutionState !== "NONE" ? <StatusBadge status={item.resolutionState} /> : null}
                          <Icon name="chevronRight" size={18} className="faint" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ icon, label, value, foot, tone }: { icon: "record" | "detect" | "email" | "watch"; label: string; value: string; foot: string; tone?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-top">
        <span className={`icon-tile ${tone ?? ""}`} style={tone ? undefined : { color: "var(--ink)" }}>
          <Icon name={icon} size={19} />
        </span>
        <div>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      </div>
      <div className="stat-tile-foot">{foot}</div>
    </div>
  );
}

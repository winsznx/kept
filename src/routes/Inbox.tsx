import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/Layouts";
import { StatusBadge } from "../components/StatusBadge";
import { dateTime } from "../lib/format";

const GROUPS = [
  ["NEEDS_ASSIGNMENT", "Needs assignment"],
  ["AUTO_ASSIGNED", "Assigned to a protected item"],
  ["ASSIGNED", "Assigned by you"],
  ["IGNORED", "Ignored / not evidence"],
] as const;

export default function Inbox() {
  const me = useQuery(api.workspaces.me);
  const rows = useQuery(api.inbound.listMine, me?.workspaceId ? {} : "skip");
  const items = useQuery(api.protectedItems.listMine, me?.workspaceId ? {} : "skip");
  const assign = useMutation(api.inbound.assignMessage);
  if (me === undefined || (me?.workspaceId && rows === undefined))
    return (
      <div className="loading-block" role="status">
        <span className="spinner" /> Loading…
      </div>
    );
  return (
    <>
    <TopBar crumbs={[{ label: "Kept", to: "/app" }, { label: "Inbox" }]} />
    <div className="app-content">
      <div className="page-title">
        <div>
          <h1>Kept inbox</h1>
          <p>Signup emails, bills and support replies that reached your Kept address. Kept never attaches mail to a plan unless it’s sure.</p>
        </div>
      </div>
      <div className="card card-muted row" style={{ gap: 14 }}>
        <span className="icon-tile">
          <Icon name="email" size={20} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="label">Your forwarding address</div>
          <strong className="mono" style={{ fontSize: 15 }}>
            {me?.inboxAddress ?? "Being set up…"}
          </strong>
        </div>
      </div>
      {GROUPS.map(([status, label]) => {
        const list = (rows ?? []).filter((r) => r.assignmentStatus === status);
        if (list.length === 0) return null;
        return (
          <section key={status} className="stack">
            <h2 className="section-title">{label}</h2>
            {list.map((r) => (
              <article key={r._id} className="card stack" style={{ gap: 4 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{r.subject ?? "(no subject)"}</strong>
                  <StatusBadge status={r.caseId ? "REPLY_RECEIVED" : r.classification} />
                </div>
                <div className="muted small">
                  {r.fromDomain ?? "unknown sender"} · {dateTime(r.receivedAt)}
                </div>
                <div className="small">{r.preview}</div>
                {r.caseId ? <Link to={`/app/cases/${r.caseId}`}>Open case</Link> : r.protectedItemId ? <Link to={`/app/items/${r.protectedItemId}`}>Open item</Link> : null}
                {status === "NEEDS_ASSIGNMENT" ? (
                  <label className="small">
                    Attach to
                    <select defaultValue="" onChange={(e) => void assign({ assignmentId: r._id, itemId: e.target.value === "ignore" ? null : (e.target.value as Id<"protectedItems">) })}>
                      <option value="" disabled>
                        Choose a protected item…
                      </option>
                      {(items ?? []).map((i) => (
                        <option key={i._id} value={i._id}>
                          {i.providerName ?? "Unnamed"} · {i.productName ?? "Plan"}
                        </option>
                      ))}
                      <option value="ignore">Not evidence, ignore it</option>
                    </select>
                  </label>
                ) : null}
              </article>
            ))}
          </section>
        );
      })}
      {rows && rows.length === 0 ? (
        <section className="empty">
          <span className="icon-tile is-soft">
            <Icon name="inbox" size={22} />
          </span>
          <strong>No messages yet</strong>
          <p>Forward a signup confirmation or bill to your Kept address. It shows up here within a few seconds.</p>
        </section>
      ) : null}
    </div>
    </>
  );
}

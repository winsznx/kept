import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
  if (me === undefined || (me?.workspaceId && rows === undefined)) return <p role="status">Loading…</p>;
  return (
    <div className="stack" style={{ gap: 20 }}>
      <h1>Kept inbox</h1>
      <p>
        {me?.inboxAddress ? (
          <>
            Forward signup emails and bills to <strong className="mono">{me.inboxAddress}</strong>. Replies to your cases land here too.
          </>
        ) : (
          "Your Kept inbox is being set up."
        )}
      </p>
      {GROUPS.map(([status, label]) => {
        const list = (rows ?? []).filter((r) => r.assignmentStatus === status);
        if (list.length === 0) return null;
        return (
          <section key={status} className="stack">
            <h2 style={{ margin: 0 }}>{label}</h2>
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
      {rows && rows.length === 0 ? <p className="muted">No messages yet.</p> : null}
    </div>
  );
}

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CaseEvents, CaseHeader, Correspondence, EvidencePacket, ResolutionBanner } from "../features/cases/CaseView";

const EDITABLE = new Set(["DRAFT", "READY_TO_SEND", "NEEDS_USER_ACTION", "REPLY_RECEIVED"]);

export default function CaseDetail() {
  const { caseId } = useParams();
  const id = caseId as Id<"cases">;
  const data = useQuery(api.cases.getMine, { caseId: id });
  const updateDraft = useMutation(api.cases.updateDraft);
  const approveAndSend = useMutation(api.cases.approveAndSend);
  const close = useMutation(api.cases.close);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (data === undefined) return <p role="status">Loading…</p>;
  const c = data.case;

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setMsg(null);
    try {
      await updateDraft({ caseId: id, recipientEmail: String(f.get("to") ?? ""), subject: String(f.get("subject") ?? ""), draftText: String(f.get("body") ?? "") });
      setMsg("Saved. Review it, then approve to send.");
    } catch (err) {
      setMsg((err as { data?: { message?: string } }).data?.message ?? "Couldn’t save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 20 }}>
      {data.item ? (
        <Link to={`/app/items/${data.item._id}`} className="small">
          ← Back to item
        </Link>
      ) : null}
      <CaseHeader data={data} />
      <ResolutionBanner data={data} />
      <EvidencePacket data={data} />

      <section className="card stack" aria-labelledby="draft-title">
        <h2 id="draft-title" style={{ margin: 0 }}>
          {c.status === "WAITING_FOR_REPLY" ? "Waiting for a reply" : "Review before sending"}
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          {c.status === "WAITING_FOR_REPLY"
            ? "This case was sent through your Kept inbox. Replies will appear here automatically."
            : `Kept drafted this from the evidence shown above${c.draftSource === "MODEL" ? ", and checked every amount and date against it" : ""}. Nothing is sent until you approve it.`}
        </p>
        <form className="stack" onSubmit={(e) => void onSave(e)} key={`${c.updatedAt}`}>
          <label>
            To (the provider’s support address)
            <input name="to" type="email" defaultValue={c.recipientEmail ?? ""} disabled={!EDITABLE.has(c.status)} required />
          </label>
          <label>
            Subject
            <input name="subject" defaultValue={c.subject ?? ""} disabled={!EDITABLE.has(c.status)} maxLength={200} />
          </label>
          <label>
            Message
            <textarea name="body" defaultValue={c.draftText ?? ""} disabled={!EDITABLE.has(c.status)} rows={12} />
          </label>
          {EDITABLE.has(c.status) ? (
            <div className="row">
              <button className="btn" type="submit" disabled={pending}>
                Save draft
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={pending || c.status !== "READY_TO_SEND" || !data.inboxReady}
                onClick={() => {
                  setPending(true);
                  approveAndSend({ caseId: id })
                    .then(() => setMsg("Approved. Sending from your Kept inbox…"))
                    .catch((err: { data?: { message?: string } }) => setMsg(err.data?.message ?? "Couldn’t send."))
                    .finally(() => setPending(false));
                }}
              >
                Approve and send
              </button>
            </div>
          ) : null}
          {!data.inboxReady ? <p className="small muted">Your Kept inbox isn’t ready, so sending is unavailable. You can copy the message and send it yourself.</p> : null}
        </form>
        {msg ? (
          <p className="small" role="status">
            {msg}
          </p>
        ) : null}
      </section>

      <Correspondence data={data} />
      <section className="stack">
        <h2 style={{ margin: 0 }}>Case timeline</h2>
        <CaseEvents data={data} />
      </section>
      {c.status !== "CLOSED" && c.status !== "SENDING" ? (
        <div>
          <button type="button" className="btn" onClick={() => void close({ caseId: id })}>
            Close without confirmation
          </button>
        </div>
      ) : null}
    </div>
  );
}

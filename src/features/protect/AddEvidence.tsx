import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,text/plain,text/html";
const MAX_BYTES = 10 * 1024 * 1024;

type Kind = "PROMISE" | "BILL";

export function AddEvidence({ itemId, routingToken }: { itemId: Id<"protectedItems">; routingToken: string }) {
  const me = useQuery(api.workspaces.me);
  const generateUploadUrl = useMutation(api.sources.generateUploadUrl);
  const addUpload = useMutation(api.sources.addUpload);
  const addText = useMutation(api.sources.addText);
  const addUrl = useMutation(api.sources.addUrl);
  const [kind, setKind] = useState<Kind>("PROMISE");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setPending(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: "ok", text: ok });
    } catch (err) {
      const data = (err as { data?: { message?: string } }).data;
      setMessage({ tone: "bad", text: data?.message ?? "That didn’t work. Your existing evidence is unchanged." });
    } finally {
      setPending(false);
    }
  }

  async function onFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return setMessage({ tone: "bad", text: "Choose a file first." });
    if (file.size > MAX_BYTES) return setMessage({ tone: "bad", text: "Files must be 10 MB or smaller." });
    await run(async () => {
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error("upload failed");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await addUpload({ itemId, storageId, filename: file.name, intent: kind });
    }, "Uploaded. Kept is reading it now.");
    input.value = "";
  }

  return (
    <section className="card stack" aria-labelledby="add-title">
      <h2 id="add-title" style={{ margin: 0 }}>
        Add evidence
      </h2>
      <fieldset className="row" style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className="label">This is a…</legend>
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="radio" name="kind" checked={kind === "PROMISE"} onChange={() => setKind("PROMISE")} style={{ width: "auto", minHeight: 0 }} /> signup / order record
        </label>
        <label className="row" style={{ fontWeight: 500 }}>
          <input type="radio" name="kind" checked={kind === "BILL"} onChange={() => setKind("BILL")} style={{ width: "auto", minHeight: 0 }} /> bill or statement
        </label>
      </fieldset>

      <div className="small">
        <div className="label">Forward email</div>
        {me?.inboxAddress ? (
          <p style={{ margin: 0 }}>
            Forward to <strong className="mono">{me.inboxAddress}</strong> with <strong className="mono">KEPT-{routingToken}</strong> in the subject so it lands on this item.
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Your Kept inbox isn’t ready yet. You can upload or paste instead.
          </p>
        )}
      </div>

      <form className="stack" onSubmit={(e) => void onFile(e)}>
        <label>
          Upload a file (PDF, image, text)
          <input name="file" type="file" accept={ACCEPT} />
        </label>
        <div>
          <button className="btn" type="submit" disabled={pending}>
            Upload
          </button>
        </div>
      </form>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const el = e.currentTarget.elements.namedItem("text") as HTMLTextAreaElement;
          void run(() => addText({ itemId, text: el.value, intent: kind }), "Saved. Kept is reading it now.").then(() => (el.value = ""));
        }}
      >
        <label>
          Or paste the email text
          <textarea name="text" />
        </label>
        <div>
          <button className="btn" type="submit" disabled={pending}>
            Add text
          </button>
        </div>
      </form>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const el = e.currentTarget.elements.namedItem("url") as HTMLInputElement;
          void run(() => addUrl({ itemId, url: el.value }), "Capturing the public page. Each capture is stored as a new snapshot.");
        }}
      >
        <label>
          Public offer or terms page
          <input name="url" type="url" inputMode="url" placeholder="https://" />
        </label>
        <div>
          <button className="btn" type="submit" disabled={pending}>
            Capture page
          </button>
        </div>
      </form>
      {message ? (
        <p role={message.tone === "bad" ? "alert" : "status"} className={message.tone === "bad" ? "field-error" : "small"}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon } from "../components/Icon";
import { TopBar } from "../components/Layouts";

export default function Protect() {
  const create = useMutation(api.protectedItems.create);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => {
      const x = String(f.get(k) ?? "").trim();
      return x.length ? x : undefined;
    };
    setPending(true);
    try {
      const itemId = await create({ providerName: s("provider"), productName: s("product"), transactionDate: s("date") });
      navigate(`/app/items/${itemId}`);
    } catch (err) {
      setError((err as { data?: { message?: string } }).data?.message ?? "Couldn’t create the item.");
      setPending(false);
    }
  }

  return (
    <>
    <TopBar crumbs={[{ label: "My plans", to: "/app" }, { label: "Protect a plan" }]} />
    <div className="app-content">
      <div className="page-title">
        <div>
          <h1>Protect a plan</h1>
          <p>Start with whatever you know. Kept fills in the rest from your evidence on the next screen: forward the signup email, upload it, or paste the offer page link.</p>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
      <form className="card stack" style={{ gap: 16 }} onSubmit={(e) => void onSubmit(e)}>
        <label>
          Provider <span className="muted">(optional)</span>
          <input name="provider" placeholder="e.g. your carrier or ISP" maxLength={120} />
        </label>
        <label>
          Plan or promotion <span className="muted">(optional)</span>
          <input name="product" maxLength={160} />
        </label>
        <label>
          Signup date <span className="muted">(optional)</span>
          <input name="date" type="date" />
        </label>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Continue to evidence <Icon name="arrowRight" size={16} />
          </button>
        </div>
      </form>
      <div className="panel stack" style={{ gap: 14 }}>
        <div className="label">What happens next</div>
        {(
          [
            ["email", "Forward or upload", "Send the signup confirmation to your Kept inbox, or upload a PDF, image or text."],
            ["record", "Kept records the promise", "Each term is stored with the exact words it came from."],
            ["watch", "Bills are checked", "Every bill you add is matched to its expected credit."],
          ] as const
        ).map(([icon, t, b]) => (
          <div key={t} className="row" style={{ alignItems: "flex-start", gap: 14, flexWrap: "nowrap" }}>
            <span className="icon-tile">
              <Icon name={icon} size={19} />
            </span>
            <div>
              <strong>{t}</strong>
              <p className="small muted">{b}</p>
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
    </>
  );
}

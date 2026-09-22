import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";

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
    <div className="stack" style={{ maxWidth: 560 }}>
      <h1>Protect a plan</h1>
      <p>Start with whatever you know. Kept fills in the rest from your evidence on the next screen: forward the signup email, upload it, or paste the offer page link.</p>
      <form className="stack" onSubmit={(e) => void onSubmit(e)}>
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
            Continue to evidence
          </button>
        </div>
      </form>
    </div>
  );
}

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Icon } from "../components/Icon";
import { Lifecycle, type LifecycleStep } from "../components/Lifecycle";
import { CaseEvents, CaseHeader, Correspondence, EvidencePacket, ResolutionBanner } from "../features/cases/CaseView";
import { Applicability, LatestFindings, OutcomeSummary, PageComparisons, Promises, ScheduleGrid, SourceList, ThenVsNow } from "../features/items/ItemViews";

const KEY = "kept-demo-session";

function sessionKey(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{24,64}$/.test(existing)) return existing;
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const fresh = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  }
}

type Step = "BILL_22" | "OPEN_CASE" | "SEND" | "REPLY" | "BILL_23";

const NEXT: Record<string, { step: Step; label: string; lifecycle: LifecycleStep; explain: string } | null> = {
  SEEDING: null,
  ON_TRACK: { step: "BILL_22", label: "Bill 22 arrives", lifecycle: "Watch", explain: "Kept recorded the offer and has checked bills 1–21 against it. Every credit matched." },
  DRIFT: { step: "OPEN_CASE", label: "Open a case", lifecycle: "Detect", explain: "Bill 22 lists charges and credits, but not the $18.75 promotional credit." },
  CASE_DRAFT: { step: "SEND", label: "Approve and send", lifecycle: "Resolve", explain: "Kept drafted a short support email from the evidence packet. Nothing is sent until you approve it." },
  WAITING_REPLY: { step: "REPLY", label: "Support replies", lifecycle: "Resolve", explain: "The case is waiting for a reply in the same thread." },
  PROVIDER_CLAIMS_FIXED: { step: "BILL_23", label: "Bill 23 arrives", lifecycle: "Verify", explain: "Support says it’s fixed. That’s a claim. Kept waits for the next bill before calling it fixed." },
  VERIFIED: null,
};

export default function Demo() {
  const [key] = useState(sessionKey);
  const start = useMutation(api.demo.start);
  const advance = useMutation(api.demo.advance);
  const state = useQuery(api.demo.state, { sessionKey: key });
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"main" | "control" | "refusal">("main");

  // Starting the per-visitor demo workspace is a side effect of landing on the page.
  useEffect(() => {
    if (state === null) start({ sessionKey: key }).catch(() => setError("The demo couldn’t start. Reload to try again."));
  }, [state, start, key]);

  if (error)
    return (
      <div className="container page">
        <p role="alert" className="alert tone-bad">
          {error}
        </p>
      </div>
    );
  if (!state || state.step === "SEEDING")
    return (
      <div className="container page">
        <div className="loading-block" role="status">
          <span className="spinner" /> Setting up your demo: recording the signup, then checking 21 bills…
        </div>
      </div>
    );

  const next = NEXT[state.step];
  const active: LifecycleStep = next?.lifecycle ?? "Verify";

  return (
    <div className="container page stack-lg">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <span className="eyebrow">
          <Icon name="play" size={15} /> Live demo
        </span>
        <h1>Watch one promise from signup to verified fix.</h1>
        <p>A 24-month device promotion, running on Kept’s real pipeline. Step through it yourself.</p>
      </div>
      <div className="alert tone-info small">
        <Icon name="flask" size={18} />
        <span>
        <strong>Public demo with synthetic data.</strong> “Brightline Wireless” is fictional. Every state below is real Convex data computed by Kept’s pipeline. The sources are parsed by a deterministic
        fixture parser instead of AI, and the email send and reply are <strong>replays</strong>: demo cases are never emailed. Live sponsor runs are on the <Link to="/proof" style={{ fontWeight: 600, textDecoration: "underline" }}>proof page</Link>.
        </span>
      </div>

      <div className="tabs" role="tablist" aria-label="Demo scenarios">
        {(
          [
            ["main", "The missing credit"],
            ["control", "Control: page reworded"],
            ["refusal", "Refusal: wrong seller"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "main" ? (
        <>
          <Lifecycle active={active} complete={!next} />
          <section className="panel stack" aria-live="polite">
            <p style={{ margin: 0 }}>{next ? next.explain : "Kept saw the credit come back on bill 23, plus a back-credit for bill 22. The case is resolved, and the fix is verified."}</p>
            <div className="row">
              {next ? (
                <button type="button" className="btn btn-primary" disabled={state.busy} onClick={() => advance({ sessionKey: key, step: next.step }).catch(() => setError("That step failed. Reload the demo."))}>
                  {state.busy ? <span className="spinner" /> : null}
                  {state.busy ? "Processing…" : next.label}
                  {state.busy ? null : <Icon name="arrowRight" size={16} />}
                </button>
              ) : (
                <span className="badge tone-ok">VERIFIED FIXED</span>
              )}
            </div>
          </section>
          <OutcomeSummary view={state.main} />
          <ScheduleGrid view={state.main} />
          <LatestFindings view={state.main} />
          <ThenVsNow view={state.main} />
          {state.case ? (
            <section className="stack">
              <CaseHeader data={state.case} />
              <ResolutionBanner data={state.case} />
              <EvidencePacket data={state.case} />
              <section className="card stack">
                <h2 className="section-title">
                  <Icon name="email" size={18} /> Draft email
                </h2>
                <p className="small muted" style={{ margin: 0 }}>
                  Review before sending. Kept drafted this from the evidence above. Nothing is sent until you approve it.
                </p>
                <div className="small">
                  <strong>To:</strong> {state.case.case.recipientEmail ?? "support address you choose"} · <strong>Subject:</strong> {state.case.case.subject}
                </div>
                <pre className="excerpt small" style={{ margin: 0, fontFamily: "inherit" }}>
                  {state.case.case.draftText}
                </pre>
              </section>
              <Correspondence data={state.case} />
              <CaseEvents data={state.case} />
            </section>
          ) : null}
          <details className="card">
            <summary>
              <Icon name="evidence" size={16} /> Recorded promises and sources
            </summary>
            <div className="stack" style={{ marginTop: 12 }}>
              <Promises view={state.main} />
              <SourceList view={state.main} />
            </div>
          </details>
        </>
      ) : null}

      {tab === "control" ? (
        <div className="stack-lg">
          <p className="muted">
            Kept captured the offer page when you signed up, and again later. The marketing copy and layout were completely rewritten. Kept compares the commercial terms it extracted, not the raw
            text.
          </p>
          <PageComparisons view={state.control} />
          <Promises view={state.control} />
        </div>
      ) : null}

      {tab === "refusal" ? (
        <div className="stack-lg">
          <p className="muted">A phone bought from a third-party marketplace seller, checked against the provider’s 30-day return policy for its own sales.</p>
          <Applicability view={state.refusal} />
          <Promises view={state.refusal} />
          <SourceList view={state.refusal} />
        </div>
      ) : null}
    </div>
  );
}

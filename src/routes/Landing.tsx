import { Link } from "react-router";
import { Lifecycle } from "../components/Lifecycle";

export function Landing() {
  return (
    <div className="stack" style={{ gap: 40 }}>
      <section className="stack" aria-labelledby="hero-title" style={{ paddingTop: 24 }}>
        <h1 id="hero-title" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
          Keep the deal you were promised.
        </h1>
        <p style={{ fontSize: "1.15rem", maxWidth: 640 }}>
          Forward your signup or promotion once. Kept records the terms, checks future bills against them, and shows the evidence if
          something stops matching.
        </p>
        <div className="row">
          <Link to="/demo" className="btn btn-primary">
            Try the demo
          </Link>
          <Link to="/signup" className="btn">
            Protect a plan
          </Link>
        </div>
      </section>

      <section className="card card-muted" aria-labelledby="scenario-title">
        <h2 id="scenario-title" className="label">
          What Kept catches
        </h2>
        <div className="grid-2">
          <div>
            <div className="label">Promised</div>
            <div className="value-lg">$18.75 device credit × 24 months</div>
          </div>
          <div>
            <div className="label">Observed</div>
            <div>Months 1–21: $18.75</div>
            <div>
              <strong>Month 22: $0.00</strong>
            </div>
          </div>
        </div>
        <p style={{ marginTop: 12 }}>
          <span className="badge tone-bad">MATERIAL DIFFERENCE</span> <strong>$18.75 monthly credit missing</strong>
        </p>
        <p className="muted small">
          Then Kept opens a case with the original evidence, and when support says it’s fixed, waits for the next bill to prove it.
        </p>
      </section>

      <section className="stack" aria-labelledby="loop-title">
        <h2 id="loop-title">Record the promise. Catch the drift. Verify the fix.</h2>
        <Lifecycle />
        <ol className="stack" style={{ paddingLeft: 20 }}>
          <li>
            <strong>Record.</strong> Kept saves the signup email, receipt, or offer page the day you buy, with the exact words each term came from.
          </li>
          <li>
            <strong>Watch.</strong> A recurring credit becomes a schedule: 24 expected credits, each checked against its bill.
          </li>
          <li>
            <strong>Detect.</strong> When a bill stops matching, Kept shows the exact field, amount, and period, and the evidence on both sides.
          </li>
          <li>
            <strong>Resolve.</strong> You review and approve a short support email built only from that evidence. Replies land on the same case.
          </li>
          <li>
            <strong>Verify.</strong> “We fixed it” is not a fix. Kept waits for the next bill and checks the credit actually came back.
          </li>
        </ol>
        <p className="muted small">
          A reworded offer page with the same terms is not an alert. When Kept can’t tell whether a term applies to your purchase, it says so.
        </p>
      </section>
    </div>
  );
}

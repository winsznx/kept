import { useState } from "react";
import { Link } from "react-router";
import { Icon, Mark, type IconName } from "../components/Icon";

const LOOP: { title: string; body: string; icon: IconName }[] = [
  { title: "Record the promise", body: "Forward the signup email or paste the offer page. Kept stores it unchanged, with the exact words each term came from.", icon: "record" },
  { title: "Watch every bill", body: "“$18.75 a month for 24 months” becomes 24 expected credits, each matched to its bill.", icon: "watch" },
  { title: "Catch the drift", body: "When a bill stops matching, Kept shows the period, the amount, and the evidence on both sides.", icon: "detect" },
  { title: "Open an evidence-backed case", body: "Kept drafts a short support email from the evidence. Nothing is sent until you approve it.", icon: "email" },
  { title: "Verify the fix", body: "“We fixed it” is a claim. Kept waits for the next bill and checks the credit actually came back.", icon: "verify" },
];

function LoopArt({ step }: { step: number }) {
  const cards = [
    <div className="panel-white" key="0">
      <div className="row-between">
        <span className="label">Recorded promise</span>
        <span className="badge tone-info">MONITORED</span>
      </div>
      <div className="value-lg">$18.75 / month × 24</div>
      <blockquote className="excerpt">“You'll receive a $18.75 monthly bill credit for 24 months.”</blockquote>
      <div className="small faint row" style={{ gap: 6 }}>
        <Icon name="lock" size={13} /> Stored unchanged · captured Nov 18, 2024
      </div>
    </div>,
    <div className="panel-white" key="1">
      <div className="row-between">
        <span className="label">Expected credits</span>
        <span className="small muted">21 of 24 billed</span>
      </div>
      <div className="mini-periods" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} className={i >= 21 ? "is-future" : undefined} />
        ))}
      </div>
      <div className="small muted">Every billed credit matched the recorded $18.75.</div>
    </div>,
    <div className="panel-white" key="2">
      <div className="row-between">
        <span className="label">Credit 22 of 24 · September bill</span>
        <span className="badge tone-bad">ISSUE DETECTED</span>
      </div>
      <div className="field-row">
        <span className="muted">Recorded</span>
        <strong>$18.75</strong>
      </div>
      <div className="field-row">
        <span className="muted">On the bill</span>
        <strong className="is-bad" style={{ color: "var(--error)", fontSize: 28 }}>
          $0.00
        </strong>
      </div>
      <div className="field-row" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <span className="muted">Difference</span>
        <strong style={{ color: "var(--error)" }}>−$18.75</strong>
      </div>
      <div className="small muted">No promotional credit line on this bill.</div>
    </div>,
    <div className="panel-white" key="3">
      <div className="row-between">
        <span className="label">Review before sending</span>
        <span className="badge tone-neutral">DRAFT</span>
      </div>
      <p className="small" style={{ lineHeight: 1.6 }}>
        When I signed up on November 18, 2024, my offer recorded a $18.75 monthly bill credit for 24 months. My September bill shows $0.00 for credit 22…
      </p>
      <div className="inner-pill">
        <Icon name="send" size={15} /> Approve and send
      </div>
    </div>,
    <div className="panel-white" key="4">
      <div className="success-block">
        <span className="success-circle">
          <Icon name="resolve" size={24} />
        </span>
        <strong style={{ color: "var(--success)", fontSize: 18 }}>Verified on a later bill</strong>
        <p>Bill 23 shows the credit again, plus a back-credit for 22.</p>
      </div>
      <div className="inner-lines">
        <div>
          <span className="muted">Support said “restored”</span>
          <strong style={{ color: "var(--warning)" }}>claim only</strong>
        </div>
        <div>
          <span className="muted">Verified restored</span>
          <strong style={{ color: "var(--success)" }}>$37.50</strong>
        </div>
      </div>
    </div>,
  ];
  const changes = ["The promise is on record, word for word", "24 expected credits to check", "A difference with evidence on both sides", "A case you approve, nothing sent without you", "Resolution proven by a later bill"];
  return (
    <div className="step-art art art-cool" aria-live="polite">
      <div className="step-change">
        <span>
          Step 0{step + 1} · {changes[step]}
        </span>
      </div>
      {cards[step]}
    </div>
  );
}

export function Landing() {
  const [step, setStep] = useState(2);
  return (
    <>
      <section className="container hero" aria-labelledby="hero-title">
        <span className="eyebrow">
          <Icon name="verify" size={15} /> Record · Watch · Detect · Resolve · Verify
        </span>
        <h1 id="hero-title">Keep the deal you were promised.</h1>
        <p className="hero-lede">Forward your signup once. Kept records the terms, checks every later bill against them, and won’t call a problem fixed until a bill proves it.</p>
        <div className="hero-actions">
          <Link to="/demo" className="btn btn-primary btn-lg">
            Try the live demo <Icon name="arrowRight" size={17} />
          </Link>
          <Link to="/signup" className="btn btn-lg">
            Protect a plan
          </Link>
        </div>

        <div className="memory-strip" aria-label="Demo example">
          <div className="memory-label">
            Demo example
            <b>One 24-month promotion</b>
          </div>
          <div className="memory-step">
            <span className="icon-tile is-soft">
              <Icon name="promise" size={17} />
            </span>
            <div>
              <strong>24 expected credits</strong>
              <small>$18.75 each, recorded at signup</small>
            </div>
          </div>
          <div className="memory-step is-bad">
            <span className="icon-tile is-bad" style={{ background: "#fff" }}>
              <Icon name="detect" size={17} />
            </span>
            <div>
              <strong>Credit 22 missing</strong>
              <small>Expected $18.75 · bill shows $0.00</small>
            </div>
          </div>
          <div className="memory-step is-warn">
            <span className="icon-tile is-warn" style={{ background: "#fff" }}>
              <Icon name="email" size={17} />
            </span>
            <div>
              <strong>Support says fixed</strong>
              <small>A claim. Kept waits.</small>
            </div>
          </div>
          <div className="memory-step is-ok">
            <span className="icon-tile is-ok" style={{ background: "#fff" }}>
              <Icon name="verify" size={17} />
            </span>
            <div>
              <strong>Bill 23 verified the fix</strong>
              <small>Credit back, plus back-credit</small>
            </div>
          </div>
        </div>

        <div className="hero-panels">
          <div className="art art-neutral hero-stack">
            <div className="hero-stack-caption">
              <Mark size={18} /> One promotion, 24 bills later
            </div>
            <div className="float-card">
              <span className="icon-tile is-soft">
                <Icon name="promise" size={20} />
              </span>
              <div>
                <strong>Promised at signup</strong>
                <small>24 monthly device credits</small>
              </div>
              <span className="float-value">$18.75 / mo</span>
            </div>
            <div className="float-card" style={{ boxShadow: "0 0 0 1.5px rgba(239,68,68,.45), 0 8px 26px rgba(15,23,42,.1)" }}>
              <span className="icon-tile is-bad">
                <Icon name="detect" size={20} />
              </span>
              <div>
                <strong>Credit 22 of 24 missing</strong>
                <small>Expected $18.75 · observed $0.00</small>
              </div>
              <span className="float-value" style={{ color: "var(--error)" }}>
                −$18.75
              </span>
            </div>
            <div className="float-card">
              <span className="icon-tile is-warn">
                <Icon name="email" size={20} />
              </span>
              <div>
                <strong>Support says it’s fixed</strong>
                <small>Recorded as a claim, not a fix</small>
              </div>
              <span className="badge tone-warn" style={{ marginLeft: "auto" }}>
                WAITING
              </span>
            </div>
            <div className="float-card" style={{ boxShadow: "0 0 0 1.5px rgba(22,163,74,.45), 0 8px 26px rgba(15,23,42,.1)" }}>
              <span className="icon-tile" style={{ background: "var(--success)", color: "#fff" }}>
                <Icon name="verify" size={20} />
              </span>
              <div>
                <strong>Verified on bill 23</strong>
                <small>The later bill shows the credit again</small>
              </div>
              <span className="float-value" style={{ color: "var(--success)" }}>
                +$37.50
              </span>
            </div>
          </div>

          <div className="art art-cool app-stage">
            <div className="app-card">
              <div className="app-card-head">
                <span className="icon-tile is-dark">
                  <Icon name="record" size={19} />
                </span>
                <div>
                  <strong>Brightline Wireless</strong>
                  <span>Aurora X15 device promotion</span>
                </div>
              </div>
              <div className="row" style={{ margin: "-4px 4px 14px" }}>
                <span className="badge tone-bad">MATERIAL DIFFERENCE</span>
                <span className="small muted">credit 22 of 24</span>
              </div>
              <div className="app-card-panel">
                <div className="row-between small muted">
                  <span>Observed missing value</span>
                  <span className="eyebrow" style={{ minHeight: 28, padding: "0 10px", fontSize: 12 }}>
                    Bill 22 of 24
                  </span>
                </div>
                <div className="app-readout">
                  <strong>$18.75</strong>
                  <span>promised value remaining $56.25</span>
                </div>
                <div className="mini-periods" aria-hidden="true">
                  {Array.from({ length: 24 }, (_, i) => (
                    <i key={i} className={i === 21 ? "is-missing" : i > 21 ? "is-future" : undefined} />
                  ))}
                </div>
              </div>
              <div className="app-rows">
                <div>
                  <span className="icon-tile is-soft" style={{ width: 34, height: 34, borderRadius: 11 }}>
                    <Icon name="email" size={16} />
                  </span>
                  <div>
                    <strong style={{ fontWeight: 500 }}>Signup confirmation</strong>
                    <small>Recorded Nov 18, 2024 · source-bound</small>
                  </div>
                  <b>$18.75 × 24</b>
                </div>
                <div>
                  <span className="icon-tile is-bad" style={{ width: 34, height: 34, borderRadius: 11 }}>
                    <Icon name="evidence" size={16} />
                  </span>
                  <div>
                    <strong style={{ fontWeight: 500 }}>September bill</strong>
                    <small>No “Device Promo Credit” line</small>
                  </div>
                  <b style={{ color: "var(--error)" }}>$0.00</b>
                </div>
              </div>
            </div>
            <div className="stat-float">
              <strong>Credits observed</strong>
              <div className="stat-meter" aria-hidden="true">
                <span style={{ width: "87.5%", background: "var(--kept-blue)" }} />
                <span style={{ width: "4.2%", background: "var(--error-dot)" }} />
              </div>
              <p>
                <span>
                  <b>21</b> matched
                </span>
                <span>
                  <b>1</b> missing · 2 not due
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="stack-strip">
          <p>Built on the stack it relies on</p>
          <div>
            <span>Convex</span>
            <i />
            <span>Firecrawl</span>
            <i />
            <span>OpenAI</span>
            <i />
            <span>AgentMail</span>
          </div>
        </div>
      </section>

      <section className="container section" id="loop" aria-labelledby="loop-title">
        <span className="eyebrow">
          <Icon name="watch" size={15} /> How Kept works
        </span>
        <div className="section-heading">
          <h2 id="loop-title">One promise, followed until it’s kept.</h2>
          <p>Promotions pay out over two years of bills. Kept keeps the original record and follows every bill against it, so you don’t have to reconstruct the deal when a credit quietly stops.</p>
        </div>
        <div className="steps-panel">
          <div className="step-list" role="tablist" aria-label="Kept loop">
            {LOOP.map((s, i) => (
              <button key={s.title} type="button" role="tab" className="step" aria-selected={step === i} onClick={() => setStep(i)}>
                <span className="step-num">0{i + 1}</span>
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.body}</small>
                </span>
              </button>
            ))}
          </div>
          <LoopArt step={step} />
        </div>
      </section>

      <section className="container section" aria-labelledby="why-title">
        <div className="centered-heading">
          <span className="eyebrow">
            <Icon name="evidence" size={15} /> Why Kept is different
          </span>
          <h2 id="why-title">Evidence first. Claims second.</h2>
          <p>Kept compares what you were promised with what actually happened, and it knows when not to decide.</p>
        </div>
        <div className="three-up">
          <article className="why-card">
            <Icon name="evidence" size={26} />
            <h3>Then vs Now</h3>
            <p>Every term is tied to the exact words it came from.</p>
            <div className="why-inner">
              <h4>Monthly credit</h4>
              <div className="field">
                <span>Then · recorded Nov 18, 2024</span>
                <div className="field-row">
                  <strong>$18.75 / month</strong>
                  <span className="badge tone-info">RECORDED</span>
                </div>
              </div>
              <div className="field">
                <span>Now · September bill</span>
                <div className="field-row">
                  <strong className="is-bad">$0.00</strong>
                  <span className="badge tone-bad">MISSING</span>
                </div>
              </div>
              <div className="inner-meta">
                <span>Difference</span>
                <span>−$18.75</span>
              </div>
              <Link to="/demo" className="inner-pill">
                See it in the demo <Icon name="arrowRight" size={15} />
              </Link>
            </div>
          </article>
          <article className="why-card is-featured">
            <Icon name="verify" size={26} />
            <h3>A reply isn’t a fix</h3>
            <p>When support says it’s fixed, Kept records the claim and waits for the next bill.</p>
            <div className="why-inner">
              <ol className="proof-ladder">
                <li className="is-warn">
                  <span className="dot">
                    <Icon name="email" size={15} />
                  </span>
                  <div>
                    <strong>PROVIDER SAYS FIXED</strong>
                    <small>“The missed $18.75 credit will be applied.” Stored as their claim.</small>
                  </div>
                </li>
                <li className="is-warn">
                  <span className="dot">
                    <Icon name="watch" size={15} />
                  </span>
                  <div>
                    <strong>WAITING TO VERIFY</strong>
                    <small>No verified value counted yet. Kept watches the next bill.</small>
                  </div>
                </li>
                <li className="is-ok">
                  <span className="dot">
                    <Icon name="resolve" size={15} />
                  </span>
                  <div>
                    <strong>VERIFIED FIXED · BILL 23</strong>
                    <small>The bill itself shows the credit. Only now is it fixed.</small>
                  </div>
                </li>
              </ol>
            </div>
          </article>
          <article className="why-card">
            <Icon name="lock" size={26} />
            <h3>Knows when not to decide</h3>
            <p>Plain code compares amounts. When the evidence can’t settle it, Kept says so.</p>
            <div className="why-inner">
              <div className="success-block">
                <span className="success-circle" style={{ background: "var(--kept-ink)" }}>
                  <Icon name="globe" size={22} />
                </span>
                <strong>The page changed. The deal didn’t.</strong>
                <p>Rewritten offer page, same credit, duration and plan.</p>
              </div>
              <div className="inner-lines">
                <div>
                  <span className="muted">Raw page</span>
                  <strong>changed</strong>
                </div>
                <div>
                  <span className="muted">Commercial terms</span>
                  <strong style={{ color: "var(--success)" }}>unchanged</strong>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="container section" aria-labelledby="features-title">
        <span className="eyebrow">
          <Icon name="record" size={15} /> The product
        </span>
        <div className="section-heading">
          <h2 id="features-title">Everything a dispute needs, kept in one place.</h2>
          <p>Your signup, the offer page as it looked, every bill, the support thread, and the proof of the fix all stay attached to one protected plan.</p>
        </div>
        <div className="feature-grid">
          <article className="feature">
            <span className="feature-icon">
              <Icon name="email" size={22} />
            </span>
            <h3>Your own Kept inbox</h3>
            <p>Forward signup confirmations and bills. Replies to your cases land on the same case, in real time.</p>
            <div className="device">
              <div className="device-status">
                <span>9:41</span>
                <span>Kept inbox</span>
              </div>
              <h4>Assigned to Brightline</h4>
              <div className="device-rows">
                <div>
                  <span className="icon-tile is-soft" style={{ width: 32, height: 32, borderRadius: 10 }}>
                    <Icon name="record" size={15} />
                  </span>
                  <div>
                    <strong>Order confirmed</strong>
                    <small>Signup record</small>
                  </div>
                  <b>Recorded</b>
                </div>
                <div>
                  <span className="icon-tile is-bad" style={{ width: 32, height: 32, borderRadius: 10 }}>
                    <Icon name="evidence" size={15} />
                  </span>
                  <div>
                    <strong>September statement</strong>
                    <small>Bill 22</small>
                  </div>
                  <b style={{ color: "var(--error)" }}>Missing credit</b>
                </div>
                <div>
                  <span className="icon-tile is-ok" style={{ width: 32, height: 32, borderRadius: 10 }}>
                    <Icon name="email" size={15} />
                  </span>
                  <div>
                    <strong>Re: Missing promotional credit</strong>
                    <small>Support reply</small>
                  </div>
                  <b>Claim</b>
                </div>
              </div>
              <span className="chip-float">
                <Icon name="send" size={15} /> Nothing sent without you
              </span>
            </div>
          </article>
          <article className="feature">
            <span className="feature-icon">
              <Icon name="evidence" size={22} />
            </span>
            <h3>An evidence packet, not a complaint</h3>
            <p>The recorded promise, the exact bill line, the computed difference, and what Kept doesn’t know, frozen and hashed.</p>
            <div className="device">
              <div className="device-status">
                <span>9:41</span>
                <span>Case</span>
              </div>
              <h4>Evidence packet v1</h4>
              <div className="device-rows">
                <div>
                  <span className="muted">Recorded promise</span>
                  <b>$18.75 × 24</b>
                </div>
                <div>
                  <span className="muted">Credit 22 on bill</span>
                  <b style={{ color: "var(--error)" }}>$0.00</b>
                </div>
                <div>
                  <span className="muted">Outstanding missing</span>
                  <b>$18.75</b>
                </div>
                <div>
                  <span className="muted">Kept can’t see</span>
                  <b>account changes</b>
                </div>
              </div>
              <span className="chip-float">
                <Icon name="lock" size={15} /> Frozen and hashed
              </span>
            </div>
          </article>
        </div>
      </section>

      <section className="container section" id="faq" aria-labelledby="faq-title">
        <div className="faq">
          <div>
            <span className="eyebrow">
              <Icon name="quote" size={15} /> Questions
            </span>
            <h2 id="faq-title">What Kept does, and what it won’t.</h2>
            <p>Kept compares evidence. It doesn’t give legal advice or decide what a company owes you.</p>
            <Link to="/how-it-works" className="btn">
              Read how it works
            </Link>
          </div>
          <div>
            {[
              ["What do I send Kept?", "The signup or order confirmation, the offer page link if you have it, and your bills as they arrive. Forward them to your Kept inbox, upload, or paste."],
              ["Does AI decide whether my bill is wrong?", "No. AI reads the documents and quotes where each term came from. Plain code compares amounts and dates, and a term that can’t be quoted from the source is rejected."],
              ["Will Kept email my provider on its own?", "Never. Kept drafts the message from the evidence packet, and nothing is sent until you approve it. Replies are never answered automatically."],
              ["What if support says it’s fixed?", "Kept records that as the provider’s claim and waits for the next bill. It only shows “Verified fixed” when a later bill shows the credit again."],
              ["What happens when Kept isn’t sure?", "It says so. A reworded offer page with the same terms isn’t an alert, and a policy that may not cover your purchase is marked “can’t establish” instead of being applied."],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="plus" size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container" aria-labelledby="final-title">
        <div className="final">
          <Mark size={40} />
          <h2 id="final-title">Record the promise. Catch the drift. Verify the fix.</h2>
          <p>Walk through a full 24-month promotion in the demo, or protect your own plan in a minute.</p>
          <div className="hero-actions" style={{ marginTop: 10 }}>
            <Link to="/demo" className="btn btn-primary btn-lg">
              Try the live demo <Icon name="arrowRight" size={17} />
            </Link>
            <Link to="/signup" className="btn btn-lg">
              Protect a plan
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

import { Lifecycle } from "../components/Lifecycle";

export default function HowItWorks() {
  return (
    <article className="stack" style={{ maxWidth: 720 }}>
      <h1>How Kept works</h1>
      <p>
        Kept creates a dated promise record when you buy, then reconciles what happens later against that original evidence.
      </p>
      <Lifecycle />
      <h2>Record</h2>
      <p>
        You forward the signup confirmation to your Kept address, upload it, or paste the public offer URL. Kept stores the source unchanged,
        with a content hash and capture time, then extracts the commercial terms. Every term keeps the exact words it came from. If Kept can’t
        find those words in the source, the term is rejected rather than trusted.
      </p>
      <h2>Watch</h2>
      <p>A recurring promise, like $18.75 a month for 24 months, becomes 24 expected credits. Each later bill is matched to its period.</p>
      <h2>Detect</h2>
      <p>
        Plain code, not AI, compares amounts and dates. A missing credit on a mapped bill is a material difference. A future month that hasn’t
        been billed yet is never counted as missing. A reworded offer page with the same terms is not an alert.
      </p>
      <h2>Resolve</h2>
      <p>
        Kept drafts a short support email from the evidence packet. Nothing is sent until you approve it. Replies arrive in the same case.
      </p>
      <h2>Verify</h2>
      <p>
        When support says the credit was restored, Kept records that as the provider’s claim and waits. Only a later bill that shows the credit
        again marks it verified.
      </p>
      <h2>What Kept won’t do</h2>
      <p>
        Kept compares evidence. It doesn’t decide legal questions, doesn’t log into carrier accounts, and doesn’t send anything without your
        click. When a policy page may not apply to your purchase, Kept says so instead of guessing.
      </p>
    </article>
  );
}

# Launch post and submission text

All numbers come from `evidence/campaign-report.json`, `evidence/verification.md` and the live proof run. Don't add others.

## Main post (X)

You were promised 24 monthly credits. What happens when month 22 quietly disappears?

Kept records the deal when you sign up, checks every bill against it, opens an evidence-backed case when a credit goes missing, and won't call it fixed until a later bill proves it.

Support saying "it's fixed" is a claim. Kept waits for the next bill.

Measured on our synthetic campaign:
- 68/68 decisions quote the source text
- 8/8 material page changes caught, 8/8 harmless rewrites ignored
- 10/10 ambiguous cases correctly held back
- 0 claimed fixes marked verified without a bill

Built with @convex, @firecrawl, @OpenAI and @agentmail.

Live: https://gregarious-snail-975.convex.site
Proof run: https://gregarious-snail-975.convex.site/proof/run/live-loop-2026-09-22
Repo: https://github.com/winsznx/kept

Attach: `internal/kept-brand-kit-v1/social/kept-launch-1920x1080.png` (git-ignored, local only, confirmed present) or a clip of the demo moving from bill 22 (red) to bill 23 (green).

Posted: https://x.com/winsznlabs/status/2102468698200027501 and https://lnkd.in/p/dDekwEF6

## Reply (optional, same thread)

The part I'm proudest of: on the live production run the model labelled a one-time back-credit as a recurring credit. Kept noticed the schedule no longer lined up and refused to verify. A deterministic rule fixed it, and the same stored bills were re-checked with no new model calls. Failing closed is the feature.

## Submission form: markdown description (paste as-is)

**Kept records the deal you were promised at signup, checks every later bill against it, and won't call a problem fixed until a later bill proves it.**

A 24-month phone promotion pays out over two years of bills. When credit 22 quietly stops, you have to dig up the original confirmation, the offer page as it looked back then, and a stack of bills, then re-explain all of it to support. And "it's been fixed" in an email is not the same as the credit actually returning.

Kept closes that loop: **Record → Watch → Detect → Resolve → Verify.**

- **Record.** Forward the signup email to your own Kept inbox, upload it, or paste the offer page. Every source is stored unchanged with a content hash, and every extracted term keeps the exact words it came from.
- **Watch.** "$18.75 a month for 24 months" becomes 24 expected credits, each matched to its bill.
- **Detect.** Plain code, not the model, compares amounts and dates. Credit 22 missing is a material difference; months 23 and 24 are never counted as missing.
- **Resolve.** Kept freezes a hashed evidence packet and drafts a short support email from it. Every amount and date in the draft is checked against the packet, and nothing is sent until you approve it.
- **Verify.** When support says it is fixed, Kept stores that as the provider's claim and waits. Only a later bill showing the credit produces "verified fixed".

**Try it:** the public demo at /demo walks the whole loop, including a control (a rewritten offer page with the same terms produces no alert) and a refusal (a marketplace purchase checked against a retailer-direct policy stays "can't establish").

**Inspect it:** /proof/run/live-loop-2026-09-22 is a sanitized record of the same loop run live on production, and `npm run verify:evidence` re-derives 11 invariants and passes 11/11.

Measured on a synthetic campaign (52 live model calls, all rows published): 68/68 deterministic decisions quote the source text, 8/8 material page changes caught, 8/8 benign rewrites ignored, 10/10 ambiguous cases correctly held back, and 0 provider claims marked verified without a bill.

Sponsors: Convex is the whole backend (state machines, auth, immutable captures, file storage, scheduling, signed webhook route, realtime, static hosting, three components). Firecrawl captures public offer pages as T0 and Tn snapshots. OpenAI does strict Structured Outputs extraction and case drafting. AgentMail provides the per-user inbox, the approved send, and the reply thread.

## Submission form

- Project name: Kept
- One-liner: Kept records the deal you were promised at signup, checks every later bill against it, and won't call a problem fixed until a later bill proves it.
- Live app: https://gregarious-snail-975.convex.site
- Demo: https://gregarious-snail-975.convex.site/demo
- Repo: https://github.com/winsznx/kept (build log in `hackathon.md`)
- Video: https://youtu.be/OBAGwGMZ8Mc (2:49)
- Social post: https://x.com/winsznlabs/status/2102468698200027501 · LinkedIn: https://lnkd.in/p/dDekwEF6
- How it uses Convex: canonical state and state machines, Convex Auth, immutable source captures, file storage, scheduled pipeline steps, the signed AgentMail webhook route, reactive queries that move a case from claimed to verified without a reload, static hosting, and the Firecrawl, AgentMail and static-hosting components.
- How it uses Firecrawl: captures public offer and terms pages as T0 and later Tn snapshots with content hashes, so Kept can tell a real change in terms from a reworded page.
- How it uses OpenAI: `gpt-5.6-terra` with strict Structured Outputs extracts commitments, bill line items and support-reply claims; `gpt-5.6-sol` drafts the case email. Code checks every extracted value against the source text and decides all amounts and dates.
- How it uses AgentMail: a per-user inbox for forwarded signups and bills, user-approved case emails sent with idempotency keys, and replies that land in the same case thread through signed webhooks.
- Proof: https://gregarious-snail-975.convex.site/proof (live run, campaign report, independent verifier 11/11).

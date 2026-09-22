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

Attach: `internal/kept-brand-kit-v1/social/kept-launch-1920x1080.png` or a clip of the demo moving from bill 22 (red) to bill 23 (green).

## Reply (optional, same thread)

The part I'm proudest of: on the live production run the model labelled a one-time back-credit as a recurring credit. Kept noticed the schedule no longer lined up and refused to verify. A deterministic rule fixed it, and the same stored bills were re-checked with no new model calls. Failing closed is the feature.

## Submission form

- Project name: Kept
- One-liner: Kept records the deal you were promised at signup, checks every later bill against it, and won't call a problem fixed until a later bill proves it.
- Live app: https://gregarious-snail-975.convex.site
- Demo: https://gregarious-snail-975.convex.site/demo
- Repo: https://github.com/winsznx/kept (build log in `hackathon.md`)
- Video: (your upload link)
- Social post: (your post link)
- How it uses Convex: canonical state and state machines, Convex Auth, immutable source captures, file storage, scheduled pipeline steps, the signed AgentMail webhook route, reactive queries that move a case from claimed to verified without a reload, static hosting, and the Firecrawl, AgentMail and static-hosting components.
- How it uses Firecrawl: captures public offer and terms pages as T0 and later Tn snapshots with content hashes, so Kept can tell a real change in terms from a reworded page.
- How it uses OpenAI: `gpt-5.6-terra` with strict Structured Outputs extracts commitments, bill line items and support-reply claims; `gpt-5.6-sol` drafts the case email. Code checks every extracted value against the source text and decides all amounts and dates.
- How it uses AgentMail: a per-user inbox for forwarded signups and bills, user-approved case emails sent with idempotency keys, and replies that land in the same case thread through signed webhooks.
- Proof: https://gregarious-snail-975.convex.site/proof (live run, campaign report, independent verifier 11/11).

# Demo video script (target 2:40, hard limit under 3:00)

Record the live site: https://gregarious-snail-975.convex.site, browser at 1440 wide, zoom 100%.

**Most of the video is the real signed-in product, not the demo.** The demo appears only for the control and refusal beats, which need scripted fixtures. Say "demo" on screen when you are in it.

## Before recording

1. Sign in to the builder proof account (credentials in the local scratchpad, never in the repo). It already holds the completed real case: recorded promise, bills 20 to 23, the case sent through AgentMail, the provider reply, and the verified fix.
2. Open these tabs in order: `/app` (proof account), `/app/items/<the Brightline item>`, `/app/cases/<its case>`, `/demo`, `/proof/run/live-loop-2026-09-22`.
3. Open `/demo` once so the session seeds before you record.

## Shot list

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | `/` hero | Rest on the four-state strip | "You were promised 24 monthly credits. Credit 22 disappeared." |
| 0:09 | `/app` (real account) | Show the plan list and stat tiles | "This is my account. Kept recorded the offer when I signed up and has been checking every bill against it." |
| 0:18 | item page | Point at the recorded promise and its quoted excerpt | "$18.75 a month for 24 months, with the exact words it came from. If the model can't quote the source, Kept rejects the term." |
| 0:32 | item page | Scroll to the credit grid and Latest reconciliation | "Bills 20 and 21 matched. Bill 22 has no promotional credit line, so Kept shows a material difference: expected $18.75, observed $0.00. Months 23 and 24 are not counted as missing." |
| 0:50 | item page → Then vs Now | Open Then vs Now | "Then versus now, side by side." |
| 1:00 | case page | Show the evidence packet and the draft | "Kept froze an evidence packet and drafted this support email from it. Every amount and date was checked against the packet, and nothing sent until I approved it." |
| 1:15 | case page | Scroll to Correspondence and the provider claim | "The reply came back through the same thread: they say the credit will be applied. Kept stores that as their claim." |
| 1:26 | case page | Pause on the amber banner, then the green one | "A support reply is not proof your next bill is correct. Only bill 23, showing the credit again plus a back-credit, moved this to verified fixed: $37.50 restored." |
| 1:42 | `/demo` control tab | Show "The page changed. The deal didn't." | "In the public demo you can also see the control: a rewritten offer page with the same terms is not an alert." |
| 1:54 | `/demo` refusal tab | Show "Kept can't establish this yet" | "And a policy that may not cover your purchase is refused, not applied." |
| 2:05 | `/proof/run/live-loop-2026-09-22` | Scroll bills table and case timeline | "Every run is inspectable. This is that same loop, persisted: the bills, the case timeline, the sponsor calls, with hashes instead of private content." |
| 2:22 | `/proof` | Show the at-a-glance panel | "Each number links to a committed artifact, and an independent verifier passes 11 of 11 invariants." |
| 2:34 | `/` | Logo and URL | "Kept. Record the promise. Catch the drift. Verify the fix." |

## If you prefer a zero-login cut

Use `/demo` for the 0:09 to 1:42 beats: click Bill 22 arrives, Open a case, Approve and send, Support replies, Bill 23 arrives. It is the same pipeline on synthetic data, and the page labels the send and reply as replays. Keep the `/proof/run` beat either way, since that is the live evidence.

## Don't

- No code, schema or architecture walkthrough.
- Don't name all four sponsors in a list; their roles show through the product.
- Don't call demo data live, and don't call a replayed send a real send.

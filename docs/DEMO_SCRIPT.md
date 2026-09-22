# Demo video script (target 2:40, hard limit under 3:00)

Record the live site: https://gregarious-snail-975.convex.site. Browser at 1440 wide, zoom 100%. Open `/demo` in a fresh private window a minute before recording so the demo session is seeded.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | `/` hero | Rest on the demo-example strip | "You were promised 24 monthly credits. The twenty-second disappeared. Kept is built for that moment." |
| 0:10 | `/` hero | Point at the four state cards | "Kept records the promise at signup, checks every bill against it, and won't call it fixed until a later bill proves it." |
| 0:20 | `/demo` | Show the lifecycle and the outcome card: 21 of 21 matched | "This is a demo on synthetic data, but every state is real Convex data from Kept's pipeline. Twenty-one bills, every credit matched." |
| 0:35 | `/demo` | Open "Recorded promises and sources", show the excerpt | "Each promise keeps the exact words it came from. If the model can't quote the source, the term is rejected." |
| 0:48 | `/demo` | Click "Bill 22 arrives" and wait for the red state | "Bill 22 lands. No promotional credit. Kept flags a material difference: expected $18.75, observed $0.00. Months 23 and 24 are not counted as missing." |
| 1:05 | `/demo` | Scroll to Then vs Now | "Then versus now, with the difference highlighted." |
| 1:13 | `/demo` | Click "Open a case", show the evidence packet and draft | "Kept freezes an evidence packet and drafts a short support email from it. Nothing is sent until I approve." |
| 1:28 | `/demo` | Click "Approve and send", then "Support replies" | "Support replies: the credit will be restored. Kept stores that as the provider's claim and waits." |
| 1:40 | `/demo` | Pause on the amber "provider says fixed, Kept hasn't verified it" banner | "A support reply isn't proof your next bill is correct." |
| 1:47 | `/demo` | Click "Bill 23 arrives", show the green verified banner | "Bill 23 shows the credit again plus a back-credit. Only now does Kept mark it verified fixed: $37.50 restored." |
| 1:58 | `/demo` control tab | Show "The page changed. The deal didn't." | "A rewritten offer page with the same terms is not an alert." |
| 2:06 | `/demo` refusal tab | Show "Kept can't establish this yet" | "And when a policy may not apply to your purchase, Kept says so instead of guessing." |
| 2:14 | `/proof/run/live-loop-2026-09-22` | Scroll the bills table and case timeline | "This isn't only a demo. Here's the same loop run live on production: a real forwarded email through AgentMail, OpenAI extraction bound to the source, a case sent and answered in the same thread, verified by bill 23." |
| 2:30 | `/proof` | Show the at-a-glance panel | "Every number links to a committed artifact, and an independent verifier passes 11 of 11 checks." |
| 2:38 | `/` | Logo and URL | "Kept. Record the promise. Catch the drift. Verify the fix." |

Notes
- Keep narration off architecture until the proof section.
- Say "demo" and "replay" where the screen says it. The live claims belong only to the proof run.

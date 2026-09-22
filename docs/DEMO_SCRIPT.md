# Demo video: click-by-click script

Target 2:40, hard limit under 3:00. Site: https://gregarious-snail-975.convex.site

## Setup before you hit record

1. Chrome, new window, 1440 wide, zoom 100%, bookmarks bar hidden (`⌘⇧B`), no password prompts on screen.
2. **Tab 1:** sign in at `/login` with the builder proof account (credentials are in chat, not in this repo). It holds the finished real case: promise recorded, bills 20 to 23, case sent through AgentMail, provider reply, verified fix. Leave it on `/app`.
3. **Tab 2:** `/demo`. Let it finish seeding until you see the button **Bill 22 arrives**. Leave it there.
4. **Tab 3:** `/proof/run/live-loop-2026-09-22`, scrolled to the top.
5. **Tab 4:** `/` (landing), scrolled to the top.
6. Start recording on Tab 4.

Timings are cues, not a metronome. If you fall behind, cut words, not clicks.

---

### 0:00–0:10 · Tab 4, landing

**On screen:** hero headline and the demo-example strip.

**Do:** nothing. Stay still.

**Say:** "You were promised twenty-four monthly credits. Credit twenty-two disappeared. Kept is built for exactly that moment."

---

### 0:10–0:22 · Tab 1, the product

**Do:** switch to Tab 1 (`/app`). Point at the single plan row: Brightline Wireless, PROTECTED and VERIFIED FIXED.

**Say:** "This is the product. One protected plan, every bill checked against what I was promised, and this one has already been through a dispute and come out verified."

**Do:** click the plan row to open the item, then pause on the four numbers at the top.

**Say:** "Twenty-three of twenty-four credits billed. Nothing outstanding."

---

### 0:22–0:32 · Tab 2, start the demo

**Do:** switch to Tab 2 (`/demo`). Scroll so the blue notice and the step buttons are visible.

**Say:** "So you can see the whole story, here's the same pipeline on a synthetic example, from signup to verified fix."

---

### 0:32–0:45 · Demo, the recorded promise

**Do:** scroll to the outcome card (Brightline Wireless, 21 of 21 billed), then click **Recorded promises and sources** near the bottom to expand it. Point at the quoted excerpt.

**Say:** "Kept recorded the offer at signup: eighteen seventy-five a month for twenty-four months, with the exact sentence it came from. If the model can't quote the source, Kept rejects the term."

**Do:** collapse it again and scroll back up to the step button.

---

### 0:45–1:05 · Demo, the drift

**Do:** click **Bill 22 arrives**. Wait for the state to change (a couple of seconds).

**Say:** "Bill twenty-two arrives. It has charges and credits, but no promotional credit."

**Do:** point at the red MATERIAL DIFFERENCE badge, then at Observed missing value $18.75, then at the credit grid where cell 22 is red.

**Say:** "Kept compares it in plain code: expected eighteen seventy-five, observed zero. Months twenty-three and twenty-four aren't counted as missing, because those bills don't exist yet."

---

### 1:05–1:15 · Demo, Then vs Now

**Do:** scroll down to the **Then vs Now** table.

**Say:** "Then versus now: what was recorded, and what the bill actually says."

---

### 1:15–1:32 · Demo, the case

**Do:** scroll back to the step button and click **Open a case**. When the case appears, scroll to the evidence packet, then to the draft email.

**Say:** "Kept freezes an evidence packet, hashes it, and drafts a short support email from it. Every amount and date in that draft is checked against the packet. Nothing is sent until I approve."

---

### 1:32–1:45 · Demo, send and reply

**Do:** click **Approve and send**, then click **Support replies**.

**Say:** "I approve it, and the provider replies: the credit will be applied."

---

### 1:45–1:58 · Demo, the important part

**Do:** stop on the amber banner: "The provider says it's fixed. Kept hasn't verified it." Let it sit for a beat, then point at the provider-claims section below.

**Say:** "This is the part most tools get wrong. A support reply is not proof your next bill is correct. Kept stores it as their claim and waits."

---

### 1:58–2:12 · Demo, verified

**Do:** click **Bill 23 arrives**. Wait for green.

**Say:** "Bill twenty-three shows the credit again, plus a back-credit for the missed month. Only now does Kept call it verified fixed: thirty-seven fifty restored, and it says restored on a later bill, not because anyone claimed it."

---

### 2:12–2:24 · Demo, control and refusal

**Do:** click the tab **Control: page reworded**. Pause on "The page changed. The deal didn't."

**Say:** "Two more behaviours. A rewritten offer page with the same terms is not an alert."

**Do:** click the tab **Refusal: wrong seller**. Pause on "Kept can't establish this yet."

**Say:** "And a policy that may not cover your purchase is refused, not applied."

---

### 2:24–2:40 · Tab 3, live proof

**Do:** switch to Tab 3 (`/proof/run/live-loop-2026-09-22`). Scroll slowly past the recorded promise, the bills table with the red missing row, and the case timeline.

**Say:** "And this isn't only a demo. The same loop ran live on production through real email: this is the persisted record, with hashes instead of private content, and an independent verifier that passes eleven of eleven checks."

---

### 2:40–2:48 · Close

**Do:** switch to Tab 4 (landing), top of page.

**Say:** "Kept. Record the promise. Catch the drift. Verify the fix."

---

## Rules while recording

- Say "demo" once, at 0:22. Never call demo data live.
- Don't show code, the schema, or the repo.
- Don't list the four sponsors. Their work is visible in the product.
- If a demo step is slow, keep narrating the state on screen rather than apologising.
- If anything breaks, reload `/demo`; a fresh session reseeds in a few seconds.

## If you'd rather not sign in at all

Skip 0:10–0:22 and open with the landing hero straight into the demo. You lose the "this is a real account" beat but save twelve seconds and one login.

/**
 * Live production round trip through the real Kept UI. Requires a builder-owned
 * proof account (email/password passed as args, never committed). Spends a small
 * number of OpenAI calls. Bill texts come from the synthetic fixtures.
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const [base, email, pass, phase] = process.argv.slice(2);
const src = readFileSync(new URL("../convex/fixtures/canonical.ts", import.meta.url), "utf8");
const START = { year: 2024, month: 12 };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function billText(period, credit, backCredit = false) {
  const zero = START.year * 12 + (START.month - 1) + (period - 1);
  const year = Math.floor(zero / 12), monthName = MONTHS[zero % 12];
  const lines = [["Premium Plus unlimited plan (1 line)", "$85.00"], ["Aurora X15 device installment", "$37.50"]];
  if (credit) lines.push([`Device Promo Credit (${period} of 24)`, "-$18.75"]);
  if (backCredit) lines.push(["Promo credit adjustment - missed credit (22 of 24)", "-$18.75"]);
  lines.push(["Regulatory programs fee", "$3.49"], ["Taxes & surcharges", "$6.42"]);
  const total = lines.reduce((a, [, x]) => a + Math.round(Number(x.replace(/[$,]/g, "")) * 100), 0);
  return `SYNTHETIC TEST DOCUMENT - fictional provider.\n\nBRIGHTLINE WIRELESS - MONTHLY STATEMENT\nStatement date: ${monthName} 5, ${year}\nBilling period: ${monthName} ${year}\nPlan: Premium Plus\n\nCharges and credits\n${lines.map(([l, a]) => `${l.padEnd(52)} ${a}`).join("\n")}\n\nTotal due: $${(total / 100).toFixed(2)}\nDue by ${monthName} 28, ${year}`;
}
void src;

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(pass);
await page.getByRole("button", { name: /^sign in$/i }).click();
await page.getByRole("heading", { name: "My protected plans" }).waitFor({ timeout: 30000 });

async function waitIdle() {
  await page.waitForTimeout(1500);
  await page.getByText("Building your promise record.").waitFor({ state: "detached", timeout: 180000 }).catch(() => {});
}
async function pasteBill(text) {
  await page.getByLabel("bill or statement").check();
  await page.getByLabel("Or paste the email text").fill(text);
  await page.getByRole("button", { name: "Add text" }).click();
  await page.getByText("Saved. Kept is reading it now.").waitFor({ timeout: 20000 });
  await waitIdle();
}

if (phase === "setup") {
  await page.getByRole("link", { name: "Protect a plan" }).first().click();
  await page.getByLabel(/Provider/).fill("Brightline Wireless");
  await page.getByRole("button", { name: "Continue to evidence" }).click();
  await page.getByRole("heading", { name: "Add evidence" }).waitFor();
  const itemUrl = page.url();
  await page.goto(`${base}/app/inbox`);
  await page.getByRole("combobox").first().selectOption({ label: "Brightline Wireless · Plan" });
  await page.goto(itemUrl);
  await waitIdle();
  await page.getByText("Monthly").first().waitFor({ timeout: 120000 });
  console.log("item:", new URL(itemUrl).pathname);
  console.log("promise status:", await page.locator("main .badge").first().innerText());
  for (const p of [20, 21, 22]) {
    await pasteBill(billText(p, p !== 22));
    console.log(`bill ${p} ingested`);
  }
  await page.getByText("MATERIAL DIFFERENCE").first().waitFor({ timeout: 60000 });
  console.log("item reached MATERIAL DIFFERENCE");
}
if (phase === "bills") {
  await page.goto(`${base}${process.argv[6]}`);
  await page.getByRole("heading", { name: "Add evidence" }).waitFor();
  for (const p of process.argv[7].split(",").map(Number)) {
    await pasteBill(billText(p, p !== 22));
    console.log(`bill ${p} ingested`);
  }
}
if (phase === "case") {
  await page.goto(`${base}${process.argv[6]}`);
  await page.getByRole("button", { name: "Open an evidence-backed case" }).click();
  await page.waitForURL("**/app/cases/**", { timeout: 20000 });
  await page.getByText(/drafted from the evidence packet|fact-only template/i).first().waitFor({ timeout: 120000 });
  console.log("case:", new URL(page.url()).pathname);
  console.log("draft:", (await page.getByLabel("Message").inputValue()).slice(0, 700));
  await page.getByLabel(/^To/).fill(process.argv[7]);
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Saved. Review it, then approve to send.").waitFor();
  await page.getByRole("button", { name: "Approve and send" }).click();
  await page.getByRole("heading", { name: "Waiting for a reply" }).waitFor({ timeout: 60000 });
  console.log("UI shows WAITING FOR REPLY");
}
if (phase === "bill23") {
  // Tab A watches the case; tab B adds the bill. Tab A must update without a reload.
  const casePage = await page.context().newPage();
  await casePage.goto(`${base}${process.argv[7]}`);
  await casePage.getByText("The provider says it’s fixed. Kept hasn’t verified it.").waitFor({ timeout: 30000 });
  console.log("tab A: provider-claims banner visible");
  let reloaded = false;
  casePage.on("framenavigated", () => (reloaded = true));
  await page.goto(`${base}${process.argv[6]}`);
  await pasteBill(billText(23, true, true));
  console.log("tab B: bill 23 ingested");
  await casePage.getByText("Kept verified the fix.").waitFor({ timeout: 120000 });
  console.log("tab A: VERIFIED shown; tab A navigated/reloaded:", reloaded);
  await casePage.screenshot({ path: process.argv[8], fullPage: true });
}
console.log("page errors:", errors.length);
await browser.close();

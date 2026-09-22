import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(base + "/");
await page.getByRole("link", { name: "Try the demo" }).click();
const steps = ["Bill 22 arrives", "Open a case", "Approve and send", "Support replies", "Bill 23 arrives"];
for (const s of steps) {
  const b = page.getByRole("button", { name: s });
  await b.waitFor({ timeout: 60000 });
  if (s === "Open a case") { await page.getByText("MATERIAL DIFFERENCE").first().waitFor(); console.log("saw MATERIAL DIFFERENCE"); }
  if (s === "Bill 23 arrives") { await page.getByText("The provider says it’s fixed. Kept hasn’t verified it.").waitFor(); console.log("saw provider-claims banner"); }
  await b.click();
}
await page.getByText("Kept verified the fix.").waitFor({ timeout: 60000 });
console.log("saw verified fix");
if (process.env.SMOKE_SCREENSHOT) await page.screenshot({ path: process.env.SMOKE_SCREENSHOT, fullPage: true });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("horizontal overflow on mobile:", overflow);
await page.getByRole("tab", { name: /Control/ }).click();
await page.getByText("The page changed. The deal didn’t.").waitFor();
console.log("control ok");
await page.getByRole("tab", { name: /Refusal/ }).click();
await page.getByText("Kept can’t establish this yet").waitFor();
console.log("refusal ok");
await page.goto(base + "/demo");
await page.getByText("Kept verified the fix.").waitFor({ timeout: 20000 });
console.log("deep reload of /demo keeps session state");
console.log("page errors:", errors.length, errors.slice(0, 3));
await browser.close();

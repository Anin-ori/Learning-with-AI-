const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const mock = (seed) => `<script>
  window.__store = ${JSON.stringify(seed || {})};
  const doc = (p) => ({ get: async () => ({ exists: !!window.__store[p], data: () => JSON.parse(JSON.stringify(window.__store[p])) }), set: async (v) => { window.__store[p] = JSON.parse(JSON.stringify(v)); } });
  window.claude = { use: async (name) => name === "db" ? { doc } : null };
</script>`;
const wrap = (seed) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>${mock(seed)}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  async function open(name, vp, scheme, seed, mobile) {
    fs.writeFileSync(path.join(DIR, name + ".html"), wrap(seed));
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage(); const errs = [];
    page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await page.route("**/*", (route) => { const u = route.request().url();
      if (u.includes("cdnjs.cloudflare.com") && u.includes("/d3/")) return route.fulfill({ body: D3, contentType: "application/javascript" });
      if (u.startsWith("file:")) return route.continue(); return route.abort(); });
    await page.goto("file://" + path.join(DIR, name + ".html"));
    await page.waitForTimeout(1000);
    return { page, ctx, errs };
  }
  // 1. desktop light, fresh user
  let { page, ctx, errs } = await open("app1", { width: 1440, height: 900 }, "light");
  const info = await page.evaluate(() => ({
    pill: document.querySelector(".brand .pill").textContent, title: document.title,
    mapShown: !document.getElementById("kmap").hidden, layoutShown: getComputedStyle(document.querySelector(".layout")).display,
    hot: [...document.querySelectorAll("#kmap .km-ball.hot")].length, flashon: document.getElementById("kmap").classList.contains("km-flashon"),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  console.log("fresh:", JSON.stringify(info));
  await page.screenshot({ path: path.join(DIR, "app-map.png") });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(DIR, "app-map-b.png") });
  // toggle flash off, then on
  await page.click("#km-flash");
  console.log("after toggle:", await page.evaluate(() => [document.getElementById("kmap").classList.contains("km-flashon"), document.getElementById("km-flash").textContent, JSON.stringify(window.__store["state/current"] && window.__store["state/current"].map)]));
  await page.click("#km-flash");
  // open a top pick, mark its first point learned
  await page.click("#kmap .km-hotcard .km-pill"); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(DIR, "app-open.png") });
  await page.click("#km-p-det input[data-mark]"); await page.waitForTimeout(400);
  const saved = await page.evaluate(() => window.__store["state/current"] && window.__store["state/current"].map);
  console.log("saved map:", saved && { learned: saved.learned && saved.learned.length, flash: saved.flash });
  // guided path view
  await page.click("#view-path"); await page.waitForTimeout(300);
  console.log("path view:", await page.evaluate(() => [document.getElementById("kmap").hidden, getComputedStyle(document.querySelector(".layout")).display]));
  await page.screenshot({ path: path.join(DIR, "app-path.png") });
  console.log("errors 1:", errs.length ? errs : "none");
  await ctx.close();
  // 2. returning user: restored progress
  ({ page, ctx, errs } = await open("app2", { width: 1440, height: 900 }, "dark", { "state/current": { goal: "ML", map: { learned: ["run", "print", "comments", "tracebacks", "jupyter"], flash: true } } }));
  console.log("restored:", await page.evaluate(() => document.querySelector("#km-p-mine .km-small + h2 + .km-stat3 + .km-small").textContent));
  await page.screenshot({ path: path.join(DIR, "app-dark.png") });
  console.log("errors 2:", errs.length ? errs : "none");
  await ctx.close();
  // 3. phone
  ({ page, ctx, errs } = await open("app3", { width: 390, height: 844 }, "light", null, true));
  console.log("phone overflow:", await page.evaluate(() => document.documentElement.scrollWidth + " vs " + document.documentElement.clientWidth));
  await page.screenshot({ path: path.join(DIR, "app-phone.png"), fullPage: false });
  console.log("errors 3:", errs.length ? errs : "none");
  await ctx.close();
  await browser.close();
})();

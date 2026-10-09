// Renders a saved map from real data (no AI calls) and takes screenshots, to check the interface by eye.
// Usage: node look.js <map.json> <subject.json> [lang]   Screens go to out/look-*.png
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const [mapF, subjF, L] = process.argv.slice(2);
const unwrap = (f) => { const d = JSON.parse(fs.readFileSync(f, "utf8")); return d.data || d; };
const M = unwrap(mapF), S = unwrap(subjF), sid = S.sid;
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const DIR = __dirname, OUT = path.join(DIR, "out"); fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(DIR, "look.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style>${require("./mock")({ zh: L === "zh" })}</head><body>${fs.readFileSync(path.join(DIR, "..", "learning-companion.html"), "utf8")}</body></html>`);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const vp of [{ width: 1440, height: 900, n: "" }, { width: 390, height: 844, n: "-phone" }]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" }); if (u.startsWith("file:")) return r.continue(); return r.abort(); });
    await page.goto("file://" + path.join(DIR, "look.html") + (L ? "#lang=" + L : ""));
    await page.evaluate(([M, S, sid]) => { localStorage.setItem("lc-mock-db", JSON.stringify({ "app2/index": { v: 2, current: sid, order: [sid] }, ["subjects/" + sid]: S, ["maps/" + sid]: M })); }, [M, S, sid]);
    await page.reload(); await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "look-map" + vp.n + ".png") });
    await page.evaluate(() => { const b = document.querySelector("#km-p-mine [data-ball]"); if (b) b.click(); }); await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, "look-topic" + vp.n + ".png") });
    await page.evaluate(() => { const t = document.getElementById("km-t-src"); if (t) t.click(); }); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "look-about" + vp.n + ".png") });
    await page.evaluate(() => document.querySelector('#topnav [data-sec="learn"]').click()); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, "look-learn" + vp.n + ".png"), fullPage: true });
    console.log(vp.width, "errors:", errs.length ? errs : "none", "prompts:", await page.evaluate(() => (window.__prompts || []).map((p) => p.slice(0, 40))));
  }
  await browser.close();
})();

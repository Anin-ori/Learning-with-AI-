const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, PAGE = path.join(DIR, "..", "python-knowledge-map.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui;background:#fafafa}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${fs.readFileSync(PAGE, "utf8")}</body></html>`;
fs.writeFileSync(path.join(DIR, "wrapped.html"), html);

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" }).catch(() => chromium.launch());
  const runs = [
    { name: "desk-light", vp: { width: 1440, height: 900 }, scheme: "light" },
    { name: "desk-dark", vp: { width: 1440, height: 900 }, scheme: "dark" },
    { name: "phone-light", vp: { width: 390, height: 844 }, scheme: "light", mobile: true },
  ];
  for (const r of runs) {
    const ctx = await browser.newContext({ viewport: r.vp, colorScheme: r.scheme, isMobile: !!r.mobile, hasTouch: !!r.mobile, deviceScaleFactor: r.mobile ? 2 : 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    page.on("pageerror", e => errs.push("PAGEERROR " + e.message));
    await page.route("**/*", route => {
      const u = route.request().url();
      if (u.includes("cdnjs.cloudflare.com") && u.includes("d3")) return route.fulfill({ body: D3, contentType: "application/javascript" });
      if (u.startsWith("file:")) return route.continue();
      return route.abort();
    });
    await page.goto("file://" + path.join(DIR, "wrapped.html"));
    await page.waitForTimeout(900);
    const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    await page.screenshot({ path: path.join(DIR, r.name + ".png"), fullPage: !!r.mobile });
    if (r.name === "desk-light") {
      await page.evaluate(() => document.querySelector('#p-mine .pill').click()); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(DIR, "desk-open.png") });
      await page.evaluate(() => document.querySelector('#p-det [data-point]').click()); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(DIR, "desk-pointv.png") });
      await page.click('[data-toggle]'); await page.waitForTimeout(300);
      await page.click('#t-prob'); await page.click('[data-show="0"]'); await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(DIR, "desk-prob.png") });
    }
    if (r.name === "phone-light") {
      await page.evaluate(() => document.querySelector('#p-mine .pill').click()); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(DIR, "phone-open.png") });
    }
    console.log(r.name, "overflow", ov.sw > ov.cw ? `YES ${ov.sw}>${ov.cw}` : "no", "errors", errs.length ? errs : "none");
    await ctx.close();
  }
  await browser.close();
})();

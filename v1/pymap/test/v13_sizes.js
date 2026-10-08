// label overlap check at several window sizes
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const [w, h, m] of [[1440, 900], [1280, 720], [1024, 768], [390, 844, 1]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m, deviceScaleFactor: m ? 2 : 1 });
    const page = await ctx.newPage();
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" }); if (u.startsWith("file:")) return r.continue(); return r.abort(); });
    await page.goto("file://" + path.join(__dirname, "v13.html")); await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const labs = [...document.querySelectorAll("#kmap .km-blab")].filter((t) => t.getAttribute("display") !== "none").map((t) => t.getBoundingClientRect());
      const bodies = [...document.querySelectorAll("#kmap .km-body")].map((t) => t.getBoundingClientRect());
      let o = 0; const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      for (let i = 0; i < labs.length; i++) { for (let j = i + 1; j < labs.length; j++) if (hit(labs[i], labs[j])) o++; for (const b of bodies) if (hit(labs[i], b)) o++; }
      const fsz = document.querySelector("#kmap .km-blab").getBoundingClientRect().height;
      return { shown: labs.length, overlaps: o, k: +document.querySelector("#km-svg > g").getAttribute("transform").match(/scale\(([\d.]+)/)[1] };
    });
    console.log(w + "x" + h, JSON.stringify(r));
    await page.screenshot({ path: path.join(__dirname, `v13-size-${w}.png`) });
    await ctx.close();
  }
  await browser.close();
})();

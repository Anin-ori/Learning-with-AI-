const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" }); if (u.startsWith("file:")) return r.continue(); return r.abort(); });
  await page.goto("file://" + path.join(__dirname, "app1.html")); await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) {
    console.log(await page.evaluate(() => { const b = document.querySelector("#kmap .km-ball.hot"); const body = b.querySelector(".km-body"), glow = b.querySelector(".km-glow"); const cs = getComputedStyle(body), gs = getComputedStyle(glow);
      return { cls: b.getAttribute("class"), fill: cs.fill, anim: cs.animationName + " " + cs.animationDuration + " " + cs.animationPlayState, glowOp: gs.opacity, glowAnim: gs.animationName, glowFill: gs.fill, h: cs.getPropertyValue("--h"), reduce: matchMedia("(prefers-reduced-motion: reduce)").matches }; }));
    await page.waitForTimeout(500);
  }
  await browser.close();
})();

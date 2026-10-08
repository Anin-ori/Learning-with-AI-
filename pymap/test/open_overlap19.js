const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", HASH = L === "en" ? "" : "#lang=" + L, SUF = L === "en" ? "" : "-" + L;
const DIR = "/home/claude/lc/pymap/test";
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const [w, h, m] of [[1440, 900], [1024, 768], [390, 844, 1]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m, deviceScaleFactor: m ? 2 : 1 });
    const page = await ctx.newPage();
    await page.route("**/*", require("/home/claude/lc/pymap/test/fonts_route")(D3));
    await page.goto("file://" + path.join(DIR, "v19.html") + HASH); await page.waitForTimeout(1800);
    const ids = await page.evaluate(() => [...document.querySelectorAll("#kmap .km-ball")].map((g) => g.__data__.id));
    let tot = 0, worst = [], under = 0;
    for (const id of ids) {
      await page.evaluate((id) => { const g = [...document.querySelectorAll("#kmap .km-ball")].find((g) => g.__data__.id === id); g.querySelector(".km-hit").dispatchEvent(new MouseEvent("click", { bubbles: true })); }, id);
      await page.waitForTimeout(1300);
      const r = await page.evaluate(() => {
        const wrap = document.querySelector("#kmap .km-mapwrap").getBoundingClientRect();
        const bar = [...document.querySelectorAll("#kmap .km-bar > *, #kmap .km-legend")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.getBoundingClientRect());
        const op = (e) => { let o = 1; for (let x = e; x && x.tagName !== "svg"; x = x.parentElement) o *= +getComputedStyle(x).opacity; return o; };
        const T = [...document.querySelectorAll("#kmap svg text")].filter((t) => t.getAttribute("display") !== "none" && op(t) > 0.1 && t.textContent.trim()).map((t) => ({ t: t.textContent, b: t.getBoundingClientRect() }))
          .filter((x) => x.b.width > 0 && x.b.right > wrap.left && x.b.left < wrap.right && x.b.bottom > wrap.top && x.b.top < wrap.bottom);
        const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const pairs = [];
        for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (hit(T[i].b, T[j].b)) pairs.push(T[i].t + " × " + T[j].t);
        const hidden = T.filter((x) => bar.some((b) => hit(x.b, b))).map((x) => x.t);
        return { pairs, hidden };
      });
      tot += r.pairs.length; under += r.hidden.length;
      if (r.pairs.length || r.hidden.length) worst.push(id + ": " + [...r.pairs, ...r.hidden.map((x) => "under bar: " + x)].slice(0, 4).join("; "));
      await page.evaluate(() => document.getElementById("km-fit").click()); await page.waitForTimeout(500);
    }
    console.log(`${w}x${h}: ${tot} label collisions, ${under} labels under the bar/legend, across ${ids.length} opened topics`);
    worst.slice(0, 8).forEach((x) => console.log("  " + x));
    await ctx.close();
  }
  await browser.close();
})();

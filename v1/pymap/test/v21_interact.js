const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", HASH = L === "en" ? "" : "#lang=" + L, SUF = L === "en" ? "" : "-" + L;
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.route("**/*", require("./fonts_route")(D3));
  await page.goto("file://" + path.join(__dirname, "v21.html") + HASH); await page.waitForTimeout(1800);
  const st = () => page.evaluate(() => [...document.querySelectorAll("#kmap .km-ball")].map((g) => ({ id: g.__data__.id, open: g.classList.contains("open"), r: +(+g.querySelector(".km-body").getAttribute("r")).toFixed(1), base: +g.__data__.r.toFixed(1),
    dots: [...g.querySelectorAll(".km-dot")].filter((d) => +getComputedStyle(d).opacity > 0.5).length })).filter((x) => x.open || x.r !== x.base || x.dots));
  const clickBall = (id) => page.evaluate((id) => { const g = [...document.querySelectorAll("#kmap .km-ball")].find((g) => g.__data__.id === id); g.querySelector(".km-hit").dispatchEvent(new MouseEvent("click", { bubbles: true })); }, id);
  await clickBall("lists"); await page.waitForTimeout(900); console.log("open lists:", JSON.stringify(await st()));
  await clickBall("dicts"); await page.waitForTimeout(900); console.log("then dicts:", JSON.stringify(await st()));
  await page.evaluate(() => document.getElementById("km-fit").click()); await page.waitForTimeout(900); console.log("reset:", JSON.stringify(await st()), await page.evaluate(() => document.getElementById("km-t-mine").getAttribute("aria-selected")));
  await page.evaluate(() => document.querySelector("#kmap [data-act=clear]").click()); await page.waitForTimeout(300);
  console.log("after clear:", await page.evaluate(() => ({ learned: document.querySelectorAll("#kmap .km-ball.st-learned").length, ready: [...document.querySelectorAll("#kmap .km-ball.st-ready")].map((g) => g.__data__.name), hot: [...document.querySelectorAll("#kmap .km-ball.hot")].map((g) => g.__data__.name) })));
  await page.screenshot({ path: path.join(__dirname, `v21${SUF}-empty.png`) });
  console.log("errors:", errs.length ? errs : "none");
  await browser.close();
})();

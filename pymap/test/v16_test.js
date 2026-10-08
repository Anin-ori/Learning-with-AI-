const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const MOCK = fs.readFileSync(path.join(DIR, "pt.html"), "utf8").match(/<script>\s*window\.__store[\s\S]*?<\/script>/)[0];
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`;
fs.writeFileSync(path.join(DIR, "v16.html"), html);
const clickText = (page, sel, text) => page.evaluate(([sel, text]) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim() === text); if (!b) throw new Error("no " + text); b.click(); }, [sel, text]);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  async function open(vp, scheme, mobile) {
    const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage(); const errs = [];
    page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await page.route("**/*", require("./fonts_route")(D3));
    await page.goto("file://" + path.join(DIR, "v16.html")); await page.waitForTimeout(1800);
    return { ctx, page, errs };
  }
  const nav = (page) => page.evaluate(() => [...document.querySelectorAll("#topnav button")].filter((b) => b.getAttribute("aria-current") === "page").map((b) => b.textContent).join());
  // desktop light: the full flow
  let { ctx, page, errs } = await open({ width: 1440, height: 900 }, "light");
  console.log("start:", await nav(page), await page.evaluate(() => ({ hot: document.querySelectorAll("#kmap .km-ball.hot").length, sw: document.documentElement.scrollWidth, title: document.title })));
  await page.screenshot({ path: path.join(DIR, "v16-map.png") });
  await page.evaluate(() => document.querySelector("#kmap .km-pick").click()); await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(DIR, "v16-open.png") });
  await page.evaluate(() => document.querySelector("#km-p-det .km-nm[data-point]").click()); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(DIR, "v16-point.png") });
  await page.evaluate(() => document.querySelector("#km-p-det [data-learn]").click()); await page.waitForTimeout(500);
  console.log("after learn this point:", await nav(page), await page.evaluate(() => document.querySelector("#main h2").textContent));
  await page.screenshot({ path: path.join(DIR, "v16-learn-empty.png") });
  await clickText(page, "#main button", "Teach me this point");
  await page.waitForSelector(".lesson-card", { timeout: 15000 }); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, "v16-lesson.png"), fullPage: true });
  await clickText(page, "#main button", "Mark as learned"); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('#topnav [data-sec="notes"]').click()); await page.waitForTimeout(300);
  console.log("notes:", await nav(page), await page.evaluate(() => document.querySelectorAll(".pt-note li").length));
  await page.screenshot({ path: path.join(DIR, "v16-notes.png"), fullPage: true });
  await page.evaluate(() => document.querySelector('#topnav [data-sec="profile"]').click()); await page.waitForTimeout(300);
  console.log("profile:", await nav(page), await page.evaluate(() => [document.querySelector("#main .eyebrow").textContent, [...document.querySelectorAll(".subnav button")].map((b) => b.textContent + (b.disabled ? "(off)" : "")).join(" | ")]));
  await page.screenshot({ path: path.join(DIR, "v16-profile.png"), fullPage: true });
  await page.evaluate(() => document.querySelector('#topnav [data-sec="map"]').click()); await page.waitForTimeout(600);
  console.log("back to map:", await nav(page));
  console.log("errors (light):", errs.length ? errs : "none");
  await ctx.close();
  // desktop dark
  ({ ctx, page, errs } = await open({ width: 1440, height: 900 }, "dark"));
  await page.screenshot({ path: path.join(DIR, "v16-map-dark.png") });
  await page.evaluate(() => document.querySelector('#topnav [data-sec="learn"]').click()); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, "v16-learn-dark.png") });
  console.log("errors (dark):", errs.length ? errs : "none");
  await ctx.close();
  // phone
  ({ ctx, page, errs } = await open({ width: 390, height: 844 }, "light", true));
  console.log("phone overflow:", await page.evaluate(() => document.documentElement.scrollWidth + " vs " + document.documentElement.clientWidth));
  await page.screenshot({ path: path.join(DIR, "v16-phone.png") });
  console.log("errors (phone):", errs.length ? errs : "none");
  await ctx.close();
  await browser.close();
})();

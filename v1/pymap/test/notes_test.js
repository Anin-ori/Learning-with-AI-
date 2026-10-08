// Notes on the map: learn a point, ask the tutor, then open Notes and find both on the map.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", HASH = L === "en" ? "" : "#lang=" + L, SUF = L === "en" ? "" : "-" + L;
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const MOCK = fs.readFileSync(path.join(DIR, "pt.html"), "utf8").match(/<script>\s*window\.__store[\s\S]*?<\/script>/)[0];
fs.writeFileSync(path.join(DIR, "notes.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`);
const ZH = L === "zh" ? JSON.parse(fs.readFileSync(path.join(DIR, "..", "i18n", "zh.json"), "utf8")).exact : {};
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  await page.route("**/*", require("./fonts_route")(D3));
  await page.goto("file://" + path.join(DIR, "notes.html") + HASH); await page.waitForTimeout(1500);
  const click = (sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
  const clickText = (sel, text) => page.evaluate(([sel, text]) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim() === text); if (!b) throw new Error("no " + text); b.click(); }, [sel, ZH[text] || text]);
  // empty notes map first
  await click('#topnav [data-sec="notes"]'); await page.waitForTimeout(900);
  console.log("empty notes:", await page.evaluate(() => [document.querySelector('#topnav [aria-current="page"]').textContent, document.querySelector("#km-p-mine").innerText.slice(0, 120).replace(/\s+/g, " ")]));
  // learn a point and ask a question
  await click('#topnav [data-sec="learn"]'); await page.waitForTimeout(400);
  await page.evaluate(() => { const s = document.getElementById("pt-select"); s.value = "len"; s.dispatchEvent(new Event("change", { bubbles: true })); }); await page.waitForTimeout(300);
  await clickText("#main button", "Teach me this point");
  await page.waitForSelector(".lesson-card", { timeout: 15000 }); await page.waitForTimeout(300);
  await page.fill("#chat-input", "Why does len() count characters, not words?");
  await clickText("#main button", "Send"); await page.waitForTimeout(1200);
  console.log("saved qa:", await page.evaluate(() => JSON.stringify(window.__store["qa/all"]).slice(0, 200)));
  // notes on the map
  await click('#topnav [data-sec="notes"]'); await page.waitForTimeout(1500);
  console.log("notes mode:", await page.evaluate(() => ({ nav: document.querySelector('#topnav [aria-current="page"]').textContent, focus: document.querySelector(".km-focus.on") ? document.getElementById("km-focustext").textContent : null, lit: document.querySelectorAll("#kmap .km-ball.lit").length, index: document.querySelector("#km-p-mine").innerText.replace(/\s+/g, " ").slice(0, 300) })));
  await page.screenshot({ path: path.join(DIR, `v22${SUF}-notes-map.png`) });
  await page.evaluate(() => document.querySelector('#km-p-mine [data-point="len"]').click()); await page.waitForTimeout(1300);
  console.log("point pane:", await page.evaluate(() => document.querySelector("#km-p-det").innerText.replace(/\s+/g, " ").slice(0, 400)));
  await page.screenshot({ path: path.join(DIR, `v22${SUF}-notes-point.png`) });
  // back to Learn: the question is in the chat
  await page.evaluate(() => document.querySelector('#km-p-det [data-noteact="lesson"]').click()); await page.waitForTimeout(800);
  console.log("chat restored:", await page.evaluate(() => document.querySelectorAll("#chat-box .bubble").length));
  // map tab leaves notes mode
  await click('#topnav [data-sec="map"]'); await page.waitForTimeout(900);
  console.log("map mode:", await page.evaluate(() => [document.querySelector('#topnav [aria-current="page"]').textContent, !!document.querySelector(".km-focus.on"), document.querySelector("#km-p-mine h2").textContent]));
  // list view still reachable
  await click('#topnav [data-sec="notes"]'); await page.waitForTimeout(900);
  await page.evaluate(() => document.querySelector('#km-p-mine [data-noteact="list"]').click()); await page.waitForTimeout(500);
  console.log("list view:", await page.evaluate(() => document.querySelector("#main h2").textContent));
  console.log("errors:", errs.length ? errs : "none");
  await browser.close();
})();

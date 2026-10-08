// Chinese pass: collects every string still showing Latin letters, and records the full prompts sent to the AI.
// Collects every English string the interface shows (text nodes, placeholders, labels) across all screens.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const MOCK = fs.readFileSync(path.join(DIR, "pt.html"), "utf8").match(/<script>\s*window\.__store[\s\S]*?<\/script>/)[0].replace("=== NOTES ===", "=== DEEPER ===\\nA slice like `nums[1:3]` calls the special method `__getitem__` with a `slice` object. It is fine to skip this: More object-oriented design teaches it.\\n\\n=== NOTES ===").replace('pitfalls: ["The end index is not included"]', 'traps: [{ code: "nums = [10, 20, 30]\\nprint(nums[1:99])", expect: "an IndexError", actual: "[20, 30]", reveals: "Slicing clips its bounds to the list, unlike indexing." }], limits: ["Slices of a NumPy array share memory instead of copying (later, in data work)."], deeper: [{ what: "slicing calls the special method __getitem__", glimpse: "nums[1:3] becomes nums.__getitem__(slice(1, 3))", where: "More object-oriented design" }]');
fs.writeFileSync(path.join(DIR, "harvest.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`);
const ZH = JSON.parse(fs.readFileSync(path.join(DIR, "..", "i18n", "zh.json"), "utf8")).exact;
const SKIP = ".lesson, .bubble-text, .note-points, code, pre, script, style, textarea, .km-blab, .km-dot text, .km-names, datalist";
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => {
    window.__full = []; let c;
    Object.defineProperty(window, "claude", { configurable: true, get: () => c, set: (v) => {
      const use = v.use; c = { use: async (name) => { const r = await use(name); if (name !== "sample") return r;
        const w = (p, o) => { window.__full.push(p); return r(p, o); }; w.json = (p, o) => { window.__full.push(p); return r.json(p, o); }; return w; } }; } });
  });
  await page.route("**/*", require("./fonts_route")(D3));
  const seen = new Set();
  const grab = async (tag) => { const got = await page.evaluate((SKIP) => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (!t || !/[A-Za-z]/.test(t)) continue; if (n.parentElement && n.parentElement.closest(SKIP)) continue; out.push(t); }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((e) => ["placeholder", "aria-label", "title"].forEach((a) => { const v = e.getAttribute(a); if (v && /[A-Za-z]/.test(v)) out.push(v.trim()); }));
    return out; }, SKIP); got.forEach((t) => seen.add(t)); console.log(tag, got.length, seen.size); };
  const click = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (e) e.click(); return !!e; }, sel);
  const clickText = (sel, text) => page.evaluate(([sel, text]) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.trim() === text); if (b) b.click(); return !!b; }, [sel, ZH[text] || text]);
  await page.goto("file://" + path.join(DIR, "harvest.html") + "#lang=zh"); await page.waitForTimeout(1500);
  await grab("map");
  await click("#km-t-src"); await page.waitForTimeout(200); await grab("about");
  await click("#kmap .km-pick"); await page.waitForTimeout(900); await grab("topic");
  await page.mouse.move(700, 450); await page.waitForTimeout(100);
  await click("#km-p-det .km-nm[data-point]"); await page.waitForTimeout(500); await grab("point");
  // hover a topic for its tooltip
  await page.evaluate(() => { const g = document.querySelector("#kmap .km-ball .km-hit"); const r = g.getBoundingClientRect(); g.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.x + 2, clientY: r.y + 2 })); }); await grab("tip");
  await click("#km-fit"); await page.waitForTimeout(500);
  await page.fill("#km-q", "Strings"); await page.dispatchEvent("#km-q", "change"); await page.waitForTimeout(500); await grab("search");
  await click("#km-flash"); await page.waitForTimeout(200); await grab("glow off"); await click("#km-flash");
  await click('#topnav [data-sec="learn"]'); await page.waitForTimeout(400); await grab("learn empty");
  await page.evaluate(() => { const s = document.getElementById("pt-select"); s.value = s.options[3].value; s.dispatchEvent(new Event("change", { bubbles: true })); }); await page.waitForTimeout(400); await grab("learn chosen");
  await clickText("#main button", "Teach me this point"); await page.waitForTimeout(250); await grab("team running");
  await page.waitForSelector(".lesson-card", { timeout: 15000 }); await page.waitForTimeout(300); await grab("lesson");
  await page.evaluate(() => { document.querySelectorAll("#main details").forEach((d) => d.open = true); }); await grab("details open");
  await page.fill("#chat-input", "why?"); await clickText("#main button", "Send"); await page.waitForTimeout(800); await grab("chat");
  await clickText("#main button", "Mark as learned"); await page.waitForTimeout(300); await grab("learned");
  await click('#topnav [data-sec="notes"]'); await page.waitForTimeout(300); await grab("notes");
  await clickText("#main button", "Hide key terms"); await page.waitForTimeout(200); await grab("notes hidden");
  await click('#topnav [data-sec="profile"]'); await page.waitForTimeout(300); await grab("profile goal");
  await page.fill("#goal", "Use Python for machine learning projects").catch(() => {});
  await page.evaluate(() => { const t = document.querySelector("#main textarea"); if (t) { t.value = "Use Python for machine learning"; t.dispatchEvent(new Event("input", { bubbles: true })); } });
  await clickText("#main button", "Continue"); await page.waitForTimeout(800); await grab("after continue");
  for (const b of ["Level check", "AI guidance"]) { await clickText(".subnav button", b); await page.waitForTimeout(800); await grab("sub " + b); }
  await page.evaluate(() => { const b = [...document.querySelectorAll("#main button")].find((x) => /estimate|Ask|Start|Check/i.test(x.textContent)); if (b && !b.disabled) b.click(); }); await page.waitForTimeout(1500); await grab("reach run");
  await click("#log-btn"); await page.waitForTimeout(300); await grab("log");
  await click("#log-btn");
  await click('#topnav [data-sec="map"]'); await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.querySelector("#kmap [data-act=clear]"); if (b) b.click(); }); await page.waitForTimeout(500); await grab("empty map");
  fs.writeFileSync(path.join(DIR, "..", "i18n", "leftover_zh.json"), JSON.stringify([...seen].sort(), null, 1));
  const full = await page.evaluate(() => window.__full.map((p) => (Array.isArray(p) ? "CHAT[" + p.length + "] " + JSON.stringify(p[0]).slice(0, 80) + " … " + JSON.stringify(p[0].content).slice(-90) : String(p).slice(0, 60) + " … " + String(p).slice(-90))));
  console.log("PROMPTS:\n" + full.join("\n"));
  console.log("errors:", errs.length ? errs : "none");
  await browser.close();
})();

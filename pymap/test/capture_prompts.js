// Captures the exact prompts the app sends for one point lesson, so they can be run through a real model outside the page.
// usage: node capture_prompts.js <pid> <outdir> [answers.json]
//   answers.json may hold {"plan": {...planner JSON...}, "lesson": "teacher text"}; without them the run stops at the
//   first prompt that has no answer, which is all we need to capture the next stage's prompt.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const [pid, out, ansFile] = process.argv.slice(2);
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const ANS = ansFile ? JSON.parse(fs.readFileSync(ansFile, "utf8")) : {};
const STORE = `<script>
  window.__store = {}; window.__full = []; const ANS = ${JSON.stringify(ANS)};
  const doc = (p) => ({ get: async () => ({ exists: !!window.__store[p], data: () => JSON.parse(JSON.stringify(window.__store[p])) }), set: async (v) => { window.__store[p] = JSON.parse(JSON.stringify(v)); } });
  const sample = async (prompt, opts) => {
    window.__full.push(prompt);
    if (Array.isArray(prompt)) throw new Error("no chat answer");
    if ((String(prompt).startsWith("You teach") || String(prompt).startsWith("You write a lesson")) && ANS.lesson) return { text: ANS.lesson, truncated: false };
    if (String(prompt).startsWith("You wrote the lesson") && ANS.revised) return { text: ANS.revised, truncated: false };
    throw new Error("captured");
  };
  sample.json = async (prompt) => {
    window.__full.push(prompt);
    if (prompt.startsWith("You plan a lesson") && ANS.plan) return ANS.plan;
    if (prompt.startsWith("Check a lesson") && ANS.check) return ANS.check;
    throw new Error("captured");
  };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
fs.writeFileSync(path.join(DIR, "capture.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}[hidden]{display:none!important}</style>${STORE}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.route("**/*", require("./fonts_route")(D3));
  await page.goto("file://" + path.join(DIR, "capture.html")); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#topnav [data-sec="learn"]').click()); await page.waitForTimeout(400);
  await page.evaluate((pid) => { const s = document.getElementById("pt-select"); s.value = pid; s.dispatchEvent(new Event("change", { bubbles: true })); }, pid); await page.waitForTimeout(400);
  await page.evaluate(() => { const b = [...document.querySelectorAll("#main button")].find((x) => x.textContent.trim() === "Teach me this point"); b.click(); });
  await page.waitForTimeout(2500);
  const prompts = await page.evaluate(() => window.__full.map(String));
  fs.mkdirSync(out, { recursive: true });
  prompts.forEach((p, i) => fs.writeFileSync(path.join(out, `${i + 1}-${p.slice(0, 12).replace(/\W+/g, "_")}.txt`), p));
  const lesson = await page.evaluate(() => { const l = document.querySelector(".lesson"); return l ? l.innerText.slice(0, 200) : null; });
  console.log(pid, "prompts:", prompts.length, prompts.map((p) => p.slice(0, 30)), "lesson shown:", !!lesson);
  await browser.close();
})();

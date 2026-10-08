// Real-prompt check: runs the page with a sample() that hands every prompt to the outside world. Each prompt is written
// to cap/<n>.<kind>.prompt.txt; the script then waits for cap/<n>.answer.json (or .txt for text answers), written by a
// fresh model, and gives that to the page. Usage: SUBJECT="Python" GOAL="..." node capture.js [steps]
//   steps: "map" (build the map), "lesson" (then teach the first top pick), both by default.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, CAP = path.join(DIR, process.env.CAP || "cap");
fs.mkdirSync(CAP, { recursive: true });
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const STEPS = (process.argv[2] || "map,lesson").split(",");
const KIND = (p) => p.startsWith("You are the architect") ? "architect" : p.startsWith("You write the details") ? "writer" : p.startsWith("You mark the learner's route") ? "router"
  : p.startsWith("You review a knowledge map") ? "mapcheck" : p.startsWith("You plan a lesson") ? "planner" : p.startsWith("You write a lesson") ? "teacher"
  : p.startsWith("You review a lesson") ? "lessoncheck" : p.startsWith("You wrote the lesson") ? "reviser" : "other";
let n = 0;
const MOCK = `<script>
  const KEY = "lc-cap-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const doc = (p) => ({ get: async () => { const s = load(); return { exists: p in s, data: () => JSON.parse(JSON.stringify(s[p])) }; }, set: async (v) => { const s = load(); s[p] = JSON.parse(JSON.stringify(v)); save(s); }, delete: async () => { const s = load(); delete s[p]; save(s); } });
  const sample = async (input) => { const p = Array.isArray(input) ? input.map((m) => m.content).join("\\n\\n") : input; const t = await window.__ask(p, false); return { text: t, truncated: false }; };
  sample.json = async (p) => { const t = await window.__ask(p, true); try { return JSON.parse(t.replace(/^\\s*\`\`\`(?:json)?\\s*|\\s*\`\`\`\\s*$/g, "")); } catch (e) { throw { code: "invalid_json" }; } };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
fs.writeFileSync(path.join(DIR, "cap.html"), `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(path.join(DIR, "..", "learning-companion.html"), "utf8")}</body></html>`);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.exposeFunction("__ask", async (prompt, json) => {
    const i = String(++n).padStart(3, "0"), kind = KIND(prompt);
    const ans = path.join(CAP, i + ".answer." + (json ? "json" : "txt"));
    fs.writeFileSync(path.join(CAP, i + "." + kind + ".prompt.txt"), prompt);
    console.log("PROMPT", i, kind, prompt.length, "chars ->", path.basename(ans));
    for (let t = 0; t < 3600; t++) { if (fs.existsSync(ans) && fs.statSync(ans).size > 0) { await new Promise((r) => setTimeout(r, 300)); return fs.readFileSync(ans, "utf8"); } await new Promise((r) => setTimeout(r, 1000)); }
    return "";
  });
  const PYO = "/home/claude/pyo/pyodide/", TYPES = { ".js": "application/javascript", ".mjs": "application/javascript", ".wasm": "application/wasm", ".zip": "application/zip", ".json": "application/json" };
  await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" });
    const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/pyodide@0\.26\.4\/(.+)$/);
    if (m) { const f = PYO + m[1]; if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream", headers: { "access-control-allow-origin": "*" } }); return r.fulfill({ status: 404, body: "" }); }
    if (u.startsWith("file:")) return r.continue(); return r.abort(); });
  await page.goto("file://" + path.join(DIR, "cap.html"));
  await page.evaluate(() => localStorage.removeItem("lc-cap-db")); await page.reload(); await page.waitForTimeout(800);
  await page.fill("#subject", process.env.SUBJECT || "Python");
  await page.fill("#goal-text", process.env.GOAL || "Use Python for machine learning: load and clean data, train models with scikit-learn, and understand what the code does.");
  if (process.env.SITUATION) await page.fill("#situation", process.env.SITUATION);
  await page.evaluate(() => [...document.querySelectorAll("button.primary")].find((b) => /Build my map/.test(b.textContent)).click());
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.querySelectorAll("g.km-ball").length > 0 || !!document.querySelector("main .card.soft .msg"), null, { timeout: 0 });
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("lc-cap-db")));
  const sid = store["app2/index"] && store["app2/index"].current, M = sid && store["maps/" + sid];
  if (M) fs.writeFileSync(path.join(CAP, "map.json"), JSON.stringify(M, null, 1));
  else console.log("ERROR", await page.evaluate(() => (document.querySelector("main .msg") || {}).textContent));
  console.log("MAP", M ? M.balls.length + " topics, " + M.nodes.length + " points, " + M.links.length + " links, route " + M.route.goal.length + ", fixes " + M.checks.fixes.length + ", notes " + M.checks.notes.length : "not built");
  await page.waitForTimeout(2500); await page.screenshot({ path: path.join(CAP, "map.png") });
  if (M && STEPS.includes("lesson")) {
    if (process.env.POINT) {
      await page.fill("#km-q", process.env.POINT); await page.evaluate(() => document.getElementById("km-q").dispatchEvent(new Event("change"))); await page.waitForTimeout(800);
    } else {
      await page.evaluate(() => document.querySelector("#km-p-mine [data-ball]").click()); await page.waitForTimeout(800);
      await page.evaluate(() => { const b = [...document.querySelectorAll("#km-p-det .km-tag.route")][0]; const row = b ? b.closest(".km-prow") : document.querySelector("#km-p-det .km-prow"); row.querySelector("[data-point]").click(); }); await page.waitForTimeout(500);
    }
    await page.evaluate(() => document.querySelector("#km-p-det [data-learn]").click()); await page.waitForTimeout(300);
    await page.evaluate(() => [...document.querySelectorAll("button.primary")].find((b) => /Teach me this point/.test(b.textContent)).click());
    await page.waitForFunction(() => !!document.querySelector(".lesson-card") || /wasn.t finished|lesson wasn.t shown/.test(document.querySelector("main").innerText), null, { timeout: 0 });
    await page.screenshot({ path: path.join(CAP, "lesson.png"), fullPage: true });
    console.log("LESSON", await page.evaluate(() => document.querySelector(".lesson-card") ? "delivered" : document.querySelector(".msg") && document.querySelector(".msg").textContent));
  }
  console.log("DONE");
  await browser.close();
})().catch((e) => { console.log("CRASH", e); process.exit(1); });

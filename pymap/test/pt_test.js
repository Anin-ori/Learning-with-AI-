const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
// mock Claude: in-memory db + a scripted planner / teacher / checker
const MOCK = `<script>
  window.__store = {}; window.__prompts = [];
  const doc = (p) => ({ get: async () => ({ exists: !!window.__store[p], data: () => JSON.parse(JSON.stringify(window.__store[p])) }), set: async (v) => { window.__store[p] = JSON.parse(JSON.stringify(v)); } });
  let checks = 0;
  const LESSON = "## Taking part of a list\\nA **slice** copies a range of items: \`nums[1:3]\` gives the items at index 1 and 2.\\n\\n\`\`\`python\\nnums = [10, 20, 30, 40]\\nprint(nums[1:3])\\n\`\`\`\\n\\n\`\`\`\\nOutput:\\n[20, 30]\\n\`\`\`\\n\\n## Leaving out the ends\\nLeave out a number to run to the end: \`nums[:2]\` is \`[10, 20]\`.\\n\\n=== NOTES ===\\n- A **slice** \`a[i:j]\` returns a new list with items i up to, not including, j\\n- Leaving out \`i\` starts at the beginning; leaving out \`j\` runs to the end\\n- A **negative index** counts from the end: \`a[-2:]\` is the last two items\\n- Slicing never raises **IndexError**, even past the end";
  const sample = async (prompt, opts) => {
    await new Promise((r) => setTimeout(r, 120));
    const text = Array.isArray(prompt) ? "A slice makes a new list, so changing it leaves the original alone." : LESSON;
    window.__prompts.push(Array.isArray(prompt) ? "chat" : String(prompt).slice(0, 60));
    if (opts && opts.onText) opts.onText({ text });
    return { text, truncated: false };
  };
  sample.json = async (prompt) => {
    await new Promise((r) => setTimeout(r, 120));
    window.__prompts.push(String(prompt).slice(0, 60));
    if (prompt.startsWith("You plan a lesson")) return { aim: "Take any part of a list with a slice.", bridge: [], sections: [{ title: "Taking part of a list", teach: "Show a[i:j] with a predict-then-run example", example: "nums[1:3]" }, { title: "Leaving out the ends", teach: "Defaults for start and end", example: "nums[:2]" }], pitfalls: ["The end index is not included"], ml_link: "Splitting data into training and test sets uses slices.", practice: [{ n: 1, why: "slices a list of cards" }, { n: 99, why: "not in the list" }, { n: 3, why: "more slicing" }] };
    if (prompt.startsWith("Check a lesson")) { checks++; return checks === 1 ? { ok: false, problems: [{ quote: "nums[:2]", problem: "Say the result is a new list", fix: "Add that it is a copy" }] } : { ok: true, problems: [] }; }
    return {};
  };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`;
fs.writeFileSync(path.join(DIR, "pt.html"), html);
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage(); const errs = [];
    page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
    await page.route("**/*", (r) => { const u = r.request().url(); if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" }); if (u.startsWith("file:")) return r.continue(); return r.abort(); });
    await page.goto("file://" + path.join(DIR, "pt.html")); await page.waitForTimeout(900);
    // from the map: open a point and press "Learn this point"
    await page.fill("#km-q", "List slicing"); await page.dispatchEvent("#km-q", "change"); await page.waitForTimeout(700);
    if (scheme === "light") await page.screenshot({ path: path.join(DIR, "pt-map.png") });
    await page.evaluate(() => document.querySelector("#km-p-det [data-learn]").click()); await page.waitForTimeout(400);
    console.log(scheme, "after Learn this point:", await page.evaluate(() => [document.getElementById("kmap").hidden, document.querySelector("#main h2") && document.querySelector("#main h2").textContent, document.getElementById("pt-select") && document.getElementById("pt-select").value, document.body.className]), errs);
    if (scheme === "light") await page.screenshot({ path: path.join(DIR, "pt-step5-empty.png") });
    await page.evaluate(() => [...document.querySelectorAll("#main button")].find((b) => b.textContent === "Teach me this point").click()); await page.waitForTimeout(250);
    if (scheme === "light") await page.screenshot({ path: path.join(DIR, "pt-step5-building.png") });
    await page.waitForSelector(".lesson-card", { timeout: 15000 });
    const res = await page.evaluate(() => ({ prompts: window.__prompts, saved: Object.keys(window.__store), idx: window.__store["state/current"] && window.__store["state/current"].pointIndex,
      practice: [...document.querySelectorAll(".card.practice > ul li a")].map((a) => a.textContent) }));
    console.log(scheme, "requests:", res.prompts.length, res.prompts.map((p) => p.slice(0, 22)));
    console.log(scheme, "saved docs:", res.saved, "index keys:", res.idx && Object.keys(res.idx), "practice shown:", res.practice);
    if (scheme === "light") await page.screenshot({ path: path.join(DIR, "pt-step5-lesson.png"), fullPage: true });
    // tutor
    await page.fill("#chat-input", "Does a slice copy the list?"); await page.evaluate(() => document.querySelector(".tutor button.primary").click()); await page.waitForTimeout(400);
    // mark learned, check the map knows
    await page.evaluate(() => [...document.querySelectorAll("#main button")].find((b) => b.textContent === "Mark as learned").click()); await page.waitForTimeout(200);
    console.log(scheme, "map learned has listslice:", await page.evaluate(() => { const m = window.__store["state/current"].map; return m && m.learned && m.learned.includes("listslice"); }));
    // step 6
    await page.evaluate(() => [...document.querySelectorAll("#main button")].find((b) => b.textContent === "My notes").click()); await page.waitForTimeout(300);
    console.log(scheme, "notes:", await page.evaluate(() => [document.querySelector("#main h2").textContent, document.querySelectorAll(".pt-note li").length]));
    await page.evaluate(() => [...document.querySelectorAll("#main button")].find((b) => b.textContent === "Hide key terms").click()); await page.waitForTimeout(200);
    console.log(scheme, "blanks:", await page.evaluate(() => document.querySelectorAll(".note-blank").length));
    await page.screenshot({ path: path.join(DIR, `pt-step6-${scheme}.png`), fullPage: true });
    console.log(scheme, "errors:", errs.length ? errs : "none");
    await ctx.close();
  }
  await browser.close();
})();

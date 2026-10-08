// Practice section: readiness check, a built set (with the page running the reference solution in Pyodide), the learner's
// code checked against the tests, hints and the solution. Uses a mock AI; Pyodide is served from a local copy.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", HASH = L === "en" ? "" : "#lang=" + L, SUF = L === "en" ? "" : "-" + L;
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const PYO = "/home/claude/pyo/pyodide/";
const BAD_SOLUTION = false;
const ANS = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), OUT = process.argv[3];
const GOOD = "count = 0\ntotal = 0.0\nlargest = 0.0\nline = input()\nwhile line != '':\n    price = float(line)\n    count += 1\n    total += price\n    if count == 1 or price > largest:\n        largest = price\n    line = input()\nif count == 0:\n    print('no prices')\nelse:\n    print(count)\n    print(total)\n    print(largest)";
const SET = {
  when: "You've learned while loops, input() and comparisons, which is enough to write small programs that read until a stop signal.",
  how: ["Try each exercise without your notes first.", "Give yourself 20 minutes before taking a hint.", "After it passes, compare with the reference solution."],
  exercises: [{
    title: "Price tally", level: "core",
    task: "Read prices, one per line, until an empty line. Then print how many prices there were, their total and the largest, each on its own line as in the example. If the first line is empty, print `no prices`.\n\nExample: typing `2.5`, `4`, `1`, then an empty line prints:\n\n```\n3\n7.5\n4.0\n```\n\nPrompts for input() are optional and aren't checked.",
    combines: ["while loops", "Reading user input: input()", "Updating variables (+=)", "Comparison operators"],
    thinking: "Deciding what to keep track of while reading (a count, a total and the largest so far) and how to start the largest before you've seen any price.",
    starter: "",
    tests: [{ input: "2.5\n4\n1\n\n", output: "3\n7.5\n4.0" }, { input: "\n", output: "no prices" }, { input: "5\n\n", output: "1\n5.0\n5.0" }, { input: "1\n1\n1\n\n", output: "3\n3.0\n1.0" }],
    solution: BAD_SOLUTION ? "print('no prices')" : GOOD,
    _x: "count = 0\ntotal = 0.0\nlargest = 0.0\nline = input()\nwhile line != '':\n    price = float(line)\n    count += 1\n    total += price\n    if count == 1 or price > largest:\n        largest = price\n    line = input()\nif count == 0:\n    print('no prices')\nelse:\n    print(count)\n    print(total)\n    print(largest)",
    hints: ["What do you need to remember about the prices you've already read?", "What should 'largest' be before you've seen any price?"],
  }],
};
let checks = 0;
const MOCK = `<script>
  window.__store = {}; window.__prompts = [];
  const doc = (p) => ({ get: async () => ({ exists: !!window.__store[p], data: () => JSON.parse(JSON.stringify(window.__store[p])) }), set: async (v) => { window.__store[p] = JSON.parse(JSON.stringify(v)); } });
  let designs = 0;
  const sample = async () => ({ text: "ok", truncated: false });
  const ANS = ${JSON.stringify(ANS)};
  sample.json = async (prompt) => {
    window.__prompts.push(prompt);
    if (prompt.startsWith("You decide whether") && ANS.ready) return ANS.ready;
    if (prompt.startsWith("You write a practice set") && ANS.set) return ANS.set;
    if (prompt.startsWith("Check a practice set") && ANS.check) return ANS.check;
    throw { code: "captured" };
  };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
fs.writeFileSync(path.join(DIR, "practice.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style>${MOCK}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`);
const TYPES = { ".js": "application/javascript", ".mjs": "application/javascript", ".wasm": "application/wasm", ".zip": "application/zip", ".json": "application/json" };
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  const fonts = require("./fonts_route")(D3);
  await page.route("**/*", (r) => {
    const u = r.request().url();
    const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/pyodide@0\.26\.4\/(.+)$/);
    if (m) { const f = PYO + m[1]; if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream", headers: { "access-control-allow-origin": "*" } }); return r.fulfill({ status: 404, body: "" }); }
    return fonts(r);
  });
  await page.goto("file://" + path.join(DIR, "practice.html") + HASH); await page.waitForTimeout(1500);
  await page.evaluate(() => document.querySelector('#topnav [data-sec="practice"]').click()); await page.waitForTimeout(400);
  console.log("nav:", await page.evaluate(() => [...document.querySelectorAll("#topnav button")].map((b) => b.textContent + (b.getAttribute("aria-current") === "page" ? "*" : "")).join(" | ")));
  await page.screenshot({ path: path.join(DIR, `v21${SUF}-practice-start.png`) });
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  await page.waitForSelector(".pr-verdict.yes", { timeout: 5000 }); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(DIR, `v21${SUF}-practice-ready.png`) });
  if (ANS.ready) { await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click()); }
  await page.waitForTimeout(ANS.set ? 25000 : 4000);
  const ps = await page.evaluate(() => window.__prompts);
  fs.mkdirSync(OUT, { recursive: true }); ps.forEach((p, i) => fs.writeFileSync(path.join(OUT, (i + 1) + "-" + p.slice(0, 10).replace(/\W+/g, "_") + ".txt"), p));
  console.log("captured", ps.map((p) => p.slice(0, 30)), errs);
  await browser.close();
})();

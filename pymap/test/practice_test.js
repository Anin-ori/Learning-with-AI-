// Practice section: readiness check, a built set (with the page running the reference solution in Pyodide), the learner's
// code checked against the tests, hints and the solution. Uses a mock AI; Pyodide is served from a local copy.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", HASH = L === "en" ? "" : "#lang=" + L, SUF = L === "en" ? "" : "-" + L;
const DIR = __dirname, APP = path.join(DIR, "..", "..", "learning-companion.html");
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const PYO = "/home/claude/pyo/pyodide/";
const BAD_SOLUTION = process.env.BAD === "1";
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
  sample.json = async (prompt) => {
    await new Promise((r) => setTimeout(r, 80));
    window.__prompts.push(prompt);
    if (prompt.startsWith("You decide whether")) return { enough: true, why: "You can now read input in a loop, keep running totals and compare values, which together make small real programs.", focus: ["while loops", "Updating variables (+=)", "Reading user input: input()"], review: ["Comparison operators"], shape: "a small program that reads until a stop signal and summarises what it read", next: [] };
    const S = ${JSON.stringify(SET)}, X = S.exercises[0], DROP = ${process.env.DROP === "1"};
    const BROKEN = { title: "Broken counter", level: "stretch", task: "Count the lines until an empty line and print the count.", combines: ["while loops"], thinking: "x", starter: "", tests: [{ input: "a\\nb\\n\\n", output: "2" }], solution: "print(99)", hints: [] };
    if (prompt.startsWith("You design a practice set")) return { when: S.when, how: S.how, exercises: [{ title: X.title, level: X.level, combines: X.combines, idea: "Read prices until an empty line and summarise them.", thinking: X.thinking }].concat(DROP ? [{ title: BROKEN.title, level: "stretch", combines: ["while loops"], idea: "Count lines.", thinking: "x" }] : []) };
    if (prompt.startsWith("You write one exercise")) { if (/Write exercise 2,/.test(prompt)) return BROKEN; designs++; return X; }
    if (prompt.startsWith("You wrote exercise 2 ")) return BROKEN;
    if (prompt.startsWith("You wrote exercise 1 ")) { designs++; return { ...X, solution: ${JSON.stringify(GOOD)} }; }
    if (prompt.startsWith("You review a practice set")) return { errors: [], improvements: [{ exercise: 1, problem: "The second hint nearly gives away how to start the largest value.", fix: "Ask what the largest should be compared with first." }] };
    return {};
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
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  const t0 = Date.now();
  await page.waitForSelector(".pr-ex", { timeout: 90000 });
  console.log("set built in", ((Date.now() - t0) / 1000).toFixed(1) + "s;", await page.evaluate(() => document.querySelector(".pr-plan .small.muted").textContent));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, `v21${SUF}-practice-set.png`), fullPage: true });
  // a wrong attempt, then a right one
  await page.fill(".pr-code", "line = input()\nprint(line)");
  await page.evaluate(() => [...document.querySelectorAll(".pr-ex button.primary")][0].click());
  await page.waitForSelector(".pr-score", { timeout: 30000 });
  console.log("wrong attempt:", await page.evaluate(() => document.querySelector(".pr-score").textContent));
  await page.screenshot({ path: path.join(DIR, `v21${SUF}-practice-fail.png`), fullPage: true });
  await page.fill(".pr-code", "while True:\n    pass");
  await page.evaluate(() => [...document.querySelectorAll(".pr-ex button.primary")][0].click());
  await page.waitForFunction(() => !document.querySelector(".pr-results") || document.querySelector(".pr-results .msg"), { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  console.log("endless loop:", await page.evaluate(() => { const m = document.querySelector(".pr-results .msg"); return m ? m.textContent : "no message"; }));
  const right = "count = 0\ntotal = 0\nbig = None\nwhile True:\n    s = input('Price: ')\n    if s == '':\n        break\n    p = float(s)\n    count += 1\n    total += p\n    if big is None or p > big:\n        big = p\nif count == 0:\n    print('no prices')\nelse:\n    print(count)\n    print(float(total))\n    print(big)";
  await page.fill(".pr-code", right);
  await page.evaluate(() => [...document.querySelectorAll(".pr-ex button.primary")][0].click());
  await page.waitForTimeout(1500);
  console.log("right attempt:", await page.evaluate(() => [document.querySelector(".pr-score").textContent, !!document.querySelector(".pr-ex.solved")]));
  await page.evaluate(() => { const b = [...document.querySelectorAll(".pr-ex button.quiet")].find((x) => /hint|提示/i.test(x.textContent)); if (b) b.click(); });
  await page.evaluate(() => { const d = document.querySelector("details.pr-more"); d.open = true; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(DIR, `v21${SUF}-practice-solved.png`), fullPage: true });
  console.log("saved:", await page.evaluate(() => Object.keys(window.__store).filter((k) => k.startsWith("practice/")).map((k) => [k, window.__store[k].exercises[0].solved])));
  console.log("prompts:", await page.evaluate(() => window.__prompts.map((p) => p.slice(0, 40))));
  fs.writeFileSync("/tmp/claude-0/-home-claude/0fa055ae-b0c0-5c9c-abad-6ff76880d9cf/scratchpad/practice_prompts.json", JSON.stringify(await page.evaluate(() => window.__prompts)));
  console.log("log:", await page.evaluate(() => [...document.querySelectorAll("#log li")].slice(0, 4).map((l) => l.textContent.slice(0, 140))));
  if (L === "zh") {
    const grab = () => page.evaluate(() => { const SKIP = ".lesson, .bubble-text, code, pre, textarea, script, style, .km-blab, .km-dot text, datalist, #km-names"; const out = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) { const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (t && /[A-Za-z]{2}/.test(t) && !(n.parentElement && n.parentElement.closest(SKIP)) && n.parentElement.offsetParent !== null) out.add(t); }
      document.querySelectorAll("#main [placeholder],#main [aria-label],#main [title]").forEach((e) => ["placeholder", "aria-label", "title"].forEach((a) => { const v = e.getAttribute(a); if (v && /[A-Za-z]{2}/.test(v)) out.add("@" + v); }));
      return [...out]; });
    console.log("leftover English:", JSON.stringify(await grab()));
    await page.evaluate(() => document.querySelector('#topnav [data-sec="learn"]').click()); await page.waitForTimeout(300);
    console.log("learn leftovers:", JSON.stringify(await grab()));
  }
  console.log("errors:", errs.length ? errs : "none");
  await browser.close();
})();

// v2.0 end-to-end test with a mock AI: start a subject, build its map, learn a point, practise (Python, run in Pyodide),
// notes, profile (goal, route update, level check, AI guidance), a second subject that can't be run (written answers),
// switching subjects, and a reload that restores everything. L=zh runs it in Chinese.
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
const fs = require("fs"), path = require("path");
const L = process.env.L || "en", ZH = L === "zh", HASH = ZH ? "#lang=zh" : "", SUF = ZH ? "-zh" : "";
const DIR = __dirname, APP = path.join(DIR, "..", "learning-companion.html"), OUT = path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });
const D3 = fs.readFileSync("/opt/npm-tools/node_modules/d3/dist/d3.min.js", "utf8");
const PYO = "/home/claude/pyo/pyodide/";
const TYPES = { ".js": "application/javascript", ".mjs": "application/javascript", ".wasm": "application/wasm", ".zip": "application/zip", ".json": "application/json" };
fs.writeFileSync(path.join(DIR, "page.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}[hidden]{display:none!important}</style>${require("./mock")({ zh: ZH, badLesson: true })}</head><body>${fs.readFileSync(APP, "utf8")}</body></html>`);
const ok = (c, msg) => { if (!c) { console.log("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };
(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.includes("/d3/")) return r.fulfill({ body: D3, contentType: "application/javascript" });
    const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/npm\/pyodide@0\.26\.4\/(.+)$/);
    if (m) { const f = PYO + m[1]; if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || "application/octet-stream", headers: { "access-control-allow-origin": "*" } }); return r.fulfill({ status: 404, body: "" }); }
    if (u.startsWith("file:") || u.startsWith("blob:")) return r.continue();
    return r.abort();
  });
  const left = new Set();
  const harvest = async () => { if (!ZH) return; (await page.evaluate(() => {
    const SKIP = ".lesson, .bubble-text, .note-points, .note-ex, code, pre, textarea, script, style, [data-i18n-skip], [data-ai], #log";
    const out = []; const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = it.nextNode());) { const p = n.parentElement; if (!p || p.closest(SKIP) || !p.getClientRects().length) continue; const t = n.nodeValue.replace(/\s+/g, " ").trim(); if (/[A-Za-z]{3,}/.test(t) && !/^(Python|Pyodide|JavaScript|v2\.0|EN)$/.test(t)) out.push(t); }
    document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((e) => { if (e.closest("[data-ai],[data-i18n-skip]")) return; ["placeholder", "aria-label", "title"].forEach((a) => { const v = e.getAttribute(a); if (v && /[A-Za-z]{3,}/.test(v) && !/[\u4e00-\u9fff]/.test(v)) out.push("@" + a + ": " + v); }); });
    return out; })).forEach((x) => left.add(x)); };
  const shot = async (name, full) => { await harvest(); return page.screenshot({ path: path.join(OUT, name + SUF + ".png"), fullPage: !!full }); };
  const click = (sel) => page.evaluate((s) => { const el = typeof s === "string" ? document.querySelector(s) : null; if (!el) throw new Error("no " + s); el.click(); }, sel);
  const clickText = (sel, re) => page.evaluate(([s, r]) => { const el = [...document.querySelectorAll(s)].find((x) => new RegExp(r).test(x.textContent)); if (!el) throw new Error("no " + s + " " + r); el.click(); }, [sel, re]);
  const nav = (sec) => click(`#topnav [data-sec="${sec}"]`);

  await page.goto("file://" + path.join(DIR, "page.html") + HASH);
  await page.evaluate(() => localStorage.removeItem("lc-mock-db"));
  await page.reload(); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !!document.querySelector("#subject") && document.getElementById("kmap").hidden), "first visit opens the subject form, map hidden");
  await shot("v2-01-start", true);

  // ---- start a subject and build its map ----
  await page.fill("#subject", "Python");
  await page.fill("#goal-text", ZH ? "用 Python 做数据分析" : "Analyse data at work with Python");
  await clickText("button.primary", ZH ? "生成我的地图|Build my map" : "Build my map");
  await page.waitForTimeout(150);
  await shot("v2-02-building");
  await page.waitForFunction(() => !document.getElementById("kmap").hidden, null, { timeout: 30000 });
  await page.waitForTimeout(1600);
  await shot("v2-03-map");
  const mapInfo = await page.evaluate(() => ({ topics: document.querySelectorAll("g.km-ball").length, ticks: document.querySelectorAll(".km-tick").length, route: document.querySelectorAll("g.km-ball.route").length, hot: document.querySelectorAll("g.km-ball.hot").length, pill: document.getElementById("subject-pill").textContent }));
  console.log("map:", JSON.stringify(mapInfo));
  ok(mapInfo.topics === 6 && mapInfo.ticks === 20, "map has 6 topics and 20 points (19 + 1 added by the plan reviewer)");
  ok(mapInfo.route > 0 && mapInfo.hot > 0, "route rings and top picks show");
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("lc-mock-db")));
  const sid = store["app2/index"].current, M = store["maps/" + sid];
  const agents = await page.evaluate(() => ({ planners: window.__planners, planReviews: window.__planReviews, writers: window.__writers, reviewers: window.__reviewers }));
  ok(M.tree && M.tree.levels === 3 && agents.planners === 9 && agents.planReviews === 1 && agents.writers === 6 && agents.reviewers === 4, "the team: master, 3 areas divided, 6 topics named, 1 plan review, 6 writers, 3 area reviewers and 1 whole-map reviewer " + JSON.stringify({ tree: M.tree, agents }));
  ok(M.links.filter((l) => l[2] === "needs").length >= 19, "writers linked prerequisites by id across topics");
  ok(store["builds/" + sid] && store["builds/" + sid].status === "done", "the finished build is marked done");
  ok(M && M.checks.fixes.filter((f) => f.done).length === 3, "reviewers' fixes applied (3 done, 1 skipped): " + M.checks.fixes.map((f) => (f.done ? "+" : "-") + f.text).join(" | "));
  ok(M.checks.loopsDropped === 1, "the link that closed a loop was dropped by the page");
  // About tab
  await click("#km-t-src"); await page.waitForTimeout(200);
  await shot("v2-04-about");
  if (ZH) {
    const names = await page.evaluate(() => [...document.querySelectorAll(".km-blab")].map((t) => t.textContent));
    ok(names.length && names.every((n) => n.startsWith("译·")), "the map shows translated names (" + names[0] + ")");
    ok(!!(M.tr && M.tr.zh && M.tr.zh.nodes && Object.keys(M.tr.zh.nodes).length === M.nodes.length) && /^[A-Z]/.test(M.nodes[0].name), "the stored map keeps the English original and its translation");
    await page.evaluate(() => document.querySelector('#km-p-src [data-about="orig"]').click()); await page.waitForTimeout(1200);
    const en = await page.evaluate(() => [...document.querySelectorAll(".km-blab")].map((t) => t.textContent));
    ok(en.every((n) => !n.startsWith("译·")), "the switch shows the English original (" + en[0] + ")");
    await shot("v2-04b-original");
    await click("#km-t-src"); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#km-p-src [data-about="orig"]').click()); await page.waitForTimeout(1200);
    ok(await page.evaluate(() => document.querySelector(".km-blab").textContent.startsWith("译·")), "and back to the translation");
  } else ok(!(await page.evaluate(() => window.__translations)), "nothing is translated in English");
  ok(await page.evaluate(() => /reviewer/i.test(document.getElementById("km-p-src").textContent) || /审核/.test(document.getElementById("km-p-src").textContent)), "About explains how the map was built");
  // open a topic and a point
  await page.evaluate(() => document.querySelector("#km-p-mine .km-pick, #km-p-mine [data-ball]") ? 0 : 0);
  await click("#km-t-mine"); await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector("#km-p-mine [data-ball]").click()); await page.waitForTimeout(900);
  await shot("v2-05-topic");
  await page.evaluate(() => document.querySelector("#km-p-det [data-point]").click()); await page.waitForTimeout(500);
  await shot("v2-06-point");
  ok(await page.evaluate(() => !!document.querySelector("#km-p-det [data-learn]")), "point panel offers Learn this point");

  // ---- learn the point ----
  await page.evaluate(() => document.querySelector("#km-p-det [data-learn]").click()); await page.waitForTimeout(300);
  await clickText("button.primary", ZH ? "教我这个知识点|Teach me this point" : "Teach me this point");
  await page.waitForSelector(".lesson-card", { timeout: 20000 }); await page.waitForTimeout(200);
  await shot("v2-07-lesson", true);
  const lessonDoc = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("lc-mock-db")); const k = Object.keys(s).find((x) => x.startsWith("lessons2/")); return s[k]; });
  if (ZH) {
    ok(lessonDoc.tr && lessonDoc.tr.zh && lessonDoc.tr.zh.lesson.startsWith("译·") && !lessonDoc.lesson.startsWith("译·"), "the lesson is stored in English with its translation");
    ok(await page.evaluate(() => document.querySelector(".lesson-card").textContent.includes("译·")), "the learner reads the translated lesson");
    ok(await page.evaluate(() => !!document.querySelector(".orig-switch")), "the lesson offers the English original");
  }
  ok(lessonDoc && lessonDoc.rounds === 1 && lessonDoc.ran && lessonDoc.ran.n === lessonDoc.ran.of, "a wrong stated output was caught by running the example and fixed in one round (" + JSON.stringify(lessonDoc && { rounds: lessonDoc.rounds, ran: lessonDoc.ran }) + ")");
  const sentFix = await page.evaluate(() => window.__prompts.find((p) => p.startsWith("You wrote the lesson below")) || "");
  ok(/stated output is wrong/.test(sentFix), "the reviser was told what the example really printed");
  await page.fill("#chat-input", ZH ? "变量是什么？" : "What is a variable, really?");
  await clickText("button.primary", ZH ? "发送|Send" : "^Send$");
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelectorAll(".bubble.ai").length === 1), "tutor answered");
  await clickText("button.primary", ZH ? "标为已学|Mark as learned" : "Mark as learned");
  // mark a run of points learned from the map's first topics
  await page.evaluate(() => { const box = document.querySelectorAll("#topnav button"); });
  await nav("map"); await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll("#km-p-mine [data-ball]")][0]; b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector("#km-p-det [data-markall]") && document.querySelector("#km-p-det [data-markall]").click());
  await page.waitForTimeout(300);
  const learnedN = await page.evaluate(() => JSON.parse(localStorage.getItem("lc-mock-db"))["subjects/" + JSON.parse(localStorage.getItem("lc-mock-db"))["app2/index"].current].learned.length);
  ok(learnedN >= 3, "points marked learned are saved (" + learnedN + ")");

  // ---- practice (Python, run in the page) ----
  await nav("practice"); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  await page.waitForSelector(".pr-verdict.yes", { timeout: 5000 });
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  await page.waitForSelector(".pr-ex", { timeout: 90000 }); await page.waitForTimeout(200);
  console.log("set:", await page.evaluate(() => document.querySelector(".pr-plan .small.muted").textContent));
  ok(await page.evaluate(() => /ran its reference solutions|运行过参考答案/.test(document.querySelector(".pr-plan").textContent)), "Python set was run before showing");
  await page.fill(".pr-code", "n = 0\nline = input()\nwhile line != '':\n    n += 1\n    line = input()\nprint(n)");
  await page.evaluate(() => document.querySelector(".pr-ex button.primary").click());
  await page.waitForSelector(".pr-score", { timeout: 30000 });
  ok(await page.evaluate(() => document.querySelector(".pr-score").classList.contains("all")), "learner's right answer passes every test");
  await shot("v2-08-practice", true);

  // ---- notes ----
  await nav("notes"); await page.waitForTimeout(700);
  await shot("v2-09-notesmap");
  ok(await page.evaluate(() => /1/.test(document.querySelector("#km-p-mine").textContent)), "notes map lists the studied point");

  // ---- profile ----
  await nav("profile"); await page.waitForTimeout(300);
  await shot("v2-10-goal", true);
  await clickText("button", ZH ? "更新路线|Update the route" : "^Update the route$");
  await page.waitForFunction(() => !document.getElementById("kmap").hidden, null, { timeout: 15000 }); await page.waitForTimeout(500);
  ok(true, "route updated");
  await nav("profile"); await page.waitForTimeout(200);
  await clickText(".subnav button", ZH ? "水平检查|Level check" : "Level check"); await page.waitForTimeout(200);
  await clickText("button.primary", ZH ? "设置我的水平检查|Set my level check" : "Set my level check");
  await page.waitForSelector("#lv-0", { timeout: 5000 });
  await page.fill("#lv-0", "print('hi')");
  await clickText("button.primary", ZH ? "获取反馈|Get feedback" : "^Get feedback$");
  await page.waitForTimeout(500);
  await shot("v2-11-level", true);
  ok(await page.evaluate(() => [...document.querySelectorAll("button.primary")].some((b) => /solid|扎实/.test(b.textContent))), "level check offers to mark solid points");
  await clickText(".subnav button", ZH ? "AI 指导范围|AI guidance" : "AI guidance"); await page.waitForTimeout(200);
  await clickText("button.primary", ZH ? "询问三个模型|Ask the three models" : "Ask the three models"); await page.waitForTimeout(800);
  ok(await page.evaluate(() => !!document.querySelector(".verdict")), "AI guidance shows the three models' estimate");
  await shot("v2-12-reach", true);

  // ---- Check from Your subjects: reviewers per area, then the whole map; progress kept ----
  await clickText(".subnav button", ZH ? "科目|Subjects" : "Subjects"); await page.waitForTimeout(200);
  await clickText(".subject-list button", ZH ? "^检查$|^Check$" : "^Check$");
  await page.waitForFunction(() => window.__checks === 4, null, { timeout: 15000 }); await page.waitForTimeout(600);
  const chk = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("lc-mock-db")); const sid = s["app2/index"].current; const M = s["maps/" + sid]; return { checked: (M.checked || []).length, renamed: M.nodes.some((n) => / \(checked\)$/.test(n.name)), learned: s["subjects/" + sid].learned.length }; });
  ok(chk.checked === 1 && chk.renamed && chk.learned === 4, "Check: 3 area reviewers and a whole-map reviewer changed the map and kept progress " + JSON.stringify(chk));
  await clickText(".subject-list button", ZH ? "^重新构建$|^Rebuild$" : "^Rebuild$"); await page.waitForTimeout(150);
  ok(await page.evaluate(() => /won.t carry over|不会保留/.test(document.querySelector(".subject-list").innerText)), "Rebuild asks first");
  await clickText(".subject-list button", ZH ? "取消|Cancel" : "Cancel"); await page.waitForTimeout(100);

  // ---- a second subject that can't be run ----
  await clickText(".subnav button", ZH ? "科目|Subjects" : "Subjects"); await page.waitForTimeout(200);
  await page.fill("#subject", ZH ? "乐理" : "Music theory");
  await page.fill("#goal-text", ZH ? "给旋律配和弦" : "Harmonise simple melodies on the piano");
  // this build stops part-way (a usage limit), then continues without redoing finished work
  await page.evaluate(() => { window.__planners = 0; window.__failPlannerAt = 2; });
  await clickText("button.primary", ZH ? "生成我的地图|Build my map" : "Build my map");
  await page.waitForFunction(() => [...document.querySelectorAll("button.primary")].some((b) => !b.disabled && /Continue building|继续生成/.test(b.textContent)), null, { timeout: 30000 });
  await shot("v2-12b-paused", true);
  const paused = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("lc-mock-db")); const k = Object.keys(s).filter((x) => x.startsWith("builds/")).map((x) => s[x]).find((b) => b.status === "paused"); return k ? { done: Object.values(k.nodes).filter((n) => n.state !== "todo").length, planners: window.__planners } : null; });
  ok(paused && paused.done >= 2, "a stopped build is saved part-way and offers to continue " + JSON.stringify(paused));
  await clickText("button.primary", ZH ? "继续生成|Continue building" : "Continue building");
  await page.waitForFunction(() => !document.getElementById("kmap").hidden, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  await shot("v2-13-music-map");
  ok(await page.evaluate(() => document.querySelectorAll("g.km-ball").length === 3), "second subject has its own map");
  const pl = await page.evaluate(() => window.__planners);
  ok(pl === 4, "continuing didn't redo finished work (4 planners in all: " + pl + ")");
  await page.evaluate(() => { document.querySelector("#km-p-mine [data-ball]").click(); }); await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector("#km-p-det [data-markall]").click()); await page.waitForTimeout(200);
  await nav("practice"); await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  await page.waitForSelector(".pr-verdict.yes", { timeout: 5000 });
  await page.evaluate(() => document.querySelector(".pr-verdict button.primary").click());
  await page.waitForSelector(".pr-ex", { timeout: 30000 });
  ok(await page.evaluate(() => /Nothing in this subject can be run|无法运行/.test(document.querySelector(".pr-plan").textContent)), "the set says nothing could be run");
  await page.fill(".pr-code", ZH ? "C 配 C 大三和弦，因为包含 C。" : "C: C major, because it contains C. D: G major. E: E minor.");
  await page.evaluate(() => document.querySelector(".pr-ex button.primary").click());
  await page.waitForSelector(".pr-results", { timeout: 5000 }); await page.waitForTimeout(200);
  await shot("v2-14-music-practice", true);
  ok(await page.evaluate(() => /AI feedback|AI 反馈/.test(document.querySelector(".pr-results").textContent)), "written answers get labelled AI feedback");

  // ---- switch back, then reload ----
  await nav("profile"); await page.waitForTimeout(200);
  await clickText(".subnav button", ZH ? "科目|Subjects" : "Subjects"); await page.waitForTimeout(200);
  await shot("v2-15-subjects", true);
  await clickText(".subject-list button.primary", ZH ? "打开|Open" : "^Open$");
  await page.waitForTimeout(1200);
  ok(await page.evaluate(() => /Python/.test(document.getElementById("subject-pill").textContent)), "switched back to Python");
  await page.reload(); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ pill: document.getElementById("subject-pill").textContent, map: !document.getElementById("kmap").hidden, lit: document.querySelectorAll(".km-tick.on").length }));
  ok(after.map && /Python/.test(after.pill) && after.lit >= 3, "reload restores the open subject, its map and progress " + JSON.stringify(after));
  await nav("learn"); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !!document.querySelector(".lesson-card") && document.querySelectorAll(".bubble").length >= 2), "reload restores the lesson and the saved question");
  await shot("v2-16-reloaded-learn", true);
  // small screen
  await page.setViewportSize({ width: 390, height: 844 }); await nav("map"); await page.waitForTimeout(800);
  await shot("v2-17-phone-map");
  await nav("profile"); await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) console.log("wide:", await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && r.width > 0 && !e.closest(".subnav, #topnav, #log"); }).slice(0, 8).map((e) => e.tagName + "." + e.className + " " + (e.textContent || "").slice(0, 30) + " " + Math.round(e.getBoundingClientRect().right)).join("\n")));
  ok(!overflow, "no horizontal scroll on a phone");
  await shot("v2-18-phone-profile", true);

  // ---- switching the language: what the AI wrote follows, translated the first time it's shown ----
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("file://" + path.join(DIR, "page.html") + (ZH ? "#lang=en" : "#lang=zh")); await page.reload(); await page.waitForTimeout(2500);
  const sw = await page.evaluate(() => ({ lab: document.querySelector(".km-blab") && document.querySelector(".km-blab").textContent, tr: window.__translations || 0 }));
  ok(ZH ? !/^译·/.test(sw.lab) : /^译·/.test(sw.lab) && sw.tr > 0, "after switching language, the map shows in the new language " + JSON.stringify(sw));
  await nav("learn"); await page.waitForTimeout(1500);
  const lsw = await page.evaluate(() => (document.querySelector(".lesson-card") || {}).textContent || "");
  ok(ZH ? !/译·/.test(lsw) : /译·/.test(lsw), "and so does the lesson");
  await page.screenshot({ path: path.join(OUT, "v2-19-switched" + SUF + ".png") });   // no harvest: the page is in the other language now

  if (ZH) { fs.writeFileSync(path.join(OUT, "untranslated.txt"), [...left].join("\n")); console.log("untranslated strings:", left.size); }
  console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no page errors");
  if (errs.length) process.exitCode = 1;
  await browser.close();
})().catch((e) => { console.log("CRASH", e); process.exit(1); });

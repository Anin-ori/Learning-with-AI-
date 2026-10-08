  // ---------- Practice (v1.11) ----------
  // Practice is its own section, not the end of a lesson. The AI first judges whether what the learner has learned can
  // combine into practice worth doing; then it writes the exercises under the practice standards; the page runs the
  // AI's own reference solution against its tests in the browser (Pyodide) and a checker holds the set to the standards.
  // Only a set that passes both is shown. The learner then writes code here and checks it against the same tests.
  const PYO_URL = "https://cdn.jsdelivr.net/npm/pyodide@0.26.4/";
  const PY = { api: null, loading: null, error: null };
  const PY_HARNESS = [
    "import sys, io, traceback",
    "class _LCTooLong(Exception):",
    "    pass",
    "def _lc_run(src, stdin_text, checks, limit=400000):",
    "    out = io.StringIO()",
    "    feed = stdin_text.split('\\n') if stdin_text else []",
    "    if feed and feed[-1] == '':",
    "        feed.pop()",
    "    pos = [0]",
    "    def _input(prompt=''):",
    "        if pos[0] >= len(feed):",
    "            raise EOFError('the program asked for more input than this test types in')",
    "        v = feed[pos[0]]",
    "        pos[0] += 1",
    "        return v",
    "    steps = [0]",
    "    def _tr(frame, event, arg):",
    "        if frame.f_code.co_filename in ('<your code>', '<check>'):",
    "            if event == 'line':",
    "                steps[0] += 1",
    "                if steps[0] > limit:",
    "                    raise _LCTooLong()",
    "            return _tr",
    "        return None",
    "    g = {'__name__': '__main__', 'input': _input}",
    "    old = sys.stdout",
    "    sys.stdout = out",
    "    err = None",
    "    fails = []",
    "    try:",
    "        sys.settrace(_tr)",
    "        try:",
    "            exec(compile(src, '<your code>', 'exec'), g)",
    "            for i, c in enumerate(checks):",
    "                try:",
    "                    exec(compile(c, '<check>', 'exec'), g)",
    "                except AssertionError:",
    "                    fails.append(i)",
    "        finally:",
    "            sys.settrace(None)",
    "    except _LCTooLong:",
    "        err = 'TOO_LONG'",
    "    except SystemExit:",
    "        pass",
    "    except SyntaxError as e:",
    "        err = 'Line ' + str(e.lineno) + ': SyntaxError: ' + str(e.msg)",
    "    except BaseException as e:",
    "        tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename in ('<your code>', '<check>')]",
    "        where = ('Line ' + str(tb[-1].lineno) + ': ') if tb and tb[-1].filename == '<your code>' else ''",
    "        err = where + type(e).__name__ + ((': ' + str(e)) if str(e) else '')",
    "    finally:",
    "        sys.stdout = old",
    "    return {'out': out.getvalue(), 'err': err, 'fails': fails}",
  ].join("\n");
  function loadPy() {
    if (PY.api) return Promise.resolve(PY.api);
    if (PY.loading) return PY.loading;
    PY.loading = (async () => {
      if (typeof window.loadPyodide !== "function") {
        await new Promise((ok, bad) => { const s = document.createElement("script"); s.src = PYO_URL + "pyodide.js"; s.onload = ok; s.onerror = () => bad(new Error("pyodide.js didn't load")); document.head.appendChild(s); });
      }
      const api = await window.loadPyodide({ indexURL: PYO_URL, stdout: () => {}, stderr: () => {} });
      api.runPython(PY_HARNESS);
      PY.api = api; PY.error = null;
      return api;
    })().catch((e) => { PY.error = String((e && e.message) || e).slice(0, 200); PY.loading = null; logEvent("practice", "Python couldn't start in this page: " + PY.error); throw e; });
    return PY.loading;
  }
  const normOut = (s) => String(s || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");
  async function runTest(src, t) {
    const api = await loadPy();
    const fn = api.globals.get("_lc_run");
    const res = fn(src, t.input || "", api.toPy(t.check ? [t.check] : []));
    const r = res.toJs({ dict_converter: Object.fromEntries }); res.destroy(); fn.destroy();
    const out = String(r.out || ""), err = r.err === "TOO_LONG" ? "TOO_LONG" : r.err;
    const pass = !err && !(r.fails || []).length && (t.output == null || normOut(out) === normOut(t.output));
    return { pass, out, err };
  }
  async function runAll(src, tests) { const out = []; for (const t of tests) out.push(await runTest(src, t)); return out; }

  // ---------- what the learner knows ----------
  function learnedPids() { return km ? km.data.KD.balls.flatMap((b) => b.pts.filter((p) => km.isLearned(p))) : []; }
  function learnedText() {
    const P = km.data, idx = state.pointIndex || {};
    const lines = P.KD.balls.map((b) => { const xs = b.pts.filter((p) => km.isLearned(p)); return xs.length ? "- " + b.name + ": " + xs.map(ptName).join("; ") : ""; }).filter(Boolean);
    const recent = Object.keys(idx).filter((p) => P.byId[p] && km.isLearned(p)).sort((a, b) => String(idx[b].at || "").localeCompare(String(idx[a].at || ""))).slice(0, 8);
    let budget = 5000;
    const taught = recent.map((p) => { const t = "- " + ptName(p) + ": " + (idx[p].notes || []).join(" | "); budget -= t.length; return budget > 0 ? t : ""; }).filter(Boolean);
    return ["Points the learner has learned, by topic (the learner knows these and nothing else):", lines.join("\n") || "- none yet",
      recent.length ? "Studied most recently, newest first: " + recent.map(ptName).join(", ") + "." : "",
      taught.length ? "What their lessons actually taught for those points (the lesson notes):\n" + taught.join("\n") : ""].filter(Boolean).join("\n");
  }
  const learnedSig = () => learnedPids().join(",");
  const prevSetsText = () => (state.practice || []).slice(-3).map((s) => "- " + (s.titles || []).join("; ")).join("\n");

  // ---------- prompts ----------
  const readinessPrompt = () => [
    "You decide whether a self-learner of " + SUBJECT.name + " should practise now, in Learning Companion, a study tool. Practice here is a separate section with exercises an AI writes for them.",
    ptLearner(), "", learnedText(), "",
    STANDARDS.readiness(SUBJECT),
    (state.practice || []).length ? "Practice sets they already did (don't repeat them):\n" + prevSetsText() : "",
    "", 'Reply with only JSON: {"enough": true or false, "why": "at most two plain sentences", "focus": ["learned points the practice should combine, recent ones first"], "review": ["older learned points worth bringing back inside the tasks"], "shape": "if enough: one sentence on what kind of task fits", "next": ["if not enough: up to 3 points from the map whose learning would make practice worth doing"]}',
  ].filter((x) => x !== "").join("\n");
  const designPrompt = (R) => [
    "You write a practice set for a self-learner of " + SUBJECT.name + " in Learning Companion, a study tool.",
    ptLearner(), "", learnedText(), "",
    "A first AI judged that practice is worth doing now. Its reasons: " + R.why,
    "Combine these points: " + R.focus.join(", ") + "." + (R.review.length ? " Bring these back as review where they fit: " + R.review.join(", ") + "." : ""),
    R.shape ? "Suggested kind of task: " + R.shape : "",
    (state.practice || []).length ? "Sets they already did (write different tasks):\n" + prevSetsText() : "",
    "", STANDARDS.practice(SUBJECT), "",
    'Reply with only JSON: {"when": "one or two sentences: why practising this now makes sense", "how": ["2 to 4 short pieces of advice on how to practise these"], "exercises": [{"title": "short title", "level": "warm-up, core or stretch", "task": "the full task in Markdown, with what the program reads, what it prints and at least one worked example", "combines": ["learned points it uses"], "thinking": "the decision the learner has to work out, which is why this is not a drill", "starter": "starter code or an empty string", "tests": [{"input": "the typed lines, one per line", "output": "exactly what the program prints"}], "solution": "a reference solution that uses only what the learner has learned", "hints": ["a first nudge", "a stronger nudge, still without code"]}]}',
  ].filter((x) => x !== "").join("\n");
  const setText = (S) => S.exercises.map((x, i) => [
    "Exercise " + (i + 1) + ": " + x.title + " (" + x.level + ")", "Combines: " + x.combines.join(", "), "Thinking: " + x.thinking,
    "Task:\n" + x.task, x.starter ? "Starter:\n" + x.starter : "", "Reference solution:\n" + x.solution,
    "Tests:\n" + x.tests.map((t, j) => "  " + (j + 1) + ". " + (t.check ? "check: " + t.check : "input " + JSON.stringify(t.input || "") + " -> output " + JSON.stringify(t.output || ""))).join("\n"),
    "Hints: " + x.hints.join(" | "),
  ].filter(Boolean).join("\n")).join("\n\n");
  const practiceCheckPrompt = (R, S, ran) => [
    "Check a practice set before a self-learner of " + SUBJECT.name + " sees it. Be strict about the standards and the tests, lenient about wording.",
    ptLearner(), "", learnedText(), "",
    "Points the set should combine: " + R.focus.join(", ") + ".", "", STANDARDS.practice(SUBJECT), "",
    "The set:", "<<<", setText(S), ">>>",
    ran ? "The page ran each reference solution against its tests: " + ran : "The page could not run the code here, so check every expected output by reasoning.",
    "", "Blocking problems (list every one): " + STANDARDS.practiceChecker(SUBJECT) + ".",
    "Not problems: wording, length, the choice of task when it meets the standards.",
    'Reply with only JSON: {"ok": true or false, "problems": [{"exercise": 1, "problem": "what is wrong", "fix": "what to do"}]}',
  ].join("\n");
  const practiceFixPrompt = (R, S, probs) => [
    "You wrote the practice set below. Fix every problem listed and change nothing else. A fix may replace an exercise that can't be repaired.",
    ptLearner(), "", learnedText(), "",
    "Points the set should combine: " + R.focus.join(", ") + ".", "", STANDARDS.practice(SUBJECT), "",
    "Problems to fix:", probs.map((p, i) => (i + 1) + ". " + (p.exercise ? "Exercise " + p.exercise + ": " : "") + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n"),
    "", "Your set:", JSON.stringify(S), "",
    "Reply with only the whole corrected set as JSON, in the same shape.",
  ].join("\n");

  // ---------- reading the AI's answers ----------
  const pstr = (x) => (typeof x === "string" ? x.trim() : "");
  const parr = (x) => (Array.isArray(x) ? x : []);
  function normReady(d) {
    if (!d || typeof d.enough !== "boolean") throw { code: "invalid_json", agent: "Judge" };
    return { enough: d.enough, why: pstr(d.why), focus: parr(d.focus).map(pstr).filter(Boolean).slice(0, 8), review: parr(d.review).map(pstr).filter(Boolean).slice(0, 6), shape: pstr(d.shape), next: parr(d.next).map(pstr).filter(Boolean).slice(0, 3) };
  }
  function normSet(d) {
    const ex = parr(d && d.exercises).map((x) => ({
      title: pstr(x && x.title), level: pstr(x && x.level), task: pstr(x && x.task), combines: parr(x && x.combines).map(pstr).filter(Boolean),
      thinking: pstr(x && x.thinking), starter: typeof (x && x.starter) === "string" ? x.starter.replace(/\s+$/, "") : "", solution: typeof (x && x.solution) === "string" ? x.solution : "",
      tests: parr(x && x.tests).map((t) => ({ input: typeof (t && t.input) === "string" ? t.input : "", output: typeof (t && t.output) === "string" ? t.output : (t && t.check ? null : ""), check: pstr(t && t.check) || undefined })).filter((t) => t.check || t.output != null).slice(0, 10),
      hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 3),
    })).filter((x) => x.title && x.task && x.solution && x.tests.length >= 2).slice(0, 3);
    if (!ex.length) throw { code: "invalid_json", agent: "Designer" };
    return { when: pstr(d.when), how: parr(d.how).map(pstr).filter(Boolean).slice(0, 4), exercises: ex };
  }
  const normProblemsPr = (v) => parr(v && v.problems).map((p) => ({ exercise: Number(p && p.exercise) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  const shortOut = (s) => JSON.stringify(String(s == null ? "" : s).slice(0, 300));

  // ---------- the jobs ----------
  async function judgePractice() {
    if (!km || !aiReady() || ui.pjudge && ui.pjudge.running) return;
    const job = { id: "pjudge", requests: 0, cancel: false, running: true };
    ui.pjudge = job; render();
    try {
      const R = normReady(await ask(job, "Judge", readinessPrompt(), "default", true));
      state.practiceReady = { sig: learnedSig(), at: new Date().toISOString(), ...R };
      saveState();
      logEvent("practice", "Practice check: " + (R.enough ? "worth practising now" : "not yet") + ". " + R.why);
    } catch (e) {
      job.error = (e && e.agent ? e.agent + ": " : "") + noteAiError(e);
      notify("The practice check didn't finish. " + job.error, "bad");
    } finally { job.running = false; render(); }
  }
  const PRACTICE_ROUNDS = 2;
  async function buildPractice() {
    const R = state.practiceReady;
    if (!R || !aiReady() || (ui.pjob && ui.pjob.running)) return;
    const focus = R.focus.length ? R : { ...R, focus: learnedPids().slice(-5).map(ptName) };
    const job = { id: "pset", requests: 0, cancel: false, running: true, stage: "design", rounds: 0, problems: [], ran: null };
    ui.pjob = job; render();
    const paint = () => { if (ui.step === "practice") render(); };
    try {
      let S = normSet(await ask(job, "Designer", designPrompt(focus), "default", true));
      for (let round = 0; ; round++) {
        job.stage = "run"; paint();
        let ran = null, failures = [];
        try {
          await loadPy();
          for (const [i, x] of S.exercises.entries()) {
            const rs = await runAll(x.solution, x.tests);
            rs.forEach((r, j) => { if (!r.pass) failures.push({ exercise: i + 1, problem: "The reference solution fails test " + (j + 1) + ": typed " + shortOut(x.tests[j].input) + (x.tests[j].check ? ", check " + x.tests[j].check : ", expected " + shortOut(x.tests[j].output)) + ", but it printed " + shortOut(r.out) + (r.err ? " and stopped with " + (r.err === "TOO_LONG" ? "a run that never ended" : r.err) : "") + ".", fix: "Make the task, the tests and the solution agree, or drop the test." }); });
          }
          ran = failures.length ? failures.length + " test(s) failed; they are listed as problems." : "every test passed.";
        } catch (_) { ran = null; }
        job.ran = ran; job.stage = "check"; paint();
        const probs = failures.concat(normProblemsPr(await ask(job, "Checker", practiceCheckPrompt(focus, S, ran), "complex", true)));
        job.problems = probs;
        if (!probs.length) { job.verified = ran != null; break; }
        if (round >= PRACTICE_ROUNDS) throw { code: "not_compliant", agent: "Checker" };
        job.stage = "fix"; job.rounds++; paint();
        S = normSet(await ask(job, "Designer", practiceFixPrompt(focus, S, probs), "default", true));
      }
      const set = { v: 1, id: "s" + Date.now().toString(36), at: new Date().toISOString(), focus: focus.focus, review: focus.review, when: S.when, how: S.how,
        exercises: S.exercises.map((x) => ({ ...x, mine: x.starter || "", solved: false, hintsShown: 0, revealed: false })),
        verified: !!job.verified, requests: job.requests, rounds: job.rounds };
      ui.pset = set; ui.prun = {};
      state.practice = (state.practice || []).concat([{ id: set.id, at: set.at, titles: set.exercises.map((x) => x.title), focus: set.focus }]).slice(-20);
      state.practiceCurrent = set.id;
      if (db) db.doc("practice/" + set.id).set(clone(set)).catch(() => notify("The practice set is shown but couldn't be saved.", "warn"));
      saveState();
      job.stage = "done";
      logEvent("practice", "Practice set delivered: " + set.exercises.map((x) => x.title).join("; ") + " (" + job.requests + " requests, " + job.rounds + " fix rounds" + (set.verified ? ", solutions run and passed" : ", solutions not run") + ")");
      notify("Your practice set is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The checker still found problems after " + PRACTICE_ROUNDS + " rounds of fixes, so the set wasn't shown. Try again."
        : e && e.code === "cancelled" ? "Stopped." : (e && e.agent ? e.agent + ": " : "") + noteAiError(e);
      logEvent("practice", "Practice set not delivered. " + job.error + (job.problems.length ? " Last problems: " + job.problems.map((p) => p.problem).join(" | ").slice(0, 600) : ""));
      if (!(e && e.code === "cancelled")) notify("The practice set wasn't finished. " + job.error, "bad");
    } finally { job.running = false; paint(); }
  }
  async function loadPracticeSet(id) {
    if (!id || (ui.pset && ui.pset.id === id) || !db) return;
    ui.psetLoading = id; render();
    try { const snap = await db.doc("practice/" + id).get(); if (snap.exists) ui.pset = clone(snap.data()); }
    catch (_) {}
    ui.psetLoading = null; render();
  }
  const savePset = () => { const S = ui.pset; if (db && S) db.doc("practice/" + S.id).set(clone(S)).catch(() => {}); };
  async function checkMine(i) {
    const S = ui.pset, x = S && S.exercises[i];
    if (!x) return;
    ui.prun = ui.prun || {};
    ui.prun[i] = { running: true }; render();
    try {
      const rs = await runAll(x.mine, x.tests);
      const passed = rs.filter((r) => r.pass).length;
      ui.prun[i] = { running: false, results: rs };
      if (passed === x.tests.length && !x.solved) { x.solved = true; notify("All " + x.tests.length + " tests pass. Compare with the reference solution when you like."); logEvent("practice", "Solved: " + x.title); }
      savePset();
    } catch (_) {
      ui.prun[i] = { running: false, error: "Python couldn't start in this page" + (PY.error ? " (" + PY.error + ")" : "") + ". Run your code on your own computer and compare with the examples." };
    }
    render();
  }

  // ---------- the page ----------
  const PR_STAGES = [["design", "Designer", "writes exercises from what you've learned"], ["run", "Runner", "runs the designer's own solution against the tests"], ["check", "Checker", "checks depth, fairness and that you know everything needed"]];
  function prTeamCard(job) {
    const order = { design: 0, run: 1, check: 2, fix: 2, done: 3, error: -1 };
    const at = order[job.stage];
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your practice set"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, PR_STAGES.map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · fixed and rechecked " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "Found " + job.problems.length + " problem" + (job.problems.length === 1 ? "" : "s") + "; the designer is fixing them.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  function codeArea(i, x) {
    return h("textarea", { class: "code pr-code", rows: Math.max(8, Math.min(22, (x.mine || "").split("\n").length + 3)), spellcheck: "false", "aria-label": "Your code for exercise " + (i + 1), value: x.mine || "",
      oninput: (e) => { x.mine = e.target.value; },
      onkeydown: (e) => {
        if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const t = e.target, a = t.selectionStart, b = t.selectionEnd; t.value = t.value.slice(0, a) + "    " + t.value.slice(b); t.selectionStart = t.selectionEnd = a + 4; x.mine = t.value; }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); checkMine(i); }
      } });
  }
  function testResults(x, run) {
    if (!run) return null;
    if (run.running) return h("p", { class: "thinking" }, PY.api ? "Running your code…" : "Starting Python in the page (the first time takes a few seconds)…");
    if (run.error) return h("p", { class: "msg" }, run.error);
    const rs = run.results || [], passed = rs.filter((r) => r.pass).length;
    const firstFail = rs.findIndex((r) => !r.pass);
    const typed = (s) => { const ls = String(s || "").replace(/\r/g, "").split("\n"); if (ls.length > 1 && ls[ls.length - 1] === "") ls.pop(); return ls.length === 1 && ls[0] === "" && !s ? I18N.t("(nothing)") : ls.map((l) => l === "" ? I18N.t("⏎ (empty line)") : l).join("\n"); };
    return h("div", { class: "pr-results" },
      h("p", { class: "pr-score" + (passed === rs.length ? " all" : "") }, passed + " of " + rs.length + " tests pass"),
      h("ul", { class: "checks" }, rs.map((r, j) => {
        const t = x.tests[j];
        const diff = r.pass ? null : h("div", { class: "pr-diff" },
              t.check ? h("div", null, h("span", { class: "muted" }, "Check: "), h("code", null, t.check))
                : h("div", null, h("span", { class: "muted" }, "You type:"), h("pre", null, h("code", null, typed(t.input)))),
              t.check ? null : h("div", null, h("span", { class: "muted" }, "Expected:"), h("pre", null, h("code", null, t.output || I18N.t("(nothing)")))),
              h("div", null, h("span", { class: "muted" }, "Your program printed:"), h("pre", null, h("code", null, r.out || I18N.t("(nothing)")))),
              r.err ? h("p", { class: "msg" }, r.err === "TOO_LONG" ? "It ran too long and was stopped. Look for a loop that never ends." : r.err) : null);
        return h("li", { class: r.pass ? "ok" : "warn" }, h("span", { class: "tick" }, r.pass ? "✓" : "✗"),
          r.pass ? h("span", null, "Test " + (j + 1))
            : j === firstFail ? h("div", null, h("span", null, "Test " + (j + 1)), diff)
            : h("details", { class: "pr-fold" }, h("summary", null, "Test " + (j + 1)), diff));
      })));
  }
  function exerciseCard(S, x, i) {
    const run = (ui.prun || {})[i];
    return h("article", { class: "card pr-ex" + (x.solved ? " solved" : "") },
      h("div", { class: "row spread" },
        h("div", { class: "pr-title" }, h("span", { class: "pr-n" }, String(i + 1)), h("h3", null, x.title)),
        h("div", { class: "row" }, x.level ? h("span", { class: "chip" }, x.level) : null, x.solved ? h("span", { class: "chip ok" }, "solved") : null)),
      x.combines.length ? h("p", { class: "small muted" }, "Combines: " + x.combines.join(" · ")) : null,
      h("div", { class: "lesson pr-task" }, md(x.task)),
      h("div", { class: "field" }, h("span", { class: "label" }, "Your code"), codeArea(i, x)),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", disabled: run && run.running, onclick: () => checkMine(i) }, "Check my code"),
        h("span", { class: "muted small" }, "Ctrl or Cmd + Enter · " + x.tests.length + " tests"),
        x.hints.length && x.hintsShown < x.hints.length ? h("button", { class: "quiet", type: "button", onclick: () => { x.hintsShown++; savePset(); render(); } }, x.hintsShown ? "Another hint" : "A hint") : null),
      testResults(x, run),
      x.hintsShown ? h("ul", { class: "plain small pr-hints" }, x.hints.slice(0, x.hintsShown).map((t, j) => h("li", null, h("strong", null, "Hint " + (j + 1) + ": "), t))) : null,
      h("details", { class: "pr-more", ontoggle: (e) => { if (e.target.open && !x.revealed) { x.revealed = true; savePset(); } } },
        h("summary", null, x.solved ? "Compare with the reference solution" : "Show the reference solution"),
        x.solved ? null : h("p", { class: "small muted" }, "Try first: the struggle is where the practice happens. Open this when you're done or truly stuck."),
        h("div", { class: "code-wrap" }, h("pre", null, h("code", null, x.solution))),
        x.thinking ? h("p", { class: "small" }, h("strong", null, "What this exercise is really about: "), x.thinking) : null));
  }
  function renderPractice() {
    const lede = "Practice comes in sets, once what you've learned can combine into real tasks. An AI judges whether that's true yet, writes the exercises, and the page runs the AI's own solution against the tests before you see them.";
    if (!km) return h("section", { class: "panel" }, head("Practice", "Practice", "The knowledge map couldn't load."));
    const R = state.practiceReady, fresh = R && R.sig === learnedSig(), judge = ui.pjudge, job = ui.pjob;
    if (state.practiceCurrent && !ui.pset && ui.psetTried !== state.practiceCurrent) { ui.psetTried = state.practiceCurrent; setTimeout(() => loadPracticeSet(state.practiceCurrent), 0); }
    const n = learnedPids().length;
    let verdict;
    if (judge && judge.running) verdict = h("div", { class: "card" }, h("p", { class: "thinking" }, "Looking at what you've learned…"));
    else if (!R || !fresh) verdict = h("div", { class: "card soft pr-verdict" },
      h("p", null, R ? "You've learned more since the last check (" + n + " points now)." : "You've learned " + n + " points so far."),
      h("p", { class: "small muted" }, "First, an AI looks at everything you've learned and judges whether it adds up to practice worth doing, or whether a few more points would make it much better. One AI request."),
      h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady() || !n, onclick: judgePractice }, "Is it time to practise?")));
    else verdict = h("div", { class: "card pr-verdict " + (R.enough ? "yes" : "no") },
      h("p", { class: "eyebrow" }, R.enough ? "Worth practising now" : "Not yet"),
      h("p", null, R.why),
      R.enough && R.focus.length ? h("p", { class: "small" }, h("strong", null, "It would combine: "), R.focus.join(" · ")) : null,
      R.enough && R.review.length ? h("p", { class: "small" }, h("strong", null, "With review of: "), R.review.join(" · ")) : null,
      !R.enough && R.next.length ? h("p", { class: "small" }, h("strong", null, "Practice gets much better after: "), R.next.join(" · ")) : null,
      h("div", { class: "row" },
        h("button", { class: R.enough ? "primary" : "quiet", type: "button", disabled: !aiReady() || (job && job.running), onclick: buildPractice }, R.enough ? "Build a practice set" : "Build one anyway"),
        h("span", { class: "muted small" }, "Usually 3 to 7 AI requests")));
    const S = ui.pset;
    const setView = S ? [
      h("div", { class: "card soft pr-plan" },
        h("p", { class: "eyebrow" }, "This set"),
        S.when ? h("p", null, S.when) : null,
        S.how.length ? h("div", null, h("p", { class: "label" }, "How to practise"), h("ul", { class: "plain" }, S.how.map((t) => h("li", null, t)))) : null,
        h("p", { class: "small muted" }, S.verified ? "Written by AI. The page ran its reference solutions against every test before showing them, and a checker held the set to the practice standards." : "Written by AI and checked against the practice standards. The page couldn't run Python when it was built, so the tests weren't run.")),
      ...S.exercises.map((x, i) => exerciseCard(S, x, i)),
    ] : ui.psetLoading ? [h("p", { class: "thinking" }, "Loading your practice set…")] : [];
    const older = (state.practice || []).filter((s) => !S || s.id !== S.id).slice().reverse();
    return h("section", { class: "panel" },
      head("Practice", "Practice", lede),
      verdict,
      job && (job.running || job.stage === "error") ? (job.running ? prTeamCard(job) : h("div", { class: "card soft" }, h("p", { class: "msg" }, job.error))) : null,
      ...setView,
      older.length ? h("details", { class: "card soft" }, h("summary", null, "Earlier practice sets (" + older.length + ")"),
        h("ul", { class: "plain" }, older.map((s) => h("li", null, h("button", { class: "link", type: "button", onclick: () => { state.practiceCurrent = s.id; ui.pset = null; ui.prun = {}; saveState(); loadPracticeSet(s.id); } }, (s.titles || []).join(" · ") || s.id))))) : null);
  }

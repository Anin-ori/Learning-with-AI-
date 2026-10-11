  // ---------- Practice (v1.11; v2.0: any subject) ----------
  // Practice is its own section. The AI first judges whether what the learner has learned can combine into practice
  // worth doing; then a designer plans the set and each exercise is written by its own request. In Python and
  // JavaScript the page runs the AI's reference solution against its tests in the browser; in other subjects nothing
  // can be run, so a second AI reads the exercises and the learner's answers instead, and the set says so.
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
    "_lc_shared = {}",
    "def _lc_run_shared(src, reset):",
    "    global _lc_shared",
    "    if reset:",
    "        _lc_shared = {'__name__': '__main__'}",
    "    g = _lc_shared",
    "    def _no_input(prompt=''):",
    "        raise EOFError('LC_NEEDS_INPUT')",
    "    g['input'] = _no_input",
    "    out = io.StringIO()",
    "    old = sys.stdout",
    "    sys.stdout = out",
    "    err = None",
    "    steps = [0]",
    "    def _tr(frame, event, arg):",
    "        if frame.f_code.co_filename == '<example>':",
    "            if event == 'line':",
    "                steps[0] += 1",
    "                if steps[0] > 2000000:",
    "                    raise _LCTooLong()",
    "            return _tr",
    "        return None",
    "    try:",
    "        sys.settrace(_tr)",
    "        try:",
    "            exec(compile(src, '<example>', 'exec'), g)",
    "        finally:",
    "            sys.settrace(None)",
    "    except _LCTooLong:",
    "        err = 'TOO_LONG'",
    "    except SystemExit:",
    "        pass",
    "    except EOFError as e:",
    "        err = 'NEEDS_INPUT' if 'LC_NEEDS_INPUT' in str(e) else 'EOFError: ' + str(e)",
    "    except SyntaxError as e:",
    "        err = 'SyntaxError: ' + str(e.msg)",
    "    except BaseException as e:",
    "        err = type(e).__name__ + ((': ' + str(e)) if str(e) else '')",
    "    finally:",
    "        sys.stdout = old",
    "    return {'out': out.getvalue(), 'err': err}",
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
  async function runPy(src, t) {
    const api = await loadPy();
    try { await api.loadPackagesFromImports(src); } catch (_) {}
    const fn = api.globals.get("_lc_run");
    const res = fn(src, t.input || "", api.toPy(t.check ? [t.check] : []));
    const r = res.toJs({ dict_converter: Object.fromEntries }); res.destroy(); fn.destroy();
    return { out: String(r.out || ""), err: r.err === "TOO_LONG" ? "TOO_LONG" : r.err, fails: r.fails || [] };
  }
  // JavaScript runs in a worker the page can stop, so a loop that never ends can't freeze the page
  const JS_WORKER = [
    "self.onmessage = (e) => {",
    "  const { src, input, check } = e.data;",
    "  const feed = input ? String(input).split('\\n') : [];",
    "  if (feed.length && feed[feed.length - 1] === '') feed.pop();",
    "  let pos = 0; const out = [];",
    "  const show = (v) => { if (typeof v === 'string') return v; if (v === undefined) return 'undefined'; if (typeof v === 'object' && v !== null) { try { return JSON.stringify(v); } catch (_) { return String(v); } } return String(v); };",
    "  const read = () => { if (pos >= feed.length) throw new Error('the program asked for more input than this test types in'); return feed[pos++]; };",
    "  const say = (...a) => { out.push(a.map(show).join(' ')); };",
    "  const con = { log: say, info: say, warn: say, error: say };",
    "  try {",
    "    const f = new Function('input', 'prompt', 'console', String(src) + (check ? '\\n;return (' + check + ');' : ''));",
    "    const r = f(read, read, con);",
    "    self.postMessage({ out: out.join('\\n'), err: null, fails: check && !r ? [0] : [] });",
    "  } catch (err) {",
    "    self.postMessage({ out: out.join('\\n'), err: (err && err.name ? err.name + ': ' : '') + ((err && err.message) || String(err)), fails: [] });",
    "  }",
    "};",
  ].join("\n");
  let jsWorkerUrl = null;
  function runJs(src, t) {
    return new Promise((resolve, reject) => {
      let w;
      try { jsWorkerUrl = jsWorkerUrl || URL.createObjectURL(new Blob([JS_WORKER], { type: "text/javascript" })); w = new Worker(jsWorkerUrl); }
      catch (e) { reject(e); return; }
      const timer = setTimeout(() => { w.terminate(); resolve({ out: "", err: "TOO_LONG", fails: [] }); }, 3000);
      w.onmessage = (e) => { clearTimeout(timer); w.terminate(); resolve(e.data); };
      w.onerror = (e) => { clearTimeout(timer); w.terminate(); resolve({ out: "", err: "SyntaxError: " + ((e && e.message) || "the code couldn't be read"), fails: [] }); if (e && e.preventDefault) e.preventDefault(); };
      w.postMessage({ src, input: t.input || "", check: t.check || "" });
    });
  }
  async function runTest(kind, src, t) {
    const r = kind === "javascript" ? await runJs(src, t) : await runPy(src, t);
    const pass = !r.err && !(r.fails || []).length && (t.output == null || normOut(r.out) === normOut(t.output));
    return { pass, out: r.out, err: r.err };
  }
  // ---------- lesson examples (v2.0): in Python, the page runs every example in a lesson, in order, the way a learner
  // would in one session, and compares what it prints with the output the lesson states ----------
  function lessonExamples(text) {
    const re = /```([\w+-]*)[^\n]*\n([\s\S]*?)\n\s*```/g, blocks = [];
    for (let m; (m = re.exec(text));) blocks.push({ lang: m[1].toLowerCase(), code: m[2], start: m.index, end: m.index + m[0].length });
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!["python", "py", "python3"].includes(b.lang)) continue;
      const nx = blocks[i + 1], between = nx ? text.slice(b.end, nx.start) : "";
      const stated = nx && ["", "text", "output"].includes(nx.lang) && /output|输出/i.test(between) && between.trim().length < 80 ? nx.code : null;
      out.push({ code: b.code, stated });
      if (stated != null) i++;
    }
    return out;
  }
  async function runLessonExamples(L) {
    const xs = lessonExamples(L.lesson).concat(lessonExamples(L.deeper || "").map((x) => ({ ...x, deeper: true })));
    if (!xs.length) return null;
    let api;
    try { api = await loadPy(); } catch (_) { return { ran: false, note: "The page couldn't start Python, so the examples weren't run.", errs: [] }; }
    const fn = api.globals.get("_lc_run_shared"), lines = [], errs = [];
    let first = true, inDeeper = false, n = 0;
    for (const [i, x] of xs.entries()) {
      if (x.deeper && !inDeeper) { inDeeper = true; first = true; }
      try { await api.loadPackagesFromImports(x.code); }
      catch (e) { lines.push("Example " + (i + 1) + " couldn't be run here: a package it imports isn't available in the page."); continue; }
      const res = fn(x.code, first); first = false; n++;
      const r = res.toJs({ dict_converter: Object.fromEntries }); res.destroy();
      const got = String(r.out || ""), err = r.err;
      const where = (x.deeper ? "In the extensions, example " : "Example ") + (i + 1);
      if (err === "NEEDS_INPUT") { n--; lines.push(where + " reads input, so it wasn't run."); continue; }
      if (x.stated == null) {
        if (err) { errs.push({ quote: x.code.split("\n")[0].slice(0, 120), problem: where + " stops with " + (err === "TOO_LONG" ? "a run that never ends" : err) + " when the page runs it, and the lesson doesn't say it should.", fix: "Fix the code, or show that it fails and explain why." }); lines.push(where + " stopped with " + err + "."); }
        else lines.push(where + " ran without error (no output is stated for it).");
        continue;
      }
      const ok = normOut(got) === normOut(x.stated) || (err && err !== "TOO_LONG" && x.stated.includes(err.split(":")[0]) && normOut(x.stated).startsWith(normOut(got)));
      if (ok) lines.push(where + " printed exactly what the lesson states.");
      else {
        const said = JSON.stringify(x.stated.slice(0, 400)), real = JSON.stringify((got + (err ? (got ? "\n" : "") + (err === "TOO_LONG" ? "(never finished)" : err) : "")).slice(0, 400));
        errs.push({ quote: x.code.split("\n")[0].slice(0, 120), problem: where + "'s stated output is wrong. The page ran it: the lesson says it prints " + said + ", but it printed " + real + ".", fix: "Make the stated output what the code really prints, or change the code; then check that every sentence about this example still holds." });
        lines.push(where + ": the lesson states " + said + ", but it printed " + real + ".");
      }
    }
    fn.destroy();
    return { ran: true, n, of: xs.length, note: "The page ran the lesson's Python examples in order, as one session (the extensions as a second session):\n" + lines.map((l) => "- " + l).join("\n"), errs };
  }
  async function runAll(kind, src, tests) { const out = []; for (const t of tests) out.push(await runTest(kind, src, t)); return out; }
  const canRun = (kind) => kind === "python" || kind === "javascript";

  // ---------- what the learner knows ----------
  function learnedPids() { return km ? km.data.KD.balls.flatMap((b) => b.pts.filter((p) => km.isLearned(p))) : []; }
  function learnedText() {
    const P = km.data, idx = (cur() && cur().pointIndex) || {};
    const lines = P.KD.balls.map((b) => { const xs = b.pts.filter((p) => km.isLearned(p)); return xs.length ? "- " + enBall(b.id).name + ": " + xs.map(enName).join("; ") : ""; }).filter(Boolean);
    const recent = Object.keys(idx).filter((p) => P.byId[p] && km.isLearned(p)).sort((a, b) => String(idx[b].at || "").localeCompare(String(idx[a].at || ""))).slice(0, 8);
    let budget = 5000;
    const taught = recent.map((p) => { const t = "- " + enName(p) + ": " + (idx[p].notes || []).join(" | "); budget -= t.length; return budget > 0 ? t : ""; }).filter(Boolean);
    return ["Points the learner has learned, by topic (the learner knows these and nothing else):", lines.join("\n") || "- none yet",
      recent.length ? "Studied most recently, newest first: " + recent.map(enName).join(", ") + "." : "",
      taught.length ? "What their lessons actually taught for those points (the lesson notes):\n" + taught.join("\n") : ""].filter(Boolean).join("\n");
  }
  const learnedSig = () => learnedPids().join(",");
  const prevSetsText = () => ((cur() && cur().practice) || []).slice(-3).map((s) => "- " + (s.titles || []).join("; ")).join("\n");

  // ---------- prompts ----------
  // v2.2 (R70): practice follows the lesson framework. A lead decides what to practise from what the learner has learned
  // and what their lessons set out to teach; writers write each exercise; a reviewer works each one as the learner
  // would and fixes what it finds. The purpose goes to the lead and writers; the rules go to everyone.
  const practiceProfile = () => { const S = profileOf(); return { ...S, format: RUN_FORMAT[S.run] || RUN_FORMAT.none }; };
  const checkRule = (kind) => canRun(kind)
    ? "- Enough tests to tell a correct solution from a nearly correct one: every case the task names and the boundaries. No padding with tests that check the same thing."
    : "";
  // what the lessons set out to teach, for the points studied most recently (read from the saved lessons, no AI)
  async function lessonGoals() {
    const s = cur(), idx = (s && s.pointIndex) || {}, P = km.data;
    const recent = Object.keys(idx).filter((p) => P.byId[p] && km.isLearned(p)).sort((a, b) => String(idx[b].at || "").localeCompare(String(idx[a].at || ""))).slice(0, 10);   // safety limit only
    let changed = false;
    for (const p of recent) {
      if (idx[p].goals || !db) continue;
      try { const snap = await db.doc("lessons2/" + lessonKey(p)).get(); const d = snap.exists && snap.data(); const g = d && d.plan && Array.isArray(d.plan.goals) ? d.plan.goals.map(pstr).filter(Boolean) : []; idx[p].goals = g; changed = true; } catch (_) {}
    }
    if (changed) saveSubject();
    return recent.filter((p) => (idx[p].goals || []).length).map((p) => "- " + enName(p) + ": " + idx[p].goals.join(" | ")).join("\n");
  }
  const practiceContext = (goals) => [
    ptLearner(), "", learnedText(),
    goals ? "What the lessons for those points set out to teach (their goals):\n" + goals : "",
    ((cur() && cur().practice) || []).length ? "Practice sets they already did (write different exercises):\n" + prevSetsText() : "",
  ].filter((x) => x !== "").join("\n");
  const practiceRulesText = (kind) => { const S = practiceProfile(); return [STANDARDS.practiceRules(S), checkRule(kind), MD_NOTE].filter(Boolean).join("\n"); };
  const howItWorks = (kind) => canRun(kind)
    ? "The learner writes each program in the page's editor and the page runs it against the tests; a reference solution is there to compare with."
    : "The learner works each exercise on paper and then compares with its reference answer; nothing is handed in or marked.";
  const leadPromptPr = (goals, kind) => [
    "You lead the practice for a self-learner of " + profileOf().name + " in Learning Companion, a study tool. Practice is its own section. " + howItWorks(kind) + " You decide what practice is useful now; writers write the exercises; a reviewer will then work each one as this learner would.",
    practiceContext(goals), "",
    STANDARDS.practicePurpose(), "", practiceRulesText(kind), "",
    "Say what to practise, not how to pose it: for each exercise, what it has the learner retrieve or use, and the learned points it draws on. The writers decide how.",
    'Reply with only JSON: {"about": "one sentence for the learner on what this set practises", "exercises": [{"what": "what this exercise has the learner retrieve or use"}]}',
  ].join("\n");
  const exerciseShape = (kind) => canRun(kind)
    ? '{"title": "short title", "task": "the full task in Markdown, with what the program reads, what it prints and at least one worked example", "starter": "starter code or an empty string", "tests": [{"input": "the typed lines, one per line", "output": "exactly what the program prints"}], "solution": "a reference solution that uses only what the learner has learned", "hints": ["nudges, gentle first, if hints help"]}'
    : '{"title": "short title", "task": "the full task in Markdown", "solution": "a reference answer in Markdown that shows the reasoning, not only the result, and uses only what the learner has learned", "hints": ["nudges, gentle first, if hints help"]}';
  const writerPromptPr = (goals, plan, i, kind) => [
    "You write one exercise of a practice set for a self-learner of " + profileOf().name + " in Learning Companion, a study tool. " + howItWorks(kind),
    "The lead decided what the set practises. How to pose this exercise is yours to decide.",
    practiceContext(goals), "",
    "The whole set: " + (plan.about || ""), plan.exercises.map((x, k) => (k + 1) + ". " + x.what).join("\n"), "",
    "Yours is exercise " + (i + 1) + ": " + plan.exercises[i].what, "",
    STANDARDS.practicePurpose(), "", practiceRulesText(kind), "",
    "Reply with only JSON: " + exerciseShape(kind),
  ].join("\n");
  const exText = (x, i) => [
    "Exercise " + (i + 1) + ": " + x.title, "Task:\n" + x.task, x.starter ? "Starter:\n" + x.starter : "",
    (x.tests ? "Reference solution:\n" : "Reference answer:\n") + x.solution,
    x.tests ? "Tests:\n" + x.tests.map((t, j) => "  " + (j + 1) + ". " + (t.check ? "check: " + t.check : "input " + JSON.stringify(t.input || "") + " -> output " + JSON.stringify(t.output || ""))).join("\n") : "",
    x.hints.length ? "Hints: " + x.hints.join(" | ") : "",
  ].filter(Boolean).join("\n");
  const setText = (EX) => EX.map(exText).join("\n\n");
  // the reviewer: works each exercise as the learner, then checks it as an expert; it gets the rules, not the purpose
  const reviewPromptPr = (goals, plan, EX, ran, kind) => [
    "You are about to practise " + profileOf().name + " with the set below in Learning Companion, a study tool, before the real learner does. AIs wrote it without a textbook behind it. " + howItWorks(kind),
    "First, be this learner. You know only what they know:", practiceContext(goals), "",
    "Work each exercise yourself from its task alone, before you look at its reference " + (canRun(kind) ? "solution" : "answer") + ". Notice where you would get stuck. Then compare with the reference, and check it as an expert: is it right, and does it show the reasoning?",
    canRun(kind) ? (ran ? "The page ran each reference solution against its tests: " + ran + " Trust these results; anything they show to be wrong is already counted." : "The page could not run the code here, so check every expected output by reasoning.") : "",
    "", practiceRulesText(kind), "",
    "The set:", "<<<", setText(EX), ">>>", "",
    "Report only what needs changing, by exercise number:",
    "- false: a reference answer, worked example" + (canRun(kind) ? ", test or expected output" : "") + " that is wrong;",
    "- stuck: an exercise this learner couldn't fairly do (it needs something they haven't learned and the task doesn't explain, or it is ambiguous), and what would fix it;",
    "- rules: anything against the rules above.",
    "Don't report matters of taste. If the set works, say so and report nothing.",
    'Reply with only JSON: {"attempts": "two or three sentences on how working the set went", "false": [{"exercise": 1, "problem": "", "fix": ""}], "stuck": [{"exercise": 1, "problem": "", "fix": ""}], "rules": [{"exercise": 1, "problem": "", "fix": ""}]}',
  ].filter((x) => x !== "").join("\n");
  const revisePromptPr = (goals, x, i, found, kind) => [
    "You worked exercise " + (i + 1) + " of a practice set in " + profileOf().name + " as the learner would. Now revise it: fix what was found, and change nothing else.",
    practiceContext(goals), "",
    "What was found:\n" + found.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n"), "",
    practiceRulesText(kind), "",
    "The exercise:", JSON.stringify({ title: x.title, task: x.task, starter: x.starter, tests: x.tests, solution: x.solution, hints: x.hints }), "",
    "Reply with only the whole exercise as JSON: " + exerciseShape(kind),
  ].join("\n");
  const answerCheckPrompt = (x, answer) => [
    "You give feedback on a self-learner's answer to a practice exercise in " + profileOf().name + ", in Learning Companion. Be specific and fair: judge the answer against the criteria, not against the wording of the model answer, and accept any correct approach.",
    ptLearner(), "", "The task:", x.task, "", "Criteria:", (x.criteria || []).map((c, j) => (j + 1) + ". " + c).join("\n"), "", "A model answer (one correct answer among others):", x.solution, "",
    "The learner's answer:", "<<<", String(answer).slice(0, 12000), ">>>", "",
    "Don't rewrite their answer for them. Where something is wrong, say what and why, and nudge them toward fixing it themselves.",
    'Reply with only JSON: {"results": [{"criterion": 1, "met": "yes, partly or no", "note": "one sentence"}], "feedback": "a short paragraph: what is good, what to fix and why"}',
  ].join("\n");

  // ---------- reading the AI's answers ----------
  function normPlan(d) {
    const ex = parr(d && d.exercises).map((x) => ({ what: pstr(x && (x.what || x.idea)) })).filter((x) => x.what).slice(0, 10);   // safety limit only
    if (!ex.length) throw { code: "invalid_json", agent: "Lead" };
    return { about: pstr(d.about), exercises: ex };
  }
  function normEx(x, kind) {
    const e = {
      title: pstr(x && x.title), level: pstr(x && x.level), task: pstr(x && x.task), combines: parr(x && x.combines).map(pstr).filter(Boolean),
      thinking: pstr(x && x.thinking), solution: typeof (x && x.solution) === "string" ? x.solution : "", hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 8),
    };
    if (canRun(kind)) {
      e.starter = typeof (x && x.starter) === "string" ? x.starter.replace(/\s+$/, "") : "";
      e.tests = parr(x && x.tests).map((t) => ({ input: typeof (t && t.input) === "string" ? t.input : "", output: typeof (t && t.output) === "string" ? t.output : (t && t.check ? null : ""), check: pstr(t && t.check) || undefined })).filter((t) => t.check || t.output != null).slice(0, 40);
      if (!(e.title && e.task && e.solution && e.tests.length)) throw { code: "invalid_json", agent: "Writer" };
    } else {
      if (!(e.title && e.task && e.solution)) throw { code: "invalid_json", agent: "Writer" };
    }
    return e;
  }
  const normProblemsPr = (v) => parr(v).map((p) => ({ exercise: Number(p && p.exercise) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  const shortOut = (s) => JSON.stringify(String(s == null ? "" : s).slice(0, 300));

  // ---------- the jobs ----------
  const PRACTICE_ROUNDS = 2;
  const normItemsPr = (v) => parr(v).map((p) => ({ exercise: Number(p && p.exercise) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  async function buildPractice() {
    const s = cur();
    if (!km || !s || !aiReady() || !learnedPids().length || (ui.pjob && ui.pjob.running)) return;
    const kind = profileOf().run;
    const job = { id: "pset", requests: 0, cancel: false, running: true, stage: "plan", rounds: 0, problems: [], ran: null, dropped: [], why: [], kind, planned: 0, written: 0 };
    const paint = () => { if (ui.step === "practice" && ui.view !== "map") render(); };
    job.paint = paint;
    ui.pjob = job; render();
    try {
      const goals = await lessonGoals();
      // 1. the lead: what to practise
      const plan = normPlan(await ask(job, "Lead", inEnglish(leadPromptPr(goals, kind)), "complex", true));
      job.planned = plan.exercises.length; job.stage = "write"; paint();
      // 2. the writers, one per exercise, side by side
      let EX = await Promise.all(plan.exercises.map((x, i) => ask(job, "Writer", inEnglish(writerPromptPr(goals, plan, i, kind)), "default", true)
        .then((y) => { job.written++; paint(); return normEx(y, kind); })
        .catch((e) => { if (e && e.code === "cancelled") throw e; job.dropped.push(x.what); job.why.push(x.what + ": " + (e && e.code || "error")); return null; })));
      EX = EX.filter(Boolean);
      if (!EX.length) throw { code: "nothing_written", agent: "Writer" };
      // 3. the page runs the reference solutions; 4. the reviewer works the set as the learner, and revises what it found
      let attempts = "";
      for (let round = 0; ; round++) {
        let ran = null; const runErrs = [];
        if (canRun(kind)) {
          job.stage = "run"; paint();
          try {
            for (const [i, x] of EX.entries()) {
              const rs = await runAll(kind, x.solution, x.tests);
              rs.forEach((r, j) => { if (!r.pass) runErrs.push({ exercise: i + 1, problem: "The reference solution fails test " + (j + 1) + ": typed " + shortOut(x.tests[j].input) + (x.tests[j].check ? ", check " + x.tests[j].check : ", expected " + shortOut(x.tests[j].output)) + ", but it printed " + shortOut(r.out) + (r.err ? " and stopped with " + (r.err === "TOO_LONG" ? "a run that never ended" : r.err) : "") + ".", fix: "Make the task, the tests and the solution agree, or drop the test." }); });
            }
            ran = runErrs.length ? runErrs.length + " test(s) failed; they are listed as wrong." : "every test passed.";
          } catch (_) { ran = null; }
        }
        job.ran = ran;
        let found = runErrs;
        if (round === 0) {
          job.stage = "check"; paint();
          const R = await ask(job, "Reviewer", inEnglish(reviewPromptPr(goals, plan, EX, ran, kind)), "complex", true);
          attempts = pstr(R && R.attempts);
          found = runErrs.concat(normItemsPr(R && R.false), normItemsPr(R && R.stuck), normItemsPr(R && R.rules));
        }
        // after a revision only the page's own checks run again
        const per = EX.map((_, i) => found.filter((p) => p.exercise === i + 1 || !p.exercise));
        job.problems = found;
        if (per.every((f) => !f.length)) { job.verified = ran != null; break; }
        if (round >= PRACTICE_ROUNDS) {
          // exercises the page still finds wrong are left out; the rest of the set is delivered
          const keep = EX.filter((_, i) => !per[i].length);
          EX.forEach((x, i) => { if (per[i].length) { job.dropped.push(x.title); job.why.push(x.title + ": still wrong"); } });
          if (!keep.length) throw { code: "not_compliant", agent: "Reviewer" };
          EX = keep; job.verified = ran != null; break;
        }
        job.stage = "fix"; job.rounds++; paint();
        EX = await Promise.all(EX.map((x, i) => !per[i].length ? x
          : ask(job, "Reviewer", inEnglish(revisePromptPr(goals, x, i, per[i], kind)), "default", true).then((y) => normEx(y, kind)).catch((e) => { if (e && e.code === "cancelled") throw e; return x; })));
        if (!canRun(kind)) break;   // nothing the page can check again
      }
      const set = { v: 3, src: "en", id: newId("s"), sid: s.sid, kind, at: new Date().toISOString(), about: plan.about, attempts,
        exercises: EX.map((x) => ({ ...x, mine: x.starter || "", solved: false, hintsShown: 0, revealed: false })),
        dropped: job.dropped, verified: !!job.verified, requests: job.requests, rounds: job.rounds };
      if (trLang()) {
        job.stage = "translate"; paint();
        try { await translateSet(set, job); }
        catch (e) { if (e && e.code === "cancelled") throw e; notify("The practice set is ready, but it couldn't be translated, so it's shown in English. You can translate it again.", "warn"); }
        set.requests = job.requests;
      }
      ui.pset = set; ui.prun = {};
      s.practice = (s.practice || []).concat([{ id: set.id, at: set.at, titles: set.exercises.map((x) => x.title), tr: set.tr && set.tr[curLang()] ? { [curLang()]: set.tr[curLang()].exercises.map((x) => x.title) } : undefined }]).slice(-30);
      s.practiceCurrent = set.id;
      if (db) db.doc("practice2/" + set.id).set(clone(set)).catch(() => notify("The practice set is shown but couldn't be saved.", "warn"));
      saveSubject();
      job.stage = "done";
      logEvent("practice", "Practice set delivered: " + set.exercises.map((x) => x.title).join("; ") + " (" + job.requests + " requests, " + job.rounds + " revisions" + (canRun(kind) ? (set.verified ? ", solutions run and passed" : ", solutions not run") : "") + (job.why.length ? "; left out: " + job.why.join("; ") : "") + ")");
      notify("Your practice set is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "Every exercise still failed its tests after " + PRACTICE_ROUNDS + " revisions, so the set wasn't shown. Try again."
        : e && e.code === "nothing_written" ? "None of the exercises could be written. Try again." : jobError(e);
      logEvent("practice", "Practice set not delivered. " + job.error + (job.why.length ? " Dropped: " + job.why.join("; ") : "") + (job.problems.length ? " Last problems: " + job.problems.map((p) => p.problem).join(" | ").slice(0, 600) : ""));
      if (!(e && e.code === "cancelled")) notify("The practice set wasn't finished. " + job.error, "bad");
    } finally { job.running = false; paint(); }
  }

  async function translateSet(set, job) {
    const L = curLang(), T = {};
    await trPairs(job, practicePairs(set, T), subjectAbout("a practice set: what it practises, tasks, hints and reference answers"), srcOf(set));
    set.tr = Object.assign({}, set.tr, { [L]: T });
  }
  function setTrFn(set) {
    const s = cur();
    return async (job) => {
      await translateSet(set, job);
      const L = curLang(), e = (s.practice || []).find((p) => p.id === set.id);
      if (e) { e.tr = Object.assign({}, e.tr, { [L]: set.tr[L].exercises.map((x) => x.title) }); saveSubject(); }
      savePset();
    };
  }
  async function loadPracticeSet(id) {
    if (!id || (ui.pset && ui.pset.id === id) || !db) return;
    ui.psetLoading = id; render();
    try { const snap = await db.doc("practice2/" + id).get(); if (snap.exists) ui.pset = clone(snap.data()); }
    catch (_) {}
    ui.psetLoading = null; render();
  }
  const savePset = () => { const S = ui.pset; if (db && S) db.doc("practice2/" + S.id).set(clone(S)).catch(() => {}); };
  async function checkMine(i) {
    const S = ui.pset, x = S && S.exercises[i];
    if (!x) return;
    ui.prun = ui.prun || {};
    ui.prun[i] = { running: true }; render();
    if (!canRun(S.kind)) {
      if (!aiReady() || !(x.mine || "").trim()) { ui.prun[i] = null; render(); return; }
      try {
        const d = await sample.json(inEnglish(answerCheckPrompt(x, x.mine)), { modelTier: "default", cache: false });
        const results = parr(d && d.results).map((r) => ({ n: Number(r && r.criterion) || 0, met: ["yes", "partly", "no"].includes(pstr(r && r.met).toLowerCase()) ? pstr(r.met).toLowerCase() : "partly", note: pstr(r && r.note) }));
        const fb = { results, text: pstr(d && d.feedback), notes: results.map((r) => r.note) };
        if (trLang()) { try { await translateRecord({ requests: 0, cancel: false }, fb, ["text"], ["notes"], subjectAbout("feedback on the learner's answer to a practice exercise")); } catch (_) {} }
        ui.prun[i] = { running: false, feedback: fb };
        const all = x.criteria.every((_, j) => (results.find((r) => r.n === j + 1) || {}).met === "yes");
        if (all && !x.solved) { x.solved = true; notify("The feedback says your answer meets every criterion. Compare with the model answer when you like."); logEvent("practice", "Solved (by AI feedback): " + x.title); }
        savePset();
      } catch (e) { ui.prun[i] = { running: false, error: noteAiError(e) }; }
      render();
      return;
    }
    try {
      const rs = await runAll(S.kind, x.mine, x.tests);
      const passed = rs.filter((r) => r.pass).length;
      ui.prun[i] = { running: false, results: rs };
      if (passed === x.tests.length && !x.solved) { x.solved = true; notify("All " + x.tests.length + " tests pass. Compare with the reference solution when you like."); logEvent("practice", "Solved: " + x.title); }
      savePset();
    } catch (_) {
      ui.prun[i] = { running: false, error: S.kind === "python" ? "Python couldn't start in this page" + (PY.error ? " (" + PY.error + ")" : "") + ". Run your code on your own computer and compare with the examples." : "JavaScript couldn't run in this page. Run your code on your own computer and compare with the examples." };
    }
    render();
  }

  // ---------- the page ----------
  function prTeamCard(job) {
    const runnable = canRun(job.kind);
    const stages = [["plan", "Lead", "decides what is worth practising now"], ["write", "Writers", "write each exercise and its reference answer"]]
      .concat(runnable ? [["run", "Runner", "runs each reference solution against its tests"]] : [])
      .concat([["check", "Reviewer", "works each exercise as you would, and fixes what it finds"]]);
    if (trLang()) stages.push(["translate", "Translator", "translates the set into your language, keeping the English original"]);
    const order = runnable ? { plan: 0, write: 1, run: 2, check: 3, fix: 3, translate: 4, done: 5, error: -1 } : { plan: 0, write: 1, check: 2, fix: 2, translate: 3, done: 4, error: -1 };
    const at = order[job.stage];
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your practice set"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "write" && job.planned ? h("span", { class: "muted small" }, " · " + job.written + " of " + job.planned + " written") : null,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · revised " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "The reviewer found " + job.problems.length + " thing" + (job.problems.length === 1 ? "" : "s") + " to change and is revising.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  function codeArea(i, x, code) {
    return h("textarea", { class: (code ? "code " : "") + "pr-code", rows: Math.max(8, Math.min(22, (x.mine || "").split("\n").length + 3)), spellcheck: code ? "false" : "true", "aria-label": (code ? "Your code for exercise " : "Your answer for exercise ") + (i + 1), value: x.mine || "",
      oninput: (e) => { x.mine = e.target.value; },
      onkeydown: (e) => {
        if (code && e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const t = e.target, a = t.selectionStart, b = t.selectionEnd; t.value = t.value.slice(0, a) + "    " + t.value.slice(b); t.selectionStart = t.selectionEnd = a + 4; x.mine = t.value; }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); checkMine(i); }
      } });
  }
  function testResults(S, x, run) {
    if (!run) return null;
    if (run.running) return h("p", { class: "thinking" }, !canRun(S.kind) ? "Reading your answer…" : S.kind === "python" && !PY.api ? "Starting Python in the page (the first time takes a few seconds)…" : "Running your code…");
    if (run.error) return h("p", { class: "msg" }, run.error);
    if (run.feedback) {
      const F0 = run.feedback, FV = recordView(F0, ["text"], ["notes"]), F = { ...F0, text: FV.text, results: F0.results.map((r, k) => ({ ...r, note: pickT(FV.notes[k], r.note) })) }, word = { yes: ["ok", "✓"], partly: ["warn", "~"], no: ["warn", "✗"] };
      return h("div", { class: "pr-results" },
        h("ul", { class: "checks" }, x.criteria.map((c, j) => { const r = F.results.find((y) => y.n === j + 1) || { met: "partly", note: "" }; const [cls, tick] = word[r.met];
          return h("li", { class: cls }, h("span", { class: "tick" }, tick), ai("div", null, h("span", null, c), r.note ? h("p", { class: "small muted" }, r.note) : null)); })),
        F.text ? ai("p", { class: "bubble-text" }, F.text) : null,
        h("p", { class: "caution" }, "AI feedback · can be wrong. Nothing in this subject can be run, so this is one AI's reading of your answer."),
        trLine("fb:" + S.id + ":" + String(F0.text || "").slice(0, 40), F0, async (job) => { await translateRecord(job, F0, ["text"], ["notes"], subjectAbout("feedback on the learner's answer to a practice exercise")); savePset(); }));
    }
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
  function exerciseCard(S, xs, i, x) {
    // xs is the stored exercise (the learner's code, hints shown, solved); x is what the learner reads (maybe translated)
    const run = (ui.prun || {})[i], code = canRun(S.kind);
    return h("article", { class: "card pr-ex" + (x.solved ? " solved" : "") },
      h("div", { class: "row spread" },
        h("div", { class: "pr-title" }, h("span", { class: "pr-n" }, String(i + 1)), ai("h3", null, x.title)),
        h("div", { class: "row" }, x.level ? ai("span", { class: "chip" }, x.level) : null, xs.solved ? h("span", { class: "chip ok" }, "solved") : null)),
      x.combines.length ? h("p", { class: "small muted" }, I18N.t("Combines:") + " ", ai("span", null, x.combines.join(" · "))) : null,
      h("div", { class: "lesson pr-task" }, md(x.task)),
      // written subjects (R68): no answer to hand in; the learner works on paper and compares with the reference answer
      code ? h("div", { class: "field" }, h("span", { class: "label" }, "Your code"), codeArea(i, xs, code)) : null,
      h("div", { class: "row" },
        code ? h("button", { class: "primary", type: "button", disabled: run && run.running, onclick: () => checkMine(i) }, "Check my code") : null,
        code ? h("span", { class: "muted small" }, "Ctrl or Cmd + Enter · " + x.tests.length + " tests") : null,
        !code ? h("button", { class: xs.solved ? "quiet" : "primary", type: "button", onclick: () => { xs.solved = !xs.solved; savePset(); if (xs.solved) logEvent("practice", "Done: " + x.title); render(); } }, xs.solved ? "Mark as not done" : "Mark as done") : null,
        x.hints.length && xs.hintsShown < x.hints.length ? h("button", { class: "quiet", type: "button", onclick: () => { xs.hintsShown++; savePset(); render(); } }, xs.hintsShown ? "Another hint" : "A hint") : null),
      testResults(S, x, run),
      xs.hintsShown ? ai("ul", { class: "plain small pr-hints" }, x.hints.slice(0, xs.hintsShown).map((t, j) => h("li", null, h("strong", null, I18N.t("Hint " + (j + 1) + ":") + " "), ...mathText(t)))) : null,
      h("details", { class: "pr-more", ontoggle: (e) => { if (e.target.open && !xs.revealed) { xs.revealed = true; savePset(); } } },
        h("summary", null, code ? (xs.solved ? "Compare with the reference solution" : "Show the reference solution") : "Show the reference answer"),
        xs.solved ? null : h("p", { class: "small muted" }, "Try first: the struggle is where the practice happens. Open this when you're done or truly stuck."),
        code ? h("div", { class: "code-wrap" }, h("pre", null, h("code", null, x.solution))) : h("div", { class: "lesson" }, md(x.solution)),
        x.thinking ? h("p", { class: "small" }, h("strong", null, "What this exercise is really about: "), ai("span", null, ...mathText(x.thinking))) : null));
  }
  function renderPractice() {
    const lede = "Practise whenever you like. One AI decides what is worth practising from what you've learned and what your lessons set out to teach, others write the exercises, and a reviewer works each one as you would before you see it.";
    if (!km) return noMapPanel("Practice");
    const s = cur(), job = ui.pjob;
    if (s.practiceCurrent && !ui.pset && ui.psetTried !== s.practiceCurrent) { ui.psetTried = s.practiceCurrent; setTimeout(() => loadPracticeSet(s.practiceCurrent), 0); }
    const n = learnedPids().length;
    const verdict = h("div", { class: "card soft pr-verdict" },
      h("p", null, n ? "You've learned " + n + (n === 1 ? " point" : " points") + " so far." : "Learn a point first: practice is built from what you've learned."),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", disabled: !aiReady() || !n || (job && job.running), onclick: buildPractice }, "Build a practice set"),
        h("span", { class: "muted small" }, "A lead, a writer per exercise and a reviewer; a few more requests if it finds something to fix")));
    const S0 = ui.pset && ui.pset.sid === s.sid ? ui.pset : null, S = S0 ? practiceView(S0) : null;
    const verifiedText = (S) => canRun(S.kind)
      ? (S.verified ? "Written by AI. The page ran its reference solutions against every test before showing them, and a reviewer worked each exercise." : "Written by AI and worked through by a reviewer. The page couldn't run the code when it was built, so the tests weren't run.")
      : "Written by AI and worked through by a reviewer. Nothing in this subject can be run, so the reference answers are an AI's working, not proven: check what matters to you.";
    const setView2 = S ? [
      h("div", { class: "card soft pr-plan" },
        h("p", { class: "eyebrow" }, "This set"),
        trLine("set:" + S0.id, S0, setTrFn(S0)),
        S.about ? ai("p", null, ...mathText(S.about)) : null,
        S.when ? ai("p", null, S.when) : null,
        (S.how || []).length ? h("div", null, h("p", { class: "label" }, "How to practise"), ai("ul", { class: "plain" }, S.how.map((t) => h("li", null, t)))) : null,
        S.attempts ? h("details", { class: "pr-fold" }, h("summary", { class: "small" }, "How this set was made"), h("p", { class: "small" }, h("strong", null, "The reviewer, after working the set: "), ai("span", null, S.attempts))) : null,
        h("p", { class: "small muted" }, verifiedText(S)),
        (S.dropped || []).length ? h("p", { class: "small muted" }, I18N.t("Left out because it couldn't be made right:") + " ", ai("span", null, S.dropped.join(" · "))) : null,
        (S.advice || []).length ? h("details", { class: "pr-fold" }, h("summary", { class: "small" }, "The editor's remaining suggestions"), ai("ul", { class: "plain small" }, S.advice.map((t) => h("li", null, t)))) : null),
      ...S.exercises.map((x, i) => exerciseCard(S, S0.exercises[i], i, x)),
    ] : ui.psetLoading ? [h("p", { class: "thinking" }, "Loading your practice set…")] : [];
    const older = (s.practice || []).filter((p) => !S || p.id !== S.id).slice().reverse();
    return h("section", { class: "panel" },
      head("Practice", "Practice", lede),
      verdict,
      job && (job.running || job.stage === "error") ? (job.running ? prTeamCard(job) : h("div", { class: "card soft" }, h("p", { class: "msg" }, job.error))) : null,
      ...setView2,
      older.length ? h("details", { class: "card soft" }, h("summary", null, "Earlier practice sets (" + older.length + ")"),
        h("ul", { class: "plain" }, older.map((p) => h("li", null, ai("button", { class: "link", type: "button", onclick: () => { s.practiceCurrent = p.id; ui.pset = null; ui.prun = {}; saveSubject(); loadPracticeSet(p.id); } }, ((trOf(p) || p.titles) || []).join(" · ") || p.id))))) : null);
  }

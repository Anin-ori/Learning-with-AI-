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
  // ---------- the question bank (v2.2, R71) ----------
  // Practice works the way people go through practice questions: each question is saved on its own, tagged with the map
  // points it practises; the learner asks for new ones (on recent learning or on one point), does them, checks the
  // answer, marks how it went, and bookmarks or deletes them. The bank fills up only as the learner asks.
  //   subjects/<sid>.qbank   the index: [{id, at, pts, title, tr: {lang: title}, mark: "right"|"wrong"|null, star}]
  //   q/<qid>                one question: {v, src, id, sid, kind, at, pts, title, task, answer, solution, starter, tests, hints, tr, mine, hintsShown}
  const shortPt = (t) => (I18N.units(t) > 64 ? [...t].reduce((o, ch) => (I18N.units(o + ch) > 62 ? o : o + ch), "") + "…" : t);
  const qIndex = () => { const s = cur(); if (s && !Array.isArray(s.qbank)) s.qbank = []; return s ? s.qbank : []; };
  const qEntry = (id) => qIndex().find((e) => e.id === id);
  const qTitle = (e) => (needsTr(e) && !showOrigFlag && e.tr && e.tr[curLang()]) || e.title;
  const bankTitlesFor = (pids) => qIndex().filter((e) => !pids || e.pts.some((p) => pids.includes(p))).slice(-30).map((e) => "- " + e.title).join("\n");

  // ---------- prompts ----------
  // A lead decides what to practise from what the learner has learned and what their lessons set out to teach; writers
  // write one question each; a reviewer works each question as the learner would and revises what it finds. The
  // purpose goes to the lead and writers; the rules go to everyone (R70).
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
      try { const snap = await db.doc("lessons2/" + lessonKey(p)).get(); const d = snap.exists && snap.data(); idx[p].goals = d && d.plan && Array.isArray(d.plan.goals) ? d.plan.goals.map(pstr).filter(Boolean) : []; changed = true; } catch (_) {}
    }
    if (changed) saveSubject();
    return recent.filter((p) => (idx[p].goals || []).length).map((p) => "- " + enName(p) + ": " + idx[p].goals.join(" | ")).join("\n");
  }
  const practiceContext = (goals, focus) => [
    ptLearner(), "", learnedText(),
    goals ? "What the lessons for those points set out to teach (their goals):\n" + goals : "",
    focus ? "The learner asked to practise this point: " + focus.map((p) => p + " | " + enName(p) + (enWhat(p) ? ": " + enWhat(p) : "")).join("; ") + "." : "The learner asked to practise what they learned most recently.",
    bankTitlesFor(focus) ? "Questions already in their bank" + (focus ? " for it" : "") + " (write different ones):\n" + bankTitlesFor(focus) : "",
  ].filter((x) => x !== "").join("\n");
  const practiceRulesText = (kind) => { const S = practiceProfile(); return [STANDARDS.practiceRules(S), checkRule(kind), MD_NOTE].filter(Boolean).join("\n"); };
  const howItWorks = (kind) => canRun(kind)
    ? "The learner writes each program in the page's editor and the page runs it against the tests; a reference solution is there to compare with."
    : "The learner works each question on paper, then checks the answer and, if they need it, the working; nothing is handed in or marked.";
  const learnedIds = () => learnedPids().map((p) => p + " | " + enName(p)).join("\n");
  const leadPromptQ = (goals, focus, kind) => [
    "You lead the practice for a self-learner of " + profileOf().name + " in Learning Companion, a study tool. " + howItWorks(kind) + " Each question is saved in the learner's question bank, tagged with the points it practises. You decide which questions are worth adding now; writers write them; a reviewer will then work each one as this learner would.",
    practiceContext(goals, focus), "",
    "Learned points, with their ids:", learnedIds(), "",
    STANDARDS.practicePurpose(), "", practiceRulesText(kind), "",
    "Say what each question practises, not how to pose it: what it has the learner retrieve or use, and the ids of the learned points it practises. The writers decide how.",
    'Reply with only JSON: {"questions": [{"what": "what this question has the learner retrieve or use", "points": ["point ids"]}]}',
  ].join("\n");
  const questionShape = (kind) => canRun(kind)
    ? '{"title": "short title", "task": "the full question in Markdown, with what the program reads, what it prints and at least one worked example", "starter": "starter code or an empty string", "tests": [{"input": "the typed lines, one per line", "output": "exactly what the program prints"}], "solution": "a reference solution that uses only what the learner has learned", "hints": ["nudges, gentle first, if hints help"]}'
    : '{"title": "short title", "task": "the full question in Markdown", "answer": "the final answer alone, as briefly as it can be stated", "solution": "the working in Markdown: the reasoning that leads to the answer, using only what the learner has learned", "hints": ["nudges, gentle first, if hints help"]}';
  const writerPromptQ = (goals, focus, plan, i, kind) => [
    "You write one question for a self-learner of " + profileOf().name + " in Learning Companion, a study tool. " + howItWorks(kind),
    "The lead decided what the new questions practise. How to pose this one is yours to decide.",
    practiceContext(goals, focus), "",
    "The new questions:", plan.map((x, k) => (k + 1) + ". " + x.what).join("\n"), "",
    "Yours is question " + (i + 1) + ": " + plan[i].what, "",
    STANDARDS.practicePurpose(), "", practiceRulesText(kind), "",
    "Reply with only JSON: " + questionShape(kind),
  ].join("\n");
  const qText = (x, i) => [
    "Question " + (i + 1) + ": " + x.title, "Task:\n" + x.task, x.starter ? "Starter:\n" + x.starter : "",
    x.answer ? "Answer: " + x.answer : "", (x.tests ? "Reference solution:\n" : "Working:\n") + x.solution,
    x.tests ? "Tests:\n" + x.tests.map((t, j) => "  " + (j + 1) + ". " + (t.check ? "check: " + t.check : "input " + JSON.stringify(t.input || "") + " -> output " + JSON.stringify(t.output || ""))).join("\n") : "",
    x.hints.length ? "Hints: " + x.hints.join(" | ") : "",
  ].filter(Boolean).join("\n");
  // the reviewer works each question as the learner, then checks it as an expert; it gets the rules, not the purpose
  const reviewPromptQ = (goals, focus, QS, ran, kind) => [
    "You are about to work the practice questions below in " + profileOf().name + " in Learning Companion, a study tool, before the real learner does. AIs wrote them without a textbook behind them. " + howItWorks(kind),
    "First, be this learner. You know only what they know:", practiceContext(goals, focus), "",
    "Work each question yourself from its task alone, before you look at its " + (canRun(kind) ? "reference solution" : "answer and working") + ". Notice where you would get stuck. Then compare, and check it as an expert: is it right, and does the working show the reasoning?",
    canRun(kind) ? (ran ? "The page ran each reference solution against its tests: " + ran + " Trust these results; anything they show to be wrong is already counted." : "The page could not run the code here, so check every expected output by reasoning.") : "",
    "", practiceRulesText(kind), "",
    "The questions:", "<<<", QS.map(qText).join("\n\n"), ">>>", "",
    "Report only what needs changing, by question number:",
    "- false: an answer, working, worked example" + (canRun(kind) ? ", test or expected output" : "") + " that is wrong;",
    "- stuck: a question this learner couldn't fairly do (it needs something they haven't learned and the task doesn't explain, or it is ambiguous), and what would fix it;",
    "- rules: anything against the rules above.",
    "Don't report matters of taste. If the questions work, say so and report nothing.",
    'Reply with only JSON: {"false": [{"question": 1, "problem": "", "fix": ""}], "stuck": [{"question": 1, "problem": "", "fix": ""}], "rules": [{"question": 1, "problem": "", "fix": ""}]}',
  ].filter((x) => x !== "").join("\n");
  const revisePromptQ = (goals, focus, x, found, kind) => [
    "You worked the practice question below in " + profileOf().name + " as the learner would. Now revise it: fix what was found, and change nothing else.",
    practiceContext(goals, focus), "",
    "What was found:\n" + found.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n"), "",
    practiceRulesText(kind), "",
    "The question:", JSON.stringify({ title: x.title, task: x.task, answer: x.answer, starter: x.starter, tests: x.tests, solution: x.solution, hints: x.hints }), "",
    "Reply with only the whole question as JSON: " + questionShape(kind),
  ].join("\n");

  // ---------- reading the AI's answers ----------
  function normPlanQ(d, focus) {
    const learned = new Set(learnedPids());
    const qs = parr(d && d.questions).map((x) => ({ what: pstr(x && x.what), pts: parr(x && x.points).map(pstr).filter((p) => learned.has(p) || (focus || []).includes(p)) }))
      .filter((x) => x.what).slice(0, 10);   // safety limit only
    if (!qs.length) throw { code: "invalid_json", agent: "Lead" };
    qs.forEach((x) => { if (!x.pts.length) x.pts = focus ? focus.slice() : learnedPids().slice(-1); });
    return qs;
  }
  function normQ(x, kind) {
    const e = { title: pstr(x && x.title), task: pstr(x && x.task), answer: pstr(x && x.answer), solution: typeof (x && x.solution) === "string" ? x.solution : "", hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 8) };
    if (canRun(kind)) {
      e.starter = typeof (x && x.starter) === "string" ? x.starter.replace(/\s+$/, "") : "";
      e.tests = parr(x && x.tests).map((t) => ({ input: typeof (t && t.input) === "string" ? t.input : "", output: typeof (t && t.output) === "string" ? t.output : (t && t.check ? null : ""), check: pstr(t && t.check) || undefined })).filter((t) => t.check || t.output != null).slice(0, 40);
      if (!(e.title && e.task && e.solution && e.tests.length)) throw { code: "invalid_json", agent: "Writer" };
    } else if (!(e.title && e.task && e.solution)) throw { code: "invalid_json", agent: "Writer" };
    return e;
  }
  const normItemsQ = (v) => parr(v).map((p) => ({ q: Number(p && (p.question || p.exercise)) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  const shortOut = (s) => JSON.stringify(String(s == null ? "" : s).slice(0, 300));
  async function testErrs(kind, QS) {
    const errs = [];
    for (const [i, x] of QS.entries()) {
      const rs = await runAll(kind, x.solution, x.tests);
      rs.forEach((r, j) => { if (!r.pass) errs.push({ q: i + 1, problem: "The reference solution fails test " + (j + 1) + ": typed " + shortOut(x.tests[j].input) + (x.tests[j].check ? ", check " + x.tests[j].check : ", expected " + shortOut(x.tests[j].output)) + ", but it printed " + shortOut(r.out) + (r.err ? " and stopped with " + (r.err === "TOO_LONG" ? "a run that never ended" : r.err) : "") + ".", fix: "Make the task, the tests and the solution agree, or drop the test." }); });
    }
    return errs;
  }

  // ---------- making new questions ----------
  async function buildQuestions(focus) {
    const s = cur();
    if (!km || !s || !aiReady() || !learnedPids().length || (ui.pjob && ui.pjob.running)) return;
    const kind = profileOf().run;
    ui.qcache = ui.qcache || {}; ui.qLoading = ui.qLoading || {}; ui.qShown = ui.qShown || {}; ui.prun = ui.prun || {};
    const job = { id: "qbank", requests: 0, cancel: false, running: true, stage: "plan", rounds: 0, problems: [], dropped: [], kind, planned: 0, written: 0, focus };
    const paint = () => { if (ui.step === "practice" && ui.view !== "map") render(); };
    job.paint = paint;
    ui.pjob = job; render();
    try {
      const goals = await lessonGoals();
      // 1. the lead: which questions are worth adding now
      const plan = normPlanQ(await ask(job, "Lead", inEnglish(leadPromptQ(goals, focus, kind)), "complex", true), focus);
      job.planned = plan.length; job.stage = "write"; paint();
      // 2. the writers, one per question, side by side
      let QS = await Promise.all(plan.map((x, i) => ask(job, "Writer", inEnglish(writerPromptQ(goals, focus, plan, i, kind)), "default", true)
        .then((y) => { job.written++; paint(); return { ...normQ(y, kind), pts: x.pts }; })
        .catch((e) => { if (e && e.code === "cancelled") throw e; job.dropped.push(x.what); return null; })));
      QS = QS.filter(Boolean);
      if (!QS.length) throw { code: "nothing_written", agent: "Writer" };
      // 3. the page runs code; 4. the reviewer works every question, revises what it found, and checks each revision
      //    once more; a question still wrong after that is left out rather than shown
      let toReview = QS.map((_, i) => i);
      for (let round = 0; ; round++) {
        let ran = null, found = [];
        if (canRun(kind)) {
          job.stage = "run"; paint();
          try { found = await testErrs(kind, QS); ran = found.length ? found.length + " test(s) failed; they are listed as wrong." : "every test passed."; } catch (_) { ran = null; }
        }
        job.ran = ran;
        if (round <= 1 && toReview.length) {
          job.stage = "check"; paint();
          const sub = toReview.map((i) => QS[i]);
          const R = await ask(job, "Reviewer", inEnglish(reviewPromptQ(goals, focus, sub, ran, kind)), "complex", true);
          const mapBack = (p) => ({ ...p, q: p.q ? toReview[p.q - 1] + 1 : 0 });
          found = found.concat([...normItemsQ(R && R.false), ...normItemsQ(R && R.stuck), ...normItemsQ(R && R.rules)].map(mapBack).filter((p) => p.q));
        }
        const per = QS.map((_, i) => found.filter((p) => p.q === i + 1));
        job.problems = found;
        if (per.every((f) => !f.length)) { job.verified = ran != null; break; }
        // written subjects: the reviewer has checked each revision once; what it still finds wrong is left out
        if (round >= PRACTICE_ROUNDS || (!canRun(kind) && round >= 1)) {
          const keep = QS.filter((_, i) => !per[i].length);
          QS.forEach((x, i) => { if (per[i].length) job.dropped.push(x.title); });
          if (!keep.length) throw { code: "not_compliant", agent: "Reviewer" };
          QS = keep; job.verified = ran != null; break;
        }
        job.stage = "fix"; job.rounds++; paint();
        toReview = QS.map((_, i) => i).filter((i) => per[i].length);
        QS = await Promise.all(QS.map((x, i) => !per[i].length ? x
          : ask(job, "Reviewer", inEnglish(revisePromptQ(goals, focus, x, per[i], kind)), "default", true).then((y) => ({ ...normQ(y, kind), pts: x.pts })).catch((e) => { if (e && e.code === "cancelled") throw e; return x; })));
      }
      const at = new Date().toISOString();
      const docs = QS.map((x) => ({ v: 1, src: "en", id: newId("q"), sid: s.sid, kind, at, ...x, verified: canRun(kind) ? !!job.verified : undefined, mine: x.starter || "", hintsShown: 0 }));
      if (trLang()) {
        job.stage = "translate"; paint();
        for (const d of docs) { try { await translateQ(d, job); } catch (e) { if (e && e.code === "cancelled") throw e; } }
      }
      docs.forEach((d) => {
        ui.qcache[d.id] = d;
        if (db) db.doc("q/" + d.id).set(clone(d)).catch(() => notify("A question couldn't be saved.", "warn"));
        qIndex().push({ id: d.id, at, pts: d.pts, title: d.title, src: "en", tr: d.tr && d.tr[curLang()] ? { [curLang()]: d.tr[curLang()].title } : undefined, mark: null, star: false });
      });
      saveSubject();
      job.stage = "done";
      ui.qFilter = "todo"; ui.qPoint = focus ? focus[0] : ""; ui.qOpen = docs[0].id;
      logEvent("practice", "New questions: " + docs.map((d) => d.title).join("; ") + " (" + job.requests + " requests, " + job.rounds + " revisions" + (job.dropped.length ? "; left out: " + job.dropped.join("; ") : "") + ")");
      notify(docs.length === 1 ? "A new question is in your bank." : docs.length + " new questions are in your bank.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The reviewer still found every question wrong after revising them, so none were added. Try again."
        : e && e.code === "nothing_written" ? "None of the questions could be written. Try again." : jobError(e);
      logEvent("practice", "No new questions. " + job.error + (job.problems.length ? " Last problems: " + job.problems.map((p) => p.problem).join(" | ").slice(0, 600) : ""));
      if (!(e && e.code === "cancelled")) notify("No new questions were added. " + job.error, "bad");
    } finally { job.running = false; paint(); }
  }
  const PRACTICE_ROUNDS = 2;

  // ---------- one question: translation, loading, saving ----------
  function qPairs(q, T) {
    const P = []; T.hints = [];
    ["title", "task", "answer"].forEach((k) => P.push([q[k], (v) => { T[k] = v; }]));
    if (!q.tests) P.push([q.solution, (v) => { T.solution = v; }]);
    (q.hints || []).forEach((c, j) => P.push([c, (v) => { T.hints[j] = v; }]));
    return P;
  }
  async function translateQ(q, job) {
    const L = curLang(), T = {};
    await trPairs(job, qPairs(q, T), subjectAbout("a practice question: its task, answer, working and hints"), srcOf(q));
    q.tr = Object.assign({}, q.tr, { [L]: T });
  }
  function qView(q) {
    const T = trOf(q);
    if (!T) return q;
    return { ...q, title: pickT(T.title, q.title), task: pickT(T.task, q.task), answer: pickT(T.answer, q.answer), solution: q.tests ? q.solution : pickT(T.solution, q.solution), hints: (q.hints || []).map((x, i) => pickT((T.hints || [])[i], x)) };
  }
  const saveQ = (q) => { if (db && q) db.doc("q/" + q.id).set(clone(q)).catch(() => {}); };
  async function loadQ(id) {
    if (!id || ui.qcache[id] || ui.qLoading[id] || !db) return;
    ui.qLoading[id] = true;
    try { const snap = await db.doc("q/" + id).get(); ui.qcache[id] = snap.exists ? clone(snap.data()) : null; } catch (_) { ui.qcache[id] = null; }
    ui.qLoading[id] = false; render();
  }
  function deleteQ(id) {
    const s = cur(); if (!s) return;
    s.qbank = qIndex().filter((e) => e.id !== id);
    delete ui.qcache[id]; ui.qConfirm = null;
    if (ui.qOpen === id) ui.qOpen = null;
    try { const d = db && db.doc("q/" + id); if (d && d.delete) d.delete().catch(() => {}); } catch (_) {}
    saveSubject(); logEvent("practice", "Deleted a question"); render();
  }
  // the practice sets made before the bank (v2.0 to v2.2) move into it once, question by question
  async function migrateSets() {
    const s = cur();
    if (!s || s.qbankMigrated || !db || ui.qMigrating) return;
    ui.qMigrating = true;
    try {
      for (const p of s.practice || []) {
        const snap = await db.doc("practice2/" + p.id).get().catch(() => null);
        const S = snap && snap.exists && snap.data();
        if (!S || !Array.isArray(S.exercises)) continue;
        S.exercises.forEach((x, k) => {
          const id = newId("q"), T = S.tr && S.tr[curLang()] && (S.tr[curLang()].exercises || [])[k];
          const trAll = {}; Object.keys(S.tr || {}).forEach((L) => { const t = (S.tr[L].exercises || [])[k]; if (t) trAll[L] = { title: t.title, task: t.task, solution: t.solution, hints: t.hints }; });
          const q = { v: 1, src: S.src || "en", id, sid: s.sid, kind: S.kind, at: S.at, pts: [], title: x.title, task: x.task, answer: "", solution: x.solution || "", hints: x.hints || [], starter: x.starter, tests: x.tests, mine: x.mine || "", hintsShown: x.hintsShown || 0,
            tr: Object.keys(trAll).length ? trAll : undefined };
          ui.qcache[id] = q; db.doc("q/" + id).set(clone(q)).catch(() => {});
          qIndex().push({ id, at: S.at, pts: [], title: x.title, src: q.src, tr: Object.keys(trAll).length ? Object.fromEntries(Object.entries(trAll).map(([L, t]) => [L, t.title])) : undefined, mark: x.solved ? "right" : null, star: false });
        });
      }
      s.qbankMigrated = true; saveSubject();
    } catch (_) {}
    ui.qMigrating = false; render();
  }

  // ---------- checking code ----------
  async function checkMine(q) {
    if (!q || !canRun(q.kind)) return;
    ui.prun[q.id] = { running: true }; render();
    try {
      const rs = await runAll(q.kind, q.mine, q.tests);
      ui.prun[q.id] = { running: false, results: rs };
      saveQ(q);
    } catch (_) {
      ui.prun[q.id] = { running: false, error: q.kind === "python" ? "Python couldn't start in this page" + (PY.error ? " (" + PY.error + ")" : "") + ". Run your code on your own computer and compare with the examples." : "JavaScript couldn't run in this page. Run your code on your own computer and compare with the examples." };
    }
    render();
  }

  // ---------- the page ----------
  function prTeamCard(job) {
    const runnable = canRun(job.kind);
    const stages = [["plan", "Lead", "decides which questions are worth adding now"], ["write", "Writers", "write each question, its answer and its working"]]
      .concat(runnable ? [["run", "Runner", "runs each reference solution against its tests"]] : [])
      .concat([["check", "Reviewer", "works each question as you would, and fixes what it finds"]]);
    if (trLang()) stages.push(["translate", "Translator", "translates them into your language, keeping the English original"]);
    const order = runnable ? { plan: 0, write: 1, run: 2, check: 3, fix: 3, translate: 4, done: 5, error: -1 } : { plan: 0, write: 1, check: 2, fix: 2, translate: 3, done: 4, error: -1 };
    const at = order[job.stage];
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Writing new questions"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "write" && job.planned ? h("span", { class: "muted small" }, " · " + job.written + " of " + job.planned + " written") : null,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · revised " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "The reviewer found " + job.problems.length + " thing" + (job.problems.length === 1 ? "" : "s") + " to change and is revising.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  const Q_FILTERS = [["all", "All"], ["todo", "Not done"], ["wrong", "Mistakes"], ["star", "Bookmarked"]];
  const qMatches = (e, f, pt) => (!pt || e.pts.includes(pt)) && (f === "all" || (f === "todo" && !e.mark) || (f === "wrong" && e.mark === "wrong") || (f === "star" && e.star));
  function codeArea(q) {
    return h("textarea", { class: "code pr-code", rows: Math.max(8, Math.min(22, (q.mine || "").split("\n").length + 3)), spellcheck: "false", "aria-label": "Your code", value: q.mine || "",
      oninput: (e) => { q.mine = e.target.value; },
      onkeydown: (e) => {
        if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); const t = e.target, a = t.selectionStart, b = t.selectionEnd; t.value = t.value.slice(0, a) + "    " + t.value.slice(b); t.selectionStart = t.selectionEnd = a + 4; q.mine = t.value; }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); checkMine(q); }
      } });
  }
  function testResults(q, run) {
    if (!run) return null;
    if (run.running) return h("p", { class: "thinking" }, q.kind === "python" && !PY.api ? "Starting Python in the page (the first time takes a few seconds)…" : "Running your code…");
    if (run.error) return h("p", { class: "msg" }, run.error);
    const rs = run.results || [], passed = rs.filter((r) => r.pass).length;
    const firstFail = rs.findIndex((r) => !r.pass);
    const typed = (s) => { const ls = String(s || "").replace(/\r/g, "").split("\n"); if (ls.length > 1 && ls[ls.length - 1] === "") ls.pop(); return ls.length === 1 && ls[0] === "" && !s ? I18N.t("(nothing)") : ls.map((l) => l === "" ? I18N.t("⏎ (empty line)") : l).join("\n"); };
    return h("div", { class: "pr-results" },
      h("p", { class: "pr-score" + (passed === rs.length ? " all" : "") }, passed + " of " + rs.length + " tests pass"),
      h("ul", { class: "checks" }, rs.map((r, j) => {
        const t = q.tests[j];
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
  const ptChips = (pts) => pts.length ? h("p", { class: "small muted" }, ...pts.slice(0, 3).map((p, i) => [i ? " · " : "", ai("span", null, ptName(p))]).flat()) : null;
  function questionCard(e, list) {
    const q0 = ui.qcache[e.id];
    if (q0 === undefined) { setTimeout(() => loadQ(e.id), 0); return h("div", { class: "card" }, h("p", { class: "thinking" }, "Loading the question…")); }
    if (q0 === null) return h("div", { class: "card" }, h("p", { class: "msg" }, "This question couldn't be loaded."), h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => deleteQ(e.id) }, "Remove it from the list")));
    const q = qView(q0), code = canRun(q0.kind), k = list.findIndex((x) => x.id === e.id), run = ui.prun[e.id], shown = ui.qShown[e.id] || 0;
    const mark = (m) => { e.mark = e.mark === m ? null : m; saveSubject(); if (e.mark) logEvent("practice", (m === "right" ? "Right: " : "Wrong: ") + e.title); render(); };
    const go = (d) => { const n = list[k + d]; if (n) { ui.qOpen = n.id; render(); } };
    return h("article", { class: "card pr-ex pr-q" + (e.mark ? " " + e.mark : "") },
      h("div", { class: "row spread" },
        h("button", { class: "link small", type: "button", onclick: () => { ui.qOpen = null; render(); } }, "← All questions"),
        h("div", { class: "row" },
          h("span", { class: "muted small" }, (k + 1) + " / " + list.length),
          h("button", { class: "quiet", type: "button", disabled: k <= 0, onclick: () => go(-1) }, "Previous"),
          h("button", { class: "quiet", type: "button", disabled: k < 0 || k >= list.length - 1, onclick: () => go(1) }, "Next"))),
      h("div", { class: "pr-title" }, ai("h3", null, ...mathText(q.title))),
      ptChips(e.pts),
      trLine("q:" + e.id, q0, async (job) => { await translateQ(q0, job); e.tr = Object.assign({}, e.tr, { [curLang()]: q0.tr[curLang()].title }); saveQ(q0); saveSubject(); }),
      h("div", { class: "lesson pr-task" }, md(q.task)),
      code ? h("div", { class: "field" }, h("span", { class: "label" }, "Your code"), codeArea(q0)) : null,
      code ? h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: run && run.running, onclick: () => checkMine(q0) }, "Check my code"), h("span", { class: "muted small" }, "Ctrl or Cmd + Enter · " + q.tests.length + " tests")) : null,
      code ? testResults(q0, run) : null,
      q.hints.length ? h("div", { class: "row" }, q0.hintsShown < q.hints.length ? h("button", { class: "quiet", type: "button", onclick: () => { q0.hintsShown++; saveQ(q0); render(); } }, q0.hintsShown ? "Another hint" : "A hint") : null) : null,
      q0.hintsShown ? ai("ul", { class: "plain small pr-hints" }, q.hints.slice(0, q0.hintsShown).map((t, j) => h("li", null, h("strong", null, I18N.t("Hint " + (j + 1) + ":") + " "), ...mathText(t)))) : null,
      // the answer first; the working folded under it
      shown ? h("div", { class: "pr-answer" },
        code ? [h("p", { class: "label" }, "Reference solution"), h("div", { class: "code-wrap" }, h("pre", null, h("code", null, q.solution)))]
          : q.answer ? [h("p", { class: "label" }, "Answer"), h("div", { class: "lesson" }, md(q.answer)),
              h("details", { class: "pr-more", open: shown > 1 ? true : null, ontoggle: (ev) => { if (ev.target.open) ui.qShown[e.id] = 2; } }, h("summary", null, "The working"), h("div", { class: "lesson" }, md(q.solution)))]
          : [h("p", { class: "label" }, "Answer and working"), h("div", { class: "lesson" }, md(q.solution))])
        : h("div", { class: "row" }, h("button", { class: code ? "quiet" : "primary", type: "button", onclick: () => { ui.qShown[e.id] = 1; render(); } }, code ? "Show the reference solution" : "Show the answer")),
      h("div", { class: "row pr-marks" },
        h("button", { class: "quiet" + (e.mark === "right" ? " on" : ""), type: "button", "aria-pressed": e.mark === "right" ? "true" : "false", onclick: () => mark("right") }, "✓ Got it right"),
        h("button", { class: "quiet" + (e.mark === "wrong" ? " on" : ""), type: "button", "aria-pressed": e.mark === "wrong" ? "true" : "false", onclick: () => mark("wrong") }, "✗ Got it wrong"),
        h("button", { class: "quiet" + (e.star ? " on" : ""), type: "button", "aria-pressed": e.star ? "true" : "false", onclick: () => { e.star = !e.star; saveSubject(); render(); } }, e.star ? "★ Bookmarked" : "☆ Bookmark"),
        ui.qConfirm === e.id
          ? h("span", { class: "row" }, h("span", { class: "small" }, "Delete this question for good?"), h("button", { class: "quiet danger", type: "button", onclick: () => deleteQ(e.id) }, "Delete"), h("button", { class: "link small", type: "button", onclick: () => { ui.qConfirm = null; render(); } }, "Keep it"))
          : h("button", { class: "link small", type: "button", onclick: () => { ui.qConfirm = e.id; render(); } }, "Delete")),
      h("p", { class: "small muted" }, code ? (q0.verified ? "Written by AI. The page ran the reference solution against every test, and a reviewer worked the question." : "Written by AI and worked through by a reviewer.")
        : "Written by AI and worked through by a reviewer. Nothing in this subject can be run, so the answer is an AI's working, not proven: check what matters to you."));
  }
  function renderPractice() {
    const lede = "Your practice questions. Ask for new ones on what you've just learned or on one point, do them, check the answer, and mark how it went. Mistakes and bookmarks stay here to come back to.";
    if (!km) return noMapPanel("Practice");
    const s = cur(), job = ui.pjob, n = learnedPids().length, P = km.data;
    ui.qcache = ui.qcache || {}; ui.qLoading = ui.qLoading || {}; ui.qShown = ui.qShown || {}; ui.prun = ui.prun || {};
    if ((s.practice || []).length && !s.qbankMigrated) setTimeout(migrateSets, 0);
    const idx = qIndex().filter((e) => e.pts.every((p) => P.byId[p]) || !e.pts.length);
    const f = ui.qFilter || "all", pt = ui.qPoint && P.byId[ui.qPoint] ? ui.qPoint : "";
    const list = idx.filter((e) => qMatches(e, f, pt)).slice().reverse();
    const ptsWithQ = [...new Set(idx.flatMap((e) => e.pts))].filter((p) => P.byId[p]);
    const learned = learnedPids();
    const asker = h("div", { class: "card soft pr-verdict" },
      !n ? h("p", null, "Learn a point first: questions are written from what you've learned.") : null,
      n ? h("div", { class: "row" },
        h("button", { class: "primary", type: "button", disabled: !aiReady() || (job && job.running), onclick: () => buildQuestions(null) }, "New questions on what I learned recently")) : null,
      n ? h("div", { class: "row pr-pointask" },
        h("select", { id: "q-point", "aria-label": "A point to practise", onchange: (ev) => { ui.qAskPoint = ev.target.value; } },
          learned.slice().reverse().map((p) => h("option", { value: p, selected: (ui.qAskPoint || learned[learned.length - 1]) === p ? true : null }, shortPt(ptName(p))))),
        h("button", { class: "quiet", type: "button", disabled: !aiReady() || (job && job.running), onclick: () => buildQuestions([ui.qAskPoint && P.byId[ui.qAskPoint] ? ui.qAskPoint : learned[learned.length - 1]]) }, "New questions on this point")) : null,
      n ? h("p", { class: "small muted" }, "A lead, a writer per question and a reviewer: one request each, a few more if the reviewer finds something to fix.") : null);
    const counts = Object.fromEntries(Q_FILTERS.map(([k]) => [k, idx.filter((e) => qMatches(e, k, pt)).length]));
    const filters = idx.length ? h("div", { class: "row pr-filters" },
      h("div", { class: "chips" }, Q_FILTERS.map(([k, label]) => h("button", { class: "chip" + (f === k ? " on" : ""), type: "button", "aria-pressed": f === k ? "true" : "false", onclick: () => { ui.qFilter = k; ui.qOpen = null; render(); } }, I18N.t(label) + " " + counts[k]))),
      ptsWithQ.length ? h("select", { "aria-label": "Show questions on", onchange: (ev) => { ui.qPoint = ev.target.value; ui.qOpen = null; render(); } },
        h("option", { value: "", selected: !pt ? true : null }, "All points"),
        ptsWithQ.map((p) => h("option", { value: p, selected: pt === p ? true : null }, shortPt(ptName(p))))) : null) : null;
    const open = ui.qOpen && list.find((e) => e.id === ui.qOpen);
    const rows = list.length ? h("ol", { class: "plain pr-qlist" }, list.map((e) => h("li", null,
        h("button", { class: "pr-qrow" + (e.mark ? " " + e.mark : ""), type: "button", onclick: () => { ui.qOpen = e.id; render(); } },
          h("span", { class: "pr-qmark", "aria-hidden": "true" }, e.mark === "right" ? "✓" : e.mark === "wrong" ? "✗" : "·"),
          ai("span", { class: "pr-qtitle" }, ...mathText(qTitle(e))),
          e.star ? h("span", { class: "pr-qstar", title: I18N.t("Bookmarked") }, "★") : null,
          e.pts.length ? ai("span", { class: "muted small pr-qpts" }, shortPt(ptName(e.pts[0])) + (e.pts.length > 1 ? " +" + (e.pts.length - 1) : "")) : null))))
      : idx.length ? h("p", { class: "muted" }, "No questions here.") : ui.qMigrating ? h("p", { class: "thinking" }, "Moving your earlier practice sets into the bank…") : h("p", { class: "muted" }, "No questions yet.");
    return h("section", { class: "panel" },
      head("Practice", "Practice", lede),
      asker,
      job && (job.running || job.stage === "error") ? (job.running ? prTeamCard(job) : h("div", { class: "card soft" }, h("p", { class: "msg" }, job.error))) : null,
      filters,
      open ? questionCard(open, list) : rows);
  }
  // the Learn page sends the learner here for one point
  function practisePoint(pid) { ui.qAskPoint = pid; ui.qPoint = qIndex().some((e) => e.pts.includes(pid)) ? pid : ""; ui.qFilter = "all"; ui.qOpen = null; go("practice"); }

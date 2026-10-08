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
    const lines = P.KD.balls.map((b) => { const xs = b.pts.filter((p) => km.isLearned(p)); return xs.length ? "- " + b.name + ": " + xs.map(ptName).join("; ") : ""; }).filter(Boolean);
    const recent = Object.keys(idx).filter((p) => P.byId[p] && km.isLearned(p)).sort((a, b) => String(idx[b].at || "").localeCompare(String(idx[a].at || ""))).slice(0, 8);
    let budget = 5000;
    const taught = recent.map((p) => { const t = "- " + ptName(p) + ": " + (idx[p].notes || []).join(" | "); budget -= t.length; return budget > 0 ? t : ""; }).filter(Boolean);
    return ["Points the learner has learned, by topic (the learner knows these and nothing else):", lines.join("\n") || "- none yet",
      recent.length ? "Studied most recently, newest first: " + recent.map(ptName).join(", ") + "." : "",
      taught.length ? "What their lessons actually taught for those points (the lesson notes):\n" + taught.join("\n") : ""].filter(Boolean).join("\n");
  }
  const learnedSig = () => learnedPids().join(",");
  const prevSetsText = () => ((cur() && cur().practice) || []).slice(-3).map((s) => "- " + (s.titles || []).join("; ")).join("\n");

  // ---------- prompts ----------
  const practiceProfile = () => { const S = profileOf(); return { ...S, format: RUN_FORMAT[S.run] || S.format }; };
  const readinessPrompt = () => { const S = profileOf(); return [
    "You decide whether a self-learner of " + S.name + " should practise now, in Learning Companion, a study tool. Practice here is a separate section with exercises an AI writes for them.",
    ptLearner(), "", learnedText(), "",
    "Points they can learn next (everything these need is learned): " + km.data.KD.nodes.filter((x) => km.status(x.id) === "ready").map((x) => x.name).slice(0, 40).join(", ") + ".",
    STANDARDS.readiness(S),
    ((cur() && cur().practice) || []).length ? "Practice sets they already did (don't repeat them):\n" + prevSetsText() : "",
    "", 'Reply with only JSON: {"enough": true or false, "why": "plain and brief", "focus": ["learned points the practice should combine, recent ones first"], "review": ["older learned points worth bringing back inside the tasks"], "shape": "if enough: one sentence on what kind of task fits", "next": ["if not enough: the points from the map whose learning would make the most difference"]}',
  ].filter((x) => x !== "").join("\n"); };
  const checkRule = (kind) => canRun(kind)
    ? "- Enough tests to tell a correct solution from a nearly correct one: every case the task names, the boundaries, and the mistakes a reasonable attempt would make. No padding with tests that check the same thing."
    : "- Criteria a reader can apply: what a good answer must contain or do, enough to tell a good answer from a nearly good one, each one checkable from the answer alone. No padding.";
  const practiceContext = (R) => { const S = practiceProfile(); return [
    ptLearner(), "", learnedText(), "",
    "A first AI judged that practice is worth doing now. Its reasons: " + R.why,
    "Combine these points: " + R.focus.join(", ") + "." + (R.review.length ? " Bring these back as review where they fit: " + R.review.join(", ") + "." : ""),
    R.shape ? "Suggested kind of task: " + R.shape : "",
    ((cur() && cur().practice) || []).length ? "Sets they already did (write different tasks):\n" + prevSetsText() : "",
    "", STANDARDS.practice(S), checkRule(S.run), MD_NOTE,
  ].filter((x) => x !== "").join("\n"); };
  const outlineText = (O) => O.exercises.map((x, i) => (i + 1) + ". " + x.title + " (" + x.level + "): " + x.idea + " Decision: " + x.thinking).join("\n");
  const designPrompt = (R) => [
    "You design a practice set for a self-learner of " + profileOf().name + " in Learning Companion, a study tool. Plan the set now; each exercise will then be written in full by its own call, so keep this plan short.",
    practiceContext(R), "",
    'Reply with only JSON: {"when": "why practising this now makes sense", "how": ["advice on how to practise these particular exercises, as much as is useful"], "exercises": [{"title": "short title", "level": "warm-up, core or stretch", "combines": ["learned points it uses"], "idea": "what the task is, in two or three sentences", "thinking": "the decision the learner has to work out, which is why this is not a drill"}]}',
  ].join("\n");
  const exerciseShape = (kind) => canRun(kind)
    ? '{"title": "short title", "level": "warm-up, core or stretch", "task": "the full task in Markdown, with what the program reads, what it prints and at least one worked example", "combines": ["learned points it uses"], "thinking": "the decision the learner has to work out", "starter": "starter code or an empty string", "tests": [{"input": "the typed lines, one per line", "output": "exactly what the program prints"}], "solution": "a reference solution that uses only what the learner has learned", "hints": ["a gentle nudge", "a stronger nudge, still without the answer"]}'
    : '{"title": "short title", "level": "warm-up, core or stretch", "task": "the full task in Markdown, with what the learner is given, what their answer must do and a worked example where the subject allows one", "combines": ["learned points it uses"], "thinking": "the decision the learner has to work out", "criteria": ["what a good answer must contain or do"], "solution": "a model answer in Markdown that uses only what the learner has learned", "hints": ["a gentle nudge", "a stronger nudge, still without the answer"]}';
  const exercisePrompt = (R, O, i, kind) => [
    "You write one exercise of a practice set for a self-learner of " + profileOf().name + " in Learning Companion, a study tool.",
    practiceContext(R), "", "The whole set as planned:", outlineText(O), "",
    "Write exercise " + (i + 1) + ", \"" + O.exercises[i].title + "\", in full. Keep to its idea and its decision; improve on the plan where you see a better exercise.",
    "Reply with only JSON: " + exerciseShape(kind),
  ].join("\n");
  const exText = (x, i) => [
    "Exercise " + (i + 1) + ": " + x.title + " (" + x.level + ")", "Combines: " + x.combines.join(", "), "Thinking: " + x.thinking,
    "Task:\n" + x.task, x.starter ? "Starter:\n" + x.starter : "", (x.tests ? "Reference solution:\n" : "Model answer:\n") + x.solution,
    x.tests ? "Tests:\n" + x.tests.map((t, j) => "  " + (j + 1) + ". " + (t.check ? "check: " + t.check : "input " + JSON.stringify(t.input || "") + " -> output " + JSON.stringify(t.output || ""))).join("\n")
      : "Criteria:\n" + (x.criteria || []).map((c, j) => "  " + (j + 1) + ". " + c).join("\n"),
    "Hints: " + x.hints.join(" | "),
  ].filter(Boolean).join("\n");
  const setText = (S) => S.exercises.map(exText).join("\n\n");
  const practiceCheckPrompt = (R, S, ran, kind) => [
    "You review a practice set before a self-learner of " + profileOf().name + " sees it. You are an editor, not a gatekeeper: strict about whether the learner can do each exercise " + (canRun(kind) ? "and pass its tests" : "and whether its criteria and model answer are right") + ", constructive about the rest.",
    practiceContext(R), "",
    "The set:", "<<<", setText(S), ">>>",
    canRun(kind) ? (ran ? "The page ran each reference solution against its tests: " + ran : "The page could not run the code here, so check every expected output by reasoning.")
      : "Nothing in this subject can be run, so you are the only check: verify the model answers and the criteria by reasoning, carefully.",
    "",
    "Errors, which must be fixed: the learner couldn't fairly do the exercise (a task or " + (canRun(kind) ? "reference solution" : "model answer") + " that needs something they haven't learned and the task doesn't explain, an ambiguous task, " + (canRun(kind) ? "a test that checks behaviour the task doesn't state, a worked example or expected output that is wrong" : "a criterion the task doesn't ask for, a model answer or worked example that is wrong") + "), or the exercise isn't practice at all under the standards (a drill: one step, a lesson example retyped or lightly varied, a slip to spot).",
    "Improvements: where an exercise could be clearly better under the practice standards (a decision the task gives away, a hint that gives the answer away, a shallower version of a deeper exercise), most important first, only what matters.",
    "Wording, length and the choice of task are not problems when the standards are met.",
    'Reply with only JSON: {"errors": [{"exercise": 1, "problem": "what is wrong", "fix": "what to do"}], "improvements": [{"exercise": 1, "problem": "what falls short", "fix": "how to make it better"}]}',
  ].join("\n");
  const exerciseFixPrompt = (R, O, x, i, errs, imps) => [
    "You wrote exercise " + (i + 1) + " of the practice set below. An editor" + (x.tests ? " and the page's test run" : "") + " found the following." + (errs.length ? " Fix every error." : "") + (imps.length ? " Consider each improvement and make it where it helps the learner." : "") + " A fix may rewrite the exercise if it can't be repaired.",
    practiceContext(R), "", "The whole set as planned:", outlineText(O), "",
    errs.length ? "Errors:\n" + errs.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n") : "",
    imps.length ? "Improvements:\n" + imps.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Suggestion: " + p.fix : "")).join("\n") : "",
    "", "Your exercise:", JSON.stringify(x), "",
    "Reply with only the whole exercise as JSON, in the same shape.",
  ].filter((t) => t !== "").join("\n");
  const answerCheckPrompt = (x, answer) => [
    "You give feedback on a self-learner's answer to a practice exercise in " + profileOf().name + ", in Learning Companion. Be specific and fair: judge the answer against the criteria, not against the wording of the model answer, and accept any correct approach.",
    ptLearner(), "", "The task:", x.task, "", "Criteria:", (x.criteria || []).map((c, j) => (j + 1) + ". " + c).join("\n"), "", "A model answer (one correct answer among others):", x.solution, "",
    "The learner's answer:", "<<<", String(answer).slice(0, 12000), ">>>", "",
    "Don't rewrite their answer for them. Where something is wrong, say what and why, and nudge them toward fixing it themselves.",
    'Reply with only JSON: {"results": [{"criterion": 1, "met": "yes, partly or no", "note": "one sentence"}], "feedback": "a short paragraph: what is good, what to fix and why"}',
  ].join("\n");

  // ---------- reading the AI's answers ----------
  function normReady(d) {
    if (!d || typeof d.enough !== "boolean") throw { code: "invalid_json", agent: "Judge" };
    return { enough: d.enough, why: pstr(d.why), focus: parr(d.focus).map(pstr).filter(Boolean).slice(0, 12), review: parr(d.review).map(pstr).filter(Boolean).slice(0, 8), shape: pstr(d.shape), next: parr(d.next).map(pstr).filter(Boolean).slice(0, 10) };
  }
  function normOutline(d) {
    const ex = parr(d && d.exercises).map((x) => ({ title: pstr(x && x.title), level: pstr(x && x.level), combines: parr(x && x.combines).map(pstr).filter(Boolean), idea: pstr(x && x.idea), thinking: pstr(x && x.thinking) }))
      .filter((x) => x.title && x.idea).slice(0, 10);  // safety limit only
    if (!ex.length) throw { code: "invalid_json", agent: "Designer" };
    return { when: pstr(d.when), how: parr(d.how).map(pstr).filter(Boolean).slice(0, 10), exercises: ex };
  }
  function normEx(x, kind) {
    const e = {
      title: pstr(x && x.title), level: pstr(x && x.level), task: pstr(x && x.task), combines: parr(x && x.combines).map(pstr).filter(Boolean),
      thinking: pstr(x && x.thinking), solution: typeof (x && x.solution) === "string" ? x.solution : "", hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 8),
    };
    if (canRun(kind)) {
      e.starter = typeof (x && x.starter) === "string" ? x.starter.replace(/\s+$/, "") : "";
      e.tests = parr(x && x.tests).map((t) => ({ input: typeof (t && t.input) === "string" ? t.input : "", output: typeof (t && t.output) === "string" ? t.output : (t && t.check ? null : ""), check: pstr(t && t.check) || undefined })).filter((t) => t.check || t.output != null).slice(0, 40);
      if (!(e.title && e.task && e.solution && e.tests.length)) throw { code: "invalid_json", agent: "Designer" };
    } else {
      e.criteria = parr(x && x.criteria).map(pstr).filter(Boolean).slice(0, 20);
      if (!(e.title && e.task && e.solution && e.criteria.length)) throw { code: "invalid_json", agent: "Designer" };
    }
    return e;
  }
  const normProblemsPr = (v) => parr(v).map((p) => ({ exercise: Number(p && p.exercise) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  const shortOut = (s) => JSON.stringify(String(s == null ? "" : s).slice(0, 300));

  // ---------- the jobs ----------
  async function judgePractice() {
    const s = cur();
    if (!km || !s || !aiReady() || ui.pjudge && ui.pjudge.running) return;
    const job = { id: "pjudge", requests: 0, cancel: false, running: true };
    ui.pjudge = job; render();
    try {
      const R = normReady(await ask(job, "Judge", readinessPrompt(), "default", true));
      s.practiceReady = { sig: learnedSig(), at: new Date().toISOString(), ...R };
      saveSubject();
      logEvent("practice", "Practice check: " + (R.enough ? "worth practising now" : "not yet") + ". " + R.why);
    } catch (e) {
      job.error = jobError(e);
      notify("The practice check didn't finish. " + job.error, "bad");
    } finally { job.running = false; render(); }
  }
  const PRACTICE_ROUNDS = 2;
  async function buildPractice() {
    const s = cur(), R = s && s.practiceReady;
    if (!R || !aiReady() || (ui.pjob && ui.pjob.running)) return;
    const kind = profileOf().run;
    const focus = R.focus.length ? R : { ...R, focus: learnedPids().slice(-5).map(ptName) };
    const job = { id: "pset", requests: 0, cancel: false, running: true, stage: "design", rounds: 0, problems: [], ran: null, dropped: [], why: [], kind };
    const paint = () => { if (ui.step === "practice" && ui.view !== "map") render(); };
    job.paint = paint;
    ui.pjob = job; render();
    try {
      // 1. plan the set, then write each exercise with its own call (they run side by side)
      const O = normOutline(await ask(job, "Designer", designPrompt(focus), "default", true));
      job.planned = O.exercises.length; paint();
      let EX = await Promise.all(O.exercises.map((_, i) => ask(job, "Designer", exercisePrompt(focus, O, i, kind), "default", true).then((x) => normEx(x, kind)).catch((e) => {
        if (e && e.code === "cancelled") throw e;
        job.dropped.push(O.exercises[i].title); job.why.push(O.exercises[i].title + ": " + (e && e.code || "error")); return null; })));
      const polished = new Set();
      let advice = [];
      for (let round = 0; ; round++) {
        EX = EX.filter(Boolean);
        if (!EX.length) throw { code: "nothing_written", agent: "Designer" };
        const S = { exercises: EX };
        // 2. in runnable subjects, run every reference solution against its tests
        let ran = null; const runErrs = [];
        if (canRun(kind)) {
          job.stage = "run"; paint();
          try {
            for (const [i, x] of EX.entries()) {
              const rs = await runAll(kind, x.solution, x.tests);
              rs.forEach((r, j) => { if (!r.pass) runErrs.push({ exercise: i + 1, problem: "The reference solution fails test " + (j + 1) + ": typed " + shortOut(x.tests[j].input) + (x.tests[j].check ? ", check " + x.tests[j].check : ", expected " + shortOut(x.tests[j].output)) + ", but it printed " + shortOut(r.out) + (r.err ? " and stopped with " + (r.err === "TOO_LONG" ? "a run that never ended" : r.err) : "") + ".", fix: "Make the task, the tests and the solution agree, or drop the test." }); });
            }
            ran = runErrs.length ? runErrs.length + " test(s) failed; they are listed as errors." : "every test passed.";
          } catch (_) { ran = null; }
        }
        job.ran = ran;
        // 3. the editor: errors must be fixed, improvements get one revision
        job.stage = "check"; paint();
        const rv = await ask(job, "Checker", practiceCheckPrompt(focus, S, ran, kind), "complex", true);
        const errs = runErrs.concat(normProblemsPr(rv && (rv.errors || rv.problems)));
        const imps = normProblemsPr(rv && rv.improvements);
        advice = imps;
        const fixes = EX.map((x, i) => {
          const mine = (list) => list.filter((p) => p.exercise === i + 1 || !p.exercise);
          return { errs: mine(errs), imps: polished.has(i) ? [] : mine(imps) };
        });
        job.problems = errs.concat(imps);
        if (fixes.every((f) => !f.errs.length && !f.imps.length)) { job.verified = ran != null; break; }
        if (round >= PRACTICE_ROUNDS) {
          // exercises that still have errors are left out; the rest of the set is delivered
          const keep = EX.filter((_, i) => !fixes[i].errs.length);
          EX.forEach((x, i) => { if (fixes[i].errs.length) { job.dropped.push(x.title); job.why.push(x.title + ": still had errors"); } });
          if (!keep.length) throw { code: "not_compliant", agent: "Checker" };
          EX = keep; job.verified = ran != null; break;
        }
        // 4. rewrite only the exercises with something to fix
        job.stage = "fix"; job.rounds++; paint();
        EX = await Promise.all(EX.map((x, i) => {
          const f = fixes[i];
          if (!f.errs.length && !f.imps.length) return x;
          if (f.imps.length) polished.add(i);
          return ask(job, "Designer", exerciseFixPrompt(focus, O, x, i, f.errs, f.imps), "default", true).then((y) => normEx(y, kind)).catch((e) => { if (e && e.code === "cancelled") throw e; return x; });
        }));
      }
      const set = { v: 2, id: newId("s"), sid: s.sid, kind, at: new Date().toISOString(), focus: focus.focus, review: focus.review, when: O.when, how: O.how,
        exercises: EX.map((x) => ({ ...x, mine: x.starter || "", solved: false, hintsShown: 0, revealed: false })),
        advice: advice.map((p) => (p.exercise ? "Exercise " + p.exercise + ": " : "") + p.problem), dropped: job.dropped,
        verified: !!job.verified, requests: job.requests, rounds: job.rounds };
      ui.pset = set; ui.prun = {};
      s.practice = (s.practice || []).concat([{ id: set.id, at: set.at, titles: set.exercises.map((x) => x.title), focus: set.focus }]).slice(-30);
      s.practiceCurrent = set.id;
      if (db) db.doc("practice2/" + set.id).set(clone(set)).catch(() => notify("The practice set is shown but couldn't be saved.", "warn"));
      saveSubject();
      job.stage = "done";
      logEvent("practice", "Practice set delivered: " + set.exercises.map((x) => x.title).join("; ") + " (" + job.requests + " requests, " + job.rounds + " fix rounds" + (canRun(kind) ? (set.verified ? ", solutions run and passed" : ", solutions not run") : ", checked by AI only") + (job.why.length ? "; left out: " + job.why.join("; ") : "") + ")");
      notify("Your practice set is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The checker still found errors in every exercise after " + PRACTICE_ROUNDS + " rounds of fixes, so the set wasn't shown. Try again."
        : e && e.code === "nothing_written" ? "None of the planned exercises could be written. Try again." : jobError(e);
      logEvent("practice", "Practice set not delivered. " + job.error + (job.why.length ? " Dropped: " + job.why.join("; ") : "") + (job.problems.length ? " Last problems: " + job.problems.map((p) => p.problem).join(" | ").slice(0, 600) : ""));
      if (!(e && e.code === "cancelled")) notify("The practice set wasn't finished. " + job.error, "bad");
    } finally { job.running = false; paint(); }
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
        const d = await sample.json(answerCheckPrompt(x, x.mine), { modelTier: "default", cache: false });
        const results = parr(d && d.results).map((r) => ({ n: Number(r && r.criterion) || 0, met: ["yes", "partly", "no"].includes(pstr(r && r.met).toLowerCase()) ? pstr(r.met).toLowerCase() : "partly", note: pstr(r && r.note) }));
        ui.prun[i] = { running: false, feedback: { results, text: pstr(d && d.feedback) } };
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
    const stages = [["design", "Designer", "plans the set from what you've learned, then writes each exercise"]]
      .concat(runnable ? [["run", "Runner", "runs the designer's own solution against the tests"]] : [])
      .concat([["check", "Editor", runnable ? "checks that you can do each exercise and that it's worth doing" : "checks each exercise, its criteria and its model answer"]]);
    const order = runnable ? { design: 0, run: 1, check: 2, fix: 2, done: 3, error: -1 } : { design: 0, check: 1, fix: 1, done: 2, error: -1 };
    const at = order[job.stage];
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your practice set"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · fixed and rechecked " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.planned && job.stage === "design" ? h("p", { class: "small muted" }, "Planned " + job.planned + (job.planned === 1 ? " exercise" : " exercises") + "; writing them now.") : null,
      job.stage === "fix" ? h("p", { class: "small muted" }, "Found " + job.problems.length + " thing" + (job.problems.length === 1 ? "" : "s") + " to fix or improve; the designer is rewriting those exercises.") : null,
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
      const F = run.feedback, word = { yes: ["ok", "✓"], partly: ["warn", "~"], no: ["warn", "✗"] };
      return h("div", { class: "pr-results" },
        h("ul", { class: "checks" }, x.criteria.map((c, j) => { const r = F.results.find((y) => y.n === j + 1) || { met: "partly", note: "" }; const [cls, tick] = word[r.met];
          return h("li", { class: cls }, h("span", { class: "tick" }, tick), ai("div", null, h("span", null, c), r.note ? h("p", { class: "small muted" }, r.note) : null)); })),
        F.text ? ai("p", { class: "bubble-text" }, F.text) : null,
        h("p", { class: "caution" }, "AI feedback · can be wrong. Nothing in this subject can be run, so this is one AI's reading of your answer."));
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
  function exerciseCard(S, x, i) {
    const run = (ui.prun || {})[i], code = canRun(S.kind);
    return h("article", { class: "card pr-ex" + (x.solved ? " solved" : "") },
      h("div", { class: "row spread" },
        h("div", { class: "pr-title" }, h("span", { class: "pr-n" }, String(i + 1)), ai("h3", null, x.title)),
        h("div", { class: "row" }, x.level ? ai("span", { class: "chip" }, x.level) : null, x.solved ? h("span", { class: "chip ok" }, "solved") : null)),
      x.combines.length ? h("p", { class: "small muted" }, I18N.t("Combines:") + " ", ai("span", null, x.combines.join(" · "))) : null,
      h("div", { class: "lesson pr-task" }, md(x.task)),
      h("div", { class: "field" }, h("span", { class: "label" }, code ? "Your code" : "Your answer"), codeArea(i, x, code)),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", disabled: (run && run.running) || (!code && !aiReady()), onclick: () => checkMine(i) }, code ? "Check my code" : "Get feedback on my answer"),
        h("span", { class: "muted small" }, code ? "Ctrl or Cmd + Enter · " + x.tests.length + " tests" : "Ctrl or Cmd + Enter · " + x.criteria.length + " criteria · one AI request"),
        x.hints.length && x.hintsShown < x.hints.length ? h("button", { class: "quiet", type: "button", onclick: () => { x.hintsShown++; savePset(); render(); } }, x.hintsShown ? "Another hint" : "A hint") : null),
      testResults(S, x, run),
      x.hintsShown ? ai("ul", { class: "plain small pr-hints" }, x.hints.slice(0, x.hintsShown).map((t, j) => h("li", null, h("strong", null, I18N.t("Hint " + (j + 1) + ":") + " "), t))) : null,
      !code ? h("details", { class: "pr-fold" }, h("summary", { class: "small" }, "What a good answer does"), ai("ol", { class: "plain small" }, x.criteria.map((c) => h("li", null, c)))) : null,
      h("details", { class: "pr-more", ontoggle: (e) => { if (e.target.open && !x.revealed) { x.revealed = true; savePset(); } } },
        h("summary", null, code ? (x.solved ? "Compare with the reference solution" : "Show the reference solution") : (x.solved ? "Compare with the model answer" : "Show the model answer")),
        x.solved ? null : h("p", { class: "small muted" }, "Try first: the struggle is where the practice happens. Open this when you're done or truly stuck."),
        code ? h("div", { class: "code-wrap" }, h("pre", null, h("code", null, x.solution))) : h("div", { class: "lesson" }, md(x.solution)),
        x.thinking ? h("p", { class: "small" }, h("strong", null, "What this exercise is really about: "), ai("span", null, x.thinking)) : null));
  }
  function renderPractice() {
    const lede = "Practice comes in sets, once what you've learned can combine into real tasks. An AI judges whether that's true yet and writes the exercises; where the subject can be run, the page runs the AI's own solution against the tests before you see them.";
    if (!km) return noMapPanel("Practice");
    const s = cur(), R = s.practiceReady, fresh = R && R.sig === learnedSig(), judge = ui.pjudge, job = ui.pjob;
    if (s.practiceCurrent && !ui.pset && ui.psetTried !== s.practiceCurrent) { ui.psetTried = s.practiceCurrent; setTimeout(() => loadPracticeSet(s.practiceCurrent), 0); }
    const n = learnedPids().length;
    let verdict;
    if (judge && judge.running) verdict = h("div", { class: "card" }, h("p", { class: "thinking" }, "Looking at what you've learned…"));
    else if (!R || !fresh) verdict = h("div", { class: "card soft pr-verdict" },
      h("p", null, R ? "You've learned more since the last check (" + n + " points now)." : "You've learned " + n + " points so far."),
      h("p", { class: "small muted" }, "First, an AI looks at everything you've learned and judges whether it adds up to practice worth doing, or whether a few more points would make it much better. One AI request."),
      h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady() || !n, onclick: judgePractice }, "Is it time to practise?")));
    else verdict = h("div", { class: "card pr-verdict " + (R.enough ? "yes" : "no") },
      h("p", { class: "eyebrow" }, R.enough ? "Worth practising now" : "Not yet"),
      ai("p", null, R.why),
      R.enough && R.focus.length ? h("p", { class: "small" }, h("strong", null, "It would combine: "), ai("span", null, R.focus.join(" · "))) : null,
      R.enough && R.review.length ? h("p", { class: "small" }, h("strong", null, "With review of: "), ai("span", null, R.review.join(" · "))) : null,
      !R.enough && R.next.length ? h("p", { class: "small" }, h("strong", null, "Practice gets much better after: "), ai("span", null, R.next.join(" · "))) : null,
      h("div", { class: "row" },
        h("button", { class: R.enough ? "primary" : "quiet", type: "button", disabled: !aiReady() || (job && job.running), onclick: buildPractice }, R.enough ? "Build a practice set" : "Build one anyway"),
        h("span", { class: "muted small" }, "One AI request to plan, one per exercise, then checks and fixes")));
    const S = ui.pset && ui.pset.sid === s.sid ? ui.pset : null;
    const verifiedText = (S) => canRun(S.kind)
      ? (S.verified ? "Written by AI. The page ran its reference solutions against every test before showing them, and an editor held the set to the practice standards." : "Written by AI and checked against the practice standards. The page couldn't run the code when it was built, so the tests weren't run.")
      : "Written by AI and checked by a second AI against the practice standards. Nothing in this subject can be run, so neither the exercises nor your answers are proven: treat the model answers and the feedback as one AI's view.";
    const setView2 = S ? [
      h("div", { class: "card soft pr-plan" },
        h("p", { class: "eyebrow" }, "This set"),
        S.when ? ai("p", null, S.when) : null,
        S.how.length ? h("div", null, h("p", { class: "label" }, "How to practise"), ai("ul", { class: "plain" }, S.how.map((t) => h("li", null, t)))) : null,
        h("p", { class: "small muted" }, verifiedText(S)),
        (S.dropped || []).length ? h("p", { class: "small muted" }, I18N.t("Left out because it couldn't be made right:") + " ", ai("span", null, S.dropped.join(" · "))) : null,
        (S.advice || []).length ? h("details", { class: "pr-fold" }, h("summary", { class: "small" }, "The editor's remaining suggestions"), ai("ul", { class: "plain small" }, S.advice.map((t) => h("li", null, t)))) : null),
      ...S.exercises.map((x, i) => exerciseCard(S, x, i)),
    ] : ui.psetLoading ? [h("p", { class: "thinking" }, "Loading your practice set…")] : [];
    const older = (s.practice || []).filter((p) => !S || p.id !== S.id).slice().reverse();
    return h("section", { class: "panel" },
      head("Practice", "Practice", lede),
      verdict,
      job && (job.running || job.stage === "error") ? (job.running ? prTeamCard(job) : h("div", { class: "card soft" }, h("p", { class: "msg" }, job.error))) : null,
      ...setView2,
      older.length ? h("details", { class: "card soft" }, h("summary", null, "Earlier practice sets (" + older.length + ")"),
        h("ul", { class: "plain" }, older.map((p) => h("li", null, ai("button", { class: "link", type: "button", onclick: () => { s.practiceCurrent = p.id; ui.pset = null; ui.prun = {}; saveSubject(); loadPracticeSet(p.id); } }, (p.titles || []).join(" · ") || p.id))))) : null);
  }

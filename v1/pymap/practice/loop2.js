  async function buildPractice() {
    const R = state.practiceReady;
    if (!R || !aiReady() || (ui.pjob && ui.pjob.running)) return;
    const focus = R.focus.length ? R : { ...R, focus: learnedPids().slice(-5).map(ptName) };
    const job = { id: "pset", requests: 0, cancel: false, running: true, stage: "design", rounds: 0, problems: [], ran: null, dropped: [], why: [] };
    ui.pjob = job; render();
    const paint = () => { if (ui.step === "practice") render(); };
    try {
      // 1. plan the set, then write each exercise with its own call (they run side by side)
      const O = normOutline(await ask(job, "Designer", designPrompt(focus), "default", true));
      job.planned = O.exercises.length; paint();
      let EX = await Promise.all(O.exercises.map((_, i) => ask(job, "Designer", exercisePrompt(focus, O, i), "default", true).then(normEx).catch((e) => {
        if (e && e.code === "cancelled") throw e;
        job.dropped.push(O.exercises[i].title); job.why.push(O.exercises[i].title + ": " + (e && e.code || "error")); return null; })));
      let polished = new Set(), advice = [];
      for (let round = 0; ; round++) {
        EX = EX.filter(Boolean);
        if (!EX.length) throw { code: "nothing_written", agent: "Designer" };
        const S = { exercises: EX };
        // 2. run every reference solution against its tests
        job.stage = "run"; paint();
        let ran = null; const runErrs = [];
        try {
          await loadPy();
          for (const [i, x] of EX.entries()) {
            const rs = await runAll(x.solution, x.tests);
            rs.forEach((r, j) => { if (!r.pass) runErrs.push({ exercise: i + 1, problem: "The reference solution fails test " + (j + 1) + ": typed " + shortOut(x.tests[j].input) + (x.tests[j].check ? ", check " + x.tests[j].check : ", expected " + shortOut(x.tests[j].output)) + ", but it printed " + shortOut(r.out) + (r.err ? " and stopped with " + (r.err === "TOO_LONG" ? "a run that never ended" : r.err) : "") + ".", fix: "Make the task, the tests and the solution agree, or drop the test." }); });
          }
          ran = runErrs.length ? runErrs.length + " test(s) failed; they are listed as errors." : "every test passed.";
        } catch (_) { ran = null; }
        job.ran = ran;
        // 3. the editor: errors must be fixed, improvements get one revision
        job.stage = "check"; paint();
        const rv = await ask(job, "Checker", practiceCheckPrompt(focus, S, ran), "complex", true);
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
          EX.forEach((x, i) => { if (fixes[i].errs.length) job.dropped.push(x.title); job.why.push(x.title + ": still had errors"); });
          if (!keep.length) throw { code: "not_compliant", agent: "Checker" };
          EX = keep; job.verified = ran != null; break;
        }
        // 4. rewrite only the exercises with something to fix
        job.stage = "fix"; job.rounds++; paint();
        EX = await Promise.all(EX.map((x, i) => {
          const f = fixes[i];
          if (!f.errs.length && !f.imps.length) return x;
          if (f.imps.length) polished.add(i);
          return ask(job, "Designer", exerciseFixPrompt(focus, O, x, i, f.errs, f.imps), "default", true).then(normEx).catch((e) => { if (e && e.code === "cancelled") throw e; return x; });
        }));
      }
      const set = { v: 1, id: "s" + Date.now().toString(36), at: new Date().toISOString(), focus: focus.focus, review: focus.review, when: O.when, how: O.how,
        exercises: EX.map((x) => ({ ...x, mine: x.starter || "", solved: false, hintsShown: 0, revealed: false })),
        advice: advice.map((p) => (p.exercise ? "Exercise " + p.exercise + ": " : "") + p.problem), dropped: job.dropped,
        verified: !!job.verified, requests: job.requests, rounds: job.rounds };
      ui.pset = set; ui.prun = {};
      state.practice = (state.practice || []).concat([{ id: set.id, at: set.at, titles: set.exercises.map((x) => x.title), focus: set.focus }]).slice(-20);
      state.practiceCurrent = set.id;
      if (db) db.doc("practice/" + set.id).set(clone(set)).catch(() => notify("The practice set is shown but couldn't be saved.", "warn"));
      saveState();
      job.stage = "done";
      logEvent("practice", "Practice set delivered: " + set.exercises.map((x) => x.title).join("; ") + " (" + job.requests + " requests, " + job.rounds + " fix rounds" + (set.verified ? ", solutions run and passed" : ", solutions not run") + (job.why.length ? "; left out: " + job.why.join("; ") : "") + ")");
      notify("Your practice set is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The checker still found errors in every exercise after " + PRACTICE_ROUNDS + " rounds of fixes, so the set wasn't shown. Try again."
        : e && e.code === "nothing_written" ? "None of the planned exercises could be written. Try again."
        : e && e.code === "cancelled" ? "Stopped." : (e && e.agent ? e.agent + ": " : "") + noteAiError(e);
      logEvent("practice", "Practice set not delivered. " + job.error + (job.why.length ? " Dropped: " + job.why.join("; ") : "") + (job.problems.length ? " Last problems: " + job.problems.map((p) => p.problem).join(" | ").slice(0, 600) : ""));
      if (!(e && e.code === "cancelled")) notify("The practice set wasn't finished. " + job.error, "bad");
    } finally { job.running = false; paint(); }
  }

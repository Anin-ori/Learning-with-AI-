  function normOutline(d) {
    const ex = parr(d && d.exercises).map((x) => ({ title: pstr(x && x.title), level: pstr(x && x.level), combines: parr(x && x.combines).map(pstr).filter(Boolean), idea: pstr(x && x.idea), thinking: pstr(x && x.thinking) }))
      .filter((x) => x.title && x.idea).slice(0, 8);  // safety limit only
    if (!ex.length) throw { code: "invalid_json", agent: "Designer" };
    return { when: pstr(d.when), how: parr(d.how).map(pstr).filter(Boolean).slice(0, 10), exercises: ex };
  }
  function normEx(x) {
    const e = {
      title: pstr(x && x.title), level: pstr(x && x.level), task: pstr(x && x.task), combines: parr(x && x.combines).map(pstr).filter(Boolean),
      thinking: pstr(x && x.thinking), starter: typeof (x && x.starter) === "string" ? x.starter.replace(/\s+$/, "") : "", solution: typeof (x && x.solution) === "string" ? x.solution : "",
      tests: parr(x && x.tests).map((t) => ({ input: typeof (t && t.input) === "string" ? t.input : "", output: typeof (t && t.output) === "string" ? t.output : (t && t.check ? null : ""), check: pstr(t && t.check) || undefined })).filter((t) => t.check || t.output != null).slice(0, 30),
      hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 8),
    };
    if (!(e.title && e.task && e.solution && e.tests.length)) throw { code: "invalid_json", agent: "Designer" };
    return e;
  }
  const normProblemsPr = (v) => parr(v).map((p) => ({ exercise: Number(p && p.exercise) || 0, problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);

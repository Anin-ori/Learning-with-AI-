"""v1.14: lessons are created by the AI and steered by a guide, not assembled from slots and held back by a checklist.
Builds v1.13, then:
- the teaching standards become one short guide (depth, surprises, honest scope, extensions, new things) that the planner,
  teacher and checker all read. It explains what good teaching is and why; it presets no content and no counts.
- the planner's plan is free: aim, approach, sections, and what lies beyond the lesson. No trap, limit or extension slots.
  The teacher may improve on the plan, and writes an extension whenever something beyond the lesson is worth it.
- the checker is an editor: errors (facts, code, outputs, copied text, exercises, notes) block delivery until fixed;
  improvements against the guide go back to the teacher once and then stay visible as advice. Craft never blocks delivery.
- the subject profile keeps only illustrations; the preset content (the match entry, the __iadd__ example) is gone."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate14.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)
def splice(start, end, new):
    """replace from start (inclusive) to end (exclusive); both markers unique"""
    global s
    assert s.count(start) == 1 and s.count(end) == 1, (start[:60], s.count(start), end[:60], s.count(end))
    i = s.index(start); j = s.index(end); assert i < j
    s = s[:i] + new + s[j:]

rep("<title>Learning Companion v1.13</title>", "<title>Learning Companion v1.14</title>")
rep('<span class="pill">Python pilot / v1.13</span>', '<span class="pill">Python pilot / v1.14</span>')

# the subject profile: illustrations only
for key in ("    limit: ", "    deeper: ", "    deeperEntry: "):
    i = s.index(key, s.index("  const SUBJECT = {")); j = s.index("\n", i) + 1; s = s[:i] + s[j:]
rep('''  // One framework for every subject. The rules below never name a subject; a subject profile supplies only the examples
  // that show the standard. Python is the first profile; another subject adds its own profile, not its own rules.''',
    '''  // One framework for every subject. The guide never names a subject; a subject profile supplies only illustrations of
  // the standard, never content to reuse. Python is the first profile; another subject adds its own profile, not its own rules.''')

# the guide replaces the lesson rule lists (the practice standards stay)
splice("  const STANDARDS = {\n    planner: (S) => [", "    readiness: (S) => [", open(f"{HERE}/lessons/guide.js").read())
i = s.index('    checker: (S) => "a mistake, pitfall or trap'); j = s.index("\n", i) + 1; s = s[:i] + s[j:]

# the pipeline: prompts, plan, review
splice("  function plannerPromptPt(pid, cands) {", "  async function buildPointLesson(pid) {", open(f"{HERE}/lessons/pipeline.js").read() + "\n")

# the build loop: errors block, improvements get one round and then stay as advice
rep('''      job.plan = normPlan(await ask(job, "Planner", plannerPromptPt(pid, cands), "default", true), cands);
      job.stage = "teach"; paint();
      let L = splitLesson(await ask(job, "Teacher", teacherPromptPt(pid, job.plan), "default", false));
      for (let round = 0; ; round++) {
        job.stage = "check"; paint();
        const probs = normProblemsPt(await ask(job, "Checker", checkerPromptPt(pid, job.plan, L), "complex", true));
        if (!probs.length && L.notes.length) { job.problems = []; break; }
        if (!L.notes.length && !probs.length) probs.push({ quote: "", problem: "The notes are missing.", fix: "Add the === NOTES === line and 4 to 7 notes." });
        job.problems = probs;
        if (round >= PL_ROUNDS) throw { code: "not_compliant", agent: "Checker" };
        job.stage = "fix"; job.rounds++; paint();
        L = splitLesson(await ask(job, "Teacher", reviserPromptPt(pid, job.plan, L, probs), "default", false));
      }''',
    '''      job.plan = normPlan(await ask(job, "Planner", plannerPromptPt(pid, cands), "default", true));
      job.stage = "teach"; paint();
      let L = splitLesson(await ask(job, "Teacher", teacherPromptPt(pid, job.plan), "default", false));
      let polished = false;
      job.advice = [];
      for (let round = 0; ; round++) {
        job.stage = "check"; paint();
        const rv = normReview(await ask(job, "Checker", checkerPromptPt(pid, job.plan, L), "complex", true));
        if (!L.notes.length) rv.errors.push({ quote: "", problem: "The notes are missing.", fix: "Add the === NOTES === line and 4 to 7 notes." });
        const imps = polished ? [] : rv.improvements;
        job.advice = rv.improvements;
        job.problems = rv.errors.concat(imps);
        if (!rv.errors.length && !imps.length) break;
        if (rv.errors.length && round >= PL_ROUNDS) throw { code: "not_compliant", agent: "Checker" };
        job.stage = "fix"; job.rounds++; paint();
        L = splitLesson(await ask(job, "Teacher", reviserPromptPt(pid, job.plan, L, rv.errors, imps), "default", false));
        if (imps.length) polished = true;
      }''')
rep('''deeper: L.deeper || "", notes: L.notes, requests''', '''deeper: L.deeper || "", notes: L.notes, advice: job.advice || [], requests''')
rep('''      job.stage === "fix" ? h("p", { class: "small muted" }, "The checker found " + job.problems.length + " problem" + (job.problems.length === 1 ? "" : "s") + "; the teacher is fixing them.") : null,''',
    '''      job.stage === "fix" ? h("p", { class: "small muted" }, "The editor sent back " + job.problems.length + " note" + (job.problems.length === 1 ? "" : "s") + "; the teacher is revising.") : null,''')
rep('''["check", "Checker", "checks facts, code and outputs"]];''', '''["check", "Checker", "checks facts and code, and suggests improvements"]];''')

# the page: the plan as the planner wrote it, and the editor's remaining suggestions
rep('''          L.plan.aim ? h("p", { class: "small" }, h("strong", null, "Aim: "), L.plan.aim) : null,''',
    '''          L.plan.aim ? h("p", { class: "small" }, h("strong", null, "Aim: "), L.plan.aim) : null,
          L.plan.approach ? h("p", { class: "small" }, h("strong", null, "Approach: "), L.plan.approach) : null,''')
rep('''          L.plan.ml_link ? h("p", { class: "small" }, h("strong", null, "In machine learning: "), L.plan.ml_link) : null,''',
    '''          L.plan.beyond ? h("p", { class: "small" }, h("strong", null, "Beyond this lesson: "), L.plan.beyond) : null,
          L.plan.ml_link ? h("p", { class: "small" }, h("strong", null, "In machine learning: "), L.plan.ml_link) : null,
          (L.advice || []).length ? h("div", { class: "small" }, h("strong", null, "The editor's remaining suggestions (they didn't block the lesson):"),
            h("ul", { class: "plain" }, L.advice.map((a) => h("li", null, a.problem)))) : null,''')
open(p, "w").write(s)
print("v1.14 written:", len(s))

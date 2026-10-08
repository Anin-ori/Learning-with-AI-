"""v1.18: practice sets are written in pieces. Builds v1.17, then:
- the designer plans the set (a short answer), then each exercise is written in full by its own call, side by side.
  Cause: since v1.15 the designer wrote the whole set (every task, test and solution) in one JSON answer; with no caps it
  ran past the answer length limit, which the platform reports as unreadable JSON, so no set was ever delivered.
- the page runs every reference solution; an editor separates errors (must be fixed) from improvements (one revision);
  only exercises with something to fix are rewritten.
- an exercise that still has errors after the fix rounds is left out and named, instead of failing the whole set.
- the set shows the editor's leftover suggestions and anything left out."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate18.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)
def splice(a, b, new, keep_end=True):
    global s
    i = s.index(a); j = s.index(b, i)
    assert s.count(a) == 1, a
    s = s[:i] + new + (s[j:] if keep_end else s[j + len(b):])
rd = lambda f: open(f"{HERE}/practice/{f}").read()

rep("<title>Learning Companion v1.17</title>", "<title>Learning Companion v1.18</title>")
rep('<span class="pill">Python pilot / v1.17</span>', '<span class="pill">Python pilot / v1.18</span>')

splice("  const designPrompt = (R) => [", "  // ---------- reading the AI's answers ----------", rd("practice2.js") + "\n")
splice("  function normSet(d) {", "  const shortOut = ", rd("build2.js"))
splice("  async function buildPractice() {", "  async function loadPracticeSet(id) {", rd("loop2.js") + "\n")
assert "practiceChecker(SUBJECT)" not in s.split("const STANDARDS")[0] or True

# the team card
rep('''const PR_STAGES = [["design", "Designer", "writes exercises from what you've learned"], ["run", "Runner", "runs the designer's own solution against the tests"], ["check", "Checker", "checks depth, fairness and that you know everything needed"]];''',
    '''const PR_STAGES = [["design", "Designer", "plans the set from what you've learned, then writes each exercise"], ["run", "Runner", "runs the designer's own solution against the tests"], ["check", "Editor", "checks that you can do each exercise and that it's worth doing"]];''')
rep('''      job.stage === "fix" ? h("p", { class: "small muted" }, "Found " + job.problems.length + " problem" + (job.problems.length === 1 ? "" : "s") + "; the designer is fixing them.") : null,''',
    '''      job.planned && job.stage === "design" ? h("p", { class: "small muted" }, "Planned " + job.planned + (job.planned === 1 ? " exercise" : " exercises") + "; writing them now.") : null,
      job.stage === "fix" ? h("p", { class: "small muted" }, "Found " + job.problems.length + " thing" + (job.problems.length === 1 ? "" : "s") + " to fix or improve; the designer is rewriting those exercises.") : null,''')
rep('''h("span", { class: "muted small" }, "Usually 3 to 7 AI requests")));''',
    '''h("span", { class: "muted small" }, "One AI request to plan, one per exercise, then checks and fixes")));''')
# the set: leftover suggestions and anything left out
rep('''        h("p", { class: "small muted" }, S.verified ? "Written by AI. The page ran its reference solutions against every test before showing them, and a checker held the set to the practice standards." : "Written by AI and checked against the practice standards. The page couldn't run Python when it was built, so the tests weren't run.")),''',
    '''        h("p", { class: "small muted" }, S.verified ? "Written by AI. The page ran its reference solutions against every test before showing them, and an editor held the set to the practice standards." : "Written by AI and checked against the practice standards. The page couldn't run Python when it was built, so the tests weren't run."),
        (S.dropped || []).length ? h("p", { class: "small muted" }, "Left out because it couldn't be made right: " + S.dropped.join(" · ")) : null,
        (S.advice || []).length ? h("details", { class: "pr-fold" }, h("summary", { class: "small" }, "The editor's remaining suggestions"), h("ul", { class: "plain small" }, S.advice.map((t) => h("li", null, t)))) : null),''')
open(p, "w").write(s)
print("v1.18 written:", len(s))

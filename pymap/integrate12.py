"""v1.11: practice becomes its own section, written by AI under the practice standards and proven by running it.
Builds v1.10, then:
- a Practice section in the top bar, separate from Learn. An AI first judges whether what the learner has learned adds up
  to practice worth doing (review of earlier points included). If so, a designer writes up to 3 exercises under the
  practice standards, each with a reference solution and tests; the page runs the solution against the tests in the browser
  (Pyodide) and a checker holds the set to the standards. Failures go back to the designer; only a passing set is shown.
- the learner writes code in the page and checks it against the same tests; hints and the reference solution are opt-in.
- the practice standards live in the subject-neutral STANDARDS block, with Python's examples in SUBJECT.
- per-point lessons no longer pick practice links, and the notes no longer list them."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate11.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)
def cut(start, end):
    """remove from the start marker up to and including the end marker (both unique)"""
    global s
    i = s.index(start); assert s.count(start) == 1
    j = s.index(end, i) + len(end)
    s = s[:i] + s[j:]

rep("<title>Learning Companion v1.10</title>", "<title>Learning Companion v1.11</title>")
rep('<span class="pill">Python pilot / v1.10</span>', '<span class="pill">Python pilot / v1.11</span>')

# ---------- the practice standards, in the same subject-neutral framework ----------
rep('''    deeper: "+= runs the special method __iadd__''', '''    shallow: "\\"read two numbers and print their sum\\"",
    rich: "\\"read prices until a blank line, then print how many there were, the total and the largest, or 'no prices' if none were typed\\"",
    format: "Each exercise is a whole program that reads typed lines with input() and prints with print(). A test gives the typed lines and exactly what the program prints. Text passed to input() as a prompt isn't checked, so the task should say prompts are optional, and examples show only what print() prints. Only if the learner has learned def and the exercise is about writing a function may a test instead be {\\"check\\": \\"one Python assert line that calls the function\\"}; then the task names the function and its parameters exactly.",
    deeper: "+= runs the special method __iadd__''')
rep('''    checker: (S) => "a mistake, pitfall or trap whose explanation''', '''    readiness: (S) => [
      "Practice standards (they hold for every subject; the examples come from " + S.name + "):",
      "- Practice is worth doing when the learned points can combine into a small, real task in which the learner must decide how to fit them together: what to keep track of, in what order things happen, which cases to handle. One or two isolated points are not enough: practice on them is a drill that only repeats the lesson.",
      "- Recent points are the focus. Older learned points can come back as review inside the tasks, even if that is all they get.",
      "- Judge only from the lists given. Don't assume the learner knows anything else.",
      "- If it isn't enough yet, say plainly why, and name up to 3 of the points they can learn next whose learning would make practice clearly worth doing.",
    ].join("\\n"),
    practice: (S) => [
      "Practice standards (they hold for every subject; the examples come from " + S.name + "):",
      "- Each exercise is a small, realistic task that combines at least two of the points to combine, ideally three or more, and brings back review points where they fit. It must make the learner decide something: how to structure the solution, what to keep track of, in what order, which cases to handle. Name that decision in \\"thinking\\".",
      "- Shallow is not allowed: retyping or lightly varying a lesson example; filling one blank; a single operation; trivia about notation; a slip to spot (" + S.slips + "); a task whose only difficulty is reading a long statement. For example, " + S.shallow + " is a drill, not practice; " + S.rich + " is practice.",
      "- Use only what the learner has learned. The task and the reference solution may need nothing else. If a good task would need more, change the task.",
      "- The task is complete and exact: what it is given, what it must produce, and at least one worked example. Every behaviour a test checks is stated in the task. Don't give away the decision the exercise is about.",
      "- " + S.format,
      "- Up to 3 exercises, easier to harder. One excellent exercise beats three thin ones.",
      "- 4 to 8 tests per exercise, covering the cases the task names, such as an empty input or a boundary.",
      "- 2 hints per exercise: nudges toward the decision, never code.",
      "- Never call a mistake common or classic.",
    ].join("\\n"),
    practiceChecker: (S) => "an exercise that is shallow under the standards (a drill, a lesson example retyped or lightly varied, one blank, one operation, notation trivia, a slip to spot); an exercise that combines fewer than two of the points to combine; a task or reference solution that needs something the learner hasn't learned; a task that is ambiguous, or a test that checks behaviour the task doesn't state; a worked example or test whose expected output is wrong; a task that gives away the decision it is about; a hint that gives the code away",
    checker: (S) => "a mistake, pitfall or trap whose explanation''')

# ---------- the practice module ----------
mod = open(f"{HERE}/practice/practice.js").read()
mod = mod.replace('''    ptLearner(), "", learnedText(), "",
    STANDARDS.readiness(SUBJECT),''', '''    ptLearner(), "", learnedText(), "",
    "Points they can learn next (everything these need is learned): " + (km.data.KD.nodes || []).filter((x) => km.status(x.id) === "ready").map((x) => x.name).slice(0, 30).join(", ") + ".",
    STANDARDS.readiness(SUBJECT),''')
rep('''  // ---------- Render ----------''', mod + '''
  // ---------- Render ----------''')

# ---------- the section: nav, panel, availability ----------
rep('''<button type="button" data-sec="learn">Learn</button>''', '''<button type="button" data-sec="learn">Learn</button><button type="button" data-sec="practice">Practice</button>''')
rep('''      case "learn": return !!km;\n      case "check":''', '''      case "learn": return !!km;\n      case "practice": return !!km;\n      case "check":''')
rep('''learn: renderPointLearn, check: renderPointNotes };''', '''learn: renderPointLearn, practice: renderPractice, check: renderPointNotes };''')
rep('''    document.body.classList.toggle("reading", ui.step === "learn");''', '''    document.body.classList.toggle("reading", ui.step === "learn" || ui.step === "practice");''')
rep('''    const sec = ui.view === "map" ? "map" : ui.step === "learn" ? "learn" : ui.step === "check" ? "notes" : "profile";''',
    '''    const sec = ui.view === "map" ? "map" : ui.step === "learn" ? "learn" : ui.step === "practice" ? "practice" : ui.step === "check" ? "notes" : "profile";''')
rep('''    const step = sec === "learn" ? "learn" : sec === "notes"''', '''    const step = sec === "learn" ? "learn" : sec === "practice" ? "practice" : sec === "notes"''')

# ---------- per-point lessons no longer carry practice ----------
cut('''      "Practice: the lesson ends with practice written by people.''', '''"(No human-written practice is available for this point. Return an empty practice list.)",\n''')
rep(''', "ml_link": "one sentence on where this shows up in machine-learning work", "practice": [{"n": 1, "why": "what it practises"}]}\'''',
    ''', "ml_link": "one sentence on where this shows up in machine-learning work"}\'''')
rep('''    const cands = ptCandidates(pid);\n    const paint = () => { if (ui.step === "learn"''', '''    const cands = [];  // v1.11: practice has its own section
    const paint = () => { if (ui.step === "learn"''')
cut('''        h("div", { class: "card practice" },
          h("h3", null, "Practice, written by people"),''', '''h("span", { class: "muted" }, " · " + c.kind))))) : null),\n''')
rep('''        h("div", { class: "row" },
          km.isLearned(pid)
            ? h("button", { class: "quiet", type: "button", onclick: () => { km.setLearned(pid, false); render(); } }, "Mark as not learned")''',
    '''        h("p", { class: "small muted pr-pointer" }, "Practice has its own section: it comes in sets, once what you've learned can combine into real tasks. ",
          h("button", { class: "link", type: "button", onclick: () => go("practice") }, "Go to Practice")),
        h("div", { class: "row" },
          km.isLearned(pid)
            ? h("button", { class: "quiet", type: "button", onclick: () => { km.setLearned(pid, false); render(); } }, "Mark as not learned")''')
rep('''another teaches it, and a third checks the lesson before you see it. Practice comes only from exercises written by people.";''',
    '''another teaches it, and a third checks the lesson before you see it. Practice has its own section.";''')
rep('''        (idx[p].practice || []).length ? h("p", { class: "small" }, "Practice: ", ...idx[p].practice.flatMap((q, j) => [j ? " · " : "", extLink(q.url, P.SHORT[q.src] + ": " + q.title)])) : null))));''',
    '''        null))));''')
rep('''h("p", { class: "small muted" }, "Written by the teaching AI with each lesson and checked with it. The practice links are exercises written by people."),''', '''h("p", { class: "small muted" }, "Written by the teaching AI with each lesson and checked with it."),''')
rep('''    "- Don't write exercises, quizzes, questions to answer or \\"try it yourself\\" tasks: practice comes from human sources. Don't copy text from any book.",''',
    '''    "- Don't write exercises, quizzes, questions to answer or \\"try it yourself\\" tasks: practice has its own section. Don't copy text from any book.",''')
rep('''      "- Never invent practice questions or exercises. For practice, point them to the human-written practice listed under the lesson. If they paste an exercise, help with it directly.",''',
    '''      "- Don't set exercises in the chat. For practice, point them to the Practice section. If they paste an exercise, help with it directly.",''')
rep('''an AI plans and teaches each point, and practice comes from human-written exercises.''', '''an AI plans and teaches each point, and an AI writes practice sets under strict standards, proven by running them.''')

# ---------- styles ----------
i = s.rindex("</style>")
s = s[:i] + '''
/* v1.11: practice */
:root { --ico-practice: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15' fill='none' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
body[data-sec="practice"] .eyebrow::before { -webkit-mask-image: var(--ico-practice); mask-image: var(--ico-practice); }
.pr-verdict.yes .eyebrow { background: var(--green); }
.pr-verdict.no .eyebrow { background: var(--orange); }
.pr-verdict .eyebrow, .pr-plan .eyebrow { margin-bottom: 4px; }
.pr-title { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
.pr-n { font-family: var(--font-heavy); font-weight: 900; font-size: 1.9rem; line-height: 1; color: var(--blue); }
.card.pr-ex.solved::after { border-color: var(--green); }
.pr-task { max-width: 72ch; }
textarea.pr-code { font-family: var(--font-mono); font-size: 0.95rem; line-height: 1.6; min-height: 200px; white-space: pre; overflow-x: auto; tab-size: 4; background: var(--surface); }
.pr-results { display: grid; gap: 8px; }
.pr-score { font-family: var(--font-heavy); font-weight: 800; font-size: 1.1rem; }
.pr-score.all { color: var(--green); }
.pr-diff { display: grid; gap: 4px; margin-top: 4px; }
.pr-diff pre { margin: 2px 0 4px; padding: 6px 10px; background: var(--sunk); white-space: pre-wrap; font-size: 0.88rem; }
.pr-hints { display: grid; gap: 4px; }
.pr-results ul.checks li.warn { color: var(--fg); }
.pr-results ul.checks li.warn .tick { color: var(--red); }
.pr-fold > summary { list-style-position: inside; cursor: pointer; font-weight: 400; font-family: inherit; text-transform: none; letter-spacing: 0; }
details.pr-more > summary { font-family: var(--font-display); }
.pr-more .code-wrap pre { padding-right: 16px; }
.pr-pointer { max-width: 70ch; }
''' + s[i:]
open(p, "w").write(s)
print("v1.11 written:", len(s))

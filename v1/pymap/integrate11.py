"""v1.10: one teaching framework for every subject, and an optional "going deeper" part. Builds v1.9, then:
- the rules on traps, limits and going deeper live in one subject-neutral block (STANDARDS). A subject supplies only its
  examples (SUBJECT); Python is the first subject profile. Planner, teacher and checker all read the same block.
- Going deeper: when the real mechanism under a point is beyond the learner now and a later topic teaches it (+= runs the
  special method __iadd__), the planner plans a short optional look at it. The teacher writes it after the lesson, marked
  === DEEPER ===, in at most 3 sentences and one tiny example per item, naming the later topic. Nothing in the lesson or the
  notes may depend on it. The page shows it in its own box, marked optional. The checker checks it for accuracy and length.
- the planner sees the map's topics, so it can name the topic that teaches a limit or a deeper mechanism."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate10.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)
def line(prefix, new):
    """replace the one whole line that starts (after indentation) with prefix"""
    global s
    ls = s.split("\n"); hits = [i for i, l in enumerate(ls) if l.lstrip().startswith(prefix)]
    assert len(hits) == 1, (prefix[:80], len(hits))
    ls[hits[0]] = new; s = "\n".join(ls)

rep("<title>Learning Companion v1.9</title>", "<title>Learning Companion v1.10</title>")
rep('<span class="pill">Python pilot / v1.9</span>', '<span class="pill">Python pilot / v1.10</span>')

# ---------- the framework: subject-neutral standards + the Python profile ----------
FRAMEWORK = r'''
  // ---------- Teaching standards (v1.10) ----------
  // One framework for every subject. The rules below never name a subject; a subject profile supplies only the examples
  // that show the standard. Python is the first profile; another subject adds its own profile, not its own rules.
  const SUBJECT = {
    name: "Python",
    trap: "in Fluent Python, t = (1, 2, [30, 40]) then t[2] += [50, 60] raises TypeError and still changes the list, which reveals that += on a list first extends the list in place and then assigns back into the tuple",
    slips: "a typo, a misspelling, a missing colon or bracket",
    limit: "+= on a list changes the list in place, which References and copies explains",
    deeper: "+= runs the special method __iadd__ when the type defines one, as lists do, and otherwise falls back to __add__ and assignment, which the topic on special methods teaches",
  };
  const STANDARDS = {
    planner: (S) => [
      "Teaching standards (they hold for every subject; the examples come from " + S.name + "):",
      "- Traps. A trap is a short case whose real result surprises a learner who holds a reasonable but incomplete model, where explaining the surprise shows how " + S.name + " works underneath. Example of the standard: " + S.trap + ". Plan a trap only if its explanation teaches a mechanism. Never plan a slip (" + S.slips + ") or a wrong idea no reasonable learner holds: they teach nothing. Zero traps is often right; at most 2. Use only what this learner knows or this lesson teaches. Never say how common a mistake is: you have no data on that.",
      "- Limits. List where a rule taught here stops being true, especially when the exception comes from something the learner hasn't learned yet (for example, " + S.limit + "). At most 3, the ones this learner is likeliest to meet first. The lesson states each in one sentence instead of presenting the rule as absolute.",
      "- Going deeper. When the real mechanism under this point is too advanced for this learner now and a later topic teaches it, plan a short optional look at it (for example, " + S.deeper + "). It lets the learner know the mechanism exists without asking them to master it now. Name the later topic from the list above. At most 2. Leave it empty when nothing real lies underneath, or when the learner can understand the mechanism in the lesson itself (then teach it there).",
    ].join("\n"),
    teacher: (S) => [
      "- Teach each of the plan's traps as a surprise inside the section it belongs to: show the case, let the learner predict, then give the real result and explain the mechanism it reveals. A predict-then-see moment with the answer right after it is teaching, not a practice question. Add no traps or mistakes of your own, and don't write a \"common mistakes\" or \"pitfalls\" list.",
      "- Never call a mistake common, classic, typical or frequent.",
      "- Don't state a rule as absolute (\"always\", \"exactly\", \"nothing more\") when it has an exception. Say where it holds, and state each of the plan's limits in one sentence without teaching it.",
      "- If the plan has going-deeper items, write them after the lesson, after a line containing only === DEEPER ===. For each: at most 3 sentences and at most one tiny example that name the mechanism, give an accurate glimpse of it, and say which later topic teaches it. Say plainly that it's fine to skip. Nothing in the lesson or the notes may depend on it, and no note is about it.",
    ].join("\n"),
    checker: (S) => "a mistake, pitfall or trap whose explanation doesn't show how " + S.name + " works (a slip such as " + S.slips + ", or a wrong idea no reasonable learner holds), in the lesson or the notes, whose fix is to remove it; a mistake called common, classic, typical or frequent; a rule stated as absolute that is false in ordinary use or contradicts the plan's limits, whose fix is to state where it holds; a going-deeper part that is inaccurate, presented as required, longer than 3 sentences and one small example per item, or that the lesson or the notes depend on",
  };
'''

# planner: the map's topics (to name where a limit or a deeper mechanism is taught), then the standards
rep('''      "It leads to: " + (n.usedBy.map(ptName).join(", ") || "nothing else on this map") + ".",''',
    '''      "It leads to: " + (n.usedBy.map(ptName).join(", ") || "nothing else on this map") + ".",
      "Topics on this map, from basics to advanced: " + P.KD.balls.map((b) => b.name).join(", ") + ".",''')
line('"Traps: a trap is a short snippet', '      STANDARDS.planner(SUBJECT),')
line('"Limits: list where a rule taught here', '')
s = s.replace("      STANDARDS.planner(SUBJECT),\n\n", "      STANDARDS.planner(SUBJECT),\n", 1)
rep('''"limits": ["where a rule taught here stops holding, and which point explains it"], "ml_link":''',
    '''"limits": ["where a rule taught here stops holding, and which topic explains it"], "deeper": [{"what": "the mechanism underneath, named", "glimpse": "one or two accurate sentences a beginner can follow", "where": "the later topic that teaches it"}], "ml_link":''')
rep('''traps, limits: arr(d.limits).map(str).filter(Boolean).slice(0, 3), ml_link''',
    '''traps, limits: arr(d.limits).map(str).filter(Boolean).slice(0, 3),
      deeper: arr(d && d.deeper).map((x) => ({ what: str(x && x.what), glimpse: str(x && x.glimpse), where: str(x && x.where) })).filter((x) => x.what && x.where).slice(0, 2), ml_link''')
rep('''    (p.limits || []).length ? "Limits to state (one sentence each, not taught): " + p.limits.join("; ") : "",''',
    '''    (p.limits || []).length ? "Limits to state (one sentence each, not taught): " + p.limits.join("; ") : "",
    ...(p.deeper || []).map((x) => "Going deeper (optional, after the lesson): " + undot(x.what) + ". Glimpse: " + undot(x.glimpse) + ". Taught later in: " + x.where),''')

# teacher (and the reviser, which shares TEACH_RULES)
line('''"- Teach each of the plan's traps as a surprise''', '''    STANDARDS.teacher(SUBJECT),''')
line('''"- Never call a mistake common, classic, typical or frequent.",''', '')
line('''"- Don't state a rule as absolute (\\"always\\"''', '')
s = s.replace("    STANDARDS.teacher(SUBJECT),\n\n\n", "    STANDARDS.teacher(SUBJECT),\n", 1)
rep('''    "- After the lesson, write a line containing only === NOTES === and then''', '''    "- After the lesson (and the going-deeper part, if any), write a line containing only === NOTES === and then''')
rep('''    return { lesson: parts[0].trim(), notes };''',
    '''    const [lesson, deeper] = parts[0].split(/^\\s*===\\s*DEEPER\\s*===\\s*$/m);
    return { lesson: lesson.trim(), deeper: (deeper || "").trim(), notes };''')

# checker
rep('''a wrong note; no notes at all; a mistake, pitfall or trap whose explanation doesn't show how Python works (a typo, a misspelling, a missing colon, a wrong idea no reasonable learner holds), in the lesson or the notes, whose fix is to remove it; a mistake called common, classic, typical or frequent; a rule stated as absolute that is false for ordinary built-in types or contradicts the plan's limits, whose fix is to state where it holds.",''',
    '''a wrong note; no notes at all; " + STANDARDS.checker(SUBJECT) + ".",''')
rep('''    "", "The lesson:", "<<<", L.lesson, ">>>", "", "The notes for the learner:",''',
    '''    "", "The lesson:", "<<<", L.lesson, ">>>", "", "The going-deeper part (optional reading after the lesson):", L.deeper || "(none)", "", "The notes for the learner:",''')

# reviser
rep('''    "", "Your lesson:", "<<<", L.lesson, ">>>", "", "Your notes:",''',
    '''    "", "Your lesson:", "<<<", L.lesson, ">>>", "", "Your going-deeper part:", L.deeper || "(none)", "", "Your notes:",''')
rep('''"Reply with the whole corrected lesson, then the === NOTES === line and the notes.",''',
    '''"Reply with the whole corrected lesson, then the === DEEPER === line and that part if there is one, then the === NOTES === line and the notes.",''')

# saved with the lesson
rep('''plan: job.plan, lesson: L.lesson, notes: L.notes, requests''', '''plan: job.plan, lesson: L.lesson, deeper: L.deeper || "", notes: L.notes, requests''')

# the page: the plan's deeper items, and the optional box after the lesson
rep('''          (L.plan.limits || []).length ? h("p", { class: "small" }, h("strong", null, "Where the rules stop:"), " ", L.plan.limits.join(" · ")) : null,''',
    '''          (L.plan.limits || []).length ? h("p", { class: "small" }, h("strong", null, "Where the rules stop:"), " ", L.plan.limits.join(" · ")) : null,
          (L.plan.deeper || []).length ? h("p", { class: "small" }, h("strong", null, "Going deeper:"), " ", L.plan.deeper.map((x) => x.what + " (" + x.where + ")").join(" · ")) : null,''')
rep('''        h("article", { class: "card lesson-card" }, h("div", { class: "lesson" }, md(L.lesson))),''',
    '''        h("article", { class: "card lesson-card" }, h("div", { class: "lesson" }, md(L.lesson))),
        L.deeper ? h("aside", { class: "card deeper", "aria-label": "Going deeper, optional" },
          h("p", { class: "eyebrow" }, "Going deeper · optional"),
          h("p", { class: "small muted" }, "What lies underneath, for when you're curious. Skip it freely: the practice doesn't need it, and a later topic teaches it properly."),
          h("div", { class: "lesson" }, md(L.deeper))) : null,''')

# the framework goes in last, so the line replacements above only ever see the old prompt lines
rep('''  function plannerPromptPt(pid, cands) {''', FRAMEWORK + '''  function plannerPromptPt(pid, cands) {''')
i = s.rindex("</style>")
s = s[:i] + '''
/* v1.10: going deeper, an optional look underneath */
.card.deeper { border: 1px dashed var(--line-2); background: transparent; gap: 10px; }
.card.deeper .eyebrow { background: transparent; color: var(--blue); box-shadow: none; padding: 0; }
.card.deeper .eyebrow::before { background: var(--blue); }
.card.deeper .lesson { font-size: 0.98rem; }
''' + s[i:]
open(p, "w").write(s)
print("v1.10 written:", len(s))

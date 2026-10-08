"""v1.12: going deeper becomes a real reference entry. Builds v1.11, then:
- each going-deeper item is written like a dictionary entry: what it is, how to write it (the general form), a complete
  example with its exact output, how it works underneath, the key details and rules, and the later topic that teaches it.
  No predict-then-see or exercises: the learner needn't master it, but every specific is there.
- when a lesson or its limits name a later feature as the better or real answer (match, after conditional expressions),
  the planner gives it an entry instead of a vague mention. A going-deeper part with no planned entries is not allowed,
  and neither are teasers like "a clearer way comes later" anywhere in the lesson.
- the checker blocks an entry that is vague, inaccurate or missing any of those parts."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate12.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.11</title>", "<title>Learning Companion v1.12</title>")
rep('<span class="pill">Python pilot / v1.11</span>', '<span class="pill">Python pilot / v1.12</span>')

# the Python example of a full entry
rep('''    deeper: "+= runs the special method __iadd__ when the type defines one, as lists do, and otherwise falls back to __add__ and assignment, which the topic on special methods teaches",''',
    '''    deeper: "+= runs the special method __iadd__ when the type defines one, as lists do, and otherwise falls back to __add__ and assignment, which the topic on special methods teaches",
    deeperEntry: "an entry on match covers what it is (a statement that compares one value against patterns), how to write it (match subject: followed by case pattern: blocks), a complete example with its output, how it works (Python tries the cases from top to bottom and runs only the first that matches; there is no fall-through), and the details (_ matches anything, | joins alternatives, a bare name captures the value, case ... if adds a guard, it needs Python 3.10 or later)",''')

# planner
rep('''plan a short optional look at it (for example, " + S.deeper + "). It lets the learner know the mechanism exists without asking them to master it now. Name the later topic from the list above. At most 2. Leave it empty when nothing real lies underneath, or when the learner can understand the mechanism in the lesson itself (then teach it there).",''',
    '''plan an optional reference entry on it (for example, " + S.deeper + "). Also plan one whenever the lesson or its limits name a later feature as the better or the real answer, instead of mentioning it vaguely. An entry is written like a dictionary entry, not a lesson: the learner doesn't have to master it, but every specific is there. For example, " + S.deeperEntry + ". In \\"covers\\", list the specifics the entry must include. Name the later topic from the list above. At most 2. Leave it empty when nothing real lies underneath, or when the learner can understand the mechanism in the lesson itself (then teach it there).",''')
rep('''"deeper": [{"what": "the mechanism underneath, named", "glimpse": "one or two accurate sentences a beginner can follow", "where": "the later topic that teaches it"}]''',
    '''"deeper": [{"what": "the feature or mechanism, named", "covers": ["the specifics the entry must include: definition, the general form, the steps it follows, each key rule"], "where": "the later topic that teaches it"}]''')
rep('''      deeper: arr(d && d.deeper).map((x) => ({ what: str(x && x.what), glimpse: str(x && x.glimpse), where: str(x && x.where) })).filter((x) => x.what && x.where).slice(0, 2),''',
    '''      deeper: arr(d && d.deeper).map((x) => ({ what: str(x && x.what), covers: arr(x && x.covers).map(str).filter(Boolean).slice(0, 10), glimpse: str(x && x.glimpse), where: str(x && x.where) })).filter((x) => x.what && x.where).slice(0, 2),''')
rep('''    ...(p.deeper || []).map((x) => "Going deeper (optional, after the lesson): " + undot(x.what) + ". Glimpse: " + undot(x.glimpse) + ". Taught later in: " + x.where),''',
    '''    ...(p.deeper || []).map((x) => "Going-deeper entry (optional reference, after the lesson): " + undot(x.what) + (x.covers && x.covers.length ? ". It must cover: " + x.covers.join("; ") : x.glimpse ? ". " + undot(x.glimpse) : "") + ". Taught properly in: " + x.where),''')

# teacher
rep('''      "- If the plan has going-deeper items, write them after the lesson, after a line containing only === DEEPER ===. For each: at most 3 sentences and at most one tiny example that name the mechanism, give an accurate glimpse of it, and say which later topic teaches it. Say plainly that it's fine to skip. Nothing in the lesson or the notes may depend on it, and no note is about it.",''',
    '''      "- If the plan has going-deeper entries, write them after the lesson, after a line containing only === DEEPER ===, and only then: no plan entry, no going-deeper part. Write each like a dictionary entry, not a lesson, with no predict-then-see and no exercises: a ### heading with its name; then, each under a short bold label, what it is (one exact definition); how to write it (the general form as a code block); a complete runnable example followed by its exact output; how it works underneath (the steps it follows, in order); the key details and rules as a list, with every item the plan's \\"covers\\" names; and the later topic that teaches it properly. Every specific is concrete and exact: no \\"there is a clearer way\\" without showing it. The learner doesn't have to master it, so don't drill it. Nothing in the lesson or the notes may depend on it, and no note is about it.",
      "- Never tease a later feature (\\"a clearer way comes later\\", \\"you'll see more later\\"). Either name it and its topic in one plain sentence, as a limit, or the plan gives it an entry.",''')

# checker
rep('''a going-deeper part that is inaccurate, presented as required, longer than 3 sentences and one small example per item, or that the lesson or the notes depend on",''',
    '''a going-deeper part when the plan has no entries; a going-deeper entry that is inaccurate, vague, presented as required, or missing any of: an exact definition, the general form, a runnable example with its exact output, how it works underneath, the key rules (including each item the plan says it covers) and the later topic; a teaser for a later feature that neither names it plainly nor has an entry; anything in the lesson or the notes that depends on a going-deeper entry",''')

# the box on the page
rep('''h("p", { class: "small muted" }, "What lies underneath, for when you're curious. Skip it freely: the practice doesn't need it, and a later topic teaches it properly."''',
    '''h("p", { class: "small muted" }, "A reference entry on what lies beyond this lesson: how it works, in full. You don't need to master it now, the practice doesn't depend on it, and a later topic teaches it properly."''')
i = s.rindex("</style>")
s = s[:i] + '''
/* v1.12: going deeper reads like a reference entry */
.card.deeper .lesson h3 { font-size: 1.3rem; margin-top: 6px; }
.card.deeper .lesson p > strong:first-child { font-family: var(--font-display); font-weight: 600; letter-spacing: 0.04em; }
''' + s[i:]
open(p, "w").write(s)
print("v1.12 written:", len(s))

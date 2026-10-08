"""v1.17: extensions go down, not sideways. Builds v1.16, then:
- the guide's extension standard asks for what happens underneath (the steps the language actually takes, what a feature
  is built on, why it behaves as it does, how the learner can observe it), not a tour of more uses or later features,
  with exactness about what is known and a plain statement of where certainty ends.
- the tutor answers "how does it work" questions the same way.
Trigger: the author's match lesson extended sideways (class patterns, a version note), while the author's own follow-up
question asked how match works in CPython."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate17.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.16</title>", "<title>Learning Companion v1.17</title>")
rep('<span class="pill">Python pilot / v1.16</span>', '<span class="pill">Python pilot / v1.17</span>')

rep('''    slips: "a typo, a misspelling, a missing colon or bracket",''',
    '''    slips: "a typo, a misspelling, a missing colon or bracket",
    observe: "the dis module shows the bytecode a statement compiles to, and type(), id() and an object's special methods show what the objects involved actually do",''')
rep('''      "- Extensions. When something beyond this lesson is worth knowing (a mechanism underneath, a later feature that does the job better), either leave it out or explain it properly after the lesson: what it is, how it is written, a complete example with its output, how it works, and the details that matter, like a good reference entry. The learner doesn't have to master it, but it must not be vague: a passing hint such as \\"a clearer way comes later\\" is worse than nothing.",''',
    '''      "- Extensions go down, not sideways. After the lesson, the most valuable extension usually explains what happens underneath: the steps " + S.name + " actually takes, what the feature is built on, why it behaves the way it does, and how the learner can observe that for themselves (" + S.observe + "). A tour of more uses or later features only adds breadth the learner will meet in later lessons anyway. Explain an extension properly or leave it out: concrete and exact, like a good reference entry, never a passing hint such as \\"a clearer way comes later\\". Under the hood, be exact about what you know, say plainly where your certainty ends, and say where it can be checked. The learner doesn't have to master it.",''')
# the tutor, for "how does it work" questions
rep('''      "- When you point out a mistake, explain the mechanism behind it. Don't list mistakes, and never call a mistake common or classic.",''',
    '''      "- When you point out a mistake, explain the mechanism behind it. Don't list mistakes, and never call a mistake common or classic.",
      "- When the learner asks how something works, go underneath: the steps the language actually takes and how they can observe them. Be exact about what you know and say plainly where your certainty ends.",''', count=2)
# the box on the page says what it now holds
rep('''h("p", { class: "small muted" }, "A reference entry on what lies beyond this lesson: how it works, in full. You don't need to master it now, the practice doesn't depend on it, and a later topic teaches it properly."),''',
    '''h("p", { class: "small muted" }, "What happens underneath this lesson: how it actually works. You don't need to master it now, and the practice doesn't depend on it."),''')
open(p, "w").write(s)
print("v1.17 written:", len(s))

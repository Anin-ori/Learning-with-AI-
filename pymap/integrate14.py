"""v1.13: a later feature recommended as the better way always gets a going-deeper entry. Builds v1.12, then:
- a limit may name a later topic without an entry only when it says where a rule stops holding. When it recommends a
  later feature as the better way ("for several cases, match reads more clearly"), the planner must plan an entry for it.
- if the planner misses one anyway, the teacher writes the entry, and the checker blocks a lesson whose limits recommend a
  later feature with no entry for it (found when the author regenerated conditional expressions and the match box vanished)."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate13.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.12</title>", "<title>Learning Companion v1.13</title>")
rep('<span class="pill">Python pilot / v1.12</span>', '<span class="pill">Python pilot / v1.13</span>')

# planner: recommending a later feature means an entry; plain naming is only for where a rule stops
rep('''Also plan one whenever the lesson or its limits name a later feature as the better or the real answer, instead of mentioning it vaguely.''',
    '''Also plan one for every later feature that the lesson or its limits recommend as the better way to do something (for example, a limit saying \\"for several distinct cases, match reads more clearly\\" requires an entry on match). A limit may name a later topic without an entry only when it just says where a rule stops holding.''')
rep('''Leave it empty when nothing real lies underneath, or when the learner can understand the mechanism in the lesson itself (then teach it there).",''',
    '''Leave it empty only when nothing real lies underneath and no limit recommends a later feature, or when the learner can understand the mechanism in the lesson itself (then teach it there).",''')

# teacher: entries for the plan's items, plus any later feature the lesson recommends
rep('''"- If the plan has going-deeper entries, write them after the lesson, after a line containing only === DEEPER ===, and only then: no plan entry, no going-deeper part.''',
    '''"- Write going-deeper entries after the lesson, after a line containing only === DEEPER ===: one for each of the plan's entries, and one for each later feature that your lesson or the plan's limits recommend as the better way to do something, even if the plan forgot it. With none of these, write no going-deeper part.''')
rep('''Either name it and its topic in one plain sentence, as a limit, or the plan gives it an entry.",''',
    '''Name a later topic in one plain sentence only to say where a rule stops holding; if you recommend a later feature as the better way, it gets an entry.",''')

# checker
rep('''a going-deeper part when the plan has no entries;''',
    '''a going-deeper entry that is neither in the plan nor for a later feature the lesson or the limits recommend; a later feature that the lesson or the plan's limits recommend as the better way with no going-deeper entry for it, whose fix is to write that entry;''')
rep('''a teaser for a later feature that neither names it plainly nor has an entry;''',
    '''a teaser for a later feature (\\"a clearer way comes later\\");''')
open(p, "w").write(s)
print("v1.13 written:", len(s))

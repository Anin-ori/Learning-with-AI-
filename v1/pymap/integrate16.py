"""v1.15: guidance, not fixed counts. Builds v1.14, then removes every fixed count the AI was told to produce and replaces
it with the purpose the count stood for, so the AI judges how much each case needs:
- practice: how many exercises, tests and hints, and how much advice; the readiness check's suggested points
- lessons: length, number of notes, number of editor suggestions
- tutor and second-opinion answers: length
- profile: level-check feedback and the AI-guidance estimate
Numbers that remain live only in code, as generous safety limits (run time, page size), never as targets."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate15.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.14</title>", "<title>Learning Companion v1.15</title>")
rep('<span class="pill">Python pilot / v1.14</span>', '<span class="pill">Python pilot / v1.15</span>')

# ---------- practice ----------
rep('''      "- If it isn't enough yet, say plainly why, and name up to 3 of the points they can learn next whose learning would make practice clearly worth doing.",''',
    '''      "- If it isn't enough yet, say plainly why, and name the points they can learn next whose learning would make the most difference to practice: the few that matter, not a list.",''')
rep('''      "- Up to 3 exercises, easier to harder. One excellent exercise beats three thin ones.",
      "- 4 to 8 tests per exercise, covering the cases the task names, such as an empty input or a boundary.",
      "- 2 hints per exercise: nudges toward the decision, never code.",''',
    '''      "- As many exercises as the learned material supports well, from easier to harder. One excellent exercise beats several thin ones, and a set can be a single exercise.",
      "- Enough tests to tell a correct solution from a nearly correct one: every case the task names, the boundaries, and the mistakes a reasonable attempt would make. No padding with tests that check the same thing.",
      "- Hints that nudge toward the decision without giving code, from gentle to stronger, as many as the exercise needs.",''')
rep('''"how": ["2 to 4 short pieces of advice on how to practise these"]''', '''"how": ["advice on how to practise these particular exercises, as much as is useful"]''')
rep('''"hints": ["a first nudge", "a stronger nudge, still without code"]''', '''"hints": ["a gentle nudge", "a stronger nudge, still without code"]''')
rep('''"why": "at most two plain sentences"''', '''"why": "plain and brief"''')
rep('''"next": ["if not enough: up to 3 points from the map whose learning would make practice worth doing"]''',
    '''"next": ["if not enough: the points from the map whose learning would make the most difference"]''')
# safety limits in code only (run time and page size), well above what a good set needs
rep('''      hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 3),
    })).filter((x) => x.title && x.task && x.solution && x.tests.length >= 2).slice(0, 3);''',
    '''      hints: parr(x && x.hints).map(pstr).filter(Boolean).slice(0, 8),
    })).filter((x) => x.title && x.task && x.solution && x.tests.length >= 1).slice(0, 8);  // safety limits only''')
rep('''.filter((t) => t.check || t.output != null).slice(0, 10),''', '''.filter((t) => t.check || t.output != null).slice(0, 30),''')
rep('''next: parr(d.next).map(pstr).filter(Boolean).slice(0, 3) };''', '''next: parr(d.next).map(pstr).filter(Boolean).slice(0, 8) };''')
rep('''how: parr(d.how).map(pstr).filter(Boolean).slice(0, 4), exercises: ex };''', '''how: parr(d.how).map(pstr).filter(Boolean).slice(0, 10), exercises: ex };''')

# ---------- lessons ----------
rep('''    "- Usually 500 to 1000 words of Markdown for the lesson. No title line at the top.",''',
    '''    "- As long as this point needs for real understanding and no longer: cut what doesn't serve understanding, keep what does. Markdown, no title line at the top.",''')
rep('''    "- Then write a line containing only === NOTES === and 4 to 7 notes for the learner to keep, one per line starting with \\"- \\". Each note is one fact, with `code` in backticks and the key **terms** in bold.",''',
    '''    "- Then write a line containing only === NOTES === and the notes for the learner to keep, one per line starting with \\"- \\": each note is one fact worth remembering from this lesson, with `code` in backticks and the key **terms** in bold. Write as many as the lesson has such facts, no padding.",''')
rep('''fix: "Add the === NOTES === line and 4 to 7 notes." });''', '''fix: "Add the === NOTES === line and the notes worth keeping." });''')
rep('''.map((l) => l.replace(/^[-*]\\s+/, "")).slice(0, 8);
    const [lesson, deeper]''', '''.map((l) => l.replace(/^[-*]\\s+/, "")).slice(0, 20);
    const [lesson, deeper]''')
rep('''in a way that matters for this learner's understanding. At most 5, the most important first.''',
    '''in a way that matters for this learner's understanding, the most important first. Only what matters: no padding.''')
rep('''improvements: normItems(v && v.improvements).slice(0, 5) });''', '''improvements: normItems(v && v.improvements).slice(0, 12) });''')
rep('''.filter((s) => s.title && s.teach).slice(0, 7);''', '''.filter((s) => s.title && s.teach).slice(0, 15);''')

# ---------- tutor and second opinion ----------
rep('''      "- If you're unsure about something, say so plainly. Keep answers under 250 words unless the learner asks for more.",''',
    '''      "- If you're unsure about something, say so plainly. Answer as briefly as the question allows, and go longer when the question needs it or the learner asks.",''', count=2)
rep('''Answer it independently and briefly, in under 150 words.''', '''Answer it independently and briefly.''')

# ---------- profile ----------
rep('''"feedback": "3 to 5 sentences: what they did well, what to watch, what to study next''', '''"feedback": "a short paragraph: what they did well, what to watch, what to study next''')
rep('''"strong": ["up to 3 short phrases"], "limits": ["up to 3 short phrases"], "statement": "2 or 3 sentences, addressed''',
    '''"strong": ["short phrases, only what matters"], "limits": ["short phrases, only what matters"], "statement": "a few sentences, addressed''')
open(p, "w").write(s)
print("v1.15 written:", len(s))

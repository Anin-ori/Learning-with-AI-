"""v1.9: a mistake is taught only when it shows how Python works. Builds v1.8, then:
- the planner plans 0 to 2 "traps" instead of a list of pitfalls. Each trap is a short snippet whose real result surprises a
  learner with a reasonable but incomplete model, and it must name the mechanism the surprise reveals. Typos, misspellings
  and wrong ideas no reasonable learner holds are ruled out, and no mistake may be called common (the AI has no data on that).
- the planner also lists "limits": where a rule taught here stops being true (for example, += changes a list in place), so the
  lesson states the rule's scope instead of an absolute ("x += 5 means exactly x = x + 5, nothing more" is false for lists).
- the teacher shows each trap as predict-then-see inside its section, with no "common mistakes" list.
- the checker blocks a trap that teaches nothing, a mistake called common, and an absolute rule with a known exception.
- the tutor and the older chapter-lesson writer follow the same rule.
- "How the planner set up this lesson" shows the planned traps and limits."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate9.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.8</title>", "<title>Learning Companion v1.9</title>")
rep('<span class="pill">Python pilot / v1.8</span>', '<span class="pill">Python pilot / v1.9</span>')

# ---------- planner ----------
rep('''a mental model, a tiny realistic data task, the classic mistakes. Stay on this one point.",''',
    '''a mental model, a tiny realistic data task, a surprising result that exposes how Python works. Stay on this one point.",
      "Traps: a trap is a short snippet whose real result surprises a learner who holds a reasonable but incomplete model, where explaining the surprise shows how Python works underneath. Example of the standard: in Fluent Python, t = (1, 2, [30, 40]) then t[2] += [50, 60] raises TypeError and still changes the list, which reveals that += on a list first extends the list in place and then assigns back into the tuple. Plan a trap only if its explanation teaches a mechanism. Never plan a typo, a misspelling, a missing colon or bracket, or a wrong idea no reasonable learner holds: they teach nothing. Zero traps is often right; at most 2. Use only features this learner knows or this lesson teaches. Never say how common a mistake is: you have no data on that.",
      "Limits: list where a rule taught here stops being true, especially when the exception comes from a point the learner hasn't learned yet (for example, += on a list changes the list in place, from References and copies). At most 3, the ones this learner is likeliest to meet first. The lesson will state each limit in a sentence instead of presenting the rule as absolute.",''')
rep('''"pitfalls": ["a common mistake to address"], "ml_link":''',
    '''"traps": [{"code": "the short snippet", "expect": "what a learner with the reasonable but incomplete model predicts", "actual": "what Python really does, exactly", "reveals": "the mechanism the surprise exposes, in one sentence"}], "limits": ["where a rule taught here stops holding, and which point explains it"], "ml_link":''')
rep('''    return { aim: str(d.aim), bridge: arr(d.bridge).map(str).filter(Boolean).slice(0, 3), sections, pitfalls: arr(d.pitfalls).map(str).filter(Boolean).slice(0, 5), ml_link: str(d.ml_link), practice };''',
    '''    // a trap without its code or the mechanism it reveals is dropped: it can't show how Python works
    const traps = arr(d && d.traps).map((t) => ({ code: str(t && t.code), expect: str(t && t.expect), actual: str(t && t.actual), reveals: str(t && t.reveals) }))
      .filter((t) => t.code && t.reveals).slice(0, 2);
    return { aim: str(d.aim), bridge: arr(d.bridge).map(str).filter(Boolean).slice(0, 3), sections, traps, limits: arr(d.limits).map(str).filter(Boolean).slice(0, 3), ml_link: str(d.ml_link), practice };''')
rep('''  const planText = (p) => [''', '''  const undot = (x) => String(x).replace(/[.。]\\s*$/, "");
  const planText = (p) => [''')
rep('''    p.pitfalls.length ? "Pitfalls to address: " + p.pitfalls.join("; ") : "",''',
    '''    ...(p.traps || []).map((t, i) => "Trap " + (i + 1) + ": " + t.code.replace(/\\n/g, " ⏎ ") + " | A learner expects: " + undot(t.expect) + " | Python actually: " + undot(t.actual) + " | Reveals: " + t.reveals),
    (p.limits || []).length ? "Limits to state (one sentence each, not taught): " + p.limits.join("; ") : "",
    (p.pitfalls || []).length ? "Pitfalls to address: " + p.pitfalls.join("; ") : "",''')

# ---------- teacher ----------
rep('''    "- Explain why things work, not only what to type. Address the pitfalls.",''',
    '''    "- Explain why things work, not only what to type.",
    "- Teach each of the plan's traps as a surprise inside the section it belongs to: show the code, let the learner predict, then give the real output and explain the mechanism it reveals. A predict-then-see moment with the answer right after it is teaching, not a practice question. Add no traps or mistakes of your own, and don't write a \\"common mistakes\\" or \\"pitfalls\\" list.",
    "- Never call a mistake common, classic, typical or frequent.",
    "- Don't state a rule as absolute (\\"always\\", \\"exactly\\", \\"nothing more\\") when it has an exception. Say where it holds, and state each of the plan's limits in one sentence without teaching it.",''')

# ---------- checker ----------
rep('''an exercise, quiz or practice question written into the lesson; text copied from a book; a wrong note; no notes at all.",''',
    '''an exercise, quiz or practice question written into the lesson; text copied from a book; a wrong note; no notes at all; a mistake, pitfall or trap whose explanation doesn't show how Python works (a typo, a misspelling, a missing colon, a wrong idea no reasonable learner holds), in the lesson or the notes, whose fix is to remove it; a mistake called common, classic, typical or frequent; a rule stated as absolute that is false for ordinary built-in types or contradicts the plan's limits, whose fix is to state where it holds.",
    "A predict-then-see moment whose answer follows right after it is teaching, not a practice question.",''')

# ---------- tutor ----------
rep('''      "- If you're unsure about something, say so plainly. Keep answers under 250 words unless the learner asks for more.",''',
    '''      "- If you're unsure about something, say so plainly. Keep answers under 250 words unless the learner asks for more.",
      "- When you point out a mistake, explain the mechanism behind it. Don't list mistakes, and never call a mistake common or classic.",''', count=2)

# ---------- the older chapter-lesson writer (still in the code) ----------
rep('''at least one short runnable example with its exact output, and the usual pitfall if there is one.''',
    '''at least one short runnable example with its exact output, and a surprising case only if explaining it shows how Python works.''')
rep('''      if (k === K) shape.push("- End with \\"## Common mistakes\\" for the whole lesson, aimed at what this learner finds hard.");''',
    '''      shape.push("- Don't write a \\"Common mistakes\\" list or call any mistake common. A surprising case goes in the section it belongs to, and only if explaining it shows how Python works.");''')

# ---------- the plan, as the learner sees it ----------
rep('''          h("ol", { class: "plain small" }, L.plan.sections.map((s) => h("li", null, h("strong", null, s.title), ". ", s.teach))),''',
    '''          h("ol", { class: "plain small" }, L.plan.sections.map((s) => h("li", null, h("strong", null, s.title), ". ", s.teach))),
          (L.plan.traps || []).length ? h("div", { class: "small plan-traps" }, h("strong", null, "Surprises it shows:"),
            h("ul", { class: "plain" }, L.plan.traps.map((t) => h("li", null, h("code", null, t.code), " ", t.reveals)))) : null,
          (L.plan.limits || []).length ? h("p", { class: "small" }, h("strong", null, "Where the rules stop:"), " ", L.plan.limits.join(" · ")) : null,''')

i = s.rindex("</style>")
s = s[:i] + "\n.plan-traps { display: grid; gap: 4px; }\n.plan-traps code { font-family: var(--font-mono); font-size: .9em; white-space: pre-wrap; background: var(--sunk); padding: 1px 5px; }\n" + s[i:]
open(p, "w").write(s)
print("v1.9 written:", len(s))

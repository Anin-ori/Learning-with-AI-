"""v1.1: step 5 becomes 'learn a point' (planner, teacher, checker; human practice only) and step 6 becomes point notes."""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate.py"], check=True)   # rebuild v1.0 from v0.12 + map
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:90], s.count(a)); s = s.replace(a, b)
rep("<title>Learning Companion v1.0</title>", "<title>Learning Companion v1.1</title>")
rep('<span class="pill">v1.0 · Python pilot</span>', '<span class="pill">v1.1 · Python pilot</span>')
rep('''    { id: "learn", name: "Learn", sub: "Source plus tutor" },
    { id: "check", name: "Chapter notes", sub: "Level 1 · review" },''', '''    { id: "learn", name: "Learn a point", sub: "AI plans, AI teaches" },
    { id: "check", name: "Your notes", sub: "Level 1 · review" },''')
rep('''    doneUnits: [], materials: [], checkNotes: [], updatedAt: null, buildMode: "chapter",''',
    '''    doneUnits: [], materials: [], checkNotes: [], updatedAt: null, buildMode: "chapter", learnPoint: null, pointIndex: {},''')
rep('''    note: "", confirmReset: false, mapTab: "plans",''', '''    plessons: {}, pjobs: {}, view: "map",
    note: "", confirmReset: false, mapTab: "plans",''')
rep('''    ["doneUnits", "materials", "checkNotes"].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });''',
    '''    ["doneUnits", "materials", "checkNotes"].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.pointIndex || typeof s.pointIndex !== "object" || Array.isArray(s.pointIndex)) s.pointIndex = {};''')
rep('''      case "learn": return !!state.plan && !!state.grade;
      case "check": return !!state.plan && !!state.grade && state.plan.steps.length > 0;''',
    '''      case "learn": return !!km;
      case "check": return !!km && Object.keys(state.pointIndex || {}).length > 0;''')
rep('''      case "learn": case "check": return state.doneUnits.length > 0;''', '''      case "learn": case "check": return Object.keys(state.pointIndex || {}).length > 0;''')
rep('''    if (step === "learn") ensureLesson(false);
  }''', '''    if (step === "learn" && plPoint()) ensurePointLesson(plPoint());
  }''')
rep('''    if (ui.step === "learn") ensureLesson(false);''', '''    if (ui.step === "learn" && plPoint()) ensurePointLesson(plPoint());''')
rep('''lessons: {}, mapTab: "plans", confirmRegen: null, showLog: false, matOpen: {}, jobs: {}, partIdx: {} });''',
    '''lessons: {}, mapTab: "plans", confirmRegen: null, showLog: false, matOpen: {}, jobs: {}, partIdx: {}, plessons: {}, pjobs: {} });
                  Object.values(ui.pjobs).forEach((j) => { j.cancel = true; });''')
rep('''  const PANELS = { goal: renderGoal, trial: renderTrial, map: renderMap, reach: renderReach, learn: renderLearn, check: renderCheck };''',
    '''  const PANELS = { goal: renderGoal, trial: renderTrial, map: renderMap, reach: renderReach, learn: renderPointLearn, check: renderPointNotes };''')
# the map now offers "Learn this point"; the point-learning code goes right after the view switch
rep('''    try { return knowledgeMap(); }''', '''    try { return knowledgeMap({ onLearn: (pid) => { plPick(pid, "the map"); setView("path"); go("learn"); } }); }''')
rep('''  function paintNav() {''', open(f"{HERE}/pl_embed.js").read() + '''
  function paintNav() {''')
# the map view stays the default; a restored learner who chose a point lands on step 5 when they open the guided path
rep('''  setView("map");
''', '''  setView("map");
''')
css = '''
/* v1.1: step 5 and 6 for single points */
.pt-note { display: grid; gap: 6px; padding: 10px 0 4px; border-top: 1px dashed var(--line); min-width: 0; }
.pt-note:first-of-type { border-top: none; }
.pt-note h4 { font-family: var(--font-body); font-size: 1rem; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
select#pt-select { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--fg); max-width: 100%; }
#pt-team ol li { padding: 2px 0; }
'''
i = s.index("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.1 written:", len(s))

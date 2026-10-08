"""v1.2: no path step, top navigation (Map / Learn / Notes / Profile), and a new look."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate2.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.1</title>", "<title>Learning Companion v1.2</title>")
rep('<span class="pill">v1.1 · Python pilot</span>', '<span class="pill">v1.2 · Python pilot</span>')
rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">')
# top navigation in the bar
rep('''  <div class="topbar-right">''', '''  <nav id="topnav" aria-label="Sections"><button type="button" data-sec="map">Map</button><button type="button" data-sec="learn">Learn</button><button type="button" data-sec="notes">Notes</button><button type="button" data-sec="profile">Profile</button></nav>
  <div class="topbar-right">''')
# step 3 (the path) is gone; profile = goal, level check, AI guidance
rep('''    { id: "map", name: "Your path", sub: "Planned from real units" },
''', '')
rep('''      case "reach": return !!state.plan;''', '''      case "reach": return !!state.goal;''')
rep('''      case "map": return !!state.goal && (state.background === "new" || !!state.trial);''', '''      case "map": return false;''')
rep('''  function openPathStep() {
    go("map");
    if (!state.plans || state.plansKey !== plansKey()) generatePlans();
  }''', '''  function openPathStep() { go("reach"); }''')
rep('''"Build my path options")''', '''"Next: how far the AI can guide you")''')
# the step rail becomes the top navigation
i = s.index("  function renderSteps() {"); j = s.index("  const head = (eyebrow, title, lede) =>")
s = s[:i] + '''  const PROFILE = ["goal", "trial", "reach"];
  function renderSteps() { if (PROFILE.includes(ui.step)) ui.profileStep = ui.step; paintNav(); }
  function profileNav() {
    const names = { goal: "Your goal", trial: "Level check", reach: "AI guidance" };
    return h("div", { class: "subnav", role: "group", "aria-label": "Profile" }, PROFILE.map((id) => h("button", {
      type: "button", "aria-current": ui.step === id ? "page" : "false", disabled: !stepAvailable(id), onclick: () => go(id),
    }, names[id])));
  }
  const RELABEL = [[/^Step 1/, "Profile · Your goal"], [/^Step 2/, "Profile · Level check"], [/^Step 4/, "Profile · AI guidance"], [/^Step 5.*/, "Learn"], [/^Step 6.*/, "Notes"]];
  const relabel = (e) => { for (const [re, to] of RELABEL) if (re.test(e)) return e.replace(re, to); return e; };
''' + s[j:]
rep('''  const head = (eyebrow, title, lede) => h("div", { class: "panel-head" }, h("p", { class: "eyebrow" }, eyebrow),''',
    '''  const head = (eyebrow, title, lede) => h("div", { class: "panel-head" }, h("p", { class: "eyebrow" }, relabel(eyebrow)),''')
rep('''    main.replaceChildren(PANELS[ui.step]());''', '''    main.replaceChildren(...(PROFILE.includes(ui.step) ? [profileNav()] : []), PANELS[ui.step]());''')
# AI guidance is estimated for the map, not for a path
rep('''    const plan = state.plan;
    if (!plan || !aiReady()) return;
    ui.busy.grade = true;''', '''    if (!km || !aiReady()) return;
    ui.busy.grade = true;''')
rep('''    const units = plan.steps.map((s) => unitById(s.unitId)).filter(Boolean);
    const prompt = [
      "A self-learner will study Python along this path, built from real courses and books:",
      units.map((u, i) => (i + 1) + ". " + (u.material ? "learner's own: " : "") + u.srcShort + ": " + u.t).join("\\n"),''',
    '''    const prompt = [
      "A self-learner will study Python for their goal with a knowledge map built from 13 real courses and books. They pick points themselves; an AI plans and teaches each point, and practice comes from human-written exercises. The map's topics and points:",
      km.data.KD.balls.map((b, i) => (i + 1) + ". " + b.name + ": " + b.pts.map((x) => km.data.byId[x].name).join(", ")).join("\\n"),''')
rep('''saying how far you can guide them on this path"}''', '''saying how far you can guide them on this map"}''')
rep('''"Three models estimate, separately, how much of your path \\"" + state.plan.name + "\\" an AI can explain well for you. Where they disagree, you'll see it."''',
    '''"Three models estimate, separately, how much of this Python map an AI can explain well for you. Where they disagree, you'll see it. The lessons use this figure."''')
rep('''onclick: () => { state.current = firstOpen(); saveState(); go("learn"); ensureLesson(); } }, "Start learning")''',
    '''onclick: () => { saveState(); go("learn"); } }, "Start learning")''')
# the teacher hears the agreed AI involvement
rep('''  const ptLearner = () => (state.goal ? learnerLines() : learnerLines().replace("Learner's goal: ", "Learner's goal: Python for machine learning (default, not set yet)"));''',
    '''  const ptLearner = () => (state.goal ? learnerLines() : learnerLines().replace("Learner's goal: ", "Learner's goal: Python for machine learning (default, not set yet)")) +
    (state.grade ? "\\nAI involvement agreed for this learner: about " + state.grade.share + "% (the higher, the more the AI explains itself; the lower, the more it points to the sources)." : "");''')
rep('"Start with your goal. Your trial tasks, your path and your projects all build on it."', '"Start with your goal. The level check, your lessons and your projects all build on it."')
rep('"You\'ll go straight to your path options."', '"You\'ll go straight to the AI guidance estimate."')
rep('"The knowledge map couldn\'t load here (" + (err && err.message ? err.message : "unknown error") + "). The guided path still works."', '"The knowledge map couldn\'t load here (" + (err && err.message ? err.message : "unknown error") + ")."')
css = open(f"{HERE}/app_v12.css").read()
i = s.rindex("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.2 written:", len(s))

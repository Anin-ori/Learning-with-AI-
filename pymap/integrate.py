"""Build Learning Companion v1.0: the v0.12 app plus the knowledge map as its main view."""
import json, os, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.dirname(HERE)
SRC = f"{SCR}/learning-companion-v0.12.html"
if not os.path.exists(SRC):
    shutil.copy(f"{SCR}/learning-companion.html", SRC)
s = open(SRC).read()

def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:80], s.count(a))
    s = s.replace(a, b)

data = json.load(open(f"{HERE}/km_data.json"))
css = open(f"{HERE}/km_embed.css").read()
js = open(f"{HERE}/km_embed.js").read().replace("/*__KM_DATA__*/null", json.dumps(data, ensure_ascii=False, separators=(",", ":")))

# version
rep("<title>Learning Companion v0.12</title>", "<title>Learning Companion v1.0</title>")
rep('<span class="pill">v0.12 · Python pilot</span>', '<span class="pill">v1.0 · Python pilot</span>')
# styles
i = s.index("</style>")
s = s[:i] + css + s[i:]
# view switch in the top bar
rep('''  <div class="topbar-right">
''', '''  <div class="topbar-right">
''')
# the map section, after the guided-path layout
rep('''  <main class="panel" id="main"></main>
</div>
''', '''  <main class="panel" id="main"></main>
</div>
<section id="kmap" aria-label="Knowledge map" hidden>
  <div class="km-mapwrap">
    <svg class="km-svg" id="km-svg" role="img" aria-label="Map of 30 topics of Python knowledge points"></svg>
    <div class="km-bar">
      <label class="km-search km-glass"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><input id="km-q" type="search" list="km-names" placeholder="Find a topic or point" aria-label="Find a topic or point" autocomplete="off"></label><datalist id="km-names"></datalist>
      <span class="km-focus km-glass" id="km-focus"><span id="km-focustext"></span><button id="km-clear" type="button">Clear</button></span>
      <span class="km-spacer"></span>
      <button class="km-gbtn km-glass km-flashbtn" id="km-flash" type="button" aria-pressed="true"><i></i><span>Top picks glowing</span></button>
      <button class="km-gbtn km-glass" id="km-fit" type="button">Reset view</button>
    </div>
    <div class="km-legend" id="km-legend"></div>
    <div class="km-tip" id="km-tip"></div>
  </div>
  <aside class="km-panel">
    <div class="km-tabs" role="tablist">
      <button role="tab" id="km-t-mine" aria-selected="true" type="button">Overview</button>
      <button role="tab" id="km-t-det" aria-selected="false" type="button">Details</button>
      <button role="tab" id="km-t-src" aria-selected="false" type="button">About</button>
    </div>
    <div class="km-pane" id="km-p-mine" role="tabpanel"></div>
    <div class="km-pane" id="km-p-det" role="tabpanel" hidden><p class="km-empty">Click a topic on the map to see what's inside.</p></div>
    <div class="km-pane" id="km-p-src" role="tabpanel" hidden></div>
  </aside>
</section>
''')
# d3 before the app script
rep('''<div class="toasts" id="toasts" aria-live="polite"></div>

<script>''', '''<div class="toasts" id="toasts" aria-live="polite"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>
<script>''')
# the module, the view switch and start-up
rep('''  $("log-btn").addEventListener("click", () => setLog(!ui.showLog));''', js + '''
  const km = (() => {
    try { return knowledgeMap(); }
    catch (err) {
      $("kmap").replaceChildren(h("p", { class: "banner" }, "The knowledge map couldn't load here (" + (err && err.message ? err.message : "unknown error") + "). The guided path still works."));
      return null;
    }
  })();
  function setView(v) {
    if (!km) v = "path";
    ui.view = v;
    document.body.classList.toggle("view-map", v === "map");
    $("kmap").hidden = v !== "map";
    paintNav();
    if (v === "map") km.show(); else render();
  }
  function paintNav() {
    const sec = ui.view === "map" ? "map" : ui.step === "learn" ? "learn" : ui.step === "check" ? "notes" : "profile";
    document.querySelectorAll("#topnav button").forEach((b) => b.setAttribute("aria-current", b.dataset.sec === sec ? "page" : "false"));
  }
  document.querySelectorAll("#topnav button").forEach((b) => b.addEventListener("click", () => {
    const sec = b.dataset.sec;
    if (sec === "map") { if (ui.view !== "map") logEvent("view", "Opened the map"); setView("map"); return; }
    const step = sec === "learn" ? "learn" : sec === "notes" ? (stepAvailable("check") ? "check" : null) : (ui.profileStep && stepAvailable(ui.profileStep) ? ui.profileStep : "goal");
    if (!step) { notify("Your notes appear after your first lesson on a point.", "warn"); return; }
    ui.view = "path"; document.body.classList.remove("view-map"); $("kmap").hidden = true;
    go(step); paintNav();
  }));

  $("log-btn").addEventListener("click", () => setLog(!ui.showLog));''')
rep('''  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.showLog) setLog(false); });
  render();
''', '''  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.showLog) setLog(false); });
  render();
  setView("map");
''')
rep('''    render();
    if (ui.step === "learn") ensureLesson(false);''', '''    render();
    if (km) km.reload();
    if (ui.step === "learn") ensureLesson(false);''')
rep('''logEvent("reset", "Started over"); saveState(); go("goal");''', '''logEvent("reset", "Started over"); saveState(); go("goal"); if (km) km.reload();''')
open(f"{SCR}/learning-companion.html", "w").write(s)
print("v1.0 written:", len(s), "bytes")

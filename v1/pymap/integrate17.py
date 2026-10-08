"""v1.16: notes live on the map, and questions are kept with their point. Builds v1.15, then:
- the Notes tab opens the knowledge map in notes mode: the topics with notes stay lit (the map's focus), the overview pane
  becomes an index of notes and recent questions, a topic's point list marks which points have notes or questions, and a
  point's details show its notes and its questions first. The list view stays one click away, for recall practice.
- every question asked to the tutor is saved with its answer under the point it was asked about (db doc qa/all), shown in
  that point's notes, and loaded back into the tutor chat when the point is opened again. A question whose answer wasn't
  saved can be asked again in one click."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate16.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.15</title>", "<title>Learning Companion v1.16</title>")
rep('<span class="pill">Python pilot / v1.15</span>', '<span class="pill">Python pilot / v1.16</span>')

# ---------- the map module: notes mode and hooks ----------
# a topic's point list marks notes (✎) and questions (?n)
rep('''        <button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}</button>
        <span class="km-tag ${pNext(p) ? "route" : s}">''',
    '''        <button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}${opts.noteMarks ? opts.noteMarks(p) : ""}</button>
        <span class="km-tag ${pNext(p) ? "route" : s}">''')
# a point's details: notes and questions (first in notes mode, after the status card otherwise)
rep('''        <button class="km-back" type="button" data-ball="${BALL_OF[id]}">← ${esc(bn(BALL_OF[id]))}</button>
        <h2>${esc(n.name)}</h2>''',
    '''        <button class="km-back" type="button" data-ball="${BALL_OF[id]}">← ${esc(bn(BALL_OF[id]))}</button>
        <h2>${esc(n.name)}</h2>
        ${notesMode && opts.notesHTML ? opts.notesHTML(id) : ""}''')
rep('''        <p class="km-small">Taught in ${n.n} of 13 sources.</p>''',
    '''        ${!notesMode && opts.notesHTML ? opts.notesHTML(id) : ""}
        <p class="km-small">Taught in ${n.n} of 13 sources.</p>''')
# the overview pane becomes the notes index in notes mode
rep('''    function renderMine() {''', '''    let notesMode = false;
    function renderMine() {
      if (notesMode && opts.notesIndex) { el("km-p-mine").innerHTML = opts.notesIndex(); return; }''')
# note actions from the panel
rep('''      const t = e.target.closest("[data-ball],[data-point],[data-toggle],[data-markall],[data-clearall],[data-act],[data-show],[data-learn]"); if (!t) return;
      const ds = t.dataset;''',
    '''      const t = e.target.closest("[data-ball],[data-point],[data-toggle],[data-markall],[data-clearall],[data-act],[data-show],[data-learn],[data-noteact]"); if (!t) return;
      const ds = t.dataset;
      if (ds.noteact) { if (opts.onNoteAct) opts.onNoteAct(ds.noteact, ds.id, ds.n); return; }''')
# the module's API
rep('''      openPoint(id) { if (!ks.shown) this.show(); showPoint(id); },
    };''',
    '''      openPoint(id) { if (!ks.shown) this.show(); showPoint(id); },
      setNotes(on, fit = true) {
        notesMode = !!on;
        el("kmap").classList.toggle("km-notesmode", notesMode);
        if (notesMode) {
          const lit = new Set(KD.balls.filter((b) => b.pts.some((p) => opts.hasNotes && opts.hasNotes(p))).map((b) => b.id));
          tab("mine"); setFocus(lit.size ? lit : null, I18N.t("Topics with your notes")); if (!lit.size) fitBalls(null);
        } else if (ks.focus) { setFocus(null); if (fit) fitBalls(null); }
        refresh();
      },
      notesMode: () => notesMode,
    };''')

# ---------- the app: questions saved with their point ----------
rep('''  const km = (() => {
    try { return knowledgeMap({ onLearn: (pid) => { plPick(pid, "the map"); setView("path"); go("learn"); } }); }''',
    '''  // ---------- Notes on the map (v1.16) ----------
  // Notes come from each point's lesson; questions are what the learner asked the tutor about that point, with the answers.
  ui.qa = {};
  const qaOf = (pid) => ui.qa[pid] || [];
  const saveQa = () => { if (db) db.doc("qa/all").set({ v: 1, items: clone(ui.qa) }).catch(() => notify("The question couldn't be saved.", "warn")); };
  const hasNotes = (pid) => !!((state.pointIndex || {})[pid] && (state.pointIndex[pid].notes || []).length) || qaOf(pid).length > 0;
  const escH = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const inlineH = (t) => escH(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\\*\\*([^*]+)\\*\\*/g, "<b>$1</b>");
  const mdH = (t) => { const d = document.createElement("div"); [].concat(md(t)).forEach((x) => x && d.append(x)); return d.innerHTML; };
  function noteMarks(pid) {
    const n = ((state.pointIndex || {})[pid] || {}).notes || [], q = qaOf(pid).length;
    return (n.length ? ' <span class="km-mark" title="' + escH(I18N.t("Has notes")) + '">✎</span>' : "") + (q ? ' <span class="km-mark q" title="' + escH(I18N.t("Questions asked")) + '">?' + q + "</span>" : "");
  }
  function notesHTML(pid) {
    const n = ((state.pointIndex || {})[pid] || {}).notes || [], qs = qaOf(pid);
    if (!n.length && !qs.length) return "";
    const T = (x) => escH(I18N.t(x));
    const qaRows = qs.map((it, i) => '<details class="km-qa"' + (i === qs.length - 1 ? " open" : "") + "><summary>" + escH(it.q) + "</summary>" +
      (it.a ? '<div class="km-qa-a lesson">' + mdH(it.a) + "</div>"
        : '<p class="km-small">' + T("The answer wasn't saved: this was asked before questions were kept.") + '</p><button class="km-btn" type="button" data-noteact="ask" data-id="' + pid + '" data-n="' + i + '">' + T("Ask again") + "</button>") + "</details>").join("");
    return '<section class="km-notes"><h3>' + T("Your notes") + "</h3>" +
      (n.length ? '<ul class="km-notelist">' + n.map((x) => "<li>" + inlineH(x) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T("No lesson notes yet.") + "</p>") +
      (qs.length ? "<h3>" + T("Your questions") + '</h3><div class="km-qas">' + qaRows + "</div>" : "") +
      '<div class="km-btns"><button class="km-btn solid" type="button" data-noteact="lesson" data-id="' + pid + '">' + T(n.length ? "Open the lesson" : "Learn this point") + "</button></div></section>";
  }
  function notesIndex() {
    const P = km.data, idx = state.pointIndex || {}, T = (x) => escH(I18N.t(x));
    const pids = P.KD.nodes.map((x) => x.id).filter(hasNotes);
    const nq = pids.reduce((a, p) => a + qaOf(p).length, 0);
    if (!pids.length) return '<p class="km-eyebrow">' + T("Notes") + "</p><h2>" + T("Your notes") + '</h2><p class="km-empty">' + T("No notes yet. Notes appear here after your first lesson on a point, and the questions you ask the tutor appear with them.") + "</p>";
    const recent = pids.flatMap((p) => qaOf(p).map((it) => ({ p, it }))).sort((a, b) => String(b.it.at).localeCompare(String(a.it.at))).slice(0, 6);
    const topics = P.KD.balls.filter((b) => b.pts.some(hasNotes)).map((b) =>
      '<div class="km-ntopic"><button class="km-nm km-ntitle" data-ball="' + b.id + '" type="button">' + escH(b.name) + '</button><div class="km-inline">' +
      b.pts.filter(hasNotes).map((p) => '<button class="km-nm" data-point="' + p + '" type="button">' + escH(ptName(p)) + noteMarks(p) + "</button>").join("") + "</div></div>").join("");
    return '<p class="km-eyebrow">' + T("Notes") + "</p><h2>" + T("Your notes") + "</h2>" +
      '<p class="km-small">' + escH(I18N.t(pids.length + (pids.length === 1 ? " point" : " points") + " with notes · " + nq + (nq === 1 ? " question" : " questions"))) + "</p>" +
      '<div class="km-btns"><button class="km-btn" type="button" data-noteact="list">' + T("Open as a list (to test yourself)") + '</button><button class="km-btn" type="button" data-noteact="copy">' + T("Copy all notes") + "</button></div>" +
      (recent.length ? "<h3>" + T("Recent questions") + '</h3><div class="km-rows">' + recent.map((r) => '<div class="km-prow km-rq"><button class="km-nm" data-point="' + r.p + '" type="button">' + escH(r.it.q) + '</button><span class="km-tag">' + escH(ptName(r.p)) + "</span></div>").join("") + "</div>" : "") +
      "<h3>" + T("By topic") + "</h3>" + topics;
  }
  // leaving notes mode without a zoom (the map may be about to hide)
  const leaveNotes = () => { ui.notesMode = false; if (km && km.notesMode()) km.setNotes(false, false); };
  function onNoteAct(act, pid, n) {
    if (act === "lesson") { plPick(pid, "notes"); leaveNotes(); setView("path"); go("learn"); }
    else if (act === "ask") { const it = qaOf(pid)[+n]; plPick(pid, "notes"); ui.chatKey = null; leaveNotes(); setView("path"); go("learn"); if (it) { ui.chatInput = it.q; render(); const t = $("chat-input"); if (t) t.focus(); } }
    else if (act === "list") { if (!stepAvailable("check")) { notify("The list view needs at least one lesson's notes.", "warn"); return; } leaveNotes(); setView("path"); go("check"); }
    else if (act === "copy") { const text = ptNotesText(); navigator.clipboard.writeText(text).then(() => notify("Notes copied as plain text."), () => notify("Couldn't copy here. Open the list view to copy the notes.", "warn")); }
  }
  const km = (() => {
    try { return knowledgeMap({ onLearn: (pid) => { plPick(pid, "the map"); leaveNotes(); setView("path"); go("learn"); }, noteMarks, notesHTML, notesIndex, hasNotes, onNoteAct }); }''')

# the tutor: past questions come back into the chat, and each new question is saved with its answer
rep('''    if (ui.chatKey !== "pt:" + pid) { ui.chat = []; ui.chatKey = "pt:" + pid; }''',
    '''    if (ui.chatKey !== "pt:" + pid) {
      ui.chat = pid ? qaOf(pid).flatMap((it) => [{ role: "user", content: it.q }, it.a ? { role: "assistant", content: it.a, saved: true } : { role: "assistant", content: I18N.t("(This answer wasn't saved. Send the question again to get a new one.)"), failed: true, saved: true }]) : [];
      ui.chatKey = "pt:" + pid;
    }''')
rep('''      msg.content = res.text; msg.truncated = res.truncated;
      logEvent("chat", "Asked the tutor about " + ptName(pid) + ": " + text.slice(0, 160));''',
    '''      msg.content = res.text; msg.truncated = res.truncated;
      logEvent("chat", "Asked the tutor about " + ptName(pid) + ": " + text.slice(0, 160));
      ui.qa[pid] = qaOf(pid).filter((it) => it.a || it.q !== text).concat([{ q: text, a: res.text, at: new Date().toISOString() }]);
      saveQa();''')
# load the questions with the rest of the saved progress
rep('''        if (logSnap.exists && Array.isArray(logSnap.data().events)) log = clone(logSnap.data().events);''',
    '''        if (logSnap.exists && Array.isArray(logSnap.data().events)) log = clone(logSnap.data().events);
        try { const qs = await db.doc("qa/all").get(); if (qs.exists && qs.data() && qs.data().items) ui.qa = clone(qs.data().items); } catch (_) {}''')

# ---------- navigation: the Notes tab is the map in notes mode ----------
rep('''    const sec = ui.view === "map" ? "map" : ui.step === "learn"''', '''    const sec = ui.view === "map" ? (ui.notesMode ? "notes" : "map") : ui.step === "learn"''')
rep('''    if (sec === "map") { if (ui.view !== "map") logEvent("view", "Opened the map"); setView("map"); return; }''',
    '''    if (sec === "map") { if (ui.view !== "map") logEvent("view", "Opened the map"); ui.notesMode = false; if (km) km.setNotes(false); setView("map"); return; }
    if (sec === "notes" && km) { if (!ui.notesMode) logEvent("view", "Opened the notes map"); ui.notesMode = true; setView("map"); km.setNotes(true); paintNav(); return; }''')
rep('''    ui.view = "path"; document.body.classList.remove("view-map"); $("kmap").hidden = true;
    go(step); paintNav();''', '''    ui.view = "path"; leaveNotes(); document.body.classList.remove("view-map"); $("kmap").hidden = true;
    go(step); paintNav();''')

i = s.rindex("</style>")
s = s[:i] + '''
/* v1.16: notes on the map */
#kmap .km-mark { font-family: var(--font-heavy); font-weight: 800; font-size: 11px; color: var(--blue); margin-left: 4px; white-space: nowrap; }
#kmap .km-mark.q { color: var(--orange); }
#kmap .km-notes { border-top: 2px solid var(--charcoal); margin: 14px 0 6px; padding-top: 4px; }
#kmap .km-notelist { margin: 0 0 8px; padding-left: 20px; display: grid; gap: 7px; line-height: 1.55; }
#kmap .km-notelist code, #kmap .km-qa-a code { font-family: var(--font-mono); font-size: .9em; background: var(--sunk, #dddcd6); padding: 1px 4px; }
#kmap .km-qas { display: grid; gap: 6px; margin-bottom: 10px; }
#kmap details.km-qa { border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 70%, transparent); padding: 8px 10px; }
#kmap details.km-qa > summary { cursor: pointer; font-family: var(--font-body); font-weight: 600; font-size: 14.5px; line-height: 1.45; text-transform: none; letter-spacing: 0; }
#kmap .km-prow.km-rq { grid-template-columns: minmax(0, 1fr) auto; }
#kmap .km-rq .km-tag { text-transform: none; letter-spacing: 0; white-space: nowrap; }
#kmap .km-qa-a { font-size: 14.5px; line-height: 1.6; margin-top: 8px; display: grid; gap: 8px; max-width: none; }
#kmap .km-qa-a pre { margin: 0; padding: 8px 10px; background: var(--code-bg, #333432); color: var(--code-fg, #f1f0ec); overflow-x: auto; }
#kmap .km-qa-a pre code { background: none; color: inherit; }
#kmap .km-ntopic { padding: 10px 0; border-top: 1px solid var(--line); display: grid; gap: 6px; }
#kmap .km-ntitle { font-family: var(--font-heavy); font-weight: 800; font-size: 15px; }
#kmap .km-rq .km-nm { text-align: left; }
#kmap.km-notesmode .km-focus.on { border-color: var(--blue); }
''' + s[i:]
open(p, "w").write(s)
print("v1.16 written:", len(s))

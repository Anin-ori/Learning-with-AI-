  // ---------- Notes on the map (v1.16) ----------
  // Notes come from each point's lesson; questions are what the learner asked the tutor about that point, with the answers.
  // v2.0: kept per map (qa2/<map id>), so a rebuilt map starts with its own.
  const qaOf = (pid) => ui.qa[pid] || [];
  const qaPath = () => { const M = curMap(); return M && M.mid ? "qa2/" + M.mid : null; };
  const saveQa = () => { const p = qaPath(); if (db && p) db.doc(p).set({ v: 2, items: clone(ui.qa) }).catch(() => notify("The question couldn't be saved.", "warn")); };
  async function loadQa() {
    ui.qa = {};
    const p = qaPath();
    if (!db || !p) return;
    try { const snap = await db.doc(p).get(); if (snap.exists && snap.data() && snap.data().items) ui.qa = clone(snap.data().items); } catch (_) {}
  }
  const ptIndex = () => (cur() && cur().pointIndex) || {};
  const hasNotes = (pid) => !!(ptIndex()[pid] && (ptIndex()[pid].notes || []).length) || qaOf(pid).length > 0;
  const escH = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const inlineH = (t) => escH(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const mdH = (t) => { const d = document.createElement("div"); [].concat(md(t)).forEach((x) => x && d.append(x)); return d.innerHTML; };
  function noteMarks(pid) {
    const n = (ptIndex()[pid] || {}).notes || [], q = qaOf(pid).length;
    return (n.length ? ' <span class="km-mark" title="' + escH(I18N.t("Has notes")) + '">✎</span>' : "") + (q ? ' <span class="km-mark q" title="' + escH(I18N.t("Questions asked")) + '">?' + q + "</span>" : "");
  }
  function notesHTML(pid) {
    const n = (ptIndex()[pid] || {}).notes || [], qs = qaOf(pid);
    if (!n.length && !qs.length) return "";
    const T = (x) => escH(I18N.t(x));
    const qaRows = qs.map((it, i) => '<details class="km-qa"' + (i === qs.length - 1 ? " open" : "") + '><summary data-ai>' + escH(it.q) + "</summary>" +
      (it.a ? '<div class="km-qa-a lesson">' + mdH(it.a) + "</div>"
        : '<p class="km-small">' + T("The answer wasn't saved.") + '</p><button class="km-btn" type="button" data-noteact="ask" data-id="' + pid + '" data-n="' + i + '">' + T("Ask again") + "</button>") + "</details>").join("");
    return '<section class="km-notes"><h3>' + T("Your notes") + "</h3>" +
      (n.length ? '<ul class="km-notelist" data-ai>' + n.map((x) => "<li>" + inlineH(x) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T("No lesson notes yet.") + "</p>") +
      (qs.length ? "<h3>" + T("Your questions") + '</h3><div class="km-qas">' + qaRows + "</div>" : "") +
      '<div class="km-btns"><button class="km-btn solid" type="button" data-noteact="lesson" data-id="' + pid + '">' + T(n.length ? "Open the lesson" : "Learn this point") + "</button></div></section>";
  }
  function notesIndex() {
    const P = km.data, T = (x) => escH(I18N.t(x));
    const pids = P.KD.nodes.map((x) => x.id).filter(hasNotes);
    const nq = pids.reduce((a, p) => a + qaOf(p).length, 0);
    if (!pids.length) return '<p class="km-eyebrow">' + T("Notes") + "</p><h2>" + T("Your notes") + '</h2><p class="km-empty">' + T("No notes yet. Notes appear here after your first lesson on a point, and the questions you ask the tutor appear with them.") + "</p>";
    const recent = pids.flatMap((p) => qaOf(p).map((it) => ({ p, it }))).sort((a, b) => String(b.it.at).localeCompare(String(a.it.at))).slice(0, 6);
    const topics = P.KD.balls.filter((b) => b.pts.some(hasNotes)).map((b) =>
      '<div class="km-ntopic"><button class="km-nm km-ntitle" data-ball="' + b.id + '" type="button" data-ai>' + escH(b.name) + '</button><div class="km-inline">' +
      b.pts.filter(hasNotes).map((p) => '<button class="km-nm" data-point="' + p + '" type="button"><span data-ai>' + escH(ptName(p)) + "</span>" + noteMarks(p) + "</button>").join("") + "</div></div>").join("");
    return '<p class="km-eyebrow">' + T("Notes") + "</p><h2>" + T("Your notes") + "</h2>" +
      '<p class="km-small">' + escH(I18N.t(pids.length + (pids.length === 1 ? " point" : " points") + " with notes · " + nq + (nq === 1 ? " question" : " questions"))) + "</p>" +
      '<div class="km-btns"><button class="km-btn" type="button" data-noteact="list">' + T("Open as a list (to test yourself)") + '</button><button class="km-btn" type="button" data-noteact="copy">' + T("Copy all notes") + "</button></div>" +
      (recent.length ? "<h3>" + T("Recent questions") + '</h3><div class="km-rows">' + recent.map((r) => '<div class="km-prow km-rq"><button class="km-nm" data-point="' + r.p + '" type="button" data-ai>' + escH(r.it.q) + '</button><span class="km-tag" data-ai>' + escH(ptName(r.p)) + "</span></div>").join("") + "</div>" : "") +
      "<h3>" + T("By topic") + "</h3>" + topics;
  }
  // leaving notes mode without a zoom (the map may be about to hide)
  const leaveNotes = () => { ui.notesMode = false; if (km && km.notesMode()) km.setNotes(false, false); };
  function onNoteAct(act, pid, n) {
    if (act === "lesson") { plPick(pid, "notes"); leaveNotes(); setView("path"); go("learn"); }
    else if (act === "ask") { const it = qaOf(pid)[+n]; plPick(pid, "notes"); ui.chatKey = null; leaveNotes(); setView("path"); go("learn"); if (it) { ui.chatInput = it.q; render(); const t = $("chat-input"); if (t) t.focus(); } }
    else if (act === "list") { if (!Object.keys(ptIndex()).length) { notify("The list view needs at least one lesson's notes.", "warn"); return; } leaveNotes(); setView("path"); go("notes"); }
    else if (act === "copy") { const text = ptNotesText(); navigator.clipboard.writeText(text).then(() => notify("Notes copied as plain text."), () => notify("Couldn't copy here. Open the list view to copy the notes.", "warn")); }
  }

  // ---------- Notes as a list, for testing yourself ----------
  function ptNotesText() {
    const P = km.data, idx = ptIndex(), out = [I18N.t("My notes") + ": " + ((cur() && cur().name) || ""), ""];
    P.KD.balls.forEach((b) => {
      const pts = b.pts.filter((p) => idx[p]); if (!pts.length) return;
      out.push(b.name);
      pts.forEach((p) => { out.push("  " + ptName(p)); (idx[p].notes || []).forEach((x) => out.push("   - " + plainNote(x))); });
      out.push("");
    });
    return out.join("\n");
  }
  function renderPointNotes() {
    if (!km) return noMapPanel("Notes");
    const P = km.data, idx = ptIndex();
    const pids = Object.keys(idx).filter((p) => P.byId[p]);
    if (!pids.length) return h("section", { class: "panel" }, head("Notes", "Your notes", "Notes appear here after your first lesson on a point."),
      h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: () => go("learn") }, "Learn a point")));
    const hide = !!ui.noteHide;
    const copy = async () => {
      const text = ptNotesText();
      try { await navigator.clipboard.writeText(text); notify("Notes copied as plain text."); }
      catch (_) { const el = $("notes-body"); const sel = window.getSelection(); const r = document.createRange(); r.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(r); notify("Couldn't copy directly, so the notes are selected. Press Ctrl+C or Cmd+C to copy them.", "warn"); }
    };
    const toolbar = h("div", { class: "notes-toolbar" },
      h("div", { class: "seg", role: "group", "aria-label": "How to show the notes" },
        h("button", { type: "button", class: hide ? "" : "on", "aria-pressed": hide ? "false" : "true", onclick: () => { ui.noteHide = false; render(); } }, "Show everything"),
        h("button", { type: "button", class: hide ? "on" : "", "aria-pressed": hide ? "true" : "false", onclick: () => { ui.noteHide = true; ui.noteRevealed = {}; render(); } }, "Hide key terms")),
      hide ? h("button", { class: "quiet", type: "button", onclick: () => { ui.noteRevealed = {}; ui.noteHide = false; render(); } }, "Reveal all") : null,
      h("button", { class: "quiet", type: "button", onclick: copy }, "Copy notes"));
    const sections = P.KD.balls.filter((b) => b.pts.some((p) => idx[p])).map((b) => h("section", { class: "note-sec" },
      h("div", { class: "note-head" }, ai("h3", null, b.name), h("span", { class: "muted small" }, b.pts.filter((p) => km.isLearned(p)).length + " of " + b.pts.length + " learned")),
      b.pts.filter((p) => idx[p]).map((p) => h("div", { class: "pt-note" },
        h("div", { class: "note-head" },
          h("h4", null, ai("span", null, ptName(p)), " ", h("span", { class: km.isLearned(p) ? "chip ok" : "chip" }, km.isLearned(p) ? "learned" : PT_STATUS[km.status(p)])),
          h("button", { class: "link small", type: "button", onclick: () => { plPick(p, "notes"); go("learn"); } }, "Lesson")),
        (idx[p].notes || []).length ? h("ul", { class: "note-points" }, idx[p].notes.map((x, j) => h("li", null, noteInline(x, hide, p + "-" + j)))) : h("p", { class: "small muted" }, "No notes came with this lesson.")))));
    return h("section", { class: "panel" },
      head("Notes", "Your notes", "The notes from each point you've studied, grouped by topic. To test yourself, hide the key terms and recall each one before you click it."),
      toolbar,
      h("div", { class: "card notes", id: "notes-body" }, sections),
      h("p", { class: "small muted" }, "Written by the teaching AI with each lesson and checked with it."),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", onclick: () => go("learn") }, "Learn another point"),
        h("button", { class: "quiet", type: "button", onclick: () => setView("map") }, "Open the knowledge map")));
  }

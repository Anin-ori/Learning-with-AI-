  // ---------- Test log ----------
  function setLog(open) {
    ui.showLog = !!open;
    renderLog();
    if (ui.showLog) { const c = $("log-close"); if (c) c.focus(); }
    else if (document.activeElement && $("log").contains(document.activeElement)) $("log-btn").focus();
  }
  function paintDrawer() {
    const open = !!ui.showLog;
    $("log").classList.toggle("open", open);
    $("log").setAttribute("aria-hidden", open ? "false" : "true");
    $("backdrop").hidden = !open;
    $("log-btn").setAttribute("aria-expanded", open ? "true" : "false");
    $("log-btn").textContent = "Test log" + (log.length ? " · " + log.length : "");
  }
  function renderLog() {
    paintDrawer();
    if (!ui.showLog) return;
    const active = document.activeElement;
    const keepNote = active && active.id === "note" ? [active.selectionStart, active.selectionEnd] : null;
    const items = log.slice(-25).reverse().map((e) => h("li", null, h("time", { datetime: e.at }, new Date(e.at).toLocaleTimeString(I18N.lang === "zh" ? "zh-CN" : [], { hour: "2-digit", minute: "2-digit" })), h("span", null, e.text)));
    $("log").replaceChildren(
      h("div", { class: "row spread" }, h("h2", { style: "font-size: 1.3rem" }, "Test log"), h("button", { class: "quiet", type: "button", id: "log-close", onclick: () => setLog(false) }, "Close")),
      h("div", { class: "card" },
        h("div", { class: "row spread" }, h("h3", null, "What happened"), h("span", { class: "muted small" }, log.length + " entries")),
        items.length ? h("ol", null, items) : h("p", { class: "muted small" }, "What happens in this session is recorded here."),
        h("p", { class: "small muted" }, db ? "Saved with this page, so Claude can review your test with you later." : "Not saved in this view. It clears when you close the page.")),
      h("div", { class: "card" },
        h("label", { for: "note" }, "Note for the author"),
        h("textarea", { id: "note", rows: 3, value: ui.note, placeholder: "Anything that felt wrong, confusing or good", oninput: (e) => { ui.note = e.target.value; } }),
        h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => {
          if (!ui.note.trim()) { notify("Write something in the note first.", "warn"); return; }
          logEvent("note", "Note: " + ui.note.trim()); ui.note = ""; renderLog(); notify("Note saved to the test log.");
        } }, "Save note"))),
      h("div", { class: "card soft" },
        ui.confirmReset
          ? h("div", { class: "field" },
              h("p", { class: "small" }, "Start over? All your subjects and their progress are removed from this page. The test log stays."),
              h("div", { class: "row" },
                h("button", { class: "primary", type: "button", onclick: () => {
                  [ui.build, ui.pjob, ui.pjudge, ...Object.values(ui.pjobs)].forEach((j) => { if (j) j.cancel = true; });
                  app = freshApp(); Object.keys(subjects).forEach((k) => delete subjects[k]); Object.keys(maps).forEach((k) => delete maps[k]);
                  Object.assign(ui, { confirmReset: false, showLog: false, chat: [], chatKey: null, plessons: {}, pjobs: {}, qa: {}, pset: null, prun: {}, pjob: null, pjudge: null, build: null, trialAnswers: {}, tierResults: {} });
                  saveApp(); logEvent("reset", "Started over"); mountMap(); setView("path"); go("subjects");
                  notify("Started over. Your test log was kept.");
                } }, "Start over"),
                h("button", { class: "quiet", type: "button", onclick: () => { ui.confirmReset = false; renderLog(); } }, "Cancel")))
          : h("button", { class: "quiet", type: "button", onclick: () => { ui.confirmReset = true; renderLog(); } }, "Start over")));
    if (keepNote) { const n = $("note"); if (n) { n.focus(); try { n.setSelectionRange(keepNote[0], keepNote[1]); } catch (_) {} } }
  }


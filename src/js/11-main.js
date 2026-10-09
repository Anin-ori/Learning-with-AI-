  // ---------- Mounting the open subject's map ----------
  let km = null;
  function updatePill() {
    const s = cur(), pill = $("subject-pill");
    pill.textContent = (s ? s.name + " / " : "") + "v2.2";
    pill.setAttribute("data-ai", "");
  }
  function mountMap() {
    km = null;
    const M = curMap();
    updatePill();
    if (!M || !cur()) { $("kmap").hidden = true; return; }
    try {
      km = knowledgeMap(displayMap(M), {
        onLearn: (pid) => { plPick(pid, "the map"); leaveNotes(); setView("path"); go("learn"); },
        noteMarks, notesHTML, notesIndex, hasNotes, onNoteAct, aboutHTML,
        onAbout: (what) => {
          if (what === "orig") return setShowOrig(!showOrigFlag);
          if (what === "translate") return retranslateMap();
          leaveNotes(); setView("path"); go("goal");
        },
      });
    } catch (err) {
      km = null;
      logEvent("map", "The map couldn't be drawn: " + ((err && err.message) || "unknown error"));
      notify("The map couldn't be drawn here (" + ((err && err.message) || "unknown error") + ").", "bad");
    }
    loadQa().then(() => { if (km) km.reload(); if (ui.view !== "map") render(); });
    autoTranslateMap();
  }

  // ---------- Sections and steps ----------
  function stepAvailable(id) {
    switch (id) {
      case "subjects": return true;
      case "goal": return !!cur();
      case "trial": case "reach": return !!km;
      case "learn": case "practice": case "notes": return true;
      default: return false;
    }
  }
  function go(step) {
    if (!stepAvailable(step)) return;
    ui.step = step;
    if (PROFILE.includes(step)) ui.profileStep = step;
    if (ui.view === "map") { ui.view = "path"; leaveNotes(); document.body.classList.remove("view-map"); $("kmap").hidden = true; }
    render();
    window.scrollTo(0, 0);
    if (step === "learn" && plPoint()) ensurePointLesson(plPoint());
  }
  const PANELS = { subjects: renderSubjects, goal: renderGoal, trial: renderTrial, reach: renderReach, learn: renderPointLearn, practice: renderPractice, notes: renderPointNotes };
  function render() {
    if (!stepAvailable(ui.step)) ui.step = "subjects";
    document.body.classList.toggle("reading", ui.step === "learn" || ui.step === "practice");
    paintNav();
    main.replaceChildren(...(PROFILE.includes(ui.step) ? [profileNav()] : []), PANELS[ui.step]());
    renderLog();
  }
  function paintNav() {
    const sec = ui.view === "map" ? (ui.notesMode ? "notes" : "map") : ui.step === "learn" ? "learn" : ui.step === "practice" ? "practice" : ui.step === "notes" ? "notes" : "profile";
    document.querySelectorAll("#topnav button").forEach((b) => b.setAttribute("aria-current", b.dataset.sec === sec ? "page" : "false"));
    document.body.dataset.sec = sec;
  }
  function setView(v) {
    if (!km) v = "path";
    ui.view = v;
    document.body.classList.toggle("view-map", v === "map");
    $("kmap").hidden = v !== "map";
    paintNav();
    if (v === "map") km.show(); else render();
  }
  document.querySelectorAll("#topnav button").forEach((b) => b.addEventListener("click", () => {
    const sec = b.dataset.sec;
    if ((sec === "map" || sec === "notes") && !km) { notify(cur() ? "This subject's map isn't built yet." : "Start a subject first: an AI builds its map.", "warn"); go("subjects"); return; }
    if (sec === "map") { if (ui.view !== "map") logEvent("view", "Opened the map"); ui.notesMode = false; km.setNotes(false); setView("map"); return; }
    if (sec === "notes") { if (!ui.notesMode) logEvent("view", "Opened the notes map"); ui.notesMode = true; setView("map"); km.setNotes(true); paintNav(); return; }
    const step = sec === "learn" ? "learn" : sec === "practice" ? "practice" : (ui.profileStep && stepAvailable(ui.profileStep) ? ui.profileStep : cur() ? "goal" : "subjects");
    go(step);
  }));

  $("log-btn").addEventListener("click", () => setLog(!ui.showLog));
  $("backdrop").addEventListener("click", () => setLog(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ui.showLog) setLog(false); });
  updatePill();
  render();

  // ---------- Start: load the learner's subjects ----------
  (async () => {
    const use = (name) => (window.claude && typeof window.claude.use === "function") ? window.claude.use(name).catch(() => null) : Promise.resolve(null);
    const [s, d] = await Promise.all([use("sample"), use("db")]);
    sample = s; sampleChat = I18N.wrapAI(s); db = d;
    $("ai-banner").hidden = !!sample;
    if (db) {
      try {
        const [snap, logSnap] = await Promise.all([db.doc("app2/index").get(), db.doc("logs/main").get()]);
        if (logSnap.exists && Array.isArray(logSnap.data().events)) log = clone(logSnap.data().events);
        if (snap.exists) {
          const a = snap.data();
          app = Object.assign(freshApp(), clone(a));
          const loaded = await Promise.all(app.order.map((sid) => db.doc("subjects/" + sid).get().then((x) => (x.exists ? clone(x.data()) : null), () => null)));
          loaded.forEach((x) => { if (x && x.sid) subjects[x.sid] = Object.assign(freshSubject(x.sid, x), x); });
          app.order = app.order.filter((sid) => subjects[sid]);
          if (!subjects[app.current]) app.current = app.order[0] || null;
          await Promise.all(app.order.map(loadBuild));
          if (app.current) await ensureMap(app.current);
        }
        setSave(snap.exists ? "Progress restored" : "Progress will be saved");
      } catch (_) {
        setSave("Progress can't be loaded right now");
      }
    } else {
      setSave("Progress isn't saved in this view");
    }
    mountMap();
    if (km) setView("map");
    else { ui.step = "subjects"; setView("path"); }
  })();

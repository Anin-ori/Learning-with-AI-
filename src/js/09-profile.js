  // ---------- Profile: subjects, goal, level check, AI guidance (v2.0) ----------
  const PROFILE = ["subjects", "goal", "trial", "reach"];
  const PROFILE_NAMES = { subjects: "Subjects", goal: "Your goal", trial: "Level check", reach: "AI guidance" };
  function profileNav() {
    return h("div", { class: "subnav", role: "group", "aria-label": "Profile" }, PROFILE.map((id) => h("button", {
      type: "button", "aria-current": ui.step === id ? "page" : "false", disabled: !stepAvailable(id), onclick: () => go(id),
    }, PROFILE_NAMES[id])));
  }
  const head = (eyebrow, title, lede) => h("div", { class: "panel-head" }, h("p", { class: "eyebrow" }, eyebrow), h("h2", null, title), lede ? h("p", { class: "lede" }, lede) : null);
  const caution = (text) => h("p", { class: "caution" }, text || "AI answers can be wrong. Treat them as a second opinion.");
  const errLine = (key) => ui.errors[key] ? h("p", { class: "msg", role: "alert" }, ui.errors[key]) : null;
  function noMapPanel(title) {
    const s = cur();
    return h("section", { class: "panel" }, head(title, s ? ai("span", null, s.name) : "No subject yet",
      s ? "This subject's map isn't built yet. Build it in Profile first." : "Start a subject in Profile: name what you want to learn and why, and an AI builds your map."),
      h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: () => go("subjects") }, s ? "Go to the map builder" : "Start a subject")));
  }

  // ----- subjects -----
  async function switchSubject(sid) {
    if (!subjects[sid] || app.current === sid) return;
    app.current = sid; saveApp();
    ui.plessons = {}; ui.pjobs = {}; ui.chat = []; ui.chatKey = null; ui.pset = null; ui.prun = {}; ui.pjudge = null; ui.pjob = null; ui.psetTried = null; ui.trialAnswers = {}; ui.tierResults = {};
    await ensureMap(sid);
    logEvent("subject", "Opened the subject " + subjects[sid].name);
    mountMap();
    if (km) setView("map"); else { setView("path"); go("subjects"); }
  }
  async function ensureMap(sid) {
    if (maps[sid] || !db || !subjects[sid] || !subjects[sid].built) return;
    try { const snap = await db.doc("maps/" + sid).get(); if (snap.exists) maps[sid] = clone(snap.data()); } catch (_) {}
  }
  function startSubject() {
    const f = ui.form;
    const name = f.name.trim(), goal = f.goal.trim();
    if (!name) { ui.errors.subject = "Name the subject first."; render(); return; }
    if (!goal) { ui.errors.subject = "Describe your goal in a sentence or two. The map is built for it."; render(); return; }
    ui.errors.subject = null;
    const sid = newId("s");
    subjects[sid] = freshSubject(sid, { name, goal, situation: f.situation.trim() });
    app.order.push(sid); app.current = sid;
    ui.form = { name: "", goal: "", situation: "" };
    ui.plessons = {}; ui.pjobs = {}; ui.chat = []; ui.chatKey = null; ui.pset = null; ui.qa = {};
    km = null; $("kmap").hidden = true;
    saveApp(); saveSubject(sid);
    logEvent("subject", "Started a subject: " + name + " · Goal: " + goal);
    buildMap(sid);
  }
  async function deleteSubject(sid) {
    const s = subjects[sid]; if (!s) return;
    const mid = maps[sid] && maps[sid].mid;
    app.order = app.order.filter((x) => x !== sid);
    delete subjects[sid]; delete maps[sid];
    if (db) ["subjects/" + sid, "maps/" + sid].concat(mid ? ["qa2/" + mid] : []).forEach((p) => { try { const d = db.doc(p); if (d.delete) d.delete().catch(() => {}); else d.set({ deleted: true }).catch(() => {}); } catch (_) {} });
    logEvent("subject", "Deleted the subject " + s.name);
    ui.confirmDelete = null;
    if (app.current === sid) {
      app.current = app.order[0] || null;
      if (app.current) { await ensureMap(app.current); }
      mountMap();
    }
    saveApp(); render();
  }
  function renderSubjects() {
    const f = ui.form, job = ui.build && (ui.build.running || ui.build.stage === "error") ? ui.build : null;
    const list = app.order.map((sid) => subjects[sid]).filter(Boolean);
    const card = (s) => {
      const M = maps[s.sid], here = s.sid === app.current;
      return h("article", { class: "card" + (here ? " subject-here" : "") },
        h("div", { class: "row spread" }, ai("h3", null, s.name), here ? h("span", { class: "chip accent" }, "Open now") : null),
        s.goal ? ai("p", { class: "small" }, s.goal) : null,
        h("p", { class: "small muted" }, s.built ? (M ? (s.learned || []).length + " of " + M.nodes.length + " points learned" : (s.learned || []).length + " points learned") : "The map isn't built yet."),
        ui.confirmDelete === s.sid
          ? h("div", { class: "row" }, h("span", { class: "small" }, "Delete this subject, its map and its progress?"),
              h("button", { class: "primary", type: "button", onclick: () => deleteSubject(s.sid) }, "Delete"),
              h("button", { class: "quiet", type: "button", onclick: () => { ui.confirmDelete = null; render(); } }, "Cancel"))
          : h("div", { class: "row" },
              !here && s.built ? h("button", { class: "primary", type: "button", onclick: () => switchSubject(s.sid) }, "Open") : null,
              here && s.built ? h("button", { class: "quiet", type: "button", onclick: () => setView("map") }, "Open the map") : null,
              !s.built ? h("button", { class: "primary", type: "button", disabled: !aiReady() || (ui.build && ui.build.running), onclick: () => { app.current = s.sid; saveApp(); buildMap(s.sid); } }, "Build the map") : null,
              h("button", { class: "link", type: "button", disabled: ui.build && ui.build.running && ui.build.sid === s.sid, onclick: () => { ui.confirmDelete = s.sid; render(); } }, "Delete")));
    };
    return h("section", { class: "panel" },
      head("Profile · Subjects", list.length ? "Your subjects" : "What do you want to learn, and why?",
        "Name any subject and your goal. An AI builds a knowledge map for you: the topics and points your goal needs, what each builds on, and a suggested route. You choose what to study."),
      job ? (job.running ? buildCard(job) : h("div", { class: "card soft" }, h("p", { class: "msg" }, job.error))) : null,
      list.length ? h("div", { class: "subject-list" }, list.map(card)) : null,
      h("div", { class: "card" },
        h("h3", null, list.length ? "Start another subject" : "Start a subject"),
        h("div", { class: "field" },
          h("label", { for: "subject" }, "Subject"),
          h("input", { type: "text", id: "subject", value: f.name, placeholder: "For example: Python, organic chemistry, Japanese, music theory", oninput: (e) => { f.name = e.target.value; } })),
        h("div", { class: "field" },
          h("label", { for: "goal-text" }, "Your goal"),
          h("textarea", { id: "goal-text", rows: 3, value: f.goal, placeholder: "For example: read research papers in my field, or write scripts that clean up the spreadsheets I get at work.", oninput: (e) => { f.goal = e.target.value; } })),
        h("div", { class: "field" },
          h("label", { for: "situation" }, "Where are you now?", h("span", { class: "hint" }, " Optional: what you've done so far, what feels easy or hard")),
          h("textarea", { id: "situation", rows: 3, value: f.situation, oninput: (e) => { f.situation = e.target.value; } })),
        errLine("subject"),
        h("p", { class: "small muted" }, "Building a map usually takes 6 to 15 AI requests: one to plan, one for each group of topics, one for your route and one to check the whole map. No human source is used, so the map is one AI's view of the subject, checked by a second AI."),
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady() || (ui.build && ui.build.running), onclick: startSubject }, "Build my map"))));
  }

  // ----- your goal -----
  function renderGoal() {
    const s = cur();
    if (!s) return noMapPanel("Profile · Your goal");
    const M = curMap(), job = ui.build && ui.build.sid === s.sid && ui.build.running ? ui.build : null;
    if (ui.goalEdit == null || ui.goalEditFor !== s.sid) { ui.goalEdit = { goal: s.goal, situation: s.situation }; ui.goalEditFor = s.sid; }
    const g = ui.goalEdit, changed = g.goal.trim() !== s.goal || g.situation.trim() !== s.situation;
    const save = () => { s.goal = g.goal.trim(); s.situation = g.situation.trim(); saveSubject(); logEvent("goal", "Goal for " + s.name + ": " + s.goal); notify("Your goal is saved."); render(); };
    return h("section", { class: "panel" },
      head("Profile · Your goal", ai("span", null, s.name), "Your goal decides the map's scope and the red route. Change it here, then update the route, or rebuild the whole map."),
      job ? buildCard(job) : null,
      h("div", { class: "card" },
        h("div", { class: "field" }, h("label", { for: "goal-edit" }, "Your goal"),
          h("textarea", { id: "goal-edit", rows: 3, value: g.goal, oninput: (e) => { g.goal = e.target.value; } })),
        h("div", { class: "field" }, h("label", { for: "sit-edit" }, "Where are you now?", h("span", { class: "hint" }, " Optional")),
          h("textarea", { id: "sit-edit", rows: 3, value: g.situation, oninput: (e) => { g.situation = e.target.value; } })),
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: save }, "Save"))),
      M ? h("div", { class: "card soft" },
        h("h3", null, "Update the route"),
        h("p", { class: "small" }, "Keeps the map and your progress; the router marks the route again for your saved goal. One AI request."),
        h("div", { class: "row" }, h("button", { class: "quiet", type: "button", disabled: !aiReady() || changed || (ui.build && ui.build.running), onclick: () => buildMap(s.sid, "route") }, "Update the route"),
          changed ? h("span", { class: "small muted" }, "Save your goal first.") : null)) : null,
      h("div", { class: "card soft" },
        h("h3", null, M ? "Rebuild the whole map" : "Build the map"),
        M ? h("p", { class: "small" }, "The AI builds a new map from your saved goal. Your progress, lessons, notes and practice on this map won't carry over to the new one.") : h("p", { class: "small" }, "This subject has no map yet."),
        ui.confirmRebuild === s.sid
          ? h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady() || changed, onclick: () => { ui.confirmRebuild = null; buildMap(s.sid); } }, "Rebuild"), h("button", { class: "quiet", type: "button", onclick: () => { ui.confirmRebuild = null; render(); } }, "Cancel"))
          : h("div", { class: "row" }, h("button", { class: "quiet", type: "button", disabled: !aiReady() || changed || (ui.build && ui.build.running), onclick: () => { if (M) { ui.confirmRebuild = s.sid; render(); } else buildMap(s.sid); } }, M ? "Rebuild the map" : "Build the map"),
              changed ? h("span", { class: "small muted" }, "Save your goal first.") : null)));
  }

  // ----- level check: the AI sets a few tasks for this subject and reads the answers -----
  const mapIdList = () => km.data.KD.balls.map((b) => "Topic " + b.name + ":\n" + b.pts.map((p) => "  " + p + " | " + ptName(p)).join("\n")).join("\n");
  const levelTasksPrompt = () => [
    "You set a short level check for a self-learner in Learning Companion, so the tool knows where they are on their knowledge map. It isn't a test they pass or fail.",
    ptLearner(), "", "Their map, every point with its id:", mapIdList(), "",
    "Write as few tasks as can place this learner on the map, from easier to harder, each probing several points. A task is real work in this subject (for a programming language, a small program; otherwise a short problem or a short written answer), small enough to do in a few minutes, and exact about what to produce. Use what you know of where they are to choose the level.",
    MD_NOTE,
    'Reply with only JSON: {"why": "one sentence on how you chose these tasks", "tasks": [{"title": "short", "task": "the task in Markdown", "probes": ["point ids it tests"]}]}',
  ].join("\n");
  const levelAssessPrompt = (tasks, answers, withTasks) => [
    "You assess where a self-learner is on their knowledge map in Learning Companion. Be encouraging and specific, and use only what they gave you. Don't rewrite their answers for them.",
    ptLearner(), "", "Their map, every point with its id:", mapIdList(), "",
    withTasks
      ? tasks.map((t, i) => answers[i] && answers[i].trim() ? ["Task " + (i + 1) + ": " + t.title, t.task, "Points it probes: " + t.probes.join(", "), "Their answer:", answers[i].trim().slice(0, 6000)].join("\n") : "").filter(Boolean).join("\n\n")
      : "They skipped the tasks, so judge from what they said about themselves only, and say that this is a rougher estimate.",
    "", "Mark as solid only points their answers clearly show they can use; mark as shaky points their answers show they struggle with. Points the tasks didn't touch are neither.",
    'Reply with only JSON: {"tasks": [{"n": 1, "result": "works, almost or not yet", "note": "one or two sentences"}], "summary": "one sentence on where they are", "solid": ["point ids"], "shaky": ["point ids"], "feedback": "a short paragraph: what they did well, what to watch, what to study next"}',
  ].join("\n");
  async function pickLevelTasks() {
    const s = cur(); if (!s || !km || !aiReady()) return;
    const job = { requests: 0, cancel: false };
    ui.busy.trialPick = true; ui.errors.trial = null; render();
    try {
      const d = await ask(job, "Level check", levelTasksPrompt(), "default", true);
      const tasks = parr(d && d.tasks).map((t) => ({ title: pstr(t && t.title), task: pstr(t && t.task), probes: parr(t && t.probes).map(pstr).filter((id) => km.data.byId[id]) })).filter((t) => t.title && t.task).slice(0, 8);
      if (!tasks.length) throw { code: "invalid_json", agent: "Level check" };
      s.trialTasks = { why: pstr(d.why), tasks, at: new Date().toISOString() }; s.trial = null; ui.trialAnswers = {};
      saveSubject();
      logEvent("trial", "Level check tasks for " + s.name + ": " + tasks.map((t) => t.title).join("; "));
    } catch (e) { ui.errors.trial = jobError(e); }
    ui.busy.trialPick = false; render();
  }
  async function runLevelCheck(withTasks) {
    const s = cur(); if (!s || !km || !aiReady()) return;
    const tasks = (s.trialTasks && s.trialTasks.tasks) || [];
    const answers = tasks.map((_, i) => ui.trialAnswers[i] || "");
    if (withTasks && !answers.some((a) => a.trim())) { ui.errors.trial = "Answer at least one task first, or skip the tasks."; render(); return; }
    ui.busy.trial = true; ui.errors.trial = null; render();
    try {
      const d = await ask({ requests: 0, cancel: false }, "Level check", levelAssessPrompt(tasks, answers, withTasks), "default", true);
      const ids = (v) => parr(v).map(pstr).filter((id) => km.data.byId[id]);
      const results = {};
      parr(d && d.tasks).forEach((r) => { const n = Number(r && r.n); if (n >= 1 && n <= tasks.length) results[n - 1] = { result: ["works", "almost", "not yet"].includes(pstr(r.result)) ? pstr(r.result) : "almost", note: pstr(r.note) }; });
      s.trial = { summary: pstr(d && d.summary), solid: ids(d && d.solid), shaky: ids(d && d.shaky), feedback: pstr(d && d.feedback) || "No feedback came back.", results, withTasks, at: new Date().toISOString() };
      saveSubject();
      logEvent("trial", "Level check for " + s.name + (withTasks ? "" : " (from description only)") + ": " + s.trial.summary + " Solid: " + s.trial.solid.length + ", shaky: " + s.trial.shaky.length);
      notify("Your level check is read. The feedback is below.");
    } catch (e) { ui.errors.trial = jobError(e); notify("Your level check couldn't be read: " + ui.errors.trial, "bad"); }
    ui.busy.trial = false; render();
  }
  function renderTrial() {
    const s = cur();
    if (!s || !km) return noMapPanel("Profile · Level check");
    const T = s.trialTasks, t = s.trial;
    const RESULT = { works: ["ok", "Works"], almost: ["warn", "Almost"], "not yet": ["bad", "Not yet"] };
    const chips = (ids, cls) => h("div", { class: "chips" }, ids.map((id) => ai("span", { class: "chip " + cls }, ptName(id))));
    const unlearnedSolid = t ? t.solid.filter((id) => !km.isLearned(id)) : [];
    return h("section", { class: "panel" },
      head("Profile · Level check", "Where are you now?", "If you already know some of this subject, an AI sets a few short tasks for it and reads your answers, so you can mark what you know on the map. You don't pass or fail."),
      !T ? h("div", { class: "card" },
        h("p", null, "The AI looks at your map and what you said about yourself, and writes a few tasks from easier to harder."),
        errLine("trial"),
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady() || ui.busy.trialPick, onclick: pickLevelTasks }, ui.busy.trialPick ? "Writing your tasks…" : "Set my level check"),
          h("button", { class: "quiet", type: "button", disabled: !aiReady() || ui.busy.trial, onclick: () => runLevelCheck(false) }, "Skip the tasks: judge from what I said"))) : [
        T.why ? ai("p", { class: "lede" }, T.why) : null,
        T.tasks.map((task, n) => {
          const res = t && t.results && t.results[n], r = res ? (RESULT[res.result] || RESULT.almost) : null;
          return h("article", { class: "card" },
            ai("h3", null, (n + 1) + ". " + task.title),
            h("div", { class: "lesson" }, md(task.task)),
            h("div", { class: "field" }, h("label", { for: "lv-" + n }, "Your answer"),
              h("textarea", { id: "lv-" + n, class: profileOf().run !== "none" ? "code" : "", rows: 6, spellcheck: profileOf().run !== "none" ? "false" : "true", value: ui.trialAnswers[n] || "", oninput: (e) => { ui.trialAnswers[n] = e.target.value; } })),
            r ? h("div", { class: "row" }, h("span", { class: "chip " + r[0] }, r[1]), ai("span", { class: "small" }, res.note)) : null);
        }),
        h("div", { class: "card soft" },
          h("p", { class: "small muted" }, "Answer any of them. One is enough to start; more tell the AI more."),
          errLine("trial"),
          h("div", { class: "row" },
            h("button", { class: "primary", type: "button", disabled: ui.busy.trial || !aiReady(), onclick: () => runLevelCheck(true) }, ui.busy.trial ? "Reading your answers…" : "Get feedback"),
            h("button", { class: "quiet", type: "button", disabled: ui.busy.trial || !aiReady(), onclick: () => runLevelCheck(false) }, "Skip the tasks"),
            h("button", { class: "link", type: "button", disabled: ui.busy.trial || ui.busy.trialPick || !aiReady(), onclick: pickLevelTasks }, ui.busy.trialPick ? "Writing your tasks…" : "Different tasks")))],
      t ? h("div", { class: "card" },
        h("h3", null, "What the check shows"),
        t.summary ? ai("p", null, h("strong", null, t.summary)) : null,
        ai("p", { class: "bubble-text" }, t.feedback),
        t.solid.length ? h("div", { class: "field" }, h("span", { class: "label" }, "Looks solid"), chips(t.solid, "ok")) : null,
        t.shaky.length ? h("div", { class: "field" }, h("span", { class: "label" }, "Needs work"), chips(t.shaky, "warn")) : null,
        caution(t.withTasks ? "This is one AI's reading of your answers. It can be wrong." : "Based on what you told the AI only, so it's a rough estimate. It can be wrong."),
        h("div", { class: "row" },
          unlearnedSolid.length ? h("button", { class: "primary", type: "button", onclick: () => { km.setManyLearned(unlearnedSolid, "Map: marked " + unlearnedSolid.length + " points learned from the level check"); notify(unlearnedSolid.length + " points are marked as learned on your map."); render(); } }, "Mark the " + unlearnedSolid.length + " solid points as learned") : null,
          h("button", { class: unlearnedSolid.length ? "quiet" : "primary", type: "button", onclick: () => setView("map") }, "Open the map"))) : null);
  }

  // ----- AI guidance: three models estimate how far an AI can teach this learner this map -----
  async function runGrade() {
    const s = cur();
    if (!s || !km || !aiReady()) return;
    ui.busy.grade = true; ui.errors.reach = null;
    TIERS.forEach((t) => { ui.tierResults[t.id] = { state: "running" }; });
    render();
    const prompt = [
      "A self-learner will study " + profileOf().name + " for their goal with a knowledge map an AI built for them, without human sources. They pick points themselves; an AI plans and teaches each point, and an AI writes practice sets" + (canRun(profileOf().run) ? ", proven by running them" : ", checked by a second AI because nothing in this subject can be run") + ". The map's topics and points:",
      km.data.KD.balls.map((b, i) => (i + 1) + ". " + b.name + ": " + b.pts.map((x) => ptName(x)).join(", ")).join("\n"),
      ptLearner(), "",
      "Estimate honestly what share (0 to 100) of this material an AI tutor like you can explain well and accurately to this learner, and where they will need other help, such as hands-on practice, a teacher's feedback, a lab, a native speaker, or primary sources.",
      "", "Reply with only a JSON object:",
      '{"share": number, "strong": ["short phrases, only what matters"], "limits": ["short phrases, only what matters"], "statement": "a few sentences, addressed to the learner as you, saying how far you can guide them on this map"}',
    ].join("\n");
    await Promise.all(TIERS.map(async (t) => {
      try {
        const data = await sample.json(prompt, { modelTier: t.id, cache: false });
        const share = Math.max(0, Math.min(100, Math.round(Number(data && data.share))));
        if (!Number.isFinite(share)) throw { code: "invalid_json" };
        ui.tierResults[t.id] = { state: "done", share, strong: parr(data.strong).slice(0, 6).map(String), limits: parr(data.limits).slice(0, 6).map(String), statement: String(data.statement || "") };
      } catch (e) {
        ui.tierResults[t.id] = { state: "error", error: noteAiError(e) };
      }
      render();
    }));
    const done = TIERS.map((t) => ({ tier: t, r: ui.tierResults[t.id] })).filter((x) => x.r && x.r.state === "done");
    if (done.length >= 2) {
      const shares = done.map((x) => x.r.share).sort((a, b) => a - b);
      const mid = shares.length % 2 ? shares[(shares.length - 1) / 2] : Math.round((shares[shares.length / 2 - 1] + shares[shares.length / 2]) / 2);
      const spread = shares[shares.length - 1] - shares[0];
      const agreement = spread <= 15 ? "agree" : spread <= 30 ? "partial" : "disagree";
      const std = done.find((x) => x.tier.id === "default") || done[0];
      s.grade = { share: mid, spread, agreement, statement: std.r.statement, shares: Object.fromEntries(done.map((x) => [x.tier.id, x.r.share])) };
      logEvent("grade", "AI guidance for " + s.name + ": " + mid + "% (" + done.map((x) => x.tier.name + " " + x.r.share + "%").join(", ") + "), " + agreement);
      saveSubject();
    } else {
      ui.errors.reach = "Fewer than two models answered, so there's nothing to cross-check. Try again.";
    }
    ui.busy.grade = false; render();
  }
  function renderReach() {
    const s = cur();
    if (!s || !km) return noMapPanel("Profile · AI guidance");
    const g = s.grade;
    const words = { agree: "The three models agree", partial: "The models partly agree", disagree: "The models disagree" };
    const tierCards = TIERS.map((t) => {
      const r = ui.tierResults[t.id];
      const saved = g && g.shares && g.shares[t.id];
      if (!r && saved === undefined) return h("div", { class: "card soft" }, h("h3", null, t.name), h("p", { class: "muted small" }, "Not asked yet"));
      if (r && r.state === "running") return h("div", { class: "card soft" }, h("h3", null, t.name), h("p", { class: "thinking" }, "Estimating on its own…"));
      if (r && r.state === "error") return h("div", { class: "card soft" }, h("h3", null, t.name), h("p", { class: "msg" }, r.error));
      const share = r ? r.share : saved;
      return h("div", { class: "card soft" },
        h("div", { class: "row spread" }, h("h3", null, t.name), h("span", { class: "share" }, share + "%")),
        h("div", { class: "gauge", role: "img", "aria-label": share + " percent" }, h("span", { style: "width:" + share + "%" })),
        r && r.strong.length ? h("div", { class: "field" }, h("span", { class: "label" }, "Strong at"), ai("ul", { class: "plain small" }, r.strong.map((x) => h("li", null, x)))) : null,
        r && r.limits.length ? h("div", { class: "field" }, h("span", { class: "label" }, "Limits"), ai("ul", { class: "plain small" }, r.limits.map((x) => h("li", null, x)))) : null);
    });
    return h("section", { class: "panel" },
      head("Profile · AI guidance", "How far I can guide you", "Three models estimate, separately, how much of this map an AI can explain well for you, and where you'll need other help. Where they disagree, you'll see it. Lessons and the tutor use this figure."),
      g ? h("div", { class: "verdict " + g.agreement },
        h("div", { class: "row spread" }, h("span", { class: "verdict-title" }, words[g.agreement] + (g.agreement === "agree" ? "" : " (estimates " + g.spread + " points apart)")), h("span", { class: "share" }, g.share + "%")),
        ai("p", null, g.statement),
        caution("These are AI estimates of AI ability, and they can be wrong.")) : null,
      h("div", { class: "row" },
        h("button", { class: g ? "quiet" : "primary", type: "button", disabled: ui.busy.grade || !aiReady(), onclick: runGrade }, ui.busy.grade ? "Asking three models…" : g ? "Ask again" : "Ask the three models"),
        h("span", { class: "muted small" }, "Uses 3 requests on your Claude account")),
      errLine("reach"),
      h("div", { class: "tiers" }, tierCards),
      g ? h("div", { class: "row" }, h("button", { class: "primary", type: "button", onclick: () => go("learn") }, "Start learning")) : null);
  }

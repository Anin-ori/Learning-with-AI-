
  // ---------- Step 5 (v1.1): learn one point ----------
  // The learner picks a point. A planner AI outlines the lesson, a teacher AI writes it, a checker AI checks it,
  // and the teacher fixes what the checker finds (up to PL_ROUNDS times). Only a lesson that passes is shown.
  // Practice comes only from human-written exercises: the planner may pick from them, but no AI writes practice.
  const PL_ROUNDS = 2;
  const ptName = (pid) => km.data.byId[pid].name;
  const plPoint = () => (km && state.learnPoint && km.data.byId[state.learnPoint] ? state.learnPoint : null);
  const ptLearner = () => (state.goal ? learnerLines() : learnerLines().replace("Learner's goal: ", "Learner's goal: Python for machine learning (default, not set yet)"));
  const ptLearned = () => { const xs = km.learnedList().map(ptName); return xs.length ? xs.join(", ") : "none"; };
  function plPick(pid, from) {
    if (!km || !km.data.byId[pid]) return;
    if (state.learnPoint !== pid) { ui.chat = []; ui.chatKey = "pt:" + pid; }
    state.learnPoint = pid;
    saveState();
    logEvent("point", "Chose a point to learn: " + ptName(pid) + (from ? " (from " + from + ")" : ""));
    ensurePointLesson(pid);
  }
  async function ensurePointLesson(pid) {
    if (!pid || ui.plessons[pid] !== undefined) return;
    if (!db) { ui.plessons[pid] = null; return; }
    ui.plessons[pid] = "loading";
    try { const snap = await db.doc("points/" + pid).get(); ui.plessons[pid] = snap.exists && snap.data() && snap.data().v === 1 ? clone(snap.data()) : null; }
    catch (_) { ui.plessons[pid] = null; }
    if (ui.step === "learn" && ui.view !== "map") render();
  }
  function ptCandidates(pid) {
    return (km.data.KD.practice[pid] || []).map((c, i) => ({ n: i + 1, src: c[0], title: c[1], url: c[2], kind: c[3] }));
  }
  function plannerPromptPt(pid, cands) {
    const P = km.data, n = P.byId[pid], ball = P.BALL[P.BALL_OF[pid]];
    const heads = Object.entries(n.src).map(([s, hs]) => "- " + P.SHORT[s] + ": " + hs.map((x) => x[0]).join("; ")).join("\n");
    const akp = P.KD.akp[pid] || [];
    return [
      "You plan a lesson on ONE Python knowledge point for Learning Companion, a study tool for self-learners. Another AI will teach from your plan, so be concrete.",
      "Point: \"" + n.name + "\". It belongs to the topic \"" + ball.name + "\", together with: " + (ball.pts.filter((x) => x !== pid).map(ptName).join(", ") || "nothing else") + ".",
      ptLearner(),
      "Points the learner has marked as learned on their map: " + ptLearned() + ".",
      "This point needs first: " + (n.needs.map((x) => ptName(x) + (km.isLearned(x) ? " (learned)" : " (NOT learned yet)")).join("; ") || "nothing") + ". If something it needs isn't learned yet, plan a short bridge for it at the start.",
      "It leads to: " + (n.usedBy.map(ptName).join(", ") || "nothing else on this map") + ".",
      "How human courses and books title this topic:\n" + (heads || "- (no headings found)"),
      akp.length ? "Key points checked at the source in Automate the Boring Stuff, 3rd edition, for this topic. Cover the ones that belong to this point:\n- " + akp.join("\n- ") : "",
      "You don't have to follow textbook order or methods. Choose whatever gets this learner to real understanding fastest: predicting output before running code, contrasting two near-identical snippets, a mental model, a tiny realistic data task, the classic mistakes. Stay on this one point.",
      "Practice: the lesson ends with practice written by people. From the numbered list below, choose 2 to 4 items that best practise this point, or fewer if few fit. Never invent practice of your own.",
      cands.length ? cands.map((c) => c.n + ". " + km.data.SHORT[c.src] + ": " + c.title + " (" + c.kind + ")").join("\n") : "(No human-written practice is available for this point. Return an empty practice list.)",
      "",
      'Reply with only JSON: {"aim": "one sentence: what the learner can do afterwards", "bridge": ["a short recap of one missing prerequisite idea"], "sections": [{"title": "short heading", "teach": "what to explain and how", "example": "what the code example should show"}], "pitfalls": ["a common mistake to address"], "ml_link": "one sentence on where this shows up in machine-learning work", "practice": [{"n": 1, "why": "what it practises"}]}',
      "Use 2 to 5 sections.",
    ].filter(Boolean).join("\n");
  }
  function normPlan(d, cands) {
    const str = (x) => (typeof x === "string" ? x.trim() : "");
    const arr = (x) => (Array.isArray(x) ? x : []);
    const sections = arr(d && d.sections).map((s) => ({ title: str(s && s.title), teach: str(s && s.teach), example: str(s && s.example) })).filter((s) => s.title && s.teach).slice(0, 6);
    if (!sections.length) throw { code: "invalid_json", agent: "Planner" };
    const seen = new Set();
    const practice = arr(d && d.practice).map((p) => ({ c: cands.find((c) => c.n === Number(p && p.n)), why: str(p && p.why) }))
      .filter((p) => p.c && !seen.has(p.c.n) && seen.add(p.c.n)).slice(0, 4).map((p) => ({ src: p.c.src, title: p.c.title, url: p.c.url, kind: p.c.kind, why: p.why }));
    return { aim: str(d.aim), bridge: arr(d.bridge).map(str).filter(Boolean).slice(0, 3), sections, pitfalls: arr(d.pitfalls).map(str).filter(Boolean).slice(0, 5), ml_link: str(d.ml_link), practice };
  }
  const planText = (p) => [
    "Aim: " + p.aim,
    p.bridge.length ? "Bridge first: " + p.bridge.join("; ") : "",
    ...p.sections.map((s, i) => (i + 1) + ". " + s.title + ". Teach: " + s.teach + (s.example ? " Example: " + s.example : "")),
    p.pitfalls.length ? "Pitfalls to address: " + p.pitfalls.join("; ") : "",
    p.ml_link ? "Machine-learning link: " + p.ml_link : "",
  ].filter(Boolean).join("\n");
  const TEACH_RULES = [
    "- Write for this learner. Remind them of what they already know in one line at most; don't re-teach it.",
    "- Use the plan's sections as ## headings, in order. Start with the bridge if the plan has one.",
    "- Every code example is short, runnable Python 3, and is followed by its exact output in a separate block that starts with the line \"Output:\". Show only output you are sure of.",
    "- Explain why things work, not only what to type. Address the pitfalls.",
    "- Don't write exercises, quizzes, questions to answer or \"try it yourself\" tasks: practice comes from human sources. Don't copy text from any book.",
    "- About 500 to 900 words of Markdown. No title line at the top.",
    "- After the lesson, write a line containing only === NOTES === and then 4 to 7 notes for the learner to keep, one per line starting with \"- \". Each note is one fact, with `code` in backticks and the key **terms** in bold.",
  ].join("\n");
  const teacherPromptPt = (pid, plan) => [
    "You teach ONE Python knowledge point in Learning Companion, following a plan written by a planning AI.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan:", planText(plan), "", "Rules:", TEACH_RULES,
  ].join("\n");
  function splitLesson(text) {
    const parts = String(text).split(/^\s*===\s*NOTES\s*===\s*$/m);
    const notes = (parts[1] || "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")).slice(0, 8);
    return { lesson: parts[0].trim(), notes };
  }
  const checkerPromptPt = (pid, plan, L) => [
    "Check a lesson on ONE Python knowledge point before a self-learner sees it. Be strict about facts and code, lenient about style.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan the lesson should follow:", planText(plan),
    "", "The lesson:", "<<<", L.lesson, ">>>", "", "The notes for the learner:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    "", "Blocking problems (list every one): a factual error; a code example that would fail, or whose stated output is wrong; a plan section that isn't taught; something used but never explained that this learner can't know; an exercise, quiz or practice question written into the lesson; text copied from a book; a wrong note; no notes at all.",
    "Not problems: wording, length, order, extra helpful detail.",
    'Reply with only JSON: {"ok": true or false, "problems": [{"quote": "short exact passage", "problem": "what is wrong", "fix": "what to do"}]}',
  ].join("\n");
  const normProblemsPt = (v) => (Array.isArray(v && v.problems) ? v.problems : [])
    .map((p) => ({ quote: String((p && p.quote) || "").slice(0, 300), problem: String((p && p.problem) || "").trim(), fix: String((p && p.fix) || "").trim() })).filter((p) => p.problem);
  const reviserPromptPt = (pid, plan, L, probs) => [
    "You wrote the lesson below on ONE Python knowledge point. A checker found problems. Fix every one and change nothing else.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(),
    "", "The plan:", planText(plan),
    "", "Problems to fix:", probs.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n"),
    "", "Your lesson:", "<<<", L.lesson, ">>>", "", "Your notes:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    "", "Rules:", TEACH_RULES, "", "Reply with the whole corrected lesson, then the === NOTES === line and the notes.",
  ].join("\n");

  async function buildPointLesson(pid) {
    if (!pid || !aiReady() || (ui.pjobs[pid] && ui.pjobs[pid].running)) return;
    const job = { id: "pt:" + pid, requests: 0, cancel: false, running: true, stage: "plan", rounds: 0, problems: [], error: null };
    ui.pjobs[pid] = job; render();
    const cands = ptCandidates(pid);
    const paint = () => { if (ui.step === "learn" && ui.view !== "map") render(); };
    try {
      job.plan = normPlan(await ask(job, "Planner", plannerPromptPt(pid, cands), "default", true), cands);
      job.stage = "teach"; paint();
      let L = splitLesson(await ask(job, "Teacher", teacherPromptPt(pid, job.plan), "default", false));
      for (let round = 0; ; round++) {
        job.stage = "check"; paint();
        const probs = normProblemsPt(await ask(job, "Checker", checkerPromptPt(pid, job.plan, L), "complex", true));
        if (!probs.length && L.notes.length) { job.problems = []; break; }
        if (!L.notes.length && !probs.length) probs.push({ quote: "", problem: "The notes are missing.", fix: "Add the === NOTES === line and 4 to 7 notes." });
        job.problems = probs;
        if (round >= PL_ROUNDS) throw { code: "not_compliant", agent: "Checker" };
        job.stage = "fix"; job.rounds++; paint();
        L = splitLesson(await ask(job, "Teacher", reviserPromptPt(pid, job.plan, L, probs), "default", false));
      }
      const doc = { v: 1, pid, at: new Date().toISOString(), plan: job.plan, lesson: L.lesson, notes: L.notes, requests: job.requests, rounds: job.rounds };
      ui.plessons[pid] = doc;
      if (!state.pointIndex) state.pointIndex = {};
      state.pointIndex[pid] = { at: doc.at, notes: doc.notes, practice: doc.plan.practice };
      if (db) db.doc("points/" + pid).set(clone(doc)).catch(() => notify("The lesson is shown but couldn't be saved.", "warn"));
      saveState();
      job.stage = "done";
      logEvent("lesson", "Point lesson delivered: " + ptName(pid) + " (" + job.requests + " requests, " + job.rounds + " fix rounds)");
      notify("Your lesson on " + ptName(pid) + " is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The checker still found problems after " + PL_ROUNDS + " rounds of fixes, so the lesson wasn't shown. Try again."
        : e && e.code === "cancelled" ? "Stopped." : (e && e.agent ? e.agent + ": " : "") + noteAiError(e);
      logEvent("lesson", "Point lesson not delivered: " + ptName(pid) + ". " + job.error);
      if (!(e && e.code === "cancelled")) notify("The lesson wasn't finished. " + job.error, "bad");
    } finally {
      job.running = false; paint();
    }
  }

  function pointTutorRules(pid) {
    const L = ui.plessons[pid];
    return [
      "You are the tutor in Learning Companion, a study tool for self-learners. Follow these rules:",
      "- The learner is studying the Python point \"" + ptName(pid) + "\".",
      L && L.lesson ? "- The lesson written for them:\n\"\"\"\n" + L.lesson.slice(0, 9000) + "\n\"\"\"\nStay consistent with it, and correct it plainly if you find a mistake in it." : "- No lesson has been built for this point yet.",
      "- Explain clearly and concretely, with short Python examples the learner can run themselves.",
      "- Never invent practice questions or exercises. For practice, point them to the human-written practice listed under the lesson. If they paste an exercise, help with it directly.",
      "- If you're unsure about something, say so plainly. Keep answers under 250 words unless the learner asks for more.",
      "- " + ptLearner().replace(/\n/g, "\n- "),
      "", "Reply to the learner's messages that follow.",
    ].join("\n");
  }
  async function sendPointChat() {
    const pid = plPoint();
    const text = ui.chatInput.trim();
    if (!pid || !text || !aiReady() || ui.busy.chat) return;
    ui.chatInput = "";
    ui.chat.push({ role: "user", content: text });
    const msg = { role: "assistant", content: "", question: text, pending: true, check: null };
    ui.chat.push(msg);
    const idx = ui.chat.length - 1;
    ui.busy.chat = true; render();
    const turns = [{ role: "user", content: pointTutorRules(pid) }];
    ui.chat.slice(-13, -1).forEach((m) => { if (m.content && !m.failed) turns.push({ role: m.role, content: m.content }); });
    try {
      const res = await sample(turns, { modelTier: "default", cache: false, onText: ({ text: t }) => { msg.content = t; const el = $("bubble-" + idx); if (el) el.textContent = t; } });
      msg.content = res.text; msg.truncated = res.truncated;
      logEvent("chat", "Asked the tutor about " + ptName(pid) + ": " + text.slice(0, 160));
    } catch (e) {
      msg.failed = true; msg.content = (e && e.text) || ""; msg.error = noteAiError(e);
    } finally {
      msg.pending = false; ui.busy.chat = false; render();
      const box = $("chat-box"); if (box) box.scrollTop = box.scrollHeight;
    }
  }

  const PT_STATUS = { learned: "learned", ready: "can learn now", locked: "not reachable yet" };
  const PT_STAGES = [["plan", "Planner", "outlines the lesson for you"], ["teach", "Teacher", "writes it from the outline"], ["check", "Checker", "checks facts, code and outputs"]];
  function ptTeamCard(job) {
    const order = { plan: 0, teach: 1, check: 2, fix: 2, done: 3, error: -1 };
    const at = order[job.stage];
    return h("div", { class: "card", id: "pt-team", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your lesson"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, PT_STAGES.map(([id, who, what], i) => h("li", null,
        h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · fixed and rechecked " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "The checker found " + job.problems.length + " problem" + (job.problems.length === 1 ? "" : "s") + "; the teacher is fixing them.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  function renderPointLearn() {
    const lede = "Pick one knowledge point. One AI plans how to teach it to you, another teaches it, and a third checks the lesson before you see it. Practice comes only from exercises written by people.";
    if (!km) return h("section", { class: "panel" }, head("Step 5", "Learn a point", "The knowledge map couldn't load, so points can't be chosen here."));
    const P = km.data, pid = plPoint();
    if (pid && ui.plessons[pid] === undefined) setTimeout(() => ensurePointLesson(pid), 0);
    if (ui.chatKey !== "pt:" + pid) { ui.chat = []; ui.chatKey = "pt:" + pid; }
    const picks = km.topPoints().slice(0, 6);
    const n = pid ? P.byId[pid] : null;
    const st = pid ? km.status(pid) : null;
    const missing = n ? n.needs.filter((x) => !km.isLearned(x)) : [];

    const picker = h("div", { class: "card" },
      h("div", { class: "field" },
        h("label", { for: "pt-select" }, "Point to learn"),
        h("select", { id: "pt-select", onchange: (e) => { if (e.target.value) { plPick(e.target.value, "the list"); render(); } } },
          h("option", { value: "" }, "Choose a point…"),
          P.KD.balls.map((b) => h("optgroup", { label: b.name }, b.pts.map((x) => h("option", { value: x, selected: x === pid ? true : null }, P.byId[x].name + " · " + PT_STATUS[km.status(x)])))))),
      picks.length ? h("div", { class: "field" }, h("span", { class: "label small muted" }, "AI's top picks right now"),
        h("div", { class: "chips" }, picks.map((x) => h("button", { class: x === pid ? "chip accent" : "chip", type: "button", onclick: () => { plPick(x, "top picks"); render(); } }, P.byId[x].name)))) : null,
      n ? h("p", { class: "small" },
        h("strong", null, P.BALL[P.BALL_OF[pid]].name), " · " + PT_STATUS[st] + (km.onRoute(pid) ? " · on the suggested route" : ""),
        missing.length ? h("span", { class: "muted" }, " · not learned yet: " + missing.map(ptName).join(", ") + ". The lesson will bridge these briefly.") : null) : null,
      h("div", { class: "row" }, h("button", { class: "link", type: "button", onclick: () => { setView("map"); if (pid) km.openPoint(pid); } }, pid ? "Show this point on the map" : "Choose on the knowledge map")));

    const L = pid ? ui.plessons[pid] : null, job = pid ? ui.pjobs[pid] : null;
    const cost = h("p", { class: "small muted" }, "Usually 3 to 5 AI requests: one to plan, one to teach, one or more to check and fix.");
    let body;
    if (!pid) body = [h("div", { class: "card soft" }, h("p", null, "Choose a point above, or open a ball on the knowledge map and use “Learn this point”."))];
    else if (job && job.running) body = [ptTeamCard(job)];
    else if (L === "loading") body = [h("p", { class: "thinking" }, "Loading your lesson…")];
    else if (L && L.lesson) {
      const cands = ptCandidates(pid), picked = new Set(L.plan.practice.map((p) => p.url + "|" + p.title));
      const others = cands.filter((c) => !picked.has(c.url + "|" + c.title));
      body = [
        h("details", { class: "card soft" }, h("summary", null, "How the planner set up this lesson"),
          L.plan.aim ? h("p", { class: "small" }, h("strong", null, "Aim: "), L.plan.aim) : null,
          h("ol", { class: "plain small" }, L.plan.sections.map((s) => h("li", null, h("strong", null, s.title), ". ", s.teach))),
          L.plan.ml_link ? h("p", { class: "small" }, h("strong", null, "In machine learning: "), L.plan.ml_link) : null,
          h("p", { class: "small muted" }, "Planned, taught and checked by AI in " + L.requests + " requests" + (L.rounds ? ", with " + L.rounds + " round" + (L.rounds > 1 ? "s" : "") + " of fixes" : "") + ".")),
        h("article", { class: "card lesson-card" }, h("div", { class: "lesson" }, md(L.lesson))),
        h("div", { class: "card practice" },
          h("h3", null, "Practice, written by people"),
          h("p", { class: "small muted" }, "The planner picked these from human-written exercises. No AI writes practice questions here."),
          L.plan.practice.length ? h("ul", { class: "plain" }, L.plan.practice.map((p) => h("li", null, extLink(p.url, P.SHORT[p.src] + ": " + p.title + " ↗"), p.why ? h("span", { class: "muted small" }, " · " + p.why) : null)))
            : h("p", { class: "small" }, cands.length ? "None of the human-written exercises fit this point closely." : "No human-written practice was found for this point yet."),
          others.length ? h("details", null, h("summary", { class: "small" }, "More human-written practice (" + others.length + ")"),
            h("ul", { class: "plain small" }, others.map((c) => h("li", null, extLink(c.url, P.SHORT[c.src] + ": " + c.title), h("span", { class: "muted" }, " · " + c.kind))))) : null),
        h("div", { class: "row" },
          km.isLearned(pid)
            ? h("button", { class: "quiet", type: "button", onclick: () => { km.setLearned(pid, false); render(); } }, "Mark as not learned")
            : h("button", { class: "primary", type: "button", onclick: () => { km.setLearned(pid, true); notify(ptName(pid) + " is marked as learned on your map."); render(); } }, "Mark as learned"),
          h("button", { class: "quiet", type: "button", onclick: () => go("check") }, "My notes"),
          h("button", { class: "quiet", type: "button", disabled: !aiReady(), onclick: () => buildPointLesson(pid) }, "Rebuild this lesson")),
      ];
    } else {
      body = [h("div", { class: "card" },
        h("h3", null, "Teach me “" + n.name + "”"),
        h("p", { class: "small" }, "The planner sees what you've marked as learned, what this point needs, how 13 human sources title it and, where available, the key points checked in Automate the Boring Stuff."),
        cost,
        job && job.stage === "error" ? h("p", { class: "msg" }, job.error) : null,
        job && job.stage === "error" && job.problems.length ? h("details", null, h("summary", { class: "small" }, "What the checker still found"), h("ul", { class: "plain small" }, job.problems.map((p) => h("li", null, p.problem)))) : null,
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady(), onclick: () => buildPointLesson(pid) }, job && job.stage === "error" ? "Try again" : "Teach me this point")))];
    }

    const tutor = h("aside", { class: "card tutor", "aria-label": "Questions about this point" },
      h("h3", null, "Ask about this point"),
      ui.chat.length ? h("div", { class: "chat", id: "chat-box", "aria-live": "polite" }, ui.chat.map(renderBubble))
        : h("p", { class: "muted small" }, pid ? "Ask about anything in the lesson, or paste a practice exercise with your attempt." : "Choose a point first."),
      h("div", { class: "field" }, h("label", { for: "chat-input", class: "small" }, "Your message"),
        h("textarea", { id: "chat-input", rows: 3, value: ui.chatInput, placeholder: "For example: why does this print None?", oninput: (e) => { ui.chatInput = e.target.value; }, onkeydown: (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendPointChat(); } } })),
      h("div", { class: "row spread" }, h("span", { class: "muted small" }, "Ctrl or Cmd + Enter"),
        h("button", { class: "primary", type: "button", disabled: ui.busy.chat || !aiReady() || !pid, onclick: sendPointChat }, ui.busy.chat ? "Answering…" : "Send")));

    return h("section", { class: "panel" },
      head("Step 5", n ? n.name : "Learn a point", lede),
      h("div", { class: "learn" }, h("div", { class: "panel reading-col" }, picker, ...body), tutor));
  }

  // ---------- Step 6 (v1.1): notes for the points you've studied ----------
  function ptNotesText() {
    const P = km.data, idx = state.pointIndex || {}, out = ["My Python notes", ""];
    P.KD.balls.forEach((b) => {
      const pts = b.pts.filter((p) => idx[p]); if (!pts.length) return;
      out.push(b.name);
      pts.forEach((p) => { out.push("  " + ptName(p)); (idx[p].notes || []).forEach((x) => out.push("   - " + plainNote(x))); });
      out.push("");
    });
    return out.join("\n");
  }
  function renderPointNotes() {
    if (!km) return h("section", { class: "panel" }, head("Step 6", "Your notes", "The knowledge map couldn't load."));
    const P = km.data, idx = state.pointIndex || {};
    const pids = Object.keys(idx).filter((p) => P.byId[p]);
    if (!pids.length) return h("section", { class: "panel" }, head("Step 6 · Level 1", "Your notes", "Notes appear here after your first lesson on a point."),
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
      h("div", { class: "note-head" }, h("h3", null, b.name), h("span", { class: "muted small" }, b.pts.filter((p) => km.isLearned(p)).length + " of " + b.pts.length + " learned")),
      b.pts.filter((p) => idx[p]).map((p) => h("div", { class: "pt-note" },
        h("div", { class: "note-head" },
          h("h4", null, ptName(p), " ", h("span", { class: km.isLearned(p) ? "chip ok" : "chip" }, km.isLearned(p) ? "learned" : PT_STATUS[km.status(p)])),
          h("button", { class: "link small", type: "button", onclick: () => { plPick(p, "notes"); go("learn"); } }, "Lesson")),
        (idx[p].notes || []).length ? h("ul", { class: "note-points" }, idx[p].notes.map((x, j) => h("li", null, noteInline(x, hide, p + "-" + j)))) : h("p", { class: "small muted" }, "No notes came with this lesson."),
        (idx[p].practice || []).length ? h("p", { class: "small" }, "Practice: ", ...idx[p].practice.flatMap((q, j) => [j ? " · " : "", extLink(q.url, P.SHORT[q.src] + ": " + q.title)])) : null))));
    return h("section", { class: "panel" },
      head("Step 6 · Level 1", "Your notes", "The notes from each point you've studied, grouped by big ball. To test yourself, hide the key terms and recall each one before you click it."),
      toolbar,
      h("div", { class: "card notes", id: "notes-body" }, sections),
      h("p", { class: "small muted" }, "Written by the teaching AI with each lesson and checked with it. The practice links are exercises written by people."),
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", onclick: () => go("learn") }, "Learn another point"),
        h("button", { class: "quiet", type: "button", onclick: () => setView("map") }, "Open the knowledge map")),
      laterLevels());
  }

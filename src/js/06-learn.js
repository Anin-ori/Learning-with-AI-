  // ---------- Learn one point (v1.1; v2.0: any subject) ----------
  // The learner picks a point. A planner AI outlines the lesson, a teacher AI writes it, a checker AI edits it: errors
  // block delivery until fixed (up to PL_ROUNDS times), improvements go back once. Practice has its own section.
  const PL_ROUNDS = 2;
  const ptName = (pid) => (km && km.data.byId[pid] ? km.data.byId[pid].name : pid);
  // v2.1: prompts always use the map's original (English) names; the learner sees the translated ones
  let enCache = null;
  function EN() {
    const M = curMap();
    if (!M) return { n: {}, b: {}, M: null };
    if (!enCache || enCache.M !== M) enCache = { M, n: Object.fromEntries(M.nodes.map((x) => [x.id, x])), b: Object.fromEntries(M.balls.map((x) => [x.id, x])) };
    return enCache;
  }
  const enName = (pid) => (EN().n[pid] || {}).name || ptName(pid);
  const enWhat = (pid) => (EN().n[pid] || {}).what || "";
  const enBall = (bid) => EN().b[bid] || (km && km.data.BALL[bid]) || { name: bid, pts: [] };
  const plPoint = () => { const s = cur(); return km && s && s.learnPoint && km.data.byId[s.learnPoint] ? s.learnPoint : null; };
  const lessonKey = (pid) => { const M = curMap(); return (M && M.mid ? M.mid : "m") + "_" + pid; };
  function ptLearner() {
    const s = cur() || {};
    return [
      "Subject: " + (s.name || ""),
      "Learner's goal: " + (s.goal || "(not given)"),
      s.situation ? "Where they were when they started, in their own words: " + s.situation.slice(0, 600) : "",
      s.trial && s.trial.summary ? "What their level check showed: " + s.trial.summary : "",
      s.grade ? "AI involvement agreed for this learner: about " + s.grade.share + "% (the higher, the more the AI explains itself; the lower, the more it points to other sources and help)." : "",
    ].filter(Boolean).join("\n");
  }
  const ptLearned = () => { const xs = km.learnedList().map(enName); return xs.length ? xs.join(", ") : "none"; };
  function plPick(pid, from) {
    const s = cur();
    if (!km || !s || !km.data.byId[pid]) return;
    if (s.learnPoint !== pid) { ui.chat = []; ui.chatKey = null; }
    s.learnPoint = pid;
    saveSubject();
    logEvent("point", "Chose a point to learn: " + ptName(pid) + (from ? " (from " + from + ")" : ""));
    ensurePointLesson(pid);
  }
  async function ensurePointLesson(pid) {
    const key = lessonKey(pid);
    if (!pid || ui.plessons[key] !== undefined) return;
    if (!db) { ui.plessons[key] = null; return; }
    ui.plessons[key] = "loading";
    try { const snap = await db.doc("lessons2/" + key).get(); ui.plessons[key] = snap.exists && snap.data() && snap.data().v === 2 ? clone(snap.data()) : null; }
    catch (_) { ui.plessons[key] = null; }
    if (ui.step === "learn" && ui.view !== "map") render();
  }
  const lessonOf = (pid) => ui.plessons[lessonKey(pid)];

  function exampleRule(S) {
    return S.run !== "none"
      ? "- Every code example is short, runnable " + RUNNERS[S.run] + ", and is followed by its exact output in a separate block that starts with the line \"Output:\". Show only output you are sure of."
      : "- Examples: " + S.examples + " Where an example has a definite result, show it, and be sure it is right.";
  }
  function plannerPromptPt(pid) {
    const P = km.data, n = P.byId[pid], ball = enBall(P.BALL_OF[pid]), S = profileOf(), M = curMap();
    return [
      "You plan a lesson on ONE knowledge point of " + S.name + " for Learning Companion, a study tool for self-learners. Another AI will write it from your plan. You decide the approach, the structure and the examples: choose whatever gets this learner to real understanding fastest.",
      "Point: \"" + enName(pid) + "\"" + (enWhat(pid) ? ": " + enWhat(pid) : "") + ".",
      "It belongs to the topic \"" + ball.name + "\"" + (ball.desc ? " (" + ball.desc + ")" : "") + ", together with: " + (ball.pts.filter((x) => x !== pid).map(enName).join(", ") || "nothing else") + ".",
      ptLearner(),
      "Points the learner has marked as learned on their map: " + ptLearned() + ".",
      "This point needs first: " + (n.needs.map((x) => enName(x) + (km.isLearned(x) ? " (learned)" : " (NOT learned yet)")).join("; ") || "nothing") + ". If something it needs isn't learned yet, plan a short bridge for it at the start.",
      "It leads to: " + (n.usedBy.map(enName).join(", ") || "nothing else on this map") + ".",
      "Topics on this map, from basics to advanced: " + (M ? M.balls : P.KD.balls).map((b) => b.name).join(", ") + ".",
      (ball.where || []).length ? "Where the AI that built the map said this topic is taught (from memory, unchecked): " + ball.where.map((w) => w.title + (w.detail ? ", " + w.detail : "")).join("; ") + "." : "",
      "", STANDARDS.guide(S), "", "How examples look in this subject: " + S.examples, MD_NOTE, "",
      'Reply with only JSON: {"aim": "one sentence: what the learner can do afterwards", "approach": "two or three sentences: how you will get this learner to real understanding, and why this way", "bridge": ["a short recap of a missing prerequisite, if any"], "sections": [{"title": "short heading", "teach": "what to explain and how", "example": "what the example should show"}], "beyond": "what lies beyond this lesson that is worth the learner knowing (where its rules stop holding, a mechanism underneath), and which of these deserve a proper extension after the lesson; empty if nothing", "goal_link": "one sentence on where this shows up in the learner\'s goal"}',
    ].filter((x) => x !== "").join("\n");
  }
  function normPlan(d) {
    const sections = parr(d && d.sections).map((s) => ({ title: pstr(s && s.title), teach: pstr(s && s.teach), example: pstr(s && s.example) })).filter((s) => s.title && s.teach).slice(0, 20);
    if (!sections.length) throw { code: "invalid_json", agent: "Planner" };
    return { aim: pstr(d.aim), approach: pstr(d.approach), bridge: parr(d.bridge).map(pstr).filter(Boolean).slice(0, 5), sections, beyond: pstr(d.beyond), goal_link: pstr(d.goal_link || d.ml_link) };
  }
  const planText = (p) => [
    "Aim: " + p.aim,
    p.approach ? "Approach: " + p.approach : "",
    p.bridge.length ? "Bridge first: " + p.bridge.join("; ") : "",
    ...p.sections.map((s, i) => (i + 1) + ". " + s.title + ". Teach: " + s.teach + (s.example ? " Example: " + s.example : "")),
    p.beyond ? "Beyond this lesson: " + p.beyond : "",
    p.goal_link ? "Link to the learner's goal: " + p.goal_link : "",
  ].filter(Boolean).join("\n");
  const teachRules = (S) => [
    "- Write for this learner. Remind them of what they already know in one line at most; don't re-teach it.",
    "- The plan is a starting point. Follow its approach, and improve on it wherever you see a better way to teach this learner.",
    "- Use ## headings for the sections. Start with the bridge if the plan has one.",
    exampleRule(S),
    S.run === "python" ? "- The page runs every Python example in the lesson, in order, as one session, and checks its output; the extensions after === DEEPER === run as a separate session, so they import and define what they use. Where a claim rests on values computed step by step, show them with code that prints them rather than working them out in prose." : "",
    "- A predict-then-see moment, with the answer right after it, is welcome. Don't write exercises, quizzes or \"try it yourself\" tasks: practice has its own section. Don't copy text from any book.",
    "- As long as this point needs for real understanding and no longer: cut what doesn't serve understanding, keep what does. Markdown, no title line at the top. " + MD_NOTE,
    "- Extensions, if you write any, go after the lesson, after a line containing only === DEEPER ===, each under a ### heading.",
    "- Then write a line containing only === NOTES === and the notes for the learner to keep, one per line starting with \"- \": each note is one fact worth remembering from this lesson, with `code` or exact notation in backticks and the key **terms** in bold. Write as many as the lesson has such facts, no padding.",
  ].filter(Boolean).join("\n");
  const teacherPromptPt = (pid, plan) => { const S = profileOf(); return [
    "You write a lesson on ONE knowledge point of " + S.name + " in Learning Companion, from a plan by a planning AI.",
    "Point: \"" + enName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan:", planText(plan), "", STANDARDS.guide(S), "", "Format:", teachRules(S),
  ].join("\n"); };
  function splitLesson(text) {
    const parts = String(text).split(/^\s*===\s*NOTES\s*===\s*$/m);
    const notes = (parts[1] || "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")).slice(0, 40);
    const [lesson, deeper] = parts[0].split(/^\s*===\s*DEEPER\s*===\s*$/m);
    return { lesson: lesson.trim(), deeper: (deeper || "").trim(), notes };
  }
  const checkerPromptPt = (pid, plan, L, run) => { const S = profileOf(); return [
    "You review a lesson on ONE knowledge point of " + S.name + " before a self-learner sees it. You are an editor, not a gatekeeper: be strict about facts" + (S.run !== "none" ? " and code" : "") + ", and constructive about the teaching. No textbook stands behind this lesson, so you are the check on what its writer got wrong.",
    "Point: \"" + enName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan it was written from:", planText(plan),
    "", "The lesson:", "<<<", L.lesson, ">>>", "", "Extensions after the lesson:", L.deeper || "(none)", "", "The notes for the learner:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    run && run.note ? "\n" + run.note + "\nTrust these results over your own reading of the code. Anything they show to be wrong is already listed as an error, so you needn't repeat it." : "",
    "", STANDARDS.guide(S), "",
    "Errors, which must be fixed before the learner sees the lesson: a factual error; " + (S.run !== "none" ? "a code example that would fail, or whose stated output is wrong; " : "an example whose stated result is wrong; ") + "a claim stated as settled that experts dispute; text copied from a book; an exercise, quiz or practice task written into the lesson (a predict-then-see moment with its answer right after is fine); a wrong note; no notes at all. List every error you find.",
    "Improvements: the places where the lesson falls short of the teaching standards in a way that matters for this learner's understanding, the most important first. Only what matters: no padding. Wording, length and order are not improvements unless they get in the way of understanding.",
    'Reply with only JSON: {"errors": [{"quote": "short exact passage", "problem": "what is wrong", "fix": "what to do"}], "improvements": [{"quote": "short exact passage", "problem": "what falls short", "fix": "how to make it better"}]}',
  ].join("\n"); };
  const normItems = (v) => parr(v).map((p) => ({ quote: String((p && p.quote) || "").slice(0, 300), problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  const normReview = (v) => ({ errors: normItems(v && (v.errors || v.problems)), improvements: normItems(v && v.improvements).slice(0, 12) });
  const reviserPromptPt = (pid, plan, L, errs, imps) => { const S = profileOf(); return [
    "You wrote the lesson below on ONE knowledge point of " + S.name + ". An editor reviewed it.",
    errs.length ? "Fix every error." : "",
    imps.length ? "Consider each suggested improvement and make it where it helps this learner; you may leave one out if you think the lesson is better without it." : "",
    "Change nothing else.",
    "Point: \"" + enName(pid) + "\".", ptLearner(),
    "", "The plan:", planText(plan),
    errs.length ? "\nErrors:\n" + errs.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n") : "",
    imps.length ? "\nSuggested improvements:\n" + imps.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Suggestion: " + p.fix : "")).join("\n") : "",
    "", "Your lesson:", "<<<", L.lesson, ">>>", "", "Your extensions:", L.deeper || "(none)", "", "Your notes:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    "", STANDARDS.guide(S), "", "Format:", teachRules(S), "", "Reply with the whole lesson, then the === DEEPER === line and the extensions if there are any, then the === NOTES === line and the notes.",
  ].filter((x) => x !== "").join("\n"); };

  async function buildPointLesson(pid) {
    const key = lessonKey(pid);
    if (!pid || !aiReady() || (ui.pjobs[key] && ui.pjobs[key].running)) return;
    const job = { id: "pt:" + key, requests: 0, cancel: false, running: true, stage: "plan", rounds: 0, problems: [], error: null };
    const paint = () => { if (ui.step === "learn" && ui.view !== "map") render(); };
    job.paint = paint;
    ui.pjobs[key] = job; render();
    try {
      job.plan = normPlan(await ask(job, "Planner", plannerPromptPt(pid), "default", true));
      job.stage = "teach"; paint();
      let L = splitLesson(await ask(job, "Teacher", teacherPromptPt(pid, job.plan), "default", false));
      let polished = false;
      job.advice = [];
      for (let round = 0; ; round++) {
        job.stage = "check"; paint();
        const run = profileOf().run === "python" ? await runLessonExamples(L).catch(() => null) : null;
        const rv = normReview(await ask(job, "Checker", checkerPromptPt(pid, job.plan, L, run), "complex", true));
        if (run && run.errs.length) rv.errors = run.errs.concat(rv.errors);
        job.ran = run && run.ran ? { n: run.n, of: run.of } : null;
        if (!L.notes.length) rv.errors.push({ quote: "", problem: "The notes are missing.", fix: "Add the === NOTES === line and the notes worth keeping." });
        const imps = polished ? [] : rv.improvements;
        job.advice = rv.improvements;
        job.problems = rv.errors.concat(imps);
        if (!rv.errors.length && !imps.length) break;
        if (rv.errors.length && round >= PL_ROUNDS) throw { code: "not_compliant", agent: "Checker" };
        job.stage = "fix"; job.rounds++; paint();
        L = splitLesson(await ask(job, "Teacher", reviserPromptPt(pid, job.plan, L, rv.errors, imps), "default", false));
        if (imps.length) polished = true;
      }
      const doc = { v: 2, src: "en", pid, key, at: new Date().toISOString(), plan: job.plan, lesson: L.lesson, deeper: L.deeper || "", notes: L.notes, advice: job.advice || [], requests: job.requests, rounds: job.rounds, ran: job.ran };
      if (trLang()) {
        job.stage = "translate"; paint();
        try { await translateLesson(doc, job); }
        catch (e) { if (e && e.code === "cancelled") throw e; notify("The lesson is ready, but it couldn't be translated, so it's shown in English. You can translate it again.", "warn"); }
      }
      doc.requests = job.requests;
      ui.plessons[key] = doc;
      const s = cur();
      s.pointIndex[pid] = { at: doc.at, notes: doc.notes, src: "en", tr: doc.tr ? { [trLang()]: doc.tr[trLang()].notes } : undefined };
      if (db) db.doc("lessons2/" + key).set(clone(doc)).catch(() => notify("The lesson is shown but couldn't be saved.", "warn"));
      saveSubject();
      job.stage = "done";
      logEvent("lesson", "Point lesson delivered: " + ptName(pid) + " (" + job.requests + " requests, " + job.rounds + " fix rounds)");
      notify("Your lesson on " + ptName(pid) + " is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The checker still found problems after " + PL_ROUNDS + " rounds of fixes, so the lesson wasn't shown. Try again." : jobError(e);
      logEvent("lesson", "Point lesson not delivered: " + ptName(pid) + ". " + job.error);
      if (!(e && e.code === "cancelled")) notify("The lesson wasn't finished. " + job.error, "bad");
    } finally {
      job.running = false; paint();
    }
  }

  async function translateLesson(doc, job) {
    const L = curLang(), T = {};
    await trPairs(job, lessonPairs(doc, T), subjectAbout("a lesson on one point, with its plan, extensions and notes"), srcOf(doc));
    doc.tr = Object.assign({}, doc.tr, { [L]: T });
  }
  function lessonTrFn(pid) {
    const doc = lessonOf(pid), key = lessonKey(pid);
    return async (job) => {
      await translateLesson(doc, job);
      const s = cur(), L = curLang();
      if (s.pointIndex[pid] && srcOf(s.pointIndex[pid]) === srcOf(doc)) { s.pointIndex[pid].tr = Object.assign({}, s.pointIndex[pid].tr, { [L]: doc.tr[L].notes }); saveSubject(); }
      if (db) await db.doc("lessons2/" + key).set(clone(doc));
    };
  }

  // ---------- The tutor: questions are kept with their point ----------
  function pointTutorRules(pid) {
    const L = lessonOf(pid), S = profileOf();
    return [
      "You are the tutor in Learning Companion, a study tool for self-learners. Follow these rules:",
      "- The learner is studying the point \"" + ptName(pid) + "\" in " + S.name + ".",
      L && L.lesson ? "- The lesson written for them:\n\"\"\"\n" + L.lesson.slice(0, 9000) + "\n\"\"\"\nStay consistent with it, and correct it plainly if you find a mistake in it." : "- No lesson has been built for this point yet.",
      "- Explain clearly and concretely. " + (S.run !== "none" ? "Use short " + RUNNERS[S.run] + " examples the learner can run themselves." : "Use concrete examples."),
      "- Don't set exercises in the chat. For practice, point them to the Practice section. If they paste an exercise, help with it directly.",
      "- If you're unsure about something, say so plainly. Answer as briefly as the question allows, and go longer when the question needs it or the learner asks.",
      "- When you point out a mistake, explain the mechanism behind it. Don't list mistakes, and never call a mistake common or classic.",
      "- When the learner asks how something works, go underneath: the steps actually taken and how they can observe them. Be exact about what you know and say plainly where your certainty ends.",
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
      const res = await sampleChat(turns, { modelTier: "default", cache: false, onText: ({ text: t }) => { msg.content = t; const el = $("bubble-" + idx); if (el) el.textContent = t; } });
      msg.content = res.text; msg.truncated = res.truncated;
      logEvent("chat", "Asked the tutor about " + ptName(pid) + ": " + text.slice(0, 160));
      ui.qa[pid] = qaOf(pid).filter((it) => it.a || it.q !== text).concat([{ q: text, a: res.text, at: new Date().toISOString() }]);
      saveQa();
    } catch (e) {
      msg.failed = true; msg.content = (e && e.text) || ""; msg.error = noteAiError(e);
    } finally {
      msg.pending = false; ui.busy.chat = false; render();
      const box = $("chat-box"); if (box) box.scrollTop = box.scrollHeight;
    }
  }
  async function crossCheck(idx) {
    const msg = ui.chat[idx];
    if (!msg || !aiReady()) return;
    msg.check = { state: "running" }; render();
    const prompt = "A learner studying " + profileOf().name + " asked the question below. Answer it independently and briefly.\n\nQuestion:\n" + msg.question;
    const others = [TIERS[0], TIERS[2]];
    const settled = await Promise.allSettled(others.map((t) => sampleChat(prompt, { modelTier: t.id, cache: false })));
    const answers = [{ name: "Standard (the tutor)", text: msg.content }];
    settled.forEach((s, i) => { if (s.status === "fulfilled") answers.push({ name: others[i].name, text: s.value.text }); });
    if (answers.length < 2) { msg.check = { state: "error", error: noteAiError(settled[0].reason) }; render(); return; }
    const cmp = [
      "Several AI models answered the same learner question independently. Compare the answers.",
      "Small differences in wording or detail count as agreement. Use \"agree\" when they give the same substance, \"partial\" when the core matches but there are real differences, and \"disagree\" when they conflict.",
      "", "Question:", msg.question, "",
      answers.map((a, i) => "Answer " + (i + 1) + " (" + a.name + "):\n" + a.text.slice(0, 3000)).join("\n\n"), "",
      'Reply with only JSON: {"verdict": "agree" | "partial" | "disagree", "summary": "one plain sentence", "differences": ["short sentence per real difference"]}',
    ].join("\n");
    try {
      const data = await sampleChat.json(cmp, { modelTier: "default", cache: false });
      const v = ["agree", "partial", "disagree"].includes(data && data.verdict) ? data.verdict : "partial";
      msg.check = { state: "done", verdict: v, n: answers.length, summary: String((data && data.summary) || ""), differences: parr(data && data.differences).map(String).filter(Boolean) };
      logEvent("crosscheck", "Cross-check of a tutor answer (" + answers.length + " models): " + v);
    } catch (e) {
      msg.check = { state: "error", error: noteAiError(e) };
    }
    render();
  }
  function renderBubble(m, i) {
    if (m.role === "user") return h("div", { class: "bubble me" }, h("p", { class: "bubble-text" }, m.content));
    const words = { agree: "Models agree", partial: "Models partly agree", disagree: "Models disagree" };
    const c = m.check;
    return h("div", { class: "bubble ai" },
      m.saved && m.content && !m.failed ? h("div", { class: "bubble-text lesson" }, md(m.content)) : h("p", { class: "bubble-text", id: "bubble-" + i }, m.content || (m.pending ? "Thinking…" : "")),
      m.error ? h("p", { class: "msg" }, m.error) : null,
      m.truncated ? h("p", { class: "caution" }, "This answer was cut short. Ask for less at a time.") : null,
      !m.pending && !m.failed ? h("div", { class: "bubble-meta" },
        h("span", null, "AI answer · can be wrong"),
        !c && m.question ? h("button", { class: "link", type: "button", disabled: !aiReady(), onclick: () => crossCheck(i) }, "Cross-check with two more models") : null,
        c && c.state === "running" ? h("span", { class: "thinking" }, "Cross-checking…") : null,
        c && c.state === "error" ? h("span", { class: "msg" }, c.error) : null) : null,
      c && c.state === "done" ? h("div", { class: "verdict " + c.verdict },
        h("span", { class: "verdict-title" }, words[c.verdict] + " (" + c.n + " answers)"),
        c.summary ? h("p", { class: "small" }, c.summary) : null,
        c.differences.length ? h("ul", { class: "plain small" }, c.differences.map((d) => h("li", null, d))) : null) : null);
  }

  // ---------- the Learn page ----------
  const PT_STATUS = { learned: "learned", ready: "can learn now", locked: "not reachable yet" };
  const PT_STAGES = [["plan", "Planner", "outlines the lesson for you"], ["teach", "Teacher", "writes it from the outline"], ["check", "Checker", "checks facts and examples, and suggests improvements"]];
  function ptTeamCard(job) {
    const order = { plan: 0, teach: 1, check: 2, fix: 2, translate: 3, done: 4, error: -1 };
    const at = order[job.stage];
    const stages = trLang() ? PT_STAGES.concat([["translate", "Translator", "translates it into your language, keeping the English original"]]) : PT_STAGES;
    return h("div", { class: "card", id: "pt-team", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your lesson"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what], i) => h("li", null,
        h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · fixed and rechecked " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "The editor sent back " + job.problems.length + " note" + (job.problems.length === 1 ? "" : "s") + "; the teacher is revising.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  function renderPointLearn() {
    const lede = "Pick one knowledge point. One AI plans how to teach it to you, another teaches it, and a third checks the lesson before you see it. Practice has its own section.";
    if (!km) return noMapPanel("Learn");
    const P = km.data, pid = plPoint();
    if (pid && lessonOf(pid) === undefined) setTimeout(() => ensurePointLesson(pid), 0);
    if (ui.chatKey !== lessonKey(pid)) {
      ui.chat = pid ? qaOf(pid).flatMap((it) => [{ role: "user", content: it.q }, it.a ? { role: "assistant", content: it.a, saved: true } : { role: "assistant", content: I18N.t("(This answer wasn't saved. Send the question again to get a new one.)"), failed: true, saved: true }]) : [];
      ui.chatKey = lessonKey(pid);
    }
    const picks = km.topPoints().slice(0, 6);
    const n = pid ? P.byId[pid] : null;
    const st = pid ? km.status(pid) : null;
    const missing = n ? n.needs.filter((x) => !km.isLearned(x)) : [];

    // long point names are shortened in the list (a native list can't wrap); the full name shows on hover and below
    const shortName = (t) => (I18N.units(t) > 64 ? [...t].reduce((o, ch) => (I18N.units(o + ch) > 62 ? o : o + ch), "").replace(/[\s,;:·、，(（]*$/, "") + "…" : t);
    const picker = h("div", { class: "card picker" },
      h("div", { class: "field" },
        h("label", { for: "pt-select" }, "Point to learn"),
        h("select", { id: "pt-select", "data-ai": "", onchange: (e) => { if (e.target.value) { plPick(e.target.value, "the list"); render(); } } },
          h("option", { value: "" }, I18N.t("Choose a point…")),
          P.KD.balls.map((b) => h("optgroup", { label: b.name }, b.pts.map((x) => h("option", { value: x, title: P.byId[x].name, selected: x === pid ? true : null }, shortName(P.byId[x].name) + " · " + I18N.t(PT_STATUS[km.status(x)]))))))),
      picks.length ? h("div", { class: "field" }, h("span", { class: "label small muted" }, "AI's top picks right now"),
        h("div", { class: "chips" }, picks.map((x) => ai("button", { class: x === pid ? "chip accent" : "chip", type: "button", onclick: () => { plPick(x, "top picks"); render(); } }, P.byId[x].name)))) : null,
      n ? h("p", { class: "small" },
        ai("strong", null, P.BALL[P.BALL_OF[pid]].name), " · " + PT_STATUS[st] + (km.onRoute(pid) ? " · on the suggested route" : ""),
        missing.length ? h("span", { class: "muted" }, " · not learned yet: ", ai("span", null, missing.map(ptName).join(", ")), ". The lesson will bridge these briefly.") : null) : null,
      n && n.what ? ai("p", { class: "small muted" }, n.what) : null,
      h("div", { class: "row" }, h("button", { class: "link", type: "button", onclick: () => { setView("map"); if (pid) km.openPoint(pid); } }, pid ? "Show this point on the map" : "Choose on the knowledge map")));

    const L0 = pid ? lessonOf(pid) : null, job = pid ? ui.pjobs[lessonKey(pid)] : null;
    const L = L0 && L0.lesson ? lessonView(L0) : L0;
    const cost = h("p", { class: "small muted" }, "Usually 3 to 5 AI requests: one to plan, one to teach, one or more to check and fix.");
    let body;
    if (!pid) body = [h("div", { class: "card soft" }, h("p", null, "Choose a point above, or open a topic on the knowledge map and use “Learn this point”."))];
    else if (job && job.running) body = [ptTeamCard(job)];
    else if (L === "loading") body = [h("p", { class: "thinking" }, "Loading your lesson…")];
    else if (L && L.lesson) {
      body = [
        h("details", { class: "card soft" }, h("summary", null, "How the planner set up this lesson"),
          L.plan.aim ? h("p", { class: "small" }, h("strong", null, "Aim: "), ai("span", null, L.plan.aim)) : null,
          L.plan.approach ? h("p", { class: "small" }, h("strong", null, "Approach: "), ai("span", null, L.plan.approach)) : null,
          ai("ol", { class: "plain small" }, L.plan.sections.map((s) => h("li", null, h("strong", null, s.title), ". ", s.teach))),
          L.plan.beyond ? h("p", { class: "small" }, h("strong", null, "Beyond this lesson: "), ai("span", null, L.plan.beyond)) : null,
          L.plan.goal_link ? h("p", { class: "small" }, h("strong", null, "In your goal: "), ai("span", null, L.plan.goal_link)) : null,
          (L.advice || []).length ? h("div", { class: "small" }, h("strong", null, "The editor's remaining suggestions (they didn't block the lesson):"),
            ai("ul", { class: "plain" }, L.advice.map((a) => h("li", null, a.problem)))) : null,
          h("p", { class: "small muted" }, "Planned, taught and checked by AI in " + L.requests + " requests" + (L.rounds ? ", with " + L.rounds + " round" + (L.rounds > 1 ? "s" : "") + " of fixes" : "") + ".")),
        h("div", { class: "row tr-row" }, trLine("lesson:" + lessonKey(pid), L0, lessonTrFn(pid))),
        h("article", { class: "card lesson-card" }, h("div", { class: "lesson" }, md(L.lesson))),
        h("p", { class: "small muted" }, L.ran && L.ran.n ? (L.ran.n === L.ran.of ? "Written and checked by AI, without a textbook behind it. The page ran every Python example and checked its output; for everything else, check what matters to you in a source you trust." : "Written and checked by AI, without a textbook behind it. The page ran " + L.ran.n + " of the " + L.ran.of + " Python examples and checked their output; for everything else, check what matters to you in a source you trust.") : "Written and checked by AI, without a textbook behind it. Where something matters to you, check it in a source you trust."),
        L.deeper ? h("aside", { class: "card deeper", "aria-label": "Going deeper, optional" },
          h("p", { class: "eyebrow" }, "Going deeper · optional"),
          h("p", { class: "small muted" }, "What happens underneath this lesson: how it actually works. You don't need to master it now, and the practice doesn't depend on it."),
          h("div", { class: "lesson" }, md(L.deeper))) : null,
        h("p", { class: "small muted pr-pointer" }, "Practice has its own section: it comes in sets, once what you've learned can combine into real tasks. ",
          h("button", { class: "link", type: "button", onclick: () => go("practice") }, "Go to Practice")),
        h("div", { class: "row" },
          km.isLearned(pid)
            ? h("button", { class: "quiet", type: "button", onclick: () => { km.setLearned(pid, false); render(); } }, "Mark as not learned")
            : h("button", { class: "primary", type: "button", onclick: () => { km.setLearned(pid, true); notify(ptName(pid) + " is marked as learned on your map."); render(); } }, "Mark as learned"),
          h("button", { class: "quiet", type: "button", onclick: () => go("notes") }, "My notes"),
          h("button", { class: "quiet", type: "button", disabled: !aiReady(), onclick: () => buildPointLesson(pid) }, "Rebuild this lesson")),
      ];
    } else {
      body = [h("div", { class: "card" },
        h("h3", null, I18N.t("Teach me “") , ai("span", null, n.name), I18N.t("”")),
        h("p", { class: "small" }, "The planner sees what you've marked as learned, what this point needs and leads to, and what the map says about it."),
        cost,
        job && job.stage === "error" ? h("p", { class: "msg" }, job.error) : null,
        job && job.stage === "error" && job.problems.length ? h("details", null, h("summary", { class: "small" }, "What the checker still found"), ai("ul", { class: "plain small" }, job.problems.map((p) => h("li", null, p.problem)))) : null,
        h("div", { class: "row" }, h("button", { class: "primary", type: "button", disabled: !aiReady(), onclick: () => buildPointLesson(pid) }, job && job.stage === "error" ? "Try again" : "Teach me this point")))];
    }

    const tutor = h("aside", { class: "card tutor", "aria-label": "Questions about this point" },
      h("h3", null, "Ask about this point"),
      ui.chat.length ? h("div", { class: "chat", id: "chat-box", "aria-live": "polite" }, ui.chat.map(renderBubble))
        : h("p", { class: "muted small" }, pid ? "Ask about anything in the lesson, or paste a practice exercise with your attempt." : "Choose a point first."),
      h("div", { class: "field" }, h("label", { for: "chat-input", class: "small" }, "Your message"),
        h("textarea", { id: "chat-input", rows: 3, value: ui.chatInput, placeholder: "For example: why does this work the way it does?", oninput: (e) => { ui.chatInput = e.target.value; }, onkeydown: (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendPointChat(); } } })),
      h("div", { class: "row spread" }, h("span", { class: "muted small" }, "Ctrl or Cmd + Enter"),
        h("button", { class: "primary", type: "button", disabled: ui.busy.chat || !aiReady() || !pid, onclick: sendPointChat }, ui.busy.chat ? "Answering…" : "Send")));

    return h("section", { class: "panel" },
      head("Learn", n ? ai("span", null, n.name) : "Learn a point", lede),
      h("div", { class: "learn" }, h("div", { class: "panel reading-col" }, picker, ...body), tutor));
  }

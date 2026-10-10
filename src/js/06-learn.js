  // ---------- Learn one point (v1.1; v2.0: any subject; v2.2: lead, writers, a reviewer who learns from it) ----------
  // The learner picks a point. A lead sets the goals, writers teach them, a reviewer learns from the lesson and revises
  // it; the page runs the examples and asks for another revision if they still fail (up to PL_ROUNDS times).
  const PL_ROUNDS = 2;
  const ptName = (pid) => (km && km.data.byId[pid] ? km.data.byId[pid].name : pid);
  // v2.1: prompts always use the map's original (English) names; the learner sees the translated ones
  let enCache = null;
  function EN() {
    const M = curMap();
    if (!M) return { n: {}, b: {}, M: null };
    if (!enCache || enCache.M !== M) {
      // a map first built in another language is given to the agents in its English translation (R63)
      const T = (M.src || M.lang || "en") !== "en" && M.tr && M.tr.en ? M.tr.en : null, tn = (T && T.nodes) || {}, tb = (T && T.balls) || {};
      enCache = { M, n: Object.fromEntries(M.nodes.map((x) => [x.id, tn[x.id] ? { ...x, name: tn[x.id].name || x.name, what: tn[x.id].what || x.what } : x])),
        b: Object.fromEntries(M.balls.map((x) => [x.id, tb[x.id] ? { ...x, name: tb[x.id].name || x.name, desc: tb[x.id].desc || x.desc } : x])) };
    }
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
      "Subject: " + profileOf().name,
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
  // ----- a lesson (v2.2): a lead sets the goals, writers teach them, a reviewer learns from the result -----
  // The lead sets what the learner should come away with and a shared frame, and decides how the writing is split.
  // Writers decide how to teach. The lead stitches several parts into one. The page runs the examples. A reviewer then
  // goes through the lesson as this learner would and tries to reach the goals from it alone, reads it once more for
  // anything false, and revises what it found. The teaching direction is given to the lead and the writers as a purpose;
  // the reviewer never gets it as criteria, so it can't turn into a checklist.
  const pointContext = (pid) => {
    const P = km.data, n = P.byId[pid], ball = enBall(P.BALL_OF[pid]), M = curMap();
    return [
      "Point: \"" + enName(pid) + "\"" + (enWhat(pid) ? ": " + enWhat(pid).replace(/\.\s*$/, "") : "") + ".",
      "It belongs to the topic \"" + ball.name + "\"" + (ball.desc ? " (" + ball.desc + ")" : "") + ", together with these points, each taught in its own lesson:" + (ball.pts.filter((x) => x !== pid).map((x) => "\n- " + enName(x) + (enWhat(x) ? ": " + enWhat(x) : "")).join("") || " nothing else") ,
      ptLearner(),
      "Points the learner has marked as learned on their map: " + ptLearned() + ".",
      "This point needs first: " + (n.needs.map((x) => enName(x) + (km.isLearned(x) ? " (learned)" : " (NOT learned yet)")).join("; ") || "nothing") + ".",
      "It leads to: " + (n.usedBy.map(enName).join(", ") || "nothing else on this map") + ".",
      "Topics on this map, from basics to advanced: " + (M ? M.balls.map((b) => enBall(b.id).name) : P.KD.balls.map((b) => b.name)).join(", ") + ".",
    ].join("\n");
  };
  const leadPromptPt = (pid) => { const S = profileOf(); return [
    "You lead the teaching of ONE knowledge point of " + S.name + " in Learning Companion, a study tool for self-learners. The learner reads the lesson on their own and thinks it through; it is not a conversation. You set what this learner should come away with; writers decide how to teach it, and a reviewer will then learn from the lesson as this learner would.",
    pointContext(pid), "",
    STANDARDS.guide(S), "",
    "Your job is to say what, never how: how to teach it, in what order and with what structure is the writers' choice, so none of it goes into the goals, the frame or the notes.",
    "- goals: what this learner should understand or be able to do after the lesson, each in one sentence: only what the point really holds, and a simple point holds little. Teach this point only: what another point on the map covers belongs to that point's lesson; a lesson may point to it, not teach it.",
    "- frame: only what the writers must share so the parts read as one lesson: the notation and terms to use, an example the goals share if they share one, what may be assumed, and a brief bridge for anything needed that isn't learned yet.",
    "- parts: who writes what, in order. One writer for the whole lesson is often best, because a lesson is one line of reasoning; split only where a part can be taught well on its own. Each part lists the numbers of its goals (1 for the first goal).",
    "- together: \"sequence\" if each part builds on the text of the parts before it (each writer then sees them), \"parallel\" if the parts can be written side by side.",
    "- beyond: what lies underneath this point that is worth knowing (the mechanism that makes it work, where its rules stop holding), if anything; empty if nothing.",
    "- goal_link: one sentence on where this point shows up in the learner's goal.",
    'Reply with only JSON: {"goals": [""], "frame": "", "parts": [{"goals": [numbers], "note": "what this writer must know that the goals and frame do not say, such as where their part starts and ends; usually empty"}], "together": "sequence or parallel", "beyond": "", "goal_link": ""}',
  ].join("\n"); };
  function normLead(d) {
    const goals = parr(d && d.goals).map(pstr).filter(Boolean).slice(0, 12);
    if (!goals.length) throw { code: "invalid_json", agent: "Lead" };
    let parts = parr(d.parts).map((p) => ({ goals: [...new Set(parr(p && p.goals).map(Number).filter((k) => k >= 1 && k <= goals.length))], note: pstr(p && p.note) })).filter((p) => p.goals.length).slice(0, 6);
    const covered = new Set(parts.flatMap((p) => p.goals));
    const missed = goals.map((_, i) => i + 1).filter((k) => !covered.has(k));
    if (!parts.length) parts = [{ goals: goals.map((_, i) => i + 1), note: "" }];
    else if (missed.length) parts[parts.length - 1].goals.push(...missed);
    return { goals, frame: pstr(d.frame), parts, together: pstr(d.together) === "parallel" ? "parallel" : "sequence", beyond: pstr(d.beyond), goal_link: pstr(d.goal_link) };
  }
  const goalsText = (p) => p.goals.map((g, i) => (i + 1) + ". " + g).join("\n");
  const writeRules = (S, whole) => [
    exampleRule(S),
    S.run === "python" ? "- The page runs every Python example in the lesson, in order, as one session, and checks its output; extensions after === DEEPER === run as a separate session, so they import and define what they use. Where a claim rests on values computed step by step, show them with code that prints them rather than working them out in prose." : "",
    "- As long as the goals need and no longer. Markdown with ## headings, no title line at the top. " + MD_NOTE,
    whole ? "- Extensions, if they are worth writing, go after the lesson, after a line containing only === DEEPER ===, each under a ### heading." : "- An extension worth writing for your goals goes after your part, after a line containing only === DEEPER ===, under a ### heading.",
    whole ? "- Then a line containing only === NOTES === and the notes for the learner to keep, one per line starting with \"- \": each one fact worth remembering, with `code` or exact notation in backticks and key **terms** in bold. As many as the lesson has such facts." : "",
  ].filter(Boolean).join("\n");
  const writerPromptPt = (pid, plan, k, before) => { const S = profileOf(), part = plan.parts[k], whole = plan.parts.length === 1; return [
    whole ? "You write a lesson on ONE knowledge point of " + S.name + " in Learning Companion, a study tool for self-learners. The learner reads it on their own and thinks it through." : "You write part " + (k + 1) + " of " + plan.parts.length + " of a lesson on ONE knowledge point of " + S.name + " in Learning Companion, a study tool for self-learners. The learner reads the lesson on their own and thinks it through. Other writers write the other parts; the lead will join them into one lesson.",
    "A lead set what the learner should come away with. How to teach it is yours to decide.",
    pointContext(pid), "",
    "All the goals of the lesson:", goalsText(plan),
    whole ? "" : "Your goals: " + part.goals.join(", ") + "." + (part.note ? " " + part.note : ""),
    "The frame every writer shares: " + (plan.frame || "(none)"),
    plan.beyond ? "Beyond the lesson, in the lead's view: " + plan.beyond : "",
    before ? "\nThe lesson so far, written by the writers before you (don't repeat it; continue from it):\n<<<\n" + before + "\n>>>" : "",
    "", STANDARDS.guide(S), "", "Format:", writeRules(S, whole), "",
    whole ? "Reply with the whole lesson, then the === DEEPER === line and extensions if any, then the === NOTES === line and the notes." : "Reply with your part only, then the === DEEPER === line and an extension if you wrote one.",
  ].filter((x) => x !== "").join("\n"); };
  const stitchPromptPt = (pid, plan, parts) => { const S = profileOf(); return [
    "You led the teaching of ONE knowledge point of " + S.name + " in Learning Companion. Writers have written the parts of the lesson. Join them into one lesson that reads as a single line of thought: add the transitions it needs, remove what one part repeats from another, and keep one voice and one notation. Don't rewrite what works and don't add new material: the content is the writers'.",
    "Point: \"" + enName(pid) + "\".", ptLearner(), "", "The goals:", goalsText(plan), "The frame: " + (plan.frame || "(none)"), "",
    ...parts.map((p, i) => "Part " + (i + 1) + ":\n<<<\n" + p.lesson + "\n>>>" + (p.deeper ? "\nIts extension:\n<<<\n" + p.deeper + "\n>>>" : "")),
    "", STANDARDS.rules(S), "", "Format:", writeRules(S, true), "",
    "Reply with the whole lesson, then the === DEEPER === line and the extensions if there are any, then the === NOTES === line and the notes.",
  ].join("\n"); };
  function splitLesson(text) {
    const parts = String(text).split(/^\s*===\s*NOTES\s*===\s*$/m);
    const notes = (parts[1] || "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")).slice(0, 40);
    const [lesson, deeper] = parts[0].split(/^\s*===\s*DEEPER\s*===\s*$/m);
    return { lesson: lesson.trim(), deeper: (deeper || "").trim(), notes };
  }
  const lessonBlock = (L) => ["The lesson:", "<<<", L.lesson, ">>>", "", "Extensions after the lesson:", L.deeper || "(none)", "", "The notes the learner keeps:", L.notes.map((x) => "- " + x).join("\n") || "(none)"].join("\n");
  // the reviewer: learns from the lesson as this learner would, then reads it once more for anything false
  const reviewPromptPt = (pid, plan, L, run) => { const S = profileOf(); return [
    "You are about to learn ONE knowledge point of " + S.name + " from a lesson in Learning Companion, a study tool for self-learners, before the real learner does. AIs wrote the lesson without a textbook behind it.",
    "First, be this learner. You know only what they know:", ptLearner(), "Points they have learned: " + ptLearned() + ".",
    "Read the lesson from the top, in order, as they would, and think it through as you go. Notice where you would get stuck: a step that jumps, something used before it is explained, a passage you could only follow because you already know the subject, a point where the thread breaks. Then try to reach each goal using only what the lesson gave you: could you now explain it, or do it, yourself?",
    "Then read it once more as an expert in " + S.name + " and find anything false: a wrong fact, " + (S.run !== "none" ? "code that would fail or a stated output that is wrong, " : "an example whose stated result is wrong, ") + "a disputed claim stated as settled.",
    "", "The goals the lead set:", goalsText(plan), "", STANDARDS.rules(S), "", lessonBlock(L),
    run && run.note ? "\n" + run.note + "\nTrust these results over your own reading of the code; anything they show to be wrong is already counted." : "",
    "",
    "Report only what needs changing, with the passage it concerns:",
    "- false: anything false, as above;",
    "- stuck: where this learner would get stuck, and what would let them through;",
    "- goals: each goal you could not reach from the lesson, and what is missing;",
    "- rules: anything against the standing rules below.",
    "Don't report matters of taste. If the lesson works, say so and report nothing.",
    'Reply with only JSON: {"reading": "two or three sentences on how learning from it went", "false": [{"quote": "", "problem": "", "fix": ""}], "stuck": [{"quote": "", "problem": "", "fix": ""}], "goals": [{"goal": number, "problem": "", "fix": ""}], "rules": [{"quote": "", "problem": "", "fix": ""}]}',
  ].filter((x) => x !== "").join("\n"); };
  const normItems = (v) => parr(v).map((p) => ({ quote: String((p && p.quote) || "").slice(0, 300), problem: pstr(p && p.problem), fix: pstr(p && p.fix) })).filter((p) => p.problem);
  function normFindings(v, plan) {
    const goals = parr(v && v.goals).map((g) => ({ quote: "", problem: "Goal " + (Number(g && g.goal) || "?") + (plan.goals[Number(g && g.goal) - 1] ? " (" + plan.goals[Number(g.goal) - 1] + ")" : "") + " isn't reached: " + pstr(g && g.problem), fix: pstr(g && g.fix) })).filter((g, i) => { const r = parr(v && v.goals)[i]; return pstr(r && r.problem) || pstr(r && r.fix); });
    return { reading: pstr(v && v.reading), false: normItems(v && v.false), stuck: normItems(v && v.stuck), goals, rules: normItems(v && v.rules) };
  }
  const findingsText = (F) => [["Anything false", F.false], ["Where the learner gets stuck", F.stuck], ["Goals not reached", F.goals], ["Against the standing rules", F.rules]]
    .filter(([, xs]) => xs.length).map(([t, xs]) => t + ":\n" + xs.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n")).join("\n\n");
  const revisePromptPt = (pid, plan, L, F) => { const S = profileOf(); return [
    "You reviewed the lesson below on ONE knowledge point of " + S.name + " by learning from it as the learner would. Now revise it: fix what you found, and change nothing else. Keep the writers' way of teaching; a fix should make the lesson clearer, not longer than it needs to be.",
    "Point: \"" + enName(pid) + "\".", ptLearner(), "", "The goals:", goalsText(plan), "", "What you found:", findingsText(F), "", lessonBlock(L), "",
    STANDARDS.rules(S), "", "Format:", writeRules(S, true), "",
    "Reply with the whole lesson, then the === DEEPER === line and the extensions if there are any, then the === NOTES === line and the notes.",
  ].join("\n"); };
  const hasFindings = (F) => F.false.length + F.stuck.length + F.goals.length + F.rules.length > 0;

  async function buildPointLesson(pid) {
    const key = lessonKey(pid);
    if (!pid || !aiReady() || (ui.pjobs[key] && ui.pjobs[key].running)) return;
    const job = { id: "pt:" + key, requests: 0, cancel: false, running: true, stage: "plan", rounds: 0, problems: [], error: null, parts: 0, written: 0 };
    const paint = () => { if (ui.step === "learn" && ui.view !== "map") render(); };
    job.paint = paint;
    ui.pjobs[key] = job; render();
    try {
      // 1. the lead: goals, frame, and how the writing is split
      job.plan = normLead(await ask(job, "Lead", inEnglish(leadPromptPt(pid)), "complex", true));
      // 2. the writers: in sequence (each sees the parts before it) or side by side
      job.stage = "teach"; job.parts = job.plan.parts.length; paint();
      let parts = [];
      const write = async (k, before) => { const t = splitLesson(await ask(job, "Writer", inEnglish(writerPromptPt(pid, job.plan, k, before)), "default", false)); job.written++; paint(); return t; };
      if (job.plan.together === "parallel") parts = await Promise.all(job.plan.parts.map((_, k) => write(k, "")));
      else for (let k = 0; k < job.plan.parts.length; k++) parts.push(await write(k, parts.map((p) => p.lesson).join("\n\n")));
      // 3. the lead joins several parts into one lesson
      let L = parts[0];
      if (parts.length > 1) { job.stage = "stitch"; paint(); L = splitLesson(await ask(job, "Lead", inEnglish(stitchPromptPt(pid, job.plan, parts)), "default", false)); }
      // 4. the page runs the examples; 5. the reviewer learns from the lesson, and revises what it found
      for (let round = 0; ; round++) {
        job.stage = "check"; paint();
        const run = profileOf().run === "python" ? await runLessonExamples(L).catch(() => null) : null;
        job.ran = run && run.ran ? { n: run.n, of: run.of } : null;
        let F;
        if (round === 0) { F = normFindings(await ask(job, "Reviewer", inEnglish(reviewPromptPt(pid, job.plan, L, run)), "complex", true), job.plan); job.reading = F.reading; }
        else F = { reading: "", false: [], stuck: [], goals: [], rules: [] };   // after a revision only the page's checks run again
        if (run && run.errs.length) F.false = run.errs.concat(F.false);
        if (!L.notes.length) F.rules.push({ quote: "", problem: "The notes are missing.", fix: "Add the === NOTES === line and the notes worth keeping." });
        job.problems = F.false.concat(F.stuck, F.goals, F.rules);
        if (!hasFindings(F)) break;
        if (round >= PL_ROUNDS) throw { code: "not_compliant", agent: "Reviewer" };
        job.stage = "fix"; job.rounds++; paint();
        L = splitLesson(await ask(job, "Reviewer", inEnglish(revisePromptPt(pid, job.plan, L, F)), "default", false));
      }
      const doc = { v: 2, src: "en", pid, key, at: new Date().toISOString(), plan: job.plan, reading: job.reading || "", lesson: L.lesson, deeper: L.deeper || "", notes: L.notes, advice: [], requests: job.requests, rounds: job.rounds, ran: job.ran };
      if (trLang()) {
        job.stage = "translate"; paint();
        try { await translateLesson(doc, job); }
        catch (e) { if (e && e.code === "cancelled") throw e; notify("The lesson is ready, but it couldn't be translated, so it's shown in English. You can translate it again.", "warn"); }
      }
      doc.requests = job.requests;
      ui.plessons[key] = doc;
      const s = cur();
      s.pointIndex[pid] = { at: doc.at, notes: doc.notes, src: "en", tr: doc.tr && doc.tr[curLang()] ? { [curLang()]: doc.tr[curLang()].notes } : undefined };
      if (db) db.doc("lessons2/" + key).set(clone(doc)).catch(() => notify("The lesson is shown but couldn't be saved.", "warn"));
      saveSubject();
      job.stage = "done";
      logEvent("lesson", "Point lesson delivered: " + ptName(pid) + " (" + job.requests + " requests, " + job.plan.parts.length + (job.plan.parts.length === 1 ? " writer, " : " writers, ") + job.rounds + " revisions)");
      notify("Your lesson on " + ptName(pid) + " is ready.");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "not_compliant" ? "The lesson still had problems the page could see after " + PL_ROUNDS + " revisions, so it wasn't shown. Try again." : jobError(e);
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
  const PT_STAGES = [["plan", "Lead", "sets what you should come away with, and how the writing is shared out"], ["teach", "Writers", "decide how to teach it, and write the lesson"], ["check", "Reviewer", "learns from the lesson as you would, checks it for anything false, and revises"]];
  function ptTeamCard(job) {
    const order = { plan: 0, teach: 1, stitch: 1, check: 2, fix: 2, translate: 3, done: 4, error: -1 };
    const at = order[job.stage];
    const stages = trLang() ? PT_STAGES.concat([["translate", "Translator", "translates it into your language, keeping the English original"]]) : PT_STAGES;
    return h("div", { class: "card", id: "pt-team", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your lesson"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what], i) => h("li", null,
        h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "teach" && job.parts > 1 ? h("span", { class: "muted small" }, " · " + job.written + " of " + job.parts + " parts written" + (job.stage === "stitch" ? " · the lead is joining them" : "")) : null,
        id === "check" && job.rounds ? h("span", { class: "muted small" }, " · revised " + job.rounds + (job.rounds > 1 ? " times" : " time")) : null))),
      job.stage === "fix" ? h("p", { class: "small muted" }, "The reviewer found " + job.problems.length + " thing" + (job.problems.length === 1 ? "" : "s") + " to change and is revising.") : null,
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  function renderPointLearn() {
    const lede = "Pick one knowledge point. One AI sets what you should come away with, others decide how to teach it, and a reviewer learns from the lesson as you would before you see it. Practice has its own section.";
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
    const cost = h("p", { class: "small muted" }, "Usually 3 to 8 AI requests: a lead, one or more writers, and a reviewer who revises what it finds.");
    let body;
    if (!pid) body = [h("div", { class: "card soft" }, h("p", null, "Choose a point above, or open a topic on the knowledge map and use “Learn this point”."))];
    else if (job && job.running) body = [ptTeamCard(job)];
    else if (L === "loading") body = [h("p", { class: "thinking" }, "Loading your lesson…")];
    else if (L && L.lesson) {
      body = [
        h("details", { class: "card soft" }, h("summary", null, L.plan.goals ? "How this lesson was made" : "How the planner set up this lesson"),
          L.plan.goals ? [h("p", { class: "small" }, h("strong", null, "What you should come away with:")), ai("ol", { class: "plain small" }, L.plan.goals.map((g) => h("li", null, g)))] : null,
          L.plan.goals && L.reading ? h("p", { class: "small" }, h("strong", null, "The reviewer, after learning from it: "), ai("span", null, L.reading)) : null,
          L.plan.aim ? h("p", { class: "small" }, h("strong", null, "Aim: "), ai("span", null, L.plan.aim)) : null,
          L.plan.approach ? h("p", { class: "small" }, h("strong", null, "Approach: "), ai("span", null, L.plan.approach)) : null,
          L.plan.sections ? ai("ol", { class: "plain small" }, L.plan.sections.map((s) => h("li", null, h("strong", null, s.title), ". ", s.teach))) : null,
          L.plan.beyond ? h("p", { class: "small" }, h("strong", null, "Beyond this lesson: "), ai("span", null, L.plan.beyond)) : null,
          L.plan.goal_link ? h("p", { class: "small" }, h("strong", null, "In your goal: "), ai("span", null, L.plan.goal_link)) : null,
          (L.advice || []).length ? h("div", { class: "small" }, h("strong", null, "The editor's remaining suggestions (they didn't block the lesson):"),
            ai("ul", { class: "plain" }, L.advice.map((a) => h("li", null, a.problem)))) : null,
          h("p", { class: "small muted" }, L.plan.goals
            ? "Written by AI in " + L.requests + " requests: a lead, " + L.plan.parts.length + (L.plan.parts.length === 1 ? " writer" : " writers") + " and a reviewer" + (L.rounds ? ", with " + L.rounds + (L.rounds > 1 ? " revisions" : " revision") : "") + "."
            : "Planned, taught and checked by AI in " + L.requests + " requests" + (L.rounds ? ", with " + L.rounds + " round" + (L.rounds > 1 ? "s" : "") + " of fixes" : "") + ".")),
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
        h("p", { class: "small" }, "The lead sees what you've marked as learned, what this point needs and leads to, and what the map says about it."),
        cost,
        job && job.stage === "error" ? h("p", { class: "msg" }, job.error) : null,
        job && job.stage === "error" && job.problems.length ? h("details", null, h("summary", { class: "small" }, "What the reviewer still found"), ai("ul", { class: "plain small" }, job.problems.map((p) => h("li", null, p.problem)))) : null,
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

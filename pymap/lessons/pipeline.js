  // ---------- Point lessons (v1.14): the AI creates, the guide steers, the checker edits ----------
  // The planner decides the approach and structure; the teacher may improve on the plan; both follow STANDARDS.guide.
  // The checker separates errors (wrong facts, failing code, wrong outputs, copied text, exercises in the lesson, missing
  // notes), which block delivery until fixed, from improvements against the guide, which go back to the teacher once and
  // then stay visible as advice. A lesson is never held back over craft.
  function plannerPromptPt(pid, cands) {
    const P = km.data, n = P.byId[pid], ball = P.BALL[P.BALL_OF[pid]];
    const heads = Object.entries(n.src).map(([s, hs]) => "- " + P.SHORT[s] + ": " + hs.map((x) => x[0]).join("; ")).join("\n");
    const akp = P.KD.akp[pid] || [];
    return [
      "You plan a lesson on ONE Python knowledge point for Learning Companion, a study tool for self-learners. Another AI will write it from your plan. You decide the approach, the structure and the examples: choose whatever gets this learner to real understanding fastest.",
      "Point: \"" + n.name + "\". It belongs to the topic \"" + ball.name + "\", together with: " + (ball.pts.filter((x) => x !== pid).map(ptName).join(", ") || "nothing else") + ".",
      ptLearner(),
      "Points the learner has marked as learned on their map: " + ptLearned() + ".",
      "This point needs first: " + (n.needs.map((x) => ptName(x) + (km.isLearned(x) ? " (learned)" : " (NOT learned yet)")).join("; ") || "nothing") + ". If something it needs isn't learned yet, plan a short bridge for it at the start.",
      "It leads to: " + (n.usedBy.map(ptName).join(", ") || "nothing else on this map") + ".",
      "Topics on this map, from basics to advanced: " + P.KD.balls.map((b) => b.name).join(", ") + ".",
      "How human courses and books title this topic:\n" + (heads || "- (no headings found)"),
      akp.length ? "Key points checked at the source in Automate the Boring Stuff, 3rd edition, for this topic. Cover the ones that belong to this point:\n- " + akp.join("\n- ") : "",
      "", STANDARDS.guide(SUBJECT), "",
      'Reply with only JSON: {"aim": "one sentence: what the learner can do afterwards", "approach": "two or three sentences: how you will get this learner to real understanding, and why this way", "bridge": ["a short recap of a missing prerequisite, if any"], "sections": [{"title": "short heading", "teach": "what to explain and how", "example": "what the example should show"}], "beyond": "what lies beyond this lesson that is worth the learner knowing (where its rules stop holding, a mechanism underneath, a later feature it points to), and which of these deserve a proper extension after the lesson; empty if nothing", "ml_link": "one sentence on where this shows up in machine-learning work"}',
    ].filter((x) => x !== "").join("\n");
  }
  function normPlan(d) {
    const str = (x) => (typeof x === "string" ? x.trim() : "");
    const arr = (x) => (Array.isArray(x) ? x : []);
    const sections = arr(d && d.sections).map((s) => ({ title: str(s && s.title), teach: str(s && s.teach), example: str(s && s.example) })).filter((s) => s.title && s.teach).slice(0, 7);
    if (!sections.length) throw { code: "invalid_json", agent: "Planner" };
    return { aim: str(d.aim), approach: str(d.approach), bridge: arr(d.bridge).map(str).filter(Boolean).slice(0, 3), sections, beyond: str(d.beyond), ml_link: str(d.ml_link), practice: [] };
  }
  const undot = (x) => String(x).replace(/[.。]\s*$/, "");
  const planText = (p) => [
    "Aim: " + p.aim,
    p.approach ? "Approach: " + p.approach : "",
    p.bridge.length ? "Bridge first: " + p.bridge.join("; ") : "",
    ...p.sections.map((s, i) => (i + 1) + ". " + s.title + ". Teach: " + s.teach + (s.example ? " Example: " + s.example : "")),
    p.beyond ? "Beyond this lesson: " + p.beyond : "",
    p.ml_link ? "Machine-learning link: " + p.ml_link : "",
  ].filter(Boolean).join("\n");
  const TEACH_RULES = [
    "- Write for this learner. Remind them of what they already know in one line at most; don't re-teach it.",
    "- The plan is a starting point. Follow its approach, and improve on it wherever you see a better way to teach this learner.",
    "- Use ## headings for the sections. Start with the bridge if the plan has one.",
    "- Every code example is short, runnable Python 3, and is followed by its exact output in a separate block that starts with the line \"Output:\". Show only output you are sure of.",
    "- A predict-then-see moment, with the answer right after it, is welcome. Don't write exercises, quizzes or \"try it yourself\" tasks: practice has its own section. Don't copy text from any book.",
    "- Usually 500 to 1000 words of Markdown for the lesson. No title line at the top.",
    "- Extensions, if you write any, go after the lesson, after a line containing only === DEEPER ===, each under a ### heading.",
    "- Then write a line containing only === NOTES === and 4 to 7 notes for the learner to keep, one per line starting with \"- \". Each note is one fact, with `code` in backticks and the key **terms** in bold.",
  ].join("\n");
  const teacherPromptPt = (pid, plan) => [
    "You write a lesson on ONE Python knowledge point in Learning Companion, from a plan by a planning AI.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan:", planText(plan), "", STANDARDS.guide(SUBJECT), "", "Format:", TEACH_RULES,
  ].join("\n");
  function splitLesson(text) {
    const parts = String(text).split(/^\s*===\s*NOTES\s*===\s*$/m);
    const notes = (parts[1] || "").split("\n").map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, "")).slice(0, 8);
    const [lesson, deeper] = parts[0].split(/^\s*===\s*DEEPER\s*===\s*$/m);
    return { lesson: lesson.trim(), deeper: (deeper || "").trim(), notes };
  }
  const checkerPromptPt = (pid, plan, L) => [
    "You review a lesson on ONE Python knowledge point before a self-learner sees it. You are an editor, not a gatekeeper: be strict about facts and code, and constructive about the teaching.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(), "Points the learner has marked as learned: " + ptLearned() + ".",
    "", "The plan it was written from:", planText(plan),
    "", "The lesson:", "<<<", L.lesson, ">>>", "", "Extensions after the lesson:", L.deeper || "(none)", "", "The notes for the learner:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    "", STANDARDS.guide(SUBJECT), "",
    "Errors, which must be fixed before the learner sees the lesson: a factual error; a code example that would fail, or whose stated output is wrong; text copied from a book; an exercise, quiz or practice task written into the lesson (a predict-then-see moment with its answer right after is fine); a wrong note; no notes at all. List every error you find.",
    "Improvements: the places where the lesson falls short of the teaching standards in a way that matters for this learner's understanding. At most 5, the most important first. Wording, length and order are not improvements unless they get in the way of understanding.",
    'Reply with only JSON: {"errors": [{"quote": "short exact passage", "problem": "what is wrong", "fix": "what to do"}], "improvements": [{"quote": "short exact passage", "problem": "what falls short", "fix": "how to make it better"}]}',
  ].join("\n");
  const normItems = (v) => (Array.isArray(v) ? v : [])
    .map((p) => ({ quote: String((p && p.quote) || "").slice(0, 300), problem: String((p && p.problem) || "").trim(), fix: String((p && p.fix) || "").trim() })).filter((p) => p.problem);
  const normReview = (v) => ({ errors: normItems(v && (v.errors || v.problems)), improvements: normItems(v && v.improvements).slice(0, 5) });
  const reviserPromptPt = (pid, plan, L, errs, imps) => [
    "You wrote the lesson below on ONE Python knowledge point. An editor reviewed it.",
    errs.length ? "Fix every error." : "",
    imps.length ? "Consider each suggested improvement and make it where it helps this learner; you may leave one out if you think the lesson is better without it." : "",
    "Change nothing else.",
    "Point: \"" + ptName(pid) + "\".", ptLearner(),
    "", "The plan:", planText(plan),
    errs.length ? "\nErrors:\n" + errs.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n") : "",
    imps.length ? "\nSuggested improvements:\n" + imps.map((p, i) => (i + 1) + ". " + (p.quote ? "\"" + p.quote + "\": " : "") + p.problem + (p.fix ? " Suggestion: " + p.fix : "")).join("\n") : "",
    "", "Your lesson:", "<<<", L.lesson, ">>>", "", "Your extensions:", L.deeper || "(none)", "", "Your notes:", L.notes.map((x) => "- " + x).join("\n") || "(none)",
    "", STANDARDS.guide(SUBJECT), "", "Format:", TEACH_RULES, "", "Reply with the whole lesson, then the === DEEPER === line and the extensions if there are any, then the === NOTES === line and the notes.",
  ].filter((x) => x !== "").join("\n");

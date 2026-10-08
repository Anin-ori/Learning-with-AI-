  // v1.18: the set is written in pieces, so no single answer runs past the length limit. The designer first plans the
  // set (small), then each exercise is written in full by its own call; the page runs every reference solution; the
  // editor separates errors (a learner couldn't pass it) from improvements; only exercises with problems are rewritten.
  const practiceContext = (R) => [
    ptLearner(), "", learnedText(), "",
    "A first AI judged that practice is worth doing now. Its reasons: " + R.why,
    "Combine these points: " + R.focus.join(", ") + "." + (R.review.length ? " Bring these back as review where they fit: " + R.review.join(", ") + "." : ""),
    R.shape ? "Suggested kind of task: " + R.shape : "",
    (state.practice || []).length ? "Sets they already did (write different tasks):\n" + prevSetsText() : "",
    "", STANDARDS.practice(SUBJECT),
  ].filter((x) => x !== "").join("\n");
  const outlineText = (O) => O.exercises.map((x, i) => (i + 1) + ". " + x.title + " (" + x.level + "): " + x.idea + " Decision: " + x.thinking).join("\n");
  const designPrompt = (R) => [
    "You design a practice set for a self-learner of " + SUBJECT.name + " in Learning Companion, a study tool. Plan the set now; each exercise will then be written in full by its own call, so keep this plan short.",
    practiceContext(R), "",
    'Reply with only JSON: {"when": "why practising this now makes sense", "how": ["advice on how to practise these particular exercises, as much as is useful"], "exercises": [{"title": "short title", "level": "warm-up, core or stretch", "combines": ["learned points it uses"], "idea": "what the program does, in two or three sentences", "thinking": "the decision the learner has to work out, which is why this is not a drill"}]}',
  ].join("\n");
  const exercisePrompt = (R, O, i) => [
    "You write one exercise of a practice set for a self-learner of " + SUBJECT.name + " in Learning Companion, a study tool.",
    practiceContext(R), "", "The whole set as planned:", outlineText(O), "",
    "Write exercise " + (i + 1) + ", \"" + O.exercises[i].title + "\", in full. Keep to its idea and its decision; improve on the plan where you see a better exercise.",
    'Reply with only JSON: {"title": "short title", "level": "warm-up, core or stretch", "task": "the full task in Markdown, with what the program reads, what it prints and at least one worked example", "combines": ["learned points it uses"], "thinking": "the decision the learner has to work out", "starter": "starter code or an empty string", "tests": [{"input": "the typed lines, one per line", "output": "exactly what the program prints"}], "solution": "a reference solution that uses only what the learner has learned", "hints": ["a gentle nudge", "a stronger nudge, still without code"]}',
  ].join("\n");
  const exText = (x, i) => [
    "Exercise " + (i + 1) + ": " + x.title + " (" + x.level + ")", "Combines: " + x.combines.join(", "), "Thinking: " + x.thinking,
    "Task:\n" + x.task, x.starter ? "Starter:\n" + x.starter : "", "Reference solution:\n" + x.solution,
    "Tests:\n" + x.tests.map((t, j) => "  " + (j + 1) + ". " + (t.check ? "check: " + t.check : "input " + JSON.stringify(t.input || "") + " -> output " + JSON.stringify(t.output || ""))).join("\n"),
    "Hints: " + x.hints.join(" | "),
  ].filter(Boolean).join("\n");
  const setText = (S) => S.exercises.map(exText).join("\n\n");
  const practiceCheckPrompt = (R, S, ran) => [
    "You review a practice set before a self-learner of " + SUBJECT.name + " sees it. You are an editor, not a gatekeeper: strict about whether the learner can do each exercise and pass its tests, constructive about the rest.",
    practiceContext(R), "",
    "The set:", "<<<", setText(S), ">>>",
    ran ? "The page ran each reference solution against its tests: " + ran : "The page could not run the code here, so check every expected output by reasoning.",
    "",
    "Errors, which must be fixed: the learner couldn't fairly pass the exercise (a task or reference solution that needs something they haven't learned and the task doesn't explain, an ambiguous task, a test that checks behaviour the task doesn't state, a worked example or expected output that is wrong), or the exercise isn't practice at all under the standards (a drill: one operation, a lesson example retyped or lightly varied, a slip to spot).",
    "Improvements: where an exercise could be clearly better under the practice standards (a decision the task gives away, a hint that gives the code away, a shallower version of a deeper exercise), most important first, only what matters.",
    "Wording, length and the choice of task are not problems when the standards are met.",
    'Reply with only JSON: {"errors": [{"exercise": 1, "problem": "what is wrong", "fix": "what to do"}], "improvements": [{"exercise": 1, "problem": "what falls short", "fix": "how to make it better"}]}',
  ].join("\n");
  const exerciseFixPrompt = (R, O, x, i, errs, imps) => [
    "You wrote exercise " + (i + 1) + " of the practice set below. An editor and the page's test run found the following." + (errs.length ? " Fix every error." : "") + (imps.length ? " Consider each improvement and make it where it helps the learner." : "") + " A fix may rewrite the exercise if it can't be repaired.",
    practiceContext(R), "", "The whole set as planned:", outlineText(O), "",
    errs.length ? "Errors:\n" + errs.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Fix: " + p.fix : "")).join("\n") : "",
    imps.length ? "Improvements:\n" + imps.map((p, k) => (k + 1) + ". " + p.problem + (p.fix ? " Suggestion: " + p.fix : "")).join("\n") : "",
    "", "Your exercise:", JSON.stringify(x), "",
    "Reply with only the whole exercise as JSON, in the same shape.",
  ].filter((t) => t !== "").join("\n");

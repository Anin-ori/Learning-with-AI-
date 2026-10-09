  // ---------- Teaching standards (v1.10; v2.0: the subject profile is written by the AI that builds the map) ----------
  // One framework for every subject. The guide never names a subject; a subject profile supplies only illustrations of
  // the standard, never content to reuse. In v2.0 the AI that plans the map writes the profile for each subject (v2.2: the master planner).
  const RUNNERS = { python: "Python", javascript: "JavaScript", none: "" };
  const profileOf = () => {
    const m = curMap();
    const p = (m && m.profile) || {};
    const name = p.name || (cur() && cur().name) || "the subject";
    return {
      name,
      trap: p.trap || "a case whose surprising result is explained by how " + name + " works underneath",
      slips: p.slips || "a typo or a careless slip",
      observe: p.observe || "the ways a learner can check for themselves what is going on",
      shallow: p.shallow || "a task that repeats one fact from the lesson",
      rich: p.rich || "a small realistic task that makes the learner combine several ideas",
      examples: p.examples || "Examples are concrete and exact.",
      format: p.format || "Each exercise is a small written task with a clear answer the learner can compare with a model answer.",
      run: RUNNERS[p.run] !== undefined ? p.run : "none",
    };
  };
  const STANDARDS = {
    // v1.14: one guide for the AIs that teach. It describes what good teaching is for and why; it is not a checklist and
    // presets no content. v2.2: it opens with the direction the author set (R66, R67), and the lesson reviewer never
    // gets it: a reviewer that checks against a guide turns the guide into a benchmark that every lesson then performs.
    guide: (S) => [
      "What the teaching is for. Teach for understanding that lasts and can be used: the learner should come away knowing why, able to rebuild it and to use it on something new, and aware of where it ends. Build on what they already know and make the connection plain. The learner reads on their own and thinks it through, so leave the thinking to them: give them something to work out or explain to themselves, not only conclusions to accept. Keep to one idea at a time, show it in varied forms and at its edges, and be honest about what is certain and what isn't. Knowledge should unfold the way it naturally does. How a lesson achieves this is yours to decide, and none of it has to show up as a feature: a lesson that simply explains the point well is right.",
      "Standing rules. They hold for every subject; the illustrations come from " + S.name + " and are not content to reuse.",
      "- Surprises. A surprising case is worth showing when explaining it reveals how " + S.name + " works underneath, as in " + S.trap + ". A mistake that reveals nothing, such as a slip (" + S.slips + ") or a wrong idea no reasonable learner holds, teaches nothing, so leave it out. Don't claim how common a mistake is: there is no data on that.",
      "- Honest scope. When a rule has exceptions, say where it holds rather than stating it as absolute.",
      "- Extensions go down, not sideways. After the lesson, the most valuable extension usually explains what happens underneath: the steps actually taken, what the idea is built on, why it behaves the way it does, and how the learner can observe that for themselves (" + S.observe + "). A tour of more uses or later topics only adds breadth the learner will meet in later lessons anyway. Explain an extension properly or leave it out: concrete and exact, like a good reference entry, never a passing hint such as \"a clearer way comes later\". Under the hood, be exact about what you know, say plainly where your certainty ends, and say where it can be checked. The learner doesn't have to master it.",
      "- New things. If you use something the learner hasn't learned, explain it briefly where it appears.",
      "- Honest about yourself. You are an AI teaching without a textbook in front of you. Where a claim is one you are less sure of, or one that experts dispute, say so plainly and say where it can be checked.",
    ].join("\n"),
    readiness: (S) => [
      "Practice standards (they hold for every subject; the examples come from " + S.name + "):",
      "- Practice is worth doing when the learned points can combine into a small, real task in which the learner must decide how to fit them together: what to keep track of, in what order things happen, which cases to handle. One or two isolated points are not enough: practice on them is a drill that only repeats the lesson.",
      "- Recent points are the focus. Older learned points can come back as review inside the tasks, even if that is all they get.",
      "- Judge only from the lists given. Don't assume the learner knows anything else.",
      "- If it isn't enough yet, say plainly why, and name the points they can learn next whose learning would make the most difference to practice: the few that matter, not a list.",
    ].join("\n"),
    practice: (S) => [
      "Practice standards (they hold for every subject; the examples come from " + S.name + "):",
      "- Each exercise is a small, realistic task that combines at least two of the points to combine, ideally three or more, and brings back review points where they fit. It must make the learner decide something: how to structure the answer, what to keep track of, in what order, which cases to handle. Name that decision in \"thinking\".",
      "- Shallow is not allowed: retyping or lightly varying a lesson example; filling one blank; a single step; trivia about notation; a slip to spot (" + S.slips + "); a task whose only difficulty is reading a long statement. For example, " + S.shallow + " is a drill, not practice; " + S.rich + " is practice.",
      "- Use only what the learner has learned. The task and the reference answer may need nothing else. If a good task would need more, change the task.",
      "- The task is complete and exact: what it is given, what it must produce, and at least one worked example where the subject allows one. Every behaviour a test or criterion checks is stated in the task. Don't give away the decision the exercise is about.",
      "- " + S.format,
      "- As many exercises as the learned material supports well, from easier to harder. One excellent exercise beats several thin ones, and a set can be a single exercise.",
      "- Hints that nudge toward the decision without giving the answer away, from gentle to stronger, as many as the exercise needs.",
      "- Never call a mistake common or classic.",
    ].join("\n"),
  };
  // How each kind of exercise is checked. Runnable subjects use tests the page runs; the others use criteria an AI reads.
  const RUN_FORMAT = {
    python: "Each exercise is a whole Python program that reads typed lines with input() and prints with print(). A test gives the typed lines and exactly what the program prints. Text passed to input() as a prompt isn't checked, so the task should say prompts are optional, and examples show only what print() prints. Only if the learner has learned how to define functions and the exercise is about writing one may a test instead be {\"check\": \"one Python assert line that calls the function\"}; then the task names the function and its parameters exactly.",
    javascript: "Each exercise is a whole JavaScript program. It reads typed lines by calling input(), which the page provides and which returns the next typed line as a string, and it prints with console.log(). A test gives the typed lines and exactly what the program prints. The page shows strings and numbers as console.log does, and arrays and objects as JSON.stringify would, so tasks that print arrays or objects should say so. Only if the learner has learned how to define functions and the exercise is about writing one may a test instead be {\"check\": \"one JavaScript expression that must be true, calling the function\"}; then the task names the function and its parameters exactly.",
  };
  const MD_NOTE = "The page renders Markdown: headings, lists, tables, code blocks, bold and italics, but not LaTeX. Write any formula in plain text with Unicode symbols (x², √, ≤, →, ∑), in a code block if it needs alignment.";

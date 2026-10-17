  // ---------- Teaching standards (v1.10; v2.0: the subject profile is written by the AI that builds the map) ----------
  // One framework for every subject. The guide never names a subject; a subject profile supplies only illustrations of
  // the standard, never content to reuse. In v2.0 the AI that plans the map writes the profile for each subject (v2.2: the master planner).
  const RUNNERS = { python: "Python", javascript: "JavaScript", none: "" };
  const profileOf = () => {
    const m = curMap();
    const p = (m && m.profile) || {};
    // agents work in English (R63): a map first built in another language gives its English subject name
    const en = m && (m.src || m.lang || "en") !== "en" && m.tr && m.tr.en && m.tr.en.subject;
    const name = en || p.name || (cur() && cur().name) || "the subject";
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
    // v2.2 (R66, R67): two layers. The purpose says what teaching is for, in the author's terms; only the AIs that create
    // a lesson get it, as direction, never as criteria: a reviewer that checks against it turns it into a benchmark that
    // every lesson then performs. The standing rules are the author's teaching standards; every AI that writes, joins
    // or revises a lesson gets them, from this one list (v2.3: the reviewer checks facts only and doesn't get them).
    // v2.3 (R74): the purpose is the judgments a good teacher makes about what this learner needs, drawn from the author's
    // account of a human-taught LU course (Oct 17), not teaching moves to perform: instructions such as "make the
    // connection plain" or "give them something to work out" were being carried out as introductions and devices.
    purpose: () => [
      "What the lesson is for. It gives this learner the content of the point, complete, exact and clear, at the depth their use of it calls for. Judge everything by what this learner will do with the point, given their goal. What they will use is explained in full: what it is, how it behaves, how to carry it out, and where it stops working. Theory and detail they won't use are left out, not shortened. What they already have (the points they have learned) is named and used, not taught again, and a case that works like one already explained gets a sentence. The core of the point, the part this learner will use most, gets most of the effort: explained in detail, with worked examples where they help; on a worked example the reader should attempt, a line asking them to try it before reading the solution is fine. Each thing sits where the learner will use it: a practical concern goes with the practice it serves, not with the theory. A reason comes out of the substance (what something costs, what breaks without it) and sits with that substance, never as a preamble. State a thing exactly first; a short plain-language explanation may follow where it helps, and stays short. How the lesson does this is yours to decide.",
      // v2.2 (R69): the author's direction on style, given as guidance for the AIs that write, never as a check; v2.3 (R74): only subject matter, and clear before short
      "How it reads. Only subject matter: no introductions, motivation, announcements of what is coming, recaps, reassurance or remarks about the lesson itself. Rigorous, concise and clear: say exactly what is true, in as few words as that takes, in an order the reader can follow. Shorten by removing what isn't subject matter, never by compressing an explanation the learner needs into a phrase. Let the length follow the substance of the point: a simple point deserves a short lesson that explains it plainly and stops.",
    ].join("\n"),
    rules: (S) => [
      "Standing rules. They hold for every subject; the illustrations come from " + S.name + " and are not content to reuse.",
      "- Surprises. A surprising case is worth showing when explaining it reveals how " + S.name + " works underneath, as in " + S.trap + ". A mistake that reveals nothing, such as a slip (" + S.slips + ") or a wrong idea no reasonable learner holds, teaches nothing, so leave it out. Don't claim how common a mistake is: there is no data on that.",
      "- Honest scope. When a rule has exceptions, say where it holds rather than stating it as absolute.",
      "- Extensions go down, not sideways. After the lesson, the most valuable extension usually explains what happens underneath: the steps actually taken, what the idea is built on, why it behaves the way it does, and how the learner can observe that for themselves (" + S.observe + "). A tour of more uses or later topics only adds breadth the learner will meet in later lessons anyway. Explain an extension properly or leave it out: concrete and exact, like a good reference entry, never a passing hint such as \"a clearer way comes later\". Under the hood, be exact about what you know, say plainly where your certainty ends, and say where it can be checked. The learner doesn't have to master it.",
      "- New things. If you use something the learner hasn't learned, explain it briefly where it appears.",
      "- Honest about yourself. You are an AI teaching without a textbook in front of you. Where a claim is one you are less sure of, or one that experts dispute, say so plainly and say where it can be checked.",
      "- Practice has its own section. No exercises or quizzes in a lesson. A worked example the reader tries before reading its solution, with the solution following, is part of the explanation and fine.",
      "- Your own words. Don't copy text from any book.",
    ].join("\n"),
    guide: (S) => STANDARDS.purpose() + "\n" + STANDARDS.rules(S),
    // v2.2 (R68, R70): like the lessons, two layers. The purpose goes to the lead and writers of practice; the rules go to
    // them and to the reviewer. No counts, and no rule that practice waits until points combine (the author found sets on
    // simple material overloaded, every task stringing all the learned points together).
    // R70: what makes practice effective, as the author and Claude agreed on Oct 10; direction for the lead and writers
    practicePurpose: () => [
      "What practice is for. The learner produces what they have learned themselves, without the lesson in front of them, and then finds out exactly where their thinking held and where it went another way. That effort of retrieving and using an idea is what makes it last, and it doesn't depend on a task being big: a few short exercises done from memory can do more than one long one. Aim just past comfortable: the learner should succeed, with effort. Vary the exercises so they show where an idea applies and where it stops, and let earlier material come back now and then. Give each exercise one clear point the learner could name afterwards. The comparison with the reference answer is where the learning settles, so the reference answer shows the reasoning, not only the result. How the practice does this is yours to decide.",
      // R72: how questions written by good teachers read, from comparing the AI's questions with human problem sets
      // (Strang's Problem Set 2.6, MIT 18.06, Nicholson 2.7) on the same topic; direction, not a check
      "How a good question reads. Good problem sets, written by people who teach the subject, are mostly short: a sentence or two that says what is given and asks one thing, with an answer that can be checked at a glance. The material is chosen so the point shows itself: an example where the interesting thing actually happens, a parameter that makes the learner find where something breaks, letters instead of numbers when the point is a pattern, small clean numbers when arithmetic is not the point. The question asks rather than instructs: it leaves the method to the learner unless the method is what is being practised. Across a batch, the questions differ in kind (working an example, finding when something fails, explaining why, finding the general pattern, proving a fact where the subject has proofs) and build from concrete to general, each idea once.",
    ].join("\n"),
    practiceRules: (S) => [
      "Practice rules (they hold for every subject; the examples come from " + S.name + "):",
      "- Use only what the learner has learned. The task and the reference answer may need nothing else; if a good task would need more, change the task.",
      "- The task is complete and exact: what the learner is given and what they must produce. It doesn't give away what the question asks them to work out.",
      "- One question asks one thing. Where it has parts, they serve that one thing; a list of separate sub-questions is a worksheet, not a question.",
      "- Not a lesson example retyped or lightly varied.",
      "- " + S.format,
      "- Hints nudge without giving the answer away, from gentle to stronger, as many as the question needs.",
      "- Never call a mistake common or classic.",
    ].join("\n"),
  };
  // How each kind of exercise is checked. Runnable subjects use tests the page runs; the others use criteria an AI reads.
  const RUN_FORMAT = {
    none: "Each exercise is a written task with a reference answer that shows the whole working, not only the result. The learner works it out on paper and then compares with the reference answer; nothing they write is collected or marked.",
    python: "Each exercise is a whole Python program that reads typed lines with input() and prints with print(). A test gives the typed lines and exactly what the program prints. Text passed to input() as a prompt isn't checked, so the task should say prompts are optional, and examples show only what print() prints. Only if the learner has learned how to define functions and the exercise is about writing one may a test instead be {\"check\": \"one Python assert line that calls the function\"}; then the task names the function and its parameters exactly.",
    javascript: "Each exercise is a whole JavaScript program. It reads typed lines by calling input(), which the page provides and which returns the next typed line as a string, and it prints with console.log(). A test gives the typed lines and exactly what the program prints. The page shows strings and numbers as console.log does, and arrays and objects as JSON.stringify would, so tasks that print arrays or objects should say so. Only if the learner has learned how to define functions and the exercise is about writing one may a test instead be {\"check\": \"one JavaScript expression that must be true, calling the function\"}; then the task names the function and its parameters exactly.",
  };
  // v2.2: the page draws LaTeX (KaTeX), so formulas are written as math, not as Unicode text in code blocks
  const MD_NOTE = "The page renders Markdown (headings, lists, tables, code blocks, bold and italics) and LaTeX math: $…$ inside a sentence, and $$…$$ on lines of its own for a displayed formula, a matrix or an aligned derivation (\\begin{pmatrix}…\\end{pmatrix}, \\begin{aligned}…\\end{aligned}). Write every formula, matrix and symbol as LaTeX; keep code blocks for code.";

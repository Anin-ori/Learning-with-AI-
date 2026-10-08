  const STANDARDS = {
    // v1.14: one guide that the planner, the teacher and the checker all read. It describes what good teaching looks like
    // and why; it is not a checklist and it presets no content. The AI decides how to meet it.
    guide: (S) => [
      "Teaching standards. They hold for every subject. The illustrations come from " + S.name + "; they show the standard and are not content to reuse. Use your own judgement about how to meet them.",
      "- Depth. Aim for understanding the learner could rebuild on their own: why it works, not only what to type.",
      "- Surprises. A surprising case is worth showing when explaining it reveals how " + S.name + " works underneath, as in " + S.trap + ". A mistake that reveals nothing, such as a slip (" + S.slips + ") or a wrong idea no reasonable learner holds, teaches nothing, so leave it out. Don't claim how common a mistake is: there is no data on that.",
      "- Honest scope. When a rule has exceptions, say where it holds rather than stating it as absolute.",
      "- Extensions. When something beyond this lesson is worth knowing (a mechanism underneath, a later feature that does the job better), either leave it out or explain it properly after the lesson: what it is, how it is written, a complete example with its output, how it works, and the details that matter, like a good reference entry. The learner doesn't have to master it, but it must not be vague: a passing hint such as \"a clearer way comes later\" is worse than nothing.",
      "- New things. If you use something the learner hasn't learned, explain it briefly where it appears.",
    ].join("\n"),

# Real-prompt run, Oct 8, 2026 (v2.0)

The page's own prompts, captured with `test/capture.js` and answered by fresh models standing in for the app's AI
(architect, map checker and lesson checkers: the most capable tier; writers, router, planner, teacher: the standard tier).

- Subject "Python", goal "Use Python for machine learning: load and clean data, train models with scikit-learn, and understand what the code does."
- Map (`001`–`008`, result in `map.json`): 5 areas, 26 topics, 139 points, 470 links, in 8 requests. The checker made 8 fixes
  (one rename for pandas Copy-on-Write, seven missing "needed first" links). The router put 90 of 139 points on the route.
- Lesson 1 (`lesson1/`, "What a model learns"): built before the page ran lesson examples. The first checker caught an impossible
  stated output; later rounds argued over a step-by-step gradient-descent narrative that was never run, and the third check
  still found errors, so the lesson was not delivered.
- Lesson 2 (`009`–`013`, "Floating-point rounding surprises"): the page ran all 16 Python examples. It caught a wrong long decimal
  and an extension example that failed; the checker added three more; one revision fixed all five and the lesson was delivered.

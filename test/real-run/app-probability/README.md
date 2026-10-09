# Real run in the app: Probability (Oct 8, 2026)

Built by the author in the published app (map framework of v2.2: shared frame, names first, details with the
whole plan), with the app's own agents on the author's account; Claude only read the saved progress.

- Goal: probability for statistics and machine learning (events, conditional probability and Bayes' rule, random
  variables, expectation and variance, common distributions, LLN and CLT).
- Time: about 7 minutes from start to finished map. 48 requests: master 1, planners 22, plan reviewer 1,
  writers 17, area reviewers 5, whole-map reviewer 1, router 1.
- Result: 8 areas, 17 topics, 123 points, 354 "needed first" links, 66 points on the route; 54 changes by the
  reviewers (the plan reviewer merged 9 duplicates or sub-steps and added 2 missing ideas before details were written).
- Found: the whole-map reviewer sometimes added a link that was already there and then withdrew it in the same answer;
  applied in order, the withdrawal removed the existing link. Fixed afterwards: such pairs cancel out.

`maps/smv0gxd29imrb.json` is the saved map; `build-last-saved-before-done.json` the build's last saved state before
it finished.

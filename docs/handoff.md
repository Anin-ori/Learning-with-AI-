# Learning Companion: handoff for a new chat

Current version: **v2.2** (Oct 8, 2026). Read this first, then the requirements doc.

## Links
- App (always update this one; never create a new artifact): https://claude.ai/artifact/S3F4yxSMJYgxZovEzKixxo
- Requirements doc (read first; record every change, with its trigger, and every issue there): https://claude.ai/code/artifact/bc4d21b2-c279-4f2e-8ae5-82d15d45679f
- GitHub: https://github.com/Anin-ori/Learning-with-AI- (branch `main`). Claude can push branches here; tag pushes are refused from Claude sessions, so tags are made on GitHub (Releases).
- v1.18, frozen and usable, with the author's v1.18 progress copied into it: https://claude.ai/artifact/XGLBP3Nam14ZQ8KGLhNtBA. Its source is `v1/` in the repo and commit `d421e27`.

## Restoring the source (a new chat's workspace starts empty)
1. Attach the repo (`Anin-ori`/`Learning-with-AI-`, push access) and clone it, or read `source/MANIFEST.txt` from the app link and read the files it lists (drop the `source/` prefix and `.txt` on `.html.txt`).
2. `python3 build.py` builds `learning-companion.html` from `src/`.
3. **Every version: commit and push to GitHub, and republish the page with the changed source files under `source/`** (contentType `text/plain`, plus an updated `MANIFEST.txt`). Publishing omits `capabilities`, so the stored `{db, sample}` carries forward.

## Roles and standing rules
- The author makes product and teaching decisions; Claude makes technical ones.
- Don't just agree. Point out issues, write them in the doc, and flag anything that shakes the core.
- **No test that spends AI quota without the author's explicit approval of that run and its size** (real-prompt runs, agents answering the page's prompts). Ask first, and keep it to the smallest check that answers the question (one branch, a few requests). The mock-AI tests use no quota.
- Efficiency and specificity are the only reasons to use AI (principle 4).
- Guidance instead of fixed counts is core (principle 6). Numbers live only in code, as safety limits.
- We guide and constrain the AI's creation. No preset libraries, slots, if-then rule patches or template content for the AI to fill.
- **Since v2.0: any subject, and every limit is guidance, including human search first.** The AI builds each subject's map; Python too. The author chose to trust the AI here; the risks are I33–I40.
- Learning is point-based: the learner chooses, the AI suggests.
  - On the map, brightness shows status only (learned / can learn / not reachable).
  - A red ring marks the AI route, on every route topic.
  - The AI's top picks glow white, with an on/off switch.
- Don't ask learners for things the page already has. Have one fully compliant version before handing anything over.
- The UI is simple and high-end.
- Teaching standards apply to every subject:
  - Traps and mistakes are taught only if they reveal a mechanism. No "common mistakes" lists, and never claim a mistake is common.
  - Extensions go down (what happens underneath, how to observe it, honest about where certainty ends), not sideways.
  - Unlearned things may be used with a brief explanation.
- Practice is its own section and comes in sets once learned points combine into real tasks. The AI judges readiness first and may include review.
- Notes live on the map. Tutor questions are kept with their point.

## How the build works
- `src/js/*.js` are joined in order inside one function by `build.py`: 00-i18n, 01-core (state, storage, `ask`), 02-md, 03-standards (the guide; the subject profile comes from the map), 03-translate (the translation layer), 04-map (drawing), 05-build (building a map), 06-learn, 07-practice (runners for Python and JavaScript, lesson-example runs), 08-notes, 09-profile (subjects, goal, level check, AI guidance), 10-log, 11-main.
- Storage (db): `app2/index`, `subjects/<sid>`, `maps/<sid>`, `lessons2/<mapId>_<pointId>`, `qa2/<mapId>`, `practice2/<setId>`, `logs/main`. v1.18's documents are left untouched.
- **Agents work in English (R63).** Prompts use the stored English (`enName`, `enWhat`, `enBall` in 06-learn), never the translation. Built items are stored in English with `src: "en"` and `tr: {zh: {...}}` beside it; views pick through `displayMap`, `lessonView`, `practiceView`, `recordView`, `noteList`. New AI-written fields need adding to the matching `*Pairs` function in 03-translate, or they stay English. The original switch is stored per browser (`lc-orig`). The tutor chat uses `sampleChat`, which answers in the learner's language.
- New UI strings need Chinese entries in `src/i18n/zh.json` (`exact`, or `patterns` for strings with numbers or names). `L=zh node test/v2_test.js` writes `test/out/untranslated.txt`.
- Tests: `node test/v2_test.js` (and `L=zh`). They need Playwright (`/opt/npm-tools/node_modules/playwright`, Chromium in `/opt/pw-browsers`) and Pyodide 0.26.4 core at `/home/claude/pyo/pyodide`: npm is blocked here, so download `pyodide-core-0.26.4.tar.bz2` from Pyodide's GitHub release.
- Real-prompt checks: `test/capture.js` runs the page and writes each prompt to `test/cap/NNN.<kind>.prompt.txt`, then waits for `NNN.answer.json` (or `.txt`). Fresh agents answer them; tell them to write the file in one go, because the page reads it as soon as it appears. `SUBJECT`, `GOAL`, `POINT` set the run. The first run is in `test/real-run`.

## v2.2 (latest)
- The map is built by a tree of agents (R64, `05-build.js`): master → planners (divide, or write one topic) → reviewers join parts on the way up → router → page checks. Saved after each agent in `builds/<sid>`; Continue building / Start over. Usage limits stop the build (no retry).
- Content follows the interface language both ways (`03-translate.js`: `curLang`, `srcOf`, `needsTr`, `trLine`, `autoTranslate`): anything shown in a language it wasn't written in is translated the first time it is shown; the original is one switch away.
- `test/look.js <map.json> <subject.json> [zh]` renders saved real data locally (no AI calls) for checking the interface by eye; read the author's data with ArtifactData (read-only).
- Lessons (R66, R67, `06-learn.js`): learning by reading and reflection, not dialogue. A lead sets the goals (what to come away with, not an outline), a shared frame, and how the writing is split (one writer is often best; parts in sequence see the text before them). Writers choose how to teach. The lead joins several parts. The page runs the Python examples. A reviewer first learns from the lesson as this learner (given only what they have learned), tries to reach each goal from the lesson alone, then reads it as an expert for anything false, and revises what it found. After a revision only the page's checks run again (up to 2 revisions). `STANDARDS.guide` now opens with what teaching is for (the author's direction), told to the lead and writers; the reviewer never gets it, so it can't become a checklist. Goals and the reviewer's reading are shown under "How this lesson was made". Old lessons still display. Lessons, practice, the level check and AI guidance are written in the map's own language (`workLang`, `inLang`, `outLang` in 03-translate): English for maps built since v2.1, Chinese for the author's 数学分析 map; they are translated only when the interface language differs. The first real lesson (数学分析, 命题、联结词与真值, 7 requests) was good; it showed the lead writing a near-outline in its notes, the lesson teaching part of a neighbouring point (逆否, p4), extensions going sideways (SAT, proof assistants), and a Chinese lesson marked as English; prompts and language were fixed and that lesson's record repaired. A real check of one lesson (about 4 to 8 requests) has not been run: it waits for the author's approval.
- Open: I42, maps grow large (point-grain guidance added, unverified); I43, builds are slow (about two requests at a time per viewer).

## v2.1
- Translation layer: every agent works in English; a translator agent turns built content into the learner's language after delivery; the English original is kept, with one switch; the tutor answers in the learner's language directly. A failed translation never blocks ("Translate it" retries). Long texts are sent in parts between paragraphs; only code comments are translated. Real-prompt check in `test/real-run/translate`. I41: translations are not checked.

## v2.0
- Subjects in Profile; the AI builds each map (architect, writers, router, checker), and the page checks structure.
- Lessons, practice, tutor, notes, level check and AI guidance for any subject. Practice in Python and JavaScript is run in the browser; other subjects get written answers read by an AI, labelled.
- In Python, the page runs every lesson example and gives the checker the results (added after the first real lesson failed to converge on an unrun calculation).

## Open items
- The author wants the same tree model for every component, one at a time: map and lessons done; practice next.
- I37: the route covered 90 of 139 points in the real run; whether it should be narrower is the author's call.
- I39: package loading (NumPy, pandas, scikit-learn) and the JavaScript runner need a check in claude.ai.
- I38: subjects that can't be run have only the checker; I40: lessons run long.
- R33: bring your own model. I31: Chinese sources (now: the AI names sources in the learner's language).

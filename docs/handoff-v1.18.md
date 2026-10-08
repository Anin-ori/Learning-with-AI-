# Learning Companion: handoff for a new chat

Current version: **v1.18** (Oct 5, 2026). Read this first, then the requirements doc.

## Links
- App (always update this one; never create a new artifact): https://claude.ai/artifact/S3F4yxSMJYgxZovEzKixxo
- Requirements doc (read first; record every change, with its trigger, and every issue there): https://claude.ai/code/artifact/bc4d21b2-c279-4f2e-8ae5-82d15d45679f
- Source: stored inside the app artifact under `source/`. Nothing needs attaching; see "Restoring the source" below.

## Restoring the source (a new chat's workspace starts empty)
1. With the Artifact tool, read `source/MANIFEST.txt` from the app link. It lists every source path (131 files, about 2.7 MB of text).
2. Read the files with `paths` and an `out_dir` in the scratchpad, then copy them into a working folder. Drop the `source/` prefix, and turn `*.html.txt` back into `*.html`. Big files arrive as files, not inline, so this costs little context.
3. Run `python3 pymap/integrate19.py`. It rebuilds `learning-companion.html` from `learning-companion-v0.12.html`.
4. **Every time a version is published, republish the changed source files under `source/` together with the page,** including the new `integrateN.py` and an updated `MANIFEST.txt`. Files left out of a publish are kept. Use `contentType: text/plain` for every source file.

Tested Oct 8, 2026: files read back from the artifact matched the originals byte for byte.

## Roles and standing rules
- The author makes product and teaching decisions; Claude makes technical ones.
- Don't just agree. Point out issues, write them in the doc, and flag anything that shakes the core.
- Efficiency and specificity are the only reasons to use AI (principle 4).
- Guidance instead of fixed counts is core (principle 6). Numbers live only in code, as safety limits.
- We guide and constrain the AI's creation. No preset libraries, slots, if-then rule patches or template content for the AI to fill.
- Learning is point-based: the learner chooses, the AI suggests.
  - On the map, brightness shows status only (learned / can learn / not reachable).
  - A red ring marks the AI route, on every route topic.
  - The AI's top picks glow white, with an on/off switch.
- Don't ask learners for things the page already has. Have one fully compliant version before handing anything over.
- The UI is simple and high-end.
- Teaching standards apply to every subject, not only Python:
  - Traps and mistakes are taught only if they reveal a mechanism. No "common mistakes" lists, and never claim a mistake is common.
  - Extensions go down (what happens underneath, how to observe it, honest about where certainty ends), not sideways. Explain them properly or leave them out.
  - Unlearned features may be used with a brief explanation.
- Practice is its own section and comes in sets once learned points combine into real tasks. The AI judges readiness first and may include review. The AI writes practice under the standards, and the page runs every reference solution before showing it.
- Notes live on the map. Tutor questions are kept with their point.
- Restricted-network learners will bring their own API key (R33); we do our best.

## How the build works
- Each `integrateN.py` runs the previous one, then patches `learning-companion.html` with exact-string replacements. For the next version, write `integrate20.py` (v1.19) and bump the `<title>` and the pill text.
- New UI strings need Chinese entries in `pymap/i18n/make_zh.py`:
  - exact strings go in the dict near `"Going deeper:"`;
  - patterns go after `P = [`.
- Tests are in `pymap/test/`. They need Playwright (Chromium is pre-installed) and a local Pyodide 0.26.4 copy at `/home/claude/pyo/pyodide`, which is not stored with the source; fetch it from npm (`pyodide@0.26.4`) when needed.
  - `practice_test.js` (env `L=zh`, `BAD=1`, `DROP=1`)
  - `v21_test.js`
  - `notes_test.js`
- Real-prompt checks: capture prompts with `capture_prompts.js` or `practice_capture.js`, then run them through fresh agents and verify the code in Pyodide.

## v1.18 (latest)
- **Problem:** practice generation failed. The single designer answer ran past the length limit, which the platform reports as unreadable JSON.
- **Fix:**
  - The designer first writes a plan, then each exercise is written by its own request.
  - The page runs the tests.
  - The editor separates errors from improvements. Errors get up to 2 fix rounds; improvements get one.
  - An exercise that can't be fixed is left out and named.
- **Not yet confirmed with the real model:** the author's next real build is the test.

## Open items
- I31: Chinese human sources.
- R33: bring your own model.
- The level check still uses 3 fixed CS50P tasks; we offered to make that the AI's choice.
- The old chapter-lesson path still has fixed counts. It is unreachable.
- The AI-translated names need a human check.

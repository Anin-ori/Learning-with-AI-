# Learning Companion

Open-source AI teaching software for self-directed learners. The AI creates; the framework guides and constrains what it creates.

**v2.0** works for any subject. The learner names a subject and a goal, and AIs build a knowledge map for it: an architect plans the topics and points, writers say what each point is and what it needs first, a router marks the route the goal needs, and a checker reviews the whole map. The learner chooses points on the map; AIs plan, teach and check each lesson, write practice sets once what has been learned can combine into real tasks, and answer questions, which are kept with their point. In Python, the page runs every lesson example and every practice solution in the browser before the learner sees them. No human source is used, so the page says plainly where an AI's work hasn't been proven.

**v2.1** adds a translation layer. Every agent works in English. When the learner reads another language (now Simplified Chinese), a translator agent turns what was built (the map, lessons, notes, practice, the level check, AI guidance) into that language after it is delivered. The English original is always kept, and one switch shows it. The tutor answers directly in the learner's language so its replies still stream.

**v2.2** builds the map with a tree of agents: a master divides the subject into parts, planners divide each part until it is small enough to write as one topic, and reviewers check and join the parts on the way back up, ending with the whole map. Every finished agent's work is saved, so a build that stops continues where it left off.

v1.18 (tag `v1.18`, files in `v1/`) is the earlier design: a Python map built from 13 human sources.

## Layout

- `learning-companion.html`: the built app, one self-contained page. It runs inside claude.ai, which provides the AI calls and the saved data.
- `src/`: the source the page is built from.
  - `js/`: the page's script, in modules joined in order (`00-i18n` … `11-main`). `03-translate.js` is the translation layer.
  - `app.css` (the visual system, unchanged from v1.18) and `v2.css` (v2.0 additions).
  - `body.html`: the page's markup.
  - `i18n/zh.json`: the Simplified Chinese interface.
- `build.py`: builds the page. `python3 build.py`
- `test/`
  - `v2_test.js`: an end-to-end test with a mock AI (`mock.js`). `node test/v2_test.js`, or `L=zh node test/v2_test.js` in Chinese.
  - `capture.js`: runs the page's real prompts past a real model, one file per prompt; `real-run/` holds the first run, and `real-run/translate/` a real check of the translator.
  - The tests need Playwright with Chromium and a local Pyodide 0.26.4 at `/home/claude/pyo/pyodide` (the "core" archive from Pyodide's GitHub release).
- `docs/`: the requirements and handoff note as of v1.18.
- `v1/`: v1.18's source. `cd v1 && python3 pymap/integrate19.py` rebuilds it.

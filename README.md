# Learning Companion

Open-source AI teaching software for self-directed learners. The AI teaches; the framework guides and constrains what it creates.

The tag `v1.18` is the last version of the first design: Python as preparation for machine learning, anchored in human-organized sources (13 courses and books), with a point-based knowledge map, AI-written lessons and practice sets checked before delivery. Version 2.0 is being built on top of it.

## Layout

- `learning-companion.html`: the built app (one self-contained page). It runs inside claude.ai, which provides the AI calls; opened elsewhere, the map and saved data work but the AI steps don't.
- `learning-companion-v0.12.html`: the base page the build starts from.
- `pymap/`: the build scripts, map data, sources, translations and tests.
  - `integrateN.py`: each version's patch. `python3 pymap/integrate19.py` rebuilds v1.18 from the base page.
  - `sources/`: the 13 human sources, mapped to knowledge points.
  - `i18n/`: the Simplified Chinese interface.
  - `test/`: Playwright tests. They also need a local copy of Pyodide 0.26.4 (from npm, `pyodide@0.26.4`), which is not stored here.
- `docs/requirements-v1.18.md`: the requirements, principles, issues and change log as of v1.18.
- `docs/handoff-v1.18.md`: working notes for continuing v1.18.

## Build

```
python3 pymap/integrate19.py
```

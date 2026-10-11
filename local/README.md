# Learning Companion — local version (temporary)

A stopgap for when the Claude quota runs out. **The version on claude.ai stays the standard one**; this copy is the same page with two things swapped: the AI comes from an API key you set up, and progress is saved on this computer.

学习伴侣本地版（临时）：Claude 额度用完时的替代。**claude.ai 上的版本仍是正式版**。本地版是同一个页面，只换了两样：AI 用你自己设置的 API 密钥，进度保存在本机。

## Start · 启动

Needs Python 3 (python.org) and an internet connection (for the AI, fonts and formulas).

- Mac: double-click `start-mac.command` (the first time, right-click → Open).
- Windows: double-click `start-windows.bat`.
- Linux / terminal: `python3 server.py`

The page opens at http://127.0.0.1:8765/. Keep the window open while you study.

## First time · 第一次使用

1. **Local settings / 本地设置** (top right) opens by itself. Pick a service, paste your API key, save.
   - Anthropic (Claude API): key from console.anthropic.com; models are filled in.
   - DeepSeek, OpenAI, OpenRouter, or Ollama on this computer: any OpenAI-compatible API works; fill in the model names.
2. Import your progress: **Import progress… / 导入进度…** and choose `learning-progress-2026-10-11.json` (your subjects, maps, lessons, notes and questions from claude.ai as of Oct 11).

## Where things are · 文件位置

- `data/` — your progress, one file per record. Back it up by copying the folder, or use **Export progress**.
- `config.json` — your API settings and key. Don't share this file.
- An import moves the old `data/` to `data-before-import-…/` first, so nothing is lost.

## Going back to claude.ai · 回到正式版

Export progress here, then ask Claude to load that file into the official app (the official page has no import button yet).

## Differences from the official version · 与正式版的不同

- Tutor answers appear all at once, not word by word.
- Quality and cost depend on the models you choose; the prompts were written for Claude.
- Opening `learning-companion-local.html` directly (without the server) also works, but saves only in that browser, and some APIs refuse calls from a browser.

Files: `server.py` (server), `shim.js` (AI and storage for the page), `build_local.py` (rebuilds the page from the source), start files.

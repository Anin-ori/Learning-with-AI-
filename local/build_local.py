#!/usr/bin/env python3
"""Builds the local stopgap version: the official page (build.py) plus shim.js, which stands in for Claude's
AI and storage. Output: local/learning-companion-local.html. The official page itself is not changed.
   python3 local/build_local.py"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
subprocess.run([sys.executable, os.path.join(ROOT, "build.py")], check=True)
page = open(os.path.join(ROOT, "learning-companion.html"), encoding="utf-8").read()
shim = open(os.path.join(HERE, "shim.js"), encoding="utf-8").read()
marker = '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/'
assert marker in page, "build.py output changed: can't find where to put the shim"
page = page.replace(marker, "\n<script>\n" + shim + "</script>" + marker, 1)
page = page.replace("</title>", " (local, temporary)</title>", 1)
doc = '<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n'
out = os.path.join(HERE, "learning-companion-local.html")
open(out, "w", encoding="utf-8").write(doc + page.replace("</style>\n", "</style>\n</head><body>\n", 1) + "</body></html>\n")
print("built", out)

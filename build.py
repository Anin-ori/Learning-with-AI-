#!/usr/bin/env python3
"""Builds learning-companion.html (v2.0) from src/: one self-contained page.
   python3 build.py            -> learning-companion.html"""
import json, os, glob
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
VERSION = "v2.0"
read = lambda p: open(os.path.join(SRC, p), encoding="utf-8").read()
zh = json.load(open(os.path.join(SRC, "i18n", "zh.json"), encoding="utf-8"))
js = "".join(open(p, encoding="utf-8").read().rstrip() + "\n\n" for p in sorted(glob.glob(os.path.join(SRC, "js", "*.js"))))
js = js.replace("/*@ZH@*/", json.dumps(zh, ensure_ascii=False, separators=(",", ":")))
head = (f"<title>Learning Companion {VERSION}</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Montserrat:wght@700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap">\n')
page = (head + "<style>\n" + read("app.css") + read("v2.css") + "</style>\n\n" + read("body.html") +
        '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>\n<script>\n(() => {\n  "use strict";\n' + js + "})();\n</script>\n")
out = os.path.join(HERE, "learning-companion.html")
open(out, "w", encoding="utf-8").write(page)
print("built", out, len(page), "bytes")

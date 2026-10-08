"""v1.7: larger type everywhere. Builds v1.6, then enlarges the map's topic, point, dial and opened-topic labels
(the layout reserves room for the bigger labels, so they still don't overlap) and steps up the app's text sizes."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate7.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.6</title>", "<title>Learning Companion v1.7</title>")
rep('<span class="pill">Python pilot / v1.6</span>', '<span class="pill">Python pilot / v1.7</span>')
# map labels: topic names 11.5 -> 13.5 px, with the layout's label boxes sized to match
rep('const KREF = 0.74, FS = 11.5, LH = 14;', 'const KREF = 0.74, FS = 13.5, LH = 16.5;')
rep('b.lw = Math.max(...b.lines.map((l) => l.length)) * 6.2 / KREF;', 'b.lw = Math.max(...b.lines.map((l) => l.length)) * 7.1 / KREF;')
rep('lab.attr("font-size", FS * ts / K).attr("stroke-width", 3.2 / K).attr("y", R + (5 + 11 * ts) / K)',
    'lab.attr("font-size", FS * ts / K).attr("stroke-width", 3.6 / K).attr("y", R + (5 + 13 * ts) / K)')
# an opened topic: its name 15 -> 19 px, its progress line 10.5 -> 12.5 px
rep('const fs = 15 / K, lh = 17 / K', 'const fs = 19 / K, lh = 21 / K')
rep('g.select(".km-prog").attr("font-size", 10.5 / K).attr("y", y0 + (n - 1) * lh + 18 / K);',
    'g.select(".km-prog").attr("font-size", 12.5 / K).attr("y", y0 + (n - 1) * lh + 22 / K);')
# point names around an opened topic: 11.5 -> 13.5 px, set a little further from their dot
rep('dotSel.select("text").attr("font-size", 11.5 / K).attr("stroke-width", 3.2 / K)', 'dotSel.select("text").attr("font-size", 13.5 / K).attr("stroke-width", 3.6 / K)')
rep('.attr("x", (d) => Math.cos(d.a) * 15 / K).attr("y", (d) => Math.sin(d.a) * 15 / K)', '.attr("x", (d) => Math.cos(d.a) * 17 / K).attr("y", (d) => Math.sin(d.a) * 17 / K)')
# labels switch on a little earlier: the larger label boxes still clear each other at this zoom
rep('K >= KREF * 0.78', 'K >= KREF * 0.76')
# the dial's caption: 11.5 -> 14 px
rep('dialText.attr("font-size", 11.5 / K)', 'dialText.attr("font-size", 14 / K)')
css = open(f"{HERE}/app_v17.css").read()
i = s.rindex("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.7 written:", len(s))

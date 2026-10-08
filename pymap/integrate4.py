"""v1.3: the map redrawn (rings by level, one circle per topic, red route rings kept on every route topic, full-bleed sky)."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate3.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)
rep("<title>Learning Companion v1.2</title>", "<title>Learning Companion v1.3</title>")
rep('<span class="pill">v1.2 · Python pilot</span>', '<span class="pill">v1.3 · Python pilot</span>')
rep('aria-label="Map of 30 topics of Python knowledge points"', 'aria-label="Map of 30 Python topics on rings, basics in the centre"')
open(p, "w").write(s)
print("v1.3 written:", len(s))

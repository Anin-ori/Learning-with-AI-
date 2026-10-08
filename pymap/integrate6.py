"""v1.5: the "white field" look, after the Rhine Lab UI reference the author shared (LBEILC/RhineLabUI, MIT).
Builds v1.4 (dial, decluttered labels) and swaps its look: a warm grey-white field, frosted discs whose brightness is status
(learned white, ready cream with an ink edge, not yet taupe), a white flare and ping for top picks, ink type, gold for
what people wrote."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate5.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.4</title>", "<title>Learning Companion v1.5</title>")
rep('<span class="pill">Python pilot, v1.4</span>', '<span class="pill">Python pilot / v1.5</span>')
rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&family=Cormorant+Garamond:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=JetBrains+Mono:wght@400;500&display=swap">')

# swap the v1.4 stylesheet block for v1.5
TUTOR = '''
.card.tutor { position: sticky; }
@media (max-width: 1100px) { .card.tutor { position: relative; } }
'''
rep(open(f"{HERE}/app_v14.css").read() + TUTOR, open(f"{HERE}/app_v15.css").read() + TUTOR)

# frosted disc materials: a soft light from the upper left
rep('''    [[0, 0.95], [0.32, 0.42], [0.62, 0.12], [1, 0]].forEach(([o, a]) => glowG.append("stop").attr("offset", o).attr("stop-color", "#fff").attr("stop-opacity", a));''',
    '''    [[0, 0.95], [0.32, 0.42], [0.62, 0.12], [1, 0]].forEach(([o, a]) => glowG.append("stop").attr("offset", o).attr("stop-color", "#fff").attr("stop-opacity", a));
    [["km-m-learned", [[0, "#ffffff"], [0.65, "#fcfbf9"], [1, "#eeebe6"]]], ["km-m-ready", [[0, "#f5f3ef"], [1, "#e0dbd4"]]], ["km-m-locked", [[0, "#d4cec5"], [1, "#c2bbb1"]]]]
      .forEach(([id, st]) => { const m = defs.append("radialGradient").attr("id", id).attr("cx", "38%").attr("cy", "32%").attr("r", "78%"); st.forEach(([o, c]) => m.append("stop").attr("offset", o).attr("stop-color", c)); });''')
# top picks: a white flare ring and two staggered pings around the disc
rep('''    ballSel.append("circle").attr("class", "km-glow").attr("fill", "url(#km-glowg)");''',
    '''    ballSel.append("circle").attr("class", "km-glow").attr("fill", "url(#km-glowg)");
    ballSel.append("circle").attr("class", "km-ping");
    ballSel.append("circle").attr("class", "km-ping p2");
    ballSel.append("circle").attr("class", "km-flare");''')
rep('''        g.select(".km-halo").attr("r", R + 4.5 / K);''',
    '''        g.select(".km-halo").attr("r", R + 4.5 / K);
        g.selectAll(".km-ping, .km-flare").attr("r", R + 9.5 / K);''')
rep('''        g.select(".km-glow").attr("r", R * (HOT.has(b.id) ? 3.2 : 2.4));''', '''        g.select(".km-glow").attr("r", R + 26 / K);''')
rep('''dialText.attr("font-size", 13 / K).attr("y", -DIAL + 14 + 13 / K)''', '''dialText.attr("font-size", 11.5 / K).attr("y", -DIAL + 22 + 14 / K)''')
# legend swatches for the white field
rep('''    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#f3f0e4"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#1a2e33" stroke="rgba(236,248,244,.86)" stroke-width="1"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.6" fill="#0b191c" stroke="rgba(200,232,226,.26)" stroke-width="1"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ff5a3c" stroke-width="1.3"/><circle cx="8" cy="8" r="3.4" fill="#1a2e33" stroke="rgba(236,248,244,.6)" stroke-width=".8"/>'),''',
    '''    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#fff" stroke="rgba(13,15,12,.3)" stroke-width=".8"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#ebe7e1" stroke="#0d0f0c" stroke-width="1.2"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.8" fill="#c8c1b7"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#d4472c" stroke-width="1.4"/><circle cx="8" cy="8" r="3.4" fill="#ebe7e1" stroke="#0d0f0c" stroke-width=".9"/>'),''')
rep('''      glow: sw('<defs><radialGradient id="km-lg"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="8" cy="8" r="8" fill="url(#km-lg)"/><circle cx="8" cy="8" r="3.2" fill="#fff"/>') };''',
    '''      glow: sw('<circle cx="8" cy="8" r="6" fill="none" stroke="rgba(13,15,12,.45)" stroke-width="3.8"/><circle cx="8" cy="8" r="6" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="8" cy="8" r="2.8" fill="#ebe7e1" stroke="#0d0f0c" stroke-width=".9"/>') };''')
open(p, "w").write(s)
print("v1.5 written:", len(s))

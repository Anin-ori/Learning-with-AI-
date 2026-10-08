"""v1.6: the "infographic" layer, after the author's reference slide. Builds v1.5, then: grained grey paper, a DIN-like
condensed face, thick brackets and dashed callouts, charcoal section badges with offset shadows and icons, a progress pie,
and four matte colours at matched saturation, each with one job (green progress, blue where you are, red the AI route,
orange written by people). An opened topic now shows its progress arc around the big circle too."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate6.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.5</title>", "<title>Learning Companion v1.6</title>")
rep('<span class="pill">Python pilot / v1.5</span>', '<span class="pill">Python pilot / v1.6</span>')
rep('family=Manrope:wght@200..800&family=JetBrains+Mono:wght@400;500',
    'family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500')
# the progress arc stays on when a topic is opened: the big circle shows how much of it you've learned
rep('''        g.select(".km-arc").attr("d", f > 0 && f < 1 && !open ? arcD(R, f) : null);''',
    '''        g.select(".km-arc").attr("d", f > 0 && f < 1 ? arcD(R, f) : null);''')
# legend swatches in the matte palette
rep('''route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#d4472c" stroke-width="1.4"/>''',
    '''route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ae574f" stroke-width="1.7"/>''')
# the page knows its section, so section badges can carry their own icon
rep('''    document.querySelectorAll("#topnav button").forEach((b) => b.setAttribute("aria-current", b.dataset.sec === sec ? "page" : "false"));
  }''', '''    document.querySelectorAll("#topnav button").forEach((b) => b.setAttribute("aria-current", b.dataset.sec === sec ? "page" : "false"));
    document.body.dataset.sec = sec;
  }''')
# progress as a pie with the learned slice pulled out, inside brackets, beside the count
rep('''    function renderMine() {''', '''    // a pie of points learned: the learned slice is pulled out, as in a printed chart; a fine grain gives the fills a paper texture
    function pie(f) {
      const R = 38, a = f * TAU, big = f > 0.5 ? 1 : 0, mid = a / 2 - Math.PI / 2, ox = (6 * Math.cos(mid)).toFixed(2), oy = (6 * Math.sin(mid)).toFixed(2);
      const x1 = (R * Math.sin(a)).toFixed(2), y1 = (-R * Math.cos(a)).toFixed(2);
      const on = f <= 0 ? "" : f >= 1 ? `<circle class="pie-on" r="${R}"/>` : `<path class="pie-on" transform="translate(${ox},${oy})" d="M0,0L0,${-R}A${R},${R} 0 ${big} 1 ${x1},${y1}Z"/>`;
      const off = f >= 1 ? "" : f <= 0 ? `<circle class="pie-off" r="${R}"/>` : `<path class="pie-off" d="M0,0L${x1},${y1}A${R},${R} 0 ${1 - big} 1 0,${-R}Z"/>`;
      return `<svg class="km-pie" viewBox="-46 -46 92 92" role="img" aria-label="${Math.round(100 * f)}% of points learned"><defs><filter id="km-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".42" intercept=".68"/><feFuncG type="linear" slope=".42" intercept=".68"/><feFuncB type="linear" slope=".42" intercept=".68"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#km-grain)">${off}${on}</g></svg>`;
    }
    function renderMine() {''')
rep('''        <div class="km-big"><b>${learned.size}</b><span>of ${KD.nodes.length} points learned</span></div>
        <div class="km-bar2" role="img" aria-label="${pct}% learned"><i style="width:${pct}%"></i></div>''',
    '''        <div class="km-stat">${pie(learned.size / KD.nodes.length)}<div class="km-big"><b>${learned.size}</b><span>of ${KD.nodes.length} points learned</span></div></div>''')
css = open(f"{HERE}/app_v16.css").read()
i = s.rindex("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.6 written:", len(s))

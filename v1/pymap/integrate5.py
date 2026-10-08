"""v1.4: the "observatory and notary" look. The map becomes an etched star chart with a graduated dial (one tick per
point, lit when learned); controls take a lab-instrument shape; reading pages are set like notarised documents, with brass
marking what people wrote. The marks keep their meaning: brightness = status, red-orange ring = AI route, white glow = top picks."""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate4.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.3</title>", "<title>Learning Companion v1.4</title>")
rep('<span class="pill">v1.3 · Python pilot</span>', '<span class="pill">Python pilot, v1.4</span>')
rep('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&family=Cormorant+Garamond:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap">')

# ---- the map: etched orbits and a graduated dial, one tick per point ----
rep('''    RINGS.slice(1).forEach((R) => gR.append("circle").attr("class", "km-ring").attr("r", R));''',
    '''    RINGS.slice(1).forEach((R, i) => gR.append("circle").attr("class", "km-ring").attr("r", R).attr("pathLength", 1).style("animation-delay", (i * 0.08) + "s"));
    // the dial: one tick per point, ordered by the bearing of its topic, so lit ticks gather where the learner has been
    const DIAL = 494, bearing = (b) => b.ring ? (b.a + Math.PI / 2 + 2 * TAU) % TAU : -1;
    const DIALPTS = KD.balls.slice().sort((x, y) => bearing(x) - bearing(y)).flatMap((b) => b.pts);
    const gD = gR.append("g").attr("class", "km-dial");
    gD.append("circle").attr("class", "km-dialring").attr("r", DIAL).attr("pathLength", 1).style("animation-delay", ".3s");
    const dialTicks = gD.selectAll("line").data(DIALPTS).join("line").attr("class", "km-tick")
      .each(function (pid, i) { const a = -Math.PI / 2 + i * TAU / DIALPTS.length, c = Math.cos(a), si = Math.sin(a), L = BALL_OF[pid] !== BALL_OF[DIALPTS[i - 1]] ? 13 : 7;
        d3.select(this).attr("x1", c * (DIAL + 3)).attr("y1", si * (DIAL + 3)).attr("x2", c * (DIAL + 3 + L)).attr("y2", si * (DIAL + 3 + L)); })
      .style("animation-delay", (pid, i) => (0.25 + i * 0.004).toFixed(3) + "s");
    const dialText = gD.append("text").attr("class", "km-dialtext").attr("text-anchor", "middle");
    const dialNum = dialText.append("tspan").attr("class", "n");
    dialText.append("tspan").text(" of " + KD.nodes.length + " points learned");''')
rep('''      bcount.text((b) => `${doneOf(b)} of ${b.pts.length} learned`);''',
    '''      bcount.text((b) => `${doneOf(b)} of ${b.pts.length} learned`);
      dialTicks.classed("on", (pid) => learned.has(pid)); dialNum.text(learned.size);''')
rep('''    function sizeText() {''', '''    function sizeText() {
      dialText.attr("font-size", 13 / K).attr("y", -DIAL + 14 + 13 / K).attr("display", ks.open ? "none" : null);''')
rep('''      show() { fitTop(); refresh(); if (!ks.shown) { ks.shown = true; ''',
    '''      show() { fitTop(); refresh(); if (!ks.shown) { ks.shown = true; el("kmap").classList.add("km-intro"); setTimeout(() => el("kmap").classList.remove("km-intro"), 1500); ''')
# I29: an opened topic keeps its labels clear. Dimmed topics drop their labels; a neighbour's label that would sit on
# the open topic's points moves above its circle, and hides if it still collides (the panel lists every neighbour).
rep('''      const shown = (b) => ks.open === b.id || HOT.has(b.id) || K >= KREF * 0.78 || (bNext(b.id) && K >= KREF * 0.6);''',
    '''      const litNow = ks.open ? new Set([ks.open, ...BALL[ks.open].parents, ...BALL[ks.open].children]) : null;
      const shown = (b) => litNow ? litNow.has(b.id) : (HOT.has(b.id) || K >= KREF * 0.78 || (bNext(b.id) && K >= KREF * 0.6));''')
rep('''        .attr("dominant-baseline", (d) => Math.abs(Math.cos(d.a)) > 0.3 ? "central" : Math.sin(d.a) < 0 ? "auto" : "hanging");
    }''', '''        .attr("dominant-baseline", (d) => Math.abs(Math.cos(d.a)) > 0.3 ? "central" : Math.sin(d.a) < 0 ? "auto" : "hanging");
      if (ks.open) declutter();
    }
    function declutter() {
      const ob = ks.open, hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1;
      const mine = ballSel.filter((b) => b.id === ob), rect = (n) => n.getBoundingClientRect();
      const own = [...mine.selectAll(".km-dot text").nodes(), mine.select(".km-body").node(), mine.select(".km-blab").node()].map(rect);
      const chrome = [...document.querySelectorAll("#kmap .km-bar > *, #kmap .km-legend")].filter((e) => e.offsetParent).map(rect);
      const placed = [], ts = Math.max(0.8, Math.min(1, K / KREF));
      ballSel.each(function (b) {
        const lab = d3.select(this).select(".km-blab");
        if (b.id === ob || lab.attr("display") === "none") return;
        const clear = () => { const r = rect(lab.node()); return !own.some((o) => hit(r, o)) && !placed.some((o) => hit(r, o)) && !chrome.some((o) => hit(r, o)) ? r : null; };
        let r = clear();
        if (!r) { lab.attr("y", -b.cur - 7 / K - (b.lines.length - 1) * LH * ts / K); r = clear(); }
        if (r) placed.push(r); else lab.attr("display", "none");
      });
    }''')
rep('''      if (fit) fitOpen(BALL[id]);''', '''      if (fit) fitOpen(BALL[id]);
      setTimeout(() => { if (ks.open === id) sizeText(); }, 1000);''')

# legend swatches in the new sky colours
rep('''    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#f4f2ec"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#2b3038" stroke="rgba(255,255,255,.82)" stroke-width="1"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.6" fill="#15181d" stroke="rgba(255,255,255,.22)" stroke-width="1"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ff5b4d" stroke-width="1.2"/><circle cx="8" cy="8" r="3.4" fill="#2b3038" stroke="rgba(255,255,255,.6)" stroke-width=".8"/>'),''',
    '''    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#f3f0e4"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#1a2e33" stroke="rgba(236,248,244,.86)" stroke-width="1"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.6" fill="#0b191c" stroke="rgba(200,232,226,.26)" stroke-width="1"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ff5a3c" stroke-width="1.3"/><circle cx="8" cy="8" r="3.4" fill="#1a2e33" stroke="rgba(236,248,244,.6)" stroke-width=".8"/>'),''')
rep('''Brighter means further along; the thin arc shows how much of a topic you've learned.''',
    '''Brighter means further along; the thin arc shows how much of a topic you've learned, and the outer dial has one tick for each of the ${KD.nodes.length} points, lit once learned.''')
rep('aria-label="Map of 30 Python topics on rings, basics in the centre"', 'aria-label="Star chart of 30 Python topics on rings, basics in the centre, with a dial of all points"')

# the tutor stays sticky beside the lesson on wide screens
css = open(f"{HERE}/app_v14.css").read() + '''
.card.tutor { position: sticky; }
@media (max-width: 1100px) { .card.tutor { position: relative; } }
'''
i = s.rindex("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.4 written:", len(s))

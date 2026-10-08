"""v1.8: languages (English and Simplified Chinese) and type set like the reference slide. Builds v1.7, then:
- adds the I18N runtime (i18n/i18n.js) with the Chinese pack (i18n/zh.json, built by i18n/make_zh.py)
- swaps topic, point and area names in the map data, and sizes map labels for Chinese characters
- asks the AI to write everything the learner reads in the learner's language
- adds a language button to the top bar, and the Montserrat and Noto Sans SC fonts"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); SCR = os.path.dirname(HERE)
subprocess.run([sys.executable, f"{HERE}/integrate8.py"], check=True)
subprocess.run([sys.executable, f"{HERE}/i18n/make_zh.py"], check=True)
p = f"{SCR}/learning-companion.html"; s = open(p).read()
def rep(a, b, count=1):
    global s
    assert s.count(a) == count, (a[:100], s.count(a)); s = s.replace(a, b)

rep("<title>Learning Companion v1.7</title>", "<title>Learning Companion v1.8</title>")
rep('<span class="pill">Python pilot / v1.7</span>', '<span class="pill">Python pilot / v1.8</span>')
rep('family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500',
    'family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Montserrat:wght@700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500')
# the language button, beside the test log
rep('''    <button class="quiet" id="log-btn" type="button" aria-controls="log" aria-expanded="false">Test log</button>''',
    '''    <button class="quiet lang-btn" id="lang-btn" type="button" data-i18n-skip aria-label="Switch language / 切换语言">中文</button>
    <button class="quiet" id="log-btn" type="button" aria-controls="log" aria-expanded="false">Test log</button>''')
# the runtime, first thing in the app script, with the Chinese pack inlined
pack = json.load(open(f"{HERE}/i18n/zh.json"))
runtime = open(f"{HERE}/i18n/i18n.js").read().replace("/*__ZH_PACK__*/null", json.dumps(pack, ensure_ascii=False, separators=(",", ":")))
rep('''  "use strict";\n''', '''  "use strict";\n''' + runtime + '''  I18N.start();
  { const lb = document.getElementById("lang-btn"); if (lb) { lb.textContent = I18N.lang === "zh" ? "EN" : "中文"; lb.onclick = () => I18N.set(I18N.lang === "zh" ? "en" : "zh"); } }
''')
# map data in the chosen language, before anything is laid out
rep('''    const SHORT = { atbs:''', '''    I18N.data(KD);
    const SHORT = { atbs:''')
# map labels: Chinese names wrap by width, and their width counts a character as ~1.9 letters
rep('''      b.lw = Math.max(...b.lines.map((l) => l.length)) * 7.1 / KREF;''',
    '''      if (I18N.cjk(b.name)) b.lines = I18N.split(b.name);
      b.lw = Math.max(...b.lines.map(I18N.units)) * 7.1 / KREF;''')
# search finds topics and points by either language's name
rep('''    el("km-names").innerHTML = [...KD.balls.map((b) => b.name), ...KD.nodes.map((n) => n.name)]''',
    '''    el("km-names").innerHTML = [...new Set([...KD.balls.map((b) => b.name), ...KD.nodes.map((n) => n.name), ...KD.balls.map((b) => b.name_en || ""), ...KD.nodes.map((n) => n.name_en || "")].filter(Boolean))]''')
rep('''      const b = KD.balls.find((x) => x.name.toLowerCase() === v); if (b) return openBall(b.id);''',
    '''      const named = (x) => [x.name, x.name_en || ""].map((w) => w.toLowerCase());
      const b = KD.balls.find((x) => named(x).includes(v)); if (b) return openBall(b.id);''')
rep('''      const n = KD.nodes.find((x) => x.name.toLowerCase() === v) || KD.nodes.find((x) => x.name.toLowerCase().includes(v));''',
    '''      const n = KD.nodes.find((x) => named(x).includes(v)) || KD.nodes.find((x) => named(x).some((w) => w.includes(v)));''')
# times in the test log in the chosen language
rep('''new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })''', '''new Date(e.at).toLocaleTimeString(I18N.lang === "zh" ? "zh-CN" : [], { hour: "2-digit", minute: "2-digit" })''')
# the AI writes in the learner's language
rep('''    sample = s; db = d;''', '''    sample = I18N.wrapAI(s); db = d;''')
css = open(f"{HERE}/app_v18.css").read()
i = s.rindex("</style>"); s = s[:i] + css + s[i:]
open(p, "w").write(s)
print("v1.8 written:", len(s))

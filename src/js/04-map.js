  // ---------- Knowledge map (v1.3; v2.0: drawn from the map the AI built for the open subject) ----------
  // Point-based view: the AI's points packed into topics. Brightness = learning status, red ring = the AI's suggested
  // route toward the learner's goal, white flare = the AI's top picks right now. Progress is saved with the subject.
  let kmResize = null;
  addEventListener("resize", () => { if (kmResize) kmResize(); });
  function knowledgeMap(KD, opts = {}) {
    const el = (id) => document.getElementById(id);
    d3.select("#km-svg").selectAll("*").remove();
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const AREA = {}; KD.areas.forEach(([id, name], i) => AREA[id] = { id, name, i });
    const byId = {}; KD.nodes.forEach((n) => { byId[n.id] = n; n.needs = []; n.helps = []; n.usedBy = []; });
    KD.links.forEach(([s, t, k]) => { if (!byId[s] || !byId[t]) return; if (k === "helps") byId[t].helps.push(s); else { byId[t].needs.push(s); byId[s].usedBy.push(t); } });
    const nm = (id) => byId[id].name;
    const ancestors = (id) => { const out = new Set(), st = [id]; while (st.length) { const x = st.pop(); for (const p of byId[x].needs) if (!out.has(p)) { out.add(p); st.push(p); } } return out; };
    const BALL = {}, BALL_OF = {};
    KD.balls.forEach((b) => { BALL[b.id] = b; b.parents = []; b.children = []; b.pts.forEach((p) => BALL_OF[p] = b.id); });
    KD.blinks.forEach(([s, t]) => { if (BALL[s] && BALL[t]) { BALL[t].parents.push(s); BALL[s].children.push(t); } });
    const bn = (id) => BALL[id].name;

    // progress lives in the subject's saved state: learned point ids and whether the glow is on
    let learned = new Set(), flashOn = true;
    function loadProgress() {
      const s = cur() || {};
      flashOn = s.flash !== false;
      learned = new Set((s.learned || []).filter((id) => byId[id]));
    }
    function persist(note) {
      const s = cur(); if (!s) return;
      s.learned = [...learned]; s.flash = flashOn;
      saveSubject();
      if (note) logEvent("map", note);
    }
    const commit = (note) => { persist(note); refresh(); if (opts.onChange) opts.onChange(); };

    // the AI's suggested route: the points it judged the learner's goal needs, plus everything they build on
    const GOAL = new Set(((KD.route && KD.route.goal) || []).filter((id) => byId[id]));
    const ROUTE = new Set(GOAL); GOAL.forEach((g) => ancestors(g).forEach((a) => ROUTE.add(a)));
    const routeWhy = (KD.route && KD.route.why) || {};
    const pStatus = (id) => learned.has(id) ? "learned" : byId[id].needs.every((p) => learned.has(p)) ? "ready" : "locked";
    const bStatus = (b) => { const pts = BALL[b].pts; if (pts.every((p) => learned.has(p))) return "learned"; return pts.some((p) => pStatus(p) === "ready") ? "ready" : "locked"; };
    const bOnRoute = (b) => BALL[b].pts.some((p) => ROUTE.has(p) && !learned.has(p));
    const pNext = (p) => ROUTE.has(p) && pStatus(p) === "ready";
    const bNext = (b) => bOnRoute(b) && BALL[b].pts.some(pNext);
    // the AI's top picks: suggested-next balls where the most route points can be started now; ties go to the ball that opens more of the route
    function hotBalls() {
      return KD.balls.map((b) => b.id).filter(bNext).map((id) => {
        const b = BALL[id];
        return { id, ready: b.pts.filter(pNext).length, opens: b.children.filter(bOnRoute).length, left: b.pts.filter((p) => ROUTE.has(p) && !learned.has(p)).length };
      }).sort((a, b) => (b.ready - a.ready) || (b.opens - a.opens) || (b.left - a.left)).slice(0, 3).map((x) => x.id);
    }
    let HOT = new Set();
    const STXT = { learned: "Learned", ready: "Can learn now", locked: "Not reachable yet" };

    // ----- layout (v1.3): topics sit on rings, basics at the centre and more advanced topics further out.
    // The angle keeps an area together and puts a topic near the topics it builds on. v2.0: rings are added as the
    // map needs them, each holding as many topics as its length has room for. -----
    const KREF = 0.74, FS = 13.5, LH = 16.5;
    // long names (written by the AI) wrap into a few short lines; what doesn't fit ends in "…", and the full name shows on hover
    function wrapName(name, maxU, maxLines) {
      // Chinese breaks between characters, other text between words; mixed text (Chinese with English terms) does both
      const toks = name.match(/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]|[^\s\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]+|\s+/g) || [name], lines = [];
      let cur = "";
      toks.forEach((t) => { const next = cur + t; if (cur.trim() && !/^\s+$/.test(t) && I18N.units(next.trim()) > maxU) { lines.push(cur.trim()); cur = t; } else cur = next; });
      if (cur.trim()) lines.push(cur.trim());
      if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,;:·、，]*$/, "") + "…"; }
      return lines;
    }
    KD.balls.forEach((b) => {
      const n = b.pts.length;
      b.r = 8 + 3.3 * Math.sqrt(n); b.cur = b.r;
      b.lines = I18N.cjk(b.name) && !/[A-Za-z]{3}/.test(b.name) && I18N.units(b.name) <= 32 ? I18N.split(b.name) : wrapName(b.name, 22, 3);
      b.lw = Math.max(...b.lines.map(I18N.units)) * 7.1 / KREF;
      b.lh = (b.lines.length * LH + 7) / KREF;
      b.dots = b.pts.map((id, i) => ({ id, ball: b.id, a: -Math.PI / 2 + i * 2 * Math.PI / n }));
    });
    // rings and the room between topics follow the labels this map actually has, so long names don't pile up
    const maxR = Math.max(...KD.balls.map((b) => b.r)), maxLh = Math.max(...KD.balls.map((b) => b.lh)), avgLw = KD.balls.reduce((n, b) => n + b.lw, 0) / KD.balls.length;
    const RING0 = Math.max(106, maxR * 2 + maxLh * 0.6, (Math.max(...KD.balls.map((b) => b.lw)) + avgLw) * 0.42), RING_GAP = Math.max(102, maxR * 2 + maxLh + 14), SPACING = Math.max(220, avgLw * 0.9 + 40);
    const RINGS = [0], CAP = [1];
    const ORDER = new Map(KD.balls.map((b, i) => [b.id, i]));   // topics come in the planners' order, from basics to advanced
    KD.balls.slice().sort((x, y) => (x.d - y.d) || (ORDER.get(x.id) - ORDER.get(y.id)))
      .forEach((b, i) => {
        let k = 0, c = CAP[0];
        while (i >= c) { k++; if (!RINGS[k]) { RINGS[k] = RING0 + RING_GAP * (k - 1); CAP[k] = Math.max(3, Math.round(2 * Math.PI * RINGS[k] / SPACING)); } c += CAP[k]; }
        b.ring = k;
      });
    const TAU = Math.PI * 2, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const areaAng = (a) => (AREA[a].i / KD.areas.length) * TAU - Math.PI / 2;
    const place = (b) => { const R = RINGS[b.ring]; b.x = R * Math.cos(b.a); b.y = R * Math.sin(b.a); };
    const byRing = []; KD.balls.forEach((b) => (byRing[b.ring] = byRing[b.ring] || []).push(b));
    byRing.forEach((list, k) => {
      if (!list) return;
      // the first ring is spread evenly in area order; further out, a topic sits near the topics it builds on
      if (k === 1) list.sort((x, y) => AREA[x.area].i - AREA[y.area].i).forEach((b, i) => b.ta = b.a = -Math.PI / 2 + i * TAU / list.length);
      else list.forEach((b) => {
        let sx = 0.35 * Math.cos(areaAng(b.area)), sy = 0.35 * Math.sin(areaAng(b.area));
        b.parents.forEach((p) => { const P = BALL[p]; if (P.ring && P.ring < k) { sx += Math.cos(P.a); sy += Math.sin(P.a); } });
        b.ta = b.a = Math.atan2(sy, sx);
      });
      if (k === 0) { list.forEach((b) => { b.a = 0; b.x = 0; b.y = 0; }); return; }
      // even spacing, in the order the topics would like to sit; the whole ring turns to stay closest to those wishes
      const n = list.length, step = TAU / n;
      list.sort((x, y) => x.ta - y.ta);
      let cx = 0, cy = 0; list.forEach((b, i) => { cx += Math.cos(b.ta - i * step); cy += Math.sin(b.ta - i * step); });
      const phi = Math.atan2(cy, cx);
      list.forEach((b, i) => b.a = phi + i * step);
      list.forEach((b) => { b.a = wrap(b.a); place(b); });
    });
    // labels sit under each topic: nudge topics along their ring until no label or circle overlaps another
    const boxOf = (b) => { const hw = Math.max(b.r, b.lw / 2) + 6; return [b.x - hw, b.y - b.r - 7, b.x + hw, b.y + b.r + b.lh]; };
    for (let it = 0; it < 500; it++) {
      let hit = 0;
      for (let i = 0; i < KD.balls.length; i++) for (let j = i + 1; j < KD.balls.length; j++) {
        const A = KD.balls[i], B = KD.balls[j], a = boxOf(A), c = boxOf(B);
        const ox = Math.min(a[2], c[2]) - Math.max(a[0], c[0]), oy = Math.min(a[3], c[3]) - Math.max(a[1], c[1]);
        if (ox <= 0 || oy <= 0) continue;
        hit++;
        for (const [P, Q] of [[A, B], [B, A]]) {
          if (!P.ring) continue;
          const tx = -Math.sin(P.a), ty = Math.cos(P.a);
          const dir = Math.sign((P.x - Q.x) * tx + (P.y - Q.y) * ty) || (P === A ? 1 : -1);
          const need = Math.min(Math.abs(tx) > 0.08 ? ox / Math.abs(tx) : 1e9, Math.abs(ty) > 0.08 ? oy / Math.abs(ty) : 1e9);
          P.a = wrap(P.a + dir * Math.min(need * (Q.ring ? 0.5 : 1) * 0.6 + 0.5, 24) / RINGS[P.ring]);
          place(P);
        }
      }
      if (!hit) break;
    }
    // whatever labels still overlap, topics themselves never do: a last pass looks at the circles alone
    // (labels that would still collide are hidden at drawing time and appear as the learner zooms in)
    for (let it = 0; it < 400; it++) {
      let hit = 0;
      for (let i = 0; i < KD.balls.length; i++) for (let j = i + 1; j < KD.balls.length; j++) {
        const A = KD.balls[i], B = KD.balls[j], gap = Math.hypot(A.x - B.x, A.y - B.y) - (A.r + B.r + 16);
        if (gap >= 0) continue;
        hit++;
        for (const [P, Q] of [[A, B], [B, A]]) {
          if (!P.ring) continue;
          const tx = -Math.sin(P.a), ty = Math.cos(P.a), dir = Math.sign((P.x - Q.x) * tx + (P.y - Q.y) * ty) || (P === A ? 1 : -1);
          P.a = wrap(P.a + dir * Math.min(-gap * 0.6 + 0.5, 24) / RINGS[P.ring]);
          place(P);
        }
      }
      if (!hit) break;
    }

    // ----- drawing -----
    const svg = d3.select("#km-svg"), defs = svg.append("defs"), root = svg.append("g");
    svg.attr("aria-label", "Knowledge map of " + KD.balls.length + " topics on rings, basics in the centre, with a dial of all " + KD.nodes.length + " points");
    const glowG = defs.append("radialGradient").attr("id", "km-glowg");
    [[0, 0.95], [0.32, 0.42], [0.62, 0.12], [1, 0]].forEach(([o, a]) => glowG.append("stop").attr("offset", o).attr("stop-color", "#fff").attr("stop-opacity", a));
    [["km-m-learned", [[0, "#ffffff"], [0.65, "#fcfbf9"], [1, "#eeebe6"]]], ["km-m-ready", [[0, "#f5f3ef"], [1, "#e0dbd4"]]], ["km-m-locked", [[0, "#d4cec5"], [1, "#c2bbb1"]]]]
      .forEach(([id, st]) => { const m = defs.append("radialGradient").attr("id", id).attr("cx", "38%").attr("cy", "32%").attr("r", "78%"); st.forEach(([o, c]) => m.append("stop").attr("offset", o).attr("stop-color", c)); });
    const gR = root.append("g"), gL = root.append("g"), gB = root.append("g");
    RINGS.slice(1).forEach((R, i) => gR.append("circle").attr("class", "km-ring").attr("r", R).attr("pathLength", 1).style("animation-delay", (i * 0.08) + "s"));
    // the dial: one tick per point, ordered by the bearing of its topic, so lit ticks gather where the learner has been
    const DIAL = RINGS[RINGS.length - 1] + 82, bearing = (b) => b.ring ? (b.a + Math.PI / 2 + 2 * TAU) % TAU : -1;
    const DIALPTS = KD.balls.slice().sort((x, y) => bearing(x) - bearing(y)).flatMap((b) => b.pts);
    const gD = gR.append("g").attr("class", "km-dial");
    gD.append("circle").attr("class", "km-dialring").attr("r", DIAL).attr("pathLength", 1).style("animation-delay", ".3s");
    const dialTicks = gD.selectAll("line").data(DIALPTS).join("line").attr("class", "km-tick")
      .each(function (pid, i) { const a = -Math.PI / 2 + i * TAU / DIALPTS.length, c = Math.cos(a), si = Math.sin(a), L = BALL_OF[pid] !== BALL_OF[DIALPTS[i - 1]] ? 13 : 7;
        d3.select(this).attr("x1", c * (DIAL + 3)).attr("y1", si * (DIAL + 3)).attr("x2", c * (DIAL + 3 + L)).attr("y2", si * (DIAL + 3 + L)); })
      .style("animation-delay", (pid, i) => (0.25 + i * Math.min(0.004, 0.6 / DIALPTS.length)).toFixed(3) + "s");
    const dialText = gD.append("text").attr("class", "km-dialtext").attr("text-anchor", "middle");
    const dialNum = dialText.append("tspan").attr("class", "n");
    dialText.append("tspan").text(" of " + KD.nodes.length + " points learned");
    let K = 1;
    const trimTo = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * d, p[1] + dy / L * d]; };
    function linkPath([s, t]) {
      const a = BALL[s], b = BALL[t], c = [(a.x + b.x) / 2 * 0.88, (a.y + b.y) / 2 * 0.88];
      const p0 = trimTo([a.x, a.y], c, a.cur + 7 / K), p1 = trimTo([b.x, b.y], c, b.cur + 7 / K);
      return `M${p0}Q${c} ${p1}`;
    }
    const BLINKS = KD.blinks.filter(([s, t]) => BALL[s] && BALL[t]);
    const linkSel = gL.selectAll("path").data(BLINKS).join("path").attr("class", "km-blk");
    const ballSel = gB.selectAll("g.km-ball").data(KD.balls).join("g").attr("class", "km-ball").attr("transform", (b) => `translate(${b.x},${b.y})`);
    ballSel.append("circle").attr("class", "km-glow").attr("fill", "url(#km-glowg)");
    ballSel.append("circle").attr("class", "km-lens");
    ballSel.append("g").attr("class", "km-srings");
    ballSel.append("g").attr("class", "km-plinks");
    ballSel.append("circle").attr("class", "km-ping");
    ballSel.append("circle").attr("class", "km-ping p2");
    ballSel.append("circle").attr("class", "km-flare");
    ballSel.append("circle").attr("class", "km-halo");
    ballSel.append("circle").attr("class", "km-body");
    ballSel.append("path").attr("class", "km-arc");
    ballSel.append("circle").attr("class", "km-hit");
    const dotSel = ballSel.append("g").attr("class", "km-dots").selectAll("g.km-dot").data((b) => b.dots).join("g")
      .attr("class", "km-dot").attr("transform", "translate(0,0)").style("opacity", 0);
    dotSel.append("title").text((d) => nm(d.id));
    dotSel.append("circle").attr("class", "km-halo");
    dotSel.append("circle").attr("class", "km-core");
    dotSel.append("text").attr("data-ai", "").attr("text-anchor", "middle").attr("dominant-baseline", "hanging")
      .selectAll("tspan").data((d) => (d.lines = wrapName(nm(d.id), 20, 2))).join("tspan").attr("x", 0).text((l) => l);
    ballSel.append("title").text((b) => b.name);
    const blab = ballSel.append("text").attr("class", "km-blab").attr("data-ai", "").attr("text-anchor", "middle");
    blab.selectAll("tspan").data((b) => b.lines).join("tspan").attr("x", 0).text((l) => l);
    const bcount = ballSel.append("text").attr("class", "km-prog").attr("text-anchor", "middle");

    const arcD = (R, f) => { const t = f * TAU; return `M0,${-R}A${R},${R} 0 ${f > 0.5 ? 1 : 0} 1 ${(R * Math.sin(t)).toFixed(2)},${(-R * Math.cos(t)).toFixed(2)}`; };
    const doneOf = (b) => b.pts.filter((p) => learned.has(p)).length;
    // everything that depends on the zoom (text, rings, gaps) is sized in screen pixels, so it looks the same at any zoom
    // each topic's parts, looked up once: the zoom resizes them many times a second
    ballSel.each(function (b) { const g = d3.select(this); b.$ = { glow: g.select(".km-glow"), halo: g.select(".km-halo"), ring: g.selectAll(".km-ping, .km-flare"), body: g.select(".km-body"), hit: g.select(".km-hit"), arc: g.select(".km-arc"), lab: g.select(".km-blab"), prog: g.select(".km-prog") }; });
    function geom(sel) {
      sel.each(function (b) {
        const $ = b.$, R = b.cur, open = ks.open === b.id, f = doneOf(b) / b.pts.length;
        $.glow.attr("r", R + 26 / K);
        $.halo.attr("r", R + 4.5 / K);
        $.ring.attr("r", R + 9.5 / K);
        $.body.attr("r", R);
        $.hit.attr("r", R + 9 / K);
        $.arc.attr("d", f > 0 && f < 1 ? arcD(R, f) : null);
        const lab = $.lab;
        if (open) {
          lab.attr("font-size", 14 / K).attr("stroke-width", 3.6 / K).attr("y", R + 19 / K); lab.selectAll("tspan").attr("dy", (l, i) => i ? 17 / K : 0);
          $.prog.attr("font-size", 11 / K).attr("y", 4 / K);
        } else {
          const ts = Math.max(0.8, Math.min(1, K / KREF)); // below the zoom the layout was spaced for, labels shrink a little instead of overlapping
          lab.attr("font-size", FS * ts / K).attr("stroke-width", 3.6 / K).attr("y", R + (5 + 13 * ts) / K); lab.selectAll("tspan").attr("dy", (l, i) => i ? LH * ts / K : 0);
        }
      });
    }
    function sizeText() {
      dialText.attr("font-size", 14 / K).attr("y", -DIAL + 22 + 14 / K).attr("display", ks.open ? "none" : null);
      const litNow = ks.open ? new Set([ks.open, ...BALL[ks.open].parents, ...BALL[ks.open].children]) : null;
      const shown = (b) => litNow ? litNow.has(b.id) : (HOT.has(b.id) || K >= KREF * 0.76 || (bNext(b.id) && K >= KREF * 0.6));
      blab.attr("display", (b) => shown(b) ? null : "none");
      bcount.attr("display", (b) => ks.open === b.id ? null : "none");
      geom(ballSel);
      linkSel.attr("d", linkPath);
      if (ks.open) { const od = dotSel.filter((d) => d.ball === ks.open); od.select(".km-core").attr("r", 6 / K); od.select(".km-halo").attr("r", 10 / K); }
      if (ks.open && !BALL[ks.open].blooming) placeSub(BALL[ks.open], K, false);
      declutter();
    }
    // labels that would collide are moved above their topic, or hidden until the learner zooms in;
    // top picks and route topics get their place first.
    // v2.2: the boxes are worked out from the layout the page already knows, with text widths measured once on a canvas.
    // Asking the browser for each label's box forced a full layout per label on every zoom step, which made zooming lag.
    const textW = (() => {
      const ctx = document.createElement("canvas").getContext("2d"), cache = new Map(); let font = null;
      if (document.fonts) document.fonts.addEventListener("loadingdone", () => { cache.clear(); font = null; });
      return (str) => {
        if (!font) { const n = gB.select(".km-blab").node(), cs = n && getComputedStyle(n); font = cs ? cs.fontWeight + " 100px " + cs.fontFamily : "600 100px sans-serif"; }
        let w = cache.get(str);
        if (w == null) { w = ctx ? (ctx.font = font, ctx.measureText(str).width / 100) : I18N.units(str) * 0.53; cache.set(str, w); }
        return w;   // width at a font size of 1
      };
    })();
    const textBox = (cx, top, lines, f, lh) => { const w = Math.max(...lines.map(textW)) * f; return [cx - w / 2, top, cx + w / 2, top + (lines.length - 1) * lh + 1.2 * f]; };
    let chromeScreen = [], svgScreen = null;   // the glass bar and legend over the map, in screen pixels; measured on refresh and resize
    const measureChrome = () => {
      svgScreen = svg.node().getBoundingClientRect();
      chromeScreen = [...document.querySelectorAll("#kmap .km-bar > *, #kmap .km-legend")].filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect());
    };
    function declutter() {
      const ob = ks.open, ts = Math.max(0.8, Math.min(1, K / KREF)), e = 1 / K;
      const hit = (a, c) => Math.min(a[2], c[2]) - Math.max(a[0], c[0]) > e && Math.min(a[3], c[3]) - Math.max(a[1], c[1]) > e;
      const circ = (b) => [b.x - b.cur, b.y - b.cur, b.x + b.cur, b.y + b.cur];
      let own;
      if (ob) {
        const b = BALL[ob], at = new Map(((b.sub && b.sub.pts) || []).map((p) => [p.id, p]));
        own = [circ(b), textBox(b.x, b.y + b.cur + 19 / K - 14 / K * 0.92, b.lines, 14 / K, 17 / K)];
        b.dots.forEach((d) => { const p = at.get(d.id); if (p) own.push(textBox(b.x + p.x / K, b.y + p.y / K + 13 / K, d.lines, 12.5 / K, 15 / K)); });
      } else own = KD.balls.map(circ);
      // the glass bar and legend, from screen pixels into the map's coordinates
      const t = d3.zoomTransform(svg.node()), sx = (x) => (x - (svgScreen ? svgScreen.left : 0) - t.x) / t.k, sy = (y) => (y - (svgScreen ? svgScreen.top : 0) - t.y) / t.k;
      const chrome = chromeScreen.map((r) => [sx(r.left), sy(r.top), sx(r.right), sy(r.bottom)]);
      const rank = (b) => (HOT.has(b.id) ? 0 : bOnRoute(b.id) ? 1 : 2);
      const placed = [], f = FS * ts / K, lh = LH * ts / K;
      KD.balls.slice().sort((x, y) => rank(x) - rank(y)).forEach((b) => {
        const lab = b.$.lab;
        if (b.id === ob || lab.attr("display") === "none") return;
        const clear = (r) => !own.some((o) => hit(r, o)) && !placed.some((o) => hit(r, o)) && !chrome.some((o) => hit(r, o));
        let r = textBox(b.x, b.y + b.cur + (5 + 13 * ts) / K - 0.92 * f, b.lines, f, lh);
        if (!clear(r)) {
          const y = -b.cur - 7 / K - (b.lines.length - 1) * lh;
          r = textBox(b.x, b.y + y - 0.92 * f, b.lines, f, lh);
          if (clear(r)) lab.attr("y", y); else r = null;
        }
        if (r) placed.push(r); else lab.attr("display", "none");
      });
    }
    // ----- an open topic (v2.2): a small map of its own, centred on the topic and laid over the big one, its points
    // linked in the same style as topics. Laid out in screen pixels, so it reads the same at any zoom. -----
    function subOf(b) {
      const node = svg.node(), h = node.clientHeight || 700, ids = new Set(b.pts), order = new Map(b.pts.map((p, i) => [p, i]));
      const inNeeds = (p) => byId[p].needs.filter((q) => ids.has(q));
      const depth = {}, dOf = (p, seen = new Set()) => { if (depth[p] != null) return depth[p]; if (seen.has(p)) return 1; seen.add(p); depth[p] = 1 + inNeeds(p).reduce((m, q) => Math.max(m, dOf(q, seen)), 0); return depth[p]; };
      b.pts.forEach((p) => dOf(p));
      // the points wind outward from the topic on a gentle spiral, in the order they can be learned: what needs nothing
      // else in the topic closest in, what builds on it further out, so most links are short and run outward
      const seq = b.pts.slice().sort((x, y) => depth[x] - depth[y] || order.get(x) - order.get(y));
      const Rs = 30, R0 = 112, TURN = 112, SP = 158;   // the disc, where the spiral starts, the room between turns and between points
      const c = TURN / (2 * Math.PI), pos = {};
      let a = -Math.PI / 2;
      seq.forEach((p, i) => { const r = R0 + c * (a + Math.PI / 2); pos[p] = { id: p, x: r * Math.cos(a), y: r * Math.sin(a), r }; a += SP / r; });
      const Rmax = d3.max(Object.values(pos), (q) => q.r);
      const fit = Math.min(1, ((h - TOP - BOTTOM) / 2 - 24) / (Rmax + 70));   // a large topic shrinks to fit the view
      Object.values(pos).forEach((q) => { q.x *= fit; q.y *= fit; });
      const rings = []; for (let r = R0; r <= Rmax + 1; r += TURN) rings.push(r * fit);
      return { Rs, rings, lens: (Rmax + 70) * fit, pts: b.pts.map((p) => pos[p]) };
    }
    function placeSub(b, k, animate) {
      const F = b.sub; if (!F) return;
      const g = ballSel.filter((x) => x === b), at = new Map(F.pts.map((p) => [p.id, p]));
      const sel = dotSel.filter((d) => d.ball === b.id);
      const tf = (d) => `translate(${at.get(d.id).x / k},${at.get(d.id).y / k})`;
      if (animate) sel.transition("bloom").duration(reduceMotion() ? 0 : 560).delay((d, i) => reduceMotion() ? 0 : 80 + i * 16).ease(d3.easeCubicOut).attr("transform", tf).style("opacity", 1);
      else sel.interrupt("bloom").attr("transform", tf).style("opacity", 1);
      const PLH = 15 / K;
      sel.select("text").attr("font-size", 12.5 / K).attr("stroke-width", 3.6 / K).selectAll("tspan").attr("y", (l, i) => 13 / K + i * PLH);
      g.select(".km-lens").attr("r", F.lens / k);
      g.select(".km-srings").selectAll("circle").data(F.rings).join("circle").attr("r", (r) => r / k);
      // links between the topic's points, drawn the way topics are linked on the big map
      const L = [];
      b.pts.forEach((p) => byId[p].needs.forEach((q) => { if (at.has(q)) L.push([q, p]); }));
      g.select(".km-plinks").selectAll("path").data(L).join("path").attr("class", (l) => "km-plk" + (ks.point && (l[0] === ks.point || l[1] === ks.point) ? " lit" : ""))
        .attr("d", ([q, p]) => {
          const a = at.get(q), c = at.get(p), m = [(a.x + c.x) / 2 * 0.93 / k, (a.y + c.y) / 2 * 0.93 / k];
          const p0 = trimTo([a.x / k, a.y / k], m, 10 / k), p1 = trimTo([c.x / k, c.y / k], m, 10 / k);
          return `M${p0}Q${m} ${p1}`;
        });
    }
    const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    function grow(b, R) {
      const g = ballSel.filter((x) => x === b), i = d3.interpolate(b.cur, R);
      g.transition("grow").duration(reduceMotion() ? 0 : 480).ease(d3.easeCubicOut)
        .tween("grow", () => (t) => { b.cur = i(t); geom(g); linkSel.attr("d", linkPath); });
    }
    function bloom(b, on) {
      if (on) {
        b.blooming = true; placeSub(b, b.kOpen, true);
        setTimeout(() => { b.blooming = false; if (ks.open === b.id) sizeText(); }, reduceMotion() ? 0 : 560 + b.pts.length * 18);
        return;
      }
      const g = ballSel.filter((x) => x === b);
      g.select(".km-lens").attr("r", 0); g.select(".km-srings").selectAll("circle").remove(); g.select(".km-plinks").selectAll("path").remove();
      dotSel.filter((d) => d.ball === b.id).transition("bloom").duration(reduceMotion() ? 0 : 240).ease(d3.easeCubicOut).attr("transform", "translate(0,0)").style("opacity", 0);
    }
    // v2.2: the zoom resizes text at most once a frame, and the top picks' pulse pauses while the map moves
    let sizeQueued = 0, moveTimer = 0;
    const zoom = d3.zoom().scaleExtent([0.2, 8]).on("zoom", (e) => {
      root.attr("transform", e.transform);
      if (e.sourceEvent) { el("kmap").classList.add("km-moving"); clearTimeout(moveTimer); moveTimer = setTimeout(() => el("kmap").classList.remove("km-moving"), 250); }
      if (Math.abs(e.transform.k - K) > 1e-3) { K = e.transform.k; if (!sizeQueued) sizeQueued = requestAnimationFrame(() => { sizeQueued = 0; sizeText(); }); }
    }).on("end", () => { if (sizeQueued) { cancelAnimationFrame(sizeQueued); sizeQueued = 0; sizeText(); } });
    svg.call(zoom).on("dblclick.zoom", null);
    const TOP = 44, BOTTOM = 34; // the search bar and the legend are glass, so the map may run under their edges
    function fitTo(t, ms = 450) { (ms && !reduceMotion() ? svg.transition().duration(ms) : svg).call(zoom.transform, t); }
    function fitBox(x0, y0, x1, y1, ms) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return;
      const ih = h - TOP - BOTTOM, k = Math.min(3.2, 0.94 * Math.min(w / (x1 - x0), ih / (y1 - y0)));
      fitTo(d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, TOP + ih / 2 - k * (y0 + y1) / 2).scale(k), ms);
    }
    function fitBalls(ids, ms) {
      if (!ids) { const Ex = d3.max(KD.balls, (b) => Math.abs(b.x) + Math.max(b.r, b.lw / 2)) + 6, Ey = d3.max(KD.balls, (b) => Math.max(b.r - b.y, b.y + b.r + b.lh)) + 6; return fitBox(-Ex, -Ey, Ex, Ey, ms); }
      const bs = KD.balls.filter((b) => ids.has(b.id)), hw = (b) => Math.max(b.r, b.lw / 2) + 8;
      fitBox(d3.min(bs, (b) => b.x - hw(b)), d3.min(bs, (b) => b.y - b.r - 10), d3.max(bs, (b) => b.x + hw(b)), d3.max(bs, (b) => b.y + b.r + b.lh), ms);
    }
    // the zoom an open topic is shown at, and where it sits: the disc and its points centred together in the free space
    function openZoom(b) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return null;
      b.sub = subOf(b);
      const k = 1.4;
      return { k, t: d3.zoomIdentity.translate(w / 2 - k * b.x, TOP + (h - TOP - BOTTOM) / 2 - k * b.y).scale(k) };
    }
    function fitOpen(b) { const z = openZoom(b); if (!z) return; b.kOpen = z.k; fitTo(z.t); }

    // ----- state -----
    const ks = { open: null, point: null, focus: null, shown: false };
    function refresh() {
      measureChrome();
      HOT = new Set(hotBalls());
      el("kmap").classList.toggle("km-flashon", flashOn);
      el("kmap").classList.toggle("km-opened", !!ks.open);
      gB.selectAll(".km-plk").classed("lit", (l) => !!ks.point && (l[0] === ks.point || l[1] === ks.point));
      const fb = el("km-flash"); fb.setAttribute("aria-pressed", flashOn ? "true" : "false"); fb.querySelector("span").innerHTML = flashOn ? '<b class="km-wide">Top picks glowing</b><b class="km-narrow">Glow on</b>' : "Glow off";
      ballSel.attr("class", (b) => "km-ball st-" + bStatus(b.id) + (bOnRoute(b.id) ? " route" : "") + (bNext(b.id) ? " next" : "") + (HOT.has(b.id) ? " hot" : "") + (ks.open === b.id ? " open" : ""));
      dotSel.attr("class", (d) => "km-dot st-" + pStatus(d.id) + (ROUTE.has(d.id) && !learned.has(d.id) ? " route" : "") + (pNext(d.id) ? " next" : "") + (ks.point === d.id ? " sel" : ""));
      bcount.text((b) => `${doneOf(b)} / ${b.pts.length}`);
      dialTicks.classed("on", (pid) => learned.has(pid)); dialNum.text(learned.size);
      sizeText(); paintFocus(); renderMine();
      if (ks.point) renderPoint(ks.point); else if (ks.open) renderBall(ks.open);
    }
    function paintFocus() {
      const lit = ks.focus || (ks.open ? new Set([ks.open, ...BALL[ks.open].parents, ...BALL[ks.open].children]) : null);
      svg.classed("dimmed", !!lit);
      ballSel.classed("lit", (b) => !!lit && lit.has(b.id));
      linkSel.classed("lit", ([s, t]) => !!ks.open && (s === ks.open || t === ks.open));
    }
    function collapse() { if (!ks.open) return; const b = BALL[ks.open]; ks.open = null; grow(b, b.r); bloom(b, false); }
    function openBall(id, fit = true) {
      if (ks.open !== id) { collapse(); ks.open = id; const b = BALL[id], z = openZoom(b); if (!z) b.sub = subOf(b); b.kOpen = z ? z.k : K; grow(b, b.sub.Rs / b.kOpen); bloom(b, true); }
      ks.focus = null; ks.point = null;
      el("km-focus").classList.remove("on");
      gB.selectAll("g.km-ball").filter((b) => b.id === id).raise();
      refresh(); renderBall(id); tab("det");
      if (fit) fitOpen(BALL[id]);
      setTimeout(() => { if (ks.open === id) sizeText(); }, 1000);
    }
    function closeBall() { if (!ks.open) return; collapse(); ks.point = null; refresh(); }
    function showPoint(id) { if (ks.open !== BALL_OF[id]) openBall(BALL_OF[id]); ks.point = id; refresh(); renderPoint(id); tab("det"); }
    function setFocus(ids, label) {
      closeBall(); ks.focus = ids;
      el("km-focus").classList.toggle("on", !!ids); el("km-focustext").textContent = label || "";
      paintFocus(); if (ids) fitBalls(ids);
    }
    el("km-clear").onclick = () => { setFocus(null); fitBalls(null); };
    el("km-fit").onclick = () => { closeBall(); setFocus(null); tab("mine"); fitBalls(null); };
    el("km-flash").onclick = () => { flashOn = !flashOn; persist(); refresh(); };

    // ----- interaction -----
    const tip = el("km-tip");
    function showTip(e, html) {
      if (e.pointerType === "touch") return;
      tip.innerHTML = html; tip.style.display = "block";
      const r = svg.node().parentNode.getBoundingClientRect();
      let x = e.clientX - r.left + 14; if (x + 270 > r.width) x = e.clientX - r.left - 274;
      tip.style.left = x + "px"; tip.style.top = (e.clientY - r.top + 14) + "px";
    }
    ballSel.select(".km-hit").on("pointermove", (e, b) => { if (ks.open === b.id) return tip.style.display = "none"; showTip(e, `<b data-ai>${esc(b.name)}</b><span>${STXT[bStatus(b.id)]} · ${doneOf(b)} of ${b.pts.length} points learned${bOnRoute(b.id) ? " · on the AI route" : ""}${HOT.has(b.id) ? " · top pick" : ""}</span>`); })
      .on("pointerleave", () => tip.style.display = "none")
      .on("click", (e, b) => { e.stopPropagation(); tip.style.display = "none"; if (ks.open === b.id) { ks.point = null; refresh(); renderBall(b.id); tab("det"); } else openBall(b.id); });
    dotSel.on("pointermove", (e, d) => { if (ks.open === BALL_OF[d.id]) showTip(e, `<b data-ai>${esc(nm(d.id))}</b><span>${STXT[pStatus(d.id)]}${ROUTE.has(d.id) && !learned.has(d.id) ? " · on the AI route" : ""}</span>`); })
      .on("pointerleave", () => tip.style.display = "none")
      .on("click", (e, d) => { e.stopPropagation(); if (ks.open === BALL_OF[d.id]) showPoint(d.id); });
    svg.on("click", () => { if (ks.open) { closeBall(); tab("mine"); } });
    const q = el("km-q");
    q.value = "";
    el("km-names").innerHTML = [...new Set([...KD.balls.map((b) => b.name), ...KD.nodes.map((n) => n.name), ...KD.balls.map((b) => b.name_en), ...KD.nodes.map((n) => n.name_en)].filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((n) => `<option value="${esc(n)}">`).join("");
    q.onchange = () => {
      const v = q.value.trim().toLowerCase(); if (!v) return;
      const nms = (x) => [x.name, x.name_en || ""].map((w) => w.toLowerCase());
      const b = KD.balls.find((x) => nms(x).includes(v)); if (b) return openBall(b.id);
      const n = KD.nodes.find((x) => nms(x).includes(v)) || KD.nodes.find((x) => nms(x).some((w) => w && w.includes(v)));
      if (n) showPoint(n.id);
    };

    // ----- panel -----
    const TABS = ["mine", "det", "src"];
    function tab(which) { TABS.forEach((k) => { el("km-t-" + k).setAttribute("aria-selected", k === which ? "true" : "false"); el("km-p-" + k).hidden = k !== which; }); }
    TABS.forEach((k) => el("km-t-" + k).onclick = () => tab(k));
    const bpill = (id) => `<button class="km-pill${bNext(id) ? " next" : ""}${HOT.has(id) ? " hot" : ""}" data-ball="${id}" type="button" data-ai>${esc(bn(id))}</button>`;
    const ppill = (id) => `<button class="km-pill" data-point="${id}" type="button" data-ai>${esc(nm(id))}</button>`;
    const sw = (inner) => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${inner}</svg>`;
    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#fff" stroke="rgba(13,15,12,.3)" stroke-width=".8"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#ebe7e1" stroke="#0d0f0c" stroke-width="1.2"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.8" fill="#c8c1b7"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ae574f" stroke-width="1.7"/><circle cx="8" cy="8" r="3.4" fill="#ebe7e1" stroke="#0d0f0c" stroke-width=".9"/>'),
      glow: sw('<circle cx="8" cy="8" r="6" fill="none" stroke="rgba(13,15,12,.45)" stroke-width="3.8"/><circle cx="8" cy="8" r="6" fill="none" stroke="#fff" stroke-width="2.6"/><circle cx="8" cy="8" r="2.8" fill="#ebe7e1" stroke="#0d0f0c" stroke-width=".9"/>') };
    el("km-legend").innerHTML = `<span>${SKY.learned}Learned</span><span>${SKY.ready}Can learn</span><span>${SKY.locked}Not yet</span><i class="km-sep"></i><span>${SKY.route}AI route</span><span>${SKY.glow}Top pick</span>`;
    el("km-legend").classList.add("km-glass");

    // a pie of points learned: the learned slice is pulled out, as in a printed chart; a fine grain gives the fills a paper texture
    function pie(f) {
      const R = 38, a = f * TAU, big = f > 0.5 ? 1 : 0, mid = a / 2 - Math.PI / 2, ox = (6 * Math.cos(mid)).toFixed(2), oy = (6 * Math.sin(mid)).toFixed(2);
      const x1 = (R * Math.sin(a)).toFixed(2), y1 = (-R * Math.cos(a)).toFixed(2);
      const on = f <= 0 ? "" : f >= 1 ? `<circle class="pie-on" r="${R}"/>` : `<path class="pie-on" transform="translate(${ox},${oy})" d="M0,0L0,${-R}A${R},${R} 0 ${big} 1 ${x1},${y1}Z"/>`;
      const off = f >= 1 ? "" : f <= 0 ? `<circle class="pie-off" r="${R}"/>` : `<path class="pie-off" d="M0,0L${x1},${y1}A${R},${R} 0 ${1 - big} 1 0,${-R}Z"/>`;
      return `<svg class="km-pie" viewBox="-46 -46 92 92" role="img" aria-label="${Math.round(100 * f)}% of points learned"><defs><filter id="km-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".42" intercept=".68"/><feFuncG type="linear" slope=".42" intercept=".68"/><feFuncB type="linear" slope=".42" intercept=".68"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/><feBlend in2="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#km-grain)">${off}${on}</g></svg>`;
    }
    let notesMode = false;
    function renderMine() {
      if (notesMode && opts.notesIndex) { el("km-p-mine").innerHTML = opts.notesIndex(); return; }
      const s = cur() || {};
      const bc = { learned: 0, ready: 0, locked: 0 }; KD.balls.forEach((b) => bc[bStatus(b.id)]++);
      const hot = [...HOT];
      const next = KD.balls.map((b) => b.id).filter((b) => bNext(b) && !HOT.has(b));
      const off = KD.balls.map((b) => b.id).filter((b) => !bNext(b) && bStatus(b) === "ready");
      const pick = (id) => { const b = BALL[id], ready = b.pts.filter(pNext).length;
        return `<button class="km-pick${HOT.has(id) ? " hot" : bNext(id) ? " next" : ""}" data-ball="${id}" type="button"><i></i><b data-ai>${esc(b.name)}</b><span>${ready} ready</span></button>`; };
      el("km-p-mine").innerHTML = `
        <p class="km-eyebrow">${esc(I18N.t("Goal"))}</p><h2 data-ai>${esc(s.name || KD.subject || "")}</h2>
        ${s.goal ? `<p class="km-small km-goal" data-ai>${esc(s.goal)}</p>` : ""}
        <div class="km-stat">${pie(learned.size / KD.nodes.length)}<div class="km-big"><b>${learned.size}</b><span>of ${KD.nodes.length} points learned</span></div></div>
        <div class="km-trio"><span><b>${bc.learned}</b> topics done</span><span><b>${bc.ready}</b> open now</span><span><b>${bc.locked}</b> not yet</span></div>
        <h3>AI's top picks${flashOn ? " · glowing on the map" : ""}</h3>
        ${hot.length ? `<div class="km-picks">${hot.map(pick).join("")}</div>` : `<p class="km-empty">Nothing on the route is reachable right now.</p>`}
        ${next.length ? `<h3>Also on your route</h3><div class="km-links">${next.map((id) => `<button class="next" data-ball="${id}" type="button" data-ai>${esc(bn(id))}</button>`).join("")}</div>` : ""}
        ${off.length ? `<h3>Open, off the route</h3><div class="km-links">${off.map((id) => `<button data-ball="${id}" type="button" data-ai>${esc(bn(id))}</button>`).join("")}</div>` : ""}
        <div class="km-foot">
          <span>${esc(I18N.t("Topics sit on rings: the basics in the centre, more advanced topics further out. Brighter means further along; the thin arc shows how much of a topic you've learned, and the outer dial has one tick for each point, lit once learned. The red ring is the AI's suggested route toward your goal: the points it judged your goal needs, and the points they build on. Top picks are where you can start the most route points now. It's a suggestion; open any topic you like."))}</span>
          <div class="km-btns"><button class="km-btn" type="button" data-act="flash">${flashOn ? "Turn the glow off" : "Turn the glow on"}</button><button class="km-btn" type="button" data-act="clear">Clear progress</button></div>
        </div>`;
    }
    const whereRows = (xs) => (xs || []).map((w) => `<div class="km-src"><b data-ai>${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(w.title)}</a>` : esc(w.title)}</b>${w.detail ? `<span data-ai>${esc(w.detail)}</span>` : ""}</div>`).join("");
    function renderBall(id) {
      const b = BALL[id], st = bStatus(id), done = b.pts.filter((p) => learned.has(p)).length, r = b.pts.filter((p) => ROUTE.has(p)).length;
      const prow = (p) => { const s = pStatus(p); return `<div class="km-prow"><input type="checkbox" data-mark="${p}" ${learned.has(p) ? "checked" : ""} aria-label="Learned: ${esc(nm(p))}">
        <button class="km-nm" data-point="${p}" type="button"><span data-ai>${esc(nm(p))}</span>${opts.noteMarks ? opts.noteMarks(p) : ""}</button>
        <span class="km-tag ${pNext(p) ? "route" : s}">${pNext(p) ? "next" : s === "learned" ? "learned" : s === "ready" ? "can learn" : "not yet"}</span></div>`; };
      const rel = (ids) => ids.length ? `<div class="km-ex">${ids.map(bpill).join("")}</div>` : `<p class="km-empty">None.</p>`;
      const why = routeWhy[id];
      el("km-p-det").innerHTML = `
        <button class="km-back" type="button" data-act="overview">← Overview</button>
        <p class="km-eyebrow" data-ai>${esc(AREA[b.area].name)}</p>
        <h2 data-ai>${esc(b.name)}</h2>
        ${b.desc ? `<p class="km-small" data-ai>${esc(b.desc)}</p>` : ""}
        <div class="km-card"><span class="km-status">${STXT[st]} · ${done} of ${b.pts.length} points learned${bOnRoute(id) ? ` · <span class="r">on the suggested route</span>` : ""}${HOT.has(id) ? " · AI's top pick" : ""}</span>
          ${r && why ? `<span class="km-small"><b>${esc(I18N.t("Why it's on your route:"))}</b> <span data-ai>${esc(why)}</span></span>` : ""}
          <div class="km-btns">${done < b.pts.length ? `<button class="km-btn solid" type="button" data-markall="${id}">Mark the whole topic as learned</button>` : ""}${done ? `<button class="km-btn" type="button" data-clearall="${id}">Clear this topic</button>` : ""}</div></div>
        <h3>Points inside</h3><div class="km-rows">${b.pts.map(prow).join("")}</div>
        <h3>Builds on</h3>${rel(b.parents)}
        <h3>Leads to</h3>${rel(b.children)}
        <h3>Where it's taught</h3>${(b.where || []).length ? `<div class="km-srcs">${whereRows(b.where)}</div><p class="km-small">${esc(I18N.t("Named by the AI from memory. The page couldn't check these, so look them up before relying on them."))}</p>` : `<p class="km-empty">The AI named no sources for this topic.</p>`}`;
    }
    function renderPoint(id) {
      const n = byId[id], st = pStatus(id), miss = n.needs.filter((p) => !learned.has(p));
      const why = GOAL.has(id) ? (routeWhy[BALL_OF[id]] ? I18N.t("Your goal needs it, in the AI's judgement:") + " " + routeWhy[BALL_OF[id]] : I18N.t("Your goal needs it, in the AI's judgement."))
        : ROUTE.has(id) ? I18N.t("Needed by route points such as " + [...GOAL].filter((g) => ancestors(g).has(id)).slice(0, 3).map(nm).join(", ") + ".") : "";
      el("km-p-det").innerHTML = `
        <button class="km-back" type="button" data-ball="${BALL_OF[id]}"><span>← </span><span data-ai>${esc(bn(BALL_OF[id]))}</span></button>
        <h2 data-ai>${esc(n.name)}</h2>
        ${n.what ? `<p class="km-small" data-ai>${esc(n.what)}</p>` : ""}
        ${notesMode && opts.notesHTML ? opts.notesHTML(id) : ""}
        <div class="km-card"><span class="km-status">${STXT[st]}${ROUTE.has(id) && !learned.has(id) ? ` · <span class="r">on the suggested route</span>` : ""}</span>
          ${st === "locked" ? `<span class="km-small">Still missing:</span><div class="km-ex">${miss.map(ppill).join("")}</div>` : ""}
          ${why ? `<span class="km-small" data-ai>${esc(why)}</span>` : ""}
          <div class="km-btns">${opts.onLearn ? `<button class="km-btn solid" type="button" data-learn="${id}">Learn this point</button>` : ""}<button class="km-btn" type="button" data-toggle="${id}">${st === "learned" ? "Mark as not learned" : "Mark as learned"}</button></div></div>
        ${!notesMode && opts.notesHTML ? opts.notesHTML(id) : ""}
        <h3>Needed first</h3>${n.needs.length ? `<div class="km-rows">${n.needs.map((p) => `<div class="km-prow" style="grid-template-columns:minmax(0,1fr) auto"><button class="km-nm" data-point="${p}" type="button" data-ai>${esc(nm(p))}</button><span class="km-tag ${pStatus(p)}">${learned.has(p) ? "learned" : "not yet"}</span></div>`).join("")}</div>` : `<p class="km-empty">Nothing. This is a starting point.</p>`}
        ${n.helps.length ? `<h3>Helps to know first</h3><div class="km-inline">${n.helps.map((p) => `<button class="km-nm" data-point="${p}" type="button" data-ai>${esc(nm(p))}</button>`).join("")}</div>` : ""}
        <h3>Needed by</h3>${n.usedBy.length ? `<div class="km-inline">${n.usedBy.map((p) => `<button class="km-nm" data-point="${p}" type="button" data-ai>${esc(nm(p))}</button>`).join("")}</div>` : `<p class="km-empty">No other point needs this one.</p>`}`;
    }
    const panel = document.querySelector("#kmap .km-panel");
    panel.onclick = (e) => {
      const t = e.target.closest("[data-ball],[data-point],[data-toggle],[data-markall],[data-clearall],[data-act],[data-show],[data-learn],[data-noteact],[data-about]"); if (!t) return;
      const ds = t.dataset;
      if (ds.noteact) { if (opts.onNoteAct) opts.onNoteAct(ds.noteact, ds.id, ds.n); return; }
      if (ds.about) { if (opts.onAbout) opts.onAbout(ds.about); return; }
      if (ds.learn) { if (opts.onLearn) opts.onLearn(ds.learn); }
      else if (ds.ball) openBall(ds.ball);
      else if (ds.point) showPoint(ds.point);
      else if (ds.toggle) { const on = !learned.has(ds.toggle); on ? learned.add(ds.toggle) : learned.delete(ds.toggle); commit(`Map: "${nm(ds.toggle)}" marked ${on ? "learned" : "not learned"}`); }
      else if (ds.markall) { BALL[ds.markall].pts.forEach((p) => learned.add(p)); commit(`Map: whole topic "${bn(ds.markall)}" marked learned`); }
      else if (ds.clearall) { BALL[ds.clearall].pts.forEach((p) => learned.delete(p)); commit(`Map: topic "${bn(ds.clearall)}" cleared`); }
      else if (ds.act === "clear") { learned = new Set(); commit("Map: progress cleared"); }
      else if (ds.act === "flash") { flashOn = !flashOn; persist(); refresh(); }
      else if (ds.act === "overview") { closeBall(); tab("mine"); fitBalls(null); }
      else if (ds.show) { const f = opts.focusSets ? opts.focusSets()[+ds.show] : null; if (f) setFocus(new Set(f.balls), f.label); }
    };
    panel.onchange = (e) => {
      const id = e.target.dataset.mark; if (!id) return;
      e.target.checked ? learned.add(id) : learned.delete(id);
      commit(`Map: "${nm(id)}" marked ${e.target.checked ? "learned" : "not learned"}`);
    };
    el("km-p-src").innerHTML = opts.aboutHTML ? opts.aboutHTML(KD) : "";

    loadProgress(); refresh(); tab("mine");
    const fitTop = () => { const t = document.querySelector(".topbar"); if (t) document.documentElement.style.setProperty("--km-top", t.offsetHeight + "px"); };
    let rz;
    kmResize = () => { clearTimeout(rz); rz = setTimeout(() => { fitTop(); measureChrome(); if (!el("kmap").hidden) (ks.open ? fitOpen(BALL[ks.open]) : fitBalls(ks.focus, 0)); }, 150); };
    return {
      show() { fitTop(); refresh(); if (!ks.shown) { ks.shown = true; el("kmap").classList.add("km-intro"); setTimeout(() => el("kmap").classList.remove("km-intro"), 1500); requestAnimationFrame(() => { if (!ks.open) fitBalls(el("km-svg").clientWidth < 600 && HOT.size ? new Set(HOT) : null, 0); }); } },
      reload() { loadProgress(); refresh(); },
      data: { KD, byId, BALL, BALL_OF },
      status: pStatus,
      onRoute: (id) => ROUTE.has(id) && !learned.has(id),
      isLearned: (id) => learned.has(id),
      learnedList: () => [...learned],
      setLearned(id, on) { on ? learned.add(id) : learned.delete(id); commit(`Map: "${nm(id)}" marked ${on ? "learned" : "not learned"} in Learn`); },
      setManyLearned(ids, note) { ids.filter((x) => byId[x]).forEach((x) => learned.add(x)); commit(note); },
      topPoints() {
        const out = [];
        [...HOT].forEach((b) => BALL[b].pts.filter(pNext).forEach((p) => out.push(p)));
        KD.balls.forEach((b) => b.pts.filter(pNext).forEach((p) => { if (!out.includes(p)) out.push(p); }));
        return out;
      },
      openPoint(id) { if (!ks.shown) this.show(); showPoint(id); },
      focus(ids, label) { if (!ks.shown) this.show(); tab("mine"); setFocus(ids, label); },
      setNotes(on, fit = true) {
        notesMode = !!on;
        el("kmap").classList.toggle("km-notesmode", notesMode);
        if (notesMode) {
          const lit = new Set(KD.balls.filter((b) => b.pts.some((p) => opts.hasNotes && opts.hasNotes(p))).map((b) => b.id));
          tab("mine"); setFocus(lit.size ? lit : null, I18N.t("Topics with your notes")); if (!lit.size) fitBalls(null);
        } else if (ks.focus) { setFocus(null); if (fit) fitBalls(null); }
        refresh();
      },
      notesMode: () => notesMode,
    };
  }

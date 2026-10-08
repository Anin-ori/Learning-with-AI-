
  // ---------- Knowledge map (v1.3) ----------
  // Point-based view: 153 points from 13 human sources, packed into 30 big balls. Brightness = learning status,
  // red ring = AI's suggested route, white flash = the AI's top picks right now. Progress is saved with the app's state.
  function knowledgeMap(opts = {}) {
    const KD = /*__KM_DATA__*/null;
    const SHORT = { atbs: "Automate the Boring Stuff", tutorial: "Python Tutorial", thinkpython: "Think Python", pcc: "Python Crash Course",
      py4e: "Python for Everybody", cs50p: "CS50P", helsinki: "Helsinki MOOC", mit: "MIT 6.100L", kaggle: "Kaggle Learn",
      pydata: "Python for Data Analysis", google: "Google's Python Class", byte: "A Byte of Python", exercism: "Exercism" };
    const el = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const fmt = (n) => n.toLocaleString("en-US");
    const AREA = {}; KD.areas.forEach(([id, name], i) => AREA[id] = { id, name, i, h: Math.round((i * 360 / KD.areas.length + 8) % 360) });
    const byId = {}; KD.nodes.forEach((n) => { byId[n.id] = n; n.needs = []; n.helps = []; n.usedBy = []; });
    KD.links.forEach(([s, t, k]) => { if (k === "helps") byId[t].helps.push(s); else { byId[t].needs.push(s); byId[s].usedBy.push(t); } });
    const nm = (id) => byId[id].name;
    const ancestors = (id) => { const out = new Set(), st = [id]; while (st.length) { const x = st.pop(); for (const p of byId[x].needs) if (!out.has(p)) { out.add(p); st.push(p); } } return out; };
    const BALL = {}, BALL_OF = {};
    KD.balls.forEach((b) => { BALL[b.id] = b; b.parents = []; b.children = []; b.pts.forEach((p) => BALL_OF[p] = b.id); });
    KD.blinks.forEach(([s, t]) => { BALL[t].parents.push(s); BALL[s].children.push(t); });
    const bn = (id) => BALL[id].name;

    // progress lives in the app's saved state as state.map = { learned: [ids] | null, flash: bool }
    const EXAMPLE = ["run", "print", "comments", "tracebacks", "numbers", "arith", "precedence", "variables", "names", "strbasics", "types", "convert",
      "input", "bool", "compare", "logic", "if", "else", "blocks", "callfn", "while", "jupyter", "intdiv", "floatprec", "shortcirc"];
    let learned = new Set(EXAMPLE), isExample = true, flashOn = true;
    function loadProgress() {
      const m = state.map || {};
      flashOn = m.flash !== false;
      if (Array.isArray(m.learned)) { learned = new Set(m.learned.filter((id) => byId[id])); isExample = false; }
      else { learned = new Set(EXAMPLE); isExample = true; }
    }
    function persist(note) {
      state.map = { learned: isExample ? null : [...learned], flash: flashOn };
      saveState();
      if (note) logEvent("map", note);
    }
    const commit = (note) => { isExample = false; persist(note); refresh(); };

    // AI's suggested route: points taught in the two data/ML-oriented sources, plus everything they build on
    const GOAL_SRC = ["kaggle", "pydata"];
    const GOAL = new Set(KD.nodes.filter((n) => GOAL_SRC.some((s) => n.src[s])).map((n) => n.id));
    const ROUTE = new Set(GOAL); GOAL.forEach((g) => ancestors(g).forEach((a) => ROUTE.add(a)));
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
    // The angle keeps an area together and puts a topic near the topics it builds on. -----
    // rings fill from the centre in order of level (how deep a topic sits in the "needed first" chain); each ring takes
    // as many topics as its length has room for, so a topic is never on a ring inside one it builds on
    const RINGS = [0, 106, 208, 310, 412], CAP = [1, 3, 6, 8, 99];
    const KREF = 0.74, FS = 11.5, LH = 14;
    KD.balls.slice().sort((x, y) => (x.d - y.d) || (y.children.length - x.children.length) || (AREA[x.area].i - AREA[y.area].i))
      .forEach((b, i) => { let k = 0, c = CAP[0]; while (i >= c) c += CAP[++k]; b.ring = k; });
    KD.balls.forEach((b) => {
      const n = b.pts.length;
      b.r = 8 + 3.3 * Math.sqrt(n); b.cur = b.r; b.ro = Math.max(54, n * 8.6);
      const w = b.name.split(" ");
      if (b.name.length <= 14 || w.length < 2) b.lines = [b.name];
      else { let best = null; for (let i = 1; i < w.length; i++) { const l1 = w.slice(0, i).join(" "), l2 = w.slice(i).join(" "), m = Math.max(l1.length, l2.length); if (!best || m < best[0]) best = [m, l1, l2]; } b.lines = [best[1], best[2]]; }
      b.lw = Math.max(...b.lines.map((l) => l.length)) * 6.2 / KREF;
      b.lh = (b.lines.length * LH + 7) / KREF;
      b.dots = b.pts.map((id, i) => ({ id, ball: b.id, a: -Math.PI / 2 + i * 2 * Math.PI / n }));
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

    // ----- drawing -----
    const svg = d3.select("#km-svg"), defs = svg.append("defs"), root = svg.append("g");
    const glowG = defs.append("radialGradient").attr("id", "km-glowg");
    [[0, 0.95], [0.32, 0.42], [0.62, 0.12], [1, 0]].forEach(([o, a]) => glowG.append("stop").attr("offset", o).attr("stop-color", "#fff").attr("stop-opacity", a));
    const gR = root.append("g"), gL = root.append("g"), gB = root.append("g");
    RINGS.slice(1).forEach((R) => gR.append("circle").attr("class", "km-ring").attr("r", R));
    let K = 1;
    const trimTo = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * d, p[1] + dy / L * d]; };
    function linkPath([s, t]) {
      const a = BALL[s], b = BALL[t], c = [(a.x + b.x) / 2 * 0.88, (a.y + b.y) / 2 * 0.88];
      const p0 = trimTo([a.x, a.y], c, a.cur + 7 / K), p1 = trimTo([b.x, b.y], c, b.cur + 7 / K);
      return `M${p0}Q${c} ${p1}`;
    }
    const linkSel = gL.selectAll("path").data(KD.blinks).join("path").attr("class", "km-blk");
    const ballSel = gB.selectAll("g.km-ball").data(KD.balls).join("g").attr("class", "km-ball").attr("transform", (b) => `translate(${b.x},${b.y})`);
    ballSel.append("circle").attr("class", "km-glow").attr("fill", "url(#km-glowg)");
    ballSel.append("circle").attr("class", "km-halo");
    ballSel.append("circle").attr("class", "km-body");
    ballSel.append("path").attr("class", "km-arc");
    ballSel.append("circle").attr("class", "km-hit");
    const dotSel = ballSel.append("g").attr("class", "km-dots").selectAll("g.km-dot").data((b) => b.dots).join("g")
      .attr("class", "km-dot").attr("transform", "translate(0,0)").style("opacity", 0);
    dotSel.append("circle").attr("class", "km-halo");
    dotSel.append("circle").attr("class", "km-core");
    dotSel.append("text").text((d) => nm(d.id));
    const blab = ballSel.append("text").attr("class", "km-blab").attr("text-anchor", "middle");
    blab.selectAll("tspan").data((b) => b.lines).join("tspan").attr("x", 0).text((l) => l);
    const bcount = ballSel.append("text").attr("class", "km-prog").attr("text-anchor", "middle");

    const arcD = (R, f) => { const t = f * TAU; return `M0,${-R}A${R},${R} 0 ${f > 0.5 ? 1 : 0} 1 ${(R * Math.sin(t)).toFixed(2)},${(-R * Math.cos(t)).toFixed(2)}`; };
    const doneOf = (b) => b.pts.filter((p) => learned.has(p)).length;
    // everything that depends on the zoom (text, rings, gaps) is sized in screen pixels, so it looks the same at any zoom
    function geom(sel) {
      sel.each(function (b) {
        const g = d3.select(this), R = b.cur, open = ks.open === b.id, f = doneOf(b) / b.pts.length;
        g.select(".km-glow").attr("r", R * (HOT.has(b.id) ? 3.2 : 2.4));
        g.select(".km-halo").attr("r", R + 4.5 / K);
        g.select(".km-body").attr("r", R);
        g.select(".km-hit").attr("r", R + 9 / K);
        g.select(".km-arc").attr("d", f > 0 && f < 1 && !open ? arcD(R, f) : null);
        const lab = g.select(".km-blab"), n = b.lines.length;
        if (open) {
          const fs = 15 / K, lh = 17 / K, y0 = -((n - 1) * lh) / 2 - 3 / K;
          lab.attr("font-size", fs).attr("stroke-width", 0).attr("y", y0); lab.selectAll("tspan").attr("dy", (l, i) => i ? lh : 0);
          g.select(".km-prog").attr("font-size", 10.5 / K).attr("y", y0 + (n - 1) * lh + 18 / K);
        } else {
          const ts = Math.max(0.8, Math.min(1, K / KREF)); // below the zoom the layout was spaced for, labels shrink a little instead of overlapping
          lab.attr("font-size", FS * ts / K).attr("stroke-width", 3.2 / K).attr("y", R + (5 + 11 * ts) / K); lab.selectAll("tspan").attr("dy", (l, i) => i ? LH * ts / K : 0);
        }
      });
    }
    function sizeText() {
      const shown = (b) => ks.open === b.id || HOT.has(b.id) || K >= KREF * 0.78 || (bNext(b.id) && K >= KREF * 0.6);
      blab.attr("display", (b) => shown(b) ? null : "none");
      bcount.attr("display", (b) => ks.open === b.id ? null : "none");
      geom(ballSel);
      linkSel.attr("d", linkPath);
      dotSel.select(".km-core").attr("r", 6.4 / K);
      dotSel.select(".km-halo").attr("r", 10 / K);
      dotSel.select("text").attr("font-size", 11.5 / K).attr("stroke-width", 3.2 / K)
        .attr("x", (d) => Math.cos(d.a) * 15 / K).attr("y", (d) => Math.sin(d.a) * 15 / K)
        .attr("text-anchor", (d) => Math.cos(d.a) > 0.3 ? "start" : Math.cos(d.a) < -0.3 ? "end" : "middle")
        .attr("dominant-baseline", (d) => Math.abs(Math.cos(d.a)) > 0.3 ? "central" : Math.sin(d.a) < 0 ? "auto" : "hanging");
    }
    const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    function grow(b, R) {
      const g = ballSel.filter((x) => x === b), i = d3.interpolate(b.cur, R);
      g.transition("grow").duration(reduceMotion() ? 0 : 480).ease(d3.easeCubicOut)
        .tween("grow", () => (t) => { b.cur = i(t); geom(g); linkSel.attr("d", linkPath); });
    }
    function bloom(b, on) {
      dotSel.filter((d) => d.ball === b.id).transition("bloom").duration(reduceMotion() ? 0 : on ? 520 : 240).delay((d, i) => on && !reduceMotion() ? 80 + i * 22 : 0).ease(d3.easeCubicOut)
        .attr("transform", (d) => on ? `translate(${b.ro * Math.cos(d.a)},${b.ro * Math.sin(d.a)})` : "translate(0,0)").style("opacity", on ? 1 : 0);
    }
    const zoom = d3.zoom().scaleExtent([0.25, 8]).on("zoom", (e) => { root.attr("transform", e.transform); if (Math.abs(e.transform.k - K) > 1e-3) { K = e.transform.k; sizeText(); } });
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
    function fitOpen(b) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return;
      const room = Math.min(w / 2 - (w < 600 ? 92 : 170), (h - TOP - BOTTOM) / 2 - 46);
      const k = Math.max(0.5, Math.min(1.9, room / b.ro));
      fitTo(d3.zoomIdentity.translate(w / 2 - k * b.x, TOP + (h - TOP - BOTTOM) / 2 - k * b.y).scale(k));
    }

    // ----- state -----
    const ks = { open: null, point: null, focus: null, shown: false };
    function refresh() {
      HOT = new Set(hotBalls());
      el("kmap").classList.toggle("km-flashon", flashOn);
      const fb = el("km-flash"); fb.setAttribute("aria-pressed", flashOn ? "true" : "false"); fb.querySelector("span").innerHTML = flashOn ? '<b class="km-wide">Top picks glowing</b><b class="km-narrow">Glow on</b>' : "Glow off";
      ballSel.attr("class", (b) => "km-ball st-" + bStatus(b.id) + (bOnRoute(b.id) ? " route" : "") + (bNext(b.id) ? " next" : "") + (HOT.has(b.id) ? " hot" : "") + (ks.open === b.id ? " open" : ""));
      dotSel.attr("class", (d) => "km-dot st-" + pStatus(d.id) + (ROUTE.has(d.id) && !learned.has(d.id) ? " route" : "") + (pNext(d.id) ? " next" : "") + (ks.point === d.id ? " sel" : ""));
      bcount.text((b) => `${doneOf(b)} of ${b.pts.length} learned`);
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
      if (ks.open !== id) { collapse(); ks.open = id; const b = BALL[id]; grow(b, b.ro); bloom(b, true); }
      ks.focus = null; ks.point = null;
      el("km-focus").classList.remove("on");
      gB.selectAll("g.km-ball").filter((b) => b.id === id).raise();
      refresh(); renderBall(id); tab("det");
      if (fit) fitOpen(BALL[id]);
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
    ballSel.select(".km-hit").on("pointermove", (e, b) => { if (ks.open === b.id) return tip.style.display = "none"; showTip(e, `<b>${esc(b.name)}</b><span>${STXT[bStatus(b.id)]} · ${doneOf(b)} of ${b.pts.length} points learned${bOnRoute(b.id) ? " · on the AI route" : ""}${HOT.has(b.id) ? " · top pick" : ""}</span>`); })
      .on("pointerleave", () => tip.style.display = "none")
      .on("click", (e, b) => { e.stopPropagation(); tip.style.display = "none"; if (ks.open === b.id) { ks.point = null; refresh(); renderBall(b.id); tab("det"); } else openBall(b.id); });
    dotSel.on("pointermove", (e, d) => { if (ks.open === BALL_OF[d.id]) showTip(e, `<b>${esc(nm(d.id))}</b><span>${STXT[pStatus(d.id)]}${ROUTE.has(d.id) && !learned.has(d.id) ? " · on the AI route" : ""}</span>`); })
      .on("pointerleave", () => tip.style.display = "none")
      .on("click", (e, d) => { e.stopPropagation(); if (ks.open === BALL_OF[d.id]) showPoint(d.id); });
    svg.on("click", () => { if (ks.open) { closeBall(); tab("mine"); } });
    const q = el("km-q");
    el("km-names").innerHTML = [...KD.balls.map((b) => b.name), ...KD.nodes.map((n) => n.name)].sort((a, b) => a.localeCompare(b)).map((n) => `<option value="${esc(n)}">`).join("");
    q.addEventListener("change", () => {
      const v = q.value.trim().toLowerCase(); if (!v) return;
      const b = KD.balls.find((x) => x.name.toLowerCase() === v); if (b) return openBall(b.id);
      const n = KD.nodes.find((x) => x.name.toLowerCase() === v) || KD.nodes.find((x) => x.name.toLowerCase().includes(v));
      if (n) showPoint(n.id);
    });

    // ----- panel -----
    const TABS = ["mine", "det", "src"];
    function tab(which) { TABS.forEach((k) => { el("km-t-" + k).setAttribute("aria-selected", k === which ? "true" : "false"); el("km-p-" + k).hidden = k !== which; }); }
    TABS.forEach((k) => el("km-t-" + k).onclick = () => tab(k));
    const bpill = (id) => `<button class="km-pill${bNext(id) ? " next" : ""}${HOT.has(id) ? " hot" : ""}" data-ball="${id}" type="button">${esc(bn(id))}</button>`;
    const ppill = (id) => `<button class="km-pill" data-point="${id}" type="button">${esc(nm(id))}</button>`;
    const sw = (inner) => `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">${inner}</svg>`;
    const SKY = { learned: sw('<circle cx="8" cy="8" r="5" fill="#f4f2ec"/>'),
      ready: sw('<circle cx="8" cy="8" r="4.6" fill="#2b3038" stroke="rgba(255,255,255,.82)" stroke-width="1"/>'),
      locked: sw('<circle cx="8" cy="8" r="4.6" fill="#15181d" stroke="rgba(255,255,255,.22)" stroke-width="1"/>'),
      route: sw('<circle cx="8" cy="8" r="6.8" fill="none" stroke="#ff5b4d" stroke-width="1.2"/><circle cx="8" cy="8" r="3.4" fill="#2b3038" stroke="rgba(255,255,255,.6)" stroke-width=".8"/>'),
      glow: sw('<defs><radialGradient id="km-lg"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="8" cy="8" r="8" fill="url(#km-lg)"/><circle cx="8" cy="8" r="3.2" fill="#fff"/>') };
    el("km-legend").innerHTML = `<span>${SKY.learned}Learned</span><span>${SKY.ready}Can learn</span><span>${SKY.locked}Not yet</span><i class="km-sep"></i><span>${SKY.route}AI route</span><span>${SKY.glow}Top pick</span>`;
    el("km-legend").classList.add("km-glass");

    function renderMine() {
      const bc = { learned: 0, ready: 0, locked: 0 }; KD.balls.forEach((b) => bc[bStatus(b.id)]++);
      const hot = [...HOT];
      const next = KD.balls.map((b) => b.id).filter((b) => bNext(b) && !HOT.has(b));
      const off = KD.balls.map((b) => b.id).filter((b) => !bNext(b) && bStatus(b) === "ready");
      const pct = Math.round(100 * learned.size / KD.nodes.length);
      const pick = (id) => { const b = BALL[id], ready = b.pts.filter(pNext).length;
        return `<button class="km-pick${HOT.has(id) ? " hot" : bNext(id) ? " next" : ""}" data-ball="${id}" type="button"><i></i><b>${esc(b.name)}</b><span>${ready} ready</span></button>`; };
      el("km-p-mine").innerHTML = `
        <p class="km-eyebrow">Goal</p><h2>Python for machine learning</h2>
        <div class="km-big"><b>${learned.size}</b><span>of ${KD.nodes.length} points learned</span></div>
        <div class="km-bar2" role="img" aria-label="${pct}% learned"><i style="width:${pct}%"></i></div>
        <div class="km-trio"><span><b>${bc.learned}</b> topics done</span><span><b>${bc.ready}</b> open now</span><span><b>${bc.locked}</b> not yet</span></div>
        ${isExample ? `<div class="km-note"><span><b>Example progress.</b> This shows a learner about two chapters into a beginner book.</span><div class="km-btns"><button class="km-btn solid" type="button" data-act="clear">Start with an empty map</button></div></div>` : ""}
        <h3>AI's top picks${flashOn ? " · glowing on the map" : ""}</h3>
        ${hot.length ? `<div class="km-picks">${hot.map(pick).join("")}</div>` : `<p class="km-empty">Nothing on the route is reachable right now.</p>`}
        ${next.length ? `<h3>Also on your route</h3><div class="km-links">${next.map((id) => `<button class="next" data-ball="${id}" type="button">${esc(bn(id))}</button>`).join("")}</div>` : ""}
        ${off.length ? `<h3>Open, off the route</h3><div class="km-links">${off.map((id) => `<button data-ball="${id}" type="button">${esc(bn(id))}</button>`).join("")}</div>` : ""}
        <div class="km-foot">
          <span>Topics sit on rings: the basics in the centre, more advanced topics further out. Brighter means further along; the thin arc shows how much of a topic you've learned. The red ring is the AI's suggested route: the ${GOAL.size} points taught in the two sources written for data work (Kaggle Learn and Python for Data Analysis) and the ${ROUTE.size - GOAL.size} they build on. Top picks are where you can start the most route points now. It's a suggestion; open any topic you like.</span>
          <div class="km-btns"><button class="km-btn" type="button" data-act="flash">${flashOn ? "Turn the glow off" : "Turn the glow on"}</button><button class="km-btn" type="button" data-act="clear">Clear progress</button><button class="km-btn" type="button" data-act="example">Load example</button></div>
        </div>`;
    }
    function renderBall(id) {
      const b = BALL[id], st = bStatus(id), done = b.pts.filter((p) => learned.has(p)).length, r = b.pts.filter((p) => ROUTE.has(p)).length;
      const prow = (p) => { const s = pStatus(p); return `<div class="km-prow"><input type="checkbox" data-mark="${p}" ${learned.has(p) ? "checked" : ""} aria-label="Learned: ${esc(nm(p))}">
        <button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}</button>
        <span class="km-tag ${pNext(p) ? "route" : s}">${pNext(p) ? "next" : s === "learned" ? "learned" : s === "ready" ? "can learn" : "not yet"}</span></div>`; };
      const rel = (ids) => ids.length ? `<div class="km-ex">${ids.map(bpill).join("")}</div>` : `<p class="km-empty">None.</p>`;
      const where = {};
      b.pts.forEach((p) => Object.entries(KD.chap[p] || {}).forEach(([s, c]) => {
        if (s === "exercism") return;
        const w = where[s] = where[s] || { pts: 0, chaps: new Map() }; w.pts++;
        if (!w.chaps.has(c)) w.chaps.set(c, byId[p].src[s][0][1]);
      }));
      const whereRows = Object.entries(where).sort((x, y) => y[1].pts - x[1].pts).slice(0, 6)
        .map(([s, w]) => `<div class="km-src"><b>${SHORT[s]}</b><span>${w.pts} of ${b.pts.length} points · ${[...w.chaps].slice(0, 2).map(([c, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(c)}</a>`).join(", ")}</span></div>`).join("");
      el("km-p-det").innerHTML = `
        <button class="km-back" type="button" data-act="overview">← Overview</button>
        <p class="km-eyebrow">${esc(AREA[b.area].name)}</p>
        <h2>${esc(b.name)}</h2>
        <div class="km-card"><span class="km-status">${STXT[st]} · ${done} of ${b.pts.length} points learned${bOnRoute(id) ? ` · <span class="r">on the suggested route</span>` : ""}${HOT.has(id) ? " · AI's top pick" : ""}</span>
          <div class="km-btns">${done < b.pts.length ? `<button class="km-btn solid" type="button" data-markall="${id}">Mark the whole topic as learned</button>` : ""}${done ? `<button class="km-btn" type="button" data-clearall="${id}">Clear this topic</button>` : ""}</div></div>
        <h3>Points inside</h3><div class="km-rows">${b.pts.map(prow).join("")}</div>
        <h3>Builds on</h3>${rel(b.parents)}
        <h3>Leads to</h3>${rel(b.children)}
        <h3>Where the books teach it</h3>${whereRows ? `<div class="km-srcs">${whereRows}</div>` : `<p class="km-empty">No source has headings for these points.</p>`}
        <h3>Why these belong together</h3>
        <p class="km-small">${b.coh != null ? `Across the books that teach them, any two of these points sit in the same chapter about <b>${b.coh}%</b> of the time.` : "Too few books teach these points for a same-chapter figure."} ${r ? `${r} of its ${b.pts.length} points are on the suggested route.` : "None of its points are on the suggested route."}</p>`;
    }
    function renderPoint(id) {
      const n = byId[id], st = pStatus(id), miss = n.needs.filter((p) => !learned.has(p));
      const why = GOAL.has(id) ? "Taught in " + GOAL_SRC.filter((s) => n.src[s]).map((s) => SHORT[s]).join(" and ") + "."
        : ROUTE.has(id) ? "Needed by route points such as " + [...GOAL].filter((g) => ancestors(g).has(id)).slice(0, 3).map(nm).join(", ") + "." : "";
      const srcRows = Object.entries(n.src).map(([s, hs]) => `<div class="km-src"><b>${SHORT[s]}</b>${hs.map(([h, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(h)}</a>`).join("")}</div>`).join("");
      el("km-p-det").innerHTML = `
        <button class="km-back" type="button" data-ball="${BALL_OF[id]}">← ${esc(bn(BALL_OF[id]))}</button>
        <h2>${esc(n.name)}</h2>
        <div class="km-card"><span class="km-status">${STXT[st]}${ROUTE.has(id) && !learned.has(id) ? ` · <span class="r">on the suggested route</span>` : ""}</span>
          ${st === "locked" ? `<span class="km-small">Still missing:</span><div class="km-ex">${miss.map(ppill).join("")}</div>` : ""}
          ${why ? `<span class="km-small">${esc(why)}</span>` : ""}
          <div class="km-btns">${opts.onLearn ? `<button class="km-btn solid" type="button" data-learn="${id}">Learn this point</button>` : ""}<button class="km-btn" type="button" data-toggle="${id}">${st === "learned" ? "Mark as not learned" : "Mark as learned"}</button></div></div>
        <p class="km-small">Taught in ${n.n} of 13 sources.</p>
        <h3>Needed first</h3>${n.needs.length ? `<div class="km-rows">${n.needs.map((p) => `<div class="km-prow" style="grid-template-columns:minmax(0,1fr) auto"><button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}</button><span class="km-tag ${pStatus(p)}">${learned.has(p) ? "learned" : "not yet"}</span></div>`).join("")}</div>` : `<p class="km-empty">Nothing. This is a starting point.</p>`}
        ${n.helps.length ? `<h3>Helps to know first</h3><div class="km-inline">${n.helps.map((p) => `<button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}</button>`).join("")}</div>` : ""}
        <h3>Needed by</h3>${n.usedBy.length ? `<div class="km-inline">${n.usedBy.map((p) => `<button class="km-nm" data-point="${p}" type="button">${esc(nm(p))}</button>`).join("")}</div>` : `<p class="km-empty">No other point needs this one.</p>`}
        <h3>Where the sources teach it</h3>${srcRows ? `<div class="km-srcs">${srcRows}</div>` : `<p class="km-empty">No source has a heading for this point.</p>`}`;
    }
    const panel = document.querySelector("#kmap .km-panel");
    panel.addEventListener("click", (e) => {
      const t = e.target.closest("[data-ball],[data-point],[data-toggle],[data-markall],[data-clearall],[data-act],[data-show],[data-learn]"); if (!t) return;
      const ds = t.dataset;
      if (ds.learn) { if (opts.onLearn) opts.onLearn(ds.learn); }
      else if (ds.ball) openBall(ds.ball);
      else if (ds.point) showPoint(ds.point);
      else if (ds.toggle) { const on = !learned.has(ds.toggle); on ? learned.add(ds.toggle) : learned.delete(ds.toggle); commit(`Map: "${nm(ds.toggle)}" marked ${on ? "learned" : "not learned"}`); }
      else if (ds.markall) { BALL[ds.markall].pts.forEach((p) => learned.add(p)); commit(`Map: whole topic "${bn(ds.markall)}" marked learned`); }
      else if (ds.clearall) { BALL[ds.clearall].pts.forEach((p) => learned.delete(p)); commit(`Map: topic "${bn(ds.clearall)}" cleared`); }
      else if (ds.act === "clear") { learned = new Set(); commit("Map: progress cleared"); }
      else if (ds.act === "example") { learned = new Set(EXAMPLE); isExample = true; persist("Map: example progress loaded"); refresh(); }
      else if (ds.act === "flash") { flashOn = !flashOn; persist(); refresh(); }
      else if (ds.act === "overview") { closeBall(); tab("mine"); fitBalls(null); }
      else if (ds.show) { const p = PROBLEMS[+ds.show]; setFocus(new Set(p.pts().map((x) => BALL_OF[x])), p.label); }
    });
    panel.addEventListener("change", (e) => {
      const id = e.target.dataset.mark; if (!id) return;
      e.target.checked ? learned.add(id) : learned.delete(id);
      commit(`Map: "${nm(id)}" marked ${e.target.checked ? "learned" : "not learned"}`);
    });

    // ----- problems found when the map was tested -----
    const S = KD.stats;
    const KNOT = new Set(["numbers", "variables", "strbasics", "types", "arith", "convert", "print", "compare", "if", "callfn", "def"]);
    const knotBad = KD.against.filter((a) => KNOT.has(a[0]) && KNOT.has(a[1]));
    const thin = KD.nodes.filter((n) => n.n <= 2);
    const PROBLEMS = [
      { sev: "core", num: knotBad.length + "/" + KD.against.length, title: "The start is a knot, not a tree",
        body: `Numbers, variables, strings, types and <code>print()</code> arrive together in chapter 1, and each book orders their headings differently. ${KD.against.length} of the AI's links run against most books' order, and ${knotBad.length} of those sit inside this knot. The big balls absorb most of it.`,
        pts: () => KD.against.flatMap((a) => [a[0], a[1]]), label: "Balls holding links against most books' order" },
      { sev: "core", num: S.human_links_in_neither_needs_chain + "/" + S.human_links, title: "“Prerequisite” means different things",
        body: `Exercism's authors wrote ${S.human_links} prerequisite links by hand; ${S.human_links_in_neither_needs_chain} are in neither AI run's strict “needed first” chain. Most are exercise gates. Brightness depends on these links, so link types must be defined.`,
        pts: () => KD.human.flatMap((x) => [x[0], x[1]]), label: "Balls touched by Exercism's human links" },
      { sev: "major", num: fmt(S.pairs_sources_split_on_order), title: "The books don't share one order",
        body: `Of ${fmt(S.popular_point_pairs)} pairs of widely taught points, the books split on ${S.pairs_sources_split_on_order}. With learners choosing their own route, this is fine: several routes are legitimate.`,
        pairs: KD.split.slice(0, 5), pts: () => KD.split.slice(0, 14).flatMap((p) => [p[0], p[1]]), label: "Balls the books order differently" },
      { sev: "major", num: fmt(thin.length), title: "The edge of the map is unclear",
        body: `${thin.length} of ${KD.nodes.length} points appear in only 0–2 sources. They stay on the map, away from the route.`,
        pts: () => thin.map((n) => n.id), label: "Balls with points in 0–2 sources" },
      { sev: "major", num: "3", title: "The AI's own point list had gaps",
        body: "The first AI-drafted list missed “Indentation and code blocks” (7 sources) and “Code style” (3), and included “Dataclasses”, which no source teaches. Matching against the headings caught all three.",
        pts: () => ["blocks", "style", "dataclasses"], label: "Balls with points the sources corrected" },
      { sev: "major", num: "2×", title: "One idea, two places",
        body: "Indexing and slicing appear under both strings and lists. They stay in their own balls, as the books teach them, but learning one makes the other nearly free.",
        pts: () => ["strindex", "listindex", "strslice", "listslice"], label: "Balls with indexing and slicing" },
      { sev: "ok", num: S.same_direct + "", title: "Two AI runs mostly agree",
        body: `Run A drew ${S.needs_A} “needed first” links and run B ${S.needs_B}; ${S.same_direct} are identical and ${S.opposite_direction} point opposite ways. Where they differ, it's about how strict a link is.`,
        pts: () => [], label: "" },
    ];
    const probHTML = `<p class="km-small">From the test of the point map, before the points were packed into topics.</p>` +
      PROBLEMS.map((p, i) => `<div class="km-prob"><div class="head"><span class="num">${p.num}</span><h4>${p.title}</h4><span class="km-sev ${p.sev}">${p.sev === "ok" ? "fine" : p.sev}</span></div>
        <p>${p.body}</p>
        ${p.pairs ? `<div class="km-pairs">${p.pairs.map(([a, b, bf, af]) => `<div><span>${esc(nm(a))} → ${esc(nm(b))}</span><span>${bf} : ${af}</span></div>`).join("")}<div><span class="km-small">books putting the left one first : the right one first</span><span></span></div></div>` : ""}
        ${p.label ? `<button class="km-btn" type="button" data-show="${i}">Show on map</button>` : ""}</div>`).join("");
    el("km-p-src").innerHTML = `<p class="km-eyebrow">About this map</p><h2>Built from 13 human sources</h2><p class="km-small">153 points were found in the section headings of these courses and books, then packed into 30 topics that the books usually teach together. Two separate AI runs drew the links between points.</p><h3>Sources</h3><div class="km-srclist">` +
      Object.entries(KD.sources).map(([id, s]) => `<div class="km-src"><b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></b><span>${esc(s.author)} · ${esc(s.kind)}</span><span>${s.n} headings · teaches ${KD.nodes.filter((n) => n.src[id]).length} of the ${KD.nodes.length} points${id === "exercism" ? " · lists prerequisites, used as the human check" : ""}</span></div>`).join("") + `</div><details class="km-more"><summary>What testing the map found (7 findings)</summary>${probHTML}</details>`;

    loadProgress(); refresh();
    const fitTop = () => { const t = document.querySelector(".topbar"); if (t) document.documentElement.style.setProperty("--km-top", t.offsetHeight + "px"); };
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { fitTop(); if (!el("kmap").hidden) (ks.open ? fitOpen(BALL[ks.open]) : fitBalls(ks.focus, 0)); }, 150); });
    return {
      show() { fitTop(); refresh(); if (!ks.shown) { ks.shown = true; requestAnimationFrame(() => { if (!ks.open) fitBalls(el("km-svg").clientWidth < 600 && HOT.size ? new Set(HOT) : null, 0); }); } },
      reload() { loadProgress(); refresh(); },
      data: { KD, byId, BALL, BALL_OF, SHORT },
      status: pStatus,
      onRoute: (id) => ROUTE.has(id) && !learned.has(id),
      isLearned: (id) => learned.has(id),
      isExample: () => isExample,
      learnedList: () => [...learned],
      setLearned(id, on) { on ? learned.add(id) : learned.delete(id); commit(`Map: "${nm(id)}" marked ${on ? "learned" : "not learned"} in step 5`); },
      topPoints() {
        const out = [];
        [...HOT].forEach((b) => BALL[b].pts.filter(pNext).forEach((p) => out.push(p)));
        KD.balls.forEach((b) => b.pts.filter(pNext).forEach((p) => { if (!out.includes(p)) out.push(p); }));
        return out;
      },
      openPoint(id) { if (!ks.shown) this.show(); showPoint(id); },
    };
  }

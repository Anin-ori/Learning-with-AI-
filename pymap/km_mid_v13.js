    // ----- layout (v1.3): topics sit on rings, basics at the centre and more advanced topics further out.
    // The angle keeps an area together and puts a topic near the topics it builds on. -----
    const RINGS = [0, 112, 218, 326, 430, 528];
    const ringOf = (d) => d === 0 ? 0 : Math.min(RINGS.length - 1, Math.ceil(d / 2));
    const KREF = 0.66, FS = 11.5, LH = 14;
    KD.balls.forEach((b) => {
      const n = b.pts.length;
      b.r = 8 + 3.3 * Math.sqrt(n); b.cur = b.r; b.ro = Math.max(44, n * 7.4);
      const w = b.name.split(" ");
      if (b.name.length <= 14 || w.length < 2) b.lines = [b.name];
      else { let best = null; for (let i = 1; i < w.length; i++) { const l1 = w.slice(0, i).join(" "), l2 = w.slice(i).join(" "), m = Math.max(l1.length, l2.length); if (!best || m < best[0]) best = [m, l1, l2]; } b.lines = [best[1], best[2]]; }
      b.lw = Math.max(...b.lines.map((l) => l.length)) * 6.2 / KREF;
      b.lh = (b.lines.length * LH + 7) / KREF;
      b.ring = ringOf(b.d);
      b.dots = b.pts.map((id, i) => ({ id, ball: b.id, a: -Math.PI / 2 + i * 2 * Math.PI / n }));
    });
    const TAU = Math.PI * 2, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const areaAng = (a) => (AREA[a].i / KD.areas.length) * TAU - Math.PI / 2;
    const place = (b) => { const R = RINGS[b.ring]; b.x = R * Math.cos(b.a); b.y = R * Math.sin(b.a); };
    const byRing = []; KD.balls.forEach((b) => (byRing[b.ring] = byRing[b.ring] || []).push(b));
    byRing.forEach((list, k) => {
      if (!list) return;
      list.forEach((b) => {
        let sx = Math.cos(areaAng(b.area)), sy = Math.sin(areaAng(b.area));
        b.parents.forEach((p) => { const P = BALL[p]; if (P.ring && P.ring < k) { sx += 1.2 * Math.cos(P.a); sy += 1.2 * Math.sin(P.a); } });
        b.ta = b.a = Math.atan2(sy, sx);
      });
      if (k === 0) { list.forEach((b) => { b.a = 0; b.x = 0; b.y = 0; }); return; }
      const R = RINGS[k];
      list.sort((x, y) => x.ta - y.ta);
      for (let it = 0; it < 240 && list.length > 1; it++) {
        for (let i = 0; i < list.length; i++) {
          const A = list[i], B = list[(i + 1) % list.length];
          const need = Math.min(TAU / list.length, ((Math.max(A.lw, 2 * A.r) + Math.max(B.lw, 2 * B.r)) / 2 + 26) / R);
          const gap = ((B.a - A.a) % TAU + TAU) % TAU;
          if (gap < need) { const m = (need - gap) / 2; A.a -= m; B.a += m; }
        }
        if (it < 120) list.forEach((b) => b.a += wrap(b.ta - b.a) * 0.03);
      }
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
    defs.append("marker").attr("id", "km-arr").attr("viewBox", "0 0 8 8").attr("refX", 7).attr("refY", 4)
      .attr("markerWidth", 5).attr("markerHeight", 5).attr("markerUnits", "userSpaceOnUse").attr("orient", "auto").append("path").attr("d", "M0,0.8 L7.2,4 L0,7.2 z").style("fill", "rgba(255,255,255,.7)");
    const glowG = defs.append("radialGradient").attr("id", "km-glowg");
    [[0, 0.95], [0.32, 0.42], [0.62, 0.12], [1, 0]].forEach(([o, a]) => glowG.append("stop").attr("offset", o).attr("stop-color", "#fff").attr("stop-opacity", a));
    const gR = root.append("g"), gL = root.append("g"), gB = root.append("g");
    RINGS.slice(1).forEach((R) => gR.append("circle").attr("class", "km-ring").attr("r", R));
    let K = 1;
    const trimTo = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * d, p[1] + dy / L * d]; };
    function linkPath([s, t]) {
      const a = BALL[s], b = BALL[t], c = [(a.x + b.x) / 2 * 0.88, (a.y + b.y) / 2 * 0.88];
      const p0 = trimTo([a.x, a.y], c, a.cur + 7 / K), p1 = trimTo([b.x, b.y], c, b.cur + 10 / K);
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
          lab.attr("font-size", FS / K).attr("stroke-width", 3.2 / K).attr("y", R + 16 / K); lab.selectAll("tspan").attr("dy", (l, i) => i ? LH / K : 0);
        }
      });
    }
    function sizeText() {
      const narrow = svg.node().clientWidth < 600;
      const shown = (b) => ks.open === b.id || HOT.has(b.id) || (narrow ? K >= 1.25 || (bNext(b.id) && K >= 0.75) : K >= 0.42);
      blab.attr("display", (b) => shown(b) ? null : "none");
      bcount.attr("display", (b) => ks.open === b.id ? null : "none");
      geom(ballSel);
      linkSel.attr("d", linkPath);
      dotSel.select(".km-core").attr("r", 5.2 / K);
      dotSel.select(".km-halo").attr("r", 8.6 / K);
      dotSel.select("text").attr("font-size", 11.5 / K).attr("stroke-width", 3.2 / K)
        .attr("x", (d) => Math.cos(d.a) * 13 / K).attr("y", (d) => Math.sin(d.a) * 13 / K)
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
    const TOP = 62, BOTTOM = 58; // room for the search bar and the legend
    function fitTo(t, ms = 450) { (ms && !reduceMotion() ? svg.transition().duration(ms) : svg).call(zoom.transform, t); }
    function fitBox(x0, y0, x1, y1, ms) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return;
      const ih = h - TOP - BOTTOM, k = Math.min(3.2, 0.94 * Math.min(w / (x1 - x0), ih / (y1 - y0)));
      fitTo(d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, TOP + ih / 2 - k * (y0 + y1) / 2).scale(k), ms);
    }
    function fitBalls(ids, ms) {
      const bs = ids ? KD.balls.filter((b) => ids.has(b.id)) : KD.balls, hw = (b) => Math.max(b.r, b.lw / 2) + 8;
      fitBox(d3.min(bs, (b) => b.x - hw(b)), d3.min(bs, (b) => b.y - b.r - 10), d3.max(bs, (b) => b.x + hw(b)), d3.max(bs, (b) => b.y + b.r + b.lh), ms);
    }
    function fitOpen(b) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return;
      const room = Math.min(w / 2 - (w < 600 ? 92 : 170), (h - TOP - BOTTOM) / 2 - 46);
      const k = Math.max(0.5, Math.min(3.4, room / b.ro));
      fitTo(d3.zoomIdentity.translate(w / 2 - k * b.x, TOP + (h - TOP - BOTTOM) / 2 - k * b.y).scale(k));
    }

    // ----- state -----
    const ks = { open: null, point: null, focus: null, shown: false };
    function refresh() {
      HOT = new Set(hotBalls());
      el("kmap").classList.toggle("km-flashon", flashOn);
      const fb = el("km-flash"); fb.setAttribute("aria-pressed", flashOn ? "true" : "false"); fb.querySelector("span").textContent = flashOn ? "Top picks glowing" : "Glow off";
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


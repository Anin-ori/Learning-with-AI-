
  // ---------- Knowledge map (v1.0) ----------
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

    // ----- layout -----
    const RS = 5.5;
    KD.balls.forEach((b) => {
      const cs = b.pts.map((id) => ({ id, r: RS + 2 }));
      d3.packSiblings(cs); const e = d3.packEnclose(cs);
      b.r = e.r + 6;
      const ringR = b.r + 18;
      b.dots = cs.map((c, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / cs.length; return { id: c.id, px: c.x - e.x, py: c.y - e.y, qx: Math.cos(a) * ringR, qy: Math.sin(a) * ringR, a }; });
      const w = b.name.split(" ");
      if (b.name.length <= 17 || w.length < 2) b.lines = [b.name];
      else { let best = null; for (let i = 1; i < w.length; i++) { const l1 = w.slice(0, i).join(" "), l2 = w.slice(i).join(" "), m = Math.max(l1.length, l2.length); if (!best || m < best[0]) best = [m, l1, l2]; } b.lines = [best[1], best[2]]; }
      b.cr = Math.max(b.r + 34, Math.max(...b.lines.map((l) => l.length)) * 4.4);
    });
    const angle = (a) => (AREA[a].i / KD.areas.length) * Math.PI * 2 - Math.PI / 2;
    KD.balls.forEach((b, i) => { const a = angle(b.area) + ((i * 0.618) % 1 - 0.5) * 0.3, r = 62 * Math.pow(b.d, 0.85); b.tx = Math.cos(a) * r; b.ty = Math.sin(a) * r; b.x = b.tx + (i % 5); b.y = b.ty + (i % 3); });
    const sim = d3.forceSimulation(KD.balls)
      .force("link", d3.forceLink(KD.blinks.map(([s, t]) => ({ source: s, target: t }))).id((d) => d.id).distance(90).strength(0.03))
      .force("charge", d3.forceManyBody().strength(-90).distanceMax(300))
      .force("collide", d3.forceCollide((d) => d.cr).iterations(3))
      .force("x", d3.forceX((d) => d.tx).strength(0.12)).force("y", d3.forceY((d) => d.ty).strength(0.12)).stop();
    for (let i = 0; i < 500; i++) sim.tick();

    // ----- drawing -----
    const svg = d3.select("#km-svg"), root = svg.append("g");
    svg.append("defs").append("marker").attr("id", "km-arr").attr("viewBox", "0 0 8 8").attr("refX", 7).attr("refY", 4)
      .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,0.8 L7.2,4 L0,7.2 z").style("fill", "var(--k-edge)");
    const gL = root.append("g"), gB = root.append("g");
    const edge = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1; return `M${a.x + dx / L * (a.r + 3)},${a.y + dy / L * (a.r + 3)}L${b.x - dx / L * (b.r + 7)},${b.y - dy / L * (b.r + 7)}`; };
    const linkSel = gL.selectAll("path").data(KD.blinks).join("path").attr("class", "km-blk").attr("d", ([s, t]) => edge(BALL[s], BALL[t])).attr("marker-end", "url(#km-arr)");
    const ballSel = gB.selectAll("g.km-ball").data(KD.balls).join("g").attr("class", "km-ball").attr("transform", (b) => `translate(${b.x},${b.y})`).style("--h", (b) => AREA[b.area].h);
    ballSel.append("circle").attr("class", "km-glow").attr("r", (b) => b.r + 9);
    ballSel.append("circle").attr("class", "km-halo").attr("r", (b) => b.r + 5);
    ballSel.append("circle").attr("class", "km-body").attr("r", (b) => b.r);
    ballSel.append("circle").attr("class", "km-wash").attr("r", (b) => b.r);
    const dotSel = ballSel.selectAll("g.km-dot").data((b) => b.dots).join("g").attr("class", "km-dot").attr("transform", (d) => `translate(${d.px},${d.py})`);
    dotSel.append("circle").attr("class", "km-halo").attr("r", RS + 3.2);
    dotSel.append("circle").attr("class", "km-core").attr("r", RS);
    dotSel.append("text").text((d) => nm(d.id));
    const blab = ballSel.append("text").attr("class", "km-blab").attr("text-anchor", "middle");
    blab.selectAll("tspan").data((b) => b.lines).join("tspan").attr("x", 0).text((l) => l);
    const bcount = ballSel.append("text").attr("class", "km-bcount").attr("text-anchor", "middle").attr("dominant-baseline", "central");

    let K = 1;
    function sizeText() {
      blab.attr("display", (b) => (K < 0.55 && !HOT.has(b.id) && ks.open !== b.id) ? "none" : null);
      blab.attr("font-size", 12.5 / K).attr("stroke-width", 3.5 / K).attr("y", (b) => ks.open === b.id ? (-3 - (b.lines.length - 1) * 15) / K : b.r + 5 + 12 / K);
      blab.selectAll("tspan").attr("dy", (l, i) => i ? 15 / K : 0);
      bcount.attr("font-size", 11 / K).attr("y", 11 / K);
      dotSel.select("text").attr("font-size", 11 / K).attr("stroke-width", 3 / K)
        .attr("x", (d) => Math.cos(d.a) * (RS + 5)).attr("y", (d) => Math.sin(d.a) * (RS + 5))
        .attr("text-anchor", (d) => Math.cos(d.a) > 0.25 ? "start" : Math.cos(d.a) < -0.25 ? "end" : "middle")
        .attr("dominant-baseline", (d) => Math.abs(Math.cos(d.a)) > 0.25 ? "central" : Math.sin(d.a) < 0 ? "auto" : "hanging");
    }
    const zoom = d3.zoom().scaleExtent([0.25, 8]).on("zoom", (e) => { root.attr("transform", e.transform); if (Math.abs(e.transform.k - K) > 1e-3) { K = e.transform.k; sizeText(); } });
    svg.call(zoom).on("dblclick.zoom", null);
    function fitBox(x0, y0, x1, y1, ms = 450) {
      const node = svg.node(), w = node.clientWidth, h = node.clientHeight; if (!w || !h) return;
      const k = Math.min(4.5, 0.92 * Math.min(w / (x1 - x0), h / (y1 - y0)));
      const t = d3.zoomIdentity.translate(w / 2 - k * (x0 + x1) / 2, h / 2 - k * (y0 + y1) / 2).scale(k);
      (ms && !matchMedia("(prefers-reduced-motion: reduce)").matches ? svg.transition().duration(ms) : svg).call(zoom.transform, t);
    }
    function fitBalls(ids, ms) {
      const bs = ids ? KD.balls.filter((b) => ids.has(b.id)) : KD.balls;
      fitBox(d3.min(bs, (b) => b.x - b.r) - 80, d3.min(bs, (b) => b.y - b.r) - 20, d3.max(bs, (b) => b.x + b.r) + 80, d3.max(bs, (b) => b.y + b.r) + 75, ms);
    }
    const fitOpen = (b) => { const R = b.r + 18 + 110; fitBox(b.x - R, b.y - R * 0.72, b.x + R, b.y + R * 0.72); };

    // ----- state -----
    const ks = { open: null, point: null, focus: null, shown: false };
    function refresh() {
      HOT = new Set(hotBalls());
      el("kmap").classList.toggle("km-flashon", flashOn);
      const fb = el("km-flash"); fb.setAttribute("aria-pressed", flashOn ? "true" : "false"); fb.querySelector("span").textContent = "White flash: " + (flashOn ? "on" : "off");
      ballSel.attr("class", (b) => "km-ball st-" + bStatus(b.id) + (bOnRoute(b.id) ? " route" : "") + (bNext(b.id) ? " next" : "") + (HOT.has(b.id) ? " hot" : "") + (ks.open === b.id ? " open" : ""));
      dotSel.attr("class", (d) => "km-dot st-" + pStatus(d.id) + (ROUTE.has(d.id) && !learned.has(d.id) ? " route" : "") + (pNext(d.id) ? " next" : "") + (ks.point === d.id ? " sel" : ""))
        .style("--h", (d) => AREA[byId[d.id].area].h);
      bcount.text((b) => `${b.pts.filter((p) => learned.has(p)).length} of ${b.pts.length} learned`);
      sizeText(); paintFocus(); renderMine();
      if (ks.point) renderPoint(ks.point); else if (ks.open) renderBall(ks.open);
    }
    function paintFocus() {
      const lit = ks.focus || (ks.open ? new Set([ks.open, ...BALL[ks.open].parents, ...BALL[ks.open].children]) : null);
      svg.classed("dimmed", !!lit);
      ballSel.classed("lit", (b) => !!lit && lit.has(b.id));
      linkSel.classed("lit", ([s, t]) => !!ks.open && (s === ks.open || t === ks.open));
    }
    function openBall(id, fit = true) {
      ks.open = id; ks.focus = null; ks.point = null;
      el("km-focus").classList.remove("on");
      dotSel.attr("transform", (d) => { const mine = BALL_OF[d.id] === id; return `translate(${mine ? d.qx : d.px},${mine ? d.qy : d.py})`; });
      gB.selectAll("g.km-ball").filter((b) => b.id === id).raise();
      refresh(); renderBall(id); tab("det");
      if (fit) fitOpen(BALL[id]);
    }
    function closeBall() { if (!ks.open) return; ks.open = null; ks.point = null; dotSel.attr("transform", (d) => `translate(${d.px},${d.py})`); refresh(); }
    function showPoint(id) { if (ks.open !== BALL_OF[id]) openBall(BALL_OF[id]); ks.point = id; refresh(); renderPoint(id); tab("det"); }
    function setFocus(ids, label) {
      closeBall(); ks.focus = ids;
      el("km-focus").classList.toggle("on", !!ids); el("km-focustext").textContent = label || "";
      paintFocus(); if (ids) fitBalls(ids);
    }
    el("km-clear").onclick = () => { setFocus(null); fitBalls(null); };
    el("km-fit").onclick = () => { closeBall(); setFocus(null); fitBalls(null); };
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
    ballSel.select(".km-body").on("pointermove", (e, b) => showTip(e, `<b>${esc(b.name)}</b><span>${STXT[bStatus(b.id)]} · ${b.pts.filter((p) => learned.has(p)).length} of ${b.pts.length} points learned${HOT.has(b.id) ? " · AI's top pick" : ""}</span>`))
      .on("pointerleave", () => tip.style.display = "none")
      .on("click", (e, b) => { e.stopPropagation(); tip.style.display = "none"; if (ks.open === b.id) { ks.point = null; refresh(); renderBall(b.id); tab("det"); } else openBall(b.id); });
    dotSel.on("pointermove", (e, d) => { if (ks.open === BALL_OF[d.id]) showTip(e, `<b>${esc(nm(d.id))}</b><span>${STXT[pStatus(d.id)]}${ROUTE.has(d.id) && !learned.has(d.id) ? " · on the suggested route" : ""}</span>`); })
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
    const TABS = ["mine", "det", "prob", "src"];
    function tab(which) { TABS.forEach((k) => { el("km-t-" + k).setAttribute("aria-selected", k === which ? "true" : "false"); el("km-p-" + k).hidden = k !== which; }); }
    TABS.forEach((k) => el("km-t-" + k).onclick = () => tab(k));
    const bpill = (id) => `<button class="km-pill${bNext(id) ? " next" : ""}${HOT.has(id) ? " hot" : ""}" data-ball="${id}" type="button">${esc(bn(id))}</button>`;
    const ppill = (id) => `<button class="km-pill" data-point="${id}" type="button">${esc(nm(id))}</button>`;
    const swatch = (fill, stroke, ring) => `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">${ring ? `<circle cx="11" cy="11" r="9.6" fill="none" stroke="var(--k-route)" stroke-width="${ring}" ${ring < 2 ? 'stroke-opacity=".6"' : ""}/>` : ""}<circle cx="11" cy="11" r="6.5" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="1.6"` : ""}/></svg>`;
    const C = "hsl(150 46% 45%)";
    const SW = { learned: swatch(`color-mix(in srgb, ${C} 62%, var(--k-map))`, C), ready: swatch(`color-mix(in srgb, ${C} 22%, var(--k-map))`, C), locked: swatch("var(--k-locked)", "var(--k-locked-dot)"),
      flash: `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="9" fill="#fff" style="filter: drop-shadow(0 0 3px var(--k-flash-shadow))"/></svg>` };
    el("km-legend").innerHTML = `<span>${SW.learned}Learned</span><span>${SW.ready}Can learn now</span><span>${SW.locked}Not reachable yet</span>
      <span>${swatch("var(--k-locked)", "", 1.4)}AI's suggested route</span><span>${swatch("var(--k-locked)", "", 3)}Suggested next</span><span>${SW.flash}AI's top picks (white flash)</span><span>Scroll or pinch to zoom</span>`;

    function renderMine() {
      const bc = { learned: 0, ready: 0, locked: 0 }; KD.balls.forEach((b) => bc[bStatus(b.id)]++);
      const hot = [...HOT];
      const next = KD.balls.map((b) => b.id).filter((b) => bNext(b) && !HOT.has(b));
      const off = KD.balls.map((b) => b.id).filter((b) => !bNext(b) && bStatus(b) === "ready");
      el("km-p-mine").innerHTML = `
        <p class="km-small">Goal</p><h2>Python for machine learning</h2>
        <div class="km-stat3"><div><b>${bc.learned}</b>balls learned</div><div><b>${bc.ready}</b>can learn now</div><div><b>${bc.locked}</b>not reachable yet</div></div>
        <p class="km-small">${learned.size} of ${KD.nodes.length} points learned.</p>
        ${isExample ? `<div class="km-note"><span>This is <b>example progress</b> (roughly the first two chapters of a beginner book), not yours.</span><div class="km-btns"><button class="km-btn solid" type="button" data-act="clear">Start with an empty map</button></div></div>` : ""}
        <div class="km-hotcard"><span class="km-status">AI's top picks right now${flashOn ? ", flashing white" : ""}</span>
          ${hot.length ? `<div class="km-ex">${hot.map(bpill).join("")}</div><span class="km-small">The suggested-next balls where you can start the most route points now; ties go to the ball that opens more of the route.</span>` : `<span class="km-empty">Nothing on the route is reachable right now.</span>`}
          <div class="km-btns"><button class="km-btn" type="button" data-act="flash">${flashOn ? "Turn white flash off" : "Turn white flash on"}</button></div></div>
        ${next.length ? `<h3>Also suggested next</h3><div class="km-ex">${next.map(bpill).join("")}</div>` : ""}
        ${off.length ? `<h3>Also open to you</h3><div class="km-ex">${off.map(bpill).join("")}</div>` : ""}
        <h3>How to read the map</h3>
        <div class="km-key">
          <div>${SW.learned}<span><b>Bright</b>: you've learned every point in the ball.</span></div>
          <div>${SW.ready}<span><b>Pale with an outline</b>: you can learn something in it now.</span></div>
          <div>${SW.locked}<span><b>Grey</b>: nothing in it is reachable yet. You can still open it.</span></div>
          <div>${swatch("var(--k-locked)", "", 1.4)}<span><b>Red ring</b>: the AI's suggested route. A thick ring is a suggested next step.</span></div>
          <div>${SW.flash}<span><b>White flash</b>: the AI's top picks right now. Use the switch above the map to turn it off.</span></div>
        </div>
        <p class="km-small" style="margin-top:10px">The small dots inside each ball are its points, with the same brightness. Open a ball to see their names and mark them as learned.</p>
        <h3>Where the balls and the route come from</h3>
        <p class="km-small">Each ball groups points that the books usually teach together; a ball's details show how often. The route is the ${GOAL.size} points taught in the two sources written for data work (Kaggle Learn: Python and Python for Data Analysis, chapters 2–3) plus the ${ROUTE.size - GOAL.size} points they build on. It is a suggestion, not a plan.</p>
        <div class="km-btns"><button class="km-btn" type="button" data-act="clear">Clear my progress</button><button class="km-btn" type="button" data-act="example">Load example progress</button></div>
        <p class="km-small" style="margin-top:8px">Your map progress is saved with the rest of your Learning Companion progress.</p>`;
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
        <span class="km-chip" style="--h:${AREA[b.area].h}"><i></i>${esc(AREA[b.area].name)}</span>
        <h2>${esc(b.name)}</h2>
        <div class="km-card"><span class="km-status">${STXT[st]} · ${done} of ${b.pts.length} points learned${bOnRoute(id) ? ` · <span class="r">on the suggested route</span>` : ""}${HOT.has(id) ? " · AI's top pick" : ""}</span>
          <div class="km-btns">${done < b.pts.length ? `<button class="km-btn solid" type="button" data-markall="${id}">Mark whole ball as learned</button>` : ""}${done ? `<button class="km-btn" type="button" data-clearall="${id}">Clear this ball</button>` : ""}</div></div>
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
      else if (ds.markall) { BALL[ds.markall].pts.forEach((p) => learned.add(p)); commit(`Map: whole ball "${bn(ds.markall)}" marked learned`); }
      else if (ds.clearall) { BALL[ds.clearall].pts.forEach((p) => learned.delete(p)); commit(`Map: ball "${bn(ds.clearall)}" cleared`); }
      else if (ds.act === "clear") { learned = new Set(); commit("Map: progress cleared"); }
      else if (ds.act === "example") { learned = new Set(EXAMPLE); isExample = true; persist("Map: example progress loaded"); refresh(); }
      else if (ds.act === "flash") { flashOn = !flashOn; persist(); refresh(); }
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
    el("km-p-prob").innerHTML = `<p class="km-small">From the test of the point map before the points were packed into balls.</p>` +
      PROBLEMS.map((p, i) => `<div class="km-prob"><div class="head"><span class="num">${p.num}</span><h4>${p.title}</h4><span class="km-sev ${p.sev}">${p.sev === "ok" ? "fine" : p.sev}</span></div>
        <p>${p.body}</p>
        ${p.pairs ? `<div class="km-pairs">${p.pairs.map(([a, b, bf, af]) => `<div><span>${esc(nm(a))} → ${esc(nm(b))}</span><span>${bf} : ${af}</span></div>`).join("")}<div><span class="km-small">books putting the left one first : the right one first</span><span></span></div></div>` : ""}
        ${p.label ? `<button class="km-btn" type="button" data-show="${i}">Show on map</button>` : ""}</div>`).join("");
    el("km-p-src").innerHTML = `<p class="km-small">Each source's section headings, in the authors' order.</p><div class="km-srclist">` +
      Object.entries(KD.sources).map(([id, s]) => `<div class="km-src"><b><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a></b><span>${esc(s.author)} · ${esc(s.kind)}</span><span>${s.n} headings · teaches ${KD.nodes.filter((n) => n.src[id]).length} of the ${KD.nodes.length} points${id === "exercism" ? " · lists prerequisites, used as the human check" : ""}</span></div>`).join("") + `</div>`;

    loadProgress(); refresh();
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (!el("kmap").hidden) (ks.open ? fitOpen(BALL[ks.open]) : fitBalls(ks.focus, 0)); }, 150); });
    return {
      show() { refresh(); if (!ks.shown) { ks.shown = true; requestAnimationFrame(() => { if (!ks.open) fitBalls(el("km-svg").clientWidth < 600 && HOT.size ? new Set(HOT) : null, 0); }); } },
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

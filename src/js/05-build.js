  // ---------- Building a subject's map (v2.0) ----------
  // The AI builds the map for any subject, in pieces so no single answer runs past the length limit:
  //   1. an architect plans the areas, topics and points for this learner's goal, and writes the subject profile;
  //   2. writers, one request per group of topics, say what each point is and which points it needs first;
  //   3. a router marks the points the goal needs (the page adds what they build on);
  //   4. a checker reviews the whole map and returns fixes, which the page applies.
  // The page then checks only structure, as a safety check: every link names a real point, and "needed first" links
  // never loop. Nothing about content is preset: the AI decides what the subject is made of.
  const MAP_LIMITS = { areas: 24, topics: 80, perTopic: 30, points: 480, chunk: 36 };   // safety limits only, never targets
  const BUILD_STAGES = [
    ["arch", "Architect", "plans the topics and points for your goal"],
    ["detail", "Writers", "write what each point is and what it builds on"],
    ["route", "Router", "marks the route your goal needs"],
    ["check", "Checker", "reviews the whole map and fixes what's wrong"],
    ["page", "Page", "checks the map's structure in code"],
  ];
  const learnerAbout = (s) => [
    "Subject: " + s.name,
    "The learner's goal: " + (s.goal || "(not given: assume a solid general foundation)"),
    "Where they are now, in their own words: " + (s.situation || "(not given)"),
  ].join("\n");

  const architectPrompt = (s) => [
    "You are the architect in Learning Companion, an open-source study tool for self-learners. You build the knowledge map for one learner's subject. Other AIs will then write each point's details, teach each point as its own lesson, and write practice; your map is what all of them work from.",
    learnerAbout(s), "",
    "What a good map is:",
    "- It covers what this learner needs to reach their goal and the foundations that rests on, with enough around it that they can see where it leads. Judge the scope yourself, and say in \"scope\" what you included, what you left out, and why.",
    "- A point is one idea a learner can learn in one focused sitting and then use: small enough for one lesson, big enough to stand on its own. A topic groups points a learner would naturally study together. An area groups related topics.",
    "- Name points the way a learner would recognise them, briefly. No two points teach the same idea; where the same idea comes back in a new setting, make that clear in the name or merge the points.",
    "- List topics from basics to advanced, and points inside each topic in a sensible teaching order.",
    "- Be accurate about the subject as experts understand it today. Where experts disagree about how the subject is organised, follow the most widely used organisation and mention the choice in \"scope\".",
    "",
    "Also write the subject profile. Teaching and practice standards that hold for every subject are illustrated with it, so each field is an example from this subject, not content to reuse:",
    "- name: the subject's name as the learner should see it.",
    "- trap: one surprising case whose explanation reveals how the subject works underneath, with the explanation.",
    "- slips: examples of slips that reveal nothing (a typo, a misremembered name), in this subject.",
    "- observe: how a learner can observe for themselves what is really going on in this subject.",
    "- shallow: an example of a drill in this subject (one step, repeating one fact).",
    "- rich: an example of real practice in this subject (a small task that makes the learner combine several ideas and decide how).",
    "- examples: how good examples look in this subject's lessons, in one or two sentences (for a programming language: short runnable programs, each followed by its exact output).",
    "- run: how practice answers can be checked. The page can run \"python\" programs and \"javascript\" programs in the browser. Choose one of them only if the subject is that language, or is practised by writing programs in it; otherwise choose \"none\", and practice will be written answers that another AI reads.",
    "- format: for \"none\" only, what a practice exercise and its answer look like in this subject.",
    "",
    'Reply with only JSON: {"subject": "the subject\'s name", "scope": "what the map covers and leaves out, and why", "profile": {"name": "", "trap": "", "slips": "", "observe": "", "shallow": "", "rich": "", "examples": "", "run": "python, javascript or none", "format": ""}, "areas": [{"name": "area name", "topics": [{"name": "topic name", "desc": "one sentence: what this topic is about and why its points belong together", "points": ["point name", "..."]}]}]}',
  ].join("\n");

  const mapLines = (W, withNeeds) => W.balls.map((b) => "Topic " + b.id + ": " + b.name + "\n" + b.pts.map((p) => {
    const n = W.byId[p];
    return "  " + p + " | " + n.name + (withNeeds && n.what ? " | " + n.what : "") + (withNeeds ? " | needs: " + (n.needs.join(", ") || "nothing") : "");
  }).join("\n")).join("\n");

  const detailPrompt = (s, W, chunk) => [
    "You write the details of part of a knowledge map in Learning Companion, a study tool for self-learners. An architect AI planned the whole map; other writers are doing the other topics at the same time.",
    learnerAbout(s), "",
    "The whole map, every point with its id:", mapLines(W, false), "",
    "Your topics: " + chunk.map((b) => b.id + " (" + b.name + ")").join(", ") + ".",
    "For every point in your topics:",
    "- what: one or two sentences on what the learner will understand or be able to do once they have learned it.",
    "- needs: the ids of points that must be learned first because this point can't be understood without them. Points anywhere on the map count. Only direct needs: if A needs B and B needs C, A lists B, not C. A point that only makes this one easier is not a need.",
    "- helps: the ids of points that make this one easier or are often learned first, but aren't required.",
    "For every one of your topics:",
    "- where: real books, courses or references that teach it well, with the chapter or section where you know it. Add a URL only if you are sure it is right. Name only sources you are confident exist; an empty list is better than a guess.",
    "",
    'Reply with only JSON: {"points": [{"id": "the point id", "what": "", "needs": ["ids"], "helps": ["ids"]}], "topics": [{"id": "the topic id", "where": [{"title": "", "detail": "chapter or section, or empty", "url": "or empty"}]}]}',
  ].join("\n");

  const routerPrompt = (s, W) => [
    "You mark the learner's route on their knowledge map in Learning Companion, a study tool for self-learners. The route is a suggestion shown on the map with a red ring; the learner still chooses what to study.",
    learnerAbout(s), "",
    "The map, every point with its id, what it is and what it needs first:", mapLines(W, true), "",
    "Choose the points this learner's goal actually needs. The page adds everything they build on, so list what the goal itself uses. Judge from the goal, not from the order of the map: include what matters even if it seems basic, and leave out what the goal doesn't need even if courses usually teach it.",
    "For each topic with points you chose, say in one sentence why the goal needs it.",
    'Reply with only JSON: {"goal": ["point ids"], "why": [{"topic": "topic id", "why": "one sentence"}], "note": "one or two sentences on how you chose"}',
  ].join("\n");

  const checkerPrompt = (s, W) => [
    "You review a knowledge map before a self-learner sees it, in Learning Companion. AIs built it from the learner's goal without a textbook, so you are the check on what they got wrong. You are an editor: fix real errors, and leave the rest alone.",
    learnerAbout(s), "",
    "Scope the architect chose: " + (W.scope || "(not stated)"),
    "", "The map, every point with its id, what it is and what it needs first:", mapLines(W, true), "",
    "The route (points the goal needs, before the page adds what they build on): " + (W.route.goal.join(", ") || "none"), "",
    "Errors worth fixing: a point that is wrong or misnamed; a point that doesn't belong to this subject; an idea that is missing although the goal or other points on the map clearly rest on it; two points that teach the same idea; a \"needs\" link that is wrong (the point can be understood without it) or missing (the point can't be understood without it); a point in the wrong topic; a route that leaves out something the goal clearly needs or includes something it clearly doesn't.",
    "Not errors: a different but reasonable choice of scope, order, grouping or naming.",
    "Give each fix as one operation:",
    '- {"op": "add_point", "topic": "topic id", "name": "", "what": "", "needs": ["ids"], "route": true or false, "why": ""}',
    '- {"op": "remove_point", "id": "", "why": ""}',
    '- {"op": "merge", "id": "the point to remove", "into": "the point that keeps the idea", "why": ""}',
    '- {"op": "rename", "id": "", "name": "", "what": "", "why": ""}',
    '- {"op": "move", "id": "", "topic": "topic id", "why": ""}',
    '- {"op": "add_need", "id": "", "need": "", "why": ""} and {"op": "remove_need", "id": "", "need": "", "why": ""}',
    '- {"op": "route_add", "id": "", "why": ""} and {"op": "route_remove", "id": "", "why": ""}',
    'Reply with only JSON: {"fixes": [operations], "verdict": "one or two sentences on how sound the map is now"}',
  ].join("\n");

  // ----- working map: a mutable view the builders and the page's checks share -----
  function workMap(arch) {
    const W = { scope: pstr(arch && arch.scope), subject: pstr(arch && arch.subject), profile: {}, areas: [], balls: [], byId: {}, order: [], route: { goal: [], why: {}, note: "" }, notes: [], fixes: [] };
    const p = (arch && arch.profile) || {};
    ["name", "trap", "slips", "observe", "shallow", "rich", "examples", "format"].forEach((k) => { W.profile[k] = pstr(p[k]); });
    W.profile.run = ["python", "javascript", "none"].includes(pstr(p.run).toLowerCase()) ? pstr(p.run).toLowerCase() : "none";
    let nTopic = 0, nPoint = 0, cut = 0;
    const seenName = new Set();
    parr(arch && arch.areas).slice(0, MAP_LIMITS.areas).forEach((a, ai) => {
      const area = { id: "a" + (ai + 1), name: pstr(a && a.name) || "Area " + (ai + 1) };
      parr(a && a.topics).forEach((t) => {
        if (W.balls.length >= MAP_LIMITS.topics) { cut++; return; }
        const b = { id: "t" + (++nTopic), name: pstr(t && t.name), area: area.id, desc: pstr(t && t.desc), pts: [], where: [] };
        if (!b.name) return;
        parr(t && t.points).forEach((name) => {
          name = pstr(name);
          if (!name) return;
          if (W.order.length >= MAP_LIMITS.points || b.pts.length >= MAP_LIMITS.perTopic) { cut++; return; }
          const key = name.toLowerCase();
          if (seenName.has(key)) { W.notes.push("Dropped a second point named \"" + name + "\"."); return; }
          seenName.add(key);
          const id = "p" + (++nPoint);
          W.byId[id] = { id, name, what: "", needs: [], helps: [] };
          W.order.push(id); b.pts.push(id);
        });
        if (b.pts.length) W.balls.push(b);
      });
      if (W.balls.some((b) => b.area === area.id)) W.areas.push(area);
    });
    if (cut) W.notes.push("The map ran past the page's safety limits, so " + cut + " topics or points were left out.");
    if (W.order.length < 2) throw { code: "invalid_json", agent: "Architect" };
    return W;
  }
  // the saved map, as a working map with the same ids (used to update the route without rebuilding)
  function workFromMap(M) {
    const W = { scope: M.scope, subject: M.subject, profile: M.profile, areas: M.areas.map(([id, name]) => ({ id, name })), byId: {}, order: M.nodes.map((n) => n.id),
      balls: M.balls.map((b) => ({ ...b, pts: b.pts.slice() })), route: { goal: [], why: {}, note: "" }, notes: [], fixes: [] };
    M.nodes.forEach((n) => { W.byId[n.id] = { id: n.id, name: n.name, what: n.what, needs: [], helps: [] }; });
    M.links.forEach(([a, b, k]) => { if (W.byId[a] && W.byId[b]) (k === "helps" ? W.byId[b].helps : W.byId[b].needs).push(a); });
    return W;
  }
  function applyDetails(W, d, chunk) {
    parr(d && d.points).forEach((x) => {
      const n = W.byId[pstr(x && x.id)];
      if (!n || !chunk.some((b) => b.pts.includes(n.id))) return;
      n.what = pstr(x.what);
      n.needs = parr(x.needs).map(pstr).filter((id) => W.byId[id] && id !== n.id);
      n.helps = parr(x.helps).map(pstr).filter((id) => W.byId[id] && id !== n.id && !n.needs.includes(id));
    });
    parr(d && d.topics).forEach((x) => {
      const b = W.balls.find((y) => y.id === pstr(x && x.id));
      if (!b || !chunk.includes(b)) return;
      b.where = parr(x.where).map((w) => ({ title: pstr(w && w.title), detail: pstr(w && w.detail), url: /^https?:\/\/\S+$/.test(pstr(w && w.url)) ? pstr(w.url) : "" })).filter((w) => w.title).slice(0, 8);
    });
  }
  function applyRoute(W, r) {
    W.route.goal = [...new Set(parr(r && r.goal).map(pstr).filter((id) => W.byId[id]))];
    W.route.why = {};
    parr(r && r.why).forEach((x) => { const id = pstr(x && x.topic); if (W.balls.some((b) => b.id === id) && pstr(x.why)) W.route.why[id] = pstr(x.why); });
    W.route.note = pstr(r && r.note);
  }
  function applyFixes(W, c) {
    const ok = (text) => W.fixes.push({ done: true, text }), skip = (text) => W.fixes.push({ done: false, text });
    const ball = (id) => W.balls.find((b) => b.id === id);
    const nameOf = (id) => (W.byId[id] ? "\"" + W.byId[id].name + "\"" : id);
    let nPoint = W.order.reduce((m, id) => Math.max(m, +id.slice(1) || 0), 0);
    const drop = (id) => {
      W.balls.forEach((b) => { b.pts = b.pts.filter((x) => x !== id); });
      W.order = W.order.filter((x) => x !== id);
      Object.values(W.byId).forEach((n) => { n.needs = n.needs.filter((x) => x !== id); n.helps = n.helps.filter((x) => x !== id); });
      W.route.goal = W.route.goal.filter((x) => x !== id);
      delete W.byId[id];
    };
    parr(c && c.fixes).forEach((f) => {
      const op = pstr(f && f.op), why = pstr(f && f.why), id = pstr(f && f.id), tail = why ? " (" + why + ")" : "";
      if (op === "add_point") {
        const b = ball(pstr(f.topic)), name = pstr(f.name);
        if (!b || !name || W.order.length >= MAP_LIMITS.points) return skip("Couldn't add \"" + name + "\"" + tail);
        if (Object.values(W.byId).some((n) => n.name.toLowerCase() === name.toLowerCase())) return skip("\"" + name + "\" is already on the map");
        const nid = "p" + (++nPoint);
        W.byId[nid] = { id: nid, name, what: pstr(f.what), needs: parr(f.needs).map(pstr).filter((x) => W.byId[x]), helps: [] };
        W.order.push(nid); b.pts.push(nid);
        if (f.route === true) W.route.goal.push(nid);
        ok("Added \"" + name + "\" to " + b.name + tail);
      } else if (op === "remove_point") {
        if (!W.byId[id]) return skip("Couldn't remove " + id + tail);
        const nm = nameOf(id); drop(id); ok("Removed " + nm + tail);
      } else if (op === "merge") {
        const into = pstr(f.into);
        if (!W.byId[id] || !W.byId[into] || id === into) return skip("Couldn't merge " + id + " into " + into + tail);
        const nm = nameOf(id);
        Object.values(W.byId).forEach((n) => { if (n.needs.includes(id) && n.id !== into && !n.needs.includes(into)) n.needs.push(into); });
        if (W.route.goal.includes(id) && !W.route.goal.includes(into)) W.route.goal.push(into);
        drop(id); ok("Merged " + nm + " into " + nameOf(into) + tail);
      } else if (op === "rename") {
        const n = W.byId[id], name = pstr(f.name);
        if (!n || !name) return skip("Couldn't rename " + id + tail);
        const was = n.name; n.name = name; if (pstr(f.what)) n.what = pstr(f.what);
        ok("Renamed \"" + was + "\" to \"" + name + "\"" + tail);
      } else if (op === "move") {
        const b = ball(pstr(f.topic));
        if (!W.byId[id] || !b) return skip("Couldn't move " + id + tail);
        W.balls.forEach((x) => { x.pts = x.pts.filter((p) => p !== id); });
        b.pts.push(id); ok("Moved " + nameOf(id) + " to " + b.name + tail);
      } else if (op === "add_need" || op === "remove_need") {
        const n = W.byId[id], need = pstr(f.need);
        if (!n || !W.byId[need] || id === need) return skip("Couldn't change what " + id + " needs" + tail);
        if (op === "add_need") { if (!n.needs.includes(need)) n.needs.push(need); n.helps = n.helps.filter((x) => x !== need); ok(nameOf(id) + " now needs " + nameOf(need) + " first" + tail); }
        else { n.needs = n.needs.filter((x) => x !== need); ok(nameOf(id) + " no longer needs " + nameOf(need) + " first" + tail); }
      } else if (op === "route_add" || op === "route_remove") {
        if (!W.byId[id]) return skip("Couldn't change the route at " + id + tail);
        if (op === "route_add") { if (!W.route.goal.includes(id)) W.route.goal.push(id); ok("Put " + nameOf(id) + " on the route" + tail); }
        else { W.route.goal = W.route.goal.filter((x) => x !== id); ok("Took " + nameOf(id) + " off the route" + tail); }
      } else if (op) skip("Unknown fix \"" + op + "\"" + tail);
    });
    W.balls = W.balls.filter((b) => b.pts.length);
    W.areas = W.areas.filter((a) => W.balls.some((b) => b.area === a.id));
    W.verdict = pstr(c && c.verdict);
  }

  // ----- the page's structural checks: links point to real points, "needed first" never loops -----
  function finishMap(W) {
    const notes = W.notes;
    const ids = W.balls.flatMap((b) => b.pts);
    const pos = new Map(ids.map((id, i) => [id, i]));
    // 1. "needed first" links that close a loop are dropped. Links that point forward in the map's order (the earlier
    //    point needed by a later one) can't loop among themselves, so they are all kept; each backward link is kept
    //    only if it doesn't close a loop with the links already kept.
    let loops = 0;
    const out = {};
    const add = (p, id) => (out[p] = out[p] || new Set()).add(id);
    const reaches = (from, to) => { const seen = new Set([from]), st = [from]; while (st.length) { const x = st.pop(); if (x === to) return true; (out[x] || []).forEach((y) => { if (!seen.has(y)) { seen.add(y); st.push(y); } }); } return false; };
    const back = [];
    ids.forEach((id) => W.byId[id].needs.forEach((p) => { if (pos.get(p) < pos.get(id)) add(p, id); else back.push([p, id]); }));
    back.forEach(([p, id]) => {
      if (reaches(id, p)) {
        const n = W.byId[id]; n.needs = n.needs.filter((x) => x !== p); loops++;
        notes.push("Dropped the link \"" + W.byId[p].name + "\" needed before \"" + n.name + "\": it closed a loop.");
      } else add(p, id);
    });
    // 2. topic links come from the point links between topics; the weaker direction of a two-way pair is dropped
    const BOF = {}; W.balls.forEach((b) => b.pts.forEach((p) => { BOF[p] = b.id; }));
    const w = {};
    ids.forEach((id) => W.byId[id].needs.forEach((p) => { const s = BOF[p], t = BOF[id]; if (s !== t) w[s + ">" + t] = (w[s + ">" + t] || 0) + 1; }));
    const border = new Map(W.balls.map((b, i) => [b.id, i]));
    let blinks = Object.entries(w).map(([k, n]) => { const [s, t] = k.split(">"); return [s, t, n]; })
      .filter(([s, t, n]) => { const back = w[t + ">" + s] || 0; return n > back || (n === back && border.get(s) < border.get(t)); });
    // longer loops between topics: drop the lightest link that closes one (display only; point links are untouched)
    const bout = {}; blinks.forEach((l) => (bout[l[0]] = bout[l[0]] || []).push(l));
    const bs = {}, dropped = new Set();
    const vb = (id) => { bs[id] = 1; (bout[id] || []).slice().sort((a, b) => b[2] - a[2]).forEach((l) => { if (bs[l[1]] === 1) dropped.add(l); else if (!bs[l[1]]) vb(l[1]); }); bs[id] = 2; };
    W.balls.forEach((b) => { if (!bs[b.id]) vb(b.id); });
    blinks = blinks.filter((l) => !dropped.has(l));
    // only direct topic links are drawn: a link A→C is left out when A→B→C already shows it, so a dense map stays readable
    const bnext = {}; blinks.forEach(([s, t]) => (bnext[s] = bnext[s] || new Set()).add(t));
    const via = (s, t) => [...(bnext[s] || [])].some((m) => m !== t && (function reach(x, seen) { if (x === t) return true; if (seen.has(x)) return false; seen.add(x); return [...(bnext[x] || [])].some((y) => reach(y, seen)); })(m, new Set()));
    blinks = blinks.filter(([s, t]) => !via(s, t));
    // 3. depth: how far down the chain of topics each topic sits (it decides the ring)
    const par = {}; blinks.forEach(([s, t]) => (par[t] = par[t] || []).push(s));
    const depth = {};
    const dOf = (id, seen = new Set()) => { if (depth[id] != null) return depth[id]; if (seen.has(id)) return 0; seen.add(id); const d = (par[id] || []).reduce((m, p) => Math.max(m, dOf(p, seen) + 1), 0); depth[id] = d; return d; };
    W.balls.forEach((b) => { b.d = dOf(b.id); });
    const links = [];
    ids.forEach((id) => { const n = W.byId[id]; n.needs.forEach((p) => links.push([p, id, "needs"])); n.helps.filter((p) => W.byId[p] && !n.needs.includes(p)).forEach((p) => links.push([p, id, "helps"])); });
    const missingWhat = ids.filter((id) => !W.byId[id].what).length;
    if (missingWhat) notes.push(missingWhat + " points came back without a description.");
    return {
      areas: W.areas.map((a) => [a.id, a.name]),
      balls: W.balls.map((b) => ({ id: b.id, name: b.name, area: b.area, desc: b.desc, pts: b.pts.slice(), d: b.d, where: b.where || [] })),
      nodes: ids.map((id) => ({ id, name: W.byId[id].name, what: W.byId[id].what })),
      links, blinks,
      route: { goal: W.route.goal.filter((id) => W.byId[id]), why: W.route.why, note: W.route.note },
      loopsDropped: loops,
    };
  }

  async function buildMap(sid, only) {
    const s = subjects[sid];
    if (!s || !aiReady() || (ui.build && ui.build.running)) return;
    const job = { id: "map:" + sid, sid, requests: 0, cancel: false, running: true, stage: only === "route" ? "route" : "arch", chunks: 0, done: 0, error: null, only };
    job.paint = () => { if (ui.view !== "map") render(); };
    ui.build = job; render();
    logEvent("map", (only === "route" ? "Updating the route for " : "Building the map for ") + s.name);
    try {
      let W;
      if (only === "route") {
        const M = maps[sid];
        if (!M) throw { code: "no_map" };
        W = workFromMap(M);
        job.stage = "route"; job.paint();
        applyRoute(W, await ask(job, "Router", routerPrompt(s, W), "default", true));
        const fin = finishMap(W);
        const M2 = { ...M, route: fin.route, routeAt: new Date().toISOString(), requests: (M.requests || 0) + job.requests };
        maps[sid] = M2; saveMap(sid);
        job.stage = "done";
        logEvent("map", "Route updated for " + s.name + ": " + fin.route.goal.length + " goal points");
        notify("Your route is updated.");
      } else {
        // 1. the architect
        W = workMap(await ask(job, "Architect", architectPrompt(s), "complex", true));
        // 2. the writers, one request per group of topics, side by side
        const chunks = [];
        let cur2 = [];
        W.balls.forEach((b) => { if (cur2.length && cur2.reduce((n, x) => n + x.pts.length, 0) + b.pts.length > MAP_LIMITS.chunk) { chunks.push(cur2); cur2 = []; } cur2.push(b); });
        if (cur2.length) chunks.push(cur2);
        job.stage = "detail"; job.chunks = chunks.length; job.paint();
        await Promise.all(chunks.map((c) => ask(job, "Writers", detailPrompt(s, W, c), "default", true).then((d) => { applyDetails(W, d, c); job.done++; job.paint(); })));
        // 3. the router
        job.stage = "route"; job.paint();
        applyRoute(W, await ask(job, "Router", routerPrompt(s, W), "default", true));
        // 4. the checker; its fixes are applied by the page
        job.stage = "check"; job.paint();
        applyFixes(W, await ask(job, "Checker", checkerPrompt(s, W), "complex", true));
        // 5. structure, in code
        job.stage = "page"; job.paint();
        const fin = finishMap(W);
        const M = {
          v: 2, sid, mid: newId("m"), subject: W.subject || s.name, goal: s.goal, lang: I18N.lang, built: new Date().toISOString(),
          scope: W.scope, profile: { ...W.profile, name: W.profile.name || W.subject || s.name },
          areas: fin.areas, balls: fin.balls, nodes: fin.nodes, links: fin.links, blinks: fin.blinks, route: fin.route,
          checks: { fixes: W.fixes, verdict: W.verdict || "", notes: W.notes, loopsDropped: fin.loopsDropped }, requests: job.requests,
        };
        maps[sid] = M;
        const known = new Set(M.nodes.map((n) => n.id));
        s.learned = []; s.pointIndex = {}; s.learnPoint = null; s.practiceReady = null; s.practiceCurrent = null; s.practice = []; s.trial = null; s.trialTasks = null; s.grade = null;
        s.built = true; s.mapBuilt = M.built;
        ui.plessons = {}; ui.pjobs = {}; ui.qa = {}; ui.chat = []; ui.chatKey = null; ui.pset = null; ui.pjudge = null; ui.pjob = null;
        saveMap(sid); saveSubject(sid); saveApp();
        job.stage = "done";
        logEvent("map", "Map built for " + s.name + ": " + M.balls.length + " topics, " + known.size + " points, " + M.links.filter((l) => l[2] === "needs").length + " links, " + M.route.goal.length + " route points; " + W.fixes.filter((f) => f.done).length + " fixes by the checker; " + job.requests + " requests");
        notify("Your map is ready.");
      }
      mountMap();
      setView("map");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "no_map" ? "There's no map to update yet." : jobError(e);
      logEvent("map", "Map not built for " + s.name + ". " + job.error);
      if (!(e && e.code === "cancelled")) notify("The map wasn't finished. " + job.error, "bad");
    } finally {
      job.running = false; render();
    }
  }
  function buildCard(job) {
    const order = { arch: 0, detail: 1, route: 2, check: 3, page: 4, done: 5, error: -1 };
    const at = order[job.stage];
    const stages = job.only === "route" ? BUILD_STAGES.filter(([id]) => id === "route") : BUILD_STAGES;
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, job.only === "route" ? "Updating your route" : "Building your map"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, stages.map(([id, who, what]) => { const i = order[id]; return h("li", null,
        h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what,
        id === "detail" && job.chunks && at === 1 ? h("span", { class: "muted small" }, " · " + job.done + " of " + job.chunks + " groups of topics done") : null); })),
      h("p", { class: "small muted" }, "This takes a few minutes. You can keep the page open on another section while it works."),
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  // the map's About tab: how it was built, what the checker changed, and what that means for trusting it
  function aboutHTML(M) {
    const esc = escH, T = (x) => escH(I18N.t(x));
    const fx = ((M.checks && M.checks.fixes) || []), done = fx.filter((f) => f.done), notes = (M.checks && M.checks.notes) || [];
    const needs = M.links.filter((l) => l[2] === "needs").length;
    return '<p class="km-eyebrow">' + T("About this map") + "</p><h2>" + T("Built by AI for your goal") + "</h2>" +
      '<p class="km-small">' + esc(I18N.t(M.balls.length + " topics and " + M.nodes.length + " points, with " + needs + " “needed first” links, built in " + (M.requests || 0) + " AI requests.")) + "</p>" +
      '<p class="km-small">' + T("An architect AI planned the topics and points for your goal, writers said what each point is and what it needs first, a router marked your route, and a checker reviewed the whole map. No human source was used: treat the map as one AI's view of the subject, and check what matters to you elsewhere.") + "</p>" +
      (M.scope ? "<h3>" + T("What it covers") + '</h3><p class="km-small" data-ai>' + esc(M.scope) + "</p>" : "") +
      (M.route && M.route.note ? "<h3>" + T("How the route was chosen") + '</h3><p class="km-small" data-ai>' + esc(M.route.note) + "</p>" : "") +
      "<h3>" + T("What the checker changed") + "</h3>" +
      (M.checks && M.checks.verdict ? '<p class="km-small" data-ai>' + esc(M.checks.verdict) + "</p>" : "") +
      (done.length ? '<ul class="km-notelist" data-ai>' + done.map((f) => "<li>" + esc(f.text) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T("Nothing: it found no errors to fix.") + "</p>") +
      (notes.length ? "<h3>" + T("What the page's structure check changed") + '</h3><ul class="km-notelist">' + notes.map((n) => "<li>" + esc(n) + "</li>").join("") + "</ul>" : "") +
      '<p class="km-small">' + esc(I18N.t("Built " + new Date(M.built).toLocaleDateString(I18N.lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }) + ".")) + "</p>" +
      '<div class="km-btns"><button class="km-btn" type="button" data-about="profile">' + T("Rebuild or update in Profile") + "</button></div>";
  }

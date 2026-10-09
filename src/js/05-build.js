  // ---------- Building a subject's map: a tree of agents (v2.2) ----------
  // No single agent plans the whole subject. The map is built as a tree:
  //   down: a master divides the subject into its main parts and writes the subject profile; for each part, a planner
  //         either divides it again or, when it is small enough to plan point by point, writes it as one topic;
  //   up:   when every piece under a part is done, a reviewer for that part sees the pieces together for the first time.
  //         It links the needs the writers could only describe ("needs an idea outside this topic"), merges duplicates,
  //         moves misplaced points and fills gaps. Needs it can't place pass up to the next reviewer; the master's part,
  //         the whole map, is reviewed last.
  // Then a router marks the route, and the page checks structure. Every finished agent's work is saved as it lands
  // (builds/<sid>), so a build that stops (closed tab, usage limit, Stop) continues where it left off.
  // The AI decides how deep the tree goes and what each part holds; the numbers below are safety limits only.
  const MAP_LIMITS = { areas: 24, topics: 80, perTopic: 30, points: 480, parts: 16, depth: 4, agents: 220 };
  const builds = {};   // sid -> a build in progress, as saved
  const saveBuild = (B) => { builds[B.sid] = B; queueSave("builds/" + B.sid, clone(B)); };
  async function loadBuild(sid) {
    if (!db || builds[sid] !== undefined) return builds[sid] || null;
    try { const snap = await db.doc("builds/" + sid).get(); builds[sid] = snap.exists && snap.data() && snap.data().v && snap.data().status !== "done" && snap.data().status !== "dropped" ? clone(snap.data()) : null; }
    catch (_) { builds[sid] = null; }
    return builds[sid];
  }
  // a build stopped part-way that can still continue: same goal as now
  // (one saved as running was cut off: the tab closed mid-build)
  const resumable = (sid) => { const B = builds[sid], s = subjects[sid]; return B && s && B.status !== "done" && B.goal === s.goal && B.situation === (s.situation || "") ? B : null; };
  const pausedBuild = (sid) => (ui.build && ui.build.running && ui.build.sid === sid ? null : resumable(sid));
  function dropBuild(sid) { const B = builds[sid]; if (B) { B.status = "dropped"; queueSave("builds/" + sid, { v: 1, sid, status: "dropped" }); } builds[sid] = null; }
  const learnerAbout = (s) => [
    "Subject: " + s.name,
    "The learner's goal: " + (s.goal || "(not given: assume a solid general foundation)"),
    "Where they are now, in their own words: " + (s.situation || "(not given)"),
  ].join("\n");


  const profileAsk = [
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
  ];
  const masterPrompt = (s) => [
    "You are the master planner in Learning Companion, an open-source study tool for self-learners. You lead a tree of AIs that builds the knowledge map for one learner's subject. You divide the subject into its main parts. For each part, another AI either divides it again or, once it is small enough to plan point by point, writes its points. On the way back up, a reviewer for each part checks and joins what was written under it, and a last reviewer checks the whole map. Lessons and practice are then built from the map.",
    learnerAbout(s), "",
    "Your job:",
    "- Decide the scope: what this learner needs to reach their goal, the foundations that rests on, and enough around it that they can see where it leads. Say in \"scope\" what you included, what you left out, and why.",
    "- Divide the subject, within that scope, into its main parts, in the order a learner would meet them. Divide by how the ideas actually hang together, so that each part can be planned on its own and as few ideas as possible reach across parts.",
    "- Give each part a brief: what it covers, where its edges are against the other parts (so no idea is planned twice or falls between two parts), and what in it matters for this learner's goal. The AIs under you see only the briefs on their own branch and their siblings' briefs, so the brief is all they know of your intent.",
    "- Be accurate about the subject as experts understand it today. Where experts disagree about how it is organised, follow the most widely used organisation and mention the choice in \"scope\".",
    "",
  ].concat(profileAsk, [
    "",
    'Reply with only JSON: {"subject": "the subject\'s name", "scope": "what the map covers and leaves out, and why", "profile": {"name": "", "trap": "", "slips": "", "observe": "", "shallow": "", "rich": "", "examples": "", "run": "python, javascript or none", "format": ""}, "parts": [{"name": "", "brief": ""}]}',
  ]).join("\n");

  // the branch from the subject down to a part, with each part's brief
  const pathLines = (B, n) => {
    const chain = [];
    for (let x = n; x && x.depth > 0; x = B.nodes[x.parent]) chain.unshift(x);
    return ["Subject: " + (B.subject || subjects[B.sid].name) + ". Scope: " + (B.scope || "(not stated)")]
      .concat(chain.map((x, i) => "  ".repeat(i) + "- " + x.name + (x === n ? " (your part)" : "") + ": " + (x.brief || "(no brief)"))).join("\n");
  };
  const plannerPrompt = (s, B, n, forced) => {
    const sibs = (B.nodes[n.parent].kids || []).filter((k) => k !== n.id).map((k) => B.nodes[k]);
    return [
      "You plan one part of a knowledge map in Learning Companion, an open-source study tool for self-learners. The map is built by a tree of AIs: a master divided the subject into parts, and for each part an AI like you either divides it again or, once it is small enough, writes its points. Other AIs are working on the other parts at the same time. On the way back up, reviewers check and join the parts.",
      learnerAbout(s), "",
      "Where your part sits:", pathLines(B, n), "",
      "Beside your part (other AIs plan these; leave their ideas to them):",
      sibs.length ? sibs.map((x) => "- " + x.name + ": " + (x.brief || "(no brief)")).join("\n") : "Nothing: your part is the only one here.", "",
      forced ? "Write your part as one topic now: the page's safety limit on how far the map divides has been reached." : [
        "Decide how to handle your part:",
        "- Write it only if it is a single topic: a few closely related ideas a learner would study in a row, like one section of a textbook chapter rather than the whole chapter. Writing means planning every point of the part in this one answer, so the smaller the part, the more care each point gets.",
        "- Otherwise divide it: into smaller parts, by how its ideas hang together, in the order a learner would meet them, each with a brief (what it covers, its edges against its siblings, what in it matters for the goal). An AI for each smaller part then does what you are doing now.",
      ].join("\n"),
      "",
      "When you write:",
      "- A point is one idea a learner can learn in one focused sitting and then use: small enough for one lesson, big enough to stand on its own. Name it the way a learner would recognise it, briefly. No two points teach the same idea. List them in a sensible teaching order.",
      "- Keep that grain however small your part is: a small part simply has few points. Don't split one idea into its steps, cases or examples because your part is narrow; those belong inside the point's lesson.",
      "- what: one or two sentences on what the learner will understand or be able to do once they have learned it.",
      "- needs: the numbers (1 for the first point you list, and so on) of points in this topic that must be learned first because this point can't be understood without them. Only direct needs: if A needs B and B needs C, A lists B, not C.",
      "- outside: ideas outside this topic that this point can't be understood without, each described in a few words, exactly enough that another AI can find the point that teaches it. Only direct needs; an idea that only makes this point easier doesn't count. Reviewers link them.",
      "- helps: the numbers of points in this topic that make this one easier but aren't required.",
      "- desc: one sentence on what this topic is about and why its points belong together.",
      "- where: real books, courses or references that teach this topic well, with the chapter or section where you know it. Add a URL only if you are sure it is right. Name only sources you are confident exist; an empty list is better than a guess.",
      "",
      forced ? "Reply with only JSON:" : "Reply with only JSON, in one of two forms:",
      forced ? null : '{"divide": [{"name": "", "brief": ""}]}',
      '{"write": {"desc": "", "points": [{"name": "", "what": "", "needs": [numbers], "outside": ["idea"], "helps": [numbers]}], "where": [{"title": "", "detail": "chapter or section, or empty", "url": "or empty"}]}}',
    ].filter((x) => x != null).join("\n");
  };

  // ----- the tree's state -----
  const kidsOf = (B, id) => B.nodes[id].kids || [];
  const ballsUnder = (B, id) => { const n = B.nodes[id]; return n.kids ? n.kids.flatMap((k) => ballsUnder(B, k)) : n.ball && B.balls[n.ball] ? [n.ball] : []; };
  const ptsUnder = (B, id) => ballsUnder(B, id).flatMap((t) => B.balls[t].pts);

  const reviewerPrompt = (s, B, n) => {
    const root = n.depth === 0;
    const inPart = new Set(ptsUnder(B, n.id));
    const open = B.open.filter((o) => inPart.has(o.pt));
    const ptLine = (p) => { const x = B.byId[p]; return "  " + p + " | " + x.name + " | " + (x.what || "") + " | needs: " + (x.needs.join(", ") || "nothing"); };
    const pieces = kidsOf(B, n.id).map((k) => "Piece: " + B.nodes[k].name + "\n" + ballsUnder(B, k).map((t) => "Topic " + t + ": " + B.balls[t].name + "\n" + B.balls[t].pts.map(ptLine).join("\n")).join("\n")).join("\n\n");
    return [
      "You review one part of a knowledge map in Learning Companion, an open-source study tool for self-learners, before the learner sees it. The map is built by a tree of AIs: the pieces of this part were planned and written by separate AIs, each seeing only its own piece. You are the first to see them together" + (root ? ". Your part is the whole map, and nothing is above you." : "; the reviewer above you will see this part beside its neighbours."),
      learnerAbout(s), "",
      root ? "Scope the master chose: " + (B.scope || "(not stated)") : "Where this part sits:\n" + pathLines(B, n), "",
      "This part, piece by piece. Every point with its id, what it is, and the points it needs first:", pieces, "",
      "Open needs: ideas a point here was written to need from outside its own topic, not linked yet:",
      open.length ? open.map((o) => o.id + " | " + o.pt + " (" + B.byId[o.pt].name + ") | " + o.text).join("\n") : "None.", "",
      "Your job:",
      "1. Link each open need you can to the point in this part that teaches that idea. " + (root
        ? "Nothing is above you, so settle every open need: link it, add the point it needs if that idea belongs on the map, or drop it if the point can be understood without it."
        : "If the idea belongs outside this part, leave the need open: the reviewer above you will link it. If it belongs inside this part but no point teaches it, add the point."),
      "2. Fix what only someone who sees the pieces together can see: two points in different pieces that teach the same idea, a point in the wrong piece, an idea this part rests on that no piece has, a \"needs\" link between pieces that is missing or wrong.",
      "3. Fix any other real error you notice: a point that is wrong, misnamed, or doesn't belong to this subject. Leave reasonable choices of scope, order, grouping and naming alone.",
      "Give each change as one operation:",
      '- {"op": "link", "need": "open need id", "to": "point id"}',
      '- {"op": "drop_need", "need": "open need id", "why": ""}',
      '- {"op": "add_point", "topic": "topic id", "name": "", "what": "", "needs": ["point ids"], "for": ["open need ids it meets"], "why": ""}',
      '- {"op": "merge", "id": "the point to remove", "into": "the point that keeps the idea", "why": ""}',
      '- {"op": "rename", "id": "", "name": "", "what": "", "why": ""}',
      '- {"op": "move", "id": "", "topic": "topic id", "why": ""}',
      '- {"op": "remove_point", "id": "", "why": ""}',
      '- {"op": "add_need", "id": "", "need": "", "why": ""} and {"op": "remove_need", "id": "", "need": "", "why": ""}',
      'Reply with only JSON: {"fixes": [operations], "verdict": "one or two sentences on how sound this part is now"}',
    ].join("\n");
  };

  const newBuild = (s) => ({
    v: 1, sid: s.sid, goal: s.goal, situation: s.situation || "", started: new Date().toISOString(), status: "running", requests: 0, agents: 0,
    subject: "", scope: "", profile: null,
    nodes: { n1: { id: "n1", parent: null, depth: 0, name: s.name, brief: "", state: "todo" } },
    nNode: 1, nTopic: 0, nPoint: 0, nNeed: 0, balls: {}, byId: {}, open: [], fixes: [], notes: [], verdicts: {}, linked: 0,
  });
  function addKids(B, n, parts) {
    const ok = parr(parts).map((x) => ({ name: pstr(x && x.name), brief: pstr(x && x.brief) })).filter((x) => x.name);
    if (ok.length > MAP_LIMITS.parts) B.notes.push("\"" + n.name + "\" was divided into more parts than the page's safety limit, so " + (ok.length - MAP_LIMITS.parts) + " were left out.");
    n.kids = ok.slice(0, MAP_LIMITS.parts).map((x) => {
      const id = "n" + (++B.nNode);
      B.nodes[id] = { id, parent: n.id, depth: n.depth + 1, name: x.name, brief: x.brief, state: "todo" };
      return id;
    });
    n.state = "split";
  }
  function writeTopic(B, n, w) {
    const tid = "t" + (++B.nTopic);
    const b = { id: tid, name: n.name, desc: pstr(w.desc), node: n.id, pts: [], where: [] };
    const raw = parr(w.points), num = {}, seen = new Set();
    let cut = 0;
    raw.forEach((x, i) => {
      const name = pstr(x && x.name);
      if (!name || seen.has(name.toLowerCase())) return;
      if (b.pts.length >= MAP_LIMITS.perTopic || Object.keys(B.byId).length >= MAP_LIMITS.points) { cut++; return; }
      seen.add(name.toLowerCase());
      const id = "p" + (++B.nPoint);
      B.byId[id] = { id, name, what: pstr(x.what), needs: [], helps: [] };
      b.pts.push(id); num[i + 1] = id;
    });
    raw.forEach((x, i) => {
      const id = num[i + 1]; if (!id) return;
      const P = B.byId[id], ref = (k) => num[+k];
      P.needs = [...new Set(parr(x.needs).map(ref).filter((r) => r && r !== id))];
      P.helps = [...new Set(parr(x.helps).map(ref).filter((r) => r && r !== id && !P.needs.includes(r)))];
      parr(x.outside).map(pstr).filter(Boolean).forEach((text) => B.open.push({ id: "N" + (++B.nNeed), pt: id, text }));
    });
    if (cut) B.notes.push("\"" + n.name + "\" ran past the page's safety limits, so " + cut + " of its points were left out.");
    b.where = parr(w.where).map((x) => ({ title: pstr(x && x.title), detail: pstr(x && x.detail), url: /^https?:\/\/\S+$/.test(pstr(x && x.url)) ? pstr(x.url) : "" })).filter((x) => x.title).slice(0, 8);
    B.balls[tid] = b; n.ball = tid; n.state = "topic";
  }
  // one agent's answer, checked; a second request if the first can't be used
  async function askValid(job, agent, prompt, tier, valid) {
    for (let k = 0; ; k++) {
      const d = await ask(job, agent, prompt, tier, true);
      if (valid(d)) return d;
      if (k >= 1) throw { code: "invalid_json", agent };
    }
  }
  async function planNode(s, B, n, job) {
    if (n.depth === 0) {
      const d = await askValid(job, "Master", masterPrompt(s), "complex", (d) => d && parr(d.parts).some((x) => pstr(x && x.name)));
      B.subject = pstr(d.subject); B.scope = pstr(d.scope);
      const p = d.profile || {};
      B.profile = {};
      ["name", "trap", "slips", "observe", "shallow", "rich", "examples", "format"].forEach((k) => { B.profile[k] = pstr(p[k]); });
      B.profile.run = ["python", "javascript", "none"].includes(pstr(p.run).toLowerCase()) ? pstr(p.run).toLowerCase() : "none";
      addKids(B, n, d.parts);
    } else {
      const forced = n.depth >= MAP_LIMITS.depth || Object.keys(B.nodes).length >= MAP_LIMITS.agents / 2 || B.nTopic + Object.values(B.nodes).filter((x) => x.state === "todo").length >= MAP_LIMITS.topics;
      const canWrite = (d) => d && d.write && parr(d.write.points).some((x) => pstr(x && x.name));
      const canDivide = (d) => !forced && d && parr(d.divide).some((x) => pstr(x && x.name));
      const d = await askValid(job, "Planner", plannerPrompt(s, B, n, forced), "default", (d) => canWrite(d) || canDivide(d));
      if (canWrite(d)) writeTopic(B, n, d.write); else addKids(B, n, d.divide);
    }
    B.agents++;
  }

  // ----- a reviewer's changes, applied by the page, only inside the reviewer's own part -----
  function applyReview(B, n, r) {
    const label = n.depth === 0 ? "" : "In " + n.name + ": ";
    const ok = (text) => B.fixes.push({ done: true, text: label + text }), skip = (text) => B.fixes.push({ done: false, text: label + text });
    const inPart = () => new Set(ptsUnder(B, n.id)), topics = new Set(ballsUnder(B, n.id));
    const nameOf = (id) => (B.byId[id] ? "\"" + B.byId[id].name + "\"" : id);
    const openOf = (nid) => { const ids = inPart(); return B.open.find((o) => o.id === nid && ids.has(o.pt)); };
    const drop = (id) => {
      Object.values(B.balls).forEach((b) => { b.pts = b.pts.filter((x) => x !== id); });
      Object.values(B.byId).forEach((x) => { x.needs = x.needs.filter((y) => y !== id); x.helps = x.helps.filter((y) => y !== id); });
      B.open = B.open.filter((o) => o.pt !== id);
      delete B.byId[id];
    };
    parr(r && r.fixes).forEach((f) => {
      const op = pstr(f && f.op), why = pstr(f && f.why), id = pstr(f && f.id), tail = why ? " (" + why + ")" : "", P = inPart();
      if (op === "link") {
        const o = openOf(pstr(f.need)), to = pstr(f.to);
        if (!o || !P.has(to) || to === o.pt) return;
        const x = B.byId[o.pt];
        if (!x.needs.includes(to)) x.needs.push(to);
        x.helps = x.helps.filter((y) => y !== to);
        B.open = B.open.filter((y) => y !== o); B.linked++;
      } else if (op === "drop_need") {
        const o = openOf(pstr(f.need));
        if (!o) return;
        B.open = B.open.filter((y) => y !== o);
        ok(nameOf(o.pt) + " doesn't need \"" + o.text + "\" after all" + tail);
      } else if (op === "add_point") {
        const t = pstr(f.topic), name = pstr(f.name);
        if (!topics.has(t) || !name || Object.keys(B.byId).length >= MAP_LIMITS.points) return skip("Couldn't add \"" + name + "\"" + tail);
        if (Object.values(B.byId).some((x) => x.name.toLowerCase() === name.toLowerCase())) return skip("\"" + name + "\" is already on the map");
        const nid = "p" + (++B.nPoint);
        B.byId[nid] = { id: nid, name, what: pstr(f.what), needs: parr(f.needs).map(pstr).filter((x) => P.has(x)), helps: [] };
        B.balls[t].pts.push(nid);
        parr(f.for).map(pstr).forEach((k) => { const o = openOf(k); if (o && o.pt !== nid) { B.byId[o.pt].needs.push(nid); B.open = B.open.filter((y) => y !== o); B.linked++; } });
        ok("Added \"" + name + "\" to " + B.balls[t].name + tail);
      } else if (op === "remove_point") {
        if (!P.has(id)) return skip("Couldn't remove " + id + tail);
        const nm = nameOf(id); drop(id); ok("Removed " + nm + tail);
      } else if (op === "merge") {
        const into = pstr(f.into);
        if (!P.has(id) || !P.has(into) || id === into) return skip("Couldn't merge " + id + " into " + into + tail);
        const nm = nameOf(id);
        Object.values(B.byId).forEach((x) => { if (x.needs.includes(id) && x.id !== into && !x.needs.includes(into)) x.needs.push(into); });
        B.byId[id].needs.forEach((y) => { if (y !== into && !B.byId[into].needs.includes(y)) B.byId[into].needs.push(y); });
        B.open.forEach((o) => { if (o.pt === id) o.pt = into; });
        drop(id); ok("Merged " + nm + " into " + nameOf(into) + tail);
      } else if (op === "rename") {
        const x = B.byId[id], name = pstr(f.name);
        if (!P.has(id) || !name) return skip("Couldn't rename " + id + tail);
        const was = x.name; x.name = name; if (pstr(f.what)) x.what = pstr(f.what);
        ok(was === name ? "Corrected the description of \"" + name + "\"" + tail : "Renamed \"" + was + "\" to \"" + name + "\"" + tail);
      } else if (op === "move") {
        const t = pstr(f.topic);
        if (!P.has(id) || !topics.has(t)) return skip("Couldn't move " + id + tail);
        Object.values(B.balls).forEach((b) => { b.pts = b.pts.filter((x) => x !== id); });
        B.balls[t].pts.push(id); ok("Moved " + nameOf(id) + " to " + B.balls[t].name + tail);
      } else if (op === "add_need" || op === "remove_need") {
        const x = B.byId[id], need = pstr(f.need);
        if (!P.has(id) || !P.has(need) || id === need) return skip("Couldn't change what " + id + " needs" + tail);
        if (op === "add_need") { if (!x.needs.includes(need)) x.needs.push(need); x.helps = x.helps.filter((y) => y !== need); ok(nameOf(id) + " now needs " + nameOf(need) + " first" + tail); }
        else { x.needs = x.needs.filter((y) => y !== need); ok(nameOf(id) + " no longer needs " + nameOf(need) + " first" + tail); }
      } else if (op) skip("Unknown change \"" + op + "\"" + tail);
    });
    if (pstr(r && r.verdict)) B.verdicts[n.id] = pstr(r.verdict);
  }
  async function reviewNode(s, B, n, job) {
    // a part with a single topic under it has nothing to join: its open needs simply pass up
    if (ballsUnder(B, n.id).length > 1 || n.depth === 0) {
      applyReview(B, n, await askValid(job, "Reviewer", reviewerPrompt(s, B, n), "complex", (d) => d && Array.isArray(d.fixes)));
      B.agents++;
    }
    if (n.depth === 0 && B.open.length) {
      B.open.forEach((o) => B.notes.push("\"" + (B.byId[o.pt] || {}).name + "\" was written to need \"" + o.text + "\", but no reviewer linked it to a point, so that need was left out."));
      B.open = [];
    }
    n.state = "reviewed";
  }
  // down the tree, then back up; whatever is already done (a continued build) is skipped
  async function doNode(s, B, id, job) {
    const n = B.nodes[id];
    if (job.cancel) throw { code: "cancelled" };
    if (n.state === "todo") { await planNode(s, B, n, job); B.requests = job.requests; saveBuild(B); job.paint(); }
    if (!n.kids) return;
    const res = await Promise.allSettled(n.kids.map((k) => doNode(s, B, k, job)));
    const bad = res.find((x) => x.status === "rejected");
    if (bad) throw bad.reason;
    if (n.state === "split") { await reviewNode(s, B, n, job); B.requests = job.requests; saveBuild(B); job.paint(); }
  }
  // the finished tree as a working map: areas are the master's parts, topics are the parts that were written
  function treeToWork(B) {
    const root = B.nodes.n1, areas = [], balls = [];
    kidsOf(B, "n1").forEach((k, i) => {
      const aid = "a" + (i + 1), ts = ballsUnder(B, k).filter((t) => B.balls[t].pts.length);
      if (!ts.length) return;
      areas.push({ id: aid, name: B.nodes[k].name });
      ts.forEach((t) => { const b = B.balls[t]; balls.push({ id: b.id, name: b.name, area: aid, desc: b.desc, pts: b.pts.slice(), where: b.where }); });
    });
    const byId = clone(B.byId), order = balls.flatMap((b) => b.pts);
    if (order.length < 2) throw { code: "invalid_json", agent: "Master" };
    return { scope: B.scope, subject: B.subject || root.name, profile: B.profile || { run: "none" }, areas, balls, byId, order,
      route: { goal: [], why: {}, note: "" }, notes: B.notes.slice(), fixes: B.fixes.slice(), verdict: B.verdicts.n1 || "" };
  }
  const treeStats = (B) => {
    const ns = Object.values(B.nodes);
    return { agents: B.agents, levels: ns.reduce((m, x) => Math.max(m, x.depth), 0) + 1, parts: ns.filter((x) => x.kids).length, topics: Object.keys(B.balls).length, linked: B.linked };
  };

  // ----- the router, and the saved map as a working map (to update the route without rebuilding) -----
  const mapLines = (W, withNeeds) => W.balls.map((b) => "Topic " + b.id + ": " + b.name + "\n" + b.pts.map((p) => {
    const n = W.byId[p];
    return "  " + p + " | " + n.name + (withNeeds && n.what ? " | " + n.what : "") + (withNeeds ? " | needs: " + (n.needs.join(", ") || "nothing") : "");
  }).join("\n")).join("\n");

  const routerPrompt = (s, W) => [
    "You mark the learner's route on their knowledge map in Learning Companion, a study tool for self-learners. The route is a suggestion shown on the map with a red ring; the learner still chooses what to study.",
    learnerAbout(s), "",
    "The map, every point with its id, what it is and what it needs first:", mapLines(W, true), "",
    "Choose the points this learner's goal actually needs. The page adds everything they build on, so list what the goal itself uses. Judge from the goal, not from the order of the map: include what matters even if it seems basic, and leave out what the goal doesn't need even if courses usually teach it.",
    "For each topic with points you chose, say in one sentence why the goal needs it.",
    'Reply with only JSON: {"goal": ["point ids"], "why": [{"topic": "topic id", "why": "one sentence"}], "note": "one or two sentences on how you chose"}',
  ].join("\n");

  // the saved map, as a working map with the same ids (used to update the route without rebuilding)
  function workFromMap(M) {
    const W = { scope: M.scope, subject: M.subject, profile: M.profile, areas: M.areas.map(([id, name]) => ({ id, name })), byId: {}, order: M.nodes.map((n) => n.id),
      balls: M.balls.map((b) => ({ ...b, pts: b.pts.slice() })), route: { goal: [], why: {}, note: "" }, notes: [], fixes: [] };
    M.nodes.forEach((n) => { W.byId[n.id] = { id: n.id, name: n.name, what: n.what, needs: [], helps: [] }; });
    M.links.forEach(([a, b, k]) => { if (W.byId[a] && W.byId[b]) (k === "helps" ? W.byId[b].helps : W.byId[b].needs).push(a); });
    return W;
  }
  function applyRoute(W, r) {
    W.route.goal = [...new Set(parr(r && r.goal).map(pstr).filter((id) => W.byId[id]))];
    W.route.why = {};
    parr(r && r.why).forEach((x) => { const id = pstr(x && x.topic); if (W.balls.some((b) => b.id === id) && pstr(x.why)) W.route.why[id] = pstr(x.why); });
    W.route.note = pstr(r && r.note);
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


  async function buildMap(sid, only, opts = {}) {
    const s = subjects[sid];
    if (!s || !aiReady() || (ui.build && ui.build.running)) return;
    const job = { id: "map:" + sid, sid, requests: 0, cancel: false, running: true, stage: only === "route" ? "route" : "tree", error: null, only, B: null };
    job.paint = () => { if (ui.view !== "map") render(); };
    ui.build = job; render();
    let B = null;
    try {
      let W;
      if (only === "route") {
        logEvent("map", "Updating the route for " + s.name);
        const M = maps[sid];
        if (!M) throw { code: "no_map" };
        W = workFromMap(M);
        job.stage = "route"; job.paint();
        applyRoute(W, await ask(job, "Router", routerPrompt(s, W), "default", true));
        const fin = finishMap(W);
        const M2 = { ...M, route: fin.route, routeAt: new Date().toISOString() };
        maps[sid] = M2;
        if (trLang() && M2.src === "en") {
          job.stage = "translate"; job.paint();
          try { await translateMap(sid, job, true); } catch (e) { if (e && e.code === "cancelled") throw e; notify("The route is updated, but its reasons couldn't be translated, so they're shown in English.", "warn"); }
        }
        M2.requests = (M.requests || 0) + job.requests;
        saveMap(sid);
        job.stage = "done";
        logEvent("map", "Route updated for " + s.name + ": " + fin.route.goal.length + " goal points");
        notify("Your route is updated.");
      } else {
        // 1. the tree: down to the smallest parts, and back up through the reviewers (continued if it stopped part-way)
        await loadBuild(sid);
        if (opts.fresh) dropBuild(sid);
        B = resumable(sid);
        logEvent("map", (B ? "Continuing the map for " : "Building the map for ") + s.name);
        if (!B) B = newBuild(s);
        B.status = "running"; job.B = B; job.requests = B.requests || 0;
        saveBuild(B); job.paint();
        await doNode(s, B, "n1", job);
        W = treeToWork(B);
        // 2. the router
        job.stage = "route"; job.paint();
        applyRoute(W, await ask(job, "Router", routerPrompt(s, W), "default", true));
        // 3. structure, in code
        job.stage = "page"; job.paint();
        const fin = finishMap(W);
        const M = {
          v: 2, src: "en", sid, mid: newId("m"), subject: W.subject || s.name, goal: s.goal, lang: "en", built: new Date().toISOString(),
          scope: W.scope, profile: { ...W.profile, name: W.profile.name || W.subject || s.name },
          areas: fin.areas, balls: fin.balls, nodes: fin.nodes, links: fin.links, blinks: fin.blinks, route: fin.route,
          checks: { fixes: W.fixes, verdict: W.verdict, notes: W.notes, loopsDropped: fin.loopsDropped }, tree: treeStats(B), requests: job.requests,
        };
        maps[sid] = M;
        // 4. the translator, when the learner reads another language; the English map stays as the original
        if (trLang()) {
          job.stage = "translate"; job.paint();
          try { await translateMap(sid, job); } catch (e) { if (e && e.code === "cancelled") throw e; notify("The map is ready, but it couldn't be translated, so it's shown in English. You can translate it again from its About tab.", "warn"); }
          M.requests = job.requests;
        }
        const known = new Set(M.nodes.map((n) => n.id));
        s.learned = []; s.pointIndex = {}; s.learnPoint = null; s.practiceReady = null; s.practiceCurrent = null; s.practice = []; s.trial = null; s.trialTasks = null; s.grade = null;
        s.built = true; s.mapBuilt = M.built;
        ui.plessons = {}; ui.pjobs = {}; ui.qa = {}; ui.chat = []; ui.chatKey = null; ui.pset = null; ui.pjudge = null; ui.pjob = null;
        saveMap(sid); saveSubject(sid); saveApp();
        B.status = "done"; builds[sid] = null; queueSave("builds/" + sid, { v: 1, sid, status: "done" });
        job.stage = "done";
        logEvent("map", "Map built for " + s.name + ": " + M.balls.length + " topics, " + known.size + " points, " + M.links.filter((l) => l[2] === "needs").length + " links, " + M.route.goal.length + " route points; " +
          M.tree.agents + " planning and reviewing agents over " + M.tree.levels + " levels; " + W.fixes.filter((f) => f.done).length + " changes by the reviewers; " + job.requests + " requests");
        notify("Your map is ready.");
      }
      mountMap();
      setView("map");
    } catch (e) {
      job.stage = "error";
      job.error = e && e.code === "no_map" ? "There's no map to update yet." : jobError(e);
      if (B && B.status !== "done") { B.status = "paused"; B.requests = job.requests; saveBuild(B); }
      logEvent("map", "Map not finished for " + s.name + ". " + job.error);
      if (!(e && e.code === "cancelled")) notify("The map wasn't finished. " + job.error + (B ? " Everything done so far is saved." : ""), "bad");
    } finally {
      job.running = false; render();
    }
  }

  // ----- progress, while the tree works and when it has stopped part-way -----
  function treeCounts(B) {
    const ns = Object.values(B.nodes);
    const joins = ns.filter((x) => x.kids && (x.depth === 0 || ballsUnder(B, x.id).length > 1 || x.state !== "reviewed"));
    return { planned: ns.filter((x) => x.state !== "todo").length, parts: ns.length, topics: Object.keys(B.balls).length,
      reviewed: joins.filter((x) => x.state === "reviewed").length, joins: joins.length, levels: ns.reduce((m, x) => Math.max(m, x.depth), 0) + 1,
      masterDone: B.nodes.n1.state !== "todo", plansDone: ns.every((x) => x.state !== "todo"), rootDone: B.nodes.n1.state === "reviewed" };
  }
  const treeLine = (c) => c.planned + " of " + c.parts + " parts planned · " + c.topics + " topics written · " + c.reviewed + " of " + c.joins + " parts checked";
  function buildCard(job) {
    const TRS = trLang() ? [["translate", "Translator", "translates the map into your language, keeping the English original"]] : [];
    if (job.only === "route") {
      const at = { route: 0, translate: 1, done: 2 }[job.stage];
      return h("div", { class: "card", "aria-live": "polite" },
        h("div", { class: "row spread" }, h("h3", null, "Updating your route"), h("span", { class: "muted small" }, job.requests + " requests so far")),
        h("ol", { class: "plain" }, [["route", "Router", "marks the route your goal needs"]].concat(TRS).map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what))),
        h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
    }
    const c = job.B ? treeCounts(job.B) : { planned: 0, parts: 1, topics: 0, reviewed: 0, joins: 0, levels: 1, masterDone: false, plansDone: false, rootDone: false };
    const after = { tree: 0, route: 1, page: 2, translate: 3, done: 4 }[job.stage] || 0;
    const mark = (done, now) => (done ? "✓ " : now ? "… " : "");
    const rows = [
      [mark(c.masterDone, !c.masterDone), "Master", "divides the subject into its main parts and writes the subject profile", null],
      [mark(c.plansDone, c.masterDone && !c.plansDone), "Planners", "divide each part further, or write its points once it's small enough", c.masterDone ? c.planned + " of " + c.parts + " parts planned · " + c.topics + " topics written · " + c.levels + (c.levels === 1 ? " level" : " levels") : null],
      [mark(c.rootDone, c.masterDone && !c.rootDone && c.reviewed > 0), "Reviewers", "check and join the parts on the way back up, ending with the whole map", c.joins ? c.reviewed + " of " + c.joins + " parts checked" : null],
      [mark(after > 1, after === 1), "Router", "marks the route your goal needs", null],
      [mark(after > 2, after === 2), "Page", "checks the map's structure in code", null],
    ].concat(TRS.map(([, who, what]) => [mark(after > 3, after === 3), who, what, null]));
    return h("div", { class: "card", "aria-live": "polite" },
      h("div", { class: "row spread" }, h("h3", null, "Building your map"), h("span", { class: "muted small" }, job.requests + " requests so far")),
      h("ol", { class: "plain" }, rows.map(([m, who, what, sub]) => h("li", null, h("strong", null, m + who), " " + what, sub ? h("span", { class: "muted small" }, " · " + sub) : null))),
      h("p", { class: "small muted" }, "About two AI requests run at a time, so a large subject can take half an hour. Everything finished is saved as it lands: if you leave or it stops, continue later from here."),
      h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
  }
  // a build that stopped part-way: continue it, or start again
  function pausedCard(sid) {
    const B = pausedBuild(sid);
    if (!B || (ui.build && ui.build.running)) return null;
    const c = treeCounts(B);
    return h("div", { class: "card soft" },
      h("h3", null, maps[sid] ? "A new map is part-built" : "Your map is part-built"),
      h("p", { class: "small" }, treeLine(c) + ", in " + (B.requests || 0) + " requests so far. Everything finished is saved."),
      maps[sid] ? h("p", { class: "small muted" }, "Your current map stays until the new one is finished.") : null,
      h("div", { class: "row" },
        h("button", { class: "primary", type: "button", disabled: !aiReady(), onclick: () => { app.current = sid; saveApp(); buildMap(sid); } }, "Continue building"),
        h("button", { class: "quiet", type: "button", disabled: !aiReady(), onclick: () => { app.current = sid; saveApp(); buildMap(sid, null, { fresh: true }); } }, "Start over")));
  }
  // the map's About tab: how it was built, what the reviewers (or, before v2.2, the checker) changed, and what that means for trusting it
  function aboutHTML(M) {
    const esc = escH, T = (x) => escH(I18N.t(x));
    const fx = ((M.checks && M.checks.fixes) || []), done = fx.filter((f) => f.done), notes = (M.checks && M.checks.notes) || [];
    const needs = M.links.filter((l) => l[2] === "needs").length, tree = M.tree;
    return '<p class="km-eyebrow">' + T("About this map") + "</p><h2>" + T("Built by AI for your goal") + "</h2>" +
      '<p class="km-small">' + esc(I18N.t(M.balls.length + " topics and " + M.nodes.length + " points, with " + needs + " “needed first” links, built in " + (M.requests || 0) + " AI requests.")) +
      (tree ? " " + esc(I18N.t(tree.agents + " planning and reviewing agents worked over " + tree.levels + (tree.levels === 1 ? " level." : " levels."))) : "") + "</p>" +
      '<p class="km-small">' + (tree
        ? T("A master AI divided the subject into parts. Planners divided each part until it was small enough to plan point by point, and wrote its points. On the way back up, a reviewer for each part checked and joined the pieces under it, and a last reviewer checked the whole map. A router marked your route. No human source was used: treat the map as the AIs' view of the subject, and check what matters to you elsewhere.")
        : T("An architect AI planned the topics and points for your goal, writers said what each point is and what it needs first, a router marked your route, and a checker reviewed the whole map. No human source was used: treat the map as one AI's view of the subject, and check what matters to you elsewhere.")) + "</p>" +
      (M.scope ? "<h3>" + T("What it covers") + '</h3><p class="km-small" data-ai>' + esc(M.scope) + "</p>" : "") +
      (M.route && M.route.note ? "<h3>" + T("How the route was chosen") + '</h3><p class="km-small" data-ai>' + esc(M.route.note) + "</p>" : "") +
      "<h3>" + T(tree ? "What the reviewers changed" : "What the checker changed") + "</h3>" +
      (M.checks && M.checks.verdict ? '<p class="km-small" data-ai>' + esc(M.checks.verdict) + "</p>" : "") +
      (done.length ? '<ul class="km-notelist">' + done.map((f) => "<li>" + esc(I18N.t(f.text)) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T(tree ? "Nothing: they found no errors to fix." : "Nothing: it found no errors to fix.") + "</p>") +
      (notes.length ? "<h3>" + T("What the page's structure check changed") + '</h3><ul class="km-notelist">' + notes.map((n) => "<li>" + esc(I18N.t(n)) + "</li>").join("") + "</ul>" : "") +
      '<p class="km-small">' + esc(I18N.t("Built " + new Date(M.built).toLocaleDateString(I18N.lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }) + ".")) + "</p>" +
      (trLang() && M.tr && M.tr[trLang()] ? '<div class="km-btns"><button class="km-btn" type="button" data-about="orig">' + T(showOrigFlag ? "Show the translation" : "Show the English original") + "</button></div>"
        : trLang() && M.src === "en" ? '<p class="km-small">' + T("This map is in English: it wasn't translated.") + '</p><div class="km-btns"><button class="km-btn" type="button" data-about="translate"' + (ui.busy["tr:map"] ? " disabled" : "") + ">" + T(ui.busy["tr:map"] ? "Translating…" : "Translate it") + "</button></div>" : "") +
      '<div class="km-btns"><button class="km-btn" type="button" data-about="profile">' + T("Rebuild or update in Profile") + "</button></div>";
  }
  function retranslateMap() {
    const sid = app.current;
    return retranslate("map", async (job) => { await translateMap(sid, job); saveMap(sid); const v = ui.view; mountMap(); if (v === "map") setView("map"); });
  }

  // ---------- Building a subject's map: a team of agents (v2.2) ----------
  // No single agent plans the whole subject, and no agent works blind. Two passes:
  //   plan:    a master divides the subject into its main parts, sets the size of a point (the grain) and each part's
  //            share of the map, and writes the subject profile. For each part, a planner divides it again or, once it is
  //            a single topic, names its points. Every planner sees the whole plan as it stands, so sizes stay even and
  //            nothing is planned twice. A plan reviewer then checks the whole plan (grain, overlaps, gaps, proportions).
  //   details: one writer per topic writes what each point is and what it needs first, seeing every point's id, so
  //            prerequisites are linked directly. Reviewers check each area side by side, then the whole map.
  // Then a router marks the route, and the page checks structure. Every finished agent's work is saved as it lands
  // (builds/<sid>), so a build that stops (closed tab, usage limit, Stop) continues where it left off.
  // The AI decides how deep the tree goes, how big each part is and what it holds; the numbers below are safety limits only.
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
  const resumable = (sid) => { const B = builds[sid], s = subjects[sid]; return B && s && B.v === 2 && B.status !== "done" && B.goal === s.goal && B.situation === (s.situation || "") ? B : null; };
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
    "You are the master planner in Learning Companion, an open-source study tool for self-learners. You lead a team of AIs that builds the knowledge map for one learner's subject, in two passes. First the plan: you divide the subject into its main parts, and for each part another AI divides it again or, once it is a single topic, names its points; a reviewer then checks the whole plan. Then the details: for each topic, an AI writes what each point is and which points it needs first, seeing the whole plan; reviewers check each area and the whole map. Lessons and practice are built from the map.",
    learnerAbout(s), "",
    "Your job:",
    "- Decide the scope: what this learner needs to reach their goal, the foundations that rests on, and enough around it that they can see where it leads. Say in \"scope\" what you included, what you left out, and why.",
    "- Set the grain for the whole map, so that every AI below plans points of the same size. Say what one point is in this subject: one idea a learner can learn in one focused sitting and then use, small enough for one lesson and big enough to stand on its own. Give a few example point names from this subject at exactly that grain.",
    "- Divide the subject, within that scope, into its main parts, in the order a learner would meet them. Divide by how the ideas actually hang together, so that each part can be planned on its own and as few ideas as possible reach across parts.",
    "- Give each part a brief in two or three sentences: what it covers, where its edges are against the other parts (so no idea is planned twice or falls between two parts), and what in it matters for this learner's goal.",
    "- Give each part its share: how much of the whole map it deserves for this learner, in words (for example \"a large part\", \"about a tenth\", \"a short overview\"). The AIs below keep to it, so the map stays in proportion to the goal.",
    "- Be accurate about the subject as experts understand it today. Where experts disagree about how it is organised, follow the most widely used organisation and mention the choice in \"scope\".",
    "",
  ].concat(profileAsk, [
    "",
    'Reply with only JSON: {"subject": "the subject\'s name", "scope": "what the map covers and leaves out, and why", "grain": {"point": "what one point is in this subject", "examples": ["point names at that grain"]}, "profile": {"name": "", "trap": "", "slips": "", "observe": "", "shallow": "", "rich": "", "examples": "", "run": "python, javascript or none", "format": ""}, "parts": [{"name": "", "brief": "", "share": ""}]}',
  ]).join("\n");

  // the branch from the subject down to a part, with each part's brief
  const pathLines = (B, n) => {
    const chain = [];
    for (let x = n; x && x.depth > 0; x = B.nodes[x.parent]) chain.unshift(x);
    return ["Subject: " + (B.subject || subjects[B.sid].name) + ". Scope: " + (B.scope || "(not stated)")]
      .concat(chain.map((x, i) => "  ".repeat(i) + "- " + x.name + ": " + (x.brief || "(no brief)"))).join("\n");
  };
  // what every agent shares: the scope and the grain the master set
  const frameLines = (B) => [
    "Scope the master chose: " + (B.scope || "(not stated)"),
    "What one point is on this map: " + ((B.grain && B.grain.point) || "one idea a learner can learn in one focused sitting and then use"),
    B.grain && B.grain.examples && B.grain.examples.length ? "Example points at that grain: " + B.grain.examples.join("; ") : null,
  ].filter(Boolean).join("\n");
  // the whole plan as it stands, every part with its share; briefs on the branch of `focus` and its siblings
  function outlineLines(B, focus) {
    const near = new Set();
    for (let x = focus; x; x = B.nodes[x.parent]) { near.add(x.id); (B.nodes[x.parent] ? B.nodes[x.parent].kids : []).forEach((k) => near.add(k)); }
    const out = [];
    const walk = (id, d) => {
      const x = B.nodes[id];
      if (d > 0) {
        const pts = x.ball && B.balls[x.ball] ? B.balls[x.ball].pts.map((p) => B.byId[p].name) : null;
        out.push("  ".repeat(d - 1) + "- " + x.name + (x.share ? " [" + x.share + "]" : "") + (x === focus ? " <- your part" : "") +
          (near.has(x.id) && x.brief ? ": " + x.brief : "") + (pts ? " (a topic: " + pts.join("; ") + ")" : x.state === "todo" && x !== focus ? " (being planned)" : ""));
      }
      (x.kids || []).forEach((k) => walk(k, d + 1));
    };
    walk("n1", 0);
    return out.join("\n");
  }
  const plannerPrompt = (s, B, n, forced) => [
    "You plan one part of a knowledge map in Learning Companion, an open-source study tool for self-learners. A team of AIs plans the map: a master divided the subject into parts, and for each part an AI like you divides it again or, once it is a single topic, names its points. Other AIs plan the other parts at the same time. Afterwards, other AIs write each point's details and reviewers check the map.",
    learnerAbout(s), "",
    frameLines(B), "",
    "The whole plan so far. Each part has its share of the map in brackets; your part is marked:", outlineLines(B, n), "",
    forced ? "Name your part's points now, as one topic: the page's safety limit on how far the map divides has been reached." : [
      "Decide how to handle your part:",
      "- Name its points, if it is a single topic: a few closely related ideas a learner would study in a row, like one section of a textbook chapter rather than the whole chapter.",
      "- Otherwise divide it into smaller parts, by how its ideas hang together, in the order a learner would meet them. Give each a brief in two or three sentences (what it covers, its edges against its siblings, what in it matters for the goal) and its share of your part. An AI for each smaller part then does what you are doing now.",
    ].join("\n"),
    "",
    "When you name points:",
    "- Keep to the grain above, however small your part is: a small part simply has few points, and its share tells you how much room it has. Don't split one idea into its steps, cases or examples; those belong inside the point's lesson.",
    "- Name each point the way a learner would recognise it, briefly, in a sensible teaching order. Don't name an idea that another part of the plan has or clearly will have.",
    "- desc: one sentence on what this topic is about and why its points belong together.",
    "- where: real books, courses or references that teach this topic well, with the chapter or section where you know it. Add a URL only if you are sure it is right. Name only sources you are confident exist; an empty list is better than a guess.",
    "",
    forced ? "Reply with only JSON:" : "Reply with only JSON, in one of two forms:",
    forced ? null : '{"divide": [{"name": "", "brief": "", "share": ""}]}',
    '{"topic": {"desc": "", "points": ["point names"], "where": [{"title": "", "detail": "chapter or section, or empty", "url": "or empty"}]}}',
  ].filter((x) => x != null).join("\n");

  // ----- the tree's state -----
  const kidsOf = (B, id) => B.nodes[id].kids || [];
  const ballsUnder = (B, id) => { const n = B.nodes[id]; return n.kids ? n.kids.flatMap((k) => ballsUnder(B, k)) : n.ball && B.balls[n.ball] ? [n.ball] : []; };
  const ptsUnder = (B, id) => ballsUnder(B, id).flatMap((t) => B.balls[t].pts);
  // the plan, every point with its id, area by area (`mark` flags one topic)
  const planLines = (B, mark) => kidsOf(B, "n1").map((a) => "Area: " + B.nodes[a].name + (B.nodes[a].share ? " [" + B.nodes[a].share + "]" : "") + "\n" +
    ballsUnder(B, a).map((t) => "Topic " + t + ": " + B.balls[t].name + (t === mark ? "  <- your topic" : "") + "\n" + B.balls[t].pts.map((p) => "  " + p + " | " + B.byId[p].name).join("\n")).join("\n")).join("\n");

  const planReviewPrompt = (s, B) => [
    "You review the plan of a knowledge map in Learning Companion, an open-source study tool for self-learners, before its details are written. AIs planned its parts separately, each seeing the plan only as it stood while they worked; you are the first to see the whole plan at once.",
    learnerAbout(s), "",
    frameLines(B), "",
    "The plan, every point with its id. Each area has the share of the map the master gave it:", planLines(B), "",
    "Fix what only someone who sees the whole plan can see:",
    "- grain: a point much bigger or smaller than the grain above (a point that is only a step, case or example of another; a point that holds several ideas);",
    "- overlap: two points in different parts that teach the same idea;",
    "- gaps: an idea the goal or other points clearly rest on that no part has;",
    "- place: a point in the wrong topic;",
    "- proportion: a part far bigger or smaller than its share, usually because it goes into more detail than the rest of the map.",
    "Leave reasonable choices of scope, order, grouping and naming alone.",
    "Give each change as one operation:",
    '- {"op": "add_point", "topic": "topic id", "name": "", "why": ""}',
    '- {"op": "merge", "id": "the point to remove", "into": "the point that keeps the idea", "why": ""}',
    '- {"op": "rename", "id": "", "name": "", "why": ""}',
    '- {"op": "move", "id": "", "topic": "topic id", "why": ""}',
    '- {"op": "remove_point", "id": "", "why": ""}',
    'Reply with only JSON: {"fixes": [operations], "verdict": "one or two sentences on how sound the plan is now"}',
  ].join("\n");

  const writerPrompt = (s, B, t) => [
    "You write the details of one topic of a knowledge map in Learning Companion, an open-source study tool for self-learners. A team of AIs planned the map and a reviewer checked the plan; other writers are doing the other topics at the same time, each seeing the same plan.",
    learnerAbout(s), "",
    frameLines(B), "",
    "The whole map, every point with its id; your topic is marked:", planLines(B, t), "",
    "For every point in your topic (" + t + ": " + B.balls[t].name + "):",
    "- what: one or two sentences on what the learner will understand or be able to do once they have learned it.",
    "- needs: the ids of points anywhere on the map that must be learned first because this point can't be understood without them. Only direct needs: if A needs B and B needs C, A lists B, not C. A point that only makes this one easier is not a need.",
    "- helps: the ids of points that make this one easier but aren't required.",
    "If a point here can't be understood without an idea that no point on the map teaches, name that idea in \"missing\"; reviewers will add it.",
    'Reply with only JSON: {"points": [{"id": "the point id", "what": "", "needs": ["ids"], "helps": ["ids"]}], "missing": [{"idea": "", "for": ["point ids"]}]}',
  ].join("\n");

  const reviewerPrompt = (s, B, n, check) => {
    const root = n.depth === 0;
    const inPart = new Set(ptsUnder(B, n.id));
    const open = B.open.filter((o) => inPart.has(o.pt));
    const ptLine = (p) => { const x = B.byId[p]; return "  " + p + " | " + x.name + " | " + (x.what || "") + " | needs: " + (x.needs.join(", ") || "nothing"); };
    const pieces = kidsOf(B, n.id).map((k) => "Piece: " + B.nodes[k].name + "\n" + ballsUnder(B, k).map((t) => "Topic " + t + ": " + B.balls[t].name + "\n" + B.balls[t].pts.map(ptLine).join("\n")).join("\n")).join("\n\n");
    return [
      check
        ? "You check one part of a knowledge map in Learning Companion, an open-source study tool for self-learners. The learner is already using this map and asked for another check of it: AIs built it without a textbook, and earlier reviews may have missed things. " + (root ? "Your part is the whole map; reviewers have just checked each area on its own, so look most closely at what lies between areas." : "Another AI will then check the whole map.") + " The learner keeps their progress, so fix only what is really wrong. Write new names and descriptions in the language the map is written in."
        : "You review one part of a knowledge map in Learning Companion, an open-source study tool for self-learners, before the learner sees it. Separate AIs wrote the details of its topics, each seeing the whole plan; you are the first to check them together. " + (root ? "Your part is the whole map; reviewers have just checked each area on its own, so look most closely at what lies between areas." : "Another AI will then check the whole map."),
      learnerAbout(s), "",
      root || !B.nodes[n.parent] ? frameLines(B) : "Where this part sits:\n" + pathLines(B, n), "",
      "This part, piece by piece. Every point with its id, what it is, and the points it needs first:", pieces, "",
      open.length ? "Ideas the writers found missing (no point on the map teaches them):\n" + open.map((o) => o.id + " | needed by " + o.pt + " (" + B.byId[o.pt].name + ") | " + o.text).join("\n") + "\n" : null,
      "Fix real errors: a point that is wrong, misnamed, or doesn't belong to this subject; two points that teach the same idea; a point in the wrong topic; an idea this part rests on that no point teaches; a \"needs\" link that is wrong (the point can be understood without it) or missing (it can't be understood without it), above all between topics written by different AIs. Leave reasonable choices of scope, order, grouping and naming alone.",
      open.length ? (root ? "For each missing idea, link it to the point that teaches it, add the point if the idea belongs on the map, or drop it if the point can be understood without it." : "For each missing idea, link it to the point in this part that teaches it, add the point if it belongs in this part, or leave it for the reviewer of the whole map.") : null,
      "Give each change as one operation:",
      open.length ? '- {"op": "link", "need": "missing idea id", "to": "point id"} and {"op": "drop_need", "need": "missing idea id", "why": ""}' : null,
      '- {"op": "add_point", "topic": "topic id", "name": "", "what": "", "needs": ["point ids"], "needed_by": ["ids of points that need the new point"]' + (open.length ? ', "for": ["missing idea ids it meets"]' : "") + ', "why": ""}',
      "A point you add has no id yet, so link the points that need it with \"needed_by\" in the same operation, not with add_need. A \"needs\" link may point to any point on the map; the point that gains or loses it must be in your part.",
      '- {"op": "merge", "id": "the point to remove", "into": "the point that keeps the idea", "why": ""}',
      '- {"op": "rename", "id": "", "name": "", "what": "", "why": ""}',
      '- {"op": "move", "id": "", "topic": "topic id", "why": ""}',
      '- {"op": "remove_point", "id": "", "why": ""}',
      '- {"op": "add_need", "id": "", "need": "", "why": ""} and {"op": "remove_need", "id": "", "need": "", "why": ""}',
      'Reply with only JSON: {"fixes": [operations], "verdict": "one or two sentences on how sound this part is now"}',
    ].filter((x) => x != null).join("\n");
  };

  const newBuild = (s) => ({
    v: 2, sid: s.sid, goal: s.goal, situation: s.situation || "", started: new Date().toISOString(), status: "running", requests: 0, agents: 0,
    subject: "", scope: "", grain: null, profile: null,
    nodes: { n1: { id: "n1", parent: null, depth: 0, name: s.name, brief: "", state: "todo" } },
    nNode: 1, nTopic: 0, nPoint: 0, nNeed: 0, balls: {}, byId: {}, open: [], fixes: [], notes: [], verdicts: {}, linked: 0,
    planChecked: false, reviewed: {},
  });
  function addKids(B, n, parts) {
    const ok = parr(parts).map((x) => ({ name: pstr(x && x.name), brief: pstr(x && x.brief), share: pstr(x && x.share) })).filter((x) => x.name);
    if (ok.length > MAP_LIMITS.parts) B.notes.push("\"" + n.name + "\" was divided into more parts than the page's safety limit, so " + (ok.length - MAP_LIMITS.parts) + " were left out.");
    n.kids = ok.slice(0, MAP_LIMITS.parts).map((x) => {
      const id = "n" + (++B.nNode);
      B.nodes[id] = { id, parent: n.id, depth: n.depth + 1, name: x.name, brief: x.brief, share: x.share, state: "todo" };
      return id;
    });
    n.state = "split";
  }
  // a planner named its part's points: the part becomes a topic, its points get ids; details come later
  function nameTopic(B, n, w) {
    const tid = "t" + (++B.nTopic);
    const b = { id: tid, name: n.name, desc: pstr(w.desc), node: n.id, pts: [], where: [], written: false };
    const seen = new Set(Object.values(B.byId).map((x) => x.name.toLowerCase()));
    let cut = 0;
    parr(w.points).map((x) => pstr(typeof x === "string" ? x : x && x.name)).filter(Boolean).forEach((name) => {
      if (seen.has(name.toLowerCase())) { B.notes.push("Dropped a second point named \"" + name + "\"."); return; }
      if (b.pts.length >= MAP_LIMITS.perTopic || Object.keys(B.byId).length >= MAP_LIMITS.points) { cut++; return; }
      seen.add(name.toLowerCase());
      const id = "p" + (++B.nPoint);
      B.byId[id] = { id, name, what: "", needs: [], helps: [] };
      b.pts.push(id);
    });
    if (cut) B.notes.push("\"" + n.name + "\" ran past the page's safety limits, so " + cut + " of its points were left out.");
    b.where = parr(w.where).map((x) => ({ title: pstr(x && x.title), detail: pstr(x && x.detail), url: /^https?:\/\/\S+$/.test(pstr(x && x.url)) ? pstr(x.url) : "" })).filter((x) => x.title).slice(0, 8);
    B.balls[tid] = b; n.ball = tid; n.state = "topic";
  }
  function applyDetails(B, t, d) {
    const b = B.balls[t];
    parr(d && d.points).forEach((x) => {
      const P = B.byId[pstr(x && x.id)];
      if (!P || !b.pts.includes(P.id)) return;
      P.what = pstr(x.what);
      P.needs = [...new Set(parr(x.needs).map(pstr).filter((id) => B.byId[id] && id !== P.id))];
      P.helps = [...new Set(parr(x.helps).map(pstr).filter((id) => B.byId[id] && id !== P.id && !P.needs.includes(id)))];
    });
    parr(d && d.missing).forEach((m) => {
      const text = pstr(m && m.idea);
      if (!text) return;
      const pt = parr(m.for).map(pstr).find((id) => b.pts.includes(id)) || b.pts[0];
      if (pt) B.open.push({ id: "N" + (++B.nNeed), pt, text });
    });
    b.written = true;
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
      const d = await askValid(job, "Master", inEnglish(masterPrompt(s)), "complex", (d) => d && parr(d.parts).some((x) => pstr(x && x.name)));
      B.subject = pstr(d.subject); B.scope = pstr(d.scope);
      const g = d.grain || {};
      B.grain = { point: pstr(g.point), examples: parr(g.examples).map(pstr).filter(Boolean).slice(0, 12) };
      const p = d.profile || {};
      B.profile = {};
      ["name", "trap", "slips", "observe", "shallow", "rich", "examples", "format"].forEach((k) => { B.profile[k] = pstr(p[k]); });
      B.profile.run = ["python", "javascript", "none"].includes(pstr(p.run).toLowerCase()) ? pstr(p.run).toLowerCase() : "none";
      addKids(B, n, d.parts);
    } else {
      const forced = n.depth >= MAP_LIMITS.depth || Object.keys(B.nodes).length >= MAP_LIMITS.agents / 2 || B.nTopic + Object.values(B.nodes).filter((x) => x.state === "todo").length >= MAP_LIMITS.topics;
      const canName = (d) => d && d.topic && parr(d.topic.points).some((x) => pstr(typeof x === "string" ? x : x && x.name));
      const canDivide = (d) => !forced && d && parr(d.divide).some((x) => pstr(x && x.name));
      const d = await askValid(job, "Planner", inEnglish(plannerPrompt(s, B, n, forced)), "default", (d) => canName(d) || canDivide(d));
      if (canName(d)) nameTopic(B, n, d.topic); else addKids(B, n, d.divide);
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
    // a reviewer sometimes adds a link and then withdraws it in the same answer: the pair cancels out, so the link that
    // was already there stays (applied one after the other, the withdrawal would remove it)
    const key = (f) => pstr(f && f.id) + ">" + pstr(f && f.need);
    const adds = new Set(parr(r && r.fixes).filter((f) => pstr(f && f.op) === "add_need").map(key));
    const pairs = new Set(parr(r && r.fixes).filter((f) => pstr(f && f.op) === "remove_need" && adds.has(key(f))).map(key));
    parr(r && r.fixes).filter((f) => !((pstr(f && f.op) === "add_need" || pstr(f && f.op) === "remove_need") && pairs.has(key(f)))).forEach((f) => {
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
        parr(f.needed_by).map(pstr).forEach((k) => { if (P.has(k) && k !== nid && !B.byId[k].needs.includes(nid)) B.byId[k].needs.push(nid); });
        parr(f.for).map(pstr).forEach((k) => { const o = openOf(k); if (o && o.pt !== nid) { if (!B.byId[o.pt].needs.includes(nid)) B.byId[o.pt].needs.push(nid); B.open = B.open.filter((y) => y !== o); B.linked++; } });
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
        if (!P.has(id) || !B.byId[need] || id === need || (op === "remove_need" && !x.needs.includes(need))) return skip("Couldn't change what " + id + " needs" + tail);
        if (op === "add_need") { if (x.needs.includes(need)) return; x.needs.push(need); x.helps = x.helps.filter((y) => y !== need); ok(nameOf(id) + " now needs " + nameOf(need) + " first" + tail); }
        else { x.needs = x.needs.filter((y) => y !== need); ok(nameOf(id) + " no longer needs " + nameOf(need) + " first" + tail); }
      } else if (op) skip("Unknown change \"" + op + "\"" + tail);
    });
    if (pstr(r && r.verdict)) B.verdicts[n.id] = pstr(r.verdict);
  }
  // ----- the passes: plan down the tree, check the plan, write the details, check each area and then the whole map.
  // Whatever is already done (a continued build) is skipped. -----
  const saveStep = (B, job) => { B.requests = job.requests; saveBuild(B); job.paint(); };
  const settle = async (ps) => { const res = await Promise.allSettled(ps); const bad = res.find((x) => x.status === "rejected"); if (bad) throw bad.reason; };
  const reviewOk = (d) => d && Array.isArray(d.fixes);
  async function planTree(s, B, id, job) {
    const n = B.nodes[id];
    if (job.cancel) throw { code: "cancelled" };
    if (n.state === "todo") { await planNode(s, B, n, job); saveStep(B, job); }
    if (n.kids) await settle(n.kids.map((k) => planTree(s, B, k, job)));
  }
  const areasToReview = (B) => kidsOf(B, "n1").filter((a) => ballsUnder(B, a).length > 1);
  async function runTree(s, B, job) {
    job.stage = "plan"; job.paint();
    await planTree(s, B, "n1", job);
    if (!B.planChecked) {
      job.stage = "plancheck"; job.paint();
      applyReview(B, B.nodes.n1, await askValid(job, "Reviewer", inEnglish(planReviewPrompt(s, B)), "complex", reviewOk));
      B.verdicts.plan = B.verdicts.n1 || ""; delete B.verdicts.n1;
      B.agents++; B.planChecked = true; saveStep(B, job);
    }
    job.stage = "write"; job.paint();
    await settle(Object.keys(B.balls).filter((t) => !B.balls[t].written && B.balls[t].pts.length).map(async (t) => {
      applyDetails(B, t, await askValid(job, "Writer", inEnglish(writerPrompt(s, B, t)), "default", (d) => d && Array.isArray(d.points)));
      B.agents++; saveStep(B, job);
    }));
    job.stage = "review"; job.paint();
    await settle(areasToReview(B).filter((a) => !B.reviewed[a]).map(async (a) => {
      applyReview(B, B.nodes[a], await askValid(job, "Reviewer", inEnglish(reviewerPrompt(s, B, B.nodes[a])), "complex", reviewOk));
      B.agents++; B.reviewed[a] = true; saveStep(B, job);
    }));
    if (!B.reviewed.n1) {
      applyReview(B, B.nodes.n1, await askValid(job, "Reviewer", inEnglish(reviewerPrompt(s, B, B.nodes.n1)), "complex", reviewOk));
      B.open.forEach((o) => B.notes.push("A writer found \"" + (B.byId[o.pt] || {}).name + "\" needs \"" + o.text + "\", which no point teaches, and no reviewer settled it."));
      B.open = [];
      B.agents++; B.reviewed.n1 = true; saveStep(B, job);
    }
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
    // each link once (a reviewer could add the same need twice, once for the point and once for a missing idea)
    ids.forEach((id) => { const n = W.byId[id]; [...new Set(n.needs)].forEach((p) => links.push([p, id, "needs"])); [...new Set(n.helps)].filter((p) => W.byId[p] && !n.needs.includes(p)).forEach((p) => links.push([p, id, "helps"])); });
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
        applyRoute(W, await ask(job, "Router", inMapLang(M, routerPrompt(s, W)), "default", true));
        const fin = finishMap(W);
        const M2 = { ...M, route: fin.route, routeAt: new Date().toISOString() };
        maps[sid] = M2;
        if (needsTr(M2)) {
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
        await runTree(s, B, job);
        W = treeToWork(B);
        // 2. the router
        job.stage = "route"; job.paint();
        applyRoute(W, await ask(job, "Router", inEnglish(routerPrompt(s, W)), "default", true));
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

  // ----- Check: reviewers go over a map the learner already uses, one per area side by side, then one for the whole map.
  // The learner's progress, lessons and notes stay with their points; only real errors are changed. -----
  function treeFromMap(M, s) {
    const B = { sid: M.sid, subject: M.subject, scope: M.scope, nodes: { n1: { id: "n1", parent: null, depth: 0, name: s.name, state: "split", kids: [] } }, balls: {}, byId: {},
      open: [], fixes: [], notes: [], verdicts: {}, linked: 0, nPoint: M.nodes.reduce((m, n) => Math.max(m, +n.id.slice(1) || 0), 0) };
    M.nodes.forEach((n) => { B.byId[n.id] = { id: n.id, name: n.name, what: n.what || "", needs: [], helps: [] }; });
    M.links.forEach(([a, b, k]) => { if (B.byId[a] && B.byId[b]) (k === "helps" ? B.byId[b].helps : B.byId[b].needs).push(a); });
    M.areas.forEach(([aid, name]) => {
      const an = { id: "n_" + aid, parent: "n1", depth: 1, name, brief: "", state: "split", kids: [] };
      B.nodes[an.id] = an; B.nodes.n1.kids.push(an.id);
      M.balls.filter((b) => b.area === aid).forEach((b) => {
        B.balls[b.id] = { id: b.id, name: b.name, desc: b.desc, pts: b.pts.slice(), where: b.where || [], area: aid };
        const tn = { id: "n_" + b.id, parent: an.id, depth: 2, name: b.name, brief: b.desc || "", state: "topic", ball: b.id };
        B.nodes[tn.id] = tn; an.kids.push(tn.id);
      });
    });
    return B;
  }
  async function checkMap(sid) {
    const s = subjects[sid];
    if (!s || !aiReady() || (ui.build && ui.build.running)) return;
    await ensureMap(sid);
    const M0 = maps[sid];
    if (!M0) return;
    const job = { id: "check:" + sid, sid, requests: 0, cancel: false, running: true, stage: "check", only: "check", error: null, done: 0, parts: 0 };
    job.paint = () => { if (ui.view !== "map") render(); };
    ui.build = job; render();
    logEvent("map", "Checking the map for " + s.name);
    try {
      const B = treeFromMap(M0, s), areas = B.nodes.n1.kids;
      job.parts = areas.length + 1; job.paint();
      // each area on its own, side by side; then the whole map
      const res = await Promise.allSettled(areas.map(async (aid) => {
        applyReview(B, B.nodes[aid], await askValid(job, "Reviewer", inMapLang(M0, reviewerPrompt(s, B, B.nodes[aid], true)), "complex", (d) => d && Array.isArray(d.fixes)));
        job.done++; job.paint();
      }));
      const bad = res.find((x) => x.status === "rejected");
      if (bad) throw bad.reason;
      applyReview(B, B.nodes.n1, await askValid(job, "Reviewer", inMapLang(M0, reviewerPrompt(s, B, B.nodes.n1, true)), "complex", (d) => d && Array.isArray(d.fixes)));
      job.done++; job.paint();
      // the checked map, through the page's structure checks; the route keeps what is still on the map
      const W = { scope: M0.scope, subject: M0.subject, profile: M0.profile, areas: M0.areas.map(([id, name]) => ({ id, name })), byId: B.byId,
        balls: M0.balls.map((b) => ({ ...b, pts: B.balls[b.id].pts.slice() })).filter((b) => b.pts.length), order: [],
        route: { goal: M0.route.goal.filter((id) => B.byId[id]), why: M0.route.why, note: M0.route.note }, notes: B.notes, fixes: B.fixes };
      W.areas = W.areas.filter((a) => W.balls.some((b) => b.area === a.id));
      const fin = finishMap(W);
      const M = { ...M0, tr: undefined, areas: fin.areas, balls: fin.balls, nodes: fin.nodes, links: fin.links, blinks: fin.blinks, route: fin.route,
        checked: (M0.checked || []).concat([{ at: new Date().toISOString(), fixes: B.fixes, verdict: B.verdicts.n1 || "", notes: B.notes }]) };
      maps[sid] = M;
      if (needsTr(M)) {
        job.stage = "translate"; job.paint();
        try { await translateMap(sid, job); } catch (e) { if (e && e.code === "cancelled") throw e; notify("The map is checked, but it couldn't be translated again, so some of it may show in English. You can translate it again from its About tab.", "warn"); }
      }
      M.requests = (M0.requests || 0) + job.requests;
      // progress stays with the points that are still there
      const known = new Set(M.nodes.map((n) => n.id));
      s.learned = (s.learned || []).filter((id) => known.has(id));
      saveMap(sid); saveSubject(sid);
      job.stage = "done";
      const n = B.fixes.filter((f) => f.done).length;
      logEvent("map", "Map checked for " + s.name + ": " + n + (n === 1 ? " change" : " changes") + "; " + job.requests + " requests");
      notify(n ? "The check is done: " + n + (n === 1 ? " change" : " changes") + " to your map. See them on the map's About tab." : "The check is done: no errors were found.");
      if (sid === app.current) mountMap();
    } catch (e) {
      job.stage = "error";
      job.error = jobError(e);
      logEvent("map", "Map check not finished for " + s.name + ". " + job.error);
      if (!(e && e.code === "cancelled")) notify("The check wasn't finished, so your map is unchanged. " + job.error, "bad");
    } finally {
      job.running = false; render();
    }
  }
  const checkCost = (M) => M.areas.length + 1;

  // ----- progress, while the tree works and when it has stopped part-way -----
  function treeCounts(B) {
    const ns = Object.values(B.nodes), ts = Object.values(B.balls).filter((b) => b.pts.length);
    const reviews = areasToReview(B).concat(["n1"]);
    return { planned: ns.filter((x) => x.state !== "todo").length, parts: ns.length, topics: ts.length, points: Object.keys(B.byId).length,
      written: ts.filter((b) => b.written).length, reviewed: reviews.filter((a) => B.reviewed[a]).length, reviews: reviews.length,
      levels: ns.reduce((m, x) => Math.max(m, x.depth), 0) + 1, masterDone: B.nodes.n1.state !== "todo", plansDone: ns.every((x) => x.state !== "todo"),
      planChecked: !!B.planChecked, allWritten: ts.length > 0 && ts.every((b) => b.written), rootDone: !!B.reviewed.n1 };
  }
  const treeLine = (c) => c.planned + " of " + c.parts + " parts planned · " + c.written + " of " + c.topics + " topics written · " + c.reviewed + " of " + c.reviews + " parts checked";
  function buildCard(job) {
    const TRS = trLang() ? [["translate", "Translator", "translates the map into your language, keeping the English original"]] : [];
    if (job.only === "check") {
      const at = { check: 0, translate: 1, done: 2 }[job.stage];
      return h("div", { class: "card", "aria-live": "polite" },
        h("div", { class: "row spread" }, h("h3", null, "Checking your map"), h("span", { class: "muted small" }, job.requests + " requests so far")),
        h("ol", { class: "plain" }, [["check", "Reviewers", "check each area, then the whole map, and fix what's wrong", job.parts ? job.done + " of " + job.parts + " parts checked" : null]].concat(TRS.map((x) => x.concat([null]))).map(([id, who, what, sub], i) =>
          h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what, sub ? h("span", { class: "muted small" }, " · " + sub) : null))),
        h("p", { class: "small muted" }, "Your progress, lessons and notes stay with their points. If the check stops, your map is unchanged."),
        h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
    }
    if (job.only === "route") {
      const at = { route: 0, translate: 1, done: 2 }[job.stage];
      return h("div", { class: "card", "aria-live": "polite" },
        h("div", { class: "row spread" }, h("h3", null, "Updating your route"), h("span", { class: "muted small" }, job.requests + " requests so far")),
        h("ol", { class: "plain" }, [["route", "Router", "marks the route your goal needs"]].concat(TRS).map(([id, who, what], i) => h("li", null, h("strong", null, (i < at ? "✓ " : i === at ? "… " : "") + who), " " + what))),
        h("div", { class: "row" }, h("button", { class: "quiet", type: "button", onclick: () => { job.cancel = true; } }, "Stop")));
    }
    const c = job.B ? treeCounts(job.B) : { planned: 0, parts: 1, topics: 0, points: 0, written: 0, reviewed: 0, reviews: 1, levels: 1, masterDone: false, plansDone: false, planChecked: false, allWritten: false, rootDone: false };
    const after = { tree: 0, route: 1, page: 2, translate: 3, done: 4 }[job.stage] || 0;
    const mark = (done, now) => (done ? "✓ " : now ? "… " : "");
    const rows = [
      [mark(c.masterDone, !c.masterDone), "Master", "divides the subject into its main parts, sets the size of a point and each part's share, and writes the subject profile", null],
      [mark(c.plansDone, c.masterDone && !c.plansDone), "Planners", "divide each part further, or name its points once it's a single topic", c.masterDone ? c.planned + " of " + c.parts + " parts planned · " + c.topics + " topics · " + c.points + " points · " + c.levels + (c.levels === 1 ? " level" : " levels") : null],
      [mark(c.planChecked, c.plansDone && !c.planChecked), "Plan reviewer", "checks the whole plan: the size of points, overlaps, gaps and proportions", null],
      [mark(c.allWritten, c.planChecked && !c.allWritten), "Writers", "write what each point is and what it needs first, each seeing the whole plan", c.planChecked ? c.written + " of " + c.topics + " topics written" : null],
      [mark(c.rootDone, c.allWritten && !c.rootDone), "Reviewers", "check each area, then the whole map", c.allWritten ? c.reviewed + " of " + c.reviews + " parts checked" : null],
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
        ? T("A master AI divided the subject into parts and set how big a point is. Planners divided each part until it was a single topic and named its points, each seeing the whole plan, and a reviewer checked the plan. Writers then filled in each topic, seeing every point on the map, and reviewers checked each area and the whole map. A router marked your route. No human source was used: treat the map as the AIs' view of the subject, and check what matters to you elsewhere.")
        : T("An architect AI planned the topics and points for your goal, writers said what each point is and what it needs first, a router marked your route, and a checker reviewed the whole map. No human source was used: treat the map as one AI's view of the subject, and check what matters to you elsewhere.")) + "</p>" +
      (M.scope ? "<h3>" + T("What it covers") + '</h3><p class="km-small" data-ai>' + esc(M.scope) + "</p>" : "") +
      (M.route && M.route.note ? "<h3>" + T("How the route was chosen") + '</h3><p class="km-small" data-ai>' + esc(M.route.note) + "</p>" : "") +
      "<h3>" + T(tree ? "What the reviewers changed" : "What the checker changed") + "</h3>" +
      (M.checks && M.checks.verdict ? '<p class="km-small" data-ai>' + esc(M.checks.verdict) + "</p>" : "") +
      (done.length ? '<ul class="km-notelist">' + done.map((f) => "<li>" + esc(I18N.t(f.text)) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T(tree ? "Nothing: they found no errors to fix." : "Nothing: it found no errors to fix.") + "</p>") +
      (M.checked || []).map((c) => "<h3>" + esc(I18N.t("What the check on " + new Date(c.at).toLocaleDateString(I18N.lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }) + " changed")) + "</h3>" +
        (c.verdict ? '<p class="km-small" data-ai>' + esc(c.verdict) + "</p>" : "") +
        (c.fixes.filter((f) => f.done).length ? '<ul class="km-notelist">' + c.fixes.filter((f) => f.done).map((f) => "<li>" + esc(I18N.t(f.text)) + "</li>").join("") + "</ul>" : '<p class="km-empty">' + T("Nothing: no errors were found.") + "</p>")).join("") +
      (notes.length ? "<h3>" + T("What the page's structure check changed") + '</h3><ul class="km-notelist">' + notes.map((n) => "<li>" + esc(I18N.t(n)) + "</li>").join("") + "</ul>" : "") +
      '<p class="km-small">' + esc(I18N.t("Built " + new Date(M.built).toLocaleDateString(I18N.lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "short", day: "numeric" }) + ".")) + "</p>" +
      (needsTr(M) && M.tr && M.tr[curLang()] ? '<div class="km-btns"><button class="km-btn" type="button" data-about="orig">' + T(origLabel(M)) + "</button></div>"
        : needsTr(M) && ui.autoTr["map:" + M.mid] === "failed" ? '<p class="km-small">' + T(srcOf(M) === "en" ? "This map is in English: it couldn't be translated." : "This map is in Chinese: it couldn't be translated.") + '</p><div class="km-btns"><button class="km-btn" type="button" data-about="translate">' + T("Translate it") + "</button></div>"
        : needsTr(M) && !showOrigFlag ? '<p class="km-small">' + T("Translating into your language…") + "</p>" : "") +
      '<div class="km-btns"><button class="km-btn" type="button" data-about="profile">' + T("Rebuild or update in Profile") + "</button></div>";
  }
  // the open map, translated into the interface language the first time it is shown in it
  function mapTrFn(sid) {
    return async (job) => { await translateMap(sid, job); saveMap(sid); if (sid === app.current) { const v = ui.view; mountMap(); if (v === "map") setView("map"); } };
  }
  function autoTranslateMap() {
    const M = curMap();
    if (M && needsTr(M) && !showOrigFlag && !(M.tr && M.tr[curLang()])) autoTranslate("map:" + M.mid, mapTrFn(app.current));
  }
  function retranslateMap() { const M = curMap(); if (M) { ui.autoTr["map:" + M.mid] = null; autoTranslateMap(); } }

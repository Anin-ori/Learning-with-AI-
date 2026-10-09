  // ---------- Translation (v2.1) ----------
  // Every agent works in English. When the learner reads another language, a translator turns what was built (maps,
  // lessons, notes, practice, the level check, AI guidance) into that language after it is delivered, and the English
  // original is kept beside it: the learner can switch to it at any time. The tutor chat is the exception: it answers
  // directly in the learner's language, so replies still stream in. A failed translation never blocks anything: the
  // learner gets the English original and can ask for the translation again.
  // v2.2: content follows the interface language both ways. Whatever is shown in a language it wasn't written in is
  // translated the first time it is shown (a map built in Chinese before v2.1 is translated into English too), and the
  // original stays one switch away.
  const LANG_NAMES = { en: "English", zh: "Simplified Chinese (简体中文)" };
  const curLang = () => (LANG_NAMES[I18N.lang] ? I18N.lang : "en");
  const trLang = () => (curLang() !== "en" ? curLang() : null);   // a new map is written in English, then translated into this
  // Agents always work in English (R63): they are given the English of the map (for a map first built in another
  // language, its English translation) and told to write in English, whatever language the learner's goal is in.
  const inEnglish = (prompt) => prompt + "\n\nWrite in English, whatever language the learner's goal or any name above is in: a translator turns what you write into the learner's language.";
  // the language an item was written in: its own mark, else its map's (maps from v2.0 recorded only that), else English
  const srcOf = (item) => (item && (item.src || item.lang)) || (typeof curMap === "function" && curMap() && (curMap().src || curMap().lang)) || "en";
  const needsTr = (item) => !!item && srcOf(item) !== curLang();
  const TR_CHUNK = 9000;   // safety limit on the characters sent in one translation request
  const TR_PART = 2500;    // safety limit: a longer text (a lesson) is sent as several parts, split between paragraphs
  // splits Markdown between paragraphs, never inside a code block; the parts join back with a blank line
  function mdParts(s) {
    const blocks = [];
    let cur = [], fence = false;
    s.split("\n").forEach((line) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (!fence && !line.trim()) { if (cur.length) { blocks.push(cur.join("\n")); cur = []; } return; }
      cur.push(line);
    });
    if (cur.length) blocks.push(cur.join("\n"));
    const parts = [];
    blocks.forEach((b) => { if (parts.length && parts[parts.length - 1].length + b.length < TR_PART) parts[parts.length - 1] += "\n\n" + b; else parts.push(b); });
    return parts;
  }
  let showOrigFlag = false;
  try { showOrigFlag = localStorage.getItem("lc-orig") === "1"; } catch (_) {}
  function setShowOrig(on) {
    showOrigFlag = !!on;
    try { localStorage.setItem("lc-orig", on ? "1" : "0"); } catch (_) {}
    if (typeof mountMap === "function") { const v = ui.view; mountMap(); if (v === "map") setView("map"); }
    render();
  }
  // the translated version of a stored item, or null when the original should show
  const trOf = (item) => { const L = curLang(); return needsTr(item) && !showOrigFlag && item.tr && item.tr[L] ? item.tr[L] : null; };
  const pickT = (t, v) => (typeof t === "string" && t.trim() ? t : v);

  const translatorPrompt = (strs, about, from) => [
    "You translate study material in Learning Companion, a study tool for self-learners, from " + LANG_NAMES[from || "en"] + " into " + LANG_NAMES[curLang()] + ". " + about,
    "- Translate every string faithfully and completely, in the natural, precise style a good textbook in that language would use. Don't add, drop or explain anything.",
    "- Use the standard terms that textbooks in that language use for this subject. Where a standard term may be unfamiliar, give the English term in parentheses the first time it appears in a string.",
    "- In code blocks, translate only the comments. Keep exactly as they are: the code itself (strings in it too), text in backticks, formulas and mathematical notation, identifiers, program input and output, numbers, URLs, and the Markdown structure (headings, lists, tables, bold, line breaks). Keep a line that reads only \"Output:\" exactly as it is.",
    "- Names of books and courses keep their published title in that language if one exists, otherwise the original title.",
    curLang() === "en" ? "- Write every name and heading in sentence case: capitalise only the first word and proper names, the same way in every string." : null,
    "",
    "The strings, as a JSON array:",
    JSON.stringify(strs),
    "",
    'Reply with only JSON: {"t": ["the translation of string 1", "..."]}, with exactly ' + strs.length + " strings in the same order.",
  ].filter((x) => x != null).join("\n");
  // translates a list of strings in as few requests as the safety limit allows; empty strings stay empty
  async function translateList(job, list, about, from) {
    const texts = list.map((s) => (typeof s === "string" ? s : ""));
    // long texts go as parts so one request never carries a whole lesson; they are joined again below
    const units = [], owner = [];
    texts.forEach((s, i) => (s.length > TR_PART ? mdParts(s) : [s]).forEach((u) => { units.push(u); owner.push(i); }));
    const done = await translateUnits(job, units, about, from);
    const res = texts.map(() => []);
    done.forEach((u, k) => res[owner[k]].push(u));
    return res.map((r, i) => (texts[i].length > TR_PART ? r.join("\n\n") : r[0]));
  }
  async function translateUnits(job, list, about, from) {
    const out = list.slice();
    const idx = out.map((s, i) => (s.trim() ? i : -1)).filter((i) => i >= 0);
    const chunks = [];
    let cur = [], size = 0;
    idx.forEach((i) => { const n = out[i].length; if (cur.length && size + n > TR_CHUNK) { chunks.push(cur); cur = []; size = 0; } cur.push(i); size += n; });
    if (cur.length) chunks.push(cur);
    await Promise.all(chunks.map(async (c) => {
      const strs = c.map((i) => out[i]);
      for (let attempt = 0; ; attempt++) {
        const d = await ask(job, "Translator", translatorPrompt(strs, about, from), "default", true);
        const t = d && Array.isArray(d.t) ? d.t : null;
        if (t && t.length === strs.length && t.every((x) => typeof x === "string")) { c.forEach((i, k) => { out[i] = t[k].trim() ? t[k] : out[i]; }); return; }
        if (attempt >= 1) throw { code: "invalid_json", agent: "Translator" };
      }
    }));
    return out;
  }
  // fills `target` from pairs of [English text, setter] with one translation pass
  async function trPairs(job, pairs, about, from) {
    const t = await translateList(job, pairs.map((p) => p[0] || ""), about, from);
    pairs.forEach((p, i) => p[1](t[i]));
  }
  const subjectAbout = (kind) => { const s = cur(); return "This is " + kind + (s ? " for a learner of " + s.name : "") + "."; };

  // ----- what gets translated -----
  function mapPairs(M, T) {
    T.areas = {}; T.balls = {}; T.nodes = {}; T.route = { why: {} };
    const P = [];
    P.push([M.subject, (v) => { T.subject = v; }]);
    P.push([M.scope, (v) => { T.scope = v; }]);
    M.areas.forEach(([id, name]) => P.push([name, (v) => { T.areas[id] = v; }]));
    M.balls.forEach((b) => {
      const tb = T.balls[b.id] = { where: [] };
      P.push([b.name, (v) => { tb.name = v; }]);
      P.push([b.desc, (v) => { tb.desc = v; }]);
      (b.where || []).forEach((w, i) => { tb.where[i] = {}; P.push([w.title, (v) => { tb.where[i].title = v; }]); P.push([w.detail, (v) => { tb.where[i].detail = v; }]); });
    });
    M.nodes.forEach((n) => { const tn = T.nodes[n.id] = {}; P.push([n.name, (v) => { tn.name = v; }]); P.push([n.what, (v) => { tn.what = v; }]); });
    Object.entries((M.route && M.route.why) || {}).forEach(([id, w]) => P.push([w, (v) => { T.route.why[id] = v; }]));
    P.push([M.route && M.route.note, (v) => { T.route.note = v; }]);
    if (M.checks) {
      T.fixes = [];
      P.push([M.checks.verdict, (v) => { T.verdict = v; }]);
      (M.checks.fixes || []).forEach((f, i) => P.push([f.text, (v) => { T.fixes[i] = v; }]));
      T.notes = [];
      (M.checks.notes || []).forEach((n, i) => P.push([n, (v) => { T.notes[i] = v; }]));
    }
    T.checked = [];
    (M.checked || []).forEach((c, k) => {
      const tc = T.checked[k] = { fixes: [] };
      P.push([c.verdict, (v) => { tc.verdict = v; }]);
      c.fixes.forEach((f, i) => P.push([f.text, (v) => { tc.fixes[i] = v; }]));
    });
    return P;
  }
  function routePairs(M, T) {
    T.route = { why: {} };
    const P = Object.entries((M.route && M.route.why) || {}).map(([id, w]) => [w, (v) => { T.route.why[id] = v; }]);
    P.push([M.route && M.route.note, (v) => { T.route.note = v; }]);
    return P;
  }
  // the map as the learner sees it: translated names over a copy of the original (never the stored map itself)
  function displayMap(M) {
    const D = clone(M);
    D.nodes.forEach((n) => { n.name_en = n.name; });
    D.balls.forEach((b) => { b.name_en = b.name; });
    const T = trOf(M);
    if (!T) return D;
    D.subject = pickT(T.subject, D.subject);
    D.scope = pickT(T.scope, D.scope);
    D.areas = D.areas.map(([id, name]) => [id, pickT((T.areas || {})[id], name)]);
    D.balls.forEach((b) => {
      const t = (T.balls || {})[b.id]; if (!t) return;
      b.name = pickT(t.name, b.name); b.desc = pickT(t.desc, b.desc);
      b.where = (b.where || []).map((w, i) => ({ ...w, title: pickT((t.where[i] || {}).title, w.title), detail: pickT((t.where[i] || {}).detail, w.detail) }));
    });
    D.nodes.forEach((n) => { const t = (T.nodes || {})[n.id]; if (t) { n.name = pickT(t.name, n.name); n.what = pickT(t.what, n.what); } });
    if (T.route) D.route = { ...D.route, why: Object.fromEntries(Object.entries(D.route.why || {}).map(([k, v]) => [k, pickT(T.route.why[k], v)])), note: pickT(T.route.note, D.route.note) };
    if (D.checked) D.checked = D.checked.map((c, k) => { const tc = (T.checked || [])[k] || { fixes: [] }; return { ...c, verdict: pickT(tc.verdict, c.verdict), fixes: c.fixes.map((f, i) => ({ ...f, text: pickT(tc.fixes[i], f.text) })) }; });
    if (D.checks) D.checks = { ...D.checks, verdict: pickT(T.verdict, D.checks.verdict), fixes: (D.checks.fixes || []).map((f, i) => ({ ...f, text: pickT((T.fixes || [])[i], f.text), translated: !!(T.fixes || [])[i] })), notes: (D.checks.notes || []).map((n, i) => pickT((T.notes || [])[i], n)) };
    return D;
  }
  async function translateMap(sid, job, onlyRoute) {
    const M = maps[sid], L = curLang();
    if (!M || !needsTr(M)) return;
    const T = onlyRoute && M.tr && M.tr[L] ? clone(M.tr[L]) : {};
    await trPairs(job, onlyRoute ? routePairs(M, T) : mapPairs(M, T), subjectAbout("a knowledge map: the names and descriptions of its areas, topics and points, where topics are taught, and notes on how it was built"), srcOf(M));
    M.tr = Object.assign({}, M.tr, { [L]: T });
  }

  function lessonPairs(doc, T) {
    const P = [], p = doc.plan;
    T.plan = { sections: [], goals: [] }; T.notes = []; T.advice = [];
    [["aim"], ["approach"], ["beyond"], ["goal_link"]].forEach(([k]) => P.push([p[k], (v) => { T.plan[k] = v; }]));
    (p.goals || []).forEach((g, i) => P.push([g, (v) => { T.plan.goals[i] = v; }]));
    P.push([doc.reading, (v) => { T.reading = v; }]);
    (p.sections || []).forEach((s, i) => { T.plan.sections[i] = {}; P.push([s.title, (v) => { T.plan.sections[i].title = v; }]); P.push([s.teach, (v) => { T.plan.sections[i].teach = v; }]); });
    P.push([doc.lesson, (v) => { T.lesson = v; }]);
    P.push([doc.deeper, (v) => { T.deeper = v; }]);
    doc.notes.forEach((n, i) => P.push([n, (v) => { T.notes[i] = v; }]));
    (doc.advice || []).forEach((a, i) => P.push([a.problem, (v) => { T.advice[i] = v; }]));
    return P;
  }
  function lessonView(doc) {
    const T = trOf(doc);
    if (!T) return doc;
    const p = doc.plan;
    return { ...doc,
      reading: pickT(T.reading, doc.reading),
      plan: { ...p, aim: pickT(T.plan.aim, p.aim), approach: pickT(T.plan.approach, p.approach), beyond: pickT(T.plan.beyond, p.beyond), goal_link: pickT(T.plan.goal_link, p.goal_link),
        goals: p.goals ? p.goals.map((g, i) => pickT((T.plan.goals || [])[i], g)) : p.goals,
        sections: (p.sections || []).length === 0 ? p.sections : p.sections.map((s, i) => ({ ...s, title: pickT((T.plan.sections[i] || {}).title, s.title), teach: pickT((T.plan.sections[i] || {}).teach, s.teach) })) },
      lesson: pickT(T.lesson, doc.lesson), deeper: pickT(T.deeper, doc.deeper),
      notes: doc.notes.map((n, i) => pickT(T.notes[i], n)), advice: (doc.advice || []).map((a, i) => ({ ...a, problem: pickT(T.advice[i], a.problem) })) };
  }

  function practicePairs(S, T) {
    const P = [];
    T.how = []; T.advice = []; T.dropped = []; T.exercises = [];
    P.push([S.when, (v) => { T.when = v; }]);
    (S.how || []).forEach((x, i) => P.push([x, (v) => { T.how[i] = v; }]));
    (S.advice || []).forEach((x, i) => P.push([x, (v) => { T.advice[i] = v; }]));
    (S.dropped || []).forEach((x, i) => P.push([x, (v) => { T.dropped[i] = v; }]));
    S.exercises.forEach((x, i) => {
      const t = T.exercises[i] = { combines: [], hints: [], criteria: [] };
      ["title", "level", "task", "thinking"].forEach((k) => P.push([x[k], (v) => { t[k] = v; }]));
      if (!x.tests) P.push([x.solution, (v) => { t.solution = v; }]);
      (x.combines || []).forEach((c, j) => P.push([c, (v) => { t.combines[j] = v; }]));
      (x.hints || []).forEach((c, j) => P.push([c, (v) => { t.hints[j] = v; }]));
      (x.criteria || []).forEach((c, j) => P.push([c, (v) => { t.criteria[j] = v; }]));
    });
    return P;
  }
  function practiceView(S) {
    const T = trOf(S);
    if (!T) return S;
    const arr = (a, t) => (a || []).map((x, i) => pickT((t || [])[i], x));
    return { ...S, when: pickT(T.when, S.when), how: arr(S.how, T.how), advice: arr(S.advice, T.advice), dropped: arr(S.dropped, T.dropped),
      exercises: S.exercises.map((x, i) => { const t = T.exercises[i] || {};
        return { ...x, title: pickT(t.title, x.title), level: pickT(t.level, x.level), task: pickT(t.task, x.task), thinking: pickT(t.thinking, x.thinking),
          solution: x.tests ? x.solution : pickT(t.solution, x.solution), combines: arr(x.combines, t.combines), hints: arr(x.hints, t.hints), criteria: x.criteria ? arr(x.criteria, t.criteria) : x.criteria }; }) };
  }
  // translates any small record in place: `fields` are string fields, `lists` are arrays of strings
  async function translateRecord(job, rec, fields, lists, about) {
    const L = curLang();
    if (!rec || !needsTr(rec)) return;
    const T = {};
    const P = [];
    fields.forEach((k) => P.push([rec[k], (v) => { T[k] = v; }]));
    lists.forEach((k) => { T[k] = []; (rec[k] || []).forEach((x, i) => P.push([x, (v) => { T[k][i] = v; }])); });
    await trPairs(job, P, about, srcOf(rec));
    rec.tr = Object.assign({}, rec.tr, { [L]: T });
  }
  function recordView(rec, fields, lists) {
    const T = trOf(rec);
    if (!T) return rec;
    const V = { ...rec };
    fields.forEach((k) => { V[k] = pickT(T[k], rec[k]); });
    lists.forEach((k) => { V[k] = (rec[k] || []).map((x, i) => pickT((T[k] || [])[i], x)); });
    return V;
  }
  // the switch between the translation and the English original, shown where translated content appears
  const origLabel = (item) => (showOrigFlag ? "Show the translation" : srcOf(item) === "en" ? "Show the English original" : "Show the Chinese original");
  function origSwitch(item) {
    if (!needsTr(item) || !item.tr || !item.tr[curLang()]) return null;
    return h("button", { class: "link small orig-switch", type: "button", onclick: () => setShowOrig(!showOrigFlag) }, origLabel(item));
  }
  // content shown in a language it wasn't written in is translated the first time it is shown, once per page load;
  // if that fails, the learner can ask again
  async function autoTranslate(key, fn) {
    if (!aiReady() || ui.autoTr[key] === "running" || ui.autoTr[key] === "done") return;
    ui.autoTr[key] = "running";
    setTimeout(() => render(), 0);
    try { await fn({ requests: 0, cancel: false }); ui.autoTr[key] = "done"; }
    catch (e) { ui.autoTr[key] = "failed"; ui.autoTrErr = noteAiError(e); }
    render();
  }
  // the line where translated content appears: starts the translation if it is needed, and says what is happening
  function trLine(key, item, fn) {
    if (!needsTr(item) || showOrigFlag) return origSwitch(item);
    if (item.tr && item.tr[curLang()]) return origSwitch(item);
    const st = ui.autoTr[key];
    if (!st && aiReady()) autoTranslate(key, fn);
    if (st === "failed" || !aiReady()) return h("p", { class: "small muted" }, srcOf(item) === "en" ? "This is in English: it couldn't be translated. " : "This is in Chinese: it couldn't be translated. ",
      aiReady() ? h("button", { class: "link", type: "button", onclick: () => { ui.autoTr[key] = null; render(); } }, "Translate it") : null);
    return h("p", { class: "small muted thinking" }, "Translating into your language…");
  }
  // run a translation as its own small job, for content that was delivered untranslated
  // notes on the map: every point's notes that need it, translated together
  function notesTrFn() {
    return async (job) => {
      const s = cur(), L = curLang();
      if (!s) return;
      const todo = Object.entries(s.pointIndex || {}).filter(([, e]) => needsTr(e) && (e.notes || []).length && !(e.tr && e.tr[L]));
      if (!todo.length) return;
      const P = [], out = {};
      todo.forEach(([pid, e]) => { out[pid] = []; e.notes.forEach((x, i) => P.push([x, (v) => { out[pid][i] = v; }])); });
      await trPairs(job, P, subjectAbout("a learner's notes on the points they studied"), srcOf(todo[0][1]));
      todo.forEach(([pid, e]) => { e.tr = Object.assign({}, e.tr, { [L]: out[pid] }); });
      saveSubject();
    };
  }
  const notesNeedTr = () => { const s = cur(); return !!s && !showOrigFlag && Object.values(s.pointIndex || {}).some((e) => needsTr(e) && (e.notes || []).length && !(e.tr && e.tr[curLang()])); };

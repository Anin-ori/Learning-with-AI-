  // ---------- State (v2.0) ----------
  // The learner can study several subjects. Each subject has its own AI-built map and its own progress:
  //   app2/index           which subject is open, and their order
  //   subjects/<sid>       one subject's progress (goal, learned points, lesson index, practice, level check, guidance)
  //   maps/<sid>           one subject's map, written once when the AI builds it
  //   lessons2/<sid>_<pid> a point's lesson;  qa2/<sid> the questions asked per point;  practice2/<id> a practice set
  // v1.18's documents (state/current, points/*, qa/all, practice/*) are left as they were.
  const TIERS = [{ id: "quick", name: "Fast" }, { id: "default", name: "Standard" }, { id: "complex", name: "Most capable" }];
  const freshApp = () => ({ v: 2, current: null, order: [] });
  const freshSubject = (sid, f) => ({
    v: 2, sid, name: f.name, goal: f.goal || "", situation: f.situation || "", created: new Date().toISOString(),
    built: false, learned: [], flash: true, pointIndex: {}, learnPoint: null,
    practice: [], practiceReady: null, practiceCurrent: null, grade: null, trial: null, trialTasks: null, updatedAt: null,
  });
  let app = freshApp();
  const subjects = {};
  const maps = {};
  const cur = () => (app.current && subjects[app.current]) || null;
  const curMap = () => (app.current && maps[app.current]) || null;
  const ui = {
    step: "subjects", view: "path", busy: {}, errors: {},
    chat: [], chatKey: null, chatInput: "", showLog: false, note: "", confirmReset: false,
    plessons: {}, pjobs: {}, qa: {}, noteHide: false, noteRevealed: {},
    build: null, form: { name: "", goal: "", situation: "" }, confirmDelete: null, trialAnswers: {}, tierResults: {},
  };
  let log = [];
  let sample = null;
  let db = null;
  let aiBlocked = false;

  const $ = (id) => document.getElementById(id);
  const main = $("main");

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "value") el.value = v;
        else if (k === "checked") el.checked = !!v;
        else if (k === "disabled") el.disabled = !!v;
        else if (k === "hidden") el.hidden = !!v;
        else if (k === "open") el.open = !!v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  }
  const extLink = (href, text) => h("a", { href, target: "_blank", rel: "noopener" }, text);
  // text the AI wrote (map names, descriptions) is marked so the interface translator leaves it alone
  const ai = (tag, props, ...kids) => h(tag, Object.assign({ "data-ai": "" }, props || {}), ...kids);

  // ---------- Notifications: every submission gets a visible result ----------
  function notify(text, kind = "ok", group) {
    const box = $("toasts");
    if (!box || !text) return;
    if (group) box.querySelectorAll("[data-group=\"" + group + "\"]").forEach((x) => x.remove());
    const icon = { ok: "✓", warn: "!", bad: "×" }[kind] || "✓";
    const el = h("div", { class: "toast " + kind, role: kind === "bad" ? "alert" : "status" },
      h("span", { class: "toast-icon", "aria-hidden": "true" }, icon),
      h("span", { class: "toast-text" }, String(text)),
      h("button", { class: "toast-close", type: "button", "aria-label": "Dismiss", onclick: () => el.remove() }, "×"));
    if (group) el.dataset.group = group;
    box.append(el);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => el.remove(), kind === "bad" ? 12000 : 7000);
  }
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pstr = (x) => (typeof x === "string" ? x.trim() : "");
  const parr = (x) => (Array.isArray(x) ? x : []);
  const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Persistence and test log ----------
  const setSave = (text) => { $("save-status").textContent = text; };
  let saveQueue = Promise.resolve();
  let logQueue = Promise.resolve();
  function queueSave(path, body) {
    if (!db) return;
    setSave("Saving…");
    saveQueue = saveQueue.then(() => db.doc(path).set(body)).then(() => setSave("Progress saved"), () => setSave("Progress not saved in this view"));
  }
  const saveApp = () => queueSave("app2/index", clone(app));
  function saveSubject(sid) {
    const s = subjects[sid || app.current];
    if (!s) return;
    s.updatedAt = new Date().toISOString();
    queueSave("subjects/" + s.sid, clone(s));
  }
  function saveState() { saveApp(); saveSubject(); }
  function saveMap(sid) { if (maps[sid]) queueSave("maps/" + sid, clone(maps[sid])); }
  function logEvent(type, text) {
    log.push({ at: new Date().toISOString(), type, text: String(text).slice(0, 900) });
    if (log.length > 300) log = log.slice(-300);
    renderLog();
    if (!db) return;
    const body = { events: log.slice() };
    logQueue = logQueue.then(() => db.doc("logs/main").set(body)).catch(() => {});
  }

  // ---------- Claude calls ----------
  const AI_COPY = {
    not_granted: "Asking Claude isn't allowed on this page. Allow it in the artifact's permissions to use the AI steps.",
    sampling_disabled: "Claude isn't available for this account.",
    not_declared: "This page can no longer ask Claude.",
    capability_disabled: "Asking Claude isn't available in this view.",
    capability_removed: "This Claude app is too old for this page. Update it and try again.",
    rate_limited: "You've hit a usage or rate limit. Wait a while, then try again.",
    session_expired: "Your session expired. Sign in again, then try again.",
    refused: "Claude declined this request. Try rephrasing it.",
    empty_completion: "No answer came back. Try asking for less at once.",
    invalid_json: "The answer came back in a form the page couldn't read. Try again.",
    prompt_too_large: "That's too much text at once. Shorten it and try again.",
    cancelled: "Stopped.",
    truncated: "The answer was cut off before it finished, even after a retry.",
  };
  const BLOCKING = new Set(["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"]);
  function noteAiError(e) {
    const text = AI_COPY[e && e.code] || "The connection dropped. Try again.";
    if (e && BLOCKING.has(e.code)) { aiBlocked = true; $("ai-banner").hidden = false; $("ai-banner").textContent = text; }
    return text;
  }
  const aiReady = () => !!sample && !aiBlocked;

  // Requests go through a small pool so a job never fires more than TEAM_LIMIT at once.
  const TEAM_LIMIT = 4;
  let teamActive = 0;
  const teamWaiting = [];
  async function teamSlot(fn) {
    while (teamActive >= TEAM_LIMIT) await new Promise((r) => teamWaiting.push(r));
    teamActive++;
    try { return await fn(); } finally { teamActive--; const next = teamWaiting.shift(); if (next) next(); }
  }
  function stripFence(t) {
    const m = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
    return m ? m[1].trim() : t;
  }
  // One agent request: counted, retried once, and labelled so a failure says which agent failed.
  async function ask(job, agent, prompt, tier, json) {
    for (let attempt = 0; ; attempt++) {
      if (job.cancel) throw { code: "cancelled", agent };
      job.requests++;
      if (job.paint) job.paint();
      try {
        const res = await teamSlot(() => (json ? sample.json(prompt, { modelTier: tier, cache: false }) : sample(prompt, { modelTier: tier, cache: false })));
        if (job.cancel) throw { code: "cancelled" };
        if (json) {
          if (!res || typeof res !== "object") throw { code: "invalid_json" };
          return res;
        }
        const text = String((res && res.text) || "").trim();
        if (!text) throw { code: "empty_completion" };
        if (res.truncated) throw { code: "truncated" };
        return stripFence(text);
      } catch (e) {
        const code = (e && e.code) || "network";
        if (code === "cancelled" || BLOCKING.has(code) || attempt >= 1) throw { code, agent };
        await sleep(code === "rate_limited" ? 20000 : 2500);
      }
    }
  }
  const jobError = (e) => (e && e.code === "cancelled" ? "Stopped." : (e && e.agent ? e.agent + ": " : "") + noteAiError(e));

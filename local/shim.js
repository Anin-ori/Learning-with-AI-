// Learning Companion, local stopgap version (not the official release).
// The official page runs inside Claude, which gives it window.claude.use("sample") for AI and use("db") for saving.
// Here this file provides the same two things: AI through the learner's own API key, and saving to this computer.
// With server.py (the usual way) progress is kept as files in the local "data" folder and the key stays in config.json;
// opened as a plain file, it falls back to this browser's storage and calls the API directly.
(() => {
  "use strict";
  const zh = (() => {
    const pick = (x) => (x === "zh" || x === "en" ? x : null);
    let l = null;
    try { l = pick(new URLSearchParams(location.hash.slice(1)).get("lang")); } catch (_) {}
    if (!l) { try { l = pick(localStorage.getItem("lc-lang")); } catch (_) {} }
    return (l || (/^zh/i.test(navigator.language || "") ? "zh" : "en")) === "zh";
  })();
  const T = (en, z) => (zh ? z : en);
  const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}\/[A-Za-z0-9_\-.~:@+]{1,200}$/;
  const PRESETS = {
    anthropic: { provider: "anthropic", baseUrl: "", models: { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" }, maxTokens: 16000 },
    deepseek: { provider: "openai", baseUrl: "https://api.deepseek.com", models: { quick: "deepseek-chat", default: "deepseek-chat", complex: "deepseek-chat" }, maxTokens: 8000 },
    openai: { provider: "openai", baseUrl: "https://api.openai.com/v1", models: { quick: "", default: "", complex: "" }, maxTokens: 16000 },
    openrouter: { provider: "openai", baseUrl: "https://openrouter.ai/api/v1", models: { quick: "", default: "", complex: "" }, maxTokens: 16000 },
    ollama: { provider: "openai", baseUrl: "http://localhost:11434/v1", models: { quick: "", default: "", complex: "" }, maxTokens: 8000 },
  };

  // ---------- where things are kept ----------
  let mode = null;   // "server" (server.py) or "browser" (opened as a file)
  const ready = (async () => {
    if (location.protocol.startsWith("http")) {
      try { const r = await fetch("/api/ping", { cache: "no-store" }); if (r.ok) { mode = "server"; return; } } catch (_) {}
    }
    mode = "browser";
  })();

  let idb = null;
  const openIdb = () => idb || (idb = new Promise((res, rej) => {
    const r = indexedDB.open("learning-companion-local", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("docs");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const idbDo = async (how, fn) => {
    const d = await openIdb();
    return new Promise((res, rej) => {
      const tx = d.transaction("docs", how), st = tx.objectStore("docs");
      let out;
      Promise.resolve(fn(st)).then((req) => { if (req) req.onsuccess = () => { out = req.result; }; });
      tx.oncomplete = () => res(out);
      tx.onerror = () => rej(tx.error);
    });
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const store = {
    async get(path) {
      await ready;
      if (mode === "server") {
        const r = await fetch("/api/doc/" + path, { cache: "no-store" });
        if (!r.ok) throw new Error("read failed");
        const j = await r.json();
        return j.exists ? j.data : undefined;
      }
      return idbDo("readonly", (st) => st.get(path));
    },
    async set(path, body) {
      await ready;
      if (mode === "server") {
        const r = await fetch("/api/doc/" + path, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error("save failed");
        return;
      }
      await idbDo("readwrite", (st) => st.put(clone(body), path));
    },
    async del(path) {
      await ready;
      if (mode === "server") { await fetch("/api/doc/" + path, { method: "DELETE" }); return; }
      await idbDo("readwrite", (st) => st.delete(path));
    },
    async all() {
      await ready;
      if (mode === "server") { const r = await fetch("/api/export", { cache: "no-store" }); return (await r.json()).docs || {}; }
      const docs = {};
      await idbDo("readonly", (st) => {
        const req = st.openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { docs[c.key] = c.value; c.continue(); } };
      });
      return docs;
    },
    async replaceAll(docs) {
      await ready;
      if (mode === "server") {
        const r = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ docs }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j.error && j.error.message) || "import failed");
        return j;
      }
      await idbDo("readwrite", (st) => { st.clear(); Object.keys(docs).forEach((k) => st.put(docs[k], k)); });
      return { ok: true, count: Object.keys(docs).length };
    },
  };
  const db = {
    doc(path) {
      const ok = SEG.test(path);
      return {
        get: async () => {
          if (!ok) throw new Error("bad path " + path);
          const v = await store.get(path);
          return { exists: v !== undefined, id: path.split("/")[1], data: () => (v === undefined ? undefined : clone(v)) };
        },
        set: async (body) => { if (!ok) throw new Error("bad path " + path); await store.set(path, body); },
        delete: async () => { if (ok) await store.del(path); },
      };
    },
  };

  // ---------- settings ----------
  const LS = "lc-local-settings";
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (_) { return null; } };
  async function getSettings() {
    await ready;
    if (mode === "server") { const r = await fetch("/api/settings", { cache: "no-store" }); return r.json(); }
    const s = Object.assign(clone(PRESETS.anthropic), readLocal() || {});
    s.hasKey = !!s.apiKey;
    return s;
  }
  async function saveSettings(s) {
    await ready;
    if (mode === "server") {
      const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      return r.json();
    }
    const prev = readLocal() || {};
    const next = Object.assign(clone(PRESETS.anthropic), prev, s);
    if (!s.apiKey) next.apiKey = s.clearKey ? "" : prev.apiKey || "";
    delete next.clearKey; delete next.hasKey;
    try { localStorage.setItem(LS, JSON.stringify(next)); } catch (_) {}
    return Object.assign({}, next, { hasKey: !!next.apiKey });
  }

  // ---------- AI ----------
  const fail = (code, message) => { const e = { code, message }; showError(message || code); return e; };
  async function complete(messages, tier) {
    await ready;
    if (mode === "server") {
      let r;
      try { r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, tier }) }); }
      catch (_) { throw fail("network", T("The local server isn't running. Start it again with the start file.", "本地服务没有在运行。请用启动文件重新启动。")); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw fail((j.error && j.error.code) || "network", (j.error && j.error.message) || "HTTP " + r.status);
      return j;
    }
    const s = Object.assign(clone(PRESETS.anthropic), readLocal() || {});
    const model = (s.models && (s.models[tier] || s.models.default)) || "";
    if (!s.apiKey && !(s.provider === "openai" && /^http:\/\//.test(s.baseUrl))) throw fail("no_key", T("No API key is set. Open Local settings and add one.", "还没有设置 API 密钥。请打开“本地设置”填写。"));
    let url, headers, body;
    if (s.provider === "anthropic") {
      url = (s.baseUrl || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";
      headers = { "x-api-key": s.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "anthropic-dangerous-direct-browser-access": "true" };
    } else {
      url = (s.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "") + "/chat/completions";
      headers = { "content-type": "application/json" };
      if (s.apiKey) headers.authorization = "Bearer " + s.apiKey;
    }
    body = { model, max_tokens: +s.maxTokens || 8000, messages };
    let r;
    try { r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) }); }
    catch (_) { throw fail("network", T("The API couldn't be reached from the browser. Run the local server (start file) instead of opening the page directly.", "浏览器无法直接连到这个 API。请用启动文件运行本地服务，而不是直接打开网页文件。")); }
    const text = await r.text();
    if (!r.ok) {
      const low = text.toLowerCase();
      const code = r.status === 429 ? "rate_limited" : r.status === 401 || r.status === 403 ? "bad_key" : /too long|context|too large/.test(low) ? "prompt_too_large" : "network";
      throw fail(code, "The API answered " + r.status + ": " + text.slice(0, 400));
    }
    const res = JSON.parse(text);
    if (s.provider === "anthropic") return { text: (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join(""), truncated: res.stop_reason === "max_tokens" };
    const c = (res.choices || [])[0] || {};
    return { text: (c.message && c.message.content) || "", truncated: c.finish_reason === "length" };
  }
  const toMessages = (p) => typeof p === "string" ? [{ role: "user", content: p }]
    : (Array.isArray(p) ? p : []).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content == null ? "" : m.content) }));
  function parseJson(text) {
    let t = String(text || "").trim().replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/, "").trim();
    try { return JSON.parse(t); } catch (_) {}
    const a = t.search(/[{[]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
    throw { code: "invalid_json" };
  }
  async function sample(prompt, opts) {
    const o = opts || {};
    const res = await complete(toMessages(prompt), o.modelTier || "default");
    if (typeof o.onText === "function") { try { o.onText({ text: res.text }); } catch (_) {} }
    return { text: res.text, truncated: !!res.truncated };
  }
  sample.json = async (prompt, opts) => {
    const o = opts || {};
    const msgs = toMessages(prompt);
    const last = msgs[msgs.length - 1];
    if (last) last.content += "\n\nReply with the JSON only: no Markdown fences and no text before or after it.";
    const res = await complete(msgs, o.modelTier || "default");
    if (res.truncated) throw { code: "truncated" };
    return parseJson(res.text);
  };

  window.claude = Object.assign(window.claude || {}, {
    use: async (name) => (name === "sample" ? sample : name === "db" ? db : null),
  });

  // ---------- the Local panel: settings, export, import ----------
  const css = `
  #lc-local-btn{font:inherit;font-size:.82rem;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:var(--fg,#222);border-radius:999px;padding:.25rem .7rem;cursor:pointer;margin-left:.5rem}
  #lc-local-btn:hover{border-color:var(--accent,#b4552f)}
  #lc-local{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.35);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px;overflow:auto}
  #lc-local[hidden]{display:none}
  #lc-local .box{background:var(--surface,#fff);color:var(--fg,#222);border:1px solid var(--line,#ddd);border-radius:14px;max-width:560px;width:100%;padding:1.2rem 1.3rem;box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:.92rem}
  #lc-local h2{margin:0 0 .2rem;font-size:1.15rem}
  #lc-local h3{margin:1.1rem 0 .4rem;font-size:.95rem}
  #lc-local p{margin:.3rem 0;color:var(--muted,#666)}
  #lc-local label{display:block;margin:.45rem 0 .15rem;font-size:.82rem;color:var(--muted,#666)}
  #lc-local input,#lc-local select{width:100%;box-sizing:border-box;font:inherit;padding:.4rem .5rem;border:1px solid var(--line,#ccc);border-radius:8px;background:var(--bg,#fff);color:var(--fg,#222)}
  #lc-local .row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem}
  #lc-local .acts{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.7rem}
  #lc-local button{font:inherit;border-radius:8px;padding:.4rem .8rem;border:1px solid var(--line,#ccc);background:var(--bg,#f5f5f5);color:var(--fg,#222);cursor:pointer}
  #lc-local button.main{background:var(--accent,#b4552f);border-color:var(--accent,#b4552f);color:var(--accent-ink,#fff)}
  #lc-local .msg{min-height:1.2em;margin-top:.5rem;font-size:.85rem}
  #lc-local .tag{display:inline-block;font-size:.75rem;padding:.1rem .45rem;border-radius:6px;background:var(--warn-bg,#f5e9cd);color:var(--warn,#93650f);margin-left:.4rem;vertical-align:middle}
  #lc-local-err{position:fixed;left:16px;right:16px;bottom:16px;z-index:9998;max-width:640px;margin:0 auto;background:var(--bad-bg,#f6e0da);color:var(--bad,#ad3a2c);border:1px solid var(--bad,#ad3a2c);border-radius:10px;padding:.6rem .8rem;font-size:.85rem;display:flex;gap:.6rem;align-items:flex-start}
  #lc-local-err[hidden]{display:none}
  #lc-local-err span{flex:1;word-break:break-word}
  #lc-local-err button{font:inherit;border:0;background:none;color:inherit;cursor:pointer}
  @media (max-width:520px){#lc-local .row{grid-template-columns:1fr}}`;
  let errTimer = null;
  function showError(text) {
    const el = document.getElementById("lc-local-err");
    if (!el) return;
    el.querySelector("span").textContent = T("AI request failed: ", "AI 请求失败：") + text;
    el.hidden = false;
    clearTimeout(errTimer); errTimer = setTimeout(() => { el.hidden = true; }, 15000);
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function mount() {
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const err = document.createElement("div"); err.id = "lc-local-err"; err.hidden = true; err.setAttribute("role", "alert");
    err.innerHTML = "<span></span><button type='button' aria-label='Close'>×</button>";
    err.querySelector("button").onclick = () => { err.hidden = true; };
    document.body.appendChild(err);
    const btn = document.createElement("button"); btn.id = "lc-local-btn"; btn.type = "button"; btn.textContent = T("Local settings", "本地设置");
    const right = document.querySelector(".topbar-right");
    if (right) right.appendChild(btn); else { btn.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9997"; document.body.appendChild(btn); }
    const ov = document.createElement("div"); ov.id = "lc-local"; ov.hidden = true;
    document.body.appendChild(ov);
    btn.onclick = open;
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") ov.hidden = true; });
    ready.then(() => getSettings()).then((s) => { if (!s.hasKey && !(s.provider === "openai" && /^http:\/\//.test(s.baseUrl || ""))) open(); }).catch(() => {});
  }

  async function open() {
    const ov = document.getElementById("lc-local");
    const s = await getSettings().catch(() => clone(PRESETS.anthropic));
    const m = s.models || {};
    const where = mode === "server"
      ? T("Progress is saved as files in the “data” folder next to server.py. Your key stays in config.json there.", "学习进度以文件形式保存在 server.py 旁边的 data 文件夹里，密钥保存在同一处的 config.json。")
      : T("Opened directly as a file: progress is saved in this browser only, and some APIs refuse calls from a browser. Running the start file is more reliable.", "当前是直接打开的网页文件：进度只保存在这个浏览器里，有些 API 也不接受浏览器直接调用。用启动文件运行更可靠。");
    ov.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="lc-local-title">
      <h2 id="lc-local-title">${T("Local version", "本地版")}<span class="tag">${T("temporary", "临时")}</span></h2>
      <p>${T("A stopgap for when the Claude quota runs out. The version on claude.ai stays the standard one.", "Claude 额度用完时的临时替代。claude.ai 上的版本仍是正式版。")}</p>
      <p>${where}</p>
      <h3>${T("AI", "AI 接口")}</h3>
      <label for="lc-preset">${T("Service", "服务")}</label>
      <select id="lc-preset">
        <option value="">${T("— fill in from a preset —", "— 从预设填入 —")}</option>
        <option value="anthropic">Anthropic (Claude API)</option>
        <option value="deepseek">DeepSeek</option>
        <option value="openai">OpenAI</option>
        <option value="openrouter">OpenRouter</option>
        <option value="ollama">Ollama (${T("on this computer", "本机")})</option>
      </select>
      <label for="lc-provider">${T("API type", "接口类型")}</label>
      <select id="lc-provider"><option value="anthropic">Anthropic Messages</option><option value="openai">${T("OpenAI-compatible (chat/completions)", "OpenAI 兼容（chat/completions）")}</option></select>
      <label for="lc-base">${T("Address (leave empty for the usual one)", "接口地址（留空则用默认地址）")}</label>
      <input id="lc-base" value="${esc(s.baseUrl)}" placeholder="https://…">
      <label for="lc-key">${T("API key", "API 密钥")} ${s.hasKey ? T("(saved; leave empty to keep it)", "（已保存；留空则保持不变）") : ""}</label>
      <input id="lc-key" type="password" autocomplete="off" placeholder="${s.hasKey ? "••••••••" : "sk-…"}">
      <label>${T("Models: fast / standard / most capable", "模型：快速 / 标准 / 最强")}</label>
      <div class="row"><input id="lc-m-quick" value="${esc(m.quick)}" aria-label="fast"><input id="lc-m-default" value="${esc(m.default)}" aria-label="standard"><input id="lc-m-complex" value="${esc(m.complex)}" aria-label="most capable"></div>
      <label for="lc-max">${T("Longest answer (tokens)", "单次回答上限（tokens）")}</label>
      <input id="lc-max" type="number" min="1000" step="1000" value="${esc(s.maxTokens || 8000)}">
      <div class="acts"><button type="button" class="main" id="lc-save">${T("Save", "保存")}</button>${s.hasKey ? `<button type="button" id="lc-clear">${T("Remove key", "删除密钥")}</button>` : ""}<button type="button" id="lc-close">${T("Close", "关闭")}</button></div>
      <h3>${T("Learning progress", "学习进度")}</h3>
      <p>${T("Export saves everything (subjects, maps, lessons, notes, questions) in one file. Import replaces what is here with a file's contents.", "导出会把全部内容（科目、地图、课程、笔记、练习题）存成一个文件。导入会用文件内容替换这里现有的进度。")}</p>
      <div class="acts"><button type="button" id="lc-export">${T("Export progress", "导出进度")}</button><button type="button" id="lc-import">${T("Import progress…", "导入进度…")}</button><input id="lc-file" type="file" accept=".json,application/json" hidden></div>
      <div class="msg" id="lc-msg" aria-live="polite"></div>
    </div>`;
    ov.hidden = false;
    const $ = (id) => document.getElementById(id);
    $("lc-provider").value = s.provider || "anthropic";
    const say = (t) => { $("lc-msg").textContent = t; };
    $("lc-preset").onchange = () => {
      const p = PRESETS[$("lc-preset").value]; if (!p) return;
      $("lc-provider").value = p.provider; $("lc-base").value = p.baseUrl;
      $("lc-m-quick").value = p.models.quick; $("lc-m-default").value = p.models.default; $("lc-m-complex").value = p.models.complex;
      $("lc-max").value = p.maxTokens;
      if (!p.models.default) say(T("Fill in the model names this service offers.", "请填入这个服务提供的模型名称。"));
    };
    $("lc-close").onclick = () => { ov.hidden = true; };
    $("lc-save").onclick = async () => {
      const next = {
        provider: $("lc-provider").value, baseUrl: $("lc-base").value.trim(),
        models: { quick: $("lc-m-quick").value.trim(), default: $("lc-m-default").value.trim(), complex: $("lc-m-complex").value.trim() },
        maxTokens: Math.max(1000, +$("lc-max").value || 8000),
      };
      if (!next.models.default) { say(T("The standard model is needed.", "标准模型必须填写。")); return; }
      if (!next.models.quick) next.models.quick = next.models.default;
      if (!next.models.complex) next.models.complex = next.models.default;
      const key = $("lc-key").value.trim(); if (key) next.apiKey = key;
      try { await saveSettings(next); say(T("Saved.", "已保存。")); $("lc-key").value = ""; }
      catch (_) { say(T("Couldn't save.", "保存失败。")); }
    };
    if ($("lc-clear")) $("lc-clear").onclick = async () => { await saveSettings({ clearKey: true }); open(); };
    $("lc-export").onclick = async () => {
      try {
        const docs = await store.all();
        const file = { app: "learning-companion", format: 1, exportedAt: new Date().toISOString(), docs };
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
        a.download = "learning-progress-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        say(T("Exported " + Object.keys(docs).length + " records.", "已导出 " + Object.keys(docs).length + " 条记录。"));
      } catch (_) { say(T("Export failed.", "导出失败。")); }
    };
    $("lc-import").onclick = () => $("lc-file").click();
    $("lc-file").onchange = async () => {
      const f = $("lc-file").files[0]; if (!f) return;
      let file;
      try { file = JSON.parse(await f.text()); } catch (_) { say(T("That file isn't readable JSON.", "这个文件不是可读的 JSON。")); return; }
      const docs = file && file.docs;
      const keys = docs && typeof docs === "object" ? Object.keys(docs) : [];
      if (!keys.length || !keys.every((k) => SEG.test(k)) || !keys.includes("app2/index")) { say(T("That isn't a Learning Companion progress file.", "这不是学习伴侣的进度文件。")); return; }
      const n = keys.filter((k) => k.startsWith("subjects/")).length;
      if (!confirm(T("Replace the progress here with this file (" + n + " subjects, " + keys.length + " records)?", "用这个文件（" + n + " 个科目，" + keys.length + " 条记录）替换这里的进度吗？") + (mode === "server" ? T(" The current data folder is kept as a backup.", "现有的 data 文件夹会保留为备份。") : ""))) return;
      try { const r = await store.replaceAll(docs); say(T("Imported. Reloading…", "已导入，正在重新载入…")); if (r && r.backup) console.log("backup:", r.backup); setTimeout(() => location.reload(), 600); }
      catch (e) { say(T("Import failed: ", "导入失败：") + ((e && e.message) || "")); }
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();

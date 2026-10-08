  // ---------- Languages (v1.8; v2.0: map names are written by the AI in the learner's language) ----------
  // The page picks a language from the address (#lang=zh), then the learner's last choice, then the browser's language.
  // Interface text is translated where it is shown, from one table per language (i18n/<lang>.json); topic and point names
  // are written by the AI in the learner's language when the map is built. Lessons, notes, code, program input and output are never
  // touched here: in Chinese, the AI is asked to write them in Chinese instead.
  const I18N = (() => {
    const PACKS = { zh: /*@ZH@*/ };
    const pick = (v) => (v === "zh" || v === "en" ? v : null);
    let fromHash = null, stored = null;
    try { fromHash = pick(new URLSearchParams(location.hash.slice(1)).get("lang")); } catch (_) {}
    try { stored = pick(localStorage.getItem("lc-lang")); } catch (_) {}
    const browser = /^zh/i.test(navigator.language || "") ? "zh" : "en";
    const lang = fromHash || stored || browser;
    const P = lang === "en" ? null : PACKS[lang];
    const exact = P ? P.exact : {};
    const pats = P ? P.patterns.map(([re, to]) => [new RegExp("^" + re + "$"), to.replace(/\\(\d)/g, "$$$1")]) : [];
    const look = (s) => s.replace(/⟦([^⟧]*)⟧/g, (m, k) => (k in exact ? exact[k] : k));
    function t(str) {
      if (!P || !str) return str;
      const key = str.replace(/\s+/g, " ").trim();
      if (!key || !/[A-Za-z]/.test(key)) return str;
      let out = null;
      if (Object.prototype.hasOwnProperty.call(exact, key)) out = exact[key];
      else for (const [re, to] of pats) if (re.test(key)) { out = look(key.replace(re, to)); break; }
      if (out == null) return str;
      const lead = /^\s/.test(str) && !/^[，。：；、“（]/.test(out) ? " " : "", trail = /\s$/.test(str) ? " " : "";
      return lead + out + trail;
    }
    // text the learner or the AI wrote is left alone; the few controls inside a lesson (Copy, Output) are still translated
    const SKIP = ".lesson, .bubble-text, .note-points, .note-ex, code, pre, textarea, script, style, table.io td, [data-i18n-skip], [data-ai]";
    const ALLOW = ".copy, .out-label";
    const ATTR_SKIP = ".lesson, .bubble-text, [data-i18n-skip], [data-ai]";
    const ATTRS = ["placeholder", "aria-label", "title"];
    function textNode(n) {
      const p = n.parentElement; if (!p || (p.closest(SKIP) && !p.matches(ALLOW))) return;
      const v = n.nodeValue, w = t(v); if (w !== v) n.nodeValue = w;
    }
    function element(el) {
      if (el.closest && el.closest(ATTR_SKIP)) return;
      ATTRS.forEach((a) => { const v = el.getAttribute && el.getAttribute(a); if (v) { const w = t(v); if (w !== v) el.setAttribute(a, w); } });
    }
    function walk(root) {
      if (!P || !root) return;
      if (root.nodeType === 3) return textNode(root);
      if (root.nodeType !== 1) return;
      element(root);
      root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(element);
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode());) textNode(n);
    }
    function start() {
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
      if (!P) return;
      document.title = t(document.title);
      walk(document.body);
      new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "characterData") textNode(m.target);
          else if (m.type === "attributes") element(m.target);
          else m.addedNodes.forEach(walk);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    // label measures for the map: a CJK character is about as wide as its font size, about 1.9 Latin letters
    const isWide = (ch) => /[⺀-鿿＀-￯　-〿]/.test(ch);
    const units = (s) => [...s].reduce((n, ch) => n + (isWide(ch) ? 1.9 : 1), 0);
    const cjk = (s) => [...s].some(isWide);
    let seg = null;
    try { seg = new Intl.Segmenter("zh", { granularity: "word" }); } catch (_) {}
    function split(name) {
      if (units(name) <= 16) return [name];
      const chars = [...name];
      let cuts = new Set();  // character positions where a line may break: between words, never inside one
      if (seg) { let at = 0; for (const x of seg.segment(name)) { at += [...x.segment].length; cuts.add(at); } }
      else for (let i = 1; i < chars.length; i++) cuts.add(i);
      let best = null;
      for (let i = 2; i < chars.length - 1; i++) {
        if (!cuts.has(i)) continue;
        if (/[A-Za-z0-9_.(]/.test(chars[i - 1]) && /[A-Za-z0-9_.()*]/.test(chars[i])) continue;  // never inside a code word
        const a = chars.slice(0, i).join("").trim(), b = chars.slice(i).join("").trim();
        if (!a || !b || /^[，、：）)]/.test(b)) continue;
        const m = Math.max(units(a), units(b)) - (/[，、：]$/.test(a) ? 2.5 : 0) - (/^[与和及]/.test(b) ? 1.2 : 0) + (/^[的之]/.test(b) ? 3 : 0);
        if (!best || m < best[0]) best = [m, a, b];
      }
      return best ? [best[1], best[2]] : [name];
    }
    // the AI writes what the learner reads in the learner's language
    function wrapAI(s) {
      if (!s || !P || !P.prompt) return s;
      const add = (p) => typeof p === "string" ? p + "\n\n" + P.prompt
        : Array.isArray(p) ? p.map((m, i) => (i === 0 && m && typeof m.content === "string" ? { ...m, content: m.content + "\n\n" + P.prompt } : m)) : p;
      const w = (p, o) => s(add(p), o);
      Object.keys(s).forEach((k) => { w[k] = s[k]; });
      if (typeof s.json === "function") w.json = (p, o) => s.json(add(p), o);
      return w;
    }
    function set(next) {
      try { localStorage.setItem("lc-lang", next); } catch (_) {}
      const q = new URLSearchParams(location.hash.slice(1)); q.set("lang", next);
      location.hash = q.toString(); location.reload();
    }
    return { lang, t, start, cjk, units, split, wrapAI, set, prompt: P ? P.prompt : "" };
  })();
  I18N.start();
  { const lb = document.getElementById("lang-btn"); if (lb) { lb.textContent = I18N.lang === "zh" ? "EN" : "中文"; lb.onclick = () => I18N.set(I18N.lang === "zh" ? "en" : "zh"); } }

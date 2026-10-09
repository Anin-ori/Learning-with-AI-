  // ---------- Markdown (lessons, tasks, answers) ----------
  // Small, safe Markdown renderer for lessons: headings, paragraphs, lists (one level of nesting), tables,
  // code blocks (with output blocks shown as console output), block quotes, rules, inline code, bold, italics and links.
  function inline(text) {
    const nodes = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*?\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) nodes.push(text.slice(last, m.index));
      const t = m[0];
      if (t[0] === "`") nodes.push(h("code", null, t.slice(1, -1)));
      else if (t.startsWith("**")) nodes.push(h("strong", null, inline(t.slice(2, -2))));
      else if (t[0] === "*") nodes.push(h("em", null, inline(t.slice(1, -1))));
      else { const lm = t.match(/^\[([^\]]+)\]\((.+)\)$/); nodes.push(extLink(lm[2], lm[1])); }
      last = m.index + t.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }
  function codeBlock(code, kind) {
    const pre = h("pre", null, h("code", null, code));
    if (kind === "output") return h("div", { class: "code-wrap output" }, h("span", { class: "out-label" }, "Output"), pre);
    const btn = h("button", {
      class: "copy", type: "button",
      onclick: async (e) => {
        try { await navigator.clipboard.writeText(code); e.target.textContent = "Copied"; }
        catch (_) {
          const sel = window.getSelection(); const r = document.createRange();
          r.selectNodeContents(pre); sel.removeAllRanges(); sel.addRange(r); e.target.textContent = "Selected";
        }
      },
    }, "Copy");
    return h("div", { class: "code-wrap" }, btn, pre);
  }
  // Splits a table row on | outside inline code.
  function tableCells(line) {
    let t = line.trim();
    if (t.startsWith("|")) t = t.slice(1);
    if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1);
    const cells = [];
    let cur = "", code = false;
    for (const ch of t) {
      if (ch === "`") code = !code;
      if (ch === "|" && !code) { cells.push(cur.trim()); cur = ""; } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  }
  const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function md(src) {
    const out = [];
    const lines = String(src || "").replace(/\r/g, "").split("\n");
    let i = 0, list = null, listIndent = 0, para = [];
    const flushPara = () => { if (para.length) { out.push(h("p", null, inline(para.join(" ")))); para = []; } };
    const flushList = () => { if (list) { out.push(list); list = null; } };
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
      if (fence) {
        flushPara(); flushList();
        const code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { code.push(lines[i]); i++; }
        i++;
        const prev = out[out.length - 1];
        const isOutput = !fence[1] && prev && prev.tagName === "P" && /^(output|it prints|prints|result|输出|运行结果)\s*[:：]?$/i.test(prev.textContent.trim());
        if (isOutput) out.pop();
        out.push(codeBlock(code.join("\n"), isOutput || fence[1] === "text" || fence[1] === "output" ? "output" : null));
        continue;
      }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
        flushPara(); flushList();
        const head = tableCells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(tableCells(lines[i])); i++; }
        out.push(h("div", { class: "table-wrap" }, h("table", { class: "md" },
          h("thead", null, h("tr", null, head.map((c) => h("th", { scope: "col" }, inline(c))))),
          h("tbody", null, rows.map((r) => h("tr", null, head.map((_, j) => h("td", null, inline(r[j] || "")))))))));
        continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push(h("hr")); i++; continue; }
      const hd = line.match(/^(#{1,4})\s+(.*)$/);
      if (hd) { flushPara(); flushList(); out.push(h(hd[1].length <= 2 ? "h3" : "h4", null, inline(hd[2]))); i++; continue; }
      const bq = line.match(/^\s*>\s?(.*)$/);
      if (bq) {
        flushPara(); flushList();
        const q = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
        out.push(h("blockquote", null, inline(q.join(" "))));
        continue;
      }
      const li = line.match(/^(\s*)(?:[-*]|\d+[.)])\s+(.*)$/);
      if (li) {
        flushPara();
        const indent = li[1].replace(/\t/g, "    ").length;
        const ordered = /^\s*\d/.test(line);
        if (list && indent >= listIndent + 2 && list.lastElementChild) {
          const parent = list.lastElementChild;
          let sub = parent.lastElementChild && /^(UL|OL)$/.test(parent.lastElementChild.tagName) ? parent.lastElementChild : null;
          if (!sub) { sub = h(ordered ? "ol" : "ul"); parent.append(sub); }
          sub.append(h("li", null, inline(li[2])));
          i++; continue;
        }
        if (!list || (list.tagName === "OL") !== ordered) { flushList(); list = h(ordered ? "ol" : "ul"); listIndent = indent; }
        list.append(h("li", null, inline(li[2])));
        i++; continue;
      }
      if (!line.trim()) {
        flushPara();
        // a blank line inside a list keeps the list open when the next line continues it
        const next = lines.slice(i + 1).find((x) => x.trim());
        if (!(list && next && /^(\s*)(?:[-*]|\d+[.)])\s+/.test(next))) flushList();
        i++; continue;
      }
      if (list && /^\s{2,}\S/.test(line) && list.lastElementChild) { list.lastElementChild.append(" ", ...inline(line.trim())); i++; continue; }
      flushList(); para.push(line.trim()); i++;
    }
    flushPara(); flushList();
    return out;
  }


  // ---------- Notes: key terms can be hidden as blanks for self-testing ----------
  function noteInline(text, hide, keyBase) {
    const nodes = [];
    const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    const spans = [...text.matchAll(re)];
    const bold = spans.map((m, i) => (m[0][0] === "*" ? i : -1)).filter((i) => i >= 0);
    const toHide = new Set(bold.length ? bold : spans.length ? [0] : []);
    let last = 0;
    spans.forEach((m, n) => {
      if (m.index > last) nodes.push(text.slice(last, m.index));
      const t = m[0];
      const isCode = t[0] === "`";
      const inner = isCode ? t.slice(1, -1) : t.slice(2, -2);
      const shown = () => (isCode ? h("code", null, inner) : h("strong", null, inner));
      const key = keyBase + ":" + n;
      if (hide && toHide.has(n) && !ui.noteRevealed[key]) {
        const btn = h("button", {
          class: "note-blank" + (isCode ? " code" : ""), type: "button", "aria-label": "Hidden " + (isCode ? "code" : "term") + ", click to show",
          style: "min-width: " + Math.min(14, Math.max(2.5, inner.length * 0.62)) + "em",
          onclick: () => { ui.noteRevealed[key] = true; btn.replaceWith(h("span", { class: "revealed" }, shown())); },
        }, " ");
        nodes.push(btn);
      } else nodes.push(shown());
      last = m.index + t.length;
    });
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
  }
  const plainNote = (t) => t.replace(/\*\*/g, "");

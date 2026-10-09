// A mock of the claude.ai runtime for tests: a db kept in localStorage (so a reload keeps it) and a sample() that
// answers each kind of prompt the page sends with a fixed, plausible answer. ZH=1 answers in Chinese names.
module.exports = function mock(opts = {}) {
  const ZH = !!opts.zh;
  return `<script>
  window.__prompts = [];
  const KEY = "lc-mock-db";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
  const doc = (p) => ({
    get: async () => { const s = load(); return { exists: p in s, data: () => JSON.parse(JSON.stringify(s[p])) }; },
    set: async (v) => { const s = load(); s[p] = JSON.parse(JSON.stringify(v)); save(s); },
    delete: async () => { const s = load(); delete s[p]; save(s); },
  });
  const ZH = ${ZH}, DZ = false;   // agents work in English (v2.1); ZH only sets the language the tutor answers in
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // ---- the subjects the mock knows ----
  const PY = {
    subject: DZ ? "Python 编程" : "Python programming",
    run: "python",
    areas: DZ ? [
      ["起步", [["运行与输出", "如何运行程序并显示结果", ["运行 Python 程序", "print() 输出", "注释"]], ["值与变量", "程序里的数据", ["数字与运算", "变量与赋值", "字符串基础", "类型与转换"]]]],
      ["控制流程", [["条件", "让程序做选择", ["布尔值与比较", "if、elif、else", "and、or、not"]], ["循环", "重复执行", ["while 循环", "for 循环与 range()", "break 与 continue"]]]],
      ["组织代码", [["函数", "把代码打包复用", ["定义函数", "参数与返回值", "作用域"]], ["数据结构", "存放一组数据", ["列表", "字典", "遍历数据"]]]],
    ] : [
      ["Getting started", [["Running and printing", "How a program runs and shows results", ["Running a Python program", "print() output", "Comments"]], ["Values and variables", "The data a program works with", ["Numbers and arithmetic", "Variables and assignment", "String basics", "Types and conversion"]]]],
      ["Control flow", [["Conditions", "Making a program choose", ["Booleans and comparisons", "if, elif and else", "and, or, not"]], ["Loops", "Repeating work", ["while loops", "for loops and range()", "break and continue"]]]],
      ["Organising code", [["Functions", "Packaging code to reuse it", ["Defining functions", "Parameters and return values", "Scope"]], ["Data structures", "Holding many values", ["Lists", "Dictionaries", "Looping over data"]]]],
    ],
  };
  const MUSIC = {
    subject: DZ ? "乐理" : "Music theory",
    run: "none",
    areas: DZ ? [["基础", [["音高", "音的高低", ["音名", "升降号", "音程"]], ["节奏", "音的长短", ["拍子", "拍号"]]]], ["和声", [["和弦", "同时发声的音", ["三和弦", "和弦级数"]]]]]
      : [["Foundations", [["Pitch", "How high or low a note is", ["Note names", "Sharps and flats", "Intervals"]], ["Rhythm", "How long notes last", ["Beats", "Time signatures"]]]], ["Harmony", [["Chords", "Notes sounding together", ["Triads", "Chord functions"]]]]],
  };
  const pick = (p) => /Subject: (Music|乐理)/.test(p) ? MUSIC : PY;
  const profile = (S) => S.run === "python"
    ? { name: S.subject, trap: "t = (1, [2]); t[1] += [3] raises TypeError and still changes the list", slips: "a typo, a missing colon", observe: "type(), id() and the dis module", shallow: "\\"read two numbers and print their sum\\"", rich: "\\"read prices until a blank line and print the count, total and largest\\"", examples: "short runnable programs, each followed by its exact output", run: "python", format: "" }
    : { name: S.subject, trap: "a C major chord and an A minor chord share two notes, which explains why they can substitute for each other", slips: "a misremembered note name", observe: "play it on a keyboard and listen", shallow: "\\"name the notes of a C major triad\\"", rich: "\\"harmonise a four-bar melody and explain each chord choice\\"", examples: "notes written by name, with the sound described", run: "none", format: "A written answer: a few sentences or a short list of notes or chords." };
  // ---- the db's map, read back from prompts ----
  const pointsOf = (p) => { const out = []; let topic = null; p.split("\\n").forEach((l) => { const t = l.match(/^Topic (t\\d+):/); if (t) topic = t[1]; const m = l.match(/^  (p\\d+) \\| ([^|]+)/); if (m) out.push({ id: m[1], name: m[2].trim(), topic }); }); return out; };
  const sample = async (input, o) => {
    await wait(40);
    const text = Array.isArray(input) ? input.map((m) => m.content).join("\\n") : input;
    window.__prompts.push(text);
    if (Array.isArray(input)) {
      const a = ZH ? "这是导师的回答：变量是指向对象的名字。" : "Here is the tutor's answer: a variable is a name that refers to an object.";
      if (o && o.onText) o.onText({ text: a, delta: a });
      return { text: a, truncated: false };
    }
    if (text.startsWith("You write a lesson on ONE") || text.startsWith("You wrote the lesson below")) {
      const music = /Music|乐理/.test(text.slice(0, 300));
      if (${!!opts.badLesson} && text.startsWith("You write a lesson on ONE") && !music) return { text: "## A variable is a name\\n\\n\`\`\`python\\nx = 3\\nprint(x * 2)\\n\`\`\`\\n\\nOutput:\\n\\n\`\`\`\\n5\\n\`\`\`\\n\\n=== NOTES ===\\n- **x** names 3", truncated: false };
      const body = music
        ? (DZ ? "## 什么是音程\\n\\n音程是两个音之间的距离。\\n\\n## 例子\\n\\nC 到 E 是大三度。" : "## What an interval is\\n\\nAn interval is the distance between two notes.\\n\\n## An example\\n\\nC up to E is a major third: four semitones.")
        : (DZ ? "## 变量是名字\\n\\n变量是指向值的名字。\\n\\n\`\`\`python\\nx = 3\\nprint(x)\\n\`\`\`\\n\\nOutput:\\n\\n\`\`\`\\n3\\n\`\`\`" : "## A variable is a name\\n\\nA variable is a name that refers to a value.\\n\\n\`\`\`python\\nx = 3\\nprint(x)\\n\`\`\`\\n\\nOutput:\\n\\n\`\`\`\\n3\\n\`\`\`");
      return { text: body + "\\n\\n=== DEEPER ===\\n\\n### " + (DZ ? "底层" : "Underneath") + "\\n\\n" + (DZ ? "名字存放在命名空间里。" : "Names live in a namespace dictionary.") + "\\n\\n=== NOTES ===\\n- " + (DZ ? "**变量** 是名字，\`x = 3\` 让它指向 3" : "A **variable** is a name; \`x = 3\` makes it refer to 3") + "\\n- " + (DZ ? "\`print()\` 显示值" : "\`print()\` shows a value"), truncated: false };
    }
    if (text.startsWith("A learner studying")) return { text: ZH ? "变量是名字。" : "A variable is a name for a value.", truncated: false };
    return { text: "ok", truncated: false };
  };
  sample.json = async (text) => {
    await wait(60);
    window.__prompts.push(text);
    if (text.startsWith("You translate study material")) {
      window.__translations = (window.__translations || 0) + 1;
      const arr = JSON.parse(text.split("The strings, as a JSON array:\\n")[1].split("\\n\\nReply with only JSON")[0]);
      return { t: arr.map((x) => "译·" + x) };
    }
    if (text.startsWith("You are the master planner")) {
      const S = pick(text);
      return { subject: S.subject, scope: "Covers the foundations the goal needs; leaves out advanced topics such as concurrency.", profile: profile(S),
        parts: S.areas.map(([name, topics]) => ({ name, brief: "Covers " + topics.map((t) => t[0]).join(" and ") + "." })) };
    }
    if (text.startsWith("You plan one part of a knowledge map")) {
      const S = pick(text), part = (text.match(/^\\s*- (.+) \\(your part\\):/m) || [])[1];
      if (window.__failPlannerAt && (window.__planners || 0) + 1 === window.__failPlannerAt) { window.__failPlannerAt = 0; throw { code: "rate_limited" }; }
      window.__planners = (window.__planners || 0) + 1;
      const area = S.areas.find(([name]) => name === part);
      if (area && area[1].length > 1 && !/Write your part as one topic now/.test(text)) return { divide: area[1].map(([tn, desc]) => ({ name: tn, brief: desc })) };
      const all = S.areas.flatMap(([, ts]) => ts);
      const ti = all.findIndex(([tn]) => tn === part), t = ti >= 0 ? all[ti] : area[1][0];
      const prev = ti > 0 ? all[ti - 1][2][all[ti - 1][2].length - 1] : null;
      return { write: { desc: t[1], points: t[2].map((name, k) => ({ name, what: "Understand and use " + name + ".", needs: k ? [k] : [], outside: !k && prev ? ["the idea of " + prev] : [], helps: k > 1 ? [k - 1] : [] })),
        where: ti % 2 ? [] : [{ title: "Think Python", detail: "Chapter 2", url: "https://example.com/book" }] } };
    }
    if (text.startsWith("You review one part of a knowledge map")) {
      window.__reviewers = (window.__reviewers || 0) + 1;
      const all = pointsOf(text), root = /nothing is above you/.test(text);
      const open = [...text.matchAll(/^(N\\d+) \\| (p\\d+) \\([^)]*\\) \\| the idea of (.+)$/gm)];
      const fixes = open.map((m) => { const to = all.find((x) => x.name === m[3]); return to ? { op: "link", need: m[1], to: to.id } : null; }).filter(Boolean);
      if (root && all.length > 6) {
        const last = all[all.length - 1], first = all[0];
        fixes.push(
          { op: "add_point", topic: all[2].topic, name: "Reading input with input()", what: "Read what the user types", needs: [first.id], why: "programs that react to the user need it" },
          { op: "rename", id: all[1].id, name: "print() and output", why: "clearer" },
          { op: "add_need", id: first.id, need: last.id, why: "a link that closes a loop" },
          { op: "remove_point", id: "p999", why: "no such point" });
      }
      return { verdict: root ? "The map is sound after these fixes." : "This part holds together.", fixes };
    }
    if (text.startsWith("You mark the learner's route")) {
      const all = pointsOf(text);
      const goal = all.filter((_, i) => i % 3 === 1).map((x) => x.id);
      const topics = [...new Set(all.filter((x) => goal.includes(x.id)).map((x) => x.topic))];
      return { goal, why: topics.map((t) => ({ topic: t, why: DZ ? "你的目标会用到。" : "Your goal uses this every day." })), note: DZ ? "按目标挑选。" : "Chose what the goal uses directly." };
    }
    if (text.startsWith("You plan a lesson")) return { aim: DZ ? "理解这个知识点" : "Understand the point", approach: DZ ? "从例子入手" : "Start from an example.", bridge: [], sections: [{ title: DZ ? "概念" : "The idea", teach: DZ ? "解释" : "Explain it", example: "x = 3" }], beyond: "", goal_link: DZ ? "数据处理里常用" : "Used everywhere in data work." };
    if (text.startsWith("You review a lesson")) return { errors: [], improvements: [] };
    if (text.startsWith("You decide whether")) return { enough: true, why: DZ ? "已经可以组合成小任务。" : "You can combine what you've learned into a small real task.", focus: ["while loops", "Variables and assignment"], review: [], shape: "", next: [] };
    const music = /self-learner of (Music|乐理)/.test(text);
    if (text.startsWith("You design a practice set")) return { when: DZ ? "现在合适" : "Now is a good time.", how: [DZ ? "先自己试" : "Try first."], exercises: [{ title: music ? (DZ ? "和弦配旋律" : "Harmonise a melody") : (DZ ? "价格统计" : "Price tally"), level: "core", combines: ["a", "b"], idea: "x", thinking: "y" }] };
    if (text.startsWith("You write one exercise") || text.startsWith("You wrote exercise")) {
      if (music) return { title: DZ ? "和弦配旋律" : "Harmonise a melody", level: "core", task: DZ ? "给 C D E 配三和弦。" : "Choose a triad for each of the notes C, D, E and explain each choice.", combines: ["Triads", "Intervals"], thinking: DZ ? "选择" : "Which chord contains each note", criteria: [DZ ? "每个和弦都包含该音" : "Each chord contains its melody note", DZ ? "说明理由" : "Each choice is explained"], solution: DZ ? "C：C 大三和弦。" : "C: C major (C E G). D: G major (G B D). E: C major or E minor.", hints: [DZ ? "哪些和弦包含这个音？" : "Which triads contain the note?"] };
      return { title: DZ ? "价格统计" : "Price tally", level: "core", task: DZ ? "读入价格直到空行，打印个数。" : "Read prices until an empty line, then print how many there were.", combines: ["while loops"], thinking: "count", starter: "", tests: [{ input: "2\\n3\\n\\n", output: "2" }, { input: "\\n", output: "0" }], solution: "n = 0\\nline = input()\\nwhile line != '':\\n    n += 1\\n    line = input()\\nprint(n)", hints: [DZ ? "要记住什么？" : "What do you need to remember?"] };
    }
    if (text.startsWith("You review a practice set")) return { errors: [], improvements: [] };
    if (text.startsWith("You give feedback on a self-learner's answer")) return { results: [{ criterion: 1, met: "yes", note: DZ ? "对" : "Right." }, { criterion: 2, met: /because|因为/.test(text) ? "yes" : "partly", note: DZ ? "理由可以更多" : "Say why for each one." }], feedback: DZ ? "不错。" : "Good choices; explain each one." };
    if (text.startsWith("You set a short level check")) return { why: DZ ? "从易到难" : "From easier to harder.", tasks: [{ title: DZ ? "打印" : "Print a greeting", task: DZ ? "写程序打印 hi。" : "Write a program that prints hi.", probes: ["p2"] }, { title: DZ ? "循环" : "Count to three", task: DZ ? "用循环打印 1 到 3。" : "Use a loop to print 1 to 3.", probes: ["p11", "p12"] }] };
    if (text.startsWith("You assess where a self-learner is")) return { tasks: [{ n: 1, result: "works", note: "ok" }], summary: DZ ? "基础扎实。" : "Comfortable with the basics.", solid: ["p4", "p5", "p6"], shaky: ["p12"], feedback: DZ ? "继续学循环。" : "Move on to loops next." };
    if (text.startsWith("A self-learner will study")) return { share: 80, strong: ["explaining ideas"], limits: ["hands-on practice"], statement: DZ ? "我能讲清楚大部分。" : "I can explain most of this map well." };
    if (text.startsWith("Several AI models answered")) return { verdict: "agree", summary: "Same substance.", differences: [] };
    return {};
  };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
};

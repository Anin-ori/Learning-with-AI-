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
  const ZH = ${ZH};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // ---- the subjects the mock knows ----
  const PY = {
    subject: ZH ? "Python 编程" : "Python programming",
    run: "python",
    areas: ZH ? [
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
    subject: ZH ? "乐理" : "Music theory",
    run: "none",
    areas: ZH ? [["基础", [["音高", "音的高低", ["音名", "升降号", "音程"]], ["节奏", "音的长短", ["拍子", "拍号"]]]], ["和声", [["和弦", "同时发声的音", ["三和弦", "和弦级数"]]]]]
      : [["Foundations", [["Pitch", "How high or low a note is", ["Note names", "Sharps and flats", "Intervals"]], ["Rhythm", "How long notes last", ["Beats", "Time signatures"]]]], ["Harmony", [["Chords", "Notes sounding together", ["Triads", "Chord functions"]]]]],
  };
  const pick = (p) => /Subject: (Music|乐理)/.test(p) ? MUSIC : PY;
  const profile = (S) => S.run === "python"
    ? { name: S.subject, trap: "t = (1, [2]); t[1] += [3] raises TypeError and still changes the list", slips: "a typo, a missing colon", observe: "type(), id() and the dis module", shallow: "\\"read two numbers and print their sum\\"", rich: "\\"read prices until a blank line and print the count, total and largest\\"", examples: "short runnable programs, each followed by its exact output", run: "python", format: "" }
    : { name: S.subject, trap: "a C major chord and an A minor chord share two notes, which explains why they can substitute for each other", slips: "a misremembered note name", observe: "play it on a keyboard and listen", shallow: "\\"name the notes of a C major triad\\"", rich: "\\"harmonise a four-bar melody and explain each chord choice\\"", examples: "notes written by name, with the sound described", run: "none", format: "A written answer: a few sentences or a short list of notes or chords." };
  // ---- the db's map, read back from prompts ----
  const pointsOf = (p) => { const out = []; let topic = null; p.split("\\n").forEach((l) => { const t = l.match(/^Topic (t\\d+):/); if (t) topic = t[1]; const m = l.match(/^  (p\\d+) \\| ([^|]+)/); if (m) out.push({ id: m[1], name: m[2].trim(), topic }); }); return out; };
  let checkerCalls = 0;
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
        ? (ZH ? "## 什么是音程\\n\\n音程是两个音之间的距离。\\n\\n## 例子\\n\\nC 到 E 是大三度。" : "## What an interval is\\n\\nAn interval is the distance between two notes.\\n\\n## An example\\n\\nC up to E is a major third: four semitones.")
        : (ZH ? "## 变量是名字\\n\\n变量是指向值的名字。\\n\\n\`\`\`python\\nx = 3\\nprint(x)\\n\`\`\`\\n\\nOutput:\\n\\n\`\`\`\\n3\\n\`\`\`" : "## A variable is a name\\n\\nA variable is a name that refers to a value.\\n\\n\`\`\`python\\nx = 3\\nprint(x)\\n\`\`\`\\n\\nOutput:\\n\\n\`\`\`\\n3\\n\`\`\`");
      return { text: body + "\\n\\n=== DEEPER ===\\n\\n### " + (ZH ? "底层" : "Underneath") + "\\n\\n" + (ZH ? "名字存放在命名空间里。" : "Names live in a namespace dictionary.") + "\\n\\n=== NOTES ===\\n- " + (ZH ? "**变量** 是名字，\`x = 3\` 让它指向 3" : "A **variable** is a name; \`x = 3\` makes it refer to 3") + "\\n- " + (ZH ? "\`print()\` 显示值" : "\`print()\` shows a value"), truncated: false };
    }
    if (text.startsWith("A learner studying")) return { text: ZH ? "变量是名字。" : "A variable is a name for a value.", truncated: false };
    return { text: "ok", truncated: false };
  };
  sample.json = async (text) => {
    await wait(60);
    window.__prompts.push(text);
    if (text.startsWith("You are the architect")) {
      const S = pick(text);
      return { subject: S.subject, scope: ZH ? "覆盖目标所需的基础，不含高级主题。" : "Covers the foundations the goal needs; leaves out advanced topics such as concurrency.", profile: profile(S),
        areas: S.areas.map(([name, topics]) => ({ name, topics: topics.map(([tn, desc, pts]) => ({ name: tn, desc, points: pts })) })) };
    }
    if (text.startsWith("You write the details")) {
      const all = pointsOf(text);
      const mine = (text.match(/Your topics: ([^\\n]+)/) || [, ""])[1].match(/t\\d+/g) || [];
      const pts = all.filter((x) => mine.includes(x.topic));
      return { points: pts.map((x) => { const i = all.findIndex((y) => y.id === x.id); return { id: x.id, what: (ZH ? "能理解并使用" : "Understand and use ") + x.name + (ZH ? "。" : "."), needs: i > 0 ? [all[i - 1].id] : [], helps: i > 1 ? [all[i - 2].id] : [] }; }),
        topics: mine.map((t, k) => ({ id: t, where: k % 2 ? [] : [{ title: ZH ? "某本教材" : "Think Python", detail: ZH ? "第 2 章" : "Chapter 2", url: "https://example.com/book" }] })) };
    }
    if (text.startsWith("You mark the learner's route")) {
      const all = pointsOf(text);
      const goal = all.filter((_, i) => i % 3 === 1).map((x) => x.id);
      const topics = [...new Set(all.filter((x) => goal.includes(x.id)).map((x) => x.topic))];
      return { goal, why: topics.map((t) => ({ topic: t, why: ZH ? "你的目标会用到。" : "Your goal uses this every day." })), note: ZH ? "按目标挑选。" : "Chose what the goal uses directly." };
    }
    if (text.startsWith("You review a knowledge map")) {
      checkerCalls++;
      const all = pointsOf(text);
      const last = all[all.length - 1], first = all[0];
      return { verdict: ZH ? "地图基本可靠。" : "The map is sound after these fixes.", fixes: [
        { op: "add_point", topic: all[2].topic, name: ZH ? "读取输入 input()" : "Reading input with input()", what: ZH ? "读取用户输入" : "Read what the user types", needs: [first.id], route: true, why: ZH ? "目标需要" : "programs that react to the user need it" },
        { op: "rename", id: all[1].id, name: ZH ? "print() 与输出" : "print() and output", why: ZH ? "更清楚" : "clearer" },
        { op: "add_need", id: first.id, need: last.id, why: ZH ? "测试环路" : "a link that closes a loop" },
        { op: "remove_point", id: "p999", why: "no such point" },
      ] };
    }
    if (text.startsWith("You plan a lesson")) return { aim: ZH ? "理解这个知识点" : "Understand the point", approach: ZH ? "从例子入手" : "Start from an example.", bridge: [], sections: [{ title: ZH ? "概念" : "The idea", teach: ZH ? "解释" : "Explain it", example: "x = 3" }], beyond: "", goal_link: ZH ? "数据处理里常用" : "Used everywhere in data work." };
    if (text.startsWith("You review a lesson")) return { errors: [], improvements: [] };
    if (text.startsWith("You decide whether")) return { enough: true, why: ZH ? "已经可以组合成小任务。" : "You can combine what you've learned into a small real task.", focus: ["while loops", "Variables and assignment"], review: [], shape: "", next: [] };
    const music = /self-learner of (Music|乐理)/.test(text);
    if (text.startsWith("You design a practice set")) return { when: ZH ? "现在合适" : "Now is a good time.", how: [ZH ? "先自己试" : "Try first."], exercises: [{ title: music ? (ZH ? "和弦配旋律" : "Harmonise a melody") : (ZH ? "价格统计" : "Price tally"), level: "core", combines: ["a", "b"], idea: "x", thinking: "y" }] };
    if (text.startsWith("You write one exercise") || text.startsWith("You wrote exercise")) {
      if (music) return { title: ZH ? "和弦配旋律" : "Harmonise a melody", level: "core", task: ZH ? "给 C D E 配三和弦。" : "Choose a triad for each of the notes C, D, E and explain each choice.", combines: ["Triads", "Intervals"], thinking: ZH ? "选择" : "Which chord contains each note", criteria: [ZH ? "每个和弦都包含该音" : "Each chord contains its melody note", ZH ? "说明理由" : "Each choice is explained"], solution: ZH ? "C：C 大三和弦。" : "C: C major (C E G). D: G major (G B D). E: C major or E minor.", hints: [ZH ? "哪些和弦包含这个音？" : "Which triads contain the note?"] };
      return { title: ZH ? "价格统计" : "Price tally", level: "core", task: ZH ? "读入价格直到空行，打印个数。" : "Read prices until an empty line, then print how many there were.", combines: ["while loops"], thinking: "count", starter: "", tests: [{ input: "2\\n3\\n\\n", output: "2" }, { input: "\\n", output: "0" }], solution: "n = 0\\nline = input()\\nwhile line != '':\\n    n += 1\\n    line = input()\\nprint(n)", hints: [ZH ? "要记住什么？" : "What do you need to remember?"] };
    }
    if (text.startsWith("You review a practice set")) return { errors: [], improvements: [] };
    if (text.startsWith("You give feedback on a self-learner's answer")) return { results: [{ criterion: 1, met: "yes", note: ZH ? "对" : "Right." }, { criterion: 2, met: /because|因为/.test(text) ? "yes" : "partly", note: ZH ? "理由可以更多" : "Say why for each one." }], feedback: ZH ? "不错。" : "Good choices; explain each one." };
    if (text.startsWith("You set a short level check")) return { why: ZH ? "从易到难" : "From easier to harder.", tasks: [{ title: ZH ? "打印" : "Print a greeting", task: ZH ? "写程序打印 hi。" : "Write a program that prints hi.", probes: ["p2"] }, { title: ZH ? "循环" : "Count to three", task: ZH ? "用循环打印 1 到 3。" : "Use a loop to print 1 to 3.", probes: ["p11", "p12"] }] };
    if (text.startsWith("You assess where a self-learner is")) return { tasks: [{ n: 1, result: "works", note: "ok" }], summary: ZH ? "基础扎实。" : "Comfortable with the basics.", solid: ["p4", "p5", "p6"], shaky: ["p12"], feedback: ZH ? "继续学循环。" : "Move on to loops next." };
    if (text.startsWith("A self-learner will study")) return { share: 80, strong: ["explaining ideas"], limits: ["hands-on practice"], statement: ZH ? "我能讲清楚大部分。" : "I can explain most of this map well." };
    if (text.startsWith("Several AI models answered")) return { verdict: "agree", summary: "Same substance.", differences: [] };
    return {};
  };
  window.claude = { use: async (name) => name === "db" ? { doc } : name === "sample" ? sample : null };
</script>`;
};

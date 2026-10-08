"""Extract ordered headings from the locally cloned human sources."""
import json, os, re, glob

SRC = os.path.join(os.path.dirname(__file__), "src")
OUT = os.path.join(os.path.dirname(__file__), "sources")
os.makedirs(OUT, exist_ok=True)

def clean(t):
    t = re.sub(r":\w+:`!?([^`<]+?)(\s*<[^>]+>)?`", r"\1", t)   # rst roles
    t = re.sub(r"`+", "", t)
    t = re.sub(r"\{#.*?\}", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("\\_", "_").strip(" #*")
    return re.sub(r"\s+", " ", t).strip()

def save(meta, items):
    for i, it in enumerate(items):
        it["order"] = i
    meta["items"] = items
    with open(os.path.join(OUT, meta["id"] + ".json"), "w") as f:
        json.dump(meta, f, indent=1, ensure_ascii=False)
    print(meta["id"], len(items))

# ---------- Official tutorial (rst) ----------
def rst_headings(path):
    lines = open(path, encoding="utf-8").read().splitlines()
    chars = []
    out = []
    for i in range(1, len(lines)):
        u = lines[i]
        if re.fullmatch(r"([*=\-~^\"])\1{2,}", u) and lines[i - 1].strip() and not re.fullmatch(r"([*=\-~^\"])\1{2,}", lines[i - 1]):
            ch = u[0]
            over = i >= 2 and lines[i - 2] == u
            key = ch + ("o" if over else "")
            if key not in chars:
                chars.append(key)
            out.append((chars.index(key), clean(lines[i - 1])))
    return out

idx = open(f"{SRC}/cpython/Doc/tutorial/index.rst").read()
order = re.findall(r"^\s+(\w+)\.rst", idx, re.M)
items = []
for name in order:
    for lvl, h in rst_headings(f"{SRC}/cpython/Doc/tutorial/{name}.rst"):
        if lvl > 2:
            continue
        items.append({"chapter": name, "heading": h, "level": lvl,
                      "url": f"https://docs.python.org/3/tutorial/{name}.html"})
chapter_titles = {}
for it in items:
    chapter_titles.setdefault(it["chapter"], it["heading"])
for it in items:
    it["chapter"] = chapter_titles[it["chapter"]]
save({"id": "tutorial", "name": "The Python Tutorial", "author": "Python Software Foundation",
      "url": "https://docs.python.org/3/tutorial/", "kind": "Official tutorial"}, items)

# ---------- notebooks ----------
def nb_headings(path):
    nb = json.load(open(path, encoding="utf-8"))
    out = []
    for c in nb["cells"]:
        if c["cell_type"] != "markdown":
            continue
        src = "".join(c["source"]) if isinstance(c["source"], list) else c["source"]
        in_code = False
        for line in src.splitlines():
            if line.startswith("```"):
                in_code = not in_code
            if in_code:
                continue
            m = re.match(r"^(#{1,3})\s+(.*)", line)
            if m:
                out.append((len(m.group(1)) - 1, clean(m.group(2))))
    return out

items = []
for p in sorted(glob.glob(f"{SRC}/thinkpython/chapters/chap*.ipynb")):
    n = re.search(r"chap(\d+)", p).group(1)
    hs = nb_headings(p)
    title = hs[0][1] if hs else f"Chapter {n}"
    for lvl, h in hs:
        if re.match(r"(Glossary|Exercises?|Debugging|Ask a virtual assistant|Credits)$", h, re.I):
            continue
        items.append({"chapter": f"{int(n)}. {title}", "heading": h, "level": lvl,
                      "url": f"https://allendowney.github.io/ThinkPython/chap{n}.html"})
save({"id": "thinkpython", "name": "Think Python, 3rd edition", "author": "Allen B. Downey",
      "url": "https://allendowney.github.io/ThinkPython/", "kind": "Book"}, items)

items = []
for p in sorted(glob.glob(f"{SRC}/learntools/notebooks/python/raw/tut_*.ipynb")):
    n = re.search(r"tut_(\d+)", p).group(1)
    hs = nb_headings(p)
    title = hs[0][1] if hs else f"Lesson {n}"
    for lvl, h in hs:
        if re.match(r"(Your turn|Keep going|Exercise)", h, re.I):
            continue
        items.append({"chapter": f"{n}. {title}", "heading": h, "level": lvl,
                      "url": "https://www.kaggle.com/learn/python"})
save({"id": "kaggle", "name": "Kaggle Learn: Python", "author": "Colin Morris (Kaggle)",
      "url": "https://www.kaggle.com/learn/python", "kind": "Online course (ML-oriented)"}, items)

items = []
for n, slug in (("02", "python-basics"), ("03", "python-builtin")):
    hs = nb_headings(f"{SRC}/pydata/ch{n}.ipynb")
    for lvl, h in hs:
        items.append({"chapter": f"Ch {int(n)}", "heading": h, "level": lvl,
                      "url": f"https://wesmckinney.com/book/{slug}.html"})
titles = {"Ch 2": "2. Python Language Basics, IPython, and Jupyter Notebooks",
          "Ch 3": "3. Built-In Data Structures, Functions, and Files"}
for it in items:
    it["chapter"] = titles[it["chapter"]]
save({"id": "pydata", "name": "Python for Data Analysis, 3rd edition (ch. 2-3)", "author": "Wes McKinney",
      "url": "https://wesmckinney.com/book/", "kind": "Book (data-science oriented)"}, items)

# ---------- Py4E (pandoc markdown with setext headings) ----------
def md_headings(text):
    lines = text.splitlines()
    out = []
    in_code = False
    for i, line in enumerate(lines):
        if line.startswith("~~~~") or line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            out.append((len(m.group(1)) - 1, clean(m.group(2))))
            continue
        if i + 1 < len(lines) and lines[i].strip() and re.fullmatch(r"=+", lines[i + 1].strip() or "x"):
            out.append((0, clean(line)))
        elif i + 1 < len(lines) and lines[i].strip() and re.fullmatch(r"-{3,}", lines[i + 1].strip() or "x") \
                and not lines[i].startswith(("|", "-", "*")):
            out.append((1, clean(line)))
    return out

items = []
for p in sorted(glob.glob(f"{SRC}/py4e/book3/[01][0-9]-*.mkd")):
    base = os.path.basename(p)[:-4]
    hs = md_headings(open(p, encoding="utf-8").read())
    title = hs[0][1] if hs else base
    n = int(base[:2])
    for lvl, h in hs:
        if re.match(r"(Glossary|Exercises|Debugging)$", h, re.I):
            continue
        items.append({"chapter": f"{n}. {title}", "heading": h, "level": lvl,
                      "url": f"https://www.py4e.com/html3/{base}"})
save({"id": "py4e", "name": "Python for Everybody", "author": "Charles R. Severance",
      "url": "https://www.py4e.com/book", "kind": "Book + course"}, items)

# ---------- A Byte of Python ----------
summary = open(f"{SRC}/byte/SUMMARY.md").read()
pages = re.findall(r"\[([^\]]+)\]\(([\w_]+)\.md\)", summary)
skip = {"dedication", "preface", "about", "revision_history", "translations", "translation_howto",
        "feedback", "floss", "what_next"}
items = []
for title, page in pages:
    if page in skip:
        continue
    hs = md_headings(open(f"{SRC}/byte/{page}.md", encoding="utf-8", errors="replace").read())
    for lvl, h in hs:
        if re.match(r"(Summary)$", h, re.I):
            continue
        items.append({"chapter": title, "heading": h, "level": lvl,
                      "url": f"https://python.swaroopch.com/{page}.html"})
save({"id": "byte", "name": "A Byte of Python", "author": "Swaroop C H",
      "url": "https://python.swaroopch.com/", "kind": "Book"}, items)

# ---------- University of Helsinki MOOC (with learning objectives) ----------
items = []
for part in range(1, 13):  # parts 13-14 are pygame
    for p in sorted(glob.glob(f"{SRC}/mooc/data/part-{part}/[0-9]-*.md")):
        text = open(p, encoding="utf-8").read()
        title = re.search(r"title:\s*['\"]?([^'\"\n]+)", text).group(1).strip()
        path = re.search(r"path:\s*['\"]([^'\"]+)['\"]", text).group(1)
        obj = re.search(r"name=\"Learning objectives\">(.*?)</text-box>", text, re.S)
        objectives = [clean(x) for x in re.findall(r"^\s*-\s+(.*)", obj.group(1), re.M)] if obj else []
        text_nofm = re.sub(r"\A---.*?\n---", "", text, flags=re.S)
        body = re.sub(r"<(programming-exercise|sample-output|text-box|quiz|in-browser-programming-exercise).*?</\1>", "",
                      text_nofm, flags=re.S)
        hs = [(1, h) for l, h in md_headings(body) if l <= 2]
        sec = os.path.basename(p)[:-3]
        items.append({"chapter": f"Part {part}", "heading": title, "level": 0,
                      "url": f"https://programming-25.mooc.fi{path}", "objectives": objectives})
        for lvl, h in hs:
            items.append({"chapter": f"Part {part}", "heading": h, "level": 1,
                          "url": f"https://programming-25.mooc.fi{path}"})
save({"id": "helsinki", "name": "Python Programming MOOC 2025", "author": "University of Helsinki",
      "url": "https://programming-25.mooc.fi/", "kind": "University course"}, items)

# ---------- Exercism (human-made prerequisite graph) ----------
cfg = json.load(open(f"{SRC}/exercism/config.json"))
concepts = {c["slug"]: c["name"] for c in cfg["concepts"]}
items = []
for e in cfg["exercises"]["concept"]:
    if e.get("status") == "deprecated" or not e["concepts"]:
        continue
    for slug in e["concepts"]:
        items.append({"chapter": "Syllabus", "heading": concepts.get(slug, slug), "slug": slug, "level": 0,
                      "prerequisites": e["prerequisites"], "exercise": e["slug"], "status": e.get("status"),
                      "url": f"https://exercism.org/tracks/python/concepts/{slug}"})
practice = []
for e in cfg["exercises"]["practice"]:
    if e.get("status") == "deprecated":
        continue
    practice.append({"slug": e["slug"], "practices": e.get("practices", []), "prerequisites": e.get("prerequisites", [])})
meta = {"id": "exercism", "name": "Exercism Python track syllabus", "author": "Exercism contributors",
        "url": "https://exercism.org/tracks/python/concepts", "kind": "Syllabus with explicit prerequisites",
        "all_concepts": concepts, "practice_exercises": practice}
save(meta, items)

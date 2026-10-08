"""Human-written practice for each point (titles and links only, never the question text), plus the checked
Automate the Boring Stuff key points that belong to each point. Adds both to km_data.json."""
import json, os, re, glob, sys
from collections import defaultdict
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from mapper import compile_rules, match
SRC = f"{HERE}/src"
KD = json.load(open(f"{HERE}/km_data.json"))
S = {d["id"]: d for d in json.load(open(f"{HERE}/mapped.json"))}
ids = {n["id"] for n in KD["nodes"]}
rules = compile_rules()
cand = defaultdict(list)   # pid -> [source, title, url, kind]
def add(pids, item):
    for p in pids:
        if p in ids and item not in cand[p]:
            cand[p].append(item)

# Exercism: concept exercises and practice exercises, by the concepts they practise
EXC = {"basics": ["variables", "def", "comments"], "bools": ["bool", "logic"], "numbers": ["numbers", "arith", "intdiv"],
       "conditionals": ["if", "else"], "comparisons": ["compare"], "strings": ["strbasics", "strindex", "strslice", "concat"],
       "string-methods": ["strmethods", "splitjoin"], "string-formatting": ["fstrings", "formatmethod"], "lists": ["listbasics", "listindex", "listslice"],
       "list-methods": ["listmethods", "listmodify", "sorting"], "loops": ["for", "while", "range", "breakcont"], "tuples": ["tuples"],
       "dicts": ["dictbasics", "dictloop"], "dict-methods": ["dictviews", "dictget"], "unpacking-and-multiple-assignment": ["unpacking", "varargs"],
       "sets": ["sets", "setops"], "classes": ["classes", "initattrs", "methods"], "generators": ["generators"], "none": ["none"],
       "list-comprehensions": ["listcomp"], "other-comprehensions": ["othercomp"], "generator-expressions": ["genexpr"], "sequences": ["sequences"],
       "functions": ["def", "params", "return"], "function-arguments": ["defaults", "kwargs", "varargs"], "iteration": ["for", "enumzip"],
       "iterators": ["iterators"], "itertools": ["iterators"], "decorators": ["decorators"], "rich-comparisons": ["dunder"],
       "operator-overloading": ["dunder"], "class-customization": ["dunder", "strrepr"], "class-inheritance": ["inherit"],
       "class-composition": ["composition"], "raising-and-handling-errors": ["tryexcept", "raise", "exceptions"], "user-defined-errors": ["customexc"],
       "with-statement": ["with"], "regular-expressions": ["rxbasics", "rxsyntax", "rxextract"], "anonymous-functions": ["lambda"],
       "higher-order-functions": ["higherorder"], "recursion": ["recursion"], "collections": ["counting"], "dataclasses": ["dataclasses"]}
cfg = json.load(open(f"{SRC}/exercism/config.json"))
title = lambda slug: slug.replace("-", " ").title()
for e in cfg["exercises"]["concept"]:
    if e.get("status") in ("deprecated", "wip"): continue
    for c in e["concepts"]:
        add(EXC.get(c, []), ["exercism", title(e["slug"]), f"https://exercism.org/tracks/python/exercises/{e['slug']}", "learning exercise"])
for e in cfg["exercises"]["practice"]:
    if e.get("status") in ("deprecated", "wip"): continue
    for c in e.get("practices", []):
        add(EXC.get(c, []), ["exercism", title(e["slug"]), f"https://exercism.org/tracks/python/exercises/{e['slug']}", "exercise"])

# Helsinki MOOC: each programming exercise, matched to the heading it sits under (or its section)
hel = S["helsinki"]["items"]
sec_points = defaultdict(set)
for it in hel:
    sec_points[it["url"]].update(it["points"])
for part in range(1, 13):
    for p in sorted(glob.glob(f"{SRC}/mooc/data/part-{part}/[0-9]-*.md")):
        text = open(p, encoding="utf-8").read()
        path = re.search(r"path:\s*['\"]([^'\"]+)['\"]", text).group(1)
        url = "https://programming-25.mooc.fi" + path
        heading = ""
        for line in text.splitlines():
            m = re.match(r"^#{2,3}\s+(.*)", line)
            if m: heading = m.group(1).strip(); continue
            m = re.search(r"<programming-exercise name=['\"]([^'\"]+)['\"]", line)
            if m:
                pts = set(match(rules, heading, f"Part {part}")) if heading else set()
                add(pts or sec_points[url], ["helsinki", m.group(1), url, "exercise"])

def chapter_points(src):
    out = defaultdict(set)
    for it in S[src]["items"]:
        out[it.get("chapter", "")].update(it["points"])
    return out

# Think Python: each chapter's Exercises section
tp = chapter_points("thinkpython")
for p in sorted(glob.glob(f"{SRC}/thinkpython/chapters/chap[0-9]*.ipynb")):
    n = int(re.search(r"chap(\d+)", p).group(1))
    nb = json.load(open(p))
    md = "".join("".join(c["source"]) for c in nb["cells"] if c["cell_type"] == "markdown")
    k = len(re.findall(r"^### Exercise", md, re.M))
    if not k: continue
    ch = next((c for c in tp if c.startswith(f"{n}. ")), None)
    if ch: add(tp[ch], ["thinkpython", f"Chapter {n} exercises ({k})", f"https://allendowney.github.io/ThinkPython/chap{n:02d}.html#exercises", "chapter exercises"])
# Python for Everybody: each chapter's Exercises section
py = chapter_points("py4e")
for p in sorted(glob.glob(f"{SRC}/py4e/book3/[01][0-9]-*.mkd")):
    base = os.path.basename(p)[:-4]; n = int(base[:2])
    if not re.search(r"^Exercises\s*$", open(p, encoding="utf-8").read(), re.M): continue
    ch = next((c for c in py if c.startswith(f"{n}. ")), None)
    if ch: add(py[ch], ["py4e", f"Chapter {n} exercises", f"https://www.py4e.com/html3/{base}#:~:text=Exercises", "chapter exercises"])
# Automate the Boring Stuff: practice questions and practice programs per chapter
at = chapter_points("atbs")
for ch, pts in at.items():
    n = int(ch.split(".")[0])
    if n > 11: continue
    add(pts, ["atbs", f"Chapter {n} practice questions", f"https://automatetheboringstuff.com/3e/chapter{n}.html#:~:text=Practice%20Questions", "chapter questions"])
    add(pts, ["atbs", f"Chapter {n} practice programs", f"https://automatetheboringstuff.com/3e/chapter{n}.html#:~:text=Practice%20Programs", "chapter programs"])
# Kaggle Learn: one exercise notebook per lesson
kg = chapter_points("kaggle")
for ch, pts in kg.items():
    add(pts, ["kaggle", f"Lesson {ch} exercise", "https://www.kaggle.com/learn/python", "lesson exercise"])
# CS50P: one problem set per lecture
cs = chapter_points("cs50p")
for ch, pts in cs.items():
    m = re.match(r"Lecture (\d+): (.*)", ch)
    if m: add(pts, ["cs50p", f"Problem Set {m.group(1)} ({m.group(2)})", f"https://cs50.harvard.edu/python/psets/{m.group(1)}/", "problem set"])
# Google's Python Class exercises
add(["strbasics", "strindex", "strslice", "strmethods", "concat", "len", "listbasics", "listindex", "for", "sorting", "listmethods"],
    ["google", "Basic exercises (string1, list1)", "https://developers.google.com/edu/python/exercises/basic", "exercise"])
add(["dictbasics", "dictviews", "counting", "readfiles", "splitjoin", "sorting"], ["google", "Word count exercise", "https://developers.google.com/edu/python/exercises/basic", "exercise"])
add(["rxbasics", "rxsyntax", "rxextract", "readfiles"], ["google", "Baby names exercise", "https://developers.google.com/edu/python/exercises/baby-names", "exercise"])
add(["organize", "paths", "cliargs"], ["google", "Copy special exercise", "https://developers.google.com/edu/python/exercises/copy-special", "exercise"])

ORDER = {"learning exercise": 0, "exercise": 1, "problem set": 2, "chapter questions": 3, "chapter programs": 4, "chapter exercises": 4, "lesson exercise": 4}
practice = {p: sorted(v, key=lambda x: ORDER.get(x[3], 5))[:24] for p, v in cand.items()}

# checked Automate the Boring Stuff key points, by point
akp = defaultdict(list)
for it in S["atbs"]["items"]:
    for p in it["points"]:
        for o in it.get("objectives", []):
            if o not in akp[p]: akp[p].append(o)
KD["practice"] = practice
KD["akp"] = {p: v[:12] for p, v in akp.items()}
json.dump(KD, open(f"{HERE}/km_data.json", "w"), ensure_ascii=False, separators=(",", ":"))
none = [n["name"] for n in KD["nodes"] if n["id"] not in practice]
print("points with practice:", len(practice), "of", len(ids), "| without:", none)
print("specific (exercism/helsinki) per point, median:", sorted(sum(1 for x in v if x[0] in ("exercism", "helsinki")) for v in practice.values())[len(practice) // 2])
print("points with ATBS key points:", len(akp))
print("example listslice:", practice.get("listslice", [])[:6])

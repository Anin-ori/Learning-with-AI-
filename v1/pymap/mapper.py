"""Map every source heading onto the draft knowledge points; report coverage and leftovers."""
import json, glob, re, os, sys
from collections import defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from points import POINTS, AREAS, RX

HERE = os.path.dirname(__file__)
SKIP = re.compile(r"preface|acknowledg|^welcome|who is this book|goals of the book|navigating the book|what's new|"
                  r"resources for teachers|congratulations|this was cs50|story behind|features of python|^simple$|"
                  r"easy to learn|free and open source|high.level language|portable|^interpreted$|object oriented$|"
                  r"extensible|embeddable|extensive libraries|python 3 versus 2|what programmers say|^summary|"
                  r"^conclusion|exercise|practice|^examples?$|more examples|^introduction$|^prelude$|whetting|"
                  r"what next|^appendix", re.I)

EXERCISM = {  # slug -> point ids (hand-mapped; Exercism's own concept names)
    "basics": ["variables", "def", "comments", "docstrings", "arith"], "bools": ["bool", "logic"], "numbers": ["numbers", "arith", "intdiv"],
    "conditionals": ["if", "else"], "comparisons": ["compare"], "string-methods": ["strmethods"], "strings": ["strbasics", "strindex", "strslice", "concat"],
    "string-formatting": ["fstrings", "formatmethod"], "lists": ["listbasics", "listindex", "listslice"], "list-methods": ["listmethods", "listmodify", "sorting"],
    "loops": ["for", "while", "range", "breakcont"], "tuples": ["tuples"], "dicts": ["dictbasics"], "dict-methods": ["dictviews", "dictget"],
    "unpacking-and-multiple-assignment": ["unpacking", "varargs"], "sets": ["sets", "setops"], "classes": ["classes", "initattrs", "methods"],
    "generators": ["generators"], "enums": [], "none": ["none"], "comprehensions": ["listcomp", "othercomp"], "sequences": ["sequences"],
    "functions": ["def", "params", "return"],
}


def compile_rules():
    rules = []
    for pid, area, name, inc, exc, ctx in POINTS:
        rules.append((pid, area, re.compile(inc, re.I), re.compile(exc, re.I) if exc else None,
                      re.compile(ctx, re.I) if ctx else None))
    return rules


def match(rules, heading, chapter):
    h = heading.strip()
    context = h + " || " + chapter
    pure_rx = bool(re.search(RX, chapter, re.I)) and not re.search(r"strings?", chapter, re.I)
    rx_ok = pure_rx or bool(re.search(RX, h, re.I)) or bool(re.search(RX, chapter, re.I) and re.search(r"search|match|group|special|repeat|character", h, re.I))
    hits = []
    for pid, area, inc, exc, ctx in rules:
        if area == "regex" and not rx_ok:
            continue
        if pure_rx and area != "regex" and pid not in ("escapes",):
            continue
        if not inc.search(h):
            continue
        if exc and exc.search(h):
            continue
        if ctx and not ctx.search(context):
            typed = re.search(r"\blists?\b|\bstr(ings?)?\b|text|substring|character", context, re.I)
            if area == "regex" or typed:
                continue
        hits.append(pid)
    return hits


def run(verbose=False):
    rules = compile_rules()
    names = {p[0]: p[2] for p in POINTS}
    sources = []
    for f in sorted(glob.glob(os.path.join(HERE, "sources", "*.json"))):
        d = json.load(open(f))
        n = len(d["items"])
        parent, parent1 = "", ""
        for it in d["items"]:
            if it.get("level", 0) == 0:
                parent, parent1 = it["heading"], ""
            elif it.get("level") == 1:
                parent1 = it["heading"]
            if d["id"] == "exercism":
                it["points"] = EXERCISM.get(it.get("slug"), [])
                continue
            if SKIP.search(it["heading"]):
                it["points"] = []
                it["skipped"] = True
                continue
            it["points"] = match(rules, it["heading"], it.get("chapter", "") + " / " + parent + (" / " + parent1 if it.get("level", 0) >= 2 else ""))
        sources.append(d)
    json.dump(sources, open(os.path.join(HERE, "mapped.json"), "w"), indent=1, ensure_ascii=False)

    cover = defaultdict(set)
    for d in sources:
        for it in d["items"]:
            for p in it["points"]:
                cover[p].add(d["id"])
    print("sources:", len(sources), "headings:", sum(len(d["items"]) for d in sources))
    counts = sorted(((len(cover[p[0]]), p[0]) for p in POINTS))
    print("points:", len(POINTS), " covered by 0:", sum(1 for c, _ in counts if c == 0),
          " by 1:", sum(1 for c, _ in counts if c == 1), " by >=6:", sum(1 for c, _ in counts if c >= 6))
    print("uncovered:", [names[p] for c, p in counts if c == 0])
    print("single-source:", [(names[p], sorted(cover[p])) for c, p in counts if c == 1])
    um = defaultdict(list)
    for d in sources:
        for it in d["items"]:
            if not it["points"] and not it.get("skipped") and d["id"] != "exercism":
                um[d["id"]].append(it["heading"])
    tot = sum(len(v) for v in um.values())
    print("unmatched headings:", tot)
    if verbose:
        for s, hs in um.items():
            print(f"-- {s} ({len(hs)}): " + " | ".join(hs))
    return sources, cover


if __name__ == "__main__":
    run(verbose="-v" in sys.argv)

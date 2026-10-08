"""Test the AI-drawn links: draft A vs draft B, against the sources' teaching order, and against Exercism's
human-written prerequisites.  Writes graph.json for the page and prints the numbers."""
import json, os, itertools
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(f"{HERE}/points.json"))
ids = [p["id"] for p in P["points"]]
name = {p["id"]: p["name"] for p in P["points"]}
area = {p["id"]: p["area"] for p in P["points"]}
A = json.load(open(f"{HERE}/deps_A.json"))
B = json.load(open(f"{HERE}/deps_B.json"))
S = json.load(open(f"{HERE}/mapped.json"))


def edges(D, kind):
    return {(pre, q) for q, v in D.items() for pre in v.get(kind, [])}


def closure(E):
    par = defaultdict(set)
    for a, b in E:
        par[b].add(a)
    memo = {}

    def anc(x, seen=()):
        if x in memo:
            return memo[x]
        out = set()
        for p in par[x]:
            out.add(p)
            out |= anc(p)
        memo[x] = out
        return out
    return {x: anc(x) for x in ids}


nA, nB = edges(A, "needs"), edges(B, "needs")
hA, hB = edges(A, "helps"), edges(B, "helps")
ancA, ancB = closure(nA), closure(nB)
both = nA & nB
only = (nA | nB) - both
implied = {e for e in only if (e in nA and e[0] in ancB[e[1]]) or (e in nB and e[0] in ancA[e[1]])}
cross = {e for e in only if (e in nA and e in hB) or (e in nB and e in hA)}
reversed_ = {e for e in nA if (e[1], e[0]) in nB}
R = {"needs_A": len(nA), "needs_B": len(nB), "same_direct": len(both),
     "jaccard_direct": round(len(both) / len(nA | nB), 3),
     "one_draft_but_implied_by_other_chain": len(implied),
     "needs_in_one_helps_in_other": len(cross),
     "opposite_direction": len(reversed_),
     "one_draft_only_not_implied": len(only - implied)}

# ---------- teaching order in the sources ----------
pos = defaultdict(dict)   # source -> point -> first position (0..1)
cover = defaultdict(lambda: defaultdict(list))  # point -> source -> [headings]
for d in S:
    n = max(1, len(d["items"]) - 1)
    for it in d["items"]:
        for p in it["points"]:
            pos[d["id"]].setdefault(p, it["order"] / n)
            cover[p][d["id"]].append({"h": it["heading"], "u": it.get("url", d["url"]), "c": it.get("chapter", "")})
ordered_sources = [d["id"] for d in S if d["id"] != "exercism"]


def order_support(a, b):
    """how many sources teach a before b, and how many teach b before a (same heading counts as neither)"""
    before = after = 0
    for s in ordered_sources:
        if a in pos[s] and b in pos[s]:
            if pos[s][a] < pos[s][b]:
                before += 1
            elif pos[s][a] > pos[s][b]:
                after += 1
    return before, after


union = nA | nB
contra = []
for a, b in union:
    bf, af = order_support(a, b)
    if bf + af >= 3 and af > bf:
        contra.append((a, b, bf, af))
R["needs_links_against_majority_order"] = len(contra)
R["needs_links_with_order_evidence"] = sum(1 for a, b in union if sum(order_support(a, b)) >= 3)

# pairs the sources disagree on (both points in >= 6 sources, split at least 35/65)
split = []
common = [p for p in ids if sum(1 for s in ordered_sources if p in pos[s]) >= 6]
for a, b in itertools.combinations(common, 2):
    bf, af = order_support(a, b)
    if bf + af >= 6 and min(bf, af) / (bf + af) >= 0.35:
        split.append((a, b, bf, af))
R["popular_point_pairs"] = len(common) * (len(common) - 1) // 2
R["pairs_sources_split_on_order"] = len(split)

# ---------- Exercism: human-written prerequisites ----------
EX_MAIN = {"basics": "variables", "bools": "bool", "numbers": "numbers", "conditionals": "if", "comparisons": "compare",
           "string-methods": "strmethods", "strings": "strbasics", "string-formatting": "fstrings", "lists": "listbasics",
           "list-methods": "listmethods", "loops": "for", "tuples": "tuples", "dicts": "dictbasics", "dict-methods": "dictviews",
           "unpacking-and-multiple-assignment": "unpacking", "sets": "sets", "classes": "classes", "generators": "generators",
           "none": "none", "comprehensions": "listcomp", "sequences": "sequences", "functions": "def"}
ex = [d for d in S if d["id"] == "exercism"][0]
human = set()
for it in ex["items"]:
    q = EX_MAIN.get(it["slug"])
    for pre in it["prerequisites"]:
        p = EX_MAIN.get(pre)
        if q and p and p != q:
            human.add((p, q))
hum = []
for p, q in sorted(human):
    inA, inB = p in ancA[q], p in ancB[q]
    revA, revB = q in ancA[p], q in ancB[p]
    soft = (p, q) in hA or (p, q) in hB
    hum.append({"pre": p, "q": q, "A": inA, "B": inB, "soft": soft, "against": revA or revB})
R["human_links"] = len(hum)
R["human_links_in_A_chain"] = sum(h["A"] for h in hum)
R["human_links_in_B_chain"] = sum(h["B"] for h in hum)
R["human_links_in_neither_needs_chain"] = sum(1 for h in hum if not h["A"] and not h["B"])
R["human_links_neither_but_soft"] = sum(1 for h in hum if not h["A"] and not h["B"] and h["soft"])
R["human_links_AI_reversed"] = sum(h["against"] for h in hum)

# ---------- coverage ----------
cnt = {p: len(cover[p]) for p in ids}
R["points"] = len(ids)
R["points_in_0_sources"] = sum(1 for p in ids if cnt[p] == 0)
R["points_in_1_2_sources"] = sum(1 for p in ids if 1 <= cnt[p] <= 2)
R["points_in_6_plus"] = sum(1 for p in ids if cnt[p] >= 6)

print(json.dumps(R, indent=1))
print("\nAGAINST ORDER:", [(name[a], name[b], f"{bf} before / {af} after") for a, b, bf, af in sorted(contra, key=lambda x: -x[3])][:25])
print("\nSPLIT:", [(name[a], name[b], bf, af) for a, b, bf, af in sorted(split, key=lambda x: -(x[2] + x[3]))][:30])
print("\nHUMAN MISSED:", [(name[h["pre"]], name[h["q"]], "soft" if h["soft"] else "") for h in hum if not h["A"] and not h["B"]])
print("\nHUMAN, AI REVERSED:", [(name[h["pre"]], name[h["q"]]) for h in hum if h["against"]])
print("\nOPPOSITE:", [(name[a], name[b]) for a, b in reversed_])
print("\nSAMPLE one-draft-only:", [(name[a], name[b], "A" if (a, b) in nA else "B") for a, b in sorted(only - implied)][:30])

# ---------- graph for the page ----------
def sup(a, b):
    bf, af = order_support(a, b)
    return [bf, af]

links = []
for a, b in sorted(nA | nB | hA | hB):
    inA = "needs" if (a, b) in nA else "helps" if (a, b) in hA else ""
    inB = "needs" if (a, b) in nB else "helps" if (a, b) in hB else ""
    if inA == "needs" and inB == "needs":
        kind = "agreed"
    elif "needs" in (inA, inB):
        kind = "contested"
    else:
        kind = "helps"
    bf, af = sup(a, b)
    links.append({"s": a, "t": b, "k": kind, "A": inA, "B": inB, "o": [bf, af],
                  "x": (a, b) in human})
meta = {d["id"]: {"name": d["name"], "author": d.get("author", ""), "url": d["url"], "kind": d.get("kind", ""),
                  "n": len(d["items"])} for d in S}
nodes = [{"id": p, "name": name[p], "area": area[p], "n": cnt[p],
          "src": {s: v for s, v in cover[p].items()}} for p in ids]
G = {"areas": P["areas"], "nodes": nodes, "links": links, "sources": meta, "stats": R,
     "against": [{"s": a, "t": b, "o": [bf, af]} for a, b, bf, af in contra],
     "split": [{"a": a, "b": b, "o": [bf, af]} for a, b, bf, af in split],
     "human": hum}
json.dump(G, open(f"{HERE}/graph.json", "w"), ensure_ascii=False)
print("\ngraph.json:", len(nodes), "nodes", len(links), "links")

"""How often do two points sit in the same chapter? (human evidence for 'strongly related')"""
import json, itertools
from collections import defaultdict
S = json.load(open("mapped.json")); P = json.load(open("points.json"))
name = {p["id"]: p["name"] for p in P["points"]}; area = {p["id"]: p["area"] for p in P["points"]}
chap = defaultdict(lambda: defaultdict(set))  # point -> source -> chapters
for d in S:
    if d["id"] == "exercism": continue
    for it in d["items"]:
        for p in it["points"]:
            chap[p][d["id"]].add(it.get("chapter", ""))
ids = [p["id"] for p in P["points"]]
sim = {}
for a, b in itertools.combinations(ids, 2):
    common = set(chap[a]) & set(chap[b])
    if len(common) < 2: continue
    same = sum(1 for s in common if chap[a][s] & chap[b][s])
    sim[(a, b)] = (same / len(common), len(common))
json.dump({f"{a}|{b}": v for (a, b), v in sim.items()}, open("cochapter.json", "w"))
# average-linkage clustering with a size cap
clusters = {i: [i] for i in ids}
def s(a, b):
    v = sim.get((a, b)) or sim.get((b, a))
    return v[0] if v else 0.0
def link(c1, c2):
    return sum(s(a, b) for a in c1 for b in c2) / (len(c1) * len(c2))
while True:
    best = None
    keys = list(clusters)
    for x, y in itertools.combinations(keys, 2):
        if len(clusters[x]) + len(clusters[y]) > 9: continue
        v = link(clusters[x], clusters[y])
        if v >= 0.5 and (best is None or v > best[0]): best = (v, x, y)
    if not best: break
    _, x, y = best
    clusters[x] += clusters.pop(y)
out = sorted(clusters.values(), key=lambda c: -len(c))
print(len(out), "clusters;", sum(1 for c in out if len(c) == 1), "singletons")
for c in out:
    if len(c) > 1:
        print(f"[{len(c)}]", " | ".join(name[x] for x in c))
print("SINGLETONS:", " | ".join(name[c[0]] for c in out if len(c) == 1))

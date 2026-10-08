"""Data for the big-ball page: points (as before) + balls, ball links (transitive reduction), cohesion."""
import json, os, sys, itertools
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from bundles import BUNDLES, check
G = json.load(open(f"{HERE}/graph.json"))
member, cross, cycles = check(False)
assert not cycles
co = json.load(open(f"{HERE}/cochapter.json"))
def coh(pts):
    vals = [ (co.get(f"{a}|{b}") or co.get(f"{b}|{a}"))[0] for a, b in itertools.combinations(pts, 2) if (co.get(f"{a}|{b}") or co.get(f"{b}|{a}"))]
    return round(100 * sum(vals) / len(vals)) if len(vals) >= 2 else None
par = {}
for (x, y) in cross: par.setdefault(y, set()).add(x)
@lru_cache(None)
def depth(b): return 0 if b not in par else 1 + max(depth(p) for p in par[b])
anc = {}
def ancs(b):
    if b in anc: return anc[b]
    out = set()
    for p in par.get(b, ()): out |= {p} | ancs(p)
    anc[b] = out; return out
red = [(x, y, len(cross[(x, y)])) for (x, y) in cross if not any(x in ancs(z) for z in par.get(y, ()) if z != x)]
# points: same compaction as build.py
src_order = ["atbs", "tutorial", "thinkpython", "pcc", "py4e", "cs50p", "helsinki", "mit", "kaggle", "pydata", "google", "byte", "exercism"]
nodes = []
chap = {}
for n in G["nodes"]:
    src = {}
    for s in src_order:
        if s in n["src"]:
            seen, hs = set(), []
            for h in n["src"][s]:
                if h["h"] in seen: continue
                seen.add(h["h"]); hs.append([h["h"], h["u"]])
            src[s] = hs[:4]
            chap.setdefault(n["id"], {})[s] = n["src"][s][0].get("c", "")
    nodes.append({"id": n["id"], "name": n["name"], "area": n["area"], "n": n["n"], "src": src})
data = {
    "areas": G["areas"], "nodes": nodes,
    "links": [[l["s"], l["t"], l["k"], l["A"], l["B"], l["o"][0], l["o"][1], 1 if l["x"] else 0] for l in G["links"]],
    "balls": [{"id": b, "name": nm, "area": a, "pts": pts, "coh": coh(pts), "d": depth(b)} for b, nm, a, pts in BUNDLES],
    "blinks": red,
    "sources": {s: G["sources"][s] for s in src_order},
    "stats": G["stats"],
    "against": [[a["s"], a["t"], a["o"][0], a["o"][1]] for a in G["against"]],
    "split": [[a["a"], a["b"], a["o"][0], a["o"][1]] for a in sorted(G["split"], key=lambda x: -(x["o"][0] + x["o"][1]))],
    "human": [[h["pre"], h["q"], int(h["A"]), int(h["B"]), int(h["soft"]), int(h["against"])] for h in G["human"]],
}
json.dump(dict(data, chap=chap), open(f"{HERE}/km_data.json", "w"), ensure_ascii=False, separators=(",", ":"))
tpl = open(f"{HERE}/map2_template.html").read()
out = tpl.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
open(f"{HERE}/python-knowledge-map.html", "w").write(out)
print("balls", len(BUNDLES), "ball links", len(red), "page bytes", len(out))

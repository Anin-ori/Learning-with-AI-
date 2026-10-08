"""Compact graph.json for the page, add depth (longest 'needs' chain), and inject it into the HTML template."""
import json, os
from functools import lru_cache

HERE = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(f"{HERE}/graph.json"))

needs = [(l["s"], l["t"]) for l in G["links"] if l["k"] in ("agreed", "contested")]
par = {}
for a, b in needs:
    par.setdefault(b, []).append(a)


@lru_cache(None)
def depth(x):
    return 0 if x not in par else 1 + max(depth(p) for p in par[x])


src_order = ["atbs", "tutorial", "thinkpython", "pcc", "py4e", "cs50p", "helsinki", "mit", "kaggle", "pydata", "google", "byte", "exercism"]
nodes = []
for n in G["nodes"]:
    src = {}
    for s in src_order:
        if s in n["src"]:
            seen, hs = set(), []
            for h in n["src"][s]:
                if h["h"] in seen:
                    continue
                seen.add(h["h"])
                hs.append([h["h"], h["u"]])
            src[s] = hs[:4]
    nodes.append({"id": n["id"], "name": n["name"], "area": n["area"], "n": n["n"], "d": depth(n["id"]), "src": src})

data = {
    "areas": G["areas"], "nodes": nodes,
    "links": [[l["s"], l["t"], l["k"], l["A"], l["B"], l["o"][0], l["o"][1], 1 if l["x"] else 0] for l in G["links"]],
    "sources": {s: G["sources"][s] for s in src_order},
    "stats": G["stats"],
    "against": [[a["s"], a["t"], a["o"][0], a["o"][1]] for a in G["against"]],
    "split": [[a["a"], a["b"], a["o"][0], a["o"][1]] for a in sorted(G["split"], key=lambda x: -(x["o"][0] + x["o"][1]))],
    "human": [[h["pre"], h["q"], int(h["A"]), int(h["B"]), int(h["soft"]), int(h["against"])] for h in G["human"]],
}
print("max depth", max(n["d"] for n in nodes), "depth counts", {d: sum(1 for n in nodes if n["d"] == d) for d in range(15)})
tpl = open(f"{HERE}/map_template.html").read()
out = tpl.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
open(f"{HERE}/python-knowledge-map.html", "w").write(out)
print("page bytes", len(out))

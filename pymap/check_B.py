import json
pts = json.load(open('points.json'))['points']
ids = {p['id'] for p in pts}
d = json.load(open('deps_B.json'))
errs = []
if len(ids) != 153: errs.append(f"points count {len(ids)}")
missing = ids - d.keys(); extra = d.keys() - ids
if missing: errs.append(f"missing {missing}")
if extra: errs.append(f"extra {extra}")
for k, v in d.items():
    for kind in ('needs', 'helps'):
        for x in v[kind]:
            if x not in ids: errs.append(f"{k}.{kind} invalid {x}")
            if x == k: errs.append(f"{k}.{kind} self-link")
        if len(set(v[kind])) != len(v[kind]): errs.append(f"{k}.{kind} duplicate")
    both = set(v['needs']) & set(v['helps'])
    if both: errs.append(f"{k} in both needs and helps {both}")
# cycles in needs
state = {}
def dfs(u, stack):
    state[u] = 1
    for w in d.get(u, {}).get('needs', []):
        if state.get(w) == 1: errs.append("cycle: " + " -> ".join(stack + [u, w]))
        elif w in d and state.get(w) is None: dfs(w, stack + [u])
    state[u] = 2
for u in d:
    if state.get(u) is None: dfs(u, [])
# extra diagnostics (not required): transitive redundancy and helps contradictions
from functools import lru_cache
@lru_cache(None)
def clos(u):
    s = set()
    for w in d[u]['needs']:
        s.add(w); s |= clos(w)
    return frozenset(s)
warn = []
if not any(e.startswith('cycle') for e in errs):
    for k, v in d.items():
        for x in v['needs']:
            if any(x in clos(y) for y in v['needs'] if y != x): warn.append(f"redundant need {k}->{x}")
        for x in v['helps']:
            if k in clos(x): warn.append(f"contradiction: {k} helped by {x} but {x} needs {k}")
            if x in clos(k): warn.append(f"helps already implied by needs: {k}->{x}")
nn = sum(len(v['needs']) for v in d.values()); nh = sum(len(v['helps']) for v in d.values())
print("needs links:", nn, "helps links:", nh)
print("ERRORS:", errs or "none")
print("WARNINGS:", warn or "none")

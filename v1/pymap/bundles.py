"""Big balls: strongly related points bundled together (AI-drafted, guided by how often books teach them in the
same chapter), then checked: every point in exactly one ball, no cycles between balls, cohesion per ball."""
import json, itertools
from collections import defaultdict

BUNDLES = [
    ("start", "Getting started", "start", ["run", "jupyter", "print", "comments", "tracebacks"]),
    ("numbers", "Numbers and arithmetic", "values", ["numbers", "arith", "precedence", "intdiv", "floatprec"]),
    ("vars", "Variables and types", "values", ["variables", "augassign", "names", "types", "convert", "exprstmt", "input", "callfn"]),
    ("bools", "Booleans and comparisons", "cond", ["bool", "compare", "logic", "shortcirc"]),
    ("ifs", "if, elif and else", "cond", ["if", "else", "nestedif", "condexpr", "blocks", "pass", "match", "truthy"]),
    ("while", "while loops", "loops", ["while", "infinite", "breakcont"]),
    ("for", "for loops", "loops", ["for", "range", "nestedloops", "loopelse", "enumzip", "looppat"]),
    ("funcs", "Writing functions", "func", ["def", "params", "return", "retprint", "none", "decomp"]),
    ("scope", "Scope and recursion", "func", ["scope", "callstack", "recursion"]),
    ("args", "More about arguments", "func", ["defaults", "kwargs", "varargs", "docstrings", "typehints"]),
    ("fnvalues", "Functions as values", "func", ["lambda", "higherorder", "decorators"]),
    ("strings", "Strings", "str", ["strbasics", "escapes", "multiline", "concat"]),
    ("format", "Formatting output", "str", ["fstrings", "formatmethod"]),
    ("strwork", "Working with strings", "str", ["len", "strindex", "strslice", "immut", "strmethods", "insearch", "splitjoin", "parsing", "unicode"]),
    ("lists", "Lists", "list", ["listbasics", "listindex", "listslice", "listmodify", "listmethods", "listfuncs", "del", "sorting"]),
    ("refs", "References and copies", "list", ["nested", "alias", "copying", "mutateargs", "mutable", "stackqueue"]),
    ("tuples", "Tuples, sets and sequences", "tuple", ["tuples", "unpacking", "sequences", "sets", "setops"]),
    ("dicts", "Dictionaries", "dict", ["dictbasics", "dictviews", "dictloop", "dictget", "counting", "nesteddata"]),
    ("comps", "Comprehensions and generators", "iter", ["listcomp", "othercomp", "nestedcomp", "genexpr", "iterators", "generators"]),
    ("files", "Reading and writing files", "files", ["paths", "readfiles", "writefiles", "with", "organize"]),
    ("formats", "CSV, JSON and saved data", "files", ["csv", "json", "pickle"]),
    ("errors", "Exceptions", "err", ["exceptions", "tryexcept", "raise", "finally", "customexc", "validation"]),
    ("debug", "Debugging, testing and style", "err", ["debugging", "assert", "logging", "testing", "style"]),
    ("usemods", "Using modules", "mod", ["import", "help", "mathmod", "random", "datetime", "stdlib"]),
    ("ownmods", "Your own modules and tools", "mod", ["ownmodules", "packages", "pip", "venv", "cliargs"]),
    ("classes", "Classes and objects", "oop", ["objmethods", "classes", "initattrs", "methods", "strrepr"]),
    ("oopmore", "More object-oriented design", "oop", ["dunder", "inherit", "encaps", "classattrs", "composition", "dataclasses"]),
    ("regex", "Regular expressions", "regex", ["rxbasics", "rxsyntax", "rxextract"]),
    ("algos", "Algorithms and efficiency", "beyond", ["searchalg", "sortalg", "complexity", "approx"]),
    ("webdata", "Web, databases and plots", "beyond", ["web", "databases", "plotting"]),
]


def check(verbose=True):
    G = json.load(open("graph.json"))
    ids = [n["id"] for n in G["nodes"]]
    name = {n["id"]: n["name"] for n in G["nodes"]}
    member = {}
    for bid, _, _, pts in BUNDLES:
        for p in pts:
            assert p in name, p
            assert p not in member, f"{p} twice"
            member[p] = bid
    missing = [p for p in ids if p not in member]
    assert not missing, missing
    needs = [(l["s"], l["t"]) for l in G["links"] if l["k"] != "helps"]
    cross = defaultdict(list)
    for a, b in needs:
        if member[a] != member[b]:
            cross[(member[a], member[b])].append((a, b))
    # cycles between balls
    adj = defaultdict(set)
    for (x, y) in cross:
        adj[x].add(y)
    def reach(x, y, seen=None):
        seen = seen or set()
        if x == y: return True
        seen.add(x)
        return any(reach(z, y, seen) for z in adj[x] if z not in seen)
    cycles = [(x, y, cross[(x, y)]) for (x, y) in cross if reach(y, x)]
    co = json.load(open("cochapter.json"))
    def coh(pts):
        vals = []
        for a, b in itertools.combinations(pts, 2):
            v = co.get(f"{a}|{b}") or co.get(f"{b}|{a}")
            if v: vals.append(v[0])
        return (sum(vals) / len(vals), len(vals)) if vals else (None, 0)
    if verbose:
        print(len(BUNDLES), "balls,", len(member), "points, cross-ball links", sum(len(v) for v in cross.values()), "between", len(cross), "ball pairs")
        for bid, nm, _, pts in BUNDLES:
            c, n = coh(pts)
            print(f"  {nm:38} {len(pts)} pts  same-chapter {('%.0f%%' % (100 * c)) if c is not None else ' n/a':>5} ({n} pairs)")
        print("CYCLES:")
        for x, y, ls in cycles:
            print(f"  {x} -> {y}:", [(name[a], name[b]) for a, b in ls])
    return member, cross, cycles


if __name__ == "__main__":
    check()

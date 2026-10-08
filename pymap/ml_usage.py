"""I28 evidence: which Python points real machine-learning course code actually uses.

Reads the public code of six ML courses (cloned to ../../mlsrc), parses every code cell with Python's own parser
(no AI involved), and counts, for each map point that is visible in code, how many courses use it.
Points that can't be seen in code (reading tracebacks, debugging, venv...) are reported as "not measurable".
Output: ml_usage.json (per point: courses using it, share of files) and a short table on stdout.
"""
import ast, glob, json, os, re, sys, collections, warnings
warnings.filterwarnings("ignore", category=SyntaxWarning)   # escape-sequence warnings from the courses' own code

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("MLSRC", os.path.join(os.path.dirname(os.path.dirname(HERE)), "mlsrc"))

COURSES = {
    "kaggle_ml": ("Kaggle Learn ML track (Intro to ML, Intermediate ML, Pandas, Feature Engineering, Intro to Deep Learning)",
                  [f"kaggle/notebooks/{c}/raw/*.ipynb" for c in ["machine_learning", "ml_intermediate", "pandas", "feature_engineering_new", "deep_learning_intro"]]),
    "handson": ("Hands-On Machine Learning, 3rd ed. (Géron), chapter notebooks", ["handson/[01][0-9]_*.ipynb"]),
    "pydata": ("Python for Data Analysis, 3rd ed., ch. 4-13 (NumPy, pandas, plotting, modeling)", [f"pydata/ch{n:02d}.ipynb" for n in range(4, 14)]),
    "fastbook": ("fast.ai Practical Deep Learning book (fastbook)", ["fastbook/[012][0-9]_*.ipynb"]),
    "mlcc": ("Google Machine Learning Crash Course exercises", ["mlcc/ml/cc/**/*.ipynb"]),
    "sklearn": ("scikit-learn example gallery", ["sklearn/examples/**/*.py"]),
}

def code_of(path):
    if path.endswith(".ipynb"):
        nb = json.load(open(path, encoding="utf-8"))
        cells = [c for c in nb.get("cells", []) if c.get("cell_type") == "code"]
        md = "\n".join("".join(c.get("source", [])) for c in nb.get("cells", []) if c.get("cell_type") == "markdown")
        return ["".join(c.get("source", [])) for c in cells], md, True
    return [open(path, encoding="utf-8", errors="replace").read()], "", False

MAGIC = re.compile(r"^\s*([%!]|\?)|\?\s*$")
def parse(src):
    lines = [("pass" if MAGIC.search(l) else l) for l in src.split("\n")]
    try:
        return ast.parse("\n".join(lines))
    except SyntaxError:
        return None

BUILTIN_CALLS = {"abs", "round", "min", "max", "sum", "len", "print", "int", "float", "str", "type", "isinstance", "range", "list", "dict", "set", "tuple", "sorted", "enumerate", "zip", "open", "any", "all", "map", "filter"}
STR_METHODS = {"lower", "upper", "strip", "lstrip", "rstrip", "replace", "startswith", "endswith", "find", "title", "capitalize", "count", "isdigit", "isalpha"}

def features(tree, raw, is_nb):
    f = set()
    if is_nb: f.add("jupyter")
    if re.search(r"^\s*[!%]\s*pip\s+install", raw, re.M): f.add("pip")
    if re.search(r"^\s*#", raw, re.M) or re.search(r"\S\s+#\s", raw): f.add("comments")
    if re.search(r"^\s*\w[\w.]*\?\s*$", raw, re.M): f.add("help")
    if tree is None: return f
    defs = {}
    for n in ast.walk(tree):
        t = type(n).__name__
        if isinstance(n, (ast.Import, ast.ImportFrom)):
            f.add("import")
            mods = [a.name for a in n.names] if isinstance(n, ast.Import) else [n.module or ""]
            for m in mods:
                top = m.split(".")[0]
                for k, v in {"random": "random", "pickle": "pickle", "joblib": "pickle", "shelve": "pickle", "json": "json", "csv": "csv",
                             "matplotlib": "plotting", "seaborn": "plotting", "plotly": "plotting", "pathlib": "paths", "shutil": "organize",
                             "logging": "logging", "unittest": "testing", "pytest": "testing", "datetime": "datetime", "math": "mathmod",
                             "re": "rxbasics", "requests": "web", "urllib": "web", "sqlite3": "databases", "sqlalchemy": "databases",
                             "argparse": "cliargs", "dataclasses": "dataclasses", "copy": "copying", "collections": "stdlib", "itertools": "stdlib", "functools": "stdlib"}.items():
                    if top == k: f.add(v)
                if m == "os.path" or (top == "os"): f.add("paths")
        elif isinstance(n, ast.Call):
            fn = n.func
            if any(k.arg is not None for k in n.keywords): f.add("kwargs")
            if any(k.arg is None for k in n.keywords) or any(isinstance(a, ast.Starred) for a in n.args): f.add("varargs")
            if isinstance(fn, ast.Name):
                nm = fn.id
                if nm in BUILTIN_CALLS: f.add("callfn")
                for k, v in {"print": "print", "len": "len", "range": "range", "enumerate": "enumzip", "zip": "enumzip", "sorted": "sorting",
                             "min": "listfuncs", "max": "listfuncs", "sum": "listfuncs", "int": "convert", "float": "convert", "str": "convert",
                             "type": "types", "isinstance": "types", "open": "readfiles", "iter": "iterators", "next": "iterators", "input": "input",
                             "help": "help", "dir": "help", "set": "sets", "dict": "dictbasics", "Path": "paths"}.items():
                    if nm == k: f.add(v)
                if nm == "open" and any(isinstance(a, ast.Constant) and isinstance(a.value, str) and a.value[:1] in "wa" for a in n.args[1:2]): f.add("writefiles")
                if nm == "open" and any(k.arg == "mode" and isinstance(k.value, ast.Constant) and str(k.value.value)[:1] in "wa" for k in n.keywords): f.add("writefiles")
            elif isinstance(fn, ast.Attribute):
                f.add("objmethods"); a = fn.attr
                if a in ("items", "keys", "values"): f.add("dictviews")
                if a in ("get", "setdefault") and n.args: f.add("dictget")
                if a in ("append", "extend", "insert", "pop", "remove"): f.add("listmethods")
                if a == "sort": f.add("sorting")
                if a in ("split", "join"): f.add("splitjoin")
                if a in STR_METHODS: f.add("strmethods")
                if a == "format" and isinstance(fn.value, ast.Constant) and isinstance(fn.value.value, str): f.add("formatmethod")
                if a in ("union", "intersection", "difference"): f.add("setops")
                if a == "copy": f.add("copying")
                if a in ("dump", "load") and isinstance(fn.value, ast.Name) and fn.value.id in ("pickle", "joblib"): f.add("pickle")
            if any(isinstance(a, ast.Lambda) for a in n.args) or any(isinstance(k.value, ast.Lambda) for k in n.keywords): f.add("higherorder")
        elif isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)):
            f.add("def"); defs[n.name] = n
            A = n.args
            if A.args or A.kwonlyargs or A.posonlyargs: f.add("params")
            if A.defaults or A.kw_defaults and any(d is not None for d in A.kw_defaults): f.add("defaults")
            if A.vararg or A.kwarg: f.add("varargs")
            if n.returns or any(a.annotation for a in A.args + A.kwonlyargs): f.add("typehints")
            if n.decorator_list:
                f.add("decorators")
                for d in n.decorator_list:
                    dn = d.id if isinstance(d, ast.Name) else d.attr if isinstance(d, ast.Attribute) else ""
                    if dn in ("classmethod", "staticmethod"): f.add("classattrs")
                    if dn in ("property", "setter"): f.add("encaps")
            if n.body and isinstance(n.body[0], ast.Expr) and isinstance(n.body[0].value, ast.Constant) and isinstance(n.body[0].value.value, str): f.add("docstrings")
            if any(isinstance(x, ast.Call) and isinstance(x.func, ast.Name) and x.func.id == n.name for x in ast.walk(n)): f.add("recursion")
            if any(isinstance(x, (ast.Yield, ast.YieldFrom)) for x in ast.walk(n)): f.add("generators")
        elif isinstance(n, ast.ClassDef):
            f.add("classes")
            if [b for b in n.bases if not (isinstance(b, ast.Name) and b.id == "object")]: f.add("inherit")
            if any((isinstance(b, ast.Name) and re.search(r"(Error|Exception)$", b.id)) for b in n.bases): f.add("customexc")
            for d in n.decorator_list:
                dn = d.id if isinstance(d, ast.Name) else d.attr if isinstance(d, ast.Attribute) else d.func.id if isinstance(d, ast.Call) and isinstance(d.func, ast.Name) else ""
                if dn == "dataclass": f.add("dataclasses")
            for b in n.body:
                if isinstance(b, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    f.add("methods")
                    if b.name == "__init__": f.add("initattrs")
                    elif b.name in ("__str__", "__repr__"): f.add("strrepr"); f.add("dunder")
                    elif b.name.startswith("__") and b.name.endswith("__"): f.add("dunder")
                if isinstance(b, (ast.Assign, ast.AnnAssign)): f.add("classattrs")
        elif t == "Lambda": f.add("lambda")
        elif t == "JoinedStr": f.add("fstrings")
        elif t == "BinOp":
            if isinstance(n.op, (ast.FloorDiv,)) or (isinstance(n.op, ast.Mod) and not (isinstance(n.left, ast.Constant) and isinstance(n.left.value, str))): f.add("intdiv")
            if isinstance(n.op, ast.Mod) and isinstance(n.left, ast.Constant) and isinstance(n.left.value, str): f.add("formatmethod")
            if isinstance(n.op, ast.Add) and (isinstance(n.left, ast.Constant) and isinstance(n.left.value, str) or isinstance(n.right, ast.Constant) and isinstance(n.right.value, str)): f.add("concat")
            f.add("arith")
        elif t == "AugAssign": f.add("augassign")
        elif t == "Assign":
            f.add("variables")
            if any(isinstance(x, (ast.Tuple, ast.List)) for x in n.targets): f.add("unpacking")
        elif t == "AnnAssign": f.add("typehints"); f.add("variables")
        elif t == "For":
            f.add("for")
            if isinstance(n.target, ast.Tuple): f.add("unpacking")
            if n.orelse: f.add("loopelse")
            if any(isinstance(x, (ast.For, ast.While)) for b in n.body for x in ast.walk(b)): f.add("nestedloops")
            if isinstance(n.iter, ast.Call) and isinstance(n.iter.func, ast.Attribute) and n.iter.func.attr == "items": f.add("dictloop")
        elif t == "While":
            f.add("while")
            if isinstance(n.test, ast.Constant) and n.test.value is True: f.add("infinite")
            if n.orelse: f.add("loopelse")
        elif t in ("Break", "Continue"): f.add("breakcont")
        elif t == "If":
            f.add("if")
            if n.orelse: f.add("else")
            if any(isinstance(x, ast.If) for b in n.body for x in ast.walk(b)): f.add("nestedif")
        elif t == "IfExp": f.add("condexpr")
        elif t == "Match": f.add("match")
        elif t == "Pass": f.add("pass")
        elif t == "Compare":
            f.add("compare")
            if any(isinstance(o, (ast.In, ast.NotIn)) for o in n.ops): f.add("insearch")
        elif t == "BoolOp": f.add("logic")
        elif t == "UnaryOp" and isinstance(n.op, ast.Not): f.add("logic")
        elif t == "Constant":
            if n.value is None: f.add("none")
            elif isinstance(n.value, bool): f.add("bool")
            elif isinstance(n.value, str): f.add("strbasics")
            elif isinstance(n.value, (int, float)): f.add("numbers")
        elif t == "Try":
            f.add("tryexcept"); f.add("exceptions")
            if n.finalbody or n.orelse: f.add("finally")
        elif t == "Raise": f.add("raise"); f.add("exceptions")
        elif t == "Assert": f.add("assert")
        elif t == "With": f.add("with")
        elif t == "Return": f.add("return")
        elif t in ("Global", "Nonlocal"): f.add("scope")
        elif t == "Delete": f.add("del")
        elif t == "ListComp": f.add("listcomp")
        elif t in ("DictComp", "SetComp"): f.add("othercomp")
        elif t == "GeneratorExp": f.add("genexpr")
        elif t == "Dict": f.add("dictbasics")
        elif t == "Set": f.add("sets")
        elif t == "Tuple": f.add("tuples")
        elif t == "List":
            f.add("listbasics")
            if any(isinstance(e, ast.List) for e in n.elts): f.add("nested")
        elif t == "Subscript":
            if isinstance(n.slice, ast.Slice) or (isinstance(n.slice, ast.Tuple) and any(isinstance(e, ast.Slice) for e in n.slice.elts)): f.add("listslice")
            else: f.add("listindex")
        if isinstance(n, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)) and (len(n.generators) > 1 or any(isinstance(x, (ast.ListComp, ast.DictComp, ast.SetComp)) for g in n.generators for x in ast.walk(g.iter))):
            f.add("nestedcomp")
    return f

def main():
    km = json.load(open(os.path.join(HERE, "km_data.json")))
    names = {n["id"]: n["name"] for n in km["nodes"]}
    per = {}
    for cid, (title, pats) in COURSES.items():
        files = sorted({p for pat in pats for p in glob.glob(os.path.join(SRC, pat), recursive=True)})
        cnt, nfiles, parsed = collections.Counter(), 0, 0
        for p in files:
            cells, md, nb = code_of(p)
            raw = "\n".join(cells)
            if not raw.strip(): continue
            nfiles += 1
            fs = set()
            for c in cells:
                tr = parse(c); parsed += tr is not None
                fs |= features(tr, c, nb)
            if re.search(r"pip install", md): fs.add("pip")
            cnt.update(fs)
        per[cid] = {"title": title, "files": nfiles, "cells_parsed": parsed, "use": dict(cnt)}
    seen = set().union(*[set(c["use"]) for c in per.values()])
    measurable = sorted(set(names) & (seen | {"pip", "help", "comments"}))
    out = {"courses": per, "points": {}}
    for pid in names:
        if pid not in measurable:
            out["points"][pid] = {"measurable": False}; continue
        using = {cid: round(c["use"].get(pid, 0) / c["files"], 3) for cid, c in per.items() if c["use"].get(pid, 0) >= 2}
        out["points"][pid] = {"measurable": True, "courses": len(using), "share": using}
    json.dump(out, open(os.path.join(HERE, "ml_usage.json"), "w"), indent=1)
    for cid, c in per.items(): print(f"{cid:9s} {c['files']:4d} files  {c['title']}")
    return out, names

if __name__ == "__main__":
    main()

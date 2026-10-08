"""Draft knowledge points (AI-written) and the rules that find them in the human sources' headings.

Each rule: (point id, regex that must match the heading, regex that must NOT match, context regex that
heading + chapter must match).  Points are grouped into areas (the big balls)."""

AREAS = [
    ("start", "Getting started"),
    ("values", "Values & variables"),
    ("cond", "Booleans & conditions"),
    ("loops", "Loops"),
    ("func", "Functions"),
    ("str", "Strings"),
    ("list", "Lists"),
    ("tuple", "Tuples & sequences"),
    ("dict", "Dictionaries & sets"),
    ("iter", "Comprehensions & iterators"),
    ("files", "Files & data formats"),
    ("err", "Errors, debugging & testing"),
    ("mod", "Modules & libraries"),
    ("oop", "Classes & objects"),
    ("regex", "Regular expressions"),
    ("beyond", "Algorithms, web & data"),
]

L = r"\blists?\b"
S = r"\bstr(ings?)?\b|text|substring|character"
D = r"dict"
RX = r"regular expression|regex|pattern matching|\bre\b module"

# (id, area, name, include, exclude, context)
POINTS = [
    # Getting started
    ("run", "start", "Running Python: interpreter and scripts",
     r"interpreter|invoking|running python|^installation|install(ing)? python|python prompt|source file|executing code|writing a program|first program|python source code|run(ning)? (a |your )?program|editor|\bide\b|vs ?code|hello,? (python|world)|interactive mode|getting started|first steps", r"debugger|pygame", None),
    ("jupyter", "start", "Jupyter and IPython", r"jupyter|ipython|notebook", None, None),
    ("print", "start", "print()", r"\bprint(ing)?\b|output to the screen", r"f.string|format|object|debug", None),
    ("comments", "start", "Comments", r"comment", None, None),
    ("tracebacks", "start", "Reading error messages and tracebacks", r"traceback|error messages?|syntax errors?|what could possibly go wrong|typical errors|runtime error|checked at runtime|indexerror|nameerror|typeerror", None, None),
    ("help", "start", "Getting help: help(), dir(), docs", r"getting help|help\(\)|\bdir\b|online help|tools for understanding|introspection|documentation(?! strings)", None, None),
    # Values
    ("numbers", "values", "Numbers: int and float", r"\bnumbers?\b|integers?|\bint\b|floats?\b|floating.point numbers|numeric types", r"random|binary|complex|precision|as input|arithmetic", None),
    ("arith", "values", "Arithmetic operators", r"arithmetic|operators and operands|operators and expressions|calculator|math operators|^operators$|numbers and arithmetic|integer operations", None, None),
    ("precedence", "values", "Order of operations", r"order of operations|precedence|evaluation order", None, None),
    ("intdiv", "values", "Integer division and modulus", r"modul(o|us)|integer division|floor division|remainder", r"module", None),
    ("floatprec", "values", "Floating-point precision", r"floating.point arithmetic|precision|representation error|issues and limitations|rounding", None, None),
    ("types", "values", "Values and types, type()", r"values and types|data types?|\btype\(|\btypes\b|type of|dynamic(ally)? typ|scalar types", r"conver|hint|user.defined|sequence|mutable|immutable", None),
    ("convert", "values", "Type conversion: int(), str(), float()", r"conver(sion|t|ting)|casting|type cast|str\(\)|int\(\)|float\(\)", None, None),
    ("variables", "values", "Variables and assignment", r"(?<!local )(?<!global )\bvariables?\b|assignment statements?|referencing a variable|^assignment$", r"updat|chang|number of|scope|names|instance|class|keyword|environment|local|global|saving variables|multiple|helper|as parameters", None),
    ("augassign", "values", "Updating variables (+=)", r"updat(e|ing) (a )?variables?|augmented|\+=|changing the value of a variable|increment", None, None),
    ("names", "values", "Naming rules and keywords", r"variable names|naming|identifier|keywords|mnemonic|reserved words", r"argument", None),
    ("exprstmt", "values", "Expressions vs statements", r"expressions? (and|vs\.?|versus) statements?|^statements?$|^expressions?$|expression statements", None, None),
    ("input", "values", "Reading user input: input()", r"\binput\(|input\b(?!/output| and output| validation|s?\.)|from the user|asking the user|keyboard input|user input", r"files?|output", None),
    ("none", "values", "None", r"\bnone\b|null|absence of a value", None, None),
    ("mathmod", "values", "The math module", r"math functions|math module|\bmath\b(?! operators)", None, None),
    # Conditions
    ("bool", "cond", "Boolean values", r"boolean(?! operators| conversion)|\bbools?\b|true and false|^booleans?$|boolean (values|expressions|type)", None, None),
    ("compare", "cond", "Comparison operators", r"comparison|comparing|relational operators", r"sequences|objects|times", None),
    ("logic", "cond", "and, or, not", r"logical operators|boolean operators|combining (boolean|conditions)|and, or|\bnot\b|and/or|chaining conditions", None, None),
    ("shortcirc", "cond", "Short-circuit evaluation", r"short.circuit", None, None),
    ("truthy", "cond", "Truthiness", r"truth(y|iness)|boolean conversion|falsy|truth value", None, None),
    ("if", "cond", "if statements", r"\bif\b|conditional (execution|statements?)|^conditionals?$|branching|flow control|control flow|decisions?", r"__name__|elif|else|single line|nested|one.line", None),
    ("else", "cond", "else and elif", r"\belse\b|\belif\b|alternative (execution|branches)|chained conditionals", r"loops?|for.*else|try|exception", None),
    ("nestedif", "cond", "Nested conditionals", r"nested conditionals|nested if", None, None),
    ("condexpr", "cond", "Conditional expressions (x if c else y)", r"conditional expressions?|ternary|single line conditionals|one.line if", None, None),
    ("match", "cond", "match statements", r"match statements?|structural pattern matching|match.case", None, None),
    ("pass", "cond", "pass and empty blocks", r"\bpass\b|empty\W*block", None, None),
    # Loops
    ("while", "loops", "while loops", r"\bwhile\b", r"true", None),
    ("infinite", "loops", "Infinite loops and while True", r"infinite loops?|while true", None, None),
    ("breakcont", "loops", "break and continue", r"\bbreak\b|\bcontinue\b", None, None),
    ("for", "loops", "for loops", r"\bfor (loops?|statements?)\b|^for\b|for and in|definite iteration|^loops?$|simple loops|^iteration$|traversal|traversing|looping (through|over)|loops with|iterating (over|through)|more loops|^loops and", r"while|nested|else|comprehension|dict", None),
    ("range", "loops", "range()", r"\brange\b", None, None),
    ("nestedloops", "loops", "Nested loops", r"nested loops?", None, None),
    ("loopelse", "loops", "else on loops", r"else clauses? on loops|loops? with else|for.*else", None, None),
    ("enumzip", "loops", "enumerate() and zip()", r"enumerate|\bzip\(|\bzip\b(?! files)|looping techniques", None, None),
    ("looppat", "loops", "Loop patterns: count, sum, find max", r"counting and summing|summing|accumulat|loop patterns|maximum and minimum loops|finding the (best|worst)|helper variables|average", None, None),
    # Functions
    ("callfn", "func", "Calling built-in functions", r"function calls?|calling functions|built.?in functions|builtin functions|calling a function|^calls$|arguments$", r"within function|stack", None),
    ("def", "func", "Defining functions", r"defin(e|ing) (new )?functions?|function definition|adding new functions|user.defined functions|^functions?$|^def\b|writing functions|creating functions|^more functions$|defining a function|the def statement", None, None),
    ("params", "func", "Parameters and arguments", r"parameters?|arguments?\b|passing (information|data)", r"command.line|argument passing|default|keyword|arbitrary|variable number|unpacking|lists? as|objects? as|list arguments|instance|type of the", None),
    ("return", "func", "Return values", r"\breturn|fruitful|void functions|functions that don't return", r"print", None),
    ("retprint", "func", "return vs print", r"return and print|return vs\.? print|difference between return and print|return.*print", None, None),
    ("scope", "func", "Local and global scope", r"\bscope|local (and|&) global|local variables|global (variables|statement)|variables and parameters are local|namespaces?", r"method", None),
    ("defaults", "func", "Default arguments", r"default (argument|parameter)", r"mutable", None),
    ("kwargs", "func", "Keyword arguments", r"keyword arguments?|named arguments|special parameters", None, None),
    ("varargs", "func", "*args and **kwargs", r"arbitrary argument|variable number of (parameters|arguments)|\*args|kwargs|unpacking argument lists|varargs", None, None),
    ("docstrings", "func", "Docstrings", r"docstring|documentation strings", None, None),
    ("callstack", "func", "Call stack and flow of execution", r"call stack|stack diagrams?|flow of execution|functions calling functions|function calls within function calls", None, None),
    ("recursion", "func", "Recursion", r"recurs", None, None),
    ("lambda", "func", "Lambda expressions", r"lambda|anonymous functions?", None, None),
    ("higherorder", "func", "Functions as values (higher-order)", r"functions? (as|applied to) (arguments|functions|objects|values|parameters)|higher.order|first.class|callback|functional programming|\bmap\b|\bfilter\b|\breduce\b|custom sorting with key", None, None),
    ("typehints", "func", "Type hints", r"type hints?|annotations?|typing", None, None),
    ("decomp", "func", "Why functions: decomposition and abstraction", r"why functions|decomposition|abstraction|refactor|encapsulation and generalization|development plan|incremental development|generalization", None, None),
    # Strings
    ("strbasics", "str", "Strings: literals and quotes", r"^strings?$|string (literals?|syntax|basics|type|values)|quotes|^text$|working with strings|python strings|^a string|strings and text|string data type", r"triple|escape|raw|format|methods", None),
    ("escapes", "str", "Escape sequences and raw strings", r"escape|raw strings?|backslash", None, None),
    ("multiline", "str", "Multiline strings", r"triple quotes|multi.?line strings", None, None),
    ("concat", "str", "Concatenation and repetition", r"concatenat|string operations|\+ operator|replication|repetition", r"regex", None),
    ("strindex", "str", "String indexing", r"index|individual characters|strings are sequences|a string is a sequence|characters in a string", r"error|find|method", S),
    ("strslice", "str", "String slicing", r"slic|substrings?\b", r"search", S),
    ("immut", "str", "Immutability", r"immutab|can.t be changed|cannot be changed", None, None),
    ("len", "str", "len()", r"\blen\b|length", None, None),
    ("strmethods", "str", "String methods", r"string methods|methods? (for|of) strings|upper|lower|strip|startswith|is\w+\(\)|changing case|whitespace|justif|center|string functions|useful string|methods for lists and strings|^string methods", None, None),
    ("insearch", "str", "in operator and searching", r"\bin\b operator|the in operator|searching (for )?(substrings|lists|strings)|\bfind\b|membership|in and not in|searching lists|^searching$|^search$", r"regex|file", None),
    ("splitjoin", "str", "split() and join()", r"split|join", None, None),
    ("fstrings", "str", "f-strings and formatting", r"f.strings?|formatted string literals?|string interpolation|string formatting|formatting (strings|output|numbers)|print statement formatting|fancier output formatting|building strings|formatting|format specifier", r"%|\.format|format method|dict formatting|times and dates|dates", None),
    ("formatmethod", "str", "format() and % formatting", r"\.format|format method|str\.format|string %|% format|old string formatting|format operator|manual string formatting|dict formatting", None, None),
    ("unicode", "str", "Unicode and bytes", r"unicode|\bbytes\b|encoding|ascii|ord\(|chr\(", None, None),
    ("parsing", "str", "Parsing strings", r"parsing|extracting", r"html|xml|regex", None),
    # Lists
    ("listbasics", "list", "Lists", r"^(python )?lists?$|list data type|lists are (mutable|sequences)|what is a list|introducing lists|a list is|^lists?\b|working with lists|list values", r"comprehension|of lists|within lists|methods|functions|as|tuples|dict", None),
    ("listindex", "list", "List indexing", r"index|accessing (items|elements)|individual (values|elements|items)|getting individual|negative", r"error|method|find|out of range", L),
    ("listslice", "list", "List slicing", r"slic", None, L),
    ("listmodify", "list", "Changing lists", r"chang|modif|adding (items|elements|to)|removing (items|elements)|insert|lists are mutable|append", None, L),
    ("listmethods", "list", "List methods", r"list methods|methods\b|append\(|pop\b|remove\b", None, L),
    ("sorting", "list", "Sorting: sort() and sorted()", r"sort", r"algorithm|merge|selection|bubble", None),
    ("listfuncs", "list", "len, min, max, sum on lists", r"list functions|maximum, minimum and sum|\bmin\b|\bmax\b|\bsum\b|aggregate|lists and functions", None, None),
    ("nested", "list", "Lists of lists", r"lists? (of|within|in) lists|nested lists?|matrices|matrix|two.dimensional|2d", None, None),
    ("alias", "list", "References and aliasing", r"alias|references?|objects and values|identity|same list|\bis\b operator|multiple references", r"function", None),
    ("copying", "list", "Copying lists", r"cop(y|ying)|clon", r"files", L),
    ("mutateargs", "list", "Lists passed to functions", r"lists? as (arguments|parameters)|list arguments|passing (references|lists)|side effects|given as an argument|lists? as an argument", None, None),
    ("stackqueue", "list", "Lists as stacks and queues", r"stacks?\b|queues?", r"stack diagram|call stack", None),
    ("del", "list", "del statement", r"\bdel\b", None, None),
    # Tuples & sequences
    ("tuples", "tuple", "Tuples", r"tuples?", r"unpack|without parentheses|assignment", None),
    ("unpacking", "tuple", "Unpacking and multiple assignment", r"unpack|multiple assignment|tuple assignment|swap|tuples without parentheses|packing", None, None),
    ("sequences", "tuple", "Sequence types and shared operations", r"sequence types?|^sequences|and sequences|list.like|common sequence|comparing sequences", r"escape", None),
    ("mutable", "tuple", "Mutable vs immutable types", r"mutable (and|vs\.?|versus) immutable|mutability|mutable data", None, None),
    # Dictionaries & sets
    ("dictbasics", "dict", "Dictionaries", r"dictionar(y|ies)|\bdicts?\b|key.value|hash table|mapping type", r"comprehension|views|nested|loop|travers|iterat|methods|counter|formatting", None),
    ("dictviews", "dict", "keys(), values(), items()", r"keys\(\)|values\(\)|items\(\)|keys,? (and )?values|the keys|dict(ionary)? views|dict methods|dictionary methods", None, None),
    ("dictloop", "dict", "Looping through a dictionary", r"(loop|travers|iterat)\w* (through|over|a)?\s*(a )?dict|traversing a dictionary|looping and dictionaries|dictionaries and loops", None, None),
    ("dictget", "dict", "get() and setdefault()", r"get\(\)|setdefault|checking whether a key|missing keys?|default values", r"argument|parameter", None),
    ("counting", "dict", "Counting with a dictionary", r"counter|counting|histogram|frequenc", r"summing", None),
    ("nesteddata", "dict", "Nested data structures", r"nesting|nested (data|dict)|structur(ed|ing) data|data structures? (in|with)|lists? (of|in) dict|dict\w* (of|in) (lists|dict)|data modeling|list of dictionaries|^data structures$", None, None),
    ("sets", "dict", "Sets", r"\bsets?\b", r"setdefault|set up|setting|setters", None),
    ("setops", "dict", "Set operations", r"set operations|union|intersection|symmetric difference", None, None),
    # Comprehensions & iterators
    ("listcomp", "iter", "List comprehensions", r"list comprehensions?|^comprehensions?$|comprehensions", r"dict|set|other|more|nested", None),
    ("othercomp", "iter", "Dict and set comprehensions", r"dict(ionary)? comprehensions?|set comprehensions?|other comprehensions|more comprehensions|comprehensions? (for|with) (dict|set)", None, None),
    ("nestedcomp", "iter", "Nested comprehensions", r"nested (list )?comprehensions?", None, None),
    ("iterators", "iter", "Iterators and iterables", r"iterators?|iterables?|iteration protocol", None, None),
    ("generators", "iter", "Generators and yield", r"generators?|\byield\b", r"expression", None),
    ("genexpr", "iter", "Generator expressions", r"generator expressions?", None, None),
    # Files
    ("paths", "files", "File paths and folders", r"\bpaths?\b|directories|folders?|os\.path|pathlib|working directory|file system", None, None),
    ("readfiles", "files", "Opening and reading files", r"(reading|read|opening|open)\b.*files?|file objects?|reading data|contents of a file|text files|accessing a file|file handles?|^files?$|reading from a file|reading text|file i/o|files and|dict and file|^files ", r"writ|csv|json|unicode", None),
    ("writefiles", "files", "Writing files", r"writ(e|ing)\b.*files?|appending data|creating a new file|writing to a file|^writing", r"csv|json|test|program", None),
    ("with", "files", "The with statement", r"\bwith\b statement|context manag|with open|the with", None, None),
    ("csv", "files", "CSV files", r"\bcsv\b", None, None),
    ("json", "files", "JSON", r"\bjson\b", None, None),
    ("organize", "files", "Copying, moving and deleting files", r"shutil|copying files|moving files|organizing files|os\.walk|walking a directory|zip files|deleting files|renaming files|compressing", None, None),
    ("pickle", "files", "Saving objects: pickle and shelve", r"pickl|shelve|persist|saving variables|serializ", None, None),
    # Errors
    ("exceptions", "err", "Exceptions", r"exceptions?|errors and exceptions|handling errors|^errors$|^debugging and exceptions", r"user.defined|custom|raising|raise|catching|handling (exceptions|multiple)|try", None),
    ("tryexcept", "err", "try and except", r"\btry\b|\bexcept\b|catching|handling (exceptions|errors|multiple)", None, None),
    ("raise", "err", "Raising exceptions", r"rais(e|ing)", None, None),
    ("finally", "err", "else and finally", r"finally|clean.?up actions", None, None),
    ("customexc", "err", "Custom exception classes", r"user.defined exceptions|custom exceptions|exception classes|user.defined errors", None, None),
    ("assert", "err", "Assertions", r"assert", None, None),
    ("debugging", "err", "Debugging techniques", r"debug", r"pygame", None),
    ("logging", "err", "Logging", r"logging", None, None),
    ("testing", "err", "Testing your code", r"\btest(s|ing)?\b|pytest|unittest|doctest", r"testing (whether|if|for)", None),
    ("validation", "err", "Input validation", r"input validation|validat", None, None),
    # Modules
    ("import", "mod", "Importing modules", r"\bimport|^modules?$|using modules|more on modules|libraries", r"own|creating|writing|third", None),
    ("random", "mod", "random module", r"random", None, None),
    ("datetime", "mod", "Dates and times", r"\bdates?\b|\btimes?\b(?! complexity)|datetime|time module", r"run ?time|complexity|o\(", None),
    ("stdlib", "mod", "Tour of the standard library", r"standard library|stdlib|batteries included|brief tour", None, None),
    ("ownmodules", "mod", "Writing your own modules", r"creating (your own )?modules|your own modules|writing modules|making your own modules|storing your functions in modules|modules as scripts|__name__|main function code|importing your own", None, None),
    ("packages", "mod", "Packages", r"\bpackages?\b(?! manag)|submodules", r"install", None),
    ("pip", "mod", "Installing third-party packages (pip)", r"\bpip\b|third.party|installing (packages|libraries|modules)|package manag|pypi", None, None),
    ("venv", "mod", "Virtual environments", r"virtual environments?|\bvenv\b", None, None),
    ("cliargs", "mod", "Command-line arguments", r"command.line arguments?|argv|argument passing|argparse|command.line programs", None, None),
    # OOP
    ("objmethods", "oop", "Objects and methods (using them)", r"objects and methods|interlude: objects|methods vs\.? functions|methods versus functions|what is an object|^objects?$|everything is an object|methods vs variables", None, None),
    ("classes", "oop", "Defining classes", r"\bclass(es)?\b|blueprint|user.defined types|object.oriented|\boop\b", r"attributes|hierarch|variables|methods|inherit|child|parent|sub", None),
    ("initattrs", "oop", "__init__ and attributes", r"__init__|constructor|\battributes?\b|instance variables|\binstances?\b|init method", r"class attributes|objects as attributes", None),
    ("methods", "oop", "Defining methods and self", r"methods? (in classes|definitions?)|defining methods|\bself\b|instance methods|methods in", None, None),
    ("strrepr", "oop", "__str__ and __repr__", r"__str__|__repr__|printing an object|string representation", None, None),
    ("dunder", "oop", "Special methods and operator overloading", r"operator overloading|special methods|magic methods|dunder|rich comparison|__eq__|__add__", None, None),
    ("inherit", "oop", "Inheritance", r"inherit|subclass|parent class|child class|class hierarch|super\(\)|overrid|polymorphism", None, None),
    ("encaps", "oop", "Encapsulation and properties", r"encapsulation|access modifiers|private|getters|setters|properties|@property", r"generalization", None),
    ("classattrs", "oop", "Class attributes and class methods", r"class attributes|class variables|static methods|class methods", None, None),
    ("composition", "oop", "Objects inside objects (composition)", r"composition|objects as attributes|aggregation", None, None),
    ("dataclasses", "oop", "Dataclasses", r"dataclass", None, None),
    # Regex (only inside regex chapters, see RX)
    ("rxbasics", "regex", "Regex basics: patterns and search", r"basic patterns|regex objects|matching regex|re module|finding patterns|regular expressions?|regex|search|match", r"group|findall|sub\b|greedy|character|syntax|extract", RX),
    ("rxgroups", "regex", "Groups", r"group", None, RX),
    ("rxclasses", "regex", "Character classes", r"character class|square brackets|caret|dollar|wildcard|\bdot\b|shorthand", None, RX),
    ("rxrepeat", "regex", "Repetition and greedy matching", r"repetition|greedy|optional|zero or more|one or more|quantifier|leftmost|curly", None, RX),
    ("rxfindall", "regex", "findall()", r"findall|finditer", None, RX),
    ("rxsub", "regex", "Substitution", r"\bsub\b|substitut|replac", None, RX),
    ("rxflags", "regex", "Flags and verbose mode", r"options|flags|verbose|ignorecase|case.insensitive|dotall", None, RX),
    # Beyond
    ("web", "beyond", "Web and HTTP", r"\bhttp\b|urllib|\bweb\b|requests|network|socket|from the internet|downloading|\bapis?\b|beautifulsoup|html", None, None),
    ("databases", "beyond", "Databases and SQL", r"database|\bsql", None, None),
    ("plotting", "beyond", "Plotting", r"\bplot|matplotlib|visuali[sz]|graphs?\b|graphing", r"knowledge", None),
    ("searchalg", "beyond", "Search algorithms", r"search(ing)? algorithms?|linear search|binary search|bisection", None, None),
    ("sortalg", "beyond", "Sorting algorithms", r"sorting algorithms?|merge sort|selection sort|bubble sort|insertion sort", None, None),
    ("complexity", "beyond", "Efficiency and complexity", r"complexity|big.?o|efficiency|order of growth|timing programs|performance", None, None),
    ("approx", "beyond", "Approximation methods", r"approximat|guess.and.check|newton|numerical methods", r"circle", None),
    ("decorators", "beyond", "Decorators", r"decorator", None, None),
]

# ---- second pass: points found missing in the sources, and wider rules (from reading the leftover headings) ----
POINTS += [
    ("blocks", "cond", "Indentation and code blocks", r"indent|\bblocks?\b(?! of)|logical and physical line|forgetting the colon|conditions and blocks|single statement blocks", r"empty", None),
    ("style", "start", "Code style and PEP 8", r"coding style|style guide|styling|zen of python|pythonic|readability|pep ?8|blank lines", None, None),
]
EXTRA = {
    "run": r"programming environment|running hello_world|running snippets|ides?\b|executable python scripts|what really happens when you run|python versions|python on (windows|macos|linux)",
    "tracebacks": r"troubleshooting|indentation errors|forgetting to indent|indenting unnecessarily|^bugs$",
    "variables": r"bindings|^constants$|literal constants|state diagrams",
    "precedence": r"order of evaluation|associativity",
    "floatprec": r"^binary$|^fractions$",
    "input": r"input/output|choose the file name|user choose when to quit",
    "print": r"input/output",
    "logic": r"^or$|^and$|checking multiple conditions|more on conditions",
    "compare": r"checking for (equality|inequality)|ignoring case when checking|string comparison",
    "match": r"^match$",
    "else": r"^more conditionals$",
    "while": r"initialisation, condition and update|user choose when to quit|using a flag|moving items from one list",
    "for": r"definite loops|closer look at looping|iteration and search",
    "enumzip": r"enumerat|built-in sequence functions",
    "def": r"definitions and uses|^more functions",
    "callfn": r"function and object method calls",
    "defaults": r"default values of parameters",
    "docstrings": r"^specifications$",
    "scope": r"^environments$",
    "recursion": r"inductive reasoning|fibonacci|towers of hanoi|leap of faith",
    "higherorder": r"functions are objects",
    "decomp": r"pseudocode|subdividing a problem",
    "strbasics": r"single quote|more (about|on) strings|quotation marks",
    "strslice": r"string slices|more slices",
    "strmethods": r"removing prefixes|case sensitivity|cleaning up user input|ignoring case|removing unnecessary lines, spaces",
    "insearch": r"value is in a list|searching through a file",
    "listbasics": r"^more (about )?lists$|more strings and lists",
    "listslice": r"working with part of a list|^slicing$|^slice$|more slices",
    "listmodify": r"adding to a specific location|adding and removing elements|deleting elements|^mutation$",
    "listmethods": r"^more on lists$",
    "formatmethod": r"format\(\) method",
    "sorting": r"organizing a list",
    "range": r"making numerical lists",
    "mutateargs": r"passing a list",
    "alias": r"names and objects|^mutation$",
    "copying": r"^copying$|deep copy",
    "mutable": r"objects are mutable",
    "sequences": r"^sequence$",
    "dictloop": r"(loop|travers|iterat)\w*\b.*\bdict",
    "dictviews": r"^keys$|^values$",
    "counting": r"most common words|defaultdict",
    "othercomp": r"comprehensions and dictionaries",
    "listcomp": r"filtering items",
    "iterators": r"itertools",
    "readfiles": r"working with (a file's contents|multiple files)|^open$|large files",
    "with": r"^with$",
    "json": r"storing data|user-generated data",
    "paths": r"glob patterns|file wildcards",
    "tryexcept": r"failing silently|which errors to report",
    "testing": r"using fixtures|quality control",
    "debugging": r"^bugs$",
    "import": r"selecting distinct sections from a module|contents of a module|looking for modules|give a function an alias",
    "stdlib": r"standard modules|^sys module$|^statistics$|^mathematics$",
    "mathmod": r"^mathematics$",
    "ownmodules": r"making your own libraries",
    "objmethods": r"using objects|our first python object|method objects",
    "classes": r"modeling real-world objects|objects as arguments to (functions|methods)|object lifecycle|our first python object",
    "methods": r"^methods$|classes and methods|another method",
    "classattrs": r"class and object variables",
    "encaps": r"protected traits|scope of methods",
    "dunder": r"overloading|^more operators$",
    "inherit": r"^hierarchies$|parents and children|specialization",
    "complexity": r"big-theta",
    "sortalg": r"^bogo$|^bubble$|^selection$",
    "web": r"internet access|parsing xml|application programming interfaces",
    "databases": r"structured query language|primary keys|logical keys|multi-table|many-to-many|data model diagrams",
    "jupyter": r"tab completion",
    "rxclasses": r"groups of characters|other special characters",
    "rxrepeat": r"repeated matches",
}
POINTS = [(pid, a, n, inc + ("|" + EXTRA[pid] if pid in EXTRA else ""), exc, ctx) for pid, a, n, inc, exc, ctx in POINTS]
# the extra rules for slicing must not need the list/string context
# (typed points keep their list/string context; the mapper lets untyped headings such as "Slicing" count for both)

# ---- third pass: headings only show regex sub-points in one source, so regex is folded into three points ----
_RXMAP = {"rxclasses": "rxsyntax", "rxrepeat": "rxsyntax", "rxflags": "rxsyntax", "rxgroups": "rxextract",
          "rxfindall": "rxextract", "rxsub": "rxextract"}
_rx_inc = {}
for pid, a, n, inc, exc, ctx in POINTS:
    if pid in _RXMAP:
        _rx_inc.setdefault(_RXMAP[pid], []).append(inc)
POINTS = [p for p in POINTS if p[0] not in _RXMAP]
POINTS += [
    ("rxsyntax", "regex", "Pattern syntax: character classes, repetition, flags",
     "|".join(_rx_inc["rxsyntax"]) + r"|syntax of regular expressions|character matching|groups of characters|repeated matches|special characters", None, RX),
    ("rxextract", "regex", "Extracting: groups, findall, substitution",
     "|".join(_rx_inc["rxextract"]) + r"|extracting data|searching and extracting|string substitution", None, RX),
]

# ---- fourth pass: false matches found by spot-checking first headings ----
_FIX_EXC = {"callfn": r"keyword|default|command|positional|passing|list arguments|as arguments",
            "numbers": r"guessing|lottery|division|random",
            "variables": r"private",
            "if": r"what if",
            "writefiles": r"loop|conditions|tuple|prompts"}
_FIX_INC = {"callfn": (r"\|arguments\$", ""), "writefiles": (r"\|\^writing", "")}
import re as _re
_new = []
for pid, a, n, inc, exc, ctx in POINTS:
    if pid in _FIX_INC:
        inc = _re.sub(_FIX_INC[pid][0], _FIX_INC[pid][1], inc)
    if pid in _FIX_EXC:
        exc = (exc + "|" if exc else "") + _FIX_EXC[pid]
    _new.append((pid, a, n, inc, exc, ctx))
POINTS = _new
POINTS = [(pid, a, n, inc, (exc + "|" if exc else "") + "pyperclip|pasting" if pid == "copying" else exc, ctx)
          for pid, a, n, inc, exc, ctx in POINTS]

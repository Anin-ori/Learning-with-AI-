#!/usr/bin/env python3
"""Learning Companion, local stopgap version (not the official release).

Serves the page on http://127.0.0.1:8765, keeps progress as JSON files in ./data,
and passes the page's AI requests to the API you set up in the page (your own key).
Standard library only: run  python3 server.py
"""
import json, os, re, shutil, sys, threading, time, urllib.error, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE = os.path.join(HERE, "learning-companion-local.html")
DATA = os.path.join(HERE, "data")
CONFIG = os.path.join(HERE, "config.json")
PORT = int(os.environ.get("LC_PORT", "8765"))
SEG = re.compile(r"^[A-Za-z0-9_\-.~:@+]{1,200}$")
LOCK = threading.Lock()

DEFAULTS = {
    "provider": "anthropic",            # "anthropic" or "openai" (any OpenAI-compatible API)
    "baseUrl": "",                      # empty: the provider's usual address
    "apiKey": "",
    "models": {"quick": "claude-haiku-5-5", "default": "claude-sonnet-5-5", "complex": "claude-opus-5-5"},
    "maxTokens": 16000,
}


def load_config():
    cfg = json.loads(json.dumps(DEFAULTS))
    try:
        with open(CONFIG, encoding="utf-8") as f:
            saved = json.load(f)
        cfg.update({k: v for k, v in saved.items() if k in cfg})
        cfg["models"] = {**DEFAULTS["models"], **(saved.get("models") or {})}
    except (OSError, ValueError):
        pass
    if not cfg["apiKey"]:
        cfg["apiKey"] = os.environ.get("ANTHROPIC_API_KEY" if cfg["provider"] == "anthropic" else "OPENAI_API_KEY", "")
    return cfg


def public_config(cfg):
    out = {k: v for k, v in cfg.items() if k != "apiKey"}
    out["hasKey"] = bool(cfg["apiKey"])
    return out


def doc_file(path):
    parts = path.split("/")
    if len(parts) != 2 or not all(SEG.match(p) and p not in (".", "..") for p in parts):
        return None
    return os.path.join(DATA, parts[0], parts[1] + ".json")


def all_docs():
    docs = {}
    if not os.path.isdir(DATA):
        return docs
    for col in sorted(os.listdir(DATA)):
        d = os.path.join(DATA, col)
        if not os.path.isdir(d) or not SEG.match(col):
            continue
        for name in sorted(os.listdir(d)):
            if name.endswith(".json"):
                try:
                    with open(os.path.join(d, name), encoding="utf-8") as f:
                        docs[col + "/" + name[:-5]] = json.load(f)
                except (OSError, ValueError):
                    pass
    return docs


def write_json(file, body):
    os.makedirs(os.path.dirname(file), exist_ok=True)
    tmp = file + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(body, f, ensure_ascii=False)
    os.replace(tmp, file)


class AIError(Exception):
    def __init__(self, code, message, status=502):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def call_ai(cfg, messages, tier):
    if not cfg["apiKey"] and not (cfg["provider"] == "openai" and cfg["baseUrl"].startswith("http://")):
        raise AIError("no_key", "No API key is set. Open Local settings in the page and add one.", 400)
    model = (cfg["models"] or {}).get(tier) or cfg["models"].get("default")
    max_tokens = int(cfg.get("maxTokens") or 8000)
    if cfg["provider"] == "anthropic":
        url = (cfg["baseUrl"] or "https://api.anthropic.com").rstrip("/") + "/v1/messages"
        headers = {"x-api-key": cfg["apiKey"], "anthropic-version": "2023-06-01", "content-type": "application/json"}
        body = {"model": model, "max_tokens": max_tokens, "messages": messages}
    else:
        url = (cfg["baseUrl"] or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        headers = {"content-type": "application/json"}
        if cfg["apiKey"]:
            headers["authorization"] = "Bearer " + cfg["apiKey"]
        body = {"model": model, "max_tokens": max_tokens, "messages": messages}
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=900) as r:
            res = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        raise AIError(code_for(e.code, detail), "The API answered %d: %s" % (e.code, detail), 502)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise AIError("network", "The API couldn't be reached: %s" % e, 502)
    if cfg["provider"] == "anthropic":
        text = "".join(b.get("text", "") for b in res.get("content", []) if b.get("type") == "text")
        truncated = res.get("stop_reason") == "max_tokens"
    else:
        choice = (res.get("choices") or [{}])[0]
        text = ((choice.get("message") or {}).get("content")) or ""
        truncated = choice.get("finish_reason") == "length"
    return {"text": text, "truncated": truncated}


def code_for(status, detail):
    low = detail.lower()
    if status == 429:
        return "rate_limited"
    if status in (401, 403):
        return "bad_key"
    if status in (400, 413) and ("too long" in low or "context" in low or "too large" in low):
        return "prompt_too_large"
    return "network"


class Handler(BaseHTTPRequestHandler):
    server_version = "LearningCompanionLocal/1"

    def log_message(self, fmt, *args):
        pass

    def send(self, status, body=None, ctype="application/json; charset=utf-8", extra=None):
        data = body if isinstance(body, bytes) else json.dumps(body if body is not None else {}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(data)))
        self.send_header("cache-control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("content-length") or 0)
        return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

    def local_only(self):
        # only pages served from this machine may use the API (stops other sites from calling it)
        origin = self.headers.get("origin")
        if origin and not re.match(r"^http://(127\.0\.0\.1|localhost)(:\d+)?$", origin):
            self.send(403, {"error": {"code": "forbidden", "message": "Not allowed from " + origin}})
            return False
        return True

    def do_GET(self):
        p = self.path.split("?")[0]
        if p in ("/", "/index.html"):
            try:
                with open(PAGE, "rb") as f:
                    return self.send(200, f.read(), "text/html; charset=utf-8")
            except OSError:
                return self.send(500, b"learning-companion-local.html is missing next to server.py", "text/plain; charset=utf-8")
        if not self.local_only():
            return
        if p == "/api/ping":
            return self.send(200, {"ok": True})
        if p == "/api/settings":
            return self.send(200, public_config(load_config()))
        if p == "/api/export":
            with LOCK:
                docs = all_docs()
            return self.send(200, {"app": "learning-companion", "format": 1, "exportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "docs": docs})
        if p.startswith("/api/doc/"):
            f = doc_file(p[len("/api/doc/"):])
            if not f:
                return self.send(400, {"error": "bad path"})
            try:
                with open(f, encoding="utf-8") as fh:
                    return self.send(200, {"exists": True, "data": json.load(fh)})
            except (OSError, ValueError):
                return self.send(200, {"exists": False})
        self.send(404, {"error": "not found"})

    def do_PUT(self):
        if not self.local_only():
            return
        p = self.path.split("?")[0]
        f = doc_file(p[len("/api/doc/"):]) if p.startswith("/api/doc/") else None
        if not f:
            return self.send(400, {"error": "bad path"})
        with LOCK:
            write_json(f, self.body())
        self.send(200, {"ok": True})

    def do_DELETE(self):
        if not self.local_only():
            return
        p = self.path.split("?")[0]
        f = doc_file(p[len("/api/doc/"):]) if p.startswith("/api/doc/") else None
        if not f:
            return self.send(400, {"error": "bad path"})
        with LOCK:
            try:
                os.remove(f)
            except OSError:
                pass
        self.send(200, {"ok": True})

    def do_POST(self):
        if not self.local_only():
            return
        p = self.path.split("?")[0]
        try:
            b = self.body()
        except ValueError:
            return self.send(400, {"error": {"code": "bad_request", "message": "Not JSON"}})
        if p == "/api/settings":
            cfg = load_config()
            saved = {}
            try:
                with open(CONFIG, encoding="utf-8") as f:
                    saved = json.load(f)
            except (OSError, ValueError):
                pass
            for k in ("provider", "baseUrl", "maxTokens"):
                if k in b:
                    saved[k] = b[k]
            if isinstance(b.get("models"), dict):
                saved["models"] = {**cfg["models"], **{k: str(v) for k, v in b["models"].items() if k in ("quick", "default", "complex")}}
            if b.get("apiKey"):
                saved["apiKey"] = b["apiKey"]
            if b.get("clearKey"):
                saved["apiKey"] = ""
            write_json(CONFIG, saved)
            return self.send(200, public_config(load_config()))
        if p == "/api/ai":
            try:
                out = call_ai(load_config(), b.get("messages") or [], b.get("tier") or "default")
                return self.send(200, out)
            except AIError as e:
                return self.send(e.status, {"error": {"code": e.code, "message": e.message}})
        if p == "/api/import":
            docs = b.get("docs")
            if not isinstance(docs, dict) or not docs:
                return self.send(400, {"error": {"message": "This file has no progress in it."}})
            files = {k: doc_file(k) for k in docs}
            if not all(files.values()):
                return self.send(400, {"error": {"message": "This file isn't a Learning Companion progress file."}})
            with LOCK:
                backup = None
                if os.path.isdir(DATA) and os.listdir(DATA):
                    backup = os.path.join(HERE, "data-before-import-" + time.strftime("%Y%m%d-%H%M%S"))
                    shutil.move(DATA, backup)
                for k, f in files.items():
                    write_json(f, docs[k])
            return self.send(200, {"ok": True, "count": len(docs), "backup": os.path.basename(backup) if backup else None})
        self.send(404, {"error": "not found"})


def main():
    os.makedirs(DATA, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    print("Learning Companion (local, temporary) is running at " + url)
    print("Progress is kept in " + DATA)
    print("Leave this window open while you study; close it (or press Ctrl+C) to stop.")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

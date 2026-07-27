#!/usr/bin/env python3
"""
E-Library Schema Visualizer — Mini HTTP Server
================================================
Static file server + Read/Write REST API for SCHEMA_DESIGN.md + 001_init_schema.sql
Zero external dependencies — Python 3.8+ only (stdlib).

Run from this directory:
    $ cd supabase/migrations
    $ python3 server.py               # port 8080
    $ python3 server.py --port 9000   # custom port
    $ python3 server.py --host 0.0.0.0 # listen all interfaces

Then open:  http://localhost:8080/schema-visualizer.html

CURL EXAMPLES
-------------
# Ping
$ curl http://localhost:8080/api/ping

# Read current files
$ curl http://localhost:8080/api/md    > SCHEMA_DESIGN.md
$ curl http://localhost:8080/api/sql   > 001_init_schema.sql

# Overwrite files on disk (idempotent, writes atomically via tmp + rename)
$ curl -X POST http://localhost:8080/api/save \
    -H "Content-Type: application/json" \
    -d '{"md":"# new content\n", "sql":"CREATE TABLE public.foo(id int);\n"}'

# Get parsed metadata (JSON) — great for automation / scripts
$ curl http://localhost:8080/api/info   | jq .
$ curl http://localhost:8080/api/tables | jq .
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
MD_FILE = ROOT / "SCHEMA_DESIGN.md"
SQL_FILE = ROOT / "001_init_schema.sql"
INDEX_FILE = ROOT / "schema-visualizer.html"

MIME = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".markdown": "text/markdown; charset=utf-8",
    ".sql": "application/sql; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json; charset=utf-8",
}


# ---------------------------------------------------------------------------
# Helpers: tiny parsers (reproduce a subset of the JS logic for /api/tables)
# ---------------------------------------------------------------------------

def _split_sql_columns(raw: str) -> list[str]:
    lines, depth, buf, in_str = [], 0, "", False
    for i, c in enumerate(raw):
        if c == "'" and (i == 0 or raw[i - 1] != "'"):
            in_str = not in_str
        if not in_str:
            if c == "(":
                depth += 1
            elif c == ")":
                if depth == 0:
                    break
                depth -= 1
            elif c == "," and depth == 0:
                if buf.strip():
                    lines.append(buf.strip())
                buf = ""
                continue
        buf += c
    if buf.strip():
        lines.append(buf.strip())
    return lines


def _parse_md_descriptions(md: str) -> dict[str, Any]:
    result: dict[str, Any] = {"tables": {}}
    if not md:
        return result
    section_re = re.compile(
        r"^###\s+\d+\.\s+`?(\w+)`?(?:\s*—\s*([^\n]+))?[ \t]*\n([\s\S]*?)(?=^###\s+\d+\.|\n##\s|\n---\n|$)",
        re.M | re.I,
    )
    for m in section_re.finditer(md):
        tname, tdesc, body = m.group(1), (m.group(2) or "").strip(), m.group(3)
        entry: dict[str, Any] = {"desc": tdesc, "cols": {}}
        row_re = re.compile(r"^\|\s*`?(\w+)`?\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|", re.M | re.I)
        for rm in row_re.finditer(body):
            if rm.group(1).lower() == "คอลัมน์" or "---" in rm.group(1):
                continue
            entry["cols"][rm.group(1)] = rm.group(3).replace("**", "").strip()
        result["tables"][tname] = entry
    return result


def parse_all_tables(sql: str, md: str = "") -> list[dict[str, Any]]:
    md_meta = _parse_md_descriptions(md)
    tables: list[dict[str, Any]] = []
    rls_re = re.compile(
        r"ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY", re.I
    )
    rls_enabled = {m.group(1) for m in rls_re.finditer(sql)}

    # CREATE TABLE public.name ( ... );
    table_re = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\(([\s\S]*?)\)\s*(?:TABLESPACE\s+\w+)?\s*;",
        re.I,
    )
    for tm in table_re.finditer(sql):
        tname, raw_body = tm.group(1), tm.group(2)
        rows = _split_sql_columns(raw_body)
        cols: list[dict[str, Any]] = []
        constraints: list[str] = []
        checks: list[str] = []
        for r in rows:
            if re.match(
                r"^(CONSTRAINT\s+\w+\s+)?(PRIMARY\s+KEY\b|FOREIGN\s+KEY\b|UNIQUE\b|CHECK\b)",
                r,
                re.I,
            ):
                constraints.append(r.strip())
                if re.search(r"^CHECK\b|CONSTRAINT\s+\w+\s+CHECK\b", r, re.I):
                    checks.append(r.strip())
                continue
            cm = re.match(r'^"?(\w+)"?\s+([\w(),\s]+?)(?:\s+(.*))?$', r, re.I)
            if not cm:
                continue
            name, ctype, rest = cm.group(1), cm.group(2), cm.group(3) or ""
            modifiers: list[str] = []
            fk = None
            if re.search(r"\bPRIMARY\s+KEY\b", r, re.I):
                modifiers.append("PK")
            rf = re.search(r"REFERENCES\s+(?:public\.)?(\w+)\s*\(\s*\"?(\w+)\"?\s*\)", r, re.I)
            if rf:
                fk = {"table": rf.group(1), "col": rf.group(2)}
                modifiers.append(f"FK → {rf.group(1)}.{rf.group(2)}")
                da = re.search(r"ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)", r, re.I)
                if da:
                    modifiers.append(f"ON DELETE {da.group(1).upper()}")
            if re.search(r"\bNOT\s+NULL\b", r, re.I):
                modifiers.append("NOT NULL")
            inline_unique = re.sub(r"UNIQUE\s*\([^)]*\)", "", r, flags=re.I)
            if re.search(r"\bUNIQUE\b", inline_unique, re.I):
                modifiers.append("UNIQUE")
            dm = re.search(
                r"DEFAULT\s+([\s\S]*?)(?:\s+NOT\s+NULL|\s+CHECK\b|\s+PRIMARY\b|\s+REFERENCES\b|\s+UNIQUE\b|$)",
                r, re.I,
            )
            if dm:
                v = dm.group(1).strip().rstrip(";,").strip()
                v = re.sub(r"\s+ON\s+(DELETE|UPDATE).*$", "", v, flags=re.I).strip()
                if v:
                    modifiers.append(f"DEFAULT {v}")
            ck = re.search(r"\bCHECK\s*\(([\s\S]+)\)\s*$", r, re.I)
            if ck:
                checks.append(f"CHECK ({ck.group(1).strip()})")
                modifiers.append(f"CHECK ({ck.group(1).strip()})")
            desc = ""
            if tname in md_meta.get("tables", {}) and name in md_meta["tables"][tname].get("cols", {}):
                desc = md_meta["tables"][tname]["cols"][name]
            cols.append({
                "name": name,
                "type": ctype.strip().lower(),
                "modifiers": modifiers,
                "note": " · ".join(modifiers),
                "fk": fk,
                "desc": desc,
            })
        for c in constraints:
            uq = re.search(r"UNIQUE\s*\(\s*\"?(\w+)\"?\s*\)", c, re.I)
            if uq:
                col = next((x for x in cols if x["name"] == uq.group(1)), None)
                if col and "UNIQUE" not in col["modifiers"]:
                    col["modifiers"].append("UNIQUE")
                    col["note"] = " · ".join(col["modifiers"])
            muq = re.search(r"UNIQUE\s*\(\s*([^)]+)\s*\)", c, re.I)
            if muq and not uq:
                parts = [p.strip().strip('"') for p in muq.group(1).split(",")]
                for p in parts:
                    col = next((x for x in cols if x["name"] == p), None)
                    if col and not any(m.startswith("UNIQUE") for m in col["modifiers"]):
                        col["modifiers"].append(f"UNIQUE ({', '.join(parts)})")
                        col["note"] = " · ".join(col["modifiers"])
            pk = re.search(r"PRIMARY\s+KEY\s*\(\s*\"?(\w+)\"?\s*\)", c, re.I)
            if pk:
                col = next((x for x in cols if x["name"] == pk.group(1)), None)
                if col and "PK" not in col["modifiers"]:
                    col["modifiers"].insert(0, "PK")
                    col["note"] = " · ".join(col["modifiers"])
            fk = re.search(
                r"FOREIGN\s+KEY\s*\(\s*\"?(\w+)\"?\s*\)\s*REFERENCES\s+(?:public\.)?(\w+)\s*\(\s*\"?(\w+)\"?\s*\)",
                c, re.I,
            )
            if fk:
                col = next((x for x in cols if x["name"] == fk.group(1)), None)
                if col:
                    note = f"FK → {fk.group(2)}.{fk.group(3)}"
                    if note not in col["modifiers"]:
                        col["modifiers"].append(note)
                        col["note"] = " · ".join(col["modifiers"])
                    col["fk"] = {"table": fk.group(2), "col": fk.group(3)}
                    da = re.search(
                        r"ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION)", c, re.I
                    )
                    if da and not any(m.startswith("ON DELETE") for m in col["modifiers"]):
                        col["modifiers"].append(f"ON DELETE {da.group(1).upper()}")
                        col["note"] = " · ".join(col["modifiers"])
            cchk = re.search(r"(?:CONSTRAINT\s+\w+\s+)?CHECK\s*\(([\s\S]+)\)", c, re.I)
            if cchk:
                checks.append(f"CONSTRAINT CHECK ({cchk.group(1).strip()})")

        tables.append({
            "name": tname,
            "desc": (md_meta.get("tables", {}).get(tname, {}).get("desc") or ""),
            "cols": cols,
            "constraints": constraints,
            "checks": checks,
            "rls": tname in rls_enabled,
            "counts": {
                "columns": len(cols),
                "constraints": len(constraints),
                "fk": sum(1 for c in cols if c["fk"]),
                "checks": len(checks),
            },
        })
    return tables


def _read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def _atomic_write(p: Path, data: str) -> None:
    """Write atomically via temp file + os.replace to avoid torn writes."""
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(p.parent), prefix=p.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, p)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "SchemaViz/1.0"

    # ------- helpers -------
    def _send(self, status: int, body: Any, content_type: str | None = None) -> None:
        if isinstance(body, (dict, list)):
            raw = json.dumps(body, ensure_ascii=False, indent=2).encode("utf-8")
            ct = content_type or "application/json; charset=utf-8"
        elif isinstance(body, str):
            raw = body.encode("utf-8")
            ct = content_type or "text/plain; charset=utf-8"
        elif isinstance(body, bytes):
            raw = body
            ct = content_type or "application/octet-stream"
        else:
            raw = str(body).encode("utf-8")
            ct = content_type or "text/plain; charset=utf-8"
        self.send_response(status)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def _send_file(self, fs_path: Path) -> None:
        if not fs_path.exists() or not fs_path.is_file():
            # fallback: try to serve ROOT/index-like for directory listing style
            if fs_path.is_dir() and (fs_path / "index.html").exists():
                return self._send_file(fs_path / "index.html")
            return self._send(404, {"ok": False, "error": "not found", "path": str(fs_path.relative_to(ROOT))})
        ext = fs_path.suffix.lower()
        mime = MIME.get(ext, "application/octet-stream")
        data = fs_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    # ------- routing -------
    def do_OPTIONS(self) -> None:  # preflight
        self._send(204, b"", content_type="text/plain")

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ("", "/"):
            return self._send_file(INDEX_FILE if INDEX_FILE.exists() else ROOT / "index.html")
        if path.startswith("/api/"):
            return self._route_api("GET", path, {})
        fs_path = ROOT / path.lstrip("/")
        # Safety: do not escape ROOT
        try:
            fs_path.resolve().relative_to(ROOT)
        except ValueError:
            return self._send(403, {"ok": False, "error": "forbidden"})
        self._send_file(fs_path)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            body = self._read_json_body()
            return self._route_api("POST", path, body)
        return self._send(405, {"ok": False, "error": "method not allowed"})

    # ------- api -------
    def _route_api(self, method: str, path: str, body: dict[str, Any]) -> None:
        route = path.rstrip("/")

        if route == "/api/ping":
            info = {
                "ok": True,
                "pong": True,
                "server": "SchemaViz/1.0",
                "root": str(ROOT),
                "files": {
                    "md": MD_FILE.name,
                    "sql": SQL_FILE.name,
                    "md_bytes": MD_FILE.stat().st_size if MD_FILE.exists() else 0,
                    "sql_bytes": SQL_FILE.stat().st_size if SQL_FILE.exists() else 0,
                },
            }
            # Accept both: plain text pong (for simple feature-detect) OR JSON via ?f=json
            accept = self.headers.get("Accept", "")
            qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            want_json = "json" in accept.lower() or "json" in (qs.get("f", [""])[0].lower())
            if want_json:
                return self._send(200, info)
            return self._send(200, f"pong {info['files']['md_bytes']} {info['files']['sql_bytes']}", content_type="text/plain; charset=utf-8")

        if route == "/api/md":
            if not MD_FILE.exists():
                return self._send(404, {"ok": False, "error": "md file not found"})
            return self._send(200, _read_text(MD_FILE), content_type="text/markdown; charset=utf-8")

        if route == "/api/sql":
            if not SQL_FILE.exists():
                return self._send(404, {"ok": False, "error": "sql file not found"})
            return self._send(200, _read_text(SQL_FILE), content_type="application/sql; charset=utf-8")

        if route == "/api/info":
            md = _read_text(MD_FILE)
            sql = _read_text(SQL_FILE)
            tables = parse_all_tables(sql, md)
            cnt_policy = len(re.findall(r"CREATE\s+POLICY", sql, re.I))
            cnt_trigger = len(re.findall(r"CREATE\s+TRIGGER", sql, re.I))
            cnt_func = len(re.findall(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION", sql, re.I))
            cnt_idx = len(re.findall(r"CREATE\s+(?:UNIQUE\s+)?INDEX", sql, re.I))
            info = {
                "ok": True,
                "root": str(ROOT),
                "files": {
                    "md": {"path": str(MD_FILE), "size": len(md), "sha256": hashlib.sha256(md.encode()).hexdigest()[:12]},
                    "sql": {"path": str(SQL_FILE), "size": len(sql), "sha256": hashlib.sha256(sql.encode()).hexdigest()[:12]},
                },
                "counts": {
                    "tables": len(tables),
                    "policies": cnt_policy,
                    "triggers": cnt_trigger,
                    "functions": cnt_func,
                    "indexes": cnt_idx,
                    "total": len(tables) + cnt_policy + cnt_trigger + cnt_func + cnt_idx,
                },
                "tables": [{"name": t["name"], "desc": t["desc"], "rls": t["rls"], **t["counts"]} for t in tables],
            }
            return self._send(200, info)

        if route == "/api/tables":
            md = _read_text(MD_FILE)
            sql = _read_text(SQL_FILE)
            return self._send(200, {"ok": True, "tables": parse_all_tables(sql, md)})

        if route == "/api/save":
            if method != "POST":
                return self._send(405, {"ok": False, "error": "use POST"})
            new_md = body.get("md", None)
            new_sql = body.get("sql", None)
            written: dict[str, str] = {}
            try:
                if isinstance(new_md, str):
                    _atomic_write(MD_FILE, new_md)
                    written["md"] = str(MD_FILE)
                if isinstance(new_sql, str):
                    _atomic_write(SQL_FILE, new_sql)
                    written["sql"] = str(SQL_FILE)
            except Exception as e:
                return self._send(500, {"ok": False, "error": f"write failed: {e}", "path": written})
            return self._send(200, {
                "ok": True,
                "path": {
                    "md": written.get("md", str(MD_FILE)),
                    "sql": written.get("sql", str(SQL_FILE)),
                },
                "bytes": {
                    "md": len(new_md) if isinstance(new_md, str) else MD_FILE.stat().st_size,
                    "sql": len(new_sql) if isinstance(new_sql, str) else SQL_FILE.stat().st_size,
                },
                "wrote": list(written.keys()),
            })

        return self._send(404, {"ok": False, "error": f"unknown api route: {route}"})

    def log_message(self, fmt: str, *args: Any) -> None:
        ts = self.log_date_time_string()
        print(f"[SchemaViz {ts}] {fmt % args}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser(description="Schema Visualizer — mini HTTP server + file API", formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1", help="bind host (default: 127.0.0.1; use 0.0.0.0 for all)")
    ap.add_argument("--port", type=int, default=8080, help="bind port (default: 8080)")
    ap.add_argument("--no-open", action="store_true", help="do not auto-open browser")
    args = ap.parse_args()

    addr = (args.host, args.port)
    srv = ThreadingHTTPServer(addr, Handler)
    url = f"http://{args.host}:{args.port}/schema-visualizer.html"
    print("=" * 72)
    print("📚  E-Library Schema Visualizer — Mini Server")
    print("=" * 72)
    print(f"  ROOT : {ROOT}")
    print(f"  URL  : {url}")
    print(f"  MD   : {MD_FILE.name} ({MD_FILE.stat().st_size if MD_FILE.exists() else 'missing'} bytes)")
    print(f"  SQL  : {SQL_FILE.name} ({SQL_FILE.stat().st_size if SQL_FILE.exists() else 'missing'} bytes)")
    print("-" * 72)
    print("  API routes:")
    print("    GET  /api/ping                       → pong health-check")
    print("    GET  /api/md                         → SCHEMA_DESIGN.md raw text")
    print("    GET  /api/sql                        → 001_init_schema.sql raw text")
    print("    GET  /api/info                       → parsed counts + summary (JSON)")
    print("    GET  /api/tables                     → parsed table/col metadata (JSON)")
    print("    POST /api/save  {md?, sql?}          → overwrite md/sql files on disk")
    print("=" * 72)
    print("  Press Ctrl+C to stop")
    print()

    if not args.no_open:
        try:
            import webbrowser
            webbrowser.open(url, new=2)
        except Exception:
            pass

    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[SchemaViz] shutting down...", file=sys.stderr)
        srv.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Copie fidele du site en ligne (pages du crawl + toutes leurs ressources), pour le rendu JS et Lighthouse
quand le poste d'audit joint mal le site. Chaque fichier est telecharge avec reprises (crawl.fetch).

  python3 tools/seo-audit/mirror.py crawl.json <dossier> [fichiers supplementaires a tester...]

Ecrit aussi <dossier>/_headers.json : code, type, compression, cache et poids de chaque fichier en ligne.
"""
import json, os, re, sys, time, urllib.parse

sys_argv = sys.argv[:]
sys.argv = [sys.argv[0]]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import crawl as C  # noqa: E402
import urllib.request  # noqa: E402

data = json.load(open(sys_argv[1], encoding="utf-8"))
OUT = sys_argv[2]
EXTRA = sys_argv[3:]
BASE = data["base"]
seen, queue, headers = set(), [], {}


def push(url):
    u = urllib.parse.urldefrag(urllib.parse.urljoin(BASE + "/", url))[0]
    if u.startswith(BASE) and u not in seen:
        seen.add(u); queue.append(u)


def get(url):
    for k in range(16):
        req = urllib.request.Request(url, headers={"User-Agent": C.GOOGLEBOT, "Accept-Encoding": "gzip"})
        try:
            with C.OPENER.open(req, timeout=40) as r:
                raw = r.read(); h = {k.lower(): v for k, v in r.headers.items()}
                body = __import__("gzip").decompress(raw) if h.get("content-encoding") == "gzip" else raw
                return r.status, h, body, len(raw)
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, b"", 0
        except Exception:
            time.sleep(4)
    return 0, {}, b"", 0


for u, p in data["pages"].items():
    if p["status"] == 200:
        push(u)
for e in EXTRA:
    push(e)
while queue:
    url = queue.pop(0)
    status, h, body, wire = get(url)
    path = urllib.parse.urlparse(url).path
    headers[url.replace(BASE, "")] = {"status": status, "type": h.get("content-type"), "encoding": h.get("content-encoding"), "cache": h.get("cache-control"),
                                     "bytes": len(body), "wire": wire, "last_modified": h.get("last-modified"), "x_robots": h.get("x-robots-tag")}
    print(status, url.replace(BASE, ""), len(body), flush=True)
    if status != 200:
        continue
    local = os.path.join(OUT, path.lstrip("/"))
    if path.endswith("/"):
        local = os.path.join(local, "index.html")
    os.makedirs(os.path.dirname(local), exist_ok=True)
    open(local, "wb").write(body)
    ctype = h.get("content-type", "")
    text = body.decode("utf-8", "replace") if any(t in ctype for t in ("html", "css", "javascript", "json")) else ""
    if "html" in ctype:
        for m in re.finditer(r'(?:src|href|srcset)="([^"#]+)"', text):
            ref = m.group(1).split(" ")[0]
            if re.search(r"\.(css|js|png|jpe?g|webp|svg|ico|json|woff2?)(\?|$)", ref):
                push(urllib.parse.urljoin(url, ref))
    if "css" in ctype:
        for m in re.finditer(r'url\(\s*["\']?([^"\')]+)', text):
            if not m.group(1).startswith("data:"):
                push(urllib.parse.urljoin(url, m.group(1)))
    if "javascript" in ctype:
        for m in re.finditer(r'''(?:from|import)\s*\(?\s*['"]([^'"]+)['"]''', text):
            if m.group(1).startswith((".", "/")):
                push(urllib.parse.urljoin(url, m.group(1)))
        for m in re.finditer(r'''['"]((?:/|\.{0,2}/)?(?:data|img|api)/[^'"\s]+\.(?:json|webp|jpg|png))['"]''', text):
            push(urllib.parse.urljoin(BASE + "/", m.group(1)))
    if path.endswith("menu.json"):
        for m in re.finditer(r'"img":\s*"([^"]+)"', text):
            push(urllib.parse.urljoin(BASE + "/", m.group(1)))
    time.sleep(0.5)
json.dump(headers, open(os.path.join(OUT, "_headers.json"), "w"), indent=1)
print(len(headers), "fichiers")

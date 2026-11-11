"""Crawler d'audit SEO : explore tout le site depuis l'accueil, le sitemap et robots.txt.

  python3 tools/seo-audit/crawl.py [--base https://zmsolutions.fr] [--out crawl.json]

Deux parametres decides et documentes :
- User-agent : Googlebot smartphone (celui qui indexe). Certains hebergeurs servent autre chose aux robots tiers ;
  on compare aussi la page d'accueil avec un user-agent de navigateur (champ "ua_check").
- Rendu JavaScript : ce script lit le HTML brut (ce que Google voit a la premiere passe). render.js rend
  ensuite chaque page dans Chromium et compare liens et texte : s'ils different, des liens ou du contenu dependent du JS.

Les redirections ne sont pas suivies : chaque saut est une URL a part, avec son code. Une requete qui echoue
(coupure reseau) est retentee 5 fois avec une pause ; un echec definitif est note status 0, jamais invente.
"""
import html.parser, json, re, sys, time, urllib.error, urllib.parse, urllib.request

BASE = (sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "https://zmsolutions.fr").rstrip("/")
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "crawl.json"
HOST = urllib.parse.urlparse(BASE).netloc
GOOGLEBOT = ("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) "
             "Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url, ua=GOOGLEBOT, method="GET"):
    last = None
    for attempt in range(14):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": ua, "Accept": "text/html,*/*", "Accept-Encoding": "identity"})
        t = time.time()
        try:
            with OPENER.open(req, timeout=40) as r:
                body = r.read()
                return {"status": r.status, "headers": {k.lower(): v for k, v in r.headers.items()}, "body": body, "time": round(time.time() - t, 2)}
        except urllib.error.HTTPError as e:
            body = e.read() if e.code not in (301, 302, 303, 307, 308) else b""
            return {"status": e.code, "headers": {k.lower(): v for k, v in e.headers.items()}, "body": body, "time": round(time.time() - t, 2)}
        except Exception as e:  # coupure reseau : on retente
            last = str(e)
            time.sleep(4 + min(attempt, 4) * 2)
    return {"status": 0, "headers": {}, "body": b"", "time": None, "error": last}


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = None; self.metas = {}; self.canonical = []; self.hreflang = []; self.h = {1: [], 2: [], 3: []}
        self.links = []; self.images = []; self.jsonld = []; self.lang = None; self.scripts = []; self.styles = []
        self._stack = []; self._cur = None; self._text = []; self._a = None; self._skip = 0; self._ld = None; self._in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "title":
            self._in_title = True; self.title = ""
        if tag == "meta" and (a.get("name") or a.get("property")):
            self.metas[(a.get("name") or a.get("property")).lower()] = a.get("content", "")
        if tag == "link":
            rel = (a.get("rel") or "").lower()
            if rel == "canonical":
                self.canonical.append(a.get("href"))
            if rel == "alternate" and a.get("hreflang"):
                self.hreflang.append((a.get("hreflang"), a.get("href")))
            if rel == "stylesheet":
                self.styles.append(a.get("href"))
        if tag == "script":
            if (a.get("type") or "").lower() == "application/ld+json":
                self._ld = ""
            elif a.get("src"):
                self.scripts.append(a.get("src"))
            self._skip += 1
        if tag in ("style", "noscript", "svg"):
            self._skip += 1
        if tag in ("h1", "h2", "h3"):
            self._cur = [int(tag[1]), ""]
        if tag == "a":
            self._a = {"href": a.get("href"), "rel": (a.get("rel") or "").lower(), "text": "", "img_alt": None, "aria": a.get("aria-label")}
        if tag == "img":
            self.images.append({"src": a.get("src"), "alt": a.get("alt"), "width": a.get("width"), "height": a.get("height"), "loading": a.get("loading")})
            if self._a is not None:
                self._a["img_alt"] = a.get("alt")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script":
            if self._ld is not None:
                self.jsonld.append(self._ld); self._ld = None
            self._skip = max(0, self._skip - 1)
        if tag in ("style", "noscript", "svg"):
            self._skip = max(0, self._skip - 1)
        if tag in ("h1", "h2", "h3") and self._cur:
            self.h[self._cur[0]].append(" ".join(self._cur[1].split())); self._cur = None
        if tag == "a" and self._a is not None:
            self._a["text"] = " ".join(self._a["text"].split()); self.links.append(self._a); self._a = None

    def handle_data(self, data):
        if self._ld is not None:
            self._ld += data; return
        if self._in_title:
            self.title += data; return
        if self._skip:
            return
        self._text.append(data)
        if self._cur:
            self._cur[1] += data
        if self._a is not None:
            self._a["text"] += data

    def text(self):
        return " ".join(" ".join(self._text).split())


def norm(url, base):
    u = urllib.parse.urljoin(base, url or "")
    p = urllib.parse.urlparse(u)
    return urllib.parse.urlunparse((p.scheme, p.netloc, p.path or "/", "", p.query, "")), p.fragment


def main():
    pages, queue, seen = {}, [], set()

    def push(url, src, depth):
        if url not in seen:
            seen.add(url); queue.append((url, src, depth))

    robots = fetch(BASE + "/robots.txt")
    robots_txt = robots["body"].decode("utf-8", "replace")
    sitemaps = re.findall(r"(?im)^sitemap:\s*(\S+)", robots_txt) or [BASE + "/sitemap.xml"]
    sitemap_urls, sitemap_status = [], {}
    for sm in sitemaps:
        r = fetch(sm)
        sitemap_status[sm] = {"status": r["status"], "type": r["headers"].get("content-type")}
        sitemap_urls += re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r["body"].decode("utf-8", "replace"))
        time.sleep(1)
    push(BASE + "/", "depart", 0)
    for u in sitemap_urls:
        push(u, "sitemap", None)

    while queue:
        url, src, depth = queue.pop(0)
        r = fetch(url)
        ctype = r["headers"].get("content-type", "")
        rec = {"url": url, "found_via": src, "depth": depth, "status": r["status"], "time": r["time"], "content_type": ctype, "bytes": len(r["body"]),
               "location": r["headers"].get("location"), "x_robots": r["headers"].get("x-robots-tag"), "cache_control": r["headers"].get("cache-control"),
               "encoding": r["headers"].get("content-encoding"), "error": r.get("error")}
        if r["status"] in (301, 302, 303, 307, 308) and rec["location"]:
            target, _ = norm(rec["location"], url)
            rec["redirect_to"] = target
            if urllib.parse.urlparse(target).netloc == HOST:
                push(target, url, depth)
        if r["status"] == 200 and "html" in ctype:
            p = Page()
            p.feed(r["body"].decode("utf-8", "replace"))
            text = p.text()
            links = []
            for a in p.links:
                href = a["href"]
                if not href or href.startswith(("mailto:", "tel:", "javascript:")):
                    links.append({"href": href, "kind": "autre", "text": a["text"], "rel": a["rel"], "aria": a["aria"], "img_alt": a["img_alt"]}); continue
                target, frag = norm(href, url)
                internal = urllib.parse.urlparse(target).netloc == HOST
                links.append({"href": href, "target": target, "fragment": frag, "kind": "interne" if internal else "externe", "text": a["text"], "rel": a["rel"],
                              "aria": a["aria"], "img_alt": a["img_alt"]})
                if internal and target != url:
                    push(target, url, (depth or 0) + 1)
            rec.update({"title": (p.title or "").strip() or None, "description": p.metas.get("description"), "robots": p.metas.get("robots"), "canonical": p.canonical,
                        "hreflang": p.hreflang, "lang": p.lang, "h1": p.h[1], "h2": p.h[2], "h3": p.h[3], "words": len(text.split()), "text": text, "links": links,
                        "images": p.images, "jsonld": p.jsonld, "og": {k: v for k, v in p.metas.items() if k.startswith(("og:", "twitter:"))},
                        "viewport": p.metas.get("viewport"), "scripts": p.scripts, "styles": p.styles})
        pages[url] = rec
        print("%s %s (%s) via %s" % (rec["status"], url, len(r["body"]), src), flush=True)
        time.sleep(1.5)  # poli avec l'hebergement mutualise

    ua_check = {}
    for name, ua in (("googlebot", GOOGLEBOT), ("navigateur", BROWSER)):
        r = fetch(BASE + "/", ua)
        ua_check[name] = {"status": r["status"], "bytes": len(r["body"]), "x_robots": r["headers"].get("x-robots-tag")}
        time.sleep(1)
    json.dump({"base": BASE, "user_agent": GOOGLEBOT, "robots_txt": robots_txt, "robots_status": robots["status"], "sitemaps": sitemap_status,
               "sitemap_urls": sitemap_urls, "ua_check": ua_check, "pages": pages}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("%d URL explorees -> %s" % (len(pages), OUT))


if __name__ == "__main__":
    main()

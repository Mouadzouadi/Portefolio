"""Analyse du crawl (crawl.json, et render.json s'il existe) : un rapport texte, section par section.

  python3 tools/seo-audit/analyze.py crawl.json [render.json]
"""
import itertools, json, re, sys, urllib.parse

crawl = json.load(open(sys.argv[1], encoding="utf-8"))
render = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else {}
P = crawl["pages"]
BASE = crawl["base"]
short = lambda u: u.replace(BASE, "") or "/"
html = {u: p for u, p in P.items() if p["status"] == 200 and "html" in (p.get("content_type") or "")}


def section(t):
    print("\n=== " + t)


def indexable(p):
    reasons = []
    if p["status"] != 200:
        reasons.append("code %s" % p["status"])
    if "noindex" in (p.get("robots") or "").lower() or "noindex" in (p.get("x_robots") or "").lower():
        reasons.append("noindex")
    can = [c for c in (p.get("canonical") or []) if c]
    if can and can[0] != p["url"]:
        reasons.append("canonique vers " + short(can[0]))
    return reasons


section("1. Crawl")
print("user-agent :", crawl["user_agent"][:70], "...")
print("meme reponse pour Googlebot et un navigateur :", crawl["ua_check"])
print("URL explorees :", len(P), "| HTML 200 :", len(html), "| codes :", {s: sum(1 for p in P.values() if p["status"] == s) for s in sorted({p["status"] for p in P.values()})})
print("robots.txt (%s) :\n%s" % (crawl["robots_status"], crawl["robots_txt"].strip()))
print("sitemaps :", crawl["sitemaps"], "|", [short(u) for u in crawl["sitemap_urls"]])

section("2. Modeles")
def template(u):
    path = urllib.parse.urlparse(u).path
    if path == "/": return "accueil"
    if "mentions" in path: return "page legale"
    return "page service"
groups = {}
for u in html: groups.setdefault(template(u), []).append(short(u))
for k, v in groups.items(): print("%-13s %d : %s" % (k, len(v), v))

section("4a. Indexabilite")
for u, p in P.items():
    r = indexable(p)
    print("%-40s %s" % (short(u), "indexable" if not r else "NON indexable : " + ", ".join(r)))
idx = [u for u, p in P.items() if not indexable(p)]
print("part indexable : %d / %d" % (len(idx), len(P)))

section("4b. Liens internes vers autre chose qu'une page 200 (301, 404, http, www)")
bad = 0
for u, p in html.items():
    for l in p["links"]:
        if l["kind"] != "interne": continue
        t = P.get(l["target"])
        if l["href"].startswith("http://") or "//www." in l["href"]:
            print("  lien http/www :", short(u), "->", l["href"]); bad += 1
        if t and t["status"] != 200:
            print("  %s -> %s (%s)" % (short(u), short(l["target"]), t["status"])); bad += 1
print("total :", bad)
ext = sorted({l["target"] for p in html.values() for l in p["links"] if l["kind"] == "externe"})
print("liens externes :", ext)
frag = [(short(u), l["href"]) for u, p in html.items() for l in p["links"] if l["kind"] == "interne" and l.get("fragment")]
print("liens vers des ancres : %d" % len(frag))

section("4c. Titres et meta-descriptions")
for u, p in html.items():
    t, d = p.get("title") or "", p.get("description") or ""
    flags = [x for x in ["TITRE ABSENT" if not t else "", "titre > 60" if len(t) > 60 else "", "DESCRIPTION ABSENTE" if not d else "", "description > 160" if len(d) > 160 else "", "description < 70" if d and len(d) < 70 else ""] if x]
    print("%-36s titre %2d : %s\n%36s desc %3d : %s %s" % (short(u), len(t), t, "", len(d), d[:90] + "…", flags or ""))
for field in ("title", "description"):
    vals = {}
    for u, p in html.items(): vals.setdefault(p.get(field), []).append(short(u))
    print("doublons de %s :" % field, {k: v for k, v in vals.items() if len(v) > 1} or "aucun")

section("4d. H1 / H2")
for u, p in html.items():
    print("%-36s H1 x%d : %s | H2 x%d | H3 x%d" % (short(u), len(p["h1"]), p["h1"], len(p["h2"]), len(p["h3"])))
h1s = {}
for u, p in html.items():
    for h in p["h1"]: h1s.setdefault(h, []).append(short(u))
print("H1 dupliques :", {k: v for k, v in h1s.items() if len(v) > 1} or "aucun")

section("4e. Contenu : pages minces et quasi-doublons")
def shingles(text, n=5):
    w = re.findall(r"\w+", text.lower())
    return {" ".join(w[i:i + n]) for i in range(max(0, len(w) - n + 1))}
def main_text(p):  # sans l'en-tete et le pied de page communs : approximation par retrait des phrases presentes partout
    return p["text"]
sh = {u: shingles(p["text"]) for u, p in html.items()}
common = set.intersection(*sh.values()) if len(sh) > 1 else set()
print("mots par page :", {short(u): p["words"] for u, p in html.items()})
print("gabarit commun (nav, pied de page) : %d sequences de 5 mots partagees par toutes les pages" % len(common))
for a, b in itertools.combinations(html, 2):
    A, B = sh[a] - common, sh[b] - common
    j = len(A & B) / max(1, len(A | B))
    print("  similarite %-34s vs %-34s : %4.1f %%" % (short(a), short(b), j * 100))

section("4f. Canoniques, robots, hreflang, langue")
for u, p in html.items():
    print("%-36s canonique %s | robots %s | x-robots %s | lang %s | hreflang %s" % (short(u), [short(c) for c in p["canonical"]], p.get("robots"), p.get("x_robots"), p.get("lang"), p.get("hreflang") or "aucun"))

section("4g. Sitemap vs crawl : orphelines et incoherences")
sm = set(crawl["sitemap_urls"])
linked = {l["target"] for p in html.values() for l in p["links"] if l["kind"] == "interne"}
print("dans le sitemap mais sans lien interne (orphelines) :", [short(u) for u in sm if u not in linked and u != BASE + "/"] or "aucune")
print("indexables absentes du sitemap :", [short(u) for u in idx if u not in sm] or "aucune")
print("dans le sitemap mais non indexables :", [short(u) for u in sm if u in P and indexable(P[u])] or "aucune")
print("pages sans aucun lien entrant :", [short(u) for u in html if u not in linked and u != BASE + "/"] or "aucune")

section("5. Maillage interne")
out = {u: [l for l in p["links"] if l["kind"] == "interne" and l["target"] in html and l["target"] != u] for u, p in html.items()}
depth = {BASE + "/": 0}; frontier = [BASE + "/"]
while frontier:
    nxt = []
    for u in frontier:
        for l in out.get(u, []):
            if l["target"] not in depth: depth[l["target"]] = depth[u] + 1; nxt.append(l["target"])
    frontier = nxt
N = len(html); pr = {u: 1 / N for u in html}
for _ in range(50):
    new = {u: 0.15 / N for u in html}
    for u in html:
        targets = [l["target"] for l in out[u]] or list(html)
        for t in targets: new[t] += 0.85 * pr[u] / len(targets)
    pr = new
inl = {u: [(short(s), l) for s in html for l in out[s] if l["target"] == u] for u in html}
for u in sorted(html, key=lambda x: -pr[x]):
    anchors = {}
    for s, l in inl[u]:
        a = l["text"] or (("[image alt=%r]" % l["img_alt"]) if l["img_alt"] is not None else "[SANS ANCRE]") + (" aria=%r" % l["aria"] if l["aria"] else "")
        anchors[a] = anchors.get(a, 0) + 1
    print("%-36s profondeur %s | PageRank interne %.3f | liens entrants %d depuis %d pages | sortants %d" % (short(u), depth.get(u, "?"), pr[u], len(inl[u]), len({s for s, _ in inl[u]}), len(out[u])))
    print("     ancres :", anchors)
nof = [(short(u), l["href"]) for u, p in html.items() for l in p["links"] if "nofollow" in l["rel"]]
print("liens nofollow :", nof or "aucun")
noanchor = [(short(u), l["href"]) for u, p in html.items() for l in p["links"] if l["kind"] != "autre" and not l["text"] and not l["img_alt"] and not l["aria"]]
print("liens sans ancre (ni texte, ni alt, ni aria-label) :", noanchor or "aucun")
logo = [(short(u), l["href"], l["aria"]) for u, p in html.items() for l in p["links"] if l["kind"] == "interne" and l["img_alt"] is not None and not l["text"].strip()]
print("liens image :", logo[:6])
targetblank = [(short(u), l["href"], l["rel"]) for u, p in html.items() for l in p["links"] if l["kind"] == "externe"]
print("liens externes (rel) :", targetblank)

section("8. Donnees structurees")
for u, p in html.items():
    types = []
    for raw in p["jsonld"]:
        try:
            d = json.loads(raw)
        except Exception as e:
            types.append("JSON INVALIDE : %s" % e); continue
        nodes = d.get("@graph", [d]) if isinstance(d, dict) else d
        for n in nodes:
            extra = ""
            if n.get("@type") == "FAQPage": extra = " (%d questions)" % len(n.get("mainEntity", []))
            if n.get("@type") in ("ProfessionalService", "LocalBusiness"):
                extra = " champs : " + ", ".join(k for k in ("name", "url", "telephone", "address", "areaServed", "image", "logo", "openingHoursSpecification", "geo", "sameAs", "priceRange", "aggregateRating") if n.get(k))
                extra += " | sameAs=%s" % n.get("sameAs")
            if n.get("@type") == "Service": extra = " provider=%s areaServed=%s" % ((n.get("provider") or {}).get("@type"), [a.get("name") for a in n.get("areaServed", [])])
            types.append(str(n.get("@type")) + extra)
    print("%-36s %s" % (short(u), types or "AUCUNE"))
    print("     Open Graph :", {k: (v[:50] if isinstance(v, str) else v) for k, v in p["og"].items() if k in ("og:title", "og:image", "og:url", "og:type", "twitter:card")})

section("Images (HTML brut)")
for u, p in html.items():
    noalt = [i["src"] for i in p["images"] if i["alt"] is None]; empty = [i["src"] for i in p["images"] if i["alt"] == ""]
    nodim = [i["src"] for i in p["images"] if not (i["width"] and i["height"])]
    print("%-36s %d images | sans attribut alt %d | alt vide (decoratif) %d | sans dimensions %d" % (short(u), len(p["images"]), len(noalt), len(empty), len(nodim)))

if render:
    section("3. HTML brut vs rendu JavaScript")
    for u, p in html.items():
        r = render.get(u, {})
        if "dom" not in r: print(short(u), "RENDU INDISPONIBLE", r.get("error")); continue
        d = r["dom"]
        raw_links = {l["target"] for l in p["links"] if l["kind"] != "autre"}
        ren_links = {urllib.parse.urldefrag(l["href"])[0] for l in d["links"] if l["href"].startswith("http")}
        print("%-36s mots brut %d / rendu %d | liens brut %d / rendu %d | liens seulement apres JS : %s | titre identique %s | H1 identique %s | canonique identique %s" % (
            short(u), p["words"], d["words"], len(raw_links), len(ren_links), sorted(short(x) for x in ren_links - raw_links) or "aucun",
            d["title"] == p["title"], d["h1"] == p["h1"], d["canonical"] == p["canonical"]))
        print("     erreurs JS :", r["errors"] or "aucune", "| requetes echouees :", r["failed"] or "aucune", "| debordement mobile :", d["overflow"], "| petites zones tactiles :", d["smallTaps"])
    section("6. Ressources chargees (rendu mobile)")
    for u in html:
        r = render.get(u, {})
        if "resources" not in r: continue
        res = r["resources"]; by = {}
        for x in res: by.setdefault(x["type"], [0, 0]); by[x["type"]][0] += 1; by[x["type"]][1] += x["size"]
        print("%-36s %d requetes, %d Ko | %s" % (short(u), len(res), sum(x["size"] for x in res) // 1024, {k: "%d/%dKo" % (v[0], v[1] // 1024) for k, v in by.items()}))
        hosts = {}
        for x in res: h = urllib.parse.urlparse(x["url"]).netloc; hosts[h] = hosts.get(h, 0) + 1
        print("     domaines :", hosts, "| codes != 200 :", [(x["status"], x["url"][-50:]) for x in res if x["status"] not in (200, 204, 206)] or "aucun")
        nocache = [x["url"].replace(BASE, "") for x in res if x["url"].startswith(BASE) and x["type"] in ("script", "stylesheet", "image", "font") and not re.search(r"max-age=(\d{5,})", x["cache"] or "")]
        print("     ressources du site avec cache court ou absent :", nocache or "aucune")
        uncompressed = [x["url"].replace(BASE, "") for x in res if x["url"].startswith(BASE) and x["type"] in ("script", "stylesheet", "document", "fetch") and not x["encoding"] and x["size"] > 1400]
        print("     texte non compresse :", uncompressed or "aucun")
        big = sorted([x for x in res if x["size"] > 40000], key=lambda x: -x["size"])
        print("     plus de 40 Ko :", [(x["size"] // 1024, x["url"][-45:]) for x in big] or "aucune")

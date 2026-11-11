"""Construit le site : CSS assemble, empreintes de contenu sur les scripts, pages dediees et sitemap.

  python3 tools/build.py

1. styles/main.css et ses @import -> styles/site.css (une page chargeait 17 fichiers les uns apres les autres).
2. Chaque import entre scripts recoit ?v=<empreinte du fichier importe et de ses propres imports> : un script
   modifie change d'adresse, ainsi que tous ceux qui l'importent. Les navigateurs peuvent donc garder les
   scripts en cache 30 jours (.htaccess) sans jamais servir une ancienne version.
3. index.html et les pages generees (tools/pages.py) appellent site.css et le script d'entree avec leur empreinte.
A relancer apres toute modification de styles/, scripts/, pages/ ou index.html. Les fichiers produits sont
versionnes : l'hebergement n'a rien a construire.
"""
import hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES = os.path.join(ROOT, "styles")
IMPORT = re.compile(r'@import\s+url\(\s*["\']?([^"\')?]+)(?:\?[^"\')]*)?["\']?\s*\)\s*;')


def inline(path, seen):
    path = os.path.normpath(path)
    if path in seen:
        return ""
    seen.add(path)
    css = open(path, encoding="utf-8").read()
    base = os.path.dirname(path)
    return IMPORT.sub(lambda m: inline(os.path.join(base, m.group(1)), seen), css)


def minify(css):
    # Les url(...) (dont le SVG du grain) et les chaines sont mis de cote : leurs espaces comptent.
    keep = []
    def hold(m):
        keep.append(m.group(0)); return "\x00%d\x00" % (len(keep) - 1)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r'url\((?:"[^"]*"|\'[^\']*\'|[^)]*)\)|"[^"\n]*"|\'[^\'\n]*\'', hold, css)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)
    css = re.sub(r";}", "}", css)
    css = re.sub(r"\x00(\d+)\x00", lambda m: keep[int(m.group(1))], css)
    return css.strip() + "\n"


SCRIPTS = os.path.join(ROOT, "scripts")
# from './x.js' / from '../x.js?v=abc' (imports statiques relatifs ; l'import dynamique du SDK Retell est externe).
IMPORT_JS = re.compile(r"""(\bfrom\s*['"])(\.{1,2}/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])""")


def _short(data):
    return hashlib.sha1(data).hexdigest()[:10]


def js_hash(path, memo=None):
    """Empreinte d'un script : son texte (sans les ?v=) et les empreintes de ce qu'il importe."""
    memo = {} if memo is None else memo
    path = os.path.normpath(path)
    if path not in memo:
        memo[path] = "en-cours"
        text = open(path, encoding="utf-8").read()
        parts = [IMPORT_JS.sub(lambda m: m.group(1) + m.group(2) + m.group(3), text)]
        for m in IMPORT_JS.finditer(text):
            dep = os.path.join(os.path.dirname(path), m.group(2))
            if memo.get(os.path.normpath(dep)) == "en-cours":
                raise SystemExit("import circulaire : %s" % dep)
            parts.append(js_hash(dep, memo))
        memo[path] = _short("\n".join(parts).encode())
    return memo[path]


def fingerprint_scripts():
    memo = {}
    for folder, _, names in os.walk(SCRIPTS):
        for n in names:
            if not n.endswith(".js"):
                continue
            path = os.path.join(folder, n)
            text = open(path, encoding="utf-8").read()
            new = IMPORT_JS.sub(lambda m: "%s%s?v=%s%s" % (m.group(1), m.group(2), js_hash(os.path.join(folder, m.group(2)), memo), m.group(3)), text)
            if new != text:
                open(path, "w", encoding="utf-8").write(new)
    return memo


def versions():
    """Empreintes utilisees dans les pages : site.css, scripts/main.js (accueil), scripts/page.js (pages dediees)."""
    return {"css": _short(open(os.path.join(STYLES, "site.css"), "rb").read()),
            "main_js": js_hash(os.path.join(SCRIPTS, "main.js")), "page_js": js_hash(os.path.join(SCRIPTS, "page.js"))}


def stamp_index(v):
    p = os.path.join(ROOT, "index.html")
    s = open(p, encoding="utf-8").read()
    s2 = re.sub(r'/styles/site\.css\?v=[\w-]+', "/styles/site.css?v=" + v["css"], s)
    s2 = re.sub(r'/scripts/main\.js\?v=[\w-]+', "/scripts/main.js?v=" + v["main_js"], s2)
    if "/styles/site.css?v=" + v["css"] not in s2 or "/scripts/main.js?v=" + v["main_js"] not in s2:
        raise SystemExit("index.html : appel de site.css ou de main.js introuvable")
    if s2 != s:
        open(p, "w", encoding="utf-8").write(s2)


if __name__ == "__main__":
    out = minify(inline(os.path.join(STYLES, "main.css"), set()))
    assert "@import" not in out, "un @import n'a pas ete resolu"
    open(os.path.join(STYLES, "site.css"), "w", encoding="utf-8").write("/* Genere par tools/build.py depuis styles/main.css : ne pas modifier a la main. */\n" + out)
    print("styles/site.css : %d octets" % len(out))
    fingerprint_scripts()
    v = versions()
    stamp_index(v)
    print("empreintes :", v)
    import pages  # pages dediees, 404 et sitemap, avec les memes empreintes
    pages.main()

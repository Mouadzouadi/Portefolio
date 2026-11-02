"""Assemble les feuilles de style en un seul fichier : styles/site.css (celui que chargent les pages).

  python3 tools/build.py

Les sources restent dans styles/ (main.css et ses @import). Une page qui chargeait main.css telechargeait
17 fichiers les uns apres les autres avant de s'afficher ; site.css arrive en une fois. A relancer apres
chaque modification d'un fichier de styles/ (site.css est versionne pour que l'hebergement n'ait rien a construire).
"""
import os, re

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


if __name__ == "__main__":
    out = minify(inline(os.path.join(STYLES, "main.css"), set()))
    assert "@import" not in out, "un @import n'a pas ete resolu"
    open(os.path.join(STYLES, "site.css"), "w", encoding="utf-8").write("/* Genere par tools/build.py depuis styles/main.css : ne pas modifier a la main. */\n" + out)
    print("styles/site.css : %d octets" % len(out))

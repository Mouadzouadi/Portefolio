"""Genere les pages dediees (referencement) a partir de pages/*.html et d'un gabarit commun.

  python3 tools/pages.py

Chaque source pages/<adresse>.html commence par un commentaire <!--meta {...}--> (JSON) :
  title, description, h1, eyebrow, lede, faq [[question, reponse], ...], service (nom du service pour Google)
puis le contenu HTML de la page. Sortie : <adresse>/index.html (adresse propre : https://zmsolutions.fr/<adresse>/).
Le plan du site (sitemap.xml) est regenere avec la page d'accueil et toutes ces pages ; <lastmod> = date du
dernier commit qui a modifie la source de la page (aujourd'hui si elle a des modifications non commitees).
Normalement lance par tools/build.py, qui fournit les empreintes de site.css et des scripts.
"""
import datetime, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://zmsolutions.fr"
ORG_ID = SITE + "/#organization"  # entreprise decrite sur l'accueil (index.html), referencee par les pages
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def lastmod(path):
    """Date de la derniere modification reelle d'un fichier source (git), sinon aujourd'hui."""
    rel = os.path.relpath(path, ROOT)
    dirty = subprocess.run(["git", "diff", "--quiet", "HEAD", "--", rel], cwd=ROOT).returncode != 0
    date = subprocess.run(["git", "log", "-1", "--format=%cs", "--", rel], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return datetime.date.today().isoformat() if dirty or not date else date

NAV = [("/#valeur", "Offres"), ("/agent-vocal-ia-restaurant/", "Agent vocal"), ("/commande-whatsapp-restaurant/", "WhatsApp"),
       ("/creation-site-web/", "Site web"), ("/#tarifs", "Tarifs")]

LAYOUT = """<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta name="robots" content="{robots}" />
  <link rel="canonical" href="{url}" />
  <meta name="theme-color" content="#0c1320" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ZM Solutions" />
  <meta property="og:locale" content="fr_FR" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:image" content="{site}/img/og-image.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.ico" sizes="48x48" />
  <link rel="icon" href="/img/icon-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
  <!-- Polices hebergees sur le site (styles/base/fonts.css) : prechargees, elles s'affichent sans attendre le CSS. -->
  <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/playfair-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/styles/site.css?v={css}" />
{jsonld}
</head>
<body>
  <div class="grain" aria-hidden="true"></div>

  <header class="nav" id="nav">
    <a href="/" class="nav__brand">
      <picture><source srcset="/img/logo.webp" type="image/webp" /><img src="/img/logo.png" alt="" class="nav__logo" width="102" height="56" /></picture>
      <span class="nav__wordmark">
        <span class="nav__wordmark-main">ZM Solutions</span>
        <span class="nav__wordmark-sub">Digitalisation · IA · Sur-mesure</span>
      </span>
    </a>
    <nav class="nav__links" aria-label="Navigation principale">
{nav}
      <a href="/#contact" class="nav__cta">Échanger</a>
    </nav>
    <button class="nav__burger" aria-label="Menu" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
  </header>

  <main id="top">
    <section class="section page-hero">
      <nav class="crumbs" aria-label="Fil d'Ariane"><a href="/">Accueil</a> <span aria-hidden="true">›</span> <span>{crumb}</span></nav>
      <span class="eyebrow">{eyebrow}</span>
      <h1 class="section__title">{h1}</h1>
      <p class="section__sub">{lede}</p>
    </section>

    <article class="section prose">
{body}
    </article>
{faq}
    <section class="section section--dark page-cta">
      <div class="section__head">
        <span class="eyebrow">Parlons de votre commerce</span>
        <h2 class="section__title">Un premier échange, <em>gratuit et sans engagement</em>.</h2>
        <p class="section__sub">Je vous rappelle sous 24&nbsp;h pour comprendre votre besoin et vous donner un prix précis.</p>
      </div>
      <div class="page-cta__actions">
        <a href="/#contact" class="btn btn--primary">Demander un devis</a>
        <a href="tel:+33771032375" class="btn btn--ghost">07 71 03 23 75</a>
      </div>
    </section>
  </main>

{footer}
  <script type="module" src="/scripts/page.js?v={js}"></script>
</body>
</html>
"""

FOOTER = """  <footer class="footer">
    <div class="footer__top">
      <div class="footer__brand">
        <picture><source srcset="/img/logo.webp" type="image/webp" /><img src="/img/logo.png" alt="" width="102" height="56" loading="lazy" /></picture>
        <div>
          <strong>ZM Solutions</strong>
          <span>Zouadi Mouad — Ingénieur Logiciel et Intelligence Artificielle</span>
        </div>
      </div>
      <nav class="footer__nav" aria-label="Pied de page">
        <a href="/agent-vocal-ia-restaurant/">Agent vocal IA pour restaurant</a>
        <a href="/commande-whatsapp-restaurant/">Commande WhatsApp</a>
        <a href="/creation-site-web/">Création de site web</a>
        <a href="/#contact">Contact</a>
        <a href="/mentions-legales/">Mentions légales</a>
      </nav>
    </div>
    <div class="footer__bottom">
      <small>© <span id="year"></span> ZM Solutions — Tous droits réservés.</small>
    </div>
  </footer>"""


def esc(s):
    return html.escape(s, quote=True)


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s)).replace("\xa0", " ")).strip()


def render(slug, meta, body, v):
    url = SITE + "/" + slug + "/"
    graph = [{"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": meta.get("crumb", meta["h1_text"]), "item": url}]}]
    if meta.get("service"):
        graph.append({"@type": "Service", "name": meta["service"], "serviceType": meta["service"], "url": url,
                      "description": meta["description"],
                      "provider": {"@id": ORG_ID},
                      "areaServed": [{"@type": "Country", "name": "France"}]})
    faq = meta.get("faq") or []
    if faq:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": text(q), "acceptedAnswer": {"@type": "Answer", "text": text(a)}} for q, a in faq]})
    jsonld = '  <script type="application/ld+json">\n' + json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2) + "\n  </script>"
    faq_html = ""
    if faq:
        faq_html = '\n    <section class="section" id="faq">\n      <div class="section__head"><span class="eyebrow">Questions fréquentes</span><h2 class="section__title">Vos questions, <em>mes réponses</em>.</h2></div>\n      <div class="faq">\n' + "\n".join(
            '        <details class="faq__item">\n          <summary class="faq__q">%s <span class="faq__icon" aria-hidden="true"></span></summary>\n          <p class="faq__a">%s</p>\n        </details>' % (q, a) for q, a in faq) + "\n      </div>\n    </section>\n"
    nav = "\n".join('      <a href="%s"%s>%s</a>' % (h, ' aria-current="page"' if h == "/" + slug + "/" else "", t) for h, t in NAV)
    return LAYOUT.format(title=esc(meta["title"]), description=esc(meta["description"]), url=url, site=SITE, css=v["css"], js=v["page_js"],
                         robots=meta.get("robots", "index, follow, max-image-preview:large"), jsonld=jsonld, nav=nav,
                         crumb=esc(meta.get("crumb", meta["h1_text"])), eyebrow=meta["eyebrow"], h1=meta["h1"], lede=meta["lede"],
                         body=body.rstrip(), faq=faq_html, footer=FOOTER)


def main():
    import build
    v = build.versions()
    src = os.path.join(ROOT, "pages")
    urls = [(SITE + "/", "1.0", lastmod(os.path.join(ROOT, "index.html")))]
    for f in sorted(os.listdir(src)):
        if not f.endswith(".html"):
            continue
        slug = f[:-5]
        raw = open(os.path.join(src, f), encoding="utf-8").read()
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->\s*", raw, re.S)
        if not m:
            raise SystemExit(f + " : bloc <!--meta {...}--> manquant")
        meta = json.loads(m.group(1))
        meta["h1_text"] = text(meta["h1"])
        assert len(meta["title"]) <= 65, f + " : titre trop long (%d)" % len(meta["title"])
        assert 70 <= len(meta["description"]) <= 160, f + " : description de %d caracteres" % len(meta["description"])
        # "output" : fichier a la racine (ex. 404.html), sinon <adresse>/index.html.
        target = os.path.join(ROOT, meta["output"]) if meta.get("output") else os.path.join(ROOT, slug, "index.html")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        open(target, "w", encoding="utf-8").write(render(slug, meta, raw[m.end():], v))
        if "noindex" not in meta.get("robots", ""):
            urls.append((SITE + "/" + slug + "/", meta.get("priority", "0.8"), lastmod(os.path.join(src, f))))
        print(os.path.relpath(target, ROOT))
    open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8").write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join("  <url>\n    <loc>%s</loc>\n    <lastmod>%s</lastmod>\n    <priority>%s</priority>\n  </url>\n" % (u, d, p) for u, p, d in urls)
        + "</urlset>\n")
    print("sitemap.xml : %d adresses" % len(urls))


if __name__ == "__main__":
    main()

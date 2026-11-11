# ZM Solutions — site zmsolutions.fr

Site statique (HTML, CSS, JavaScript sans framework) hébergé chez Infomaniak (Apache + PHP), avec deux démos réelles :
l'agent vocal Retell (via `api/retell-web-call.php`) et la commande WhatsApp (numéro de démo du bot n8n).

## Structure

```
index.html                    page d'accueil (démos vocale, WhatsApp, boutique ; tarifs ; FAQ ; contact)
agent-vocal-ia-restaurant/    pages dédiées au référencement, GÉNÉRÉES depuis pages/ (ne pas modifier à la main)
commande-whatsapp-restaurant/
creation-site-web-blois/
mentions-legales/
404.html                      page d'erreur (générée)
pages/*.html                  sources des pages dédiées : bloc <!--meta {...}--> + contenu
api/                          retell-web-call.php (crée l'appel Retell), use-cases.php (agents et rôles), config.php (secret, non versionné)
scripts/                      main.js (accueil), page.js (pages dédiées), demo-config.js (cas d'usage de la démo vocale), modules/
styles/                       sources CSS (main.css + @import) ; site.css = fichier assemblé chargé par les pages
img/                          images optimisées (WebP + repli JPG/PNG), photos de la démo boutique dans img/menu/
data/menu.json                carte de la démo boutique
tools/build.py                construit tout : site.css, empreintes des scripts, pages dédiées, sitemap
tools/pages.py                pages dédiées, 404 et sitemap.xml (appelé par build.py)
fonts/                        polices hébergées (Inter, Playfair Display)
```

## Modifier le site

- **Après toute modification** (styles, scripts, pages, accueil) : `python3 tools/build.py`. Il assemble `styles/site.css`,
  ajoute une empreinte de contenu à chaque script et au CSS (cache navigateur d'un an sans risque de version périmée),
  régénère les pages dédiées, la 404 et `sitemap.xml` (dates = dernier commit de chaque page). Commiter ensuite.
- **Pages dédiées** : modifier `pages/<adresse>.html`, puis `python3 tools/build.py`. Une nouvelle page = un nouveau
  fichier dans `pages/`. Titre ≤ 65 caractères, description entre 70 et 160 (vérifié).
- **Polices** : hébergées dans `fonts/` (`styles/base/fonts.css`), aucun appel à Google Fonts.
- **Démo vocale** : les rôles des agents sont dans `api/use-cases.php`, les boutons dans `scripts/demo-config.js` (mêmes clés).
- **Tester en local** : `python3 -m http.server 5500` à la racine, puis http://localhost:5500 (la démo vocale a besoin de PHP :
  `php -S localhost:5500`).

## Mettre en ligne (Infomaniak)

1. Envoyer tout le dépôt à la racine du site, **sauf** `.git/`, `pages/`, `tools/` : `bash ~/deploy-site.sh ~/sites/zmsolutions.fr`
   (script `tools/deploy-infomaniak.sh`).
   Les fichiers `.htaccess` (racine et `api/`) doivent être envoyés : ils activent la compression, le cache, la page 404
   et protègent la configuration.
2. Sur l'hébergement, créer `api/config.php` à partir de `api/config.example.php` avec la vraie clé Retell
   (tableau de bord Retell › API Keys) et une chaîne aléatoire pour `salt`. Ce fichier ne doit jamais être commité.
3. Vérifier : https://zmsolutions.fr/sitemap.xml s'affiche, https://zmsolutions.fr/api/config.php renvoie une erreur 403,
   et la démo vocale démarre un appel.
4. Référencement : déclarer `https://zmsolutions.fr/sitemap.xml` dans Google Search Console, et tenir à jour la fiche
   Google Business Profile (adresse à Blois, catégorie, lien vers le site) : c'est elle qui fait apparaître le site
   dans les recherches locales.

## Démo WhatsApp

Le bouton et le QR code ouvrent la conversation avec le numéro de démo (+33 9 39 24 73 13), branché sur le bot n8n
hébergé (n8n.zmsolutions.fr). `api/whatsapp-offline.php` est la réponse de secours à déclarer comme « Fallback URL »
chez Twilio si le bot ne répond pas.

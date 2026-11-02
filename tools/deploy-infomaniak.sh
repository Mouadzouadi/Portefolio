#!/bin/bash
# Met en ligne zmsolutions.fr depuis GitHub, a lancer en SSH sur l'hebergement Infomaniak :
#   bash deploy-infomaniak.sh /srv/customer/sites/zmsolutions.fr [branche]
# - telecharge (ou met a jour) le depot dans ~/zm-site-src ;
# - sauvegarde le site actuel dans ~/zm-site-backups/<date>/ ;
# - copie le site (sans .git, pages/, tools/, README) dans le dossier du site ;
# - ne touche jamais a api/config.php (cle Retell), qui reste sur le serveur.
set -euo pipefail
DEST="${1:-}"
BRANCH="${2:-feature/demos-whatsapp}"
REPO="https://github.com/Mouadzouadi/Portefolio.git"
SRC="$HOME/zm-site-src"

[ -n "$DEST" ] || { echo "Usage : bash deploy-infomaniak.sh <dossier du site> [branche]"; exit 1; }
[ -d "$DEST" ] || { echo "Dossier introuvable : $DEST"; exit 1; }
case "$DEST" in */n8n.zmsolutions.fr*) echo "Ce dossier est celui de n8n, pas du site : arret."; exit 1;; esac

if [ -d "$SRC/.git" ]; then
  git -C "$SRC" fetch --depth 1 origin "$BRANCH"
  git -C "$SRC" checkout -q -B "$BRANCH" FETCH_HEAD
else
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$SRC"
fi
echo "Version : $(git -C "$SRC" log -1 --format='%h %s')"

BACKUP="$HOME/zm-site-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
cp -a "$DEST"/. "$BACKUP"/
echo "Sauvegarde de l'ancien site : $BACKUP"

EXCLUDES=(--exclude .git --exclude pages --exclude tools --exclude README.md --exclude .gitignore --exclude api/config.php)
# Copie sans suppression : les fichiers propres a l'hebergement (.well-known, .user.ini...) ne sont jamais touches.
if command -v rsync >/dev/null 2>&1; then
  rsync -a "${EXCLUDES[@]}" "$SRC"/ "$DEST"/
else
  (cd "$SRC" && tar -cf - "${EXCLUDES[@]}" .) | (cd "$DEST" && tar -xf -)
fi
# Ancienne configuration de la demo vocale (tunnel ngrok du PC) : remplacee par api/retell-web-call.php.
rm -f "$DEST/scripts/config.js" "$DEST/scripts/config.example.js"

if [ -f "$DEST/api/config.php" ]; then
  chmod 640 "$DEST/api/config.php"  # lisible par PHP (meme compte), jamais servi : .htaccess le bloque
  echo "api/config.php present (cle Retell)."
else
  echo "ATTENTION : api/config.php manque. Creez-le (voir etape 3 du guide) pour que la demo vocale fonctionne."
fi
echo "Termine. Verifiez https://zmsolutions.fr/ (rechargez avec Ctrl+F5)."

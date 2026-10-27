# ZM Solutions — Site portfolio

Site web statique, épuré et sophistiqué, pour présenter **ZM Solutions** (Zouadi Mouad), studio de digitalisation et d'IA pour les commerces de proximité.

## Structure

```
Portefolio/
├── index.html              ← page unique (one-page éditorial)
├── logo.png / photo.jpg    ← visuels (favicon, header, hero, footer)
├── data/                   ← données des démos (stock, orders, menu)
├── styles/                 ← design system modulaire (base / components / sections)
├── api/                    ← PHP hébergé avec le site (démo vocale, secours WhatsApp)
│   ├── retell-web-call.php ← crée l'appel Retell (remplace le webhook n8n)
│   ├── whatsapp-offline.php← réponse de secours si le bot WhatsApp ne répond pas
│   ├── config.php          ← clé Retell (NON versionné, à créer sur l'hébergement)
│   └── config.example.php  ← modèle sans secret
├── scripts/
│   ├── main.js             ← orchestration des modules
│   ├── config.js           ← secrets + pré-prompts de l'agent (NON versionné)
│   ├── config.example.js   ← modèle de config sans secrets
│   ├── modules/            ← un fichier par feature (agent, stock, shop…)
│   └── utils/              ← helpers DOM / fetch
└── README.md
```

> ⚠️ `scripts/config.js` (identifiants d'agents, pré-prompts) et `api/config.php`
> (clé API Retell) sont ignorés par Git. Copiez les fichiers `*.example.*` puis
> renseignez vos valeurs. La clé Retell ne doit jamais aller dans `scripts/` :
> tout ce dossier est téléchargeable par les visiteurs.

## Lancer le site en local

Aucune dépendance, aucun build. Deux options :

**Option A — double-clic** : ouvrez `index.html` dans votre navigateur.

**Option B — serveur local (recommandé pour les polices Google)** :

```powershell
# depuis le dossier Portefolio
python -m http.server 5500
# puis ouvrir http://localhost:5500
```

ou avec l'extension VS Code **Live Server** : clic droit sur `index.html` → *Open with Live Server*.

## Sections du site

1. **Hero** éditorial — qui vous êtes, ce que vous proposez, KPI clés.
2. **Proposition de valeur** — 3 cartes : agent vocal, web métier, accompagnement local.
3. **Démo Agent Vocal interactive** — agent vocal réel branché sur **Retell** via
   `api/retell-web-call.php` (fonctionne sans le PC de développement). 3 cas d'usage
   avec pré-prompt éditable et transcription en direct. Garde-fous : agents autorisés,
   origine du site, 4 appels par heure et par IP, 40 par jour (`api/config.php`).
3 bis. **Démo WhatsApp** (`#whatsapp`) — bouton « Ouvrir WhatsApp » (lien `wa.me`
   avec message prérempli), lien WhatsApp Web pour un ordinateur sans l'application,
   QR code (SVG intégré, aucun service tiers) et aperçu de conversation. Sur téléphone,
   seul le bouton est affiché. Le numéro est celui du restaurant de démonstration.
4. **Web métier** — 2 démos cliquables :
   - **Gestion de stock** : tableau live avec recherche, alertes colorées, bouton *Réappro*.
   - **Préparation Click & Collect** : grille de commandes filtrable, items cochables, workflow `Nouvelle → En préparation → Prête`.
5. **Témoignages** locaux (Mouad S., Julie B., Karim T.).
6. **Contact** — formulaire épuré avec validation côté client.

## Design

- **Typographie** : *Fraunces* (serif éditorial) pour les titres, *Inter* pour le texte courant.
- **Palette** : ivoire chaud `#f6f1e7`, encre profonde `#0c1320`, accent or pâle `#b9925a`.
- **Détails** : grain subtil sur toute la page, soulignés au survol, animations *reveal on scroll*, formes circulaires pour les CTA.

## Personnalisation rapide

| Élément          | Où le modifier                                      |
|------------------|-----------------------------------------------------|
| Email / téléphone| `index.html` → section `#contact` (`mailto:` / `tel:`) |
| Webhook & agents | `scripts/config.js` → `WEBHOOK_URL`, `AGENT_IDS`    |
| Pré-prompts vocaux | `scripts/config.js` → `USE_CASES`                 |
| Stock affiché    | `data/stock.json`                                   |
| Commandes        | `data/orders.json`                                  |
| Couleurs         | `styles/base/tokens.css` → bloc `:root`             |

## Brancher un vrai backend (plus tard)

- **Formulaire de contact** : pointer le `submit` vers Formspree / Resend / une fonction Vercel.
- **Agent vocal réel** : remplacer la simulation JS par un widget [Vapi](https://vapi.ai/) ou [Retell](https://retellai.com/) (chacun fournit un snippet `<script>` + un bouton « call »).
- **Stock & commandes** : connecter à une API (Supabase, Strapi, ou votre propre backend Node/Spring).

## Déploiement

Hébergement actuel : Infomaniak (Apache + PHP).

1. Envoyer tous les fichiers, dont le dossier `api/` (avec son `.htaccess`).
2. Sur l'hébergement, copier `api/config.example.php` en `api/config.php` et y mettre la
   clé API Retell (tableau de bord Retell › API Keys) et un sel aléatoire.
3. Vérifier `https://zmsolutions.fr/api/retell-web-call.php` : une visite directe doit
   répondre `{"error":"POST uniquement"}`, et `api/config.php` doit être refusé (403).
4. Optionnel : chez Twilio, mettre `https://zmsolutions.fr/api/whatsapp-offline.php` en
   *Fallback URL* de l'expéditeur WhatsApp (message clair si le bot ne répond pas).

Sans PHP, le reste du site est 100 % statique et tout hébergeur convient :

- **Vercel** / **Netlify** — déposez le dossier, c'est en ligne en 30 secondes.
- **GitHub Pages** — push sur un repo, activer Pages.
- **OVH / o2switch** — FTP du dossier dans `www/`.

## Accessibilité

- Navigation clavier complète (focus visible, `aria-label`, `role="tab"`).
- `prefers-reduced-motion` respecté (animations désactivées).
- Contraste AA sur l'ensemble des textes.

---

Conçu & développé pour Zouadi Mouad — 2026.

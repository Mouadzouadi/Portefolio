# ZM Solutions — Site portfolio

Site web statique, épuré et sophistiqué, pour présenter **ZM Solutions** (Zouadi Mouad), studio de digitalisation et d'IA pour les commerces de proximité.

## Structure

```
Portefolio/
├── index.html              ← page unique (one-page éditorial)
├── logo.png / photo.jpg    ← visuels (favicon, header, hero, footer)
├── data/                   ← données des démos (stock, orders, menu)
├── styles/                 ← design system modulaire (base / components / sections)
├── scripts/
│   ├── main.js             ← orchestration des modules
│   ├── config.js           ← secrets + pré-prompts de l'agent (NON versionné)
│   ├── config.example.js   ← modèle de config sans secrets
│   ├── modules/            ← un fichier par feature (agent, stock, shop…)
│   └── utils/              ← helpers DOM / fetch
└── README.md
```

> ⚠️ `scripts/config.js` contient l'URL du webhook n8n et les identifiants
> d'agents Retell : il est ignoré par Git. Copiez `config.example.js` en
> `config.js` puis renseignez vos valeurs.

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
3. **Démo Agent Vocal interactive** — agent vocal réel branché sur **Retell** (via un
   webhook **n8n**). 3 cas d'usage (restauration rapide, coiffeur, hôtel) avec
   pré-prompt éditable et transcription en direct (bulles agent / client).
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

Le site étant 100 % statique, tout hébergeur convient :

- **Vercel** / **Netlify** — déposez le dossier, c'est en ligne en 30 secondes.
- **GitHub Pages** — push sur un repo, activer Pages.
- **OVH / o2switch** — FTP du dossier dans `www/`.

## Accessibilité

- Navigation clavier complète (focus visible, `aria-label`, `role="tab"`).
- `prefers-reduced-motion` respecté (animations désactivées).
- Contraste AA sur l'ensemble des textes.

---

Conçu & développé pour Zouadi Mouad — 2026.

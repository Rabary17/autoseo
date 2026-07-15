# Architecture headless — WordPress + Next.js (monauto)

Documentation de la dynamisation front/back mise en place le 2026-07-11 sur le
silo « Auto & mobilité », **et de la bascule d'architecture du 2026-07-14**
(export statique → ISR/Vercel, voir section 1). Complète
[skills/developpement.md](../skills/developpement.md) (qui reste la référence
pour les règles générales) — ce document décrit ce qui a été **réellement
implémenté**.

## 1. Vue d'ensemble

```
WordPress (mntdev.passion4humanity.com)   Next.js 15 (frontend/monauto)        Vercel (ISR)
────────────────────────────────────      ──────────────────────────────      ──────────────────────────
Rédaction en Gutenberg                     Page générée à la demande au        Cache indéfini par page,
+ ACF (tldr, sources, faq, job_title) ───▶ premier accès (ISR), pas de     ───▶ régénérée UNIQUEMENT sur
+ catégories = silos                       rebuild global                      appel ciblé de /api/revalidate
+ tags = entités transversales
+ REST API (?rest_route=/wp/v2/...)   ◀─── mu-plugin : POST /api/revalidate à chaque publication/
                                             dépublication/changement de catégorie ou de profil auteur
```

**Décision du 2026-07-14 : ISR sur Vercel, remplace l'export 100 % statique
retenu le 2026-07-11.** Un export statique pur régénère TOUTES les pages à
chaque build — à l'échelle visée (jusqu'à 15 articles/jour en rythme de
croisière, ~10 000 pages à terme, voir
[skills/wordpress-publication.md](../skills/wordpress-publication.md) section
6), même un rebuild quotidien devient inutilement coûteux/lent puisqu'il
régénère aussi les ~9 990 pages qui n'ont pas changé. Avec l'**ISR**
(Incremental Static Regeneration) :

- Chaque page article/hub/sous-hub/auteur est générée à la demande au premier
  accès puis mise en cache indéfiniment (`revalidate = 900` en filet de
  sécurité passif sur les listings, voir `app/page.tsx`).
- **Régénération ciblée** : le mu-plugin WordPress (`monauto_send_revalidation`,
  throttlé, réglages dans wp-admin → Réglages > Revalidation Next.js) appelle
  `POST https://<site>.vercel.app/api/revalidate` avec les chemins exacts
  concernés (`revalidatePath`) à chaque publication, dépublication, mise à la
  corbeille, changement de catégorie ou de profil auteur — jamais de rebuild
  global. Authentifié par secret partagé (`REVALIDATE_SECRET`, identique côté
  Vercel et wp-admin). Mécanisme directement inspiré du plugin
  "next-revalidate" du projet de référence
  [next-wp](https://github.com/9d8dev/next-wp).
- **Aucun rebuild programmé n'est plus nécessaire** : la tâche planifiée
  Windows `monauto-rebuild-quotidien` (rebuild quotidien à 3h, voir
  l'historique en section 4.1) est abandonnée avec cette décision.
- Reste 100 % gratuit sur le plan **Vercel Hobby** (l'ISR fait partie du
  forfait, contrairement à l'optimiseur d'image — voir section 3.3).
- Site déployé sur Vercel (`monauto-tau.vercel.app` à ce stade) ; WordPress
  réel sur `mntdev.passion4humanity.com` (voir blocage d'authentification
  documenté dans [STATE.md](../STATE.md) et
  [docs/setup-wordpress-vierge.md](setup-wordpress-vierge.md)).

`next.config.ts` : `trailingSlash: true`, `images.unoptimized: true` — **pas**
`output: "export"` (retiré avec cette décision).

## 2. Côté WordPress

### 2.1 Fichier `wp-content/mu-plugins/monauto-headless.php`

Un **mu-plugin** (toujours actif, pas besoin de l'activer manuellement) qui
ajoute, sans dépendre de plugins tiers :

1. **Champs ACF** (`acf/init`) :
   - Article (post type `post`) : `tldr` (texte, "L'essentiel" — voir
     [skills/geo.md](../skills/geo.md) section 2) et `sources` (texte, une
     source par ligne au format `Libellé | URL`).
   - Auteur (`user_form`) : `job_title` (intitulé de poste) et `same_as`
     (une URL par ligne — profils vérifiables, alimente le schema `Person`).
   - **Note technique** : ACF **Free** (installé sur ce site, pas la version
     Pro) n'a pas de champ Repeater. D'où le choix de champs texte avec un
     format ligne-par-ligne plutôt qu'un vrai tableau structuré — Next.js les
     parse (`lib/wp.ts` → `parseSources`/`parseSameAs`). Si le site passe un
     jour à ACF Pro, on pourra migrer vers un vrai Repeater sans changer la
     structure des pages Next.js (juste la fonction de parsing).
2. **Exposition REST** : ACF expose déjà nativement `acf` sur `/wp/v2/posts`
   et, depuis sa v6, sur `/wp/v2/users` (aucun code manuel nécessaire — testé
   et confirmé en live). Le mu-plugin republie uniquement le champ
   `description` (bio auteur) en context `view` (public), alors que WordPress
   ne l'expose nativement qu'en context `edit` (authentifié).
3. **Sécurité** : XML-RPC désactivé, `X-Robots-Tag: noindex` + `<meta
   name="robots" content="noindex">` sur tout le domaine WordPress (seul le
   frontend Next.js doit être indexé — voir skills/developpement.md section 2).
4. **Webhook de rebuild** sur `publish_post`/`publish_page`/`trashed_post`.

### 2.2 Contenu de test

Créé via [scripts/seed-monauto-test-content.js](../scripts/seed-monauto-test-content.js)
(idempotent — relançable sans dupliquer) :

| Élément | Valeur |
|---|---|
| Catégorie | Entretien & révision (`entretien`) |
| Tag | Vidange (`vidange`) |
| Auteur | Julien Fabre (`julien-fabre`, rôle Author, persona A — voir [skills/wordpress-publication.md](../skills/wordpress-publication.md) section 4) |
| Page | À propos (`a-propos`) |
| Article | Vidange : périodicité, prix et quand la faire soi-même (`vidange-guide`) |

**Non fait dans ce test minimal** (à faire avant une vraie mise en production) :
image à la une (upload média + `featured_media`), remplissage des 18 autres
catégories/silos côté WordPress (la nav/l'accueil les affichent déjà via
`data/taxonomy.json`, mais aucun contenu WP réel ne leur est encore rattaché).

## 3. Côté Next.js (`frontend/monauto`)

```
frontend/monauto/
├── app/
│   ├── layout.tsx                     # Header/Footer/BottomNav, CSS global, script anti-FOUC dark mode, métadonnées
│   ├── page.tsx                       # Accueil (grille des 19 silos + derniers articles WP + newsletter), revalidate=900
│   ├── not-found.tsx                  # 404 brandée, vrai code HTTP
│   ├── rubriques/page.tsx             # Index des 19 rubriques
│   ├── categorie/[slug]/page.tsx      # Hub de silo (19 silos) + pagination (?page=N)
│   ├── auteur/[slug]/page.tsx         # Page auteur (schema Person) + pagination
│   ├── tag/[slug]/page.tsx            # Entité transversale (marque/pièce/prestation) + pagination — pas de generateStaticParams, ISR pur
│   ├── [slug]/page.tsx                # Article (+FAQ) OU page statique WP (essaie post, puis page)
│   ├── [slug]/opengraph-image.tsx     # OG dynamique par article/page (next/og, runtime: "nodejs")
│   ├── opengraph-image.tsx            # OG générique du site
│   ├── recherche/page.tsx             # Résultats de recherche (noindex) + pagination
│   ├── api/search/route.ts            # Proxy recherche WP (toujours 200, {results:[]} si WP indisponible)
│   ├── api/revalidate/route.ts        # Webhook appelé par le mu-plugin WordPress (voir section 1)
│   ├── sitemap.ts / robots.ts         # sitemap : posts + catégories + auteurs + tags + toutes les pages WP
│   └── monauto.css                    # Repris de frontend/monauto-kit/assets/, + variables mode sombre
├── components/                        # Header, Footer, BottomNav, ArticleCard, Breadcrumb, JsonLd, Pagination,
│                                       # SearchBox (client, debounce 300ms), ThemeToggle (client),
│                                       # NewsletterForm (client)
├── lib/
│   ├── wp.ts                          # Fetch WP (build + à la demande via ISR) + parsing ACF + decodeEntities
│   ├── schema.ts                      # JSON-LD (Article, Person, BreadcrumbList, WebSite, Organization, FAQPage)
│   ├── seo-meta.ts                    # Canonical + Open Graph + Twitter Card, réutilisé par toutes les pages
│   ├── taxonomy.ts                    # Lit data/taxonomy.json (19 silos — nav/accueil/hubs)
│   ├── site.ts                        # SITE_URL / SITE_NAME (variables d'env)
│   └── public-env.ts                  # NEXT_PUBLIC_WP_SITE_URL (seule variable exposée au navigateur)
├── data/taxonomy.json                 # Copie de frontend/monauto-kit/data/taxonomy.json
├── public/                            # logo/mark/favicon (repris du kit), llms.txt
└── next.config.ts                     # trailingSlash, images.unoptimized (pas de output:"export", voir section 1)
```

### 3.1 Pourquoi deux sources de données (WordPress et `taxonomy.json`) ?

- **`data/taxonomy.json`** décrit l'architecture **cible** du cocon (19 silos,
  ~10 000 articles à terme) — c'est ce qui alimente la navigation, l'accueil
  et l'existence même des 19 pages `/categorie/*` (crawlables dès le
  lancement, même avant d'avoir du contenu, conformément au calendrier de
  publication en 3 phases de [skills/wordpress-publication.md](../skills/wordpress-publication.md)
  section 6 — les hubs doivent exister avant les articles).
- **WordPress** est la source des articles réellement publiés. Une page
  `/categorie/[slug]` affiche donc toujours son titre/description (depuis
  `taxonomy.json`) même si WordPress ne contient encore aucun article pour ce
  silo — avec un message "Aucun article publié pour l'instant" plutôt qu'une
  page 404, pour rester crawlable.

Quand la production d'articles avancera silo par silo, il n'y a rien à
changer côté Next.js : dès qu'une catégorie WordPress `slug` correspond à un
`slug` de `taxonomy.json`, les articles apparaissent automatiquement.

### 3.2 Polices : pourquoi la stack système et pas Space Grotesk/Figtree ?

Le kit graphique prévoyait Space Grotesk + Figtree via Google Fonts. Deux
raisons de les remplacer par la pile système
(`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
sans-serif`) :

1. [skills/design.md](../skills/design.md) section 2 : polices système par
   défaut, sauf nécessité forte de branding.
2. **Contrainte technique déjà rencontrée sur ce poste** (voir mémoire projet
   RénoScope) : le build Next.js avait déjà échoué à télécharger les polices
   Google Fonts (réseau indisponible pendant `next build` sur cette machine).
   Éviter `next/font/google` supprime ce risque d'échec de build.

### 3.3 Images — pourquoi WordPress + Imagify plutôt que `next/image`

**Décision confirmée le 2026-07-15**, après lecture du projet de référence
[next-wp](https://github.com/9d8dev/next-wp) qui utilise `next/image` +
`remotePatterns` pour toute l'optimisation d'image (pas de plugin WordPress).
Monauto garde l'inverse — `images.unoptimized: true`, WordPress + Imagify fait
tout le travail à l'upload (voir section 9) — pour une raison de coût
spécifique à l'échelle visée : **l'optimiseur d'image de Vercel facture par
image source unique optimisée** (au-delà du quota gratuit du plan Hobby).
À 10 000 articles, avec potentiellement une image unique par article, ce
modèle de facturation devient défavorable comparé à une optimisation
one-shot à l'upload côté WordPress (coût fixe, indépendant du nombre
d'articles). `<img>` avec largeur/hauteur explicites (`media_details` de
WordPress) reste donc utilisé directement — zéro CLS, cohérent avec
[skills/design.md](../skills/design.md) section 3.

## 4. Cycle de publication → mise en ligne

1. Rédaction/import de l'article dans WordPress (Gutenberg + ACF + catégorie/
   tag + auteur), statut `publish` (ou `future`, voir
   [skills/wordpress-publication.md](../skills/wordpress-publication.md)) —
   piloté soit manuellement, soit par le pipeline automatisé (voir
   [docs/architecture-autopublish.md](architecture-autopublish.md)).
2. **Revalidation ciblée immédiate** (décision du 2026-07-14, remplace le
   rebuild quotidien décrit dans les versions précédentes de ce document) :
   le mu-plugin WordPress détecte l'événement (`publish_post`,
   `publish_page`, `trashed_post`, changement de catégorie, mise à jour de
   profil auteur) et appelle `POST /api/revalidate` avec les chemins exacts
   concernés. Next.js régénère uniquement ces pages — pas de build complet,
   pas de délai de 24h : la page publique reflète le changement en quelques
   secondes.
3. Filet de sécurité passif : `revalidate = 900` sur les pages de listing
   (accueil, catégories) au cas où un webhook de revalidation échouerait
   silencieusement (throttle actif, secret mal configuré, etc.) — voir le
   journal des tentatives dans wp-admin → Réglages > Revalidation Next.js.
4. Déploiement : push sur `main` → build Vercel automatique (voir
   [.github/workflows/ci.yml](../.github/workflows/ci.yml) pour la
   vérification de build en amont, indépendante du déploiement Vercel
   lui-même).

> **Historique (obsolète)** : ce document décrivait auparavant un rebuild
> complet quotidien via une tâche planifiée Windows
> (`monauto-rebuild-quotidien`, script `scripts/rebuild-monauto.ps1`) — utile
> le temps de l'export statique pur (2026-07-11 à 2026-07-14), abandonné avec
> le passage à l'ISR/Vercel. Le script et son historique de bugs restent dans
> le dépôt à titre de référence mais ne sont plus exécutés.

## 5. Lancer le projet en local

```
cd frontend/monauto
npm install
npm run dev        # http://localhost:3000
# ou, pour tester le build de production (ISR) :
npm run build && npm run start
```

`WP_API_URL` et `SITE_URL` sont définis dans `frontend/monauto/.env.local`
(non commité).

## 6. Checklist SEO/GEO/Performance — audit complet du 2026-07-11

Audit demandé explicitement par l'utilisateur ("vérifie que le front répond à
tous les critères de Google et des LLMs"). Ce qui manquait a été implémenté
dans la foulée (colonne "Statut" = état après cet audit, pas avant).

| Exigence | Statut |
|---|---|
| Profondeur ≤ 3 clics, breadcrumb systématique | ✅ (`Breadcrumb.tsx` + `BreadcrumbList` JSON-LD sur chaque page) |
| JSON-LD miroir exact du contenu visible | ✅ (`lib/schema.ts`, une seule source pour rendu + JSON-LD) |
| TL;DR en tête d'article | ✅ (`post.acf.tldr`) |
| Sources citées explicitement | ✅ (`post.acf.sources`) |
| `dateModified` réel et affiché | ✅ (`post.modified` WordPress) |
| **Meta description sur 100 % des pages** | ✅ **corrigé** — l'accueil n'en avait aucune avant cet audit (`app/page.tsx`) |
| **Canonical explicite sur toutes les pages** | ✅ **ajouté** (`lib/seo-meta.ts` → `alternates.canonical`, absent partout avant) |
| **Open Graph (title/description/image/type/locale/site_name)** | ✅ **ajouté** — absent entièrement avant (`lib/seo-meta.ts` + défauts dans `layout.tsx`) |
| **Twitter Card** | ✅ **ajouté** (`summary_large_image` si image à la une, sinon `summary`) |
| **FAQPage schema** | ✅ **ajouté** — nouveau champ ACF `faq`, rendu visible en `<details>` + JSON-LD (`faqPageLd`), voir skills/geo.md section 3 |
| **404 avec vrai code HTTP, page brandée** | ✅ **ajouté** (`app/not-found.tsx`, remplace la 404 générique de Next) |
| robots.txt n'exclut pas les crawlers IA | ✅ (`app/robots.ts` — `allow: "/"`) |
| `llms.txt` | ✅ (`public/llms.txt`, à étoffer à mesure des rubriques) |
| Zéro dépendance JS lourde, polices système | ✅ |
| Images dimensionnées (zéro CLS) | ✅ (`width`/`height` natifs depuis `media_details`) |
| Sitemap complet | ✅ **complété le 2026-07-15** (`app/sitemap.ts` : posts + catégories + auteurs + tags + toutes les pages WP, auparavant seule "à-propos" en dur) — à segmenter par silo au-delà de 2 000 URLs, voir skills/seo.md section 5 |
| WordPress non indexé (headless) | ✅ (mu-plugin : `noindex` global sur le domaine WP) |
| **Formulaires : entrées récupérables** | ✅ **ajouté** — newsletter fonctionnelle, voir section 8 |
| Recherche interne | ✅ **ajouté le 2026-07-15** (`components/SearchBox.tsx` debounce 300ms + `/recherche` + `app/api/search/route.ts`) |
| Pagination crawlable (accueil/catégorie/auteur/tag/recherche) | ✅ **ajouté le 2026-07-15** (`components/Pagination.tsx`, `?page=N`) |
| Page tag dédiée (entités transversales) | ✅ **ajouté le 2026-07-15** (`app/tag/[slug]/page.tsx`) |
| Image OG dynamique par page | ✅ **ajouté le 2026-07-15** (`next/og`/`ImageResponse` — une carte générique + une par article/page, `runtime: "nodejs"`) |
| Mode sombre | ✅ **ajouté le 2026-07-15** (`ThemeToggle.tsx`, anti-FOUC, contraste WCAG vérifié) |
| CI (build + vérification avant push/PR) | ✅ **ajouté le 2026-07-15** (`.github/workflows/ci.yml`) |
| Google Search Console / Bing Webmaster Tools | ⬜ pas fait — nécessite un domaine public réel, à faire au moment du déploiement |
| Test réel Core Web Vitals (PageSpeed Insights/Lighthouse) | ⬜ pas fait — nécessite une URL publique, à refaire une fois hébergé |
| `apple-touch-icon` / icônes PNG multi-tailles | ⬜ pas fait — favicon SVG seul suffit pour la plupart des navigateurs modernes, mais Safari/iOS bénéficient d'un PNG dédié |
| HowTo schema | ⬜ pas fait — pas de page candidate dans ce lot de test (pertinent pour un futur guide "étapes" type tuto démarches) |
| **`Organization.logo`** (rich results / Knowledge Panel) | ✅ **ajouté le 2026-07-11** (`lib/schema.ts`) — pointe vers `logo.svg` ; Google préfère un format raster (PNG/JPG/WebP), même limitation que l'image OG par défaut (section 7) |
| **`max-image-preview:large`** (éligibilité Google Discover) | ✅ **ajouté le 2026-07-11** (`app/layout.tsx` → `metadata.robots.googleBot`) — sans ça, Google plafonne la taille des images en résultats de recherche et exclut de fait des cartes Discover (qui exigent des images pleine largeur) |
| **`Article.image` en `ImageObject` avec dimensions** (pas juste une URL) | ✅ **ajouté le 2026-07-11** (`lib/schema.ts`) — requis par Google pour l'éligibilité aux images dans les résultats enrichis, largeur ≥ 696px recommandée (dépend de l'image uploadée) |
| `NewsArticle` schema + sitemap News dédié | ⬜ **non applicable** — réservé aux sites inscrits à Google News (validation manuelle via Publisher Center). Ce site publie des guides evergreen, pas de l'actualité au sens de Google News ; à revoir seulement si une vraie rubrique d'actu voit le jour |
| `Organization.sameAs` (profils sociaux officiels) | ⬜ pas fait — aucun profil social réel encore créé pour la marque monauto, à ajouter dès qu'ils existent (aide Google ET les LLM à confirmer l'entité) |

## 7. Limites connues de ce test minimal

- Un seul article/catégorie/tag/auteur/page réels — le reste de la
  génération de contenu suit le pipeline `/p4-hubs` → `/p5-articles` déjà en
  place, pas ce chantier.
- Image à la une testée avec un visuel de test généré localement (texte sur
  fond uni, pas une vraie photo) — suffisant pour valider la chaîne technique
  (tailles WP, JSON-LD, OG/Twitter), à remplacer par un vrai visuel avant
  publication réelle (voir section 9).
- ACF Free (pas Pro) : champs "liste" stockés en texte ligne-par-ligne plutôt
  qu'en vrai Repeater (voir section 2.1) — s'applique aussi au nouveau champ `faq`.
- Les points ⬜ restants de la checklist ci-dessus (icônes PNG, GSC/Bing,
  Lighthouse réel, `Organization.sameAs`) nécessitent soit un asset design,
  soit un domaine/profil social réel — pas bloquants pour continuer la
  production de contenu, à traiter avant un vrai lancement public.
- **Blocage réel actuel, sans rapport avec le frontend** : le pipeline
  automatisé de génération/publication (voir
  [docs/architecture-autopublish.md](architecture-autopublish.md)) est prêt
  mais ne peut pas encore écrire dans WordPress — voir
  [STATE.md](../STATE.md) (2026-07-15) pour le diagnostic complet.

## 8. Formulaires — newsletter (2026-07-11)

Le formulaire newsletter poste **directement vers WordPress** (et non via une
route API Next.js) — choix conservé après le passage à l'ISR/Vercel (section
1) pour rester cohérent avec le principe "WordPress = seule source
d'écriture" de cette architecture, même si une route API Next serait
techniquement possible depuis cette bascule.

### 8.1 Côté WordPress (mu-plugin, section 5)

- **Custom post type `monauto_lead`** (non public, jamais d'URL front, jamais
  indexé) : chaque inscription = 1 entrée, visible dans wp-admin ("Inscriptions
  newsletter" dans le menu latéral) — **c'est le moyen principal de
  "récupérer toutes les entrées"**, avec le login WordPress normal.
  - Capacités restreintes à `manage_options` : seuls les administrateurs
    voient ces données, pas les 6 comptes auteur de production (rôle Author).
- **`POST /wp-json/monauto/v1/newsletter`** : écriture publique volontaire
  (`permission_callback` toujours vraie), mais protégée par :
  - validation d'email (`is_email`) ;
  - honeypot (champ caché `site_web` — un bot qui le remplit reçoit une
    fausse confirmation, rien n'est enregistré) ;
  - limite anti-abus : 5 soumissions/heure par IP ;
  - dédoublonnage : un email déjà inscrit met à jour l'entrée existante au
    lieu d'en créer une nouvelle.
- **`GET /wp-json/monauto/v1/newsletter`** : lecture réservée aux
  administrateurs (authentification Application Password, comme
  `scripts/wp-client.js`). Pratique pour vérifier par script sans ouvrir
  wp-admin.
  - **Piège technique rencontré et documenté** : `current_user_can('manage_options')`
    renvoie **faux** pour l'administrateur pourtant authentifié via
    Application Password sur cette installation — reproduit aussi sur
    l'endpoint core `/wp/v2/settings` (donc pas un bug de ce plugin, une
    restriction de cet environnement/cette version de WP vis-à-vis des
    Application Passwords). Contournement : vérification par **rôle**
    (`in_array('administrator', $user->roles)`) plutôt que par capability —
    fonctionne de façon fiable, testé en confirmant qu'un compte auteur
    (rôle Author) reçoit bien un refus.
- **CORS** : le domaine du frontend doit être ajouté au filtre natif WP
  `allowed_http_origins` (déjà fait pour `http://localhost:3000` ; ajouter le
  futur domaine de production via la constante `MONAUTO_FRONTEND_ORIGINS`
  dans `wp-config.php`, plusieurs domaines séparés par des virgules).

### 8.2 Côté Next.js

- `components/NewsletterForm.tsx` : seul Client Component du site (`"use client"`),
  seul point d'interactivité JS d'un site par ailleurs 100 % statique.
  États géré : `idle`/`loading`/`success`/`error`, honeypot invisible inclus.
- Intégré à deux endroits (comme prévu par le kit graphique) : bandeau
  newsletter de l'accueil (`.nl-band`) et encart CTA de la sidebar article
  (`.side-cta`).
- URL de l'API WordPress exposée au navigateur via `NEXT_PUBLIC_WP_SITE_URL`
  (`.env.local`) — c'est la SEULE variable préfixée `NEXT_PUBLIC_`, aucune clé
  ni donnée sensible, juste l'URL racine publique de l'API (voir
  `lib/public-env.ts`).

### 8.3 Testé en conditions réelles

Formulaire rempli et soumis dans le navigateur (via preview) → confirmation
affichée → entrée retrouvée ensuite via `GET /wp-json/monauto/v1/newsletter`
avec les identifiants admin. Testé aussi : honeypot rempli (silencieusement
ignoré), email invalide (rejeté), compte auteur (accès en lecture refusé).

## 9. Images — tailles WordPress + compression Imagify (2026-07-12)

Demande explicite de l'utilisateur : ne générer côté WordPress que les
dimensions d'image réellement utilisées par le front, et faire compresser +
convertir en WebP par Imagify.

### 9.1 Mesure des dimensions réellement affichées

D'après `frontend/monauto/app/monauto.css` :

| Usage | Composant | Container / ratio | Largeur affichée (mobile / desktop) | Taille WP créée |
|---|---|---|---|---|
| Carte article | `ArticleCard.tsx`, rail sur accueil/catégorie/auteur | `.card__media`, 16:10 | ~437px (`.rail` mobile, `grid-auto-columns:78%` de `--wrap:560px`) / ~259px (4 colonnes desktop) | **`monauto_card`** : 800×500 (couvre le pire cas mobile en écran rétine ×2) |
| Image à la une | `app/[slug]/page.tsx`, `.article__hero` | 16:10, plein bord mobile puis contenu dans `.col-main` desktop | jusqu'à ~767px (plein viewport mobile) / ~772px (`.wrap-wide` 1140px − sidebar 320px − gap 48px) | **`monauto_hero`** : 1600×1000 (couvre les deux cas en ×2) |

Aucun autre usage d'image dans le code actuel (pas d'avatar auteur affiché).

### 9.2 Côté WordPress (mu-plugin section 0/0bis)

- `add_image_size('monauto_card', 800, 500, true)` et `add_image_size('monauto_hero', 1600, 1000, true)`, en crop (16:10).
- Tailles par défaut inutiles retirées : `medium`/`medium_large`/`large` (filtre `intermediate_image_sizes_advanced`, plus légères à générer que les nôtres) et surtout `1536x1536`/`2048x2048` retirées **complètement** via `remove_image_size()` (pas juste empêchées de se générer) — nécessaire pour la section suivante.
- `big_image_size_threshold` fixé à 1600 : WordPress ne conserve pas de copie "scaled" plus grande que notre plus grande taille réelle.
- **Piège technique rencontré** : le hook doit tourner sur `plugins_loaded` priorité **1**, pas `after_setup_theme` (pourtant plus "canonique" pour `add_image_size`). Imagify calcule et **met en cache pour toute la durée de la requête** (variable `static`) la plus grande taille d'image *enregistrée*, dès sa propre lecture de réglages — si notre nettoyage de tailles arrive après cette lecture (as `after_setup_theme`, qui est pourtant antérieur à `init`), Imagify a déjà figé l'ancienne valeur (2048) et refuse ensuite un seuil de redimensionnement à 1600 pour le reste de la requête, même si les tailles ont bien été corrigées entre-temps. Priorité 1 sur `plugins_loaded` : juste après l'enregistrement des tailles par défaut de WP core (`_wp_add_additional_image_sizes`, priorité 0), avant tout le reste.

### 9.3 Imagify

- Plugin téléchargé depuis wordpress.org et installé directement dans `wp-content/plugins/` (contournement d'un souci réseau HTTPS sur cette machine avec `curl --ssl-no-revoke`), puis activé.
- Réglages appliqués automatiquement par le mu-plugin (tout ce qui **ne nécessite pas** la clé API) : optimisation automatique à l'upload, conservation d'une sauvegarde, niveau "aggressive", redimensionnement de tout original > 1600px, conversion + service en WebP (méthode `<picture>`, pas de réécriture serveur).
- **Ce qui reste à faire, uniquement par l'utilisateur** : créer un compte gratuit sur https://app.imagify.io et renseigner la clé API dans wp-admin → Réglages → Imagify. Sans ça, aucune compression réelle n'a lieu (confirmé : l'image de test uploadée n'est pour l'instant pas optimisée). Volontairement jamais fait par un agent — entrée de clé API interdite par les règles de sécurité du projet.
- Une fois la clé connectée, les images déjà en bibliothèque (comme l'image de test) devront être optimisées rétroactivement via l'outil de "Bulk Optimization" d'Imagify dans wp-admin (l'optimisation automatique ne s'applique qu'aux nouveaux uploads).

### 9.4 Côté Next.js

- `lib/wp.ts` → `getImageVariant(media, "monauto_card" | "monauto_hero")` : sélectionne la bonne taille dans `media_details.sizes`, avec repli sur l'image complète si WordPress n'a pas pu générer la taille demandée (image source plus petite que la taille cible — WordPress n'agrandit jamais).
- `ArticleCard.tsx` utilise `monauto_card` ; l'image à la une de l'article utilise `monauto_hero` (rendu + `og:image`/`twitter:image`).
- Le JSON-LD `Article.image` continue d'utiliser les dimensions de l'image complète (`media_details.width/height` de premier niveau) plutôt qu'une taille recadrée — Google recommande la meilleure qualité disponible pour les données structurées, pas la taille d'affichage.

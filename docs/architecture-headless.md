# Architecture headless — WordPress + Next.js (monauto)

Documentation de la dynamisation front/back mise en place le 2026-07-11 sur le
silo « Auto & mobilité ». Complète [skills/developpement.md](../skills/developpement.md)
(qui reste la référence pour les règles générales) — ce document décrit ce qui
a été **réellement implémenté** pour ce test.

## 1. Vue d'ensemble

```
WordPress (thermotowel.local)          Next.js 15 (frontend/monauto)         CDN / hébergement statique
─────────────────────────────          ──────────────────────────────        ──────────────────────────
Rédaction en Gutenberg                  npm run build (à chaque              Fichiers HTML/CSS 100 % statiques
+ ACF (tldr, sources, job_title)  ───▶  publication WP) :                ───▶ (Cloudflare Pages, Netlify,
+ catégories = silos                    fetch wp-json → generateStatic      GitHub Pages, ou tout serveur
+ tags = entités transversales          Params → HTML pré-rendu              de fichiers statiques)
+ REST API (/wp-json/wp/v2/...)         + JSON-LD + sitemap.xml
```

**Différence avec la spec initiale** ([Architecture Blog Headless.dc (1).html](../Architecture%20Blog%20Headless.dc%20(1).html)) :
ce document prévoyait du SSR/ISR avec revalidation par webhook (Next.js server
qui tourne en continu). On a choisi un **export 100 % statique**
(`output: "export"` dans `next.config.ts`) à la place :

- Cohérent avec [skills/developpement.md](../skills/developpement.md) section 3
  ("privilégier du SSG plutôt que du SSR pur").
- Pas de serveur Node à héberger/maintenir en production : juste des fichiers
  statiques, hébergeables gratuitement ou presque (Cloudflare Pages/Netlify),
  ce qui compte pour un réseau de plusieurs dizaines de sites.
- Plus rapide qu'ISR : aucune requête serveur au moment de la visite, tout est
  déjà généré.
- Contrepartie : il faut relancer un `npm run build` après chaque publication
  WordPress pour que le site public reflète le changement (voir section 4).

**Décision du 2026-07-11 (suite)** : le rebuild n'est **pas** déclenché à
chaque publication. Un export statique régénère TOUTES les pages du site à
chaque build — avec jusqu'à 15 articles/jour en rythme de croisière (voir
[skills/wordpress-publication.md](../skills/wordpress-publication.md)
section 6), un rebuild par publication ferait jusqu'à 15 builds complets par
jour, inutilement coûteux/lent à mesure que le site grossit (jusqu'à ~10 000
pages à terme). Le contenu étant publié de façon planifiée (pas de
l'actualité chaude), un délai de mise à jour n'a aucun impact SEO.

**Rebuild automatique retenu : une fois par jour, à 3h du matin**, via une
tâche planifiée Windows (`monauto-rebuild-quotidien`, voir section 4). Le
mu-plugin garde tout de même la fonction `monauto_notify_frontend_rebuild`
disponible mais **non accrochée** à `publish_post`/`save_post` par défaut — à
ne réactiver manuellement qu'en cas de besoin ponctuel de mise à jour
immédiate (ex. correction urgente d'un article déjà en ligne).

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
│   ├── layout.tsx                 # Header/Footer/BottomNav, CSS global, métadonnées (+OG/Twitter par défaut)
│   ├── page.tsx                   # Accueil (grille des 19 silos + derniers articles WP + newsletter)
│   ├── not-found.tsx              # 404 brandée, vrai code HTTP
│   ├── rubriques/page.tsx         # Index des 19 rubriques
│   ├── categorie/[slug]/page.tsx  # Hub de silo (généré pour les 19 silos)
│   ├── [slug]/page.tsx            # Article (+FAQ) OU page statique WP (essaie post, puis page)
│   ├── auteur/[slug]/page.tsx     # Page auteur (schema Person)
│   ├── sitemap.ts / robots.ts     # Générés au build (Next Metadata API)
│   └── monauto.css                # Repris de frontend/monauto-kit/assets/
├── components/                    # Header, Footer, BottomNav, ArticleCard, Breadcrumb, JsonLd,
│                                   # NewsletterForm (seul Client Component du site)
├── lib/
│   ├── wp.ts                      # Fetch wp-json (build uniquement) + parsing ACF + decodeEntities
│   ├── schema.ts                  # JSON-LD (Article, Person, BreadcrumbList, WebSite, Organization, FAQPage)
│   ├── seo-meta.ts                # Canonical + Open Graph + Twitter Card, réutilisé par toutes les pages
│   ├── taxonomy.ts                # Lit data/taxonomy.json (19 silos — nav/accueil/hubs)
│   ├── site.ts                    # SITE_URL / SITE_NAME (variables d'env, build uniquement)
│   └── public-env.ts              # NEXT_PUBLIC_WP_SITE_URL (seule variable exposée au navigateur)
├── data/taxonomy.json             # Copie de frontend/monauto-kit/data/taxonomy.json
├── public/                        # logo/mark/favicon (repris du kit), llms.txt
└── next.config.ts                 # output: "export", images.unoptimized
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

### 3.3 Images

Pas de `next/image` : en export statique, l'API d'optimisation d'image de
Next.js n'est pas disponible (`images.unoptimized: true`), donc autant utiliser
directement `<img>` avec largeur/hauteur explicites (fournies par
`media_details` de WordPress) — zéro CLS, zéro dépendance supplémentaire,
cohérent avec [skills/design.md](../skills/design.md) section 3.

## 4. Cycle de publication → mise en ligne

1. Rédaction/import de l'article dans WordPress (Gutenberg + ACF + catégorie/
   tag + auteur), statut `publish` (ou `future`, voir
   [skills/wordpress-publication.md](../skills/wordpress-publication.md)).
2. **Rebuild automatique une fois par jour à 3h du matin** (voir décision
   section 1) via une tâche planifiée Windows :
   - Nom de la tâche : `monauto-rebuild-quotidien` (`schtasks`/Task Scheduler).
   - Script exécuté : [scripts/rebuild-monauto.ps1](../scripts/rebuild-monauto.ps1).
   - Journal : [logs/rebuild-monauto.log](../logs/rebuild-monauto.log) (append à
     chaque exécution — à consulter en cas de doute sur le dernier rebuild).
   - Un article publié dans la journée n'apparaît sur le site public qu'au
     rebuild suivant (délai maximal 24h).
3. Déploiement de `frontend/monauto/out/` sur l'hébergeur choisi (à définir —
   Cloudflare Pages ou Netlify sont les plus simples). Tant que l'hébergement
   n'est pas choisi, le script se contente de reconstruire localement ; une
   fois l'hébergeur en place, il faudra ajouter l'étape de déploiement à la
   fin de `rebuild-monauto.ps1` (upload du dossier `out/`, ou appel du "Build
   Hook" de l'hébergeur si celui-ci reconstruit lui-même depuis un dépôt Git).

### 4.1 Robustesse du script planifié — problèmes réels rencontrés et corrigés

Deux bugs concrets ont été rencontrés en testant `rebuild-monauto.ps1` de
bout en bout (utile si le rebuild automatique se remet à échouer un jour) :

1. **Process `node.exe` zombie qui verrouille un fichier de `out/`.** Un
   build précédent interrompu (plantage, arrêt forcé) peut laisser un
   processus `node.exe` actif qui garde un handle ouvert sur un fichier —
   le build suivant échoue alors avec une erreur `EPERM`/`lstat` qui *ressemble*
   à un blocage antivirus mais n'en est pas un (vérifié : le problème
   persistait après désactivation de l'antivirus, et disparaissait après
   avoir tué les process `node.exe` résiduels via `Get-CimInstance
   Win32_Process`). Le script tue maintenant systématiquement tout
   `node.exe` dont la ligne de commande référence `monauto` avant de
   nettoyer `out/`/`.next/` et relancer le build.
2. **Le serveur WordPress local (Local by Flywheel) sature sous requêtes
   concurrentes.** Purement lié à l'environnement de test sur cette machine
   (PHP-FPM à faible concurrence) : Next.js envoie plusieurs requêtes
   `wp-json` en parallèle pendant l'export des 19 pages de catégorie, ce qui
   peut faire échouer certaines requêtes (`fetch failed`). Corrigé par un
   limiteur de concurrence côté Next.js (`MAX_CONCURRENT = 2` dans
   `lib/wp.ts`) + retry avec backoff, et par une boucle de nouvelles
   tentatives (jusqu'à 5) dans le script PowerShell avec une pause de 15s
   entre chaque. À réévaluer une fois hébergé sur une vraie instance
   WordPress (qui tiendra sans doute une concurrence plus élevée sans
   ajustement).

## 5. Lancer le projet en local

```
cd frontend/monauto
npm install
npm run dev        # http://localhost:3000 — lecture directe de thermotowel.local
# ou, pour tester l'export statique final :
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
| Sitemap | ✅ (`app/sitemap.ts`, un seul fichier pour l'instant — à segmenter par silo au-delà de 2 000 URLs, voir skills/seo.md section 5) |
| WordPress non indexé (headless) | ✅ (mu-plugin : `noindex` global sur le domaine WP) |
| **Formulaires : entrées récupérables** | ✅ **ajouté** — newsletter fonctionnelle, voir section 8 |
| Google Search Console / Bing Webmaster Tools | ⬜ pas fait — nécessite un domaine public réel, à faire au moment du déploiement |
| Test réel Core Web Vitals (PageSpeed Insights/Lighthouse) | ⬜ pas fait — nécessite une URL publique, à refaire une fois hébergé |
| Image OG par défaut (pages sans image à la une) | ⬜ pas fait — nécessite un vrai visuel de marque (tâche design, pas code) |
| `apple-touch-icon` / icônes PNG multi-tailles | ⬜ pas fait — favicon SVG seul suffit pour la plupart des navigateurs modernes, mais Safari/iOS bénéficient d'un PNG dédié |
| Pagination crawlable des catégories (`/categorie/x/page/2`) | ⬜ pas fait — inutile tant qu'une catégorie n'a qu'une poignée d'articles, à ajouter avant la montée en volume réelle |
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
- Webhook de rebuild écrit mais non branché à un hébergeur réel (à faire au
  moment du choix d'hébergement).
- ACF Free (pas Pro) : champs "liste" stockés en texte ligne-par-ligne plutôt
  qu'en vrai Repeater (voir section 2.1) — s'applique aussi au nouveau champ `faq`.
- Les points ⬜ de la checklist ci-dessus (image OG par défaut, icônes PNG,
  pagination, GSC/Bing, Lighthouse réel) nécessitent soit un asset design,
  soit un domaine public — pas bloquants pour continuer la production de
  contenu, à traiter avant un vrai lancement public.

## 8. Formulaires — newsletter (2026-07-11)

Le frontend étant un export 100 % statique (aucun serveur Next.js en
production), un formulaire ne peut pas être traité par une route API Next —
il poste **directement vers WordPress**, seul serveur réel de cette
architecture.

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

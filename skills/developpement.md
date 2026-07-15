# Skill Développement — autoseo

Stack technique de référence pour les sites de la plateforme.

## 1. Répartition des rôles

- **Backend : WordPress** — utilisé comme CMS de gestion de contenu (rédaction, catégories = silos/sous-cocons, ACF pour les champs factuels), stockage des médias, et exposition via **WP REST API**.
- **Front : Next.js 15 (App Router), ISR (Incremental Static Regeneration) sur Vercel** — consomme les données WordPress via l'API, chaque page étant générée à la demande au premier accès puis mise en cache indéfiniment (pas de requête WordPress au moment de la visite une fois la page en cache). Ne pas afficher le thème WordPress natif en front public : Next.js gère le rendu, le routing et l'optimisation de performance (voir [design.md](design.md)).
  - **Décision du 2026-07-14** (remplace le choix export 100 % statique du 2026-07-11, qui remplaçait lui-même le choix initial NestJS) : à l'échelle visée (jusqu'à 15 articles/jour en continu, ~10 000 pages), un export/rebuild complet régénère inutilement toutes les pages à chaque changement. L'ISR ne régénère que la page concernée, sur appel ciblé (`POST /api/revalidate`) déclenché par le mu-plugin WordPress à la publication — voir [docs/architecture-headless.md](../docs/architecture-headless.md) pour l'implémentation complète et le détail de cette décision.
  - Déploiement : Vercel, déclenché par push sur `main` (voir `.github/workflows/ci.yml` pour la vérification de build en amont — un garde-fou indépendant du déploiement Vercel lui-même, pas obligatoire pour merger).
  - Images : `next/image` volontairement **non utilisé** (`images.unoptimized: true`) — l'optimiseur d'image Vercel facture par image source unique, défavorable à l'échelle de 10 000 articles. WordPress + Imagify optimise une fois à l'upload (coût fixe) — voir [docs/architecture-headless.md](../docs/architecture-headless.md) section 3.3.

Ce découpage headless permet : vitesse (le visiteur reçoit une page déjà générée, sans dépendre de WordPress au moment de la visite), sécurité (admin WordPress non exposé publiquement, domaine WP marqué `noindex`), et réutilisation d'un même gabarit Next.js pour plusieurs niches/sites du réseau.

Le pipeline de **production automatisée de contenu** (génération + relecture via l'API Anthropic, gating programmatique, publication planifiée), distinct de ce découpage front/back, est documenté dans [docs/architecture-autopublish.md](../docs/architecture-autopublish.md).

## 2. WordPress (backend)

- Custom Post Types dédiés par type de page du cocon : `article`, `hub`, `sous_hub` (ou taxonomie + champ `page_role` si plus simple à maintenir).
- Champs factuels (prix, tarifs, specs, codes) en **ACF (Advanced Custom Fields)**, jamais en dur dans le corps de texte, pour rester réutilisables par les moteurs programmatiques.
- Plugin SEO : **SEOPress** (voir [seo.md](seo.md) section 5) — titre, meta, sitemap, schema de base.
- Éditeur : **Gutenberg** natif pour tout hub/sous-hub/article — le contenu doit rester éditable visuellement dans l'admin WordPress, pas seulement consommé en API. Format de blocs, catégories/tags/image à la une, comptes auteur et planification des dates de publication : voir [wordpress-publication.md](wordpress-publication.md).
- Taxonomies WordPress calquées sur la structure du cocon : silo = catégorie parente, sous-cocon = catégorie enfant.
- API exposée : WP REST API native suffit pour la plupart des besoins ; passer à WPGraphQL seulement si le volume de requêtes/relations imbriquées le justifie.
- Sécuriser l'admin : pas d'accès admin public direct sans authentification renforcée, désactiver XML-RPC si inutile.

### Stack de plugins retenue (validée en test)

Installation minimale, volontairement épurée — un site WordPress de ce réseau ne doit avoir **que** ce qui suit, rien de plus :

| Plugin | Slug WP.org | Rôle |
|---|---|---|
| **SEOPress** | `wp-seopress` | SEO on-page (titres, meta, sitemap, schema de base) — voir [seo.md](seo.md) section 5 |
| **Advanced Custom Fields (ACF)** | `advanced-custom-fields` | Champs factuels structurés (prix, tarifs, specs, codes) — voir section 2 ci-dessus |
| **Imagify** | `imagify` | Compression + conversion WebP des images à l'upload, sur les seules tailles réellement utilisées par le front (voir docs/architecture-headless.md section 9) — nécessite une clé API Imagify (gratuite, à créer et renseigner soi-même dans Réglages > Imagify, jamais par un agent) |

Tout autre plugin présent par défaut sur un nouveau site/thème (page builder de type Elementor, WooCommerce, Yoast, formulaires, plugins marketing, plugins de démo du thème...) est **désinstallé** avant de démarrer la production de contenu — voir procédure de nettoyage ci-dessous. Ce sont soit des doublons fonctionnels (Yoast fait doublon avec SEOPress), soit hors du périmètre d'un site de contenu SEO/GEO headless (WooCommerce, Elementor).

### Procédure de nettoyage d'un site neuf/de test

Sur tout nouveau site WordPress rattaché à ce projet (test ou niche réelle), avant toute production :
1. Lister les posts/pages/produits existants (`wp.listAll('posts')`, `wp.listAll('pages')`, `wp.request('/product?...')` si WooCommerce présent) et les supprimer avec `force=true` (suppression définitive, pas de passage par la corbeille).
2. Lister les plugins actifs (`wp.listPlugins()`), désactiver puis supprimer tout ce qui n'est pas SEOPress/ACF.
3. Installer et activer SEOPress + ACF s'ils sont absents (voir section "Connexion & script `wp-client.js`" ci-dessous).
4. Documenter l'opération dans [STATE.md](../STATE.md) (site concerné, ce qui a été retiré/ajouté).

### Connexion & authentification à l'API WordPress

- Authentification via **Application Password** (Réglages > Utilisateurs > Profil > Application Passwords dans WordPress), jamais le mot de passe principal du compte.
- Header HTTP : `Authorization: Basic base64(login:application_password)`. **Le login WordPress réel est requis** (visible dans Utilisateurs > Tous les utilisateurs, colonne Identifiant) — le nom affiché ("display name", ex. un prénom) n'est pas accepté et renvoie une erreur `401 invalid_username` qui peut prêter à confusion (elle ne dit pas "mauvais mot de passe", juste "identifiant inconnu").
- Identifiants stockés dans `.env` à la racine (`WP_URL`, `WP_USER`, `WP_APP_PASSWORD`), jamais en dur dans le code, jamais exposés côté navigateur (voir section 4).
- Client réutilisable : [scripts/wp-client.js](../scripts/wp-client.js) — fonctions `listAll(type)`, `deleteItem(type, id)`, `listPlugins()`, `setPluginStatus(pluginFile, status)`, `deletePlugin(pluginFile)`, `request(path, opts)` générique pour tout autre endpoint (posts, pages, media, catégories, tags, utilisateurs...).
- **Piège technique découvert en test** : l'endpoint REST des plugins (`/wp/v2/plugins/<dossier>/<fichier>`) attend un **slash littéral non encodé** dans l'URL entre le dossier et le fichier du plugin (ex. `elementor/elementor`). Un `encodeURIComponent()` qui transforme ce `/` en `%2F` fait échouer la requête avec `404 rest_plugin_not_found` alors que le plugin existe bien — ne jamais encoder ce slash précis.
- La suppression de contenu (posts/pages/produits) nécessite `?force=true` dans l'URL de suppression pour un effacement définitif ; sans ce paramètre, WordPress met l'élément à la corbeille au lieu de le supprimer.

## 3. Next.js (front)

- Récupère le contenu via `lib/wp.ts` (fetch vers l'API WordPress) — au build pour les pages pré-générées, à la demande pour l'ISR (voir ci-dessous), jamais côté navigateur.
- Rendu : **ISR** (`revalidate` + régénération ciblée via `/api/revalidate`) — cohérent avec l'objectif de vitesse ([design.md](design.md)) et hébergé sur Vercel (voir décision section 1).
- Une route Next.js par type de page (`app/[slug]/page.tsx` pour article/page, `app/categorie/[slug]/page.tsx` pour hub/sous-hub, `app/auteur/[slug]/page.tsx`) qui applique son propre template et injecte le maillage résolu depuis `taxonomy.json`/`maillage.json` (voir [seo.md](seo.md) section 2 et [gestion-de-projet.md](gestion-de-projet.md)).
- Génération du sitemap directement depuis Next.js (`app/sitemap.ts`, Next Metadata API), source de vérité = liste des pages publiées côté WordPress + `taxonomy.json` pour les hubs, synchronisés avec les règles de [seo.md](seo.md) (≤ 2 000 URLs/sitemap, à segmenter par silo au-delà).
- Génération du JSON-LD (schema.org) dans le rendu Next.js (`lib/schema.ts`) à partir des mêmes données WordPress, jamais dupliqué/désynchronisé entre les deux (voir [geo.md](geo.md)).

## 4. Environnements et déploiement

- Un environnement WordPress + un export Next.js par niche/site, hébergement statique séparé (Cloudflare Pages/Netlify/GitHub Pages ou équivalent) — à trancher au cas par cas.
- Variables sensibles (clés API : Haloscan, WordPress, etc.) toujours en fichier `.env`/`.env.local` non commité, jamais en dur dans le code ni exposées côté client (voir `.env` + `.gitignore` déjà en place à la racine du projet et dans `frontend/monauto/`).
- Toute clé API utilisée pour la génération de contenu (Haloscan, IA de rédaction...) reste **côté serveur uniquement** (scripts Node), jamais dans du JS servi au navigateur. Le fetch WordPress du frontend Next.js (`lib/wp.ts`) ne lit que du contenu public déjà publié, sans clé d'API — il s'exécute au build, jamais dans le navigateur.

## 5. Anti-patterns à éviter

- Ne pas afficher directement un thème WordPress classique en production publique si l'architecture headless est retenue — incohérence de stack et perte des gains de perf.
- Ne pas dupliquer la logique de maillage à la fois dans WordPress (plugin de liens internes) et dans Next.js : une seule source de vérité (`taxonomy.json`/`maillage.json`), Next.js l'applique au rendu.
- Ne pas faire d'appels API tiers (Haloscan, etc.) depuis le front NestJS exposé au navigateur — toujours depuis une couche serveur/scripts.

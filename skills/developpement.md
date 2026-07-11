# Skill Développement — autoseo

Stack technique de référence pour les sites de la plateforme.

## 1. Répartition des rôles

- **Backend : WordPress** — utilisé comme CMS de gestion de contenu (rédaction, custom post types par type de page : article, hub, sous-hub, fiche modèle...), stockage des données factuelles (via ACF ou champs custom), gestion des médias, et exposition via **WP REST API** (ou GraphQL si WPGraphQL installé).
- **Front : NestJS** — consomme les données WordPress via l'API et sert les pages au visiteur. Ne pas afficher le thème WordPress natif en front public : NestJS gère le rendu, le routing, le cache et l'optimisation de performance (voir [design.md](design.md)).

Ce découpage headless permet : vitesse (le front n'a pas le poids de WordPress au rendu), sécurité (admin WordPress non exposé publiquement au-delà de l'API), et réutilisation d'un même moteur NestJS pour plusieurs niches/sites du réseau.

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

## 3. NestJS (front)

- Récupère le contenu via un module dédié (service HTTP vers l'API WordPress), avec cache applicatif (Redis ou cache mémoire selon volume) pour éviter de retaper WordPress à chaque visite.
- Rendu : privilégier du **SSG (Static Site Generation)** ou ISR (regénération incrémentale) plutôt que du SSR pur à chaque requête, vu que le contenu (10 000 pages) change rarement une fois publié — cohérent avec l'objectif de vitesse ([design.md](design.md)).
- Un module NestJS par type de page (`ArticleModule`, `HubModule`, `SousHubModule`) qui applique son propre template et injecte le maillage résolu depuis `maillage.json` (voir [seo.md](seo.md) section 2 et [gestion-de-projet.md](gestion-de-projet.md)).
- Génération des sitemaps segmentés par silo directement depuis NestJS (source de vérité = liste des pages publiées), synchronisés avec les règles de [seo.md](seo.md) (≤ 2 000 URLs/sitemap).
- Génération du JSON-LD (schema.org) dans le rendu NestJS à partir des mêmes données WordPress, jamais dupliqué/désynchronisé entre les deux (voir [geo.md](geo.md)).

## 4. Environnements et déploiement

- Un environnement WordPress + une instance NestJS par niche, ou mutualisés si le volume le permet — à trancher au cas par cas selon l'hébergement.
- Variables sensibles (clés API : Haloscan, WordPress, etc.) toujours en fichier `.env` non commité, jamais en dur dans le code ni exposées côté client (voir `.env` + `.gitignore` déjà en place à la racine du projet).
- Toute clé API utilisée pour la génération de contenu (Haloscan, IA de rédaction...) reste **côté serveur uniquement** (scripts Node ou NestJS backend), jamais dans du JS servi au navigateur.

## 5. Anti-patterns à éviter

- Ne pas afficher directement un thème WordPress classique en production publique si l'architecture headless est retenue — incohérence de stack et perte des gains de perf.
- Ne pas dupliquer la logique de maillage à la fois dans WordPress (plugin de liens internes) et dans NestJS : une seule source de vérité (`maillage.json`), NestJS l'applique au rendu.
- Ne pas faire d'appels API tiers (Haloscan, etc.) depuis le front NestJS exposé au navigateur — toujours depuis une couche serveur/scripts.

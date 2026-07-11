# Skill SEO — autoseo

Règles à appliquer pour toute production de contenu ou de structure sur les sites de la plateforme.

## 1. Structure du site (cocon sémantique)

- Architecture à 3 niveaux stricte : `Accueil → Silo (hub) → Sous-cocon (sous-hub) → Articles`.
- **Profondeur maximale : 3 clics** depuis l'accueil pour 100 % des pages, sans exception.
- Chaque silo a **une seule** page hub (2 500–4 000 mots) qui cible le mot-clé de tête du silo.
- Chaque sous-cocon a **un seul** sous-hub (1 500–2 500 mots) qui liste et maille ses articles enfants.
- Un article n'appartient qu'à un seul sous-cocon. Pas de double rattachement.

## 2. Maillage interne

Règles de liens, dans cet ordre de priorité :

| Type | Règle | Volume/article |
|---|---|---|
| Montant | Lien vers le sous-hub (ancre exacte) + le hub (ancre élargie) + breadcrumb `Accueil › Silo › Sous-cocon › Article` | 2 liens + breadcrumb |
| Descendant | Le hub lie tous ses sous-hubs ; le sous-hub lie tous ses articles (liste éditorialisée, jamais un simple `<ul>` de liens bruts) | 10–40 |
| Latéral | 3–5 liens contextuels dans le corps vers des articles frères du même sous-cocon, sélectionnés par proximité sémantique (même entité : modèle, prestation, code) | 3–5 |
| Transversal | Max 1–2 liens, uniquement si entité partagée entre deux cocons. Jamais de lien transversal aléatoire ou pour "meubler" | 0–2 |

**Ancres** : rotation obligatoire — 40 % ancre exacte partielle, 30 % ancre naturelle longue, 20 % entité seule, 10 % générique. Jamais deux fois la même ancre exacte vers la même URL depuis le même cocon.

**Pages money** (fort potentiel de conversion/monétisation) : minimum 8 liens entrants internes depuis les pages informationnelles du même cocon.

Le graphe de maillage doit toujours être généré **avant** la rédaction (fichier de mapping CSV/JSON : `url, hub, sous_hub, liens_lateraux[], ancres[]`), jamais improvisé après coup.

## 3. Mots-clés

- **1 mot-clé principal = 1 seule URL.** Dédup obligatoire par cluster avant toute production (regroupement des variantes de même intention dans un même article).
- Un article couvre un cluster de 5–15 variantes de mots-clés, jamais un mot-clé isolé.
- Attribution systématique : silo / sous-cocon / intention (Info, Commercial, Transactionnel) pour chaque cluster.
- Quotas d'intention par défaut, sauf indication contraire du plan de niche : **~65 % Info / 25 % Commercial / 10 % Transactionnel**.
- Toute recherche de volumes/associés passe par l'API Haloscan (voir `scripts/haloscan-client.js`) — jamais de volumes inventés.

## 4. Règles rédactionnelles

- Longueurs variées selon le type de page, jamais uniformes :
  - Programmatique (pages générées par moteur) : 800–1 200 mots
  - Guides éditoriaux : 1 500–2 500 mots
  - Hubs / sous-hubs : 2 500–4 000 mots / 1 500–2 500 mots
- Unicité stricte : deux pages du même template programmatique ne doivent partager aucune phrase. Faire varier la structure (6–8 variantes de plan par template) et l'angle d'introduction.
- Chaque page programmatique injecte des données factuelles propres (prix, périodicité, specs) — la donnée fait l'unicité, pas juste la formulation.
- FAQ en fin d'article quand pertinent (alimente aussi le schema `FAQPage`, voir [geo.md](geo.md)).
- Dates de mise à jour visibles sur les pages sensibles au temps (tarifs, barèmes, réglementation).
- E-E-A-T : page auteur avec profil crédible (métier en lien avec la niche), sources citées (organismes officiels, constructeurs), avis d'expert encadré quand pertinent.

## 5. Technique (SEOPress)

- Utiliser **SEOPress** (pas Yoast) comme plugin SEO sur les installations WordPress : titre, meta description, canonical, Open Graph, XML sitemaps.
- Title tag : mot-clé principal en début de balise, marque en fin si pertinent, ≤ 60 caractères.
- Meta description : incitation à l'action, mention d'un chiffre/donnée factuelle, ≤ 155 caractères.
- URL : courte, sans stop words inutiles, reflète la hiérarchie du cocon si possible (`/silo/sous-cocon/article/`).
- Sitemaps segmentés par silo, **≤ 2 000 URLs par sitemap** (voir [gestion-de-projet.md](gestion-de-projet.md) pour la cadence de publication).
- Balisage Hn strict : un seul H1, hiérarchie logique des H2/H3 sans saut de niveau.
- Images : alt text descriptif incluant l'entité de la page (modèle, pièce, code), compression avant upload, lazy-loading natif.
- Pas de contenu dupliqué entre domaines de la même plateforme (PBN) : chaque niche/site doit avoir un contenu réellement distinct, pas un simple reskin.

## 6. Publication WordPress (planification, gating, auteurs)

Les règles détaillées de génération/insertion WordPress (format Gutenberg, catégories/tags/image à la une natifs, nombre et rôle des comptes auteur, planification des dates de publication à 5 articles/jour max, et checklist de blocage avant publication) sont dans [wordpress-publication.md](wordpress-publication.md) — à lire avant toute commande `/p4-hubs` ou `/p5-articles`.

## 7. Anti-patterns à éviter

- Ne jamais publier un article sans que son hub/sous-hub parent existe déjà (cf. pipeline P1–P6 du plan de niche).
- Ne jamais publier 10 000 pages d'un coup sur un domaine neuf : ça grille le crawl budget. Respecter la cadence définie dans le plan (300–500 articles/semaine).
- Ne jamais dupliquer un mot-clé principal sur deux URLs (cannibalisation).

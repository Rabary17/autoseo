# Skill GEO — Generative Engine Optimization

Règles pour que le contenu soit bien compris, cité et repris par les moteurs génératifs (ChatGPT, Perplexity, Google AI Overviews, Claude, etc.), en complément du SEO classique (voir [seo.md](seo.md)).

## 1. Principe général

Un moteur génératif ne "visite" pas une page comme un lecteur : il extrait des blocs de réponse autonomes. Chaque page doit donc contenir des **unités de réponse complètes et citables** (une question → une réponse directe en 2–4 phrases, sourcée), indépendamment du reste de l'article.

## 2. Structure orientée réponse

- Répondre à la question principale de la page dans les **50 premiers mots**, sans détour ni introduction narrative.
- Structurer avec des **titres formulés en questions** quand c'est naturel (H2/H3), reprenant les variantes du cluster de mots-clés.
- Sous chaque question : réponse courte et directe en premier paragraphe, développement/nuances ensuite.
- Utiliser des listes à puces et tableaux pour les données comparables (prix, délais, caractéristiques) — plus facilement extractibles qu'un paragraphe dense.
- Éviter les réponses qui nécessitent de lire tout l'article pour être comprises : chaque section doit être auto-suffisante.

## 3. Données structurées (schema.org / JSON-LD)

À insérer systématiquement selon le type de page :

| Type de page | Schema obligatoire |
|---|---|
| Tout article | `Article` ou `BlogPosting` (author, datePublished, dateModified) |
| Page avec FAQ | `FAQPage` (question/answer strictement identiques au texte visible) |
| Guide pas-à-pas (démarches, tutos) | `HowTo` (steps ordonnées) |
| Comparatif produits/modèles | `Product` + `AggregateRating` si avis réels disponibles (jamais de note inventée) |
| Page auteur | `Person` (jobTitle) — **jamais** de `sameAs` : les personas auteur sont éditoriales, pas de vraies personnes (voir [wordpress-publication.md](../skills/wordpress-publication.md) section 4). Un `sameAs` vers un profil créé pour l'occasion serait un faux profil, pire signal EEAT que son absence — voir [feuille-de-route-eeat-industrialisation.md](../docs/feuille-de-route-eeat-industrialisation.md) |
| Organisation (site-wide) | `Organization` (`legalName`, `address`, `founder` réels, `sameAs` vers les comptes sociaux de **marque**) — voir [feuille-de-route-eeat-industrialisation.md](../docs/feuille-de-route-eeat-industrialisation.md) |
| Toutes pages | `BreadcrumbList` reflétant le cocon (`Accueil › Silo › Sous-cocon › Article`) |

Règles strictes :
- Le JSON-LD doit être un **miroir exact** du contenu visible — jamais de données structurées qui n'apparaissent pas dans la page (risque de pénalité + de désinformation des IA).
- Un seul bloc `FAQPage` par page, avec les questions dans le même ordre que dans le texte.
- `dateModified` doit être mis à jour réellement à chaque révision de contenu (tarifs, barèmes), pas figé à la date de publication.

## 4. Citabilité et confiance (E-E-A-T pour IA)

- Toute donnée chiffrée (prix, barème, délai) doit citer sa source explicitement dans le texte (constructeur, service-public.fr, Sécurité routière...), pas seulement en bas de page.
- Auteur identifiable avec expertise plausible dans la niche (mécanicien, journaliste auto...).
- Éviter le langage marketing vague ("le meilleur", "incontournable") sans donnée à l'appui — les IA génératives dévalorisent les affirmations non sourcées lors de la synthèse.

## 5. Accessibilité du contenu pour le crawl IA

- Contenu doit être présent dans le HTML servi (pas uniquement injecté en JS côté client) — les crawlers IA n'exécutent pas toujours le JavaScript.
- Pas de contenu caché derrière un scroll infini ou un "lire la suite" qui masque la réponse principale.
- `robots.txt` : ne pas bloquer les crawlers IA légitimes (GPTBot, PerplexityBot, ClaudeBot, Google-Extended) sauf décision explicite et assumée de l'utilisateur sur la niche concernée.

## 6. Lien avec le maillage sémantique

Le cocon sémantique (voir [seo.md](seo.md) section 2) sert aussi le GEO : un moteur génératif qui suit un lien interne doit retrouver la même entité (modèle, prestation, code défaut) traitée sous un angle complémentaire, jamais une redite. C'est ce qui permet à une IA de "comprendre" la couverture exhaustive du sujet par le site et de le citer comme source faisant autorité.

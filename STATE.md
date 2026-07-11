# STATE — État d'avancement (à lire en premier lors de toute reprise)

> Ce fichier est la mémoire de travail du projet, lisible par n'importe quel agent IA (Claude ou autre) qui reprend la main. Il doit rester à jour en permanence — voir [skills/gestion-de-projet.md](skills/gestion-de-projet.md) pour la règle de mise à jour.

## Niche active
**Auto & mobilité** — plan complet : [plan-auto-mobilite-10000.html](plan-auto-mobilite-10000.html) · plan d'action détaillé : [plan-auto-mobilite-10000-actions.html](plan-auto-mobilite-10000-actions.html)

## Dernière situation connue (2026-07-11)

- Abonnement Haloscan Starter confirmé (10 000 recherches Keyword Explorer/mois) — suffisant pour couvrir le P1.
- Clé API Haloscan configurée dans `.env` (non commitée), testée en live : `user/credit`, `keywords/similar`, `keywords/bulk` fonctionnels.
- Script de collecte P1 écrit et validé en `--dry-run` : [scripts/fetch-keywords.js](scripts/fetch-keywords.js) + [scripts/haloscan-client.js](scripts/haloscan-client.js).
- Base de mots-clés seed extraite du fichier mère dans [data/keywords/seeds.json](data/keywords/seeds.json) (19 silos, ~506 seeds).
- 2026-07-11 : silo « Électrique & hybride » étendu aux technologies d'avenir (demande utilisateur) — 2 nouveaux sous-cocons : « Voiture autonome & connectée » et « Technologies d'avenir & rétrofit » (batterie solide, V2G, rétrofit, hydrogène, e-carburants). Le silo passe à 9 sous-cocons / 46 seeds. L'hydrogène "pratique" (GPL/GNV/stations) reste dans « Carburants & consommation » — veiller à l'anti-cannibalisation au clustering P1.
- **Run P1 + enrichissement réalisés le 2026-07-11** sur le silo « Entretien & révision » (40/40 seeds) → [data/keywords/entretien-revision.json](data/keywords/entretien-revision.json). Crédit Haloscan restant : **9 838** / 10 000 (~117 crédits consommés au total sur cette session, expérimentation comprise — marge encore très large).
- **Script `fetch-keywords.js` amélioré** : en plus de `keywords/similar`, chaque seed est maintenant complété par `keywords/match`, `keywords/questions` et `keywords/related` (coût faible mais réel et répété à chaque appel — voir commentaire en tête de fichier, `--force-enrich` n'est donc pas gratuit à répéter à volonté). Filtrage du bruit : blocklist de marques + **exigence de chevauchement lexical avec le seed sur les 3 sources** (y compris `questions`/PAA — corrigé le 2026-07-11 après avoir constaté que les questions Haloscan ne sont pas toujours spécifiques au seed, ex. "contrôle technique prix" ressortait à tort sous "vidange prix moyen" via le seul mot "prix") + liste de mots trop génériques dans cette niche ("prix", "voiture", "auto", "meilleur"...) exclus du calcul de pertinence sans être retirés du texte affiché. Résultat final sur « Entretien & révision » après nettoyage : candidats nettement plus propres (ex. le cluster "vidange prix moyen" passe de 13 candidats bruités à 5 candidats tous réellement sur le sujet vidange). Crédit Haloscan restant : **9 795** / 10 000.
- **Fichier Excel [tracking-mots-cles.xlsx](data/keywords/tracking-mots-cles.xlsx) régénéré avec les données nettoyées** via le script [scripts/populate-tracking-xlsx.py](scripts/populate-tracking-xlsx.py) : 40 clusters réels pour « Entretien & révision » (1 ligne = 1 seed + ses variantes enrichies, jamais 1 ligne par variante — anti-cannibalisation), triés par volume cumulé décroissant (priorité volume bon / difficulté faible), auteur assigné automatiquement (persona A pour ce silo). À relancer (`python scripts/populate-tracking-xlsx.py`) après chaque nouveau silo traité par P1 — le script régénère tout l'onglet Suivi à partir des fichiers `data/keywords/*.json` existants, aucune saisie manuelle requise.
- **Nouveau skill [skills/redaction.md](skills/redaction.md)** (demande utilisateur du 2026-07-11) : voix d'écriture propre à chacun des 6 auteurs (vocabulaire, rythme de phrase, tic récurrent — en complément du tableau ton/silo de [wordpress-publication.md](skills/wordpress-publication.md) section 4), + liste de contrôle "ne pas sonner comme un LLM" (formules creuses interdites, faux équilibre systématique, hedging excessif, sur-optimisation du mot-clé...). Référencé depuis `/p4-hubs` et `/p5-articles` — à appliquer dès la prochaine rédaction réelle (le test d'article sur `thermotowel.local`, voir ci-dessous).
- Fichiers skills créés dans `/skills` (SEO, GEO, Design, Développement, Gestion de projet).
- Fichier de suivi mots-clés/pages : [data/keywords/tracking-mots-cles.xlsx](data/keywords/tracking-mots-cles.xlsx) (template vide, colonnes définies).
- Commandes slash créées dans `.claude/commands/` pour chaque étape (P1 à P6) + utilitaires (`/resume`, `/credit-check`) — documentation complète dans [docs/commandes.md](docs/commandes.md).
- Règles de publication WordPress définies dans [skills/wordpress-publication.md](skills/wordpress-publication.md) : Gutenberg obligatoire, catégories = cocon / tags = entités, image à la une native, **6 comptes auteur** (A à F, un par domaine d'expertise couvrant les 19 silos), checklist de gating SEO avant publication, planification à **5 articles/jour max** par site (priorité : hubs > sous-hubs > volume décroissant, quota d'intention étalé).
- **Point d'attention non tranché** : à 5 articles/jour, 10 000 articles = ~5,5 ans de publication. À clarifier avec l'utilisateur avant de figer un calendrier complet (augmenter le plafond sur domaine mature, ou répartir sur plusieurs sites ?).

## Site de test WordPress

- Site : `http://thermotowel.local` (site WooCommerce de démo existant, réutilisé comme bac à sable pour valider le pipeline WordPress).
- Connexion : Application Password, identifiants dans `.env` (`WP_URL`, `WP_USER=admin`, `WP_APP_PASSWORD`). **Le login WP réel diffère du nom affiché** (le nom affiché "Andrianina" a échoué, le login réel est `admin`) — voir [skills/developpement.md](skills/developpement.md) section "Connexion & authentification".
- Client réutilisable : [scripts/wp-client.js](scripts/wp-client.js).
- Nettoyage effectué le 2026-07-11 : suppression de tout le contenu existant (1 article, 12 pages, 1 produit) et de tous les plugins d'origine (Elementor + Elementor Pro, Essential Addons, Fluent Forms, JetEngine/JetWoo*/JetReviews, Send, Templately, WooCommerce, Yoast SEO).
- Stack installée et active : **SEOPress** (`wp-seopress`) + **ACF** (`advanced-custom-fields`) — voir [skills/developpement.md](skills/developpement.md) pour la liste de plugins retenue et la procédure de nettoyage type.
- Site maintenant vierge, prêt pour le test d'un article complet de bout en bout (Gutenberg + catégorie/sous-cocon + tag + image à la une + auteur + schema, inséré en `draft`).

## Prochaine action concrète

Cocher la session 1/8 de la ligne « Entretien & révision » dans la table P1 de [plan-auto-mobilite-10000-actions.html](plan-auto-mobilite-10000-actions.html) (cases stockées en localStorage du navigateur — à cocher manuellement).


Réaliser le test d'un article complet jusqu'à l'insertion WordPress (en `draft`, pas encore programmé) sur `thermotowel.local`, en suivant [skills/wordpress-publication.md](skills/wordpress-publication.md).

Ensuite, une fois la collecte améliorée, compléter « Entretien & révision » puis enchaîner sur le silo suivant (validation utilisateur à chaque run) :
```
/p1-keywords Pannes & diagnostic
```
(équivalent script direct : `node scripts/fetch-keywords.js --silo "<silo>"`)
Puis reporter les résultats dans `data/keywords/tracking-mots-cles.xlsx` et cocher les sessions correspondantes dans [plan-auto-mobilite-10000-actions.html](plan-auto-mobilite-10000-actions.html).

## Historique des décisions

- 2026-07-11 : choix de Haloscan (vs Semrush/Ahrefs) pour le coût et la couverture FR.
- 2026-07-11 : découpage du plan de production en sessions ≤ 1h (voir page d'actions).
- 2026-07-11 : demande explicite de ne pas lancer le run massif tout de suite — script préparé et laissé en attente.
- 2026-07-11 : choix de tester le pipeline complet sur un site existant (`thermotowel.local`) plutôt que d'attendre un site niche dédié — nettoyage total autorisé explicitement par l'utilisateur ("site de test, modifie directement sans demander").
- 2026-07-11 : stack plugin réduite à SEOPress + ACF uniquement (suppression de tout page builder/e-commerce/SEO concurrent présent par défaut).

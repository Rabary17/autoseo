# Skill Gestion de projet — autoseo

Règles de méthode pour un projet mené par sessions IA discontinues, potentiellement avec des agents différents (Claude, autre), avec un budget de tokens limité par session.

## 1. Principe : toujours reprenable, par n'importe quel agent

- **[STATE.md](../STATE.md)** (à la racine du projet) est la seule source de vérité sur "où on en est". Tout agent qui reprend le projet **doit le lire en premier**, avant toute action.
- `STATE.md` doit rester court (une page max) : niche active, dernière situation connue, prochaine action concrète, historique des décisions importantes. Pas de détail technique exhaustif — ça, c'est le rôle des fichiers `skills/*.md` et des plans (`plan-*.html`).
- À la fin de chaque session significative, **mettre à jour STATE.md** avant de terminer : ce qui a été fait, ce qui reste, la prochaine commande/action exacte à lancer. Ne jamais laisser la reprise dépendre de la mémoire de la conversation précédente.
- Les décisions non triviales (choix d'outil, arbitrage de méthode) vont dans la section "Historique des décisions" de `STATE.md`, avec la date, pour qu'un autre agent comprenne le "pourquoi" sans avoir à redemander.

## 2. Gestion du budget de tokens

- **Toujours découper le travail en tâches ≤ 1h** (voir [plan-auto-mobilite-10000-actions.html](../plan-auto-mobilite-10000-actions.html) comme modèle) — une session IA doit pouvoir traiter une ou plusieurs de ces unités sans dépasser son budget de contexte.
- Privilégier des scripts réutilisables (dossier `scripts/`) plutôt que des actions manuelles répétées dans le chat : un script se relance à l'identique d'une session à l'autre, sans re-expliquer la logique à chaque fois.
- Avant tout run coûteux en tokens ou en crédits API (ex. génération massive de mots-clés ou d'articles), **toujours proposer un mode `--dry-run` ou un résumé chiffré**, et attendre validation explicite avant de lancer réellement — ne jamais lancer un batch massif par défaut.
- Sur demande "résume-moi" / "fais un résumé" : produire un résumé court orienté action (ce qui est fait / en cours / bloquant / prochaine étape), pas un compte-rendu narratif de la conversation.
- Quand une tâche est trop large pour une session, la découper et documenter dans `STATE.md` exactement à quelle sous-tâche s'arrêter, pour reprise propre à la session suivante.

## 3. Suivi des mots-clés et des pages

- **Fichier unique de suivi** : [data/keywords/tracking-mots-cles.xlsx](../data/keywords/tracking-mots-cles.xlsx). Toute génération/validation de mots-clés doit s'y refléter — c'est le registre de référence, pas les fichiers JSON bruts de `data/keywords/*.json` (ceux-là sont juste la donnée brute issue de l'API).
- Colonnes du fichier (une ligne = un cluster de mots-clés = une page prévue) :
  - `mot_cle_principal` — le mot-clé de tête du cluster
  - `variantes` — les autres mots-clés du cluster (séparés par `;`)
  - `silo` / `sous_cocon` — rattachement dans le cocon
  - `intention` — Info / Commercial / Transactionnel
  - `volume_estime` — donnée réelle Haloscan, jamais une estimation à la main
  - `url_cible` — URL prévue ou publiée de la page qui couvre ce cluster
  - `auteur` — persona auteur WordPress assigné (A à F, voir [wordpress-publication.md](wordpress-publication.md) section 4)
  - `statut` — `à faire` / `en rédaction` / `programmé` / `publié` / `à réécrire` (`programmé` = post_status WordPress `future`, date fixée mais pas encore en ligne)
  - `date_publication` — date réelle ou programmée de mise en ligne, doit correspondre au `post_date` WordPress
- Une seule ligne par mot-clé principal (anti-cannibalisation, voir [seo.md](seo.md) section 3) : avant d'ajouter une ligne, vérifier qu'aucune URL existante ne couvre déjà ce cluster.
- Ce fichier est la référence pour tout script de génération de contenu ou de maillage (`maillage.json` en dérive, jamais l'inverse).

## 4. Cadence et validation utilisateur

- Ne jamais lancer un run de production massif (mots-clés, articles, publication) sans validation explicite de l'utilisateur au moment T — un plan préparé n'est pas une autorisation de l'exécuter.
- Toujours annoncer, avant un run réel : le volume prévu, le coût en crédits/API, le temps estimé, et le fichier de sortie.
- Respecter la cadence de publication définie dans le plan de niche (ex. 300–500 articles/semaine pour Auto & mobilité) — ne pas accélérer sans que l'utilisateur l'ait demandé.

---
description: P5 — Produire un batch d'articles (usage $ARGUMENTS = "<silo> <nombre>", ex. "Entretien & révision 25")
---

Argument reçu : $ARGUMENTS (format attendu : nom du silo, puis nombre d'articles du batch — 25 par défaut si omis)

Prérequis : P4 (hub + sous-hubs) terminé pour ce silo. Sinon, arrête-toi et signale-le.

Étapes :
1. Sélectionne dans [data/keywords/tracking-mots-cles.xlsx](../../data/keywords/tracking-mots-cles.xlsx) les clusters au statut `à faire` pour ce silo, dans l'ordre, jusqu'au nombre demandé.
2. Pour chaque cluster : récupère son entrée dans `data/maillage/maillage.json` (liens déjà résolus — ne jamais improviser le maillage à la rédaction).
3. Rédige l'article en respectant :
   - Longueur 800–1 200 mots (programmatique) ou 1 500–2 500 (guide éditorial) selon le type — [skills/seo.md](../../skills/seo.md)
   - Réponse directe dans les 50 premiers mots, structure orientée question/réponse — [skills/geo.md](../../skills/geo.md)
   - Voix propre à l'auteur assigné et absence de tout tic d'écriture LLM (formules creuses, faux équilibre systématique, hedging excessif...) — [skills/redaction.md](../../skills/redaction.md)
   - Données factuelles issues de `data/factuel/*.json` (P2), jamais inventées
   - Schema.org approprié + BreadcrumbList
   - Maillage exact (montant, descendant si applicable, latéral, transversal) selon `maillage.json`
4. Rédige en blocs **Gutenberg** valides (pas de HTML brut), assigne catégorie primaire (sous-cocon), tags (entités), image à la une, et l'auteur correspondant au silo — voir [skills/wordpress-publication.md](../../skills/wordpress-publication.md) sections 1 à 4.
5. QA avant validation d'un article : vérifie l'absence de phrase dupliquée avec un article déjà produit du même template, présence des liens prévus, présence du schema, et l'ensemble de la checklist de gating (section 5 du même skill).
6. Insère l'article en base via WP REST API/WP-CLI en **`post_status = draft`** (ne jamais publier ou dater à ce stade — la programmation des dates est le rôle de `/p5-schedule`, jamais fait ici).
7. Marque le cluster `en rédaction` (pas `publié`) dans `tracking-mots-cles.xlsx`, avec son URL prévue et son auteur assigné.
8. Coche les sessions correspondantes (par lot de 25) dans la table P5 de la page d'actions et mets à jour [STATE.md](../../STATE.md).

Ne dépasse jamais le nombre d'articles demandé dans $ARGUMENTS sans confirmation — un batch reste une session ≤ 1h. Ne lance jamais `/p5-schedule` automatiquement à la fin de cette commande — ce sont deux étapes distinctes et volontairement séparées.

# autoseo

Plateforme de planification et production de contenu SEO/GEO pour un réseau de sites de niche (PBN).

**Avant toute action sur ce projet :**
1. Lire [STATE.md](STATE.md) — état d'avancement courant, prochaine action, historique des décisions.
2. Lire le(s) fichier(s) pertinent(s) dans [skills/](skills/README.md) selon le domaine du travail demandé (SEO, GEO, Design, Développement, Gestion de projet).

Le pipeline de production est piloté par des commandes slash dédiées (`/p1-keywords`, `/p2-database`, `/p3-mapping`, `/p4-hubs`, `/p5-articles`, `/p6-indexation`, `/credit-check`, `/resume`) — voir [docs/commandes.md](docs/commandes.md) pour le détail et l'ordre d'exécution.

Ne jamais lancer un run de production massif (mots-clés, articles) sans validation explicite de l'utilisateur — voir [skills/gestion-de-projet.md](skills/gestion-de-projet.md).

---
description: Planifier/recalculer la file de publication WordPress (dates + auteurs), sans publier immédiatement
---

Argument optionnel : $ARGUMENTS (silo ciblé, sinon tous les articles en statut `en rédaction` ou `programmé`)

Applique les règles de [skills/wordpress-publication.md](../../skills/wordpress-publication.md) (sections 4, 5, 6) :

1. Filtre dans [data/keywords/tracking-mots-cles.xlsx](../../data/keywords/tracking-mots-cles.xlsx) les lignes candidates (statut `en rédaction`, article déjà rédigé mais pas encore programmé).
2. Pour chacune, vérifie la checklist de gating (section 5) : si une condition échoue, laisse en statut `en rédaction`/`draft` et liste le motif — ne jamais programmer un article qui échoue le gating.
3. Pour celles qui passent le gating, assigne l'auteur selon le mapping silo → persona (section 4) si pas déjà fait.
4. Trie la file selon l'ordre de priorité (section 6 : hubs > sous-hubs > volume de recherche décroissant > quota d'intention étalé > silo en cours avant silo suivant).
5. Calcule `post_date` à raison de **5 articles maximum par jour** par site, jamais avant la date de publication de son hub/sous-hub parent, heures réparties dans la journée.
6. Met à jour `post_status = future` et `post_date` sur les articles WordPress concernés (via WP REST API ou WP-CLI), et le statut `programmé` + `date_publication` dans `tracking-mots-cles.xlsx`.
7. Termine par un résumé : nombre programmés, nombre bloqués (avec motifs), date du dernier article programmé de la file, et rappelle la conséquence arithmétique du plafond de 5/jour si le volume total dépasse plusieurs mois de file (voir [skills/wordpress-publication.md](../../skills/wordpress-publication.md) section 6).

Ne jamais forcer `post_status = publish` pour contourner la planification.

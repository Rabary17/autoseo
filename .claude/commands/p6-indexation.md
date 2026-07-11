---
description: P6 — Rituel hebdomadaire d'indexation et de contrôle qualité
---

Exécute la checklist hebdomadaire définie dans le plan (section P6) :

1. Génère/mets à jour le sitemap du dernier silo publié (segmenté, ≤ 2 000 URLs — voir [skills/seo.md](../../skills/seo.md)).
2. Rappelle à l'utilisateur de soumettre le sitemap à Google Search Console (action manuelle côté utilisateur, pas automatisable ici).
3. Si l'utilisateur fournit un export GSC, analyse le taux d'indexation et les erreurs de crawl de la semaine précédente.
4. Tire 5 articles au sort parmi les publiés récemment et vérifie : unicité (pas de phrase dupliquée avec un article du même template), liens internes valides, schema.org présent, affichage mobile correct.
5. Si des pages ont plus de 90 jours sans clic/impression significative (donnée à fournir par l'utilisateur), liste-les comme candidates à la réécriture dans `tracking-mots-cles.xlsx` (statut `à réécrire`).
6. Résume en fin de commande : sitemaps à jour, résultats QA, liste de réécriture, et mets à jour [STATE.md](../../STATE.md).

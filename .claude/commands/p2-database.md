---
description: P2 — Compiler un lot de la base factuelle (usage $ARGUMENTS = nom du dataset, ex. "codes OBD lot 1/4")
---

Dataset demandé : $ARGUMENTS

Ce dataset correspond à une des lignes de la table P2 dans [plan-auto-mobilite-10000-actions.html](../../plan-auto-mobilite-10000-actions.html) (22 sessions au total). Étapes :

1. Identifie précisément le lot demandé et son volume cible (ex. "600 codes OBD — lot 1/4" = 150 codes).
2. Recherche/compile les données réelles (WebSearch si besoin de vérifier des tarifs/barèmes 2026, sources officielles en priorité : constructeurs, service-public.fr, Sécurité routière).
3. Écris le résultat dans un fichier JSON structuré sous `data/factuel/<slug-dataset>.json`, avec pour chaque entrée une clé `source` citant d'où vient la donnée (obligatoire pour le GEO, voir [skills/geo.md](../../skills/geo.md) section 4).
4. Ne jamais inventer un chiffre : si une donnée n'est pas vérifiable avec confiance, marque `"a_verifier": true` plutôt que de deviner.
5. Une fois le lot terminé, coche la session correspondante dans la page d'actions et mets à jour [STATE.md](../../STATE.md).

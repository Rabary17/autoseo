---
description: P1 — Voir l'état d'avancement de la collecte de mots-clés, silo par silo
---

Liste les fichiers présents dans `data/keywords/*.json` (hors `seeds.json`). Pour chacun, indique :
- nom du silo (déduit du champ `silo` dans le JSON)
- nombre de seeds traités (`Object.keys(seeds).length`)
- nombre de seeds total attendu pour ce silo (depuis `seeds.json`)
- pourcentage d'avancement

Compare avec la table P1 de [plan-auto-mobilite-10000-actions.html](../../plan-auto-mobilite-10000-actions.html) et signale tout écart entre les sessions cochées et l'avancement réel des fichiers.

Termine par la liste des silos pas encore commencés.

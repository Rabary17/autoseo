---
description: P1 — Collecter les mots-clés d'un silo via Haloscan (usage $ARGUMENTS = nom du silo)
---

Silo demandé : $ARGUMENTS

Étapes obligatoires, dans l'ordre :

1. Vérifie que le silo existe dans [data/keywords/seeds.json](../../data/keywords/seeds.json). S'il n'est pas exact, propose les silos disponibles et arrête-toi.
2. Lance d'abord une simulation :
   ```
   node scripts/fetch-keywords.js --silo "<nom exact du silo>" --dry-run
   ```
   Affiche le nombre de seeds à traiter et le nombre déjà présents dans `data/keywords/<slug-silo>.json`.
3. **Demande confirmation explicite à l'utilisateur** avant de lancer le run réel (consommation de crédit Haloscan). Rappelle le coût estimé (1 appel = 1 creditKeyword par seed non déjà traité).
4. Une fois confirmé, lance :
   ```
   node scripts/fetch-keywords.js --silo "<nom exact du silo>"
   ```
5. À la fin, résume : nombre d'appels effectués, fichier de sortie, crédit restant.
6. Rappelle que les résultats bruts sont dans `data/keywords/<slug-silo>.json` mais que le fichier de référence à compléter reste [data/keywords/tracking-mots-cles.xlsx](../../data/keywords/tracking-mots-cles.xlsx) (voir [skills/gestion-de-projet.md](../../skills/gestion-de-projet.md)).
7. Mets à jour [STATE.md](../../STATE.md) : silo traité, nombre de sessions cochées correspondantes dans [plan-auto-mobilite-10000-actions.html](../../plan-auto-mobilite-10000-actions.html) (table P1, ligne du silo).

Ne jamais sauter l'étape de confirmation (étape 3).

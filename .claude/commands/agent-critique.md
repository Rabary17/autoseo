---
description: Agent critique — vérifier que chaque affirmation de l'article est traçable dans le rapport du Testeur (usage $ARGUMENTS = "<slug>")
---

Slug demandé : $ARGUMENTS

Rôle : **ne corrige pas le style** — c'est le garde-fou anti-hallucination du pipeline. Vérifie
uniquement le sourçage.

Étapes :
1. Charge l'article rédigé et le rapport du Testeur (`data/tests/rapports/<slug>.json`).
2. Relève chaque affirmation factuelle de l'article (chiffre, prix, tarif, observation) et vérifie
   qu'elle correspond exactement à un champ du rapport — pas d'arrondi trompeur, pas de
   généralisation non justifiée ("le moins cher du marché" alors que 2 enseignes seulement ont été
   testées, par exemple).
3. Vérifie aussi la présence des mentions obligatoires (date du test, caractère estimatif/non
   contractuel si YMYL, voir [skills/agents-ia.md](../../skills/agents-ia.md) section 5).
4. Produit un verdict :
   - **Validé** : l'article peut passer à `/agent-publier`.
   - **Corrections demandées** : liste précise des affirmations non traçables ou mal formulées, à
     corriger avant nouvelle passe de critique. Ne jamais valider "avec réserve".
5. Consigne le verdict dans `data/tests/rapports/<slug>.json` (champ `critique`) pour traçabilité.

Aucun article ne passe à la publication sans un verdict "Validé" explicite.

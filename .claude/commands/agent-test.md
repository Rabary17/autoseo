---
description: Agent Testeur — exécuter réellement le protocole et produire le rapport JSON + preuves (usage $ARGUMENTS = "<slug du brief>")
---

Brief demandé : $ARGUMENTS

Prérequis : le brief doit exister dans `data/tests/briefs/<slug>.json` (créé par `/agent-brief`).
Sinon, arrête-toi et signale-le.

Étapes :
1. Charge le brief, identifie le protocole indiqué et lis le fichier correspondant dans
   [skills/protocoles-test/](../../skills/protocoles-test/) en entier avant d'agir.
2. Exécute réellement les étapes du protocole via navigation web réelle (Claude in Chrome ou
   navigateur intégré selon ce qui est disponible) — jamais de simulation ni de valeur estimée à la
   place d'une observation réelle.
3. Capture une image à chaque étape clé, sauvegardée dans `data/tests/preuves/<slug>/NN-nom.png`.
   **Minimum 5 captures réelles pour l'article final** (règle définie dans [skills/agents-ia.md](../../skills/agents-ia.md) section 4) : prévois large pendant le test plutôt que de devoir revenir configurer un site une seconde fois — capture chaque prix d'entrée de gamme ET chaque prix de finition testée, pas uniquement la finition retenue.
4. **Mode échec propre obligatoire** : si un site est inaccessible, un formulaire cassé, ou une donnée
   non obtenue, consigne-le explicitement dans `blocages` — n'invente jamais une observation de
   remplacement. Un rapport partiel avec blocages signalés est préférable à un rapport complet mais
   partiellement inventé.
5. Respecte le rythme raisonnable et les règles de coordonnées jetables du protocole et de
   [skills/agents-ia.md](../../skills/agents-ia.md) section 5.
6. Produit le rapport JSON (structure : voir [skills/agents-ia.md](../../skills/agents-ia.md)
   section 4) dans `data/tests/rapports/<slug>.json`.
7. Résume en fin d'exécution : nombre d'observations obtenues, nombre de blocages, prochaine étape
   (`/agent-redaction`).

Ne rédige jamais l'article dans cette commande — c'est le rôle de `/agent-redaction`.

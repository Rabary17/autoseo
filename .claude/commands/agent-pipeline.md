---
description: Agent Directeur de production — orchestrer Brief → Test → Rédaction → Critique → Publication pour un sujet du silo Tests (usage $ARGUMENTS = "<sous-cocon> [sujet]")
---

Argument reçu : $ARGUMENTS (sous-cocon du silo Tests, sujet optionnel s'il est déjà précisé)

Prérequis : lire [skills/agents-ia.md](../../skills/agents-ia.md) en entier avant de lancer quoi que
ce soit.

Étapes, avec **pause et confirmation explicite de l'utilisateur entre chaque étape** (phase 1 :
contrôle humain systématique, pas d'automatisation bout-en-bout) :
1. Lance `/agent-brief $ARGUMENTS`. Présente le brief produit, attends confirmation.
2. Lance `/agent-test <slug du brief>`. Présente le rapport (observations + blocages), attends
   confirmation avant de continuer même si des blocages sont présents.
3. Lance `/agent-redaction <slug>`. Présente l'article produit.
4. Lance `/agent-critique <slug>`. Si "Corrections demandées", relance `/agent-redaction` puis
   `/agent-critique` jusqu'à "Validé" — jamais plus de 3 allers-retours sans repasser la main à
   l'utilisateur pour arbitrage.
5. Une fois "Validé", lance `/agent-publier <slug>`.
6. Mets à jour [STATE.md](../../STATE.md) : sujet traité, statut, prochaine action.

Ne saute jamais une étape ni une confirmation. Ne traite qu'un seul sujet par exécution de cette
commande — pas de traitement en lot tant que le pipeline n'a pas été validé sur plusieurs sujets.

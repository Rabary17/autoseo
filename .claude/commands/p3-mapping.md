---
description: P3 — Générer/mettre à jour le fichier de maillage interne (usage optionnel $ARGUMENTS = silo à traiter, sinon tous)
---

Silo(s) ciblé(s) : $ARGUMENTS (si vide : tous les silos ayant leur P1+P2 terminés)

Prérequis à vérifier avant de commencer : pour chaque silo visé, le P1 (mots-clés) et le P2 (données factuelles associées) doivent être marqués terminés dans [plan-auto-mobilite-10000-actions.html](../../plan-auto-mobilite-10000-actions.html). Si ce n'est pas le cas pour un silo demandé, arrête-toi et signale-le.

Étapes :
1. Lis [data/keywords/tracking-mots-cles.xlsx](../../data/keywords/tracking-mots-cles.xlsx) (onglet Suivi) — c'est la source de vérité des clusters/URLs, pas les JSON bruts.
2. Pour chaque cluster du/des silo(s) visé(s), détermine : hub parent, sous-hub parent, 3-5 liens latéraux (même sous-cocon, entité proche), 0-2 liens transversaux (entité partagée uniquement), rotation d'ancres (40/30/20/10, voir [skills/seo.md](../../skills/seo.md) section 2).
3. Génère/mets à jour `data/maillage/maillage.json` avec les entrées `{url, mot_cle_principal, silo, sous_hub, liens_lateraux[], liens_transversaux[], ancres[]}`. Ne jamais écraser les entrées déjà résolues d'un autre silo — fusionner, pas remplacer.
4. Coche les sessions correspondantes dans la table P3 de la page d'actions et mets à jour [STATE.md](../../STATE.md).

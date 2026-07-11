---
description: Vérifier le solde de crédits Haloscan restant avant tout run P1
---

Exécute (depuis la racine du projet) :

```
node -e "require('./scripts/haloscan-client').getCredit().then(c => console.log(JSON.stringify(c, null, 2)))"
```

Affiche ensuite au format court :
- `creditKeyword` restant (celui qui compte pour le P1, `keywords/similar`)
- `creditBulkKeyword` restant (validation de volumes en masse)
- `creditSite` restant (analyse concurrents)

Si `creditKeyword` < 500, avertis l'utilisateur avant de proposer de lancer un run P1 (voir [skills/gestion-de-projet.md](../../skills/gestion-de-projet.md) section 4).

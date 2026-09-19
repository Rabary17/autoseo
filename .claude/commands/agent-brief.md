---
description: Agent Journaliste — identifier un sujet de test concret et produire un brief structuré (usage $ARGUMENTS = "<sous-cocon> [angle optionnel]")
---

Sous-cocon du silo Tests demandé : $ARGUMENTS

Prérequis : lire [skills/agents-ia.md](../../skills/agents-ia.md) (rôle Journaliste, section 3) et le
protocole correspondant dans [skills/protocoles-test/](../../skills/protocoles-test/) selon le
sous-cocon visé.

Étapes :
1. Vérifie que le sous-cocon existe dans le silo "Tests" de [config/niches/auto-mobilite/niche.json](../../config/niches/auto-mobilite/niche.json). Sinon, arrête-toi et liste les sous-cocons disponibles.
2. Identifie un sujet **concret et précis** (pas un mot-clé générique) : un ou plusieurs modèles
   nommés, un profil précis, une prestation précise — voir le protocole associé pour le niveau de
   précision attendu.
3. Recherche web rapide pour vérifier que le sujet est pertinent (volume de recherche plausible,
   pas déjà traité en profondeur dans un article existant du site — vérifier via
   [data/maillage/maillage.json](../../data/maillage/maillage.json)).
4. Produit un brief JSON avec : `sujet`, `sous_cocon`, `protocole` (nom exact du fichier dans
   `skills/protocoles-test/`), `angle`, `mots_cles_cibles`, `parametres_precis` (véhicule/profil/
   prestation exacts à utiliser — le Testeur ne doit rien deviner), `auteur` (B par défaut pour ce
   silo).
5. Sauvegarde dans `data/tests/briefs/<slug-sujet>.json`.
6. Ajoute une ligne dans [data/keywords/tracking-mots-cles.xlsx](../../data/keywords/tracking-mots-cles.xlsx) avec statut `en rédaction` (valeur existante du fichier — pas de nouveau statut "brief"), silo "Tests", sous-cocon, auteur assigné.

Ne lance jamais toi-même `/agent-test` à la suite — c'est une étape distincte, avec son propre point
de contrôle.

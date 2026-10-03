# Garde-fou connaissance — limite factuelle du modèle (contrat commun, toute génération/relecture)

Garde-fou ajouté le 2026-10-03 (demande explicite de l'utilisateur) après un
cas réel trouvé en QC manuelle : un article affirmait qu'une déclaration de
vol de carte grise exige un dépôt de plainte, et désignait l'organisme
gestionnaire sous son ancien nom (ANTS) sans mentionner son renommage en
France Titres (mars 2024) — deux affirmations fausses ou périmées, écrites
avec la même assurance qu'un fait vérifié, parce qu'elles venaient de la
mémoire du modèle plutôt que d'une source datée. Aucune des deux ne porte de
`%`/`€`/durée (voir `checkFactsNotInvented`, qui ne couvre que les chiffres) :
ce garde-fou couvre ce que cette règle ne couvre pas.

## Ta limite de connaissance n'est pas la même chose qu'une date d'entraînement officielle

Aucune date de coupure officielle n'est publiée pour le modèle utilisé ici
(vérifié le 2026-10-03 — voir `config.js#KNOWLEDGE_CUTOFF_NOTE`). Tu dois donc
l'estimer toi-même, honnêtement, et la restituer dans le champ
`connaissance_limite` du schéma de réponse (format `AAAA-MM`, estimation
raisonnable — jamais une date dans le futur, jamais "aujourd'hui").
Sous-estimer légèrement (déclarer une limite plus ancienne que la réalité)
n'a aucune conséquence. La surestimer (prétendre connaître des événements
récents que tu ne maîtrises pas vraiment) est le défaut que ce garde-fou
existe pour éliminer.

## La règle, stricte

Pour **tout fait qui a pu changer depuis ta limite de connaissance** —
chiffre, prix, taux, barème, seuil légal, délai réglementaire, texte de loi,
nom ou statut d'un organisme, procédure administrative en vigueur — tu ne
l'affirmes **jamais** de mémoire seule :

- S'il figure dans `faits_disponibles` ou dans une source fournie : tu peux
  l'écrire, en le faisant reposer sur cette source (voir `sources[]`).
- S'il n'y figure pas : tu ne l'inventes pas et tu ne le complètes pas par ce
  que tu "crois savoir". Formule sans ce fait précis, ou laisse la section
  plus générale, plutôt que de combler le vide par une affirmation non
  vérifiée. N'utilise jamais un marqueur comme "[à vérifier]" dans le texte
  livré (voir `guardrails/uncertainty.js` : ces marqueurs sont retirés et
  signalés, jamais une façon acceptable de publier un doute) — le choix est
  binaire : la source existe et tu écris le fait, ou elle n'existe pas et tu
  ne l'écris pas.

Cette règle s'ajoute à `checkFactsNotInvented` (qui bloque déjà tout chiffre
non sourcé), et ne la remplace pas : elle couvre en plus les faits non
chiffrés (noms d'organismes, existence/abrogation d'une procédure, qui a le
droit de faire une demande) exactement du même type que les deux erreurs
réelles trouvées le 2026-10-03.

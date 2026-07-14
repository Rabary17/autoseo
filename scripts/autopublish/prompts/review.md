# Contrat de relecture / auto-correction obligatoire

Tu relis un contenu déjà généré (fourni ci-dessous en JSON) pour le persona dont le skill de rédaction complet t'a été donné juste au-dessus dans le message système. Cette relecture est **obligatoire** pour toute pièce avant publication — tu ne génères pas un nouveau contenu, tu vérifies et corriges si besoin celui fourni.

## Ce que tu dois vérifier

1. **Voix de l'auteur** : le contenu respecte-t-il le registre de vocabulaire, le rythme et le réflexe/tic récurrent décrits dans le skill de l'auteur ?
2. **Liste de contrôle anti-tics-LLM** (section 3 du skill de l'auteur) : formules creuses, faux équilibre systématique, hedging excessif, rythme robotique, symétrie de structure, généralités sans donnée, sur-optimisation du mot-clé, emoji/ponctuation artificielle — signale et corrige toute occurrence.
3. **Fidélité aux faits fournis** : chaque donnée chiffrée du contenu correspond-elle exactement aux faits fournis dans le message utilisateur (pas de chiffre inventé, arrondi de manière trompeuse, ou sorti de son contexte) ?
4. **Maillage** : les liens et ancres utilisés sont-ils exactement ceux fournis (pas de lien inventé, pas d'ancre différente de celle fournie) ?
5. **Contraintes structurelles** (section 4 du skill de l'auteur / contraintes SEO-GEO du type de contenu) : longueur, réponse dans les 50 premiers mots, FAQ alignée avec le texte visible, blocs Gutenberg valides.
6. **Silos YMYL** : si applicable, absence de faux titre professionnel et présence d'au moins une source officielle citée dans le texte.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé (schéma de relecture, distinct du schéma de génération) :

- `conforme` : `true` si le contenu fourni est publiable tel quel, `false` si tu as dû corriger quelque chose.
- `justification` : explique **pourquoi** ce contenu a été jugé conforme ou non — les points vérifiés et ce que tu as trouvé (ou pas trouvé) à chaque point de la liste ci-dessus. Ce texte est écrit dans un fichier de log lu par un humain : sois concret, jamais un simple "OK" ou "RAS".
- `corrections_appliquees` : liste des corrections effectivement appliquées (vide si `conforme: true`) — une phrase par correction, précise sur ce qui a changé et pourquoi.
- `content` : l'enveloppe de contenu complète, au même schéma que la génération initiale — inchangée si `conforme: true`, corrigée sinon. Ne renvoie jamais une enveloppe partielle : tous les champs doivent être présents même si seul un champ a changé.

Une seule passe de relecture — pas de boucle. Si un problème est bloquant et non corrigeable par toi (ex. donnée factuelle manquante pour répondre à la question posée), signale-le clairement dans `justification` et laisse `conforme: false` : le gating programmatique décidera de la suite (retour en brouillon).

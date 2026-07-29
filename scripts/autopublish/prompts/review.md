# Contrat de relecture / auto-correction obligatoire

Tu relis un contenu déjà généré (fourni ci-dessous en JSON) pour le persona dont le skill de rédaction complet t'a été donné juste au-dessus dans le message système. Cette relecture est **obligatoire** pour toute pièce avant publication — tu ne génères pas un nouveau contenu, tu vérifies et corriges si besoin celui fourni.

## Ce que tu dois vérifier

1. **Voix de l'auteur** : le contenu respecte-t-il le registre de vocabulaire, le rythme et le réflexe/tic récurrent décrits dans le skill de l'auteur ?
2. **Liste de contrôle anti-tics-LLM** (section 3 du skill de l'auteur) : formules creuses, faux équilibre systématique, hedging excessif, rythme robotique, symétrie de structure, généralités sans donnée, sur-optimisation du mot-clé, emoji/ponctuation artificielle — signale et corrige toute occurrence.
2bis. **Style & anti-IA commun** (`style-anti-ia.md`, donné juste au-dessus) : verbes interdits (offrir, devenir, résider, s'imposer, reposer, rester, demeurer, constituer), participes présents stylistiques, clichés IA, phrases >20 mots en majorité, placement des liens (un par H2, aucun dans FAQ/tableau/titre/TL;DR), tableau pour tout comparatif/prix, **aucun tiret cadratin espacé (" — ") nulle part dans `content_gutenberg`** — corrige immédiatement si tu en trouves un.
3. **Fidélité aux faits fournis** : chaque donnée chiffrée du contenu correspond-elle exactement aux faits fournis dans le message utilisateur (pas de chiffre inventé, arrondi de manière trompeuse, ou sorti de son contexte) ?
4. **Maillage** : les liens et ancres utilisés sont-ils exactement ceux fournis (pas de lien inventé, pas d'ancre différente de celle fournie) ? Vérifie en particulier que chaque `href` est le chemin relatif **exact** fourni (`maillage.sous_hub`/`maillage.hub`/chaque URL de `liens_lateraux`) — jamais un domaine inventé (`https://exemple.com/...`), jamais `href="#"`, jamais l'URL de la page elle-même (`maillage.url`). Si un lien manque, est cassé (domaine inventé, `#`, auto-lien) ou a été supprimé par erreur, ajoute/corrige-le plutôt que de laisser l'article sans son maillage attendu.
5. **Contraintes structurelles** (section 4 du skill de l'auteur / contraintes SEO-GEO du type de contenu) : longueur, réponse dans les 50 premiers mots, FAQ alignée avec le texte visible, blocs Gutenberg valides.
6. **Silos YMYL** : si applicable, absence de faux titre professionnel et présence d'au moins une source officielle citée dans le texte.
7. **Pistes concurrentielles** (si `pistes_concurrentielles_a_reformuler` fourni) : le texte final ne doit contenir aucune trace de citation/paraphrase proche de ces pistes ni aucune mention de leur origine (nom de site, "selon nos recherches/concurrents", etc.) — corrige immédiatement si tu en trouves une.
8. **Propreté de `sources[].label`** : doit être un simple nom de source ("Vroomly", "service-public.gouv.fr"), jamais un commentaire de méthodologie ("recoupé avec X et Y", "vérifié auprès de...", "consulté le..."). Si tu en trouves un, corrige-le en ne gardant que le nom de la source principale.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé (schéma de relecture, distinct du schéma de génération) :

- `conforme` : `true` si le contenu fourni est publiable tel quel, `false` si tu as dû corriger quelque chose.
- `justification` : explique **pourquoi** ce contenu a été jugé conforme ou non — **3 à 5 phrases maximum**, jamais un simple "OK"/"RAS" mais jamais non plus une liste exhaustive point par point de la checklist ci-dessus. Ne mentionne que ce qui est réellement problématique ou ce qui a motivé une correction ; si tout est conforme, une phrase suffit ("Conforme : voix de l'auteur respectée, aucun fait inventé, maillage exact, longueur correcte.").
- `corrections_appliquees` : liste des corrections effectivement appliquées (vide si `conforme: true`) — une phrase par correction, précise sur ce qui a changé et pourquoi.
- `content` : si `conforme: true`, renvoie **littéralement `null`** — ne réécris pas le contenu, il est déjà bon tel quel, inutile de le recopier. Si `conforme: false`, renvoie l'enveloppe de contenu complète corrigée (même schéma que la génération initiale) : jamais une enveloppe partielle, tous les champs doivent être présents même si seul un champ a changé.

Une seule passe de relecture — pas de boucle. Si un problème est bloquant et non corrigeable par toi (ex. donnée factuelle manquante pour répondre à la question posée), signale-le clairement dans `justification` et laisse `conforme: false` : le gating programmatique décidera de la suite (retour en brouillon).

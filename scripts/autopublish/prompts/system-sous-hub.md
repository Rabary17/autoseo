# Contrat de génération — Sous-hub (sous-cocon)

Tu rédiges une page sous-hub : elle liste et maille éditorialement tous les articles de son sous-cocon, et cible le mot-clé de tête du sous-cocon. Le persona (voix, ton, tics) t'a été donné juste au-dessus — respecte-le intégralement.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé. `content_gutenberg` en blocs Gutenberg valides.

## Contraintes SEO (non négociables)

- Longueur : **1 500 mots minimum, jamais moins**, avec un objectif de 1 500 à 2 500 mots dès que le nombre d'articles listés le justifie naturellement. Un sous-cocon à peu d'articles reste tenu au plancher de 1 500 mots. Si lister les articles ne suffit pas seul à l'atteindre, complète avec du contenu réellement utile propre à ce sous-cocon (critères de choix entre les articles listés, erreurs fréquentes, contexte pratique) — jamais du remplissage ni une redite des articles avec d'autres mots (voir `style-anti-ia.md`). Ce gabarit doit rester valable sans changement si de nouveaux articles sont ajoutés plus tard à ce sous-cocon.
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 155 caractères avec un chiffre/donnée réelle.
- Le corps doit lister **tous** les articles enfants fournis dans le message utilisateur, sous forme de liste éditorialisée (une phrase de contexte par article, jamais un simple `<ul>` de liens bruts) — 10 à 40 liens descendants selon le nombre d'articles fournis.
- Lien montant vers le hub parent (ancre élargie) + breadcrumb.
- Un seul H1 (le `title`).

## Contraintes GEO

- Réponds dans les 50 premiers mots à ce que couvre ce sous-cocon et pourquoi il aide le lecteur à choisir un article précis.
- FAQ optionnelle si pertinente au niveau du sous-cocon (questions transverses aux articles listés, pas une redite d'un article précis). Si tu inclus une FAQ, elle doit apparaître comme une vraie section visible dans `content_gutenberg` (titre + questions/réponses), reprenant **mot pour mot** les mêmes questions que `faq[]` — jamais une question présente dans `faq[]` mais absente du texte visible, ni l'inverse.

## Images d'appui

2 à 3 images d'appui (`inline_images[]`), en plus de l'image à la une. Voir la description du champ pour le placement exact (jeton `[[IMAGE:n]]`) et les règles de `query`/`alt`.

## Données factuelles

Si des faits te sont fournis dans le message utilisateur, utilise-les pour contextualiser (ex. fourchette de prix générale du sous-cocon) — sinon reste général sur ce niveau, les chiffres précis sont le rôle des articles enfants.

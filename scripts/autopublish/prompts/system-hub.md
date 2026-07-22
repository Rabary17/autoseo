# Contrat de génération — Hub (silo)

Tu rédiges la page hub d'un silo entier : elle cible le mot-clé de tête du silo et maille tous ses sous-hubs. Le persona (voix, ton, tics) t'a été donné juste au-dessus — respecte-le intégralement.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé. `content_gutenberg` en blocs Gutenberg valides.

## Contraintes SEO (non négociables)

- Longueur : **1 500 mots minimum, jamais moins**, avec un objectif de 2 500 à 4 000 mots dès que le silo compte assez de sous-hubs pour le justifier naturellement. Un silo à peu de sous-hubs (4-5) reste tenu au plancher de 1 500 mots — jamais un prétexte pour livrer moins. Ce gabarit doit rester valable sans changement si de nouveaux sous-hubs sont ajoutés plus tard à ce silo : plus il y en a à éditorialiser, plus le hub s'allonge naturellement au-delà du plancher, sans qu'il soit besoin d'y retoucher.
- Si le nombre de sous-hubs à éditorialiser ne suffit pas à lui seul à atteindre 1 500 mots, complète avec du contenu réellement utile et propre au silo dans son ensemble (jamais du remplissage ni une redite des sous-hubs avec d'autres mots) : critères de choix transversaux à tout le silo, erreurs fréquentes, contexte réglementaire ou tendances récentes, questions que se posent les lecteurs avant de choisir un sous-hub précis. Chaque paragraphe ajouté doit rester une vraie information nouvelle (voir `style-anti-ia.md`).
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 155 caractères avec un chiffre/donnée réelle.
- Le corps doit lister **tous** les sous-hubs fournis dans le message utilisateur, sous forme de liste éditorialisée (contexte par sous-hub, jamais un `<ul>` brut).
- Breadcrumb `Accueil › Silo`. Un seul H1 (le `title`).

## Contraintes GEO

- Réponds dans les 50 premiers mots à ce que couvre ce silo dans son ensemble et à qui il s'adresse.
- FAQ optionnelle, questions transverses au silo entier. Si tu inclus une FAQ, elle doit apparaître comme une vraie section visible dans `content_gutenberg` (titre + questions/réponses), reprenant **mot pour mot** les mêmes questions que `faq[]` — jamais une question présente dans `faq[]` mais absente du texte visible, ni l'inverse.

## Images d'appui

3 à 4 images d'appui (`inline_images[]`), en plus de l'image à la une — une par grande section du silo. Voir la description du champ pour le placement exact (jeton `[[IMAGE:n]]`) et les règles de `query`/`alt`.

## Données factuelles

Reste au niveau du silo (vue d'ensemble, ordres de grandeur généraux si fournis) — les chiffres précis par prestation/modèle sont le rôle des sous-hubs et articles enfants, ne les invente pas ici.

# Contrat de génération — Sous-hub (sous-cocon)

Tu rédiges une page sous-hub : elle liste et maille éditorialement tous les articles de son sous-cocon, et cible le mot-clé de tête du sous-cocon. Le persona (voix, ton, tics) t'a été donné juste au-dessus — respecte-le intégralement.

**Cette page est une page de navigation, pas un article de fond.** Comme le hub, elle oriente le lecteur vers le bon article, elle ne couvre pas le sujet elle-même — ne promets jamais "tout ce qu'il faut savoir" sur le sous-cocon. Une grille de cartes illustrées (image + titre) liste déjà tous les articles sous le texte : ton rôle est d'aider le lecteur à choisir le bon article, pas de la remplacer.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé. `content_gutenberg` en blocs Gutenberg valides.

## Contraintes SEO (non négociables)

- Longueur : **vise environ 2 000 mots** pour cette page, en couvrant réellement chaque article mentionné et le contexte pratique du sous-cocon. Si lister les articles ne suffit pas seul à l'atteindre, complète avec du contenu réellement utile propre à ce sous-cocon (critères de choix entre les articles listés, erreurs fréquentes, contexte pratique) — jamais du remplissage ni une redite des articles avec d'autres mots (voir `style-anti-ia.md`). Ce gabarit doit rester valable sans changement si de nouveaux articles sont ajoutés plus tard à ce sous-cocon.
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 155 caractères avec un chiffre/donnée réelle.
- Mentionne les articles fournis dans le message utilisateur pour donner du contexte (ce qu'ils couvrent, comment choisir entre eux) — mais **tu n'as pas besoin d'insérer un lien vers chacun** : la grille de cartes illustrées (image + titre, déjà rendue sous le texte) fait ce travail proprement. Un lien en texte reste possible mais seulement quand il est réellement naturel dans la phrase — jamais systématique, jamais un prétexte ("détaillé dans notre page 'X'") pour caser le lien.
- Lien montant vers le hub parent (ancre élargie) + breadcrumb.
- Un seul H1 (le `title`).

## Contraintes GEO

- Réponds dans les 50 premiers mots à ce que couvre ce sous-cocon et pourquoi il aide le lecteur à choisir un article précis.
- FAQ optionnelle si pertinente au niveau du sous-cocon (questions transverses aux articles listés, pas une redite d'un article précis). **Ne recopie jamais la FAQ dans `content_gutenberg`** — pas de section "Questions fréquentes" dans le corps : le frontend l'affiche déjà séparément depuis `faq[]` (accordéon + schema.org FAQPage).

## Images d'appui

2 à 3 images d'appui (`inline_images[]`), en plus de l'image à la une. Voir la description du champ pour le placement exact (jeton `[[IMAGE:n]]`) et les règles de `query`/`alt`.

## Données factuelles

Si des faits te sont fournis dans le message utilisateur, utilise-les pour contextualiser (ex. fourchette de prix générale du sous-cocon) — sinon reste général sur ce niveau, les chiffres précis sont le rôle des articles enfants.

## Pistes complémentaires (`pistes_concurrentielles_a_reformuler`)

Si le message utilisateur fournit ce champ, utilise-le pour bâtir **un ou plusieurs H2 entiers** utiles au lecteur sur ce sous-cocon (critères de choix, erreurs fréquentes, contexte pratique) — utile notamment pour atteindre naturellement le plancher de mots sans remplissage. Mêmes règles non négociables que pour un hub :
- **Reformule entièrement dans tes propres mots**, jamais une copie ou paraphrase proche.
- **Ne cite jamais de source** pour ces pistes — elles n'apparaissent jamais dans `sources[]`.
- Ne mentionne jamais l'existence de cette recherche elle-même dans le texte.

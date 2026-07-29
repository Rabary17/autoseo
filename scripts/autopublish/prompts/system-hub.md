# Contrat de génération — Hub (silo)

Tu rédiges la page hub d'un silo entier : elle cible le mot-clé de tête du silo et maille tous ses sous-hubs. Le persona (voix, ton, tics) t'a été donné juste au-dessus — respecte-le intégralement.

**Cette page est une page de navigation, pas un article de fond.** Elle fonctionne comme la page d'accueil d'une rubrique de magazine : elle oriente le lecteur vers le bon sous-hub, elle ne couvre pas le sujet elle-même. Ne promets jamais "tout ce qu'il faut savoir" — ce serait la promesse d'un article, pas d'une page hub. Une grille de cartes illustrées (image + titre) liste déjà tous les sous-hubs sous le texte : ton rôle est d'aider le lecteur à choisir la bonne carte, pas de la remplacer.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé. `content_gutenberg` en blocs Gutenberg valides.

## Contraintes SEO (non négociables)

- Longueur : **vise environ 2 000 mots** pour cette page, en couvrant réellement chaque sous-hub mentionné et en développant le contexte général du silo. Ce gabarit doit rester valable sans changement si de nouveaux sous-hubs sont ajoutés plus tard à ce silo : plus il y en a à éditorialiser, plus le hub s'allonge naturellement, sans qu'il soit besoin d'y retoucher.
- Si le nombre de sous-hubs à éditorialiser ne suffit pas à lui seul à atteindre ce volume, complète avec du contenu réellement utile et propre au silo dans son ensemble (jamais du remplissage ni une redite des sous-hubs avec d'autres mots) : critères de choix transversaux à tout le silo, erreurs fréquentes, contexte réglementaire ou tendances récentes, questions que se posent les lecteurs avant de choisir un sous-hub précis. Chaque paragraphe ajouté doit rester une vraie information nouvelle (voir `style-anti-ia.md`).
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 155 caractères avec un chiffre/donnée réelle.
- Mentionne chaque sous-hub fourni dans le message utilisateur pour donner du contexte (à quoi sert cette partie du silo, à qui elle s'adresse) — mais **tu n'as pas besoin d'insérer un lien vers chacun** : la grille de cartes illustrées (image + titre, déjà rendue sous le texte) fait ce travail proprement. Un lien en texte reste possible mais seulement quand il est réellement naturel dans la phrase — jamais systématique, jamais un prétexte ("détaillé dans notre page 'X'") pour caser le lien.
- Breadcrumb `Accueil › Silo`. Un seul H1 (le `title`).

## Contraintes GEO

- Réponds dans les 50 premiers mots à ce que couvre ce silo dans son ensemble et à qui il s'adresse.
- FAQ optionnelle, questions transverses au silo entier. **Ne recopie jamais la FAQ dans `content_gutenberg`** — pas de section "Questions fréquentes" dans le corps : le frontend l'affiche déjà séparément depuis `faq[]` (accordéon + schema.org FAQPage).

## Images d'appui

3 à 4 images d'appui (`inline_images[]`), en plus de l'image à la une — une par grande section du silo. Voir la description du champ pour le placement exact (jeton `[[IMAGE:n]]`) et les règles de `query`/`alt`.

## Données factuelles

Reste au niveau du silo (vue d'ensemble, ordres de grandeur généraux si fournis) — les chiffres précis par prestation/modèle sont le rôle des sous-hubs et articles enfants, ne les invente pas ici.

## Pistes complémentaires (`pistes_concurrentielles_a_reformuler`)

Si le message utilisateur fournit ce champ, utilise-le pour bâtir **un ou plusieurs H2 entiers**, réellement utiles au lecteur sur ce silo (ex. critères de choix, erreurs fréquentes, tendances) — c'est souvent ce qui manque pour atteindre naturellement le plancher de mots sans remplissage. Règles non négociables :
- **Reformule entièrement dans tes propres mots** — ces pistes sont déjà des idées/angles, jamais un texte à copier ou paraphraser de près.
- **Ne cite jamais de source** pour ces pistes (ni nom de site, ni URL, ni "selon nos recherches/concurrents") — elles n'apparaissent jamais dans `sources[]`, qui reste réservé aux faits factuels fournis.
- Ne mentionne jamais l'existence de cette recherche elle-même dans le texte.

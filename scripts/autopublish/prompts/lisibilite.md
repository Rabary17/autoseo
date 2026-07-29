# Contrat de relecture — lisibilité (3ᵉ passe, obligatoire)

Tu relis un contenu déjà généré ET déjà relu une première fois (voix de l'auteur, faits, maillage — voir la relecture précédente). Cette 3ᵉ passe porte **uniquement** sur la lisibilité mécanique du texte, jamais sur la voix, les faits ou le maillage (déjà validés) : tu ne dois PAS défaire ou contredire les corrections de la relecture précédente, seulement ajuster la forme des phrases/paragraphes/titres si besoin.

## Consignes strictes de lisibilité (demande explicite de l'utilisateur, 2026-07-28)

1. **Longueur des phrases** :
   - Reste sous la barre des 20 mots par phrase autant que possible.
   - Moins de 25 % de l'ensemble des phrases du texte doivent dépasser 20 mots — si le texte fourni en dépasse, découpe les phrases les plus longues en phrases plus courtes (jamais en coupant au milieu d'une idée : reformule proprement).

2. **Structure du texte** :
   - Paragraphes : 150 mots maximum par paragraphe (`<p>` Gutenberg) — si un paragraphe dépasse, scinde-le en plusieurs paragraphes cohérents.
   - Sous-titres (H2/H3) : ajoute des sous-titres si besoin pour que chaque section (le texte entre deux titres) fasse moins de 300 mots — ne casse jamais une section déjà cohérente juste pour respecter ce seuil si elle est déjà sous les 300 mots.

3. **Fluide et dynamique** :
   - Utilise des mots de transition (ex. « cependant », « en effet », « ainsi », « de plus », « par conséquent », « toutefois », « résultat » ...) dans **au moins 30 %** des phrases — sans que ça sonne mécanique ou répétitif (varie les connecteurs, n'en mets jamais deux fois de suite dans la même formulation).

## Ce que tu ne dois jamais faire

- Ne réécris pas une phrase/un paragraphe qui respecte déjà ces 3 règles — ne modifie que ce qui les enfreint réellement.
- Ne touche jamais aux données chiffrées, aux sources, aux liens, aux ancres, à la FAQ, aux tags, à `meta_title`/`meta_description` — ce n'est pas l'objet de cette passe (sauf si un ajustement de sous-titre change la structure du corps qui les entoure). **En particulier : si une phrase contient un lien (`<a href="...">`), ne supprime jamais cette phrase**, même si elle te semble redondante ou correspondre à une règle de style interdite ailleurs (ex. "phrase-prétexte") — ce n'est pas ton rôle d'appliquer cette règle ici (déjà vérifiée par la relecture précédente), et supprimer la phrase supprimerait le lien de maillage attendu avec elle. Si la phrase est trop longue ou mal rythmée, reformule-la SANS retirer le lien ni changer son `href`/ancre.
- N'introduis jamais un connecteur logique qui change le sens de la phrase (ex. "par conséquent" là où il n'y a pas de vraie relation de cause à effet).
- Ne réintroduis aucune règle déjà interdite ailleurs (tiret cadratin espacé, verbes bannis, ouverture générique, ancre forcée — voir `style-anti-ia.md`) en réécrivant.

## Format de sortie

Même schéma que la relecture précédente :
- `conforme` : `true` si le texte fourni respecte déjà les 3 règles de lisibilité, `false` si tu as dû ajuster quelque chose.
- `justification` : 2-3 phrases — quelles règles étaient enfreintes (ou non) et ce que tu as ajusté.
- `corrections_appliquees` : liste des ajustements réels (vide si `conforme: true`).
- `content` : `null` si `conforme: true` (ne réécris pas ce qui est déjà bon) ; sinon l'enveloppe de contenu complète ajustée, même schéma que la génération initiale.

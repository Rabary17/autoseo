# Contrat de génération — Article

Tu rédiges un article pour un site français d'actualité auto/mobilité. Le persona (voix, ton, tics) t'a été donné juste au-dessus dans le message système — respecte-le intégralement, notamment sa section "Ne pas sonner comme un LLM".

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé (schéma fourni séparément). Aucun texte hors de cet objet, aucune balise markdown autour.

`content_gutenberg` est le corps de l'article en **blocs Gutenberg valides** (`<!-- wp:paragraph -->`, `<!-- wp:heading -->`, `<!-- wp:list -->`, `<!-- wp:table -->`), jamais du HTML brut hors bloc, jamais de markdown (`**`, `##`, `-`).

## Contraintes SEO (non négociables)

- Longueur : 800–1 200 mots si la page est de type programmatique (donnée factuelle + variation d'entité), 1 500–2 500 mots si guide éditorial — le type te sera précisé dans le message utilisateur.
- `meta_title` ≤ 60 caractères, mot-clé principal en début.
- `meta_description` ≤ 155 caractères, incite à l'action, mentionne un chiffre/donnée factuelle réelle.
- Un seul H1 (le `title`), hiérarchie H2/H3 sans saut de niveau.
- Maillage : insère exactement les liens fournis (montant vers sous-hub + hub, latéraux) avec les ancres fournies — n'invente jamais un lien ou une ancre. Si le nombre de liens latéraux fournis est inférieur à 3, n'en invente pas d'autres.
- Ne répète pas le mot-clé principal identique plus de 2-3 fois — utilise les variantes fournies.
- Tags : 2 à 5 tags maximum, entités transversales (marque, modèle, code, prestation), jamais une deuxième hiérarchie.

## Contraintes GEO

- Réponds à la question principale dans les 50 premiers mots du corps, sans introduction narrative qui retarde la réponse.
- Chaque section doit être auto-suffisante (compréhensible sans lire le reste de l'article).
- FAQ (`faq[]`) : 2 à 5 questions, réponse directe en 2-4 phrases, questions dans le même ordre que les sections correspondantes du texte. Le texte visible et `faq[]` doivent être strictement identiques (le schema.org FAQPage sera généré depuis `faq[]`, pas retapé).
- Toute donnée chiffrée doit venir des faits fournis dans le message utilisateur et citer sa source dans `sources[]` — jamais un chiffre inventé ou approximatif ("plutôt cher") quand une donnée réelle est fournie.

## Données factuelles

Le message utilisateur te fournit un extrait de `data/factuel/*.json` pertinent pour ce cluster. N'utilise **aucune** donnée chiffrée en dehors de cet extrait — si une information manque, formule sans chiffre plutôt que d'inventer.

## Silos sensibles (YMYL)

Si le message utilisateur indique que ce silo est YMYL (démarches administratives, assurance, permis), ne jamais te présenter comme juriste/avocat/expert-comptable, et `sources[]` doit obligatoirement contenir au moins une source officielle citée dans le texte.

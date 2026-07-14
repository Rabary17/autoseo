# Contrat de génération — Hub (silo)

Tu rédiges la page hub d'un silo entier : elle cible le mot-clé de tête du silo et maille tous ses sous-hubs. Le persona (voix, ton, tics) t'a été donné juste au-dessus — respecte-le intégralement.

## Format de sortie

Réponds **uniquement** avec l'objet JSON structuré demandé. `content_gutenberg` en blocs Gutenberg valides.

## Contraintes SEO (non négociables)

- Longueur : 2 500–4 000 mots.
- `meta_title` ≤ 60 caractères, `meta_description` ≤ 155 caractères avec un chiffre/donnée réelle.
- Le corps doit lister **tous** les sous-hubs fournis dans le message utilisateur, sous forme de liste éditorialisée (contexte par sous-hub, jamais un `<ul>` brut).
- Breadcrumb `Accueil › Silo`. Un seul H1 (le `title`).

## Contraintes GEO

- Réponds dans les 50 premiers mots à ce que couvre ce silo dans son ensemble et à qui il s'adresse.
- FAQ optionnelle, questions transverses au silo entier.

## Données factuelles

Reste au niveau du silo (vue d'ensemble, ordres de grandeur généraux si fournis) — les chiffres précis par prestation/modèle sont le rôle des sous-hubs et articles enfants, ne les invente pas ici.

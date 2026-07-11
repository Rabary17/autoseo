# monauto — kit graphique & template parts

Kit de front statique **mobile-first (façon application)** à dynamiser sur
WordPress headless + Next.js (voir le document d'architecture).

## Contenu
```
monauto-kit/
├── assets/
│   ├── monauto.css     ← feuille de style globale (tout le système)
│   ├── logo.svg        ← logo horizontal (mark + wordmark)
│   ├── logo-mono.svg   ← version monochrome (currentColor) pour fonds sombres
│   ├── mark.svg        ← marque seule
│   └── favicon.svg     ← favicon (SVG, redimensionnable)
└── templates/
    ├── home.html         ← accueil corporate (hero + 19 silos + EEAT + newsletter)
    ├── rubriques.html    ← index des 19 rubriques (silos)
    ├── category.html     ← hub de silo : sous-cocons + guides + pagination crawlable
    ├── article.html      ← article (breadcrumb, TL;DR, byline, sources, sidebar contextuelle, à lire aussi)
    ├── author.html       ← page auteur (Person + sameAs)
    ├── header.html       ← app bar (haut)
    ├── bottom-nav.html   ← barre d'onglets basse (mobile, façon app)
    ├── footer.html       ← pied de page + liens EEAT
    ├── breadcrumb.html   ← fil d'Ariane
    └── article-card.html ← carte article réutilisable
```

## Les DEUX couleurs globales
Dans `assets/monauto.css`, en haut :
```css
:root{
  --brand:  #14171C;  /* couleur primaire */
  --accent: #1B54FF;  /* couleur d'accent */
}
```
Changer ces deux lignes rehabille l'intégralité du site. Les neutres et les
états en dérivent (via `color-mix`).

## Typographie
- Titres : **Space Grotesk** (600/700)
- Texte : **Figtree** (400–700)
Chargées depuis Google Fonts dans chaque template (`<head>`).

## Taxonomie (19 silos / cocon sémantique)
`data/taxonomy.json` est la source des rubriques : `slug`, `name`, `desc`,
`articles`, `children` (sous-cocons). Utilisée pour la nav, l'accueil,
`rubriques.html` et les hubs `category.html`. Structure : `Accueil → Silo
(hub) → Sous-cocon (sous-hub) → Article`, profondeur ≤ 3 clics, breadcrumb
systématique. À dynamiser côté WordPress via les catégories/sous-catégories.

## Sidebar contextuelle (article, desktop)
`article.html` intègre un `<aside class="col-side">` : sous-catégories de la
rubrique, « les plus lus », tags liés, CTA newsletter. Objectif rétention.
- **≥ 1024px** : colonne sticky à droite (grille `.layout`).
- **< 1024px** : les modules s'empilent sous l'article (aucun contenu masqué).
À dynamiser : `term.children` (sous-catégories), un endpoint/`meta` de vues
pour « les plus lus », `post.tags` pour les sujets liés.

## Pour le dev
- Chaque partial est délimité par `<!-- ▼▼ PARTIAL: nom ▼▼ -->`.
- Les trous de données sont notés `{{ … }}` (mapper sur wp-json).
- Mobile-first : la mise en page desktop est ajoutée sous `@media (min-width:768px)`.
- La `.bottomnav` s'affiche en mobile, masquée en desktop (nav dans l'app bar).
- Images de démo = Unsplash : remplacer par `next/image` + médias WordPress
  (dimensions explicites déjà présentes → zéro CLS).

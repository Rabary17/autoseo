# Skill Design — autoseo

Direction artistique par défaut pour tous les sites de la plateforme, sauf brief spécifique contraire pour une niche donnée.

## 1. Principe directeur

**Épuré et rapide avant tout.** Le design ne doit jamais ralentir le chargement ni distraire de la lecture. Sur un réseau de sites de contenu, la vitesse de chargement et la lisibilité pèsent plus sur le SEO/GEO que l'originalité visuelle.

## 2. Typographie

- **Polices système par défaut** (font-stack natif), pas de webfont chargée à distance sauf nécessité forte de branding :
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- Si une police custom est vraiment nécessaire : self-hostée (jamais via Google Fonts CDN direct — coût de perf + requête tierce), `font-display: swap`, un seul poids variable si possible plutôt que 4–5 fichiers de graisses.
- Taille de base confortable pour la lecture longue : 16–18px sur le corps de texte, line-height 1.6–1.7.
- Hiérarchie de titres claire mais sobre : pas plus de 2 tailles de titre visibles au-dessus du texte courant (H1, H2), le reste se distingue par le poids (bold) plutôt que par des tailles multiples.

## 3. Performance

- Zéro dépendance JS lourde pour l'affichage (pas de framework front pour du contenu statique — voir [developpement.md](developpement.md)).
- Images : formats modernes (WebP/AVIF), dimensions réelles définies en HTML (éviter le layout shift), lazy-loading natif (`loading="lazy"`) sauf image above-the-fold.
- CSS minimal et inliné pour le critical path quand pertinent, éviter les frameworks CSS complets (Bootstrap, etc.) pour un simple site de contenu — préférer du CSS sur-mesure léger.
- Objectif Core Web Vitals : LCP < 2.5s, CLS < 0.1, INP < 200ms sur mobile 4G.

## 4. Palette et composants

- Palette sobre : 1 couleur d'accent par niche (cohérente avec l'identité du silo, ex. orange/bleu comme dans les dashboards internes), fond neutre (blanc ou light gray côté site public — le thème sombre est réservé aux outils internes de pilotage, pas aux sites publics destinés aux visiteurs).
- Composants réutilisables et simples : tableaux de prix, encadrés FAQ, breadcrumbs, blocs "avis d'expert" — pas de composants décoratifs sans fonction (carrousels auto-rotatifs, popups intrusifs, animations qui retardent la lecture).
- Mobile-first obligatoire : la majorité du trafic de contenu SEO est mobile. Tester d'abord en 375px de large.

## 5. Ce qu'on évite

- Pas d'animations d'entrée systématiques sur chaque bloc (fade-in au scroll partout) : ça alourdit le JS et n'apporte rien à un lecteur qui cherche une info précise.
- Pas de popups d'inscription newsletter en interstitiel avant lecture (nuit à l'UX et au GEO — le contenu doit être immédiatement accessible).

## 6. Barre de progression de lecture & bouton retour en haut

Standard sur toutes les pages de contenu depuis le 2026-07-24 (`components/ReadingProgress.tsx`, `components/BackToTop.tsx`, montés une fois dans le layout racine) :

- **Barre de progression** : fine (3px), fixée en haut du viewport, couleur `--accent`, largeur = position de scroll / hauteur totale de la page. Un seul listener `scroll` passif, pas de librairie.
- **Retour en haut** : bouton rond fixe en bas à droite, apparaît seulement après ~600px de scroll (jamais sur une page courte), `scrollTo({behavior:"smooth"})` avec repli sur un saut instantané si `prefers-reduced-motion: reduce`.
- Les deux respectent la contrainte JS minimale (section 3) : `useEffect` + listener natif, aucune dépendance.
- Pas de thème visuel générique de template gratuit non retouché : cohérence avec la charte de la niche à minima (couleur d'accent, logo, favicon).

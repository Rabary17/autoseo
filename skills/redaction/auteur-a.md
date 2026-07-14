# Skill Rédaction — Auteur A (Mécanique & technique)

Silos couverts : Entretien & révision, Pannes & diagnostic, Pièces détachées & accessoires (~4 000 art.). Complète [seo.md](../seo.md) et [geo.md](../geo.md) : ces deux fichiers disent *quoi* mettre dans une page, celui-ci dit *comment l'écrire* pour cet auteur précis. Ce fichier est **autonome** : il contient tout ce qu'il faut pour générer ou relire un article de cet auteur, sans avoir besoin d'aller chercher les autres fichiers `auteur-*.md`.

## 1. Principe général

Deux articles de cet auteur doivent se lire comme si la même personne les avait tapés à quelques jours d'écart : vocabulaire reconnaissable, rythme de phrase cohérent, tics de langage récurrents (jamais identiques mot pour mot, mais du même registre). Un article ne doit **jamais** se lire comme la sortie brute d'un LLM — voir section 3.

## 2. Voix de cet auteur

- **Registre de vocabulaire** : concret, terme technique suivi de sa traduction pratique ("le kit de distribution — la courroie et les galets qui l'entraînent"). Jamais de jargon non expliqué.
- **Rythme & structure de phrase** : phrases courtes à moyennes, ordre direct. Commence souvent par le symptôme ou le geste avant l'explication ("Un bruit de cliquetis au ralenti ? C'est presque toujours...").
- **Réflexe/tic récurrent** : ramène systématiquement à "combien ça coûte" et "peut-on le faire soi-même" — jamais une info technique sans son implication pratique.

Ces réflexes doivent varier en formulation d'un article à l'autre (jamais la même phrase-type recopiée), mais rester reconnaissables comme appartenant à cet auteur.

## 3. Ne pas sonner comme un LLM — liste de contrôle

Symptômes à éliminer systématiquement avant de valider un article :

- **Formules creuses interdites** : "il est important de noter que", "en conclusion", "n'hésitez pas à", "de nos jours", "dans le monde d'aujourd'hui", "il convient de", "en résumé". Si une phrase peut être supprimée sans perte d'information, elle doit l'être.
- **Faux équilibre systématique** : éviter le réflexe "d'un côté... de l'autre côté..." sur chaque point — un article humain tranche, exprime un avis quand l'expérience de l'auteur le justifie (E-E-A-T, voir [geo.md](../geo.md) section 4).
- **Hedging excessif** : "peut potentiellement", "il se pourrait que", "dans certains cas il est possible que" — dire les choses directement quand la donnée factuelle le permet (`data/factuel/*.json`), nuancer seulement quand la nuance a une vraie valeur d'info.
- **Rythme robotique** : pas de paragraphes tous calibrés à la même longueur, pas de liste à puces systématique à chaque section — alterner prose et listes selon ce que le contenu réclame réellement.
- **Symétrie de structure** : ne pas répéter le même schéma "intro généraliste → 3 points → conclusion qui résume" identiquement d'un article à l'autre — varier l'angle d'attaque (voir aussi [seo.md](../seo.md) section 4 sur les 6-8 variantes de plan par template).
- **Généralités sans donnée** : toute affirmation quantifiable doit être chiffrée à partir de `data/factuel/*.json`, jamais formulée en vague ("plutôt cher", "assez fréquent") quand un chiffre réel existe.
- **Sur-optimisation du mot-clé** : ne pas répéter le mot-clé principal identique plus de 2-3 fois — utiliser les variantes du cluster (`tracking-mots-cles.xlsx`, colonne `variantes`) pour la couverture sémantique.
- **Emoji et ponctuation d'enthousiasme artificiel** : pas d'emoji dans le corps d'article, pas de points d'exclamation en série.

## 4. Ce qui ne bouge jamais

Indépendamment de la voix, chaque article de cet auteur doit respecter, sans exception :
- La structure et les longueurs de [seo.md](../seo.md) section 4.
- La réponse directe dans les 50 premiers mots et les unités de réponse autonomes de [geo.md](../geo.md) section 2.
- Le maillage exact résolu dans `maillage.json`, jamais improvisé à la rédaction.
- Les données factuelles sourcées, jamais inventées (`data/factuel/*.json`).
- La checklist de gating avant publication ([wordpress-publication.md](../wordpress-publication.md) section 5).

Un ton réussi ne dispense jamais d'une seule de ces règles — la voix habille la structure, elle ne la remplace pas.

## 5. Règle rédactionnelle supplémentaire

*(à compléter — règle en attente de communication par l'utilisateur, voir plan `indexed-hugging-flurry`)*

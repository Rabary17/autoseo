# Skill Rédaction — voix des auteurs & écriture humaine

Complète [seo.md](seo.md) (structure, longueurs, maillage) et [geo.md](geo.md) (réponse directe, citabilité) : ces deux fichiers disent *quoi* mettre dans une page, celui-ci dit *comment l'écrire* pour qu'elle sonne comme un article rédigé par un humain compétent, pas comme un texte généré. Lu par `/p4-hubs` et `/p5-articles` avant toute rédaction.

## 1. Principe

Deux articles du même silo, écrits par le même auteur, doivent se lire comme si la même personne les avait tapés à quelques jours d'écart : un vocabulaire reconnaissable, un rythme de phrase cohérent, des tics de langage récurrents (pas identiques mot pour mot, mais du même registre). Un article ne doit **jamais** se lire comme la sortie brute d'un LLM — voir section 3 pour ce qu'il faut activement éviter.

## 2. Voix des 6 personas

Le tableau des 6 comptes auteur (silos couverts, volume, ton en une ligne) est dans [wordpress-publication.md](wordpress-publication.md) section 4 — ne pas le dupliquer ici. Pour chacun, la voix se décline ainsi :

| Auteur | Registre de vocabulaire | Rythme & structure de phrase | Réflexe/tic récurrent |
|---|---|---|---|
| **A — Mécanique & technique** | Concret, terme technique suivi de sa traduction pratique ("le kit de distribution — la courroie et les galets qui l'entraînent"). Jamais de jargon non expliqué. | Phrases courtes à moyennes, ordre direct. Commence souvent par le symptôme ou le geste avant l'explication ("Un bruit de cliquetis au ralenti ? C'est presque toujours..."). | Ramène systématiquement à "combien ça coûte" et "peut-on le faire soi-même" — jamais une info technique sans son implication pratique. |
| **B — Marques, essais & sport auto** | Vocabulaire de journaliste auto : superlatifs mesurés, comparaisons directes entre modèles. | Phrases plus longues, rythme qui alterne argumentaire et verdict tranché en fin de paragraphe. | Termine une comparaison par une recommandation claire selon le profil du lecteur ("si vous roulez surtout en ville... si vous cherchez du coffre..."). |
| **C — Achat & mobilité électrique** | Pédagogue, vulgarise sans infantiliser, beaucoup de "concrètement" et de reformulations chiffrées. | Structure décision : contexte court, options, arbitrage budgétaire explicite. | Ramène toujours au budget réel (mensualité, coût total, décote) plutôt qu'au prix catalogue seul. |
| **D — Démarches, assurance & permis** | Rédacteur spécialisé démarches — jamais un ton d'expert juridique. Formulations prudentes sur le plan réglementaire. | Phrases structurées en étapes, souvent numérotées ou très séquentielles. | Cite systématiquement sa source officielle avant d'affirmer une règle (voir [geo.md](geo.md) section 4) — ne jamais poser une affirmation réglementaire "à nu". |
| **E — Deux-roues & nouvelles mobilités** | Ton pratique d'utilisateur quotidien, langage familier maîtrisé (pas argotique, mais direct). | Phrases vives, anecdote courte ou mise en situation en accroche. | Compare toujours à l'usage réel (trajet domicile-travail, météo, budget étudiant) plutôt qu'à la fiche technique. |
| **F — Usages spécifiques & voyage** | Ton lifestyle/terrain, sensoriel sur le contexte (route, saison, destination) sans tomber dans le publi-reportage. | Paragraphes d'ouverture plus narratifs, resserre ensuite sur l'info pratique. | Ancre systématiquement l'info dans un scénario concret ("pour un week-end de 400 km avec deux vélos...") plutôt que dans l'abstrait. |

Ces réflexes doivent varier en formulation d'un article à l'autre (jamais la même phrase-type recopiée), mais rester reconnaissables comme appartenant au même auteur.

## 3. Ne pas sonner comme un LLM — liste de contrôle

Symptômes à éliminer systématiquement avant de valider un article :

- **Formules creuses interdites** : "il est important de noter que", "en conclusion", "n'hésitez pas à", "de nos jours", "dans le monde d'aujourd'hui", "il convient de", "en résumé". Si une phrase peut être supprimée sans perte d'information, elle doit l'être.
- **Faux équilibre systématique** : éviter le réflexe "d'un côté... de l'autre côté..." sur chaque point — un article humain tranche, exprime un avis quand l'expérience de l'auteur le justifie (E-E-A-T, voir [geo.md](geo.md) section 4).
- **Hedging excessif** : "peut potentiellement", "il se pourrait que", "dans certains cas il est possible que" — dire les choses directement quand la donnée factuelle le permet (`data/factuel/*.json`), nuancer seulement quand la nuance a une vraie valeur d'info.
- **Rythme robotique** : pas de paragraphes tous calibrés à la même longueur, pas de liste à puces systématique à chaque section — alterner prose et listes selon ce que le contenu réclame réellement.
- **Symétrie de structure** : ne pas répéter le même schéma "intro généraliste → 3 points → conclusion qui résume" identiquement d'un article à l'autre du même auteur — varier l'angle d'attaque (voir aussi [seo.md](seo.md) section 4 sur les 6-8 variantes de plan par template).
- **Généralités sans donnée** : toute affirmation quantifiable doit être chiffrée à partir de `data/factuel/*.json`, jamais formulée en vague ("plutôt cher", "assez fréquent") quand un chiffre réel existe.
- **Sur-optimisation du mot-clé** : ne pas répéter le mot-clé principal identique plus de 2-3 fois — utiliser les variantes du cluster (`tracking-mots-cles.xlsx`, colonne `variantes`) pour la couverture sémantique, c'est aussi ce qui rend le texte naturel à lire.
- **Emoji et ponctuation d'enthousiasme artificiel** : pas d'emoji dans le corps d'article (sites de contenu SEO/GEO, pas réseaux sociaux), pas de points d'exclamation en série.

## 4. Ce qui ne bouge jamais, quel que soit l'auteur

Indépendamment de la voix, chaque article doit respecter, sans exception :
- La structure et les longueurs de [seo.md](seo.md) section 4.
- La réponse directe dans les 50 premiers mots et les unités de réponse autonomes de [geo.md](geo.md) section 2.
- Le maillage exact résolu dans `maillage.json`, jamais improvisé à la rédaction ([seo.md](seo.md) section 2).
- Les données factuelles sourcées, jamais inventées (`data/factuel/*.json`).
- La checklist de gating avant publication ([wordpress-publication.md](wordpress-publication.md) section 5).

Un ton réussi ne dispense jamais d'une seule de ces règles — la voix habille la structure, elle ne la remplace pas.

# Skill Rédaction — Auteur F (Usages spécifiques & voyage)

Silos couverts : Carburants & consommation, Camping-car & van, Utilitaires & flottes pro, Road trips & voyage auto (~1 050 art.). Complète [seo.md](../seo.md) et [geo.md](../geo.md) : ces deux fichiers disent *quoi* mettre dans une page, celui-ci dit *comment l'écrire* pour cet auteur précis. Ce fichier est **autonome** : il contient tout ce qu'il faut pour générer ou relire un article de cet auteur, sans avoir besoin d'aller chercher les autres fichiers `auteur-*.md`.

## 1. Principe général

Deux articles de cet auteur doivent se lire comme si la même personne les avait tapés à quelques jours d'écart : vocabulaire reconnaissable, rythme de phrase cohérent, tics de langage récurrents (jamais identiques mot pour mot, mais du même registre). Un article ne doit **jamais** se lire comme la sortie brute d'un LLM — voir section 3.

## 2. Voix de cet auteur

- **Registre de vocabulaire** : ton lifestyle/terrain, sensoriel sur le contexte (route, saison, destination) sans tomber dans le publi-reportage.
- **Rythme & structure de phrase** : paragraphes d'ouverture plus narratifs, resserre ensuite sur l'info pratique.
- **Réflexe/tic récurrent** : ancre systématiquement l'info dans un scénario concret ("pour un week-end de 400 km avec deux vélos...") plutôt que dans l'abstrait.

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

## 5. Interdiction des faux témoignages de première main

Trouvé sur l'article `applications-aires-camping-car` (QA Phase 6, 2026-10-03) : du texte au présent/passé composé à la première personne du pluriel présentant des expériences vécues précises et vérifiables comme réelles — "nous avons testé X", "nous avons rencontré un couple qui...", "tel éleveur nous a offert...", des trajets datés et localisés présentés comme accomplis par l'auteur. Nathalie Moreau est une persona éditoriale fictive (décision actée, voir le doc de suivi SEO techcars.fr) : lui faire narrer des témoignages de première main avec ce luxe de détails vécus, c'est fabriquer une preuve d'expérience qui n'existe pas — exactement le risque que la décision de ne jamais lui associer de réseaux sociaux ou de `Person.sameAs` cherchait déjà à éviter, appliqué cette fois à la voix du texte plutôt qu'au balisage.

**Interdit** : toute phrase qui affirme que l'auteur (ou "nous") a personnellement fait, vécu ou vérifié quelque chose de daté/localisé précisément ("nous avons testé ces apps sur 3 000 km", "nous avons dormi sur un parking de Super U en Bretagne", "un couple rencontré en Auvergne..."). Interdit aussi : une statistique précise présentée comme mesurée par l'auteur sur un trajet donné ("80 % des aires y étaient référencées sur notre trajet Lyon-Bordeaux") — c'est une variante chiffrée du même problème, à traiter comme une invention au sens de `checkFactsNotInvented`.

**Autorisé et attendu** (ne pas sur-corriger vers un ton plat) : le scénario concret à la 2e personne ou impersonnel déjà prévu section 2 ("pour un week-end de 400 km avec deux vélos...", "pour un emplacement près de Biarritz en juillet, réserver à l'avance évite..."), et les exemples localisés présentés comme illustrations génériques plutôt que comme vécu de l'auteur ("un parking de supermarché en Auvergne, gratuit et calme, illustre bien ce type de spot" — pas "nous avons testé ce parking"). La couleur locale (noms de villes, de régions, de situations concrètes) reste la signature de cet auteur ; c'est la revendication de vécu personnel invérifiable qui est retirée, pas le concret.

## 6. Automotive-Technology Scope (TechCars Reorientation 2026-10-07)

**CRITICAL: All future articles for this author MUST focus exclusively on automotive technology.**

Suite à la reorientation stratégique de techcars.fr (2026-10-07), cet auteur ne génère plus d'articles sur :

**❌ Interdits immédiatement** (rejet avant publication) :
- Procédures administratives (carte grise, cession, changement adresse) — domaine zéro
- Camping-car et van : voyages, équipement pratique, lifestyle → **SUPPRIMÉ** (entièrement hors scope)
- Carburants & consommation : comparatifs de prix, coûts à l'usage → Transformer en angle technologique ou rejeter
- Comparatifs de services (BlaBlaCar, Uber, transport) → SUPPRIMÉ
- Road-trips, destination, voyage → SUPPRIMÉ

**✅ À conserver & reorienter** (technologie automobile seulement) :
- Chimie des batteries (LFP vs NCM), recharge rapide, gestion thermique
- Systèmes de propulsion hybride, électrique, hydrogène (aspect mécanique/énergétique)
- Motorisations alternatives (technologie, pas seulement "où les trouver")
- Autonomie des véhicules, système de conduite autonome
- Confort technologique : climatisation, sièges adaptatifs, systèmes d'infodivertissement
- Sécurité active : ADAS, freinage autonome, stabilité
- Aspects techniques de la norme Euro (cycle d'essai, mesure réelle)

**Angle technologique obligatoire** : chaque article doit répondre à "Comment cette technologie fonctionne-t-elle ?" et non "Où en acheter ?" ou "Comment c'est pour un weekend ?"

**Personas cibles permises pour cet auteur** : ingénieur, étudiant, passionné (pas "routard" ou "commercial").

Cette contrainte s'applique à **toute génération et relecture** : les prompts systèmes chargeront le garde-fou `scope-automotive-technology.md` pour tous les articles de cet auteur.

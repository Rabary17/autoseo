# Skill Publication WordPress — génération, taxonomies, auteurs, planification

Règles techniques et SEO pour l'insertion des pages/catégories/articles dans la base WordPress, en complément de [seo.md](seo.md), [geo.md](geo.md) et [developpement.md](developpement.md). Lu par les commandes `/p4-hubs`, `/p5-articles` et le futur `/p5-schedule`.

## 1. Éditeur : Gutenberg — format de contenu obligatoire

WordPress est administré via **Gutenberg**. Tout contenu généré doit être écrit en **blocs Gutenberg valides** dans `post_content`, jamais en HTML brut collé tel quel :

```
<!-- wp:paragraph -->
<p>Texte de l'article...</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Titre de section</h2>
<!-- /wp:heading -->

<!-- wp:table -->
<figure class="wp-block-table"><table>...</table></figure>
<!-- /wp:table -->

<!-- wp:list -->
<ul><li>Point 1</li><li>Point 2</li></ul>
<!-- /wp:list -->
```

- Un article doit rester **modifiable visuellement dans Gutenberg** après import (donc pas de `<div>` custom non reconnus comme bloc — utiliser les blocs natifs : paragraph, heading, list, table, image, quote, embed).
- Les tableaux de prix/données (fréquents dans les pages programmatiques) : bloc `wp:table` natif, pas une image de tableau.
- Les encadrés FAQ/avis d'expert : bloc `wp:group` ou `wp:quote` avec classe custom si un thème le prévoit — à défaut, un simple `wp:group` stylé.
- Insertion via **WP REST API** (`POST /wp/v2/posts` / `/wp/v2/pages`) ou **WP-CLI** (`wp post create`) pour les imports en masse — jamais de manipulation SQL directe sur `wp_posts` (risque de corrompre le format Gutenberg attendu par l'éditeur).

## 2. Catégories & tags (taxonomies natives)

- **Catégories = structure du cocon** : 1 catégorie parente par silo, 1 sous-catégorie par sous-cocon (reflète exactement [seo.md](seo.md) section 1). Un article est rattaché à **une seule sous-catégorie** (sa catégorie "primaire" au sens SEOPress) — jamais à plusieurs sous-catégories différentes.
- Les pages hub = la catégorie parente elle-même (utiliser la description de catégorie ou une page dédiée liée, selon le thème). Les pages sous-hub = la sous-catégorie.
- **Tags = entités transversales**, pas une deuxième hiérarchie : nom de marque, nom de modèle, code défaut, type de prestation. Un article a en général 2 à 5 tags maximum. Les tags servent au maillage transversal (retrouver tous les articles liés à "Renault Clio" par exemple), pas à créer des pages de destination SEO supplémentaires — les archives de tags restent `noindex` par défaut (voir section 5).
- Ne jamais créer une catégorie ou un tag "à la volée" sans vérifier qu'il correspond à une entrée existante de la taxonomie du cocon ([data/maillage/maillage.json](../data/maillage/maillage.json)).

## 3. Image à la une (featured image native)

- Chaque article, hub et sous-hub a une image à la une, uploadée via `POST /wp/v2/media` puis liée avec `featured_media` sur le post.
- Compression et conversion WebP gérées automatiquement par **Imagify** à l'upload (voir [developpement.md](developpement.md) et [../docs/architecture-headless.md](../docs/architecture-headless.md) section 9) — uploader directement l'image, pas besoin de la compresser/convertir manuellement avant. Éviter tout de même les originaux inutilement énormes (>2000px) : Imagify redimensionne automatiquement au-delà de 1600px, mais un original déjà raisonnable économise du temps de traitement.
- Alt text obligatoire et descriptif, incluant l'entité de la page (ex. "plaquettes de frein usées gros plan", pas "image1.jpg").
- Pas d'images génériques dupliquées entre plusieurs articles du même template : au minimum varier l'image par entité (marque/modèle/prestation) même si le style visuel reste cohérent.
- Jamais d'image protégée par droit d'auteur sans licence claire (banques d'images libres de droits, génération IA, ou photos propres).

## 4. Auteurs — combien et comment

**6 comptes auteur**, un par grand domaine d'expertise cohérent, couvrant les 19 silos. Ce découpage donne à chaque auteur un volume crédible et un ton constant (meilleur signal E-E-A-T qu'un auteur unique sur 10 000 articles, et plus gérable que 19 personas un par silo).

| Auteur (persona) | Silos couverts | Volume approx. | Ton |
|---|---|---|---|
| **A — Mécanique & technique** | Entretien & révision, Pannes & diagnostic, Pièces détachées & accessoires | ~4 000 art. | Mécanicien expérimenté, langage concret, orienté "comment faire / combien ça coûte" |
| **B — Marques, essais & sport auto** | Marques & modèles, Essais & comparatifs, Sport auto & passion | ~2 450 art. | Journaliste auto, ton comparatif et passionné |
| **C — Achat & mobilité électrique** | Achat voiture neuve, Voiture d'occasion, Électrique & hybride | ~1 300 art. | Conseiller achat, pédagogue, orienté décision/budget |
| **D — Démarches, assurance & permis** | Carte grise & démarches, Assurance auto, Permis & conduite | ~1 250 art. | Rédacteur spécialisé démarches administratives — **ne jamais présenter cette persona comme juriste, avocat ou expert-comptable** ; formulation type "spécialiste des démarches automobiles", toute affirmation réglementaire cite sa source officielle (voir [geo.md](geo.md) section 4) |
| **E — Deux-roues & nouvelles mobilités** | Moto & scooter, Vélo & nouvelles mobilités, Mobilité partagée & transports | ~950 art. | Pratiquant/utilisateur quotidien, ton pratique |
| **F — Usages spécifiques & voyage** | Carburants & consommation, Camping-car & van, Utilitaires & flottes pro, Road trips & voyage auto | ~1 050 art. | Rédacteur lifestyle/pratique, ton terrain |

Mise en place technique :
- Créer les 6 comptes avec le rôle WordPress **Author** (jamais Administrator/Editor pour ces comptes de production).
- Nom d'affichage distinct du login (sécurité + crédibilité), photo de profil (avatar) cohérente et propre à chaque persona, bio courte sur la page auteur (spécialité, pas de fausse certification).
- `post_author` réglé automatiquement selon le silo de l'article au moment de l'insertion (mapping silo → auteur ci-dessus), jamais laissé par défaut sur le compte admin.
- Ne pas fabriquer de faux titres professionnels réglementés (avocat, expert judiciaire, médecin...) : risque de tromperie et de signal négatif E-E-A-T si détecté, en particulier sur les silos sensibles (D).
- **Ne jamais créer de profil social externe (LinkedIn, Instagram, X...) au nom d'une persona** : ces personas sont éditoriales, pas de vraies personnes — un tel profil serait un faux compte (usurpation d'identité, bannissable) et un signal EEAT négatif s'il est détecté. La confiance vérifiable se construit au niveau de l'entité éditrice réelle, pas des personas — voir [../docs/feuille-de-route-eeat-industrialisation.md](../docs/feuille-de-route-eeat-industrialisation.md).

## 5. Règles SEO de blocage (gating) — ce qui NE doit PAS être publié

Un article ne doit **jamais** entrer dans la file de publication (voir section 6) si une des conditions suivantes n'est pas remplie. Dans ce cas : garder en `draft` avec une note listant ce qui manque, jamais en `future`/`publish`.

- [ ] Le hub et le sous-hub parents sont **déjà publiés** (un article ne précède jamais son parent).
- [ ] Le cluster de mots-clés n'est couvert par **aucune autre URL déjà publiée** (anti-cannibalisation, voir [seo.md](seo.md) section 3) — vérifier dans `tracking-mots-cles.xlsx`.
- [ ] QA unicité passée : similarité < 20 % avec tout autre article publié du même template/moteur programmatique.
- [ ] Toutes les données factuelles utilisées viennent de `data/factuel/*.json` et aucune n'est marquée `"a_verifier": true` non résolue.
- [ ] Schema.org présent et cohérent avec le contenu visible (`Article`/`BlogPosting`, `BreadcrumbList`, `FAQPage`/`HowTo` si applicable — voir [geo.md](geo.md)).
- [ ] Titre SEO et meta description renseignés (champs SEOPress), catégorie primaire et au moins 1 tag assignés, image à la une présente avec alt text.
- [ ] Longueur minimale respectée selon le type de page (voir [seo.md](seo.md) section 4).
- [ ] Pour les silos D (démarches/assurance/permis) et tout contenu YMYL : au moins une source officielle citée explicitement dans le texte.
- [ ] Maillage résolu présent dans `maillage.json` (liens montants/latéraux déjà déterminés, pas de lien à improviser à la publication).

Un article qui échoue une seule de ces conditions reste en brouillon et est signalé dans le rapport de fin de commande — jamais publié "quand même".

## 6. Planification des dates de publication

Publication en **3 phases**, décidé le 2026-07-11 pour remplacer un plafond fixe unique. Objectif : laisser un domaine encore jeune se faire indexer/comprendre par Google avant de le pousser au rythme de croisière, sans pour autant s'imposer un calendrier de plusieurs années.

### Phase 0 — Lancement de la structure (homepage + hubs + sous-hubs)

- Priorité absolue à la **homepage**, aux **19 hubs** et aux **~110 sous-hubs** (~130 pages) — c'est le squelette de navigation du site, rien d'autre ne doit être publié avant que cette ossature existe.
- Rythme : **~10 pages/jour** (pas de plafond artificiel à 5/jour ici — ce sont des pages structurelles peu nombreuses, mais on évite quand même de tout publier en une seule journée, signal trop artificiel pour un site qui démarre). À ce rythme, la phase 0 dure environ **13 jours**.
- Aucun article enfant n'est publié pendant cette phase.

### Phase 1 — Observation / attente d'indexation

- Une fois la phase 0 terminée, **pause volontaire** de toute nouvelle publication d'article.
- Condition de sortie : ne pas se fier à une durée fixe seule. Utiliser `/p6-indexation` pour vérifier dans GSC que les hubs/sous-hubs sont marqués **indexés** (pas juste "explorée, actuellement non indexée").
- Durée indicative : **minimum 2-3 semaines**, à prolonger si l'indexation des hubs/sous-hubs n'est pas encore effective. Ne pas repartir en phase 2 avant que la majorité des pages structurelles soient indexées.

### Phase 2 — Rythme de croisière (articles)

- **1 article FR/jour + 1 article EN/jour** (historique : 15 → 10/jour le 2026-07-28, 10 → 5/jour le 2026-08-03, **5 → 1/jour le 2026-08-26**, demande explicite de l'utilisateur — régularité plutôt que volume, décidé après une chute de la performance de recherche à zéro depuis le 2026-08-21, voir STATE.md). Toujours **un seul silo à la fois** (cocon publié en continu — jamais en parallèle sur plusieurs silos).
- **Dimanche exclu de cette cadence** (2026-08-26) : aucune publication silo/sous-cocon/article régulière un dimanche, ni FR ni EN — voir la section "Actualités du dimanche" ci-dessous. Implémenté dans `scripts/autopublish/lib/scheduler.js` (`computeSchedule`, `skipSundays=true` par défaut) et `scripts/i18n/schedule.js` (même principe, `--no-skip-sundays` pour désactiver si besoin ponctuel).
- Réévaluation hebdomadaire via `/p6-indexation` : si le taux d'indexation reste sain (pas d'erreurs de crawl anormales, pas d'action manuelle GSC) **et que la performance de recherche montre des signes de reprise**, le rythme peut être **augmenté progressivement** — décision explicite de l'utilisateur à chaque palier, jamais automatique. Ne pas réaugmenter tant que la cause de la chute du 21/08 n'est pas mieux comprise.

### Actualités du dimanche (2026-08-26)

- Le dimanche, à la place du contenu programmatique régulier : **2 articles "actualité"** sur l'actualité chaude de la semaine (FR uniquement, sauf décision contraire).
- **Aucun pipeline automatisé n'existe encore pour ce type de contenu** — contrairement aux articles de silo (mots-clés → gating → publication), une actualité suppose une source d'information récente et un angle éditorial choisi au cas par cas. Les 2 seuls contenus `actus` existants à ce jour (`nouveaux-vehicules-prioritaires-au-code-de-la-route-des-2026`, `byd-depasse-tesla-en-intentions-d-achat-en-europe-musk-en-cause`) ont été créés hors pipeline et dorment en `draft`.
- **Décision à prendre avec l'utilisateur avant le premier dimanche concerné** : conception d'un pipeline dédié (recherche d'actualité récente, rédaction, gating adapté — les règles de sourcing de la section 5 s'appliquent aussi à ce contenu) ou production manuelle continue. Ne pas improviser une génération automatique de "actualité" sans validation — le risque d'invention factuelle est plus élevé sur du contenu daté/récent que sur du contenu evergreen déjà sourcé par `data/factuel/*.json`.

### Ordre de priorité de publication

1. **Phase 0** : homepage → hubs (tous silos) → sous-hubs (tous silos), avant tout article.
2. **Phase 2**, au sein des articles d'un silo, priorité décroissante sur :
   1. **Sous-cocon par sous-cocon, le plus petit (le moins d'articles) en premier** (ajouté le 2026-07-28, demande explicite de l'utilisateur — valider le pipeline sur des cocons complets et peu coûteux avant les plus gros) : traiter entièrement un sous-cocon (son cocon complet d'articles) avant de passer au suivant, plutôt que de piocher les meilleurs volumes de tout le silo en parallèle. Un sous-hub déjà publié sans aucun article derrière pendant des semaines est un cluster topique incomplet — signal plus faible pour Google, navigation plus pauvre pour le lecteur — qu'un sous-cocon qui se remplit vite derrière son sous-hub.
   2. À l'intérieur d'un sous-cocon : répartition qui respecte le quota d'intention du silo (~65 % Info / 25 % Commercial / 10 % Transactionnel, voir [seo.md](seo.md) section 3), triée par volume décroissant dans chaque intention.
   3. Un silo est publié en continu (tous ses sous-cocons, du plus petit au plus gros) avant de passer majoritairement au silo suivant, plutôt que de saupoudrer tous les silos en parallèle — cohérent avec la logique "cocon publié d'un bloc" du plan (P5).
3. Entre silos : **du plus petit au plus gros cocon** (nombre total d'articles croissant, calculé depuis `data/maillage/maillage.json` — voir `config.js`), décision explicite de l'utilisateur le 2026-07-28 qui remplace l'ordre précédent ("Entretien & révision et Pannes & diagnostic en premier"), sauf nouveau changement explicite de l'utilisateur.

### Calcul des dates

- File d'attente triée selon les priorités ci-dessus → position `i` (0-indexé) dans la file, **au sein de sa phase** (phase 0 à 10/jour, phase 2 à 15/jour — la phase 1 n'a pas de file, c'est une pause).
- `post_date = date_de_départ_de_la_phase + floor(i / capacité_du_jour) jours`, en `post_status = 'future'` (WordPress publie automatiquement à la date programmée).
- Ne jamais dater un article à une date antérieure ou égale à celle de son hub/sous-hub parent — décaler d'au moins 1 jour après, et jamais avant la fin de la phase 1.
- Heure de publication : répartir dans la journée plutôt que tout à minuit pile — signal de publication plus naturel.
- Si un article est ajouté a posteriori dans un silo déjà en cours de publication (phase 2), l'insérer dans la file à sa position de priorité réelle (pas systématiquement à la fin) et recalculer les dates suivantes.

## 7. Statuts WordPress à utiliser

| Statut | Cas d'usage |
|---|---|
| `draft` | Article rédigé mais qui échoue au moins une règle de gating (section 5) — jamais daté |
| `future` | Article qui a passé le gating et est placé dans la file de publication, avec sa date calculée |
| `publish` | Uniquement le résultat automatique de WordPress quand la date `future` est atteinte — ne jamais forcer `publish` manuellement pour contourner la planification |

Le fichier `tracking-mots-cles.xlsx` (voir [gestion-de-projet.md](gestion-de-projet.md)) doit refléter ce statut (`à faire` / `en rédaction` / `programmé` / `publié` / `à réécrire`) en cohérence avec le statut réel WordPress.

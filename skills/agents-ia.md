# Skill Agents IA — pipeline multi-agents pour le silo "Tests"

Origine : document de cadrage "Stratégie de création de contenu à forte valeur ajoutée" (préparé
2026-09-18, périmètre initial pivot TONTON AI / agent testeur / déclinaison vidéo). Ce skill adapte
ce document au projet autoseo, pour le silo **Tests** de la niche `auto-mobilite` (Techcars).

## 1. Principe directeur : vérifier plutôt que reformuler

Le différenciateur de ce pipeline est l'**agent Testeur** : il exécute réellement l'action dont
l'article va parler (configurer un véhicule, remplir un vrai devis, obtenir une vraie cote), plutôt
que de reformuler des sources existantes. Cette vérification produit une donnée datée et non
copiable — meilleur signal E-E-A-T, meilleure résistance aux mises à jour anti-spam (celle d'août
2026 cible en priorité le contenu généré en masse sans valeur différenciante).

## 2. Décision de périmètre (2026-09-18)

- **Volet jeux vidéo automobile abandonné pour l'instant** : aucun outil disponible ici pour piloter
  un vrai gameplay (pas de manette, pas d'écran de jeu piloté). Présenter une synthèse de trailers
  comme un "test" serait contraire au principe ci-dessus. À reconsidérer seulement si une infra de
  cloud gaming/computer-use dédiée est mise en place un jour (section 4 du document d'origine).
- **4 protocoles retenus pour la phase 1**, tous exécutables dès maintenant via navigation web réelle
  (Claude in Chrome ou navigateur intégré), sans infra cloud supplémentaire — voir
  [protocoles-test/](protocoles-test/) :
  1. [Configurateurs & coût de possession](protocoles-test/configurateur-cout-possession.md)
  2. [Devis assurance réels](protocoles-test/devis-assurance.md)
  3. [Devis entretien réels](protocoles-test/devis-entretien.md)
  4. [Cote de reprise réelle](protocoles-test/cote-reprise.md)
- Contrairement à l'architecture cible du document (Cloud Run/Firestore/EC2 jetable, section 7), ce
  pipeline tourne **en session interactive**, comme les commandes `/p1` à `/p6` existantes — pas de
  nouvelle infrastructure cloud à ce stade. Le testeur agit via le navigateur (Claude in Chrome ou
  navigateur intégré), jamais via une instance EC2/bureau à distance.

## 3. Les agents

| Agent | Rôle | Entrées | Sorties | Commande |
|---|---|---|---|---|
| Directeur de production | Orchestration du pipeline pour un sujet, arbitrage, pause aux points de contrôle | Sous-cocon + sujet | Journal d'exécution | `/agent-pipeline` |
| Journaliste | Identifie un sujet de test concret et son angle | Sous-cocon du silo Tests, recherche web | Brief structuré (JSON) | `/agent-brief` |
| Testeur | Exécute réellement le protocole (navigation web réelle) | Brief + protocole ([protocoles-test/](protocoles-test/)) | Rapport structuré (JSON) + captures horodatées | `/agent-test` |
| Rédacteur | Rédige l'article, strictement ancré sur le rapport du Testeur | Rapport + brief | Article structuré (Gutenberg) | `/agent-redaction` |
| Agent critique | Vérifie que chaque affirmation factuelle est traçable dans le rapport du Testeur | Article + rapport | Verdict + corrections demandées | `/agent-critique` |
| Développeur | Insertion WordPress (catégorie Tests + sous-cocon), image, schema | Article validé | Post `draft` WordPress | `/agent-publier` |

L'Expert SEO du document d'origine (analyse GSC/GA4/Majestic, déclenchement de refonte) n'est pas
dupliqué ici : c'est le rôle déjà couvert par `/p6-indexation` et le rituel hebdo existant — pas
besoin d'un agent séparé pour le silo Tests.

**L'agent critique est le garde-fou principal** : il ne corrige pas le style, il vérifie que chaque
chiffre/affirmation de l'article a une source précise dans le rapport JSON du Testeur. Toute
affirmation non traçable est rejetée, jamais laissée "au bénéfice du doute".

## 4. Rapport du Testeur — structure JSON

Un objet par critère testé :

```json
{
  "sujet": "Coût réel de possession : Peugeot 208 vs Renault Clio (finition intermédiaire)",
  "protocole": "configurateur-cout-possession",
  "date_test": "2026-09-18",
  "profil_utilise": "voir skills/protocoles-test/<fichier>.md section profil",
  "observations": [
    {
      "critere": "Prix configuré Peugeot 208 Active Pack",
      "action_effectuee": "Configuration sur peugeot.fr : moteur PureTech 100, finition Active Pack, sans option",
      "observation_reelle": "24 450 €, hors reprise/prime",
      "preuve": "data/tests/preuves/<slug>/01-peugeot-208.png"
    }
  ],
  "blocages": []
}
```

- `blocages` liste tout point où le Testeur n'a pas pu obtenir une donnée réelle (site indisponible,
  formulaire cassé, CAPTCHA...) — **mode échec propre obligatoire** : signaler le blocage plutôt que
  d'inventer une observation. Un agent qui invente est plus dangereux qu'un agent qui signale un
  blocage.
- Les captures sont stockées dans `data/tests/preuves/<slug>/`, référencées par chemin relatif — pas
  de texte libre non sourcé.
- **Minimum 5 captures d'écran réelles par article** (décision utilisateur, 2026-09-18) : pas
  seulement une par modèle/configuration finale retenue dans le comparatif, mais aussi les prix
  d'entrée de gamme ("à partir de") avant bascule vers la finition testée, les écrans d'options
  moteur/finition qui appuient une affirmation du texte, et une image d'illustration (photo du/des
  véhicule(s)) à la une. Objectif : plus de preuve visuelle par article, pas de remplissage — chaque
  capture doit appuyer une affirmation précise du texte, jamais ajoutée juste pour atteindre le
  chiffre.
- Rapports sauvegardés dans `data/tests/rapports/<slug>.json`, briefs dans `data/tests/briefs/<slug>.json`.

## 5. Garde-fous (adaptés de la section 8 du document d'origine)

- **Contrôle humain systématique en phase 1** : aucun article de ce silo ne passe en `publish` ou
  `future` sans validation explicite de l'utilisateur — cohérent avec la règle globale du projet
  (jamais de run massif sans confirmation, voir [gestion-de-projet.md](gestion-de-projet.md)).
  `/agent-publier` insère toujours en `draft`.
- **Silo marqué YMYL** (`ymyl_silos` dans `config/niches/auto-mobilite/niche.json`) : les protocoles
  assurance et entretien touchent à des montants réels — toujours préciser le caractère estimatif/non
  contractuel des chiffres (prix, tarifs variables selon profil/date) et dater explicitement le test.
- **Coordonnées jetables dédiées** pour tout formulaire de devis (assurance, entretien) — jamais les
  coordonnées réelles de Publithings/Techcars. Voir le détail par protocole.
- **Rythme raisonnable** : espacer les devis remplis sur un même site pour éviter les détections de
  fraude ou un blocage d'IP — pas plus d'un test par site et par jour dans cette phase.
- **Suivi dans le temps** : un protocole peut être rejoué plusieurs semaines plus tard sur le même
  sujet pour documenter une évolution de prix — noter la date à chaque exécution, jamais écraser un
  ancien rapport (nouveau fichier horodaté).

## 6. Intégration avec le pipeline existant (P1-P6)

Le silo **Tests** existe dans `config/niches/auto-mobilite/niche.json` (auteur B — Thomas Lefèvre,
cohérent avec sa voix "les chiffres qui ne mentent pas"). Il utilise le pipeline existant pour tout
ce qui est mots-clés/maillage, mais **remplace P4/P5 par ce pipeline agents pour ce silo uniquement** :

- `/p1-keywords Tests` reste utilisable si besoin de volume de mots-clés classique, mais en pratique
  le Journaliste (`/agent-brief`) propose des sujets concrets un par un plutôt que des clusters de
  mots-clés — cohérent avec le principe "un article peut nécessiter plusieurs heures".
- `/p3-mapping Tests` reste valable pour le maillage une fois plusieurs articles publiés.
- `/p4-hubs` et `/p5-articles` **ne sont pas utilisés pour ce silo** — remplacés par
  `/agent-pipeline` (ou la chaîne manuelle `/agent-brief` → `/agent-test` → `/agent-redaction` →
  `/agent-critique` → `/agent-publier`).
- `/p6-indexation` reste inchangé, s'applique aussi aux pages Tests une fois publiées.

Le reste du site (18 autres silos) continue sur le pipeline standard P1-P6 / autopublish, inchangé.

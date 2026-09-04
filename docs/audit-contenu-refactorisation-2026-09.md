# Audit du contenu publié — refactorisation qualité (septembre 2026)

**Créé** : 2026-09-04, suite à la demande explicite de l'utilisateur de refactoriser
techcars.fr vers une logique qualité plutôt que volume (fin de l'objectif "10 000
articles"), en s'appuyant sur un export Search Console réel pour prioriser les décisions.
Voir aussi [analyse-spam-update-aout-2026.md](analyse-spam-update-aout-2026.md) (contexte :
chute de trafic depuis le 21/08, toujours pas résorbée) et
[feuille-de-route-eeat-industrialisation.md](feuille-de-route-eeat-industrialisation.md).

**Source des données** :
- `techcars.fr-Performance-on-Search-2026-09-04.xlsx` (export Search Console de
  l'utilisateur, 3 derniers mois), lu via Python/openpyxl — l'outil de lecture intégré ne
  gère pas les `.xlsx`.
- API WordPress REST (`scripts/autopublish/lib/wp-client.js`), tous les posts et pages
  publiés relus intégralement (contenu, ACF, catégories).

**Avertissement sur la fiabilité statistique** : le site totalise **7 clics et 1807
impressions sur 632 requêtes en 3 mois**. À ce volume, les clics/impressions par page
individuelle ne permettent PAS de décisions fines "cet article marche, celui-là non" —
la plupart des pages sont à 0 clic tout court. Les données GSC servent ici à confirmer le
tableau d'ensemble (visibilité quasi nulle, aucune reprise post-spam-update) et à repérer
les rares pages avec un vrai signal, pas à trancher article par article.

---

## 0. Incident découvert en cours d'audit — corrigé, mentionné pour mémoire

Le premier passage de cet audit (avant correction) affichait "0 article sur 124 avec
TL;DR/sources/FAQ" — pas un vrai défaut de contenu, mais un bug d'infrastructure
(le mu-plugin `monauto-headless.php`, qui expose ces champs, avait disparu du serveur de
production). Corrigé le même jour par un ré-upload FTP de l'utilisateur, vérifié sans perte
de données. Détail complet dans [STATE.md](../STATE.md), entrée du 2026-09-04. **Les chiffres
de ce document sont ceux du second passage, après correction — fiables.**

---

## 1. Vue d'ensemble du catalogue publié

| | Valeur |
|---|---|
| Articles publiés | 124 |
| Pages publiées (hubs/sous-hubs/statiques) | 100 |
| Total mots (articles) | 149 774 |
| Moyenne mots/article | 1208 |
| Articles sous le plancher ferme de 900 mots (skills/seo.md) | 1 |
| Articles sans aucun marqueur E-E-A-T (TL;DR/sources/FAQ) | 0 (une fois le bug d'infra corrigé) |
| Clics GSC totaux rattachés à des articles publiés | 16 sur 3 mois |

### Par silo (silos avec au moins un article publié)

| Silo | Articles | Mots | Clics GSC | Impressions GSC |
|---|---|---|---|---|
| Carte grise & démarches | 30 | 31 338 | 6 | 1203 |
| Mobilité partagée & transports | 20 | 20 680 | 0 | 159 |
| Camping-car & van | 20 | 24 008 | 2 | 421 |
| Utilitaires & flottes pro | 20 | 23 884 | 1 | 3 |
| Carburants & consommation | 17 | 20 597 | 7 | 422 |
| Vélo & nouvelles mobilités | 16 | 28 030 | 0 | 0 |
| Anglais (toutes rubriques) | 1 | 1 237 | 0 | 11 |

**Constat** : le plancher de longueur est globalement respecté (1 seul article sous 900
mots, `gnv-utilitaire-pro`, 862 mots, silo Carburants — 0 clic/8 impressions, candidat à
un enrichissement plutôt qu'une suppression vu le sujet). La complétude E-E-A-T
structurelle (TL;DR/sources/FAQ) est à 100 % une fois le bug d'infra réglé. **Le problème
du catalogue existant n'est donc pas la profondeur individuelle des pages — c'est la
duplication d'intention entre plusieurs pages sur le même sujet**, détaillée section 2.

---

## 2. Quasi-doublons détectés (silo "Carte grise & démarches" concentre presque tout le risque)

**Méthode** : recoupement lexical des titres (indice de Jaccard sur tokens significatifs,
seuil ≥ 0,30) sur les 124 articles publiés, puis vérification par lecture intégrale du
contenu pour les paires les plus fortes — le score seul ne suffit pas (voir faux positifs
ci-dessous).

### 2.1. Fusions à haute confiance — vérifiées par lecture complète du texte

**Cluster A — "Changement de titulaire"** (3 pages → 1) :
- `changement-de-titulaire` (sous-hub, page #281, 1647 mots) — **à conserver, canonique**
- `changement-de-titulaire-carte-grise` (#962, 1005 mots, 30/07) — à fusionner puis rediriger
- `changement-titulaire-carte-grise-en-ligne` (#958, 1095 mots, 03/08) — à fusionner puis rediriger

Vérifié texte contre texte : mêmes montants exacts (13,76€, 11€+2,76€ de redevance, délai
7-10 jours, amende 135-750€), mêmes documents (Cerfa 13750\*08, justificatif <6 mois,
ancienne carte barrée "vendu", CT <6 mois si véhicule >4 ans), même structure de questions.
Rédigés à 4 jours d'écart. Aucune information unique identifiée dans l'un des deux qui
manquerait à l'autre.

**Cluster B — "Changement d'adresse"** (2 pages → 1, pas de sous-hub existant) :
- `changement-d-adresse-sur-la-carte-grise` (#1009, 1071 mots, 14/08) — **à conserver, plus récent et complet**
- `changement-adresse-carte-grise-gratuit` (#1012, 935 mots, 04/08) — à fusionner puis rediriger (vérifier que l'angle "gratuit pour les 3 premiers changements" est bien repris dans la page conservée avant de rediriger)

### 2.2. Paires à vérifier manuellement avant décision (signal moyen, pas encore lu le texte complet)

Toutes dans "Carte grise & démarches" — silo le plus fourni (30 articles sur des démarches
administratives proches par nature, donc chevauchement de vocabulaire attendu, mais
certaines paires ci-dessous décrivent peut-être bien la même démarche sous deux angles :

| Paire | Similarité | À vérifier |
|---|---|---|
| `rectifier-erreur-carte-grise` <-> `carte-grise-ants-demarches` | 0.44 | La 2e est-elle un guide générique ANTS qui recouvre la 1re ? |
| `changement-d-adresse-sur-la-carte-grise` <-> `carte-grise-collection` | 0.44 | Probable faux positif (sujets différents : adresse vs carte de collection) |
| `changement-de-titulaire-carte-grise` <-> `declaration-de-cession-carte-grise` | 0.40 | Démarches liées (cession précède le changement de titulaire) mais possiblement complémentaires, pas doublons |
| `cheval-fiscal-prix-par-region` <-> `carte-grise-prix-par-region` | 0.36 | Le cheval fiscal détermine le prix carte grise — vérifier si l'un ne fait que répéter l'autre |
| `declaration-cession-vehicule-en-ligne` <-> `cession-vehicule-pour-destruction` | 0.33 | Deux démarches de cession différentes (vente normale vs destruction) — probablement légitimement distinctes |
| `carte-grise-heritage-succession` <-> `rectifier-erreur-carte-grise` / `carte-grise-collection` | 0.30 | Probable faux positif (vocabulaire "carte grise" générique partagé) |
| `duplicata-carte-grise-perte` <-> `rectifier-erreur-carte-grise` / `carte-grise-collection` | 0.30 | Probable faux positif |
| `calcul-malus-occasion-importee` <-> `taxe-co2-vehicule-occasion` | 0.30 | Le malus ET la taxe CO2 sont deux taxes distinctes sur le même achat — probablement légitimement distinctes, à vérifier qu'elles ne se recopient pas l'une l'autre |

### 2.3. Faux positifs identifiés (formule de titre réutilisée, produits différents — pas des doublons)

Ces paires partagent une **formule de titre générique répétée telle quelle** sur des sujets
réellement différents. Ce n'est pas une duplication de contenu, mais c'est le symptôme
exact que l'utilisateur a demandé d'éliminer ("blocs de texte génériques créés uniquement
pour le SEO") — la formule elle-même mérite d'être variée à l'avenir, même quand les
sujets restent distincts :
- `utilitaire-occasion-kilometrage` <-> `van-amenage-occasion-choisir` — "...comment bien choisir sans se tromper ?" réutilisé sur utilitaire vs van aménagé.
- `trottinette-electrique-autonomie-reelle` <-> `utilitaire-electrique-autonomie-reelle` — "quelle autonomie réelle..." réutilisé sur trottinette vs utilitaire.
- `casque-trottinette-obligatoire` <-> `marquage-bicycode-obligatoire` — "...ce que dit la loi en 2026" réutilisé sur deux réglementations différentes.

---

## 3. Ce que cet audit NE couvre PAS encore

- **Les pages hors silo tracké** (~75 pages/posts "hors tracking" identifiées le 02/09 par
  `reconcile-tracking.js` : 74 traductions anglaises en draft + 2 actus) — non incluses ici
  car non publiées.
- **Les 1264 clusters "à faire"**, en particulier les 2 gros silos jamais commencés
  (Marques & modèles 463 clusters, Entretien & révision 314) — c'est là que le risque
  "Clio 2 / Clio 3" est le plus élevé, à traiter en amont de la rédaction (restructurer le
  découpage des mots-clés), pas après.
- **Lecture qualitative fine du contenu** (généricité du ton, présence de vrais schémas/cas
  d'atelier) — l'utilisateur doit fournir les cas réels pour les intégrer ; pas fait ici,
  hors périmètre de cet audit quantitatif.

## 4. Prochaine action concrète

1. Valider et exécuter les 2 fusions à haute confiance (section 2.1) : enrichir la page
   conservée si besoin, dépublier les pages perdantes (pas de suppression définitive),
   poser les redirections 301 dans `next.config.ts`.
2. Vérifier manuellement les paires de la section 2.2 (lecture du texte complet, comme fait
   pour les clusters A/B) avant toute décision.
3. Décider du sort du seul article sous le plancher (`gnv-utilitaire-pro`, 862 mots) —
   enrichir plutôt que supprimer, sujet valide et déjà indexé (8 impressions).
4. Étendre cette méthode (Jaccard + vérification manuelle) aux futurs clusters avant
   rédaction, pas seulement en audit rétroactif.

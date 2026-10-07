# Scope automotive-technology — Périmètre exclusif TechCars.fr (contrat commun, toute génération/relecture)

Garde-fou ajouté le 2026-10-07 suite à la reorientation stratégique de
techcars.fr vers la technologie automobile exclusivement. Le domaine
**TechCars** = **Technologie + Car** : tous les articles doivent traiter
**uniquement** des aspects technologiques de l'automobile, pas d'admin, pas
de commercial, pas de lifestyle.

Critère de rejet : tout article qui ne satisfait pas les 5 conditions
ci-dessous doit être bloqué avant publication. Aucune exception.

## 1. Angle technologique obligatoire

Chaque article DOIT traiter d'une technologie automobile précise. Exemples
**acceptés** :
- "Chimie des batteries LFP vs NCM : avantages, rendement, risques thermiques"
- "Systèmes ADAS : de l'assistance au freinage autonome (SAE Level 2)"
- "Motorisation hydrogène par pile à combustible PEM : architecture et défis"
- "Gestion thermique active dans les moteurs électriques"
- "Norme Euro 7 : nouveaux seuils d'émission et cycle d'essai RDE"

Exemples **rejetés** :
- ❌ "Où trouver les stations hydrogène en France" → Localisation service, pas techno
- ❌ "Meilleure assurance pour véhicule électrique" → Produit commercial
- ❌ "Comment obtenir une duplicata de carte grise" → Procédure administrative
- ❌ "Uber vs Bolt : comparatif de prix et commissions" → Commercial, pas tech
- ❌ "Camping-car : guide pratique pour voyager" → Lifestyle

**Test rapide** : "Cet article explique-t-il comment une partie de la voiture
fonctionne, ou améliorations techniques récentes ?" → OUI = accepté, NON = rejeté.

## 2. Champ obligatoire : angle_technologique

Chaque article doit inclure dans le schéma de réponse un champ texte
`angle_technologique` décrivant précisément l'angle technique (non vide, min
10 caractères, max 100, pas générique).

Exemples **valides** :
- "Batterie LFP vs NCM : chimie, rendement et sécurité thermique"
- "ADAS : de l'alerte aux freinages autonomes (niveaux SAE 0-5)"
- "Hydrogène PEM vs autres technologies de piles à combustible"

Exemples **invalides** :
- ❌ "Technologie automobile" → Trop vague
- ❌ "Voiture électrique" → Catégorie générale, pas angle précis
- ❌ "" (vide) → Manquant

## 3. Audience persona obligatoire

Chaque article doit déclarer son audience cible via le champ
`audience_persona` (enum obligatoire) :

- **ingénieur** : détail technique max, comparatifs chiffrés, specs constructeur, brevets
- **étudiant** : explication progressive, schémas/diagrams, fondamentaux+avancé
- **passionné** : innovation, futur technologique, nouveautés constructeurs, story
- **technicien** : diagnostic/maintenance, outils OBD, cas réels atelier

Chaque article **doit** être clairement écrit pour une de ces quatre personas.

## 4. Minimum 2 sources techniques

Chaque article doit citer au moins 2 sources officielles/crédibles :
- Brevets (Google Patents, WIPO, ESP@cenet)
- Standards ISO/EN (émissions, sécurité, crash test)
- Whitepapers constructeur ou supplier (Bosch, Continental, Tesla, etc.)
- Études académiques publiées ou rapport R&D
- Documents réglementaires officiels (Euro 7, RDE, certification NCAP)
- Datasheets techniques ou specifications officielles

**Non acceptés comme sources seules** :
- ❌ Articles de presse généraliste (pas assez technique)
- ❌ Forums ou blogs sans vérification
- ❌ Affirmations "selon nous" ou "il paraît que"
- ❌ Chiffres sortis de nulle part

Au minimum : citez les URLs dans un bloc `Sources:` ou dans le corps de
l'article avec attribution claire.

## 5. Pas de contenu supprimé post-génération

Trois catégories d'articles sont **bloquées dès la génération** (refus
complet, pas "à corriger après") :

### 5a. Administratif pur
Procédures gouvernementales sans angle technique :
- ❌ Demande de duplicata/changement adresse/cession/destruction
- ❌ Permis de conduire, inscriptions autorités
- ❌ Taxes (TVA, CO2, malus) — sauf si angle technique (ex : "Cycle RDE vs WLTP")

### 5b. Commercial
Comparaisons de produits/services sans focus technique :
- ❌ "Uber vs Bolt vs VTC : tarifs et avis"
- ❌ "Meilleure assurance automobile"
- ❌ "Meilleur crédit auto"
- ❌ "Leasing vs achat"

**Exception** : Comparatif technique accepté si angle = techno, ex :
- ✅ "Différences mécaniques Diesel vs Essence vs Hybride" (techno)
- ❌ "Moins cher à l'achat : Diesel ou Essence?" (commercial)

### 5c. Lifestyle
Contenu voyage/loisir sans technologie :
- ❌ "Camping-car : équipements pour voyager"
- ❌ "Meilleures aires de repos en France"
- ❌ "Conduire sur l'autoroute : conseils pratiques"

**Exception** : Technologie dans le camping-car acceptée si angle = techno, ex :
- ✅ "Batterie auxiliaire LiFePO4 : gestion thermique et rendement"
- ❌ "Camping-car : guides pratiques pour dormir confortablement"

## Blocage dans la pipeline

Avant publication, la génération doit :

1. **Vérifier** que `scope_automotive_technology = true`
   - Sinon : REJECT immédiatement
2. **Vérifier** que `angle_technologique` est rempli et > 10 chars
   - Sinon : REJECT immédiatement
3. **Vérifier** que `audience_persona` ∈ {ingénieur, étudiant, passionné, technicien}
   - Sinon : REJECT immédiatement
4. **Vérifier** que contenu ≠ une des 3 catégories bloquées (admin, commercial, lifestyle)
   - Sinon : REJECT immédiatement
5. **Compter** sources techniques déclarées ≥ 2
   - Sinon : REJECT immédiatement

**Rejet = message clair au modèle** : "Article outside scope — regenerate with a
different angle on automotive technology or a different topic." Pas de "relax,
tu peux presque…" — critères binaires.

## Résumé visuel

```
┌─────────────────────────────────────────────────────────────┐
│ Est-ce de la technologie automobile ?                       │
│ (batterie, moteur, ADAS, autonomie, recharge, etc.)         │
│                                                             │
├─ OUI ────────────────────────────────────────────┐         │
│                                                  │         │
│ Angle technologique précis ?                     │         │
│ (pas "Voiture électrique", mais ex:              │         │
│  "Chimie batterie LFP vs NCM")                   │         │
│                                                  │         │
├─ OUI ────────────────────────────────────┐      │         │
│                                          │      │         │
│ Audience persona clair ?                 │      │         │
│ (ingénieur / étudiant / passionné /      │      │         │
│  technicien)                             │      │         │
│                                          │      │         │
├─ OUI ────────────────────────┐           │      │         │
│                              │           │      │         │
│ ≥ 2 sources techniques ?     │           │      │         │
│ (brevets, norms, specs,      │           │      │         │
│  études, datasheets)         │           │      │         │
│                              │           │      │         │
├─ OUI ────────────────┐       │           │      │         │
│                      │       │           │      │         │
│ Pas admin/           │       │           │      │         │
│ commercial/          │       │           │      │         │
│ lifestyle ?          │       │           │      │         │
│                      │       │           │      │         │
└─ OUI ──→ ✅ PUBLISH  │       │           │      │         │
                       │       │           │      │         │
           ❌ REJECT ←─┴───────┴───────────┴──────┘         │
                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

Cette règle n'a aucune exception. Elle s'applique à **chaque** génération
(draft ou relecture), **chaque** persona (auteur F, Karim, etc.), **chaque**
article (article simple, hub, sous-hub). Elle est le cœur du repositionnement
de TechCars autour de la technologie automobile.

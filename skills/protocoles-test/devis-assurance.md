# Protocole de test — Devis assurance réels

**Silo YMYL** — voir garde-fous supplémentaires dans [../agents-ia.md](../agents-ia.md) section 5.

## Objectif
Obtenir un tarif réel d'assurance auto pour un profil type, sur un ou plusieurs assureurs/comparateurs,
plutôt que de citer une fourchette générique trouvée ailleurs.

## Sites de référence
Comparateurs reconnus (LeLynx, Assurland, LesFurets) et/ou assureurs directs pertinents pour le
comparatif demandé (Direct Assurance, Euro-Assurance, L'Olivier, MAIF, etc. selon le brief).

## Profils fictifs standardisés (à réutiliser tels quels d'un test à l'autre, pour rester comparable)
- **Jeune conducteur** : 20 ans, permis obtenu il y a 1 an, véhicule Peugeot 208 essence, usage
  trajets domicile-travail, stationnement rue.
- **Famille** : 40 ans, permis 20 ans, bonus 0,50, véhicule Renault Scenic, garage, usage mixte.
- **Primo-accédant** : 30 ans, permis 8 ans, achat de sa première voiture, véhicule Dacia Sandero,
  stationnement rue.

Adapter l'âge/le véhicule si le brief cible un profil différent, mais toujours documenter le profil
exact utilisé dans le rapport (reproductibilité).

## Coordonnées à utiliser — jetables, obligatoire
**Ne jamais utiliser une adresse email ou un numéro de téléphone réels de Publithings/Techcars.**
Avant de lancer ce protocole pour la première fois : prévoir une adresse email dédiée jetable et,
si le formulaire l'exige, un numéro de téléphone jetable (éviter les rappels commerciaux sur une
ligne réelle). Si aucune coordonnée jetable n'est disponible au moment du test, arrêter le protocole
et le signaler plutôt que d'utiliser une coordonnée réelle.

## Étapes d'exécution
1. Ouvrir le comparateur/assureur, démarrer un devis avec le profil standardisé du brief.
2. Remplir le formulaire jusqu'à l'écran de tarif (pas besoin d'aller jusqu'à la souscription).
3. Capturer l'écran de résultat avec le tarif affiché (mensuel et/ou annuel), la formule proposée
   (tiers, tiers étendu, tous risques) et les garanties incluses.
4. Si plusieurs assureurs à comparer : répéter avec le même profil exact sur chacun.
5. Ne jamais aller au-delà de l'obtention du tarif (pas de paiement, pas de souscription réelle).

## Données à consigner (rapport JSON)
Profil utilisé (nom du profil standardisé), assureur/comparateur, formule, tarif mensuel/annuel
affiché, garanties principales incluses, franchise si affichée, capture d'écran, date du test.

## Fréquence de re-test
Tarifs sensibles aux évolutions réglementaires et à la saisonnalité : re-test recommandé tous les
2-3 mois pour un même profil si l'article est présenté comme "à jour".

## Vigilance
- Toujours indiquer "tarif obtenu le [date], à titre indicatif — les prix réels varient selon le
  profil exact et l'évolution du marché", jamais "le prix est de X€" sans réserve.
- Ne pas multiplier les devis sur un même site en une seule session (voir rythme raisonnable,
  [../agents-ia.md](../agents-ia.md) section 5) pour éviter un blocage IP ou une détection de fraude.

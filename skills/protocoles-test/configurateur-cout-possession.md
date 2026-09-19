# Protocole de test — Configurateurs & coût de possession

## Objectif
Obtenir un prix réel et daté pour un ou plusieurs modèles précis, en configurant réellement le
véhicule sur le configurateur officiel du constructeur — jamais un prix "à partir de" recopié d'une
fiche technique.

## Sites de référence
Configurateurs officiels constructeurs (peugeot.fr, renault.fr, dacia.fr, volkswagen.fr, toyota.fr,
etc. selon le modèle testé) — jamais un comparateur tiers qui pourrait afficher un prix obsolète.
Pour le leasing/LOA/LLD : configurateur constructeur si disponible, sinon un loueur reconnu (ALD,
Arval grand public, Leasys...).

## Profil / paramétrage à utiliser
Pas de données personnelles nécessaires (simple configuration produit, pas de devis nominatif) :
- Motorisation et finition précisées dans le brief (ex. "finition intermédiaire", "hybride
  disponible le moins cher") — toujours documenter le choix exact fait en cas d'ambiguïté.
- Aucune option ajoutée sauf si le brief le demande explicitement (comparaison "de base").
- Localisation : département neutre si demandé (ex. 75) — sans incidence sur un prix constructeur
  hors bonus régional spécifique ; le signaler si un bonus dépend de la région.

## Étapes d'exécution
1. Ouvrir le configurateur officiel du modèle.
2. Sélectionner motorisation + finition selon le brief, capturer chaque écran de choix.
3. Relever le prix total affiché (TTC, hors reprise), et le détail bonus/malus/écologique si affiché.
4. Si plusieurs modèles à comparer : répéter à l'identique (même niveau de finition/équipement autant
   que possible) pour une comparaison honnête — noter explicitement les écarts d'équipement non
   alignables entre marques.
5. Capturer l'URL finale de la configuration si le site en génère une (permet une preuve vérifiable
   a posteriori).

## Données à consigner (rapport JSON)
Pour chaque modèle : motorisation/finition exacte, prix TTC affiché, bonus/malus inclus ou non,
délai de livraison annoncé si affiché, capture d'écran, URL de configuration si disponible.

## Fréquence de re-test
Les prix constructeurs évoluent par vagues (nouveau millésime, promotion) : un re-test tous les
3-6 mois sur un même modèle est pertinent pour un contenu "suivi dans le temps".

## Vigilance
Prix indicatif au jour du test, à mentionner explicitement dans l'article avec la date — jamais
présenté comme garanti ou contractuel.

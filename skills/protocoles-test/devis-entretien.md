# Protocole de test — Devis entretien/réparation réels

## Objectif
Obtenir un prix réel pour une prestation d'entretien précise (vidange, plaquettes, pneus...) sur un
modèle donné, chez plusieurs enseignes, pour un comparatif de prix honnête — pas un tarif moyen
générique.

## Sites de référence
Sites de devis en ligne des enseignes nationales : Feu Vert, Norauto, Midas, Speedy, ainsi qu'un
concessionnaire de la marque concernée si un devis en ligne existe. Éviter les estimateurs qui ne
donnent qu'une fourchette non engageante sans passer par un vrai formulaire de devis.

## Profil / paramétrage à utiliser
- Véhicule précis (marque, modèle, motorisation, année) fourni par le brief — toujours le même
  véhicule d'une enseigne à l'autre pour rester comparable.
- Prestation précise et unique par test (ex. "vidange + filtre à huile" seul, pas un panier de
  plusieurs prestations qui fausserait la comparaison).
- Code postal neutre si demandé par le formulaire (les prix enseignes varient parfois par région/
  centre — le signaler si observé).

## Coordonnées à utiliser
Coordonnées jetables si le formulaire de devis en ligne les exige pour afficher un prix (comme pour
le protocole assurance) — jamais les coordonnées réelles de Publithings/Techcars.

## Étapes d'exécution
1. Ouvrir le site de devis en ligne de l'enseigne.
2. Renseigner véhicule + prestation exactement comme spécifié dans le brief.
3. Capturer le prix affiché (pièces + main d'œuvre si détaillé séparément).
4. Répéter à l'identique pour chaque enseigne du comparatif.
5. Noter le centre/ville utilisé si le prix est localisé.

## Données à consigner (rapport JSON)
Véhicule testé, prestation exacte, enseigne, prix total affiché, détail pièces/main d'œuvre si
disponible, centre/localisation utilisée, capture d'écran, date du test.

## Fréquence de re-test
Prix d'entretien relativement stables à court terme : re-test tous les 6 mois suffit sauf signal de
changement (inflation pièces, promotion enseigne).

## Vigilance
Prix indicatif au jour et au centre testés — le préciser explicitement, les tarifs pouvant varier
d'un centre à l'autre pour une même enseigne.

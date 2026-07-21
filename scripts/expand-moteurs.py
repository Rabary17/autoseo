#!/usr/bin/env python
# Expansion des moteurs programmatiques — POINT D'ENTRÉE HISTORIQUE, conservé pour la
# continuité des commandes déjà documentées (commandes-moteurs.html, docs/commandes.md).
#
# 2026-07-20 (industrialisation) : la logique était codée en dur en Python, spécifique à
# "Auto & mobilité" (7 moteurs : prestation×véhicule, codes OBD, voyants, modèle×angle,
# pièce×équipementier, démarche×cas, pays×angle). Elle a été extraite en config déclarative
# (config/niches/auto-mobilite/moteurs.json) exploitée par un moteur GÉNÉRIQUE réutilisable
# pour toute niche (scripts/moteur-engine.py + scripts/lib_py/moteur_types.py).
#
# Équivalence vérifiée AVANT ce remplacement : les 3 491 candidats produits par l'ancienne
# version codée en dur et par le moteur générique sont identiques à 100% (mot_cle_principal,
# variantes, silo, sous_cocon, intention) — comparaison exhaustive faite le 2026-07-20, voir
# STATE.md. Ce script est donc désormais un simple alias de :
#   python scripts/moteur-engine.py --niche auto-mobilite
#
# Usage : python scripts/expand-moteurs.py [--niche <id>]
# (garder --niche permet de réutiliser cette même commande pour une AUTRE niche déjà
# configurée dans config/niches/<id>/, sans avoir à retenir le nom du script générique).
import os
import subprocess
import sys

ENGINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'moteur-engine.py')

if __name__ == '__main__':
    args = sys.argv[1:]
    if '--niche' not in args:
        args = ['--niche', 'auto-mobilite'] + args
    sys.exit(subprocess.call([sys.executable, ENGINE] + args))

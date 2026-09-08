#!/usr/bin/env python
# Scaffold une nouvelle niche — industrialisation 2026-07-20. Crée la config déclarative
# (config/niches/<id>/{niche.json, moteurs.json}) et, si data_dir est dédié à cette niche
# (recommandé pour ne jamais mélanger avec une autre niche), l'arborescence de données vierge
# + un tracking-mots-cles.xlsx prêt à l'emploi.
#
# Après ce script, la niche est prête pour :
#   1. Ajouter des silos :   python scripts/add-silo.py <id> "Nom du silo" hub-slug --author A
#   2. Collecter les mots-clés (P1) :  node scripts/fetch-keywords.js --niche <id> --silo "..."
#      (fetch-keywords.js doit recevoir --niche pour cibler ce data_dir — voir docs/commandes.md)
#   3. (optionnel) Définir des moteurs programmatiques dans moteurs.json — voir
#      scripts/lib_py/moteur_types.py pour les 4 types de stratégie disponibles.
#
# Usage :
#   python scripts/new-niche.py <id> "Nom affiché" [--data-dir data/niches/<id>]
#   (par défaut, data_dir = data/niches/<id> — jamais data/ directement, pour ne jamais
#   entrer en collision avec la niche historique 'auto-mobilite' qui, elle, utilise data/
#   à la racine pour rester rétrocompatible avec les scripts déjà en place).
import argparse
import os
import re
import sys
import unicodedata

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib_py'))
import niche_config
import niche_firestore_sync
import json


def slugify(name):
    n = unicodedata.normalize('NFD', name.lower())
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
    return n


def build_tracking_xlsx(path, niche_name):
    wb = openpyxl.Workbook()
    ws0 = wb.active
    ws0.title = 'Légende'
    ws0['A1'] = f'Fichier de suivi — Mots-clés & pages — {niche_name}'
    ws0['A1'].font = Font(name='Arial', size=14, bold=True)
    ws0.merge_cells('A1:D1')
    ws0['A3'] = "Colonnes de l'onglet Suivi"
    ws0['A3'].font = Font(name='Arial', bold=True)
    cols_doc = [
        ('mot_cle_principal', "Le mot-clé de tête du cluster (celui qui définit l'URL cible)."),
        ('variantes', 'Les autres mots-clés du même cluster, séparés par ";".'),
        ('silo', 'Silo du cocon.'),
        ('sous_cocon', 'Sous-cocon.'),
        ('intention', 'Info / Commercial / Transactionnel.'),
        ('volume_estime', 'Volume de recherche réel (source Haloscan), jamais estimé à la main.'),
        ('url_cible', 'URL prévue ou publiée qui couvre ce cluster.'),
        ('auteur', 'Persona auteur WordPress assigné (voir niche.json).'),
        ('statut', 'à faire / en rédaction / programmé / publié / à réécrire.'),
        ('date_publication', 'Date réelle ou programmée de mise en ligne (AAAA-MM-JJ).'),
    ]
    r = 4
    for name, desc in cols_doc:
        ws0.cell(row=r, column=1, value=name).font = Font(name='Arial', bold=True)
        ws0.cell(row=r, column=2, value=desc).font = Font(name='Arial')
        r += 1
    ws0['A' + str(r + 1)] = "Règle anti-cannibalisation : un mot-clé principal = une seule ligne = une seule URL."
    ws0['A' + str(r + 1)].font = Font(name='Arial', italic=True, color='C0392B')
    ws0.column_dimensions['A'].width = 22
    ws0.column_dimensions['B'].width = 90

    ws = wb.create_sheet('Suivi')
    headers = ['mot_cle_principal', 'variantes', 'silo', 'sous_cocon', 'intention',
               'volume_estime', 'url_cible', 'auteur', 'statut', 'date_publication']
    header_fill = PatternFill(start_color='1E2535', end_color='1E2535', fill_type='solid')
    header_font = Font(name='Arial', bold=True, color='FFFFFF')
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal='center')
    widths = [30, 45, 22, 22, 14, 14, 45, 24, 14, 16]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'
    wb.save(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('niche_id')
    parser.add_argument('niche_name')
    parser.add_argument('--data-dir', default=None)
    args = parser.parse_args()

    if re.search(r'[^a-z0-9-]', args.niche_id):
        raise SystemExit(f"'{args.niche_id}' : l'identifiant de niche doit être en minuscules-avec-tirets (ex. 'cuisine-recettes').")

    ndir = niche_config.niche_dir(args.niche_id)
    if os.path.exists(os.path.join(ndir, 'niche.json')):
        raise SystemExit(f"La niche '{args.niche_id}' existe déjà ({ndir}/niche.json) — utiliser scripts/add-silo.py pour l'étendre.")

    data_dir_rel = args.data_dir or f'data/niches/{args.niche_id}'
    os.makedirs(ndir, exist_ok=True)

    niche_json = {
        'id': args.niche_id,
        'name': args.niche_name,
        'data_dir': data_dir_rel,
        'authors': {
            'A': {'label': f'A — Auteur principal ({args.niche_name})', 'wp_slug': 'auteur-a'},
        },
        'silos': [],
    }
    with open(os.path.join(ndir, 'niche.json'), 'w', encoding='utf-8') as f:
        json.dump(niche_json, f, ensure_ascii=False, indent=2)
    niche_firestore_sync.push_niche(args.niche_id)

    with open(os.path.join(ndir, 'moteurs.json'), 'w', encoding='utf-8') as f:
        json.dump({'moteurs': []}, f, ensure_ascii=False, indent=2)

    data_dir_abs = os.path.join(niche_config.ROOT, data_dir_rel)
    for sub in ('keywords', 'factuel', 'maillage'):
        os.makedirs(os.path.join(data_dir_abs, sub), exist_ok=True)

    xlsx_path = os.path.join(data_dir_abs, 'keywords', 'tracking-mots-cles.xlsx')
    if not os.path.exists(xlsx_path):
        build_tracking_xlsx(xlsx_path, args.niche_name)

    maillage_path = os.path.join(data_dir_abs, 'maillage', 'maillage.json')
    if not os.path.exists(maillage_path):
        with open(maillage_path, 'w', encoding='utf-8') as f:
            json.dump([], f)

    print(f"Niche '{args.niche_id}' ({args.niche_name}) créée :")
    print(f"  Config      : {os.path.relpath(ndir)}/niche.json + moteurs.json")
    print(f"  Données     : {data_dir_rel}/keywords, /factuel, /maillage")
    print(f"  Tracking    : {os.path.relpath(xlsx_path)} (vierge, 1 auteur 'A' par défaut)")
    print()
    print("Prochaine étape : ajouter un premier silo —")
    print(f'  python scripts/add-silo.py {args.niche_id} "Nom du silo" hub-slug --author A --sous-cocons "Sous-cocon 1" "Sous-cocon 2"')


if __name__ == '__main__':
    main()

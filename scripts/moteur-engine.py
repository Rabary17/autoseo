#!/usr/bin/env python
# Moteur d'expansion GÉNÉRIQUE — pilote les moteurs programmatiques d'UNE NICHE via sa config
# déclarative (config/niches/<id>/moteurs.json), au lieu du code Python spécifique-niche de
# scripts/expand-moteurs.py. C'est la brique d'industrialisation 2026-07-20 : une nouvelle
# niche définit ses moteurs en JSON (voir scripts/lib_py/moteur_types.py pour les 4 types de
# stratégie disponibles : cross, single_entity, entity_angles, paired_versus) et obtient ses
# candidats programmatiques SANS écrire de nouveau code.
#
# Rétrocompatibilité : scripts/expand-moteurs.py (spécifique auto-mobilite, longuement
# testé/débogué) N'EST PAS remplacé par ce script — les deux coexistent. Pour la niche
# 'auto-mobilite', ce moteur générique est un chemin ALTERNATIF vérifié équivalent (voir
# scripts/_verify_moteur_engine.py), pas encore celui utilisé en production.
#
# Usage :
#   python scripts/moteur-engine.py --niche <id> [--out-suffix .generic-test]
#
# Mêmes garanties de sécurité qu'expand-moteurs.py : aucun appel réseau, statut de sortie
# toujours 'à valider', jamais d'écriture dans l'onglet "Suivi".
import argparse
import json
import os
import sys

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib_py'))
import niche_config
import moteur_types as mt

HEADERS = ['moteur', 'mot_cle_principal', 'variantes', 'silo', 'sous_cocon', 'intention',
           'volume_estime', 'url_cible', 'auteur', 'statut', 'date_publication',
           'entite_source', 'note']


def load_prior_validation_state(json_out):
    """Avant régénération : capture le statut/volume déjà validés par Haloscan
    (scripts/validate-moteurs-haloscan.js, statut 'retenu'/'rejete') pour chaque
    mot_cle_principal, afin de ne JAMAIS les perdre en régénérant les candidats depuis les
    données factuelles — ce script régénère TOUT à chaque exécution (nouvelles données =
    nouveaux candidats), donc sans cette capture un run relancé après une validation payante
    remettrait tout à 'à valider' et exigerait de repayer Haloscan pour les mêmes mots-clés."""
    if not os.path.exists(json_out):
        return {}
    try:
        with open(json_out, encoding='utf-8') as f:
            old = json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}
    state = {}
    for c in old.get('candidats', []):
        if c.get('statut') and c['statut'] != 'à valider':
            state[c['mot_cle_principal']] = {
                'statut': c['statut'],
                'volume_estime': c.get('volume_estime', ''),
            }
    return state


def load_editorial_keys(keywords_dir):
    """Clés normalisées des mots-clés éditoriaux déjà clusterisés (P1), pour ne jamais
    composer un doublon programmatique d'une page éditoriale (anti-cannibalisation)."""
    import glob
    keys = set()
    for path in glob.glob(os.path.join(keywords_dir, '*.json')):
        base = os.path.basename(path)
        if base in ('seeds.json',) or base.startswith('moteurs-candidats'):
            continue
        try:
            with open(path, encoding='utf-8-sig') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            continue
        for keyword in (data.get('seeds') or {}).keys():
            keys.add(mt.norm_key(keyword))
    return keys


def write_xlsx(rows, xlsx_path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Programmatique'

    header_font = Font(name='Arial', bold=True, color='FFFFFF')
    header_fill = PatternFill('solid', fgColor='4F8EF7')
    for i, h in enumerate(HEADERS, start=1):
        c = ws.cell(row=1, column=i, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(vertical='center')

    for ri, row in enumerate(rows, start=2):
        for ci, h in enumerate(HEADERS, start=1):
            ws.cell(row=ri, column=ci, value=row.get(h, ''))

    ws.freeze_panes = 'A2'
    widths = [26, 34, 60, 22, 26, 13, 13, 30, 24, 12, 16, 30, 50]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    lg = wb.create_sheet('Légende')
    lg['A1'] = 'Candidats programmatiques (moteurs) — À VALIDER avant publication'
    lg['A1'].font = Font(bold=True, size=12)
    notes = [
        '', "Ces lignes sont des mots-clés COMPOSÉS par formule (moteur générique piloté par",
        "config/niches/<id>/moteurs.json), pas des volumes mesurés. statut « à valider ».",
        '', "Étape suivante : valider via Haloscan (scripts/validate-moteurs-haloscan.js) puis",
        "promouvoir dans « Suivi » (scripts/populate-tracking-xlsx.py).", '', 'Comptes par moteur :',
    ]
    r = 3
    for line in notes:
        lg.cell(row=r, column=1, value=line)
        r += 1
    counts = {}
    for row in rows:
        counts[row['moteur']] = counts.get(row['moteur'], 0) + 1
    for moteur, c in sorted(counts.items()):
        lg.cell(row=r, column=1, value=moteur)
        lg.cell(row=r, column=2, value=f'{c} candidats')
        r += 1
    lg.cell(row=r + 1, column=1, value=f'TOTAL : {len(rows)} candidats')
    lg.cell(row=r + 1, column=1).font = Font(bold=True)
    lg.column_dimensions['A'].width = 70
    lg.column_dimensions['B'].width = 18
    wb.save(xlsx_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--niche', default=niche_config.DEFAULT_NICHE)
    parser.add_argument('--out-suffix', default='', help="ex. '.generic-test' pour ne pas écraser le fichier de production")
    args = parser.parse_args()

    niche = niche_config.load_niche(args.niche)
    moteurs_cfg = niche_config.load_moteurs(args.niche)
    factuel_dir = niche_config.data_path(niche, 'factuel')
    keywords_dir = niche_config.data_path(niche, 'keywords')
    author_map = niche_config.author_map(niche)

    json_out = os.path.join(keywords_dir, f'moteurs-candidats{args.out_suffix}.json')
    xlsx_out = os.path.join(keywords_dir, f'moteurs-candidats{args.out_suffix}.xlsx')

    editorial_keys = load_editorial_keys(keywords_dir)
    prior_validation = load_prior_validation_state(json_out)

    raw = []
    for moteur_def in moteurs_cfg.get('moteurs', []):
        before = len(raw)
        mt.run_moteur(factuel_dir, moteur_def, raw)
        print(f"  {moteur_def['label']:<34} {len(raw) - before:>6} candidats")

    seen = set()
    rows = []
    dup_internes = 0
    collisions_editorial = 0
    for cand in raw:
        k = mt.norm_key(cand['mot_cle_principal'])
        if not k:
            continue
        if k in editorial_keys:
            collisions_editorial += 1
            continue
        if k in seen:
            dup_internes += 1
            continue
        seen.add(k)
        prior = prior_validation.get(cand['mot_cle_principal'])
        rows.append({
            'moteur': cand['moteur'],
            'mot_cle_principal': cand['mot_cle_principal'],
            'variantes': ';'.join(cand['variantes']),
            'silo': cand['silo'],
            'sous_cocon': cand['sous_cocon'],
            'intention': cand['intention'],
            'volume_estime': prior['volume_estime'] if prior else '',
            'url_cible': '',
            'auteur': author_map.get(cand['silo'], ''),
            'statut': prior['statut'] if prior else 'à valider',
            'date_publication': '',
            'entite_source': cand['entite_source'],
            'note': cand['note'],
        })

    rows.sort(key=lambda r: (r['moteur'], r['silo'], r['mot_cle_principal']))
    preserved = sum(1 for r in rows if prior_validation.get(r['mot_cle_principal']))

    payload = {
        'genere_par': 'scripts/moteur-engine.py',
        'niche': args.niche,
        'avertissement': "Mots-clés COMPOSÉS par formule, non mesurés. statut 'à valider' : "
                         "valider les volumes via Haloscan puis promouvoir dans l'onglet Suivi "
                         "avant toute publication.",
        'total': len(rows),
        'candidats': rows,
    }
    os.makedirs(keywords_dir, exist_ok=True)
    with open(json_out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    write_xlsx(rows, xlsx_out)

    print('-' * 52)
    print(f'  {"TOTAL retenu":<34} {len(rows):>6} candidats')
    print(f'  (doublons internes écartés : {dup_internes} ; collisions éditoriales écartées : {collisions_editorial})')
    if preserved:
        print(f'  {preserved} candidat(s) ont conservé leur statut de validation Haloscan déjà payé '
              f'(retenu/rejete) — jamais revalidés pour rien.')
    print(f'\nJSON : {os.path.relpath(json_out)}\nXLSX : {os.path.relpath(xlsx_out)}')


if __name__ == '__main__':
    main()

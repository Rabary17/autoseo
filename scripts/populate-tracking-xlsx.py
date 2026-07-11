# Peuple data/keywords/tracking-mots-cles.xlsx (onglet "Suivi") avec les vraies données Haloscan
# collectées par scripts/fetch-keywords.js, silo par silo (uniquement ceux déjà traités en P1).
#
# Une ligne = un cluster = un seed du plan (mot_cle_principal) + ses variantes enrichies
# (match/questions/related, filtrées des marques/navigation) — jamais une ligne par variante,
# pour respecter la règle anti-cannibalisation (skills/wordpress-publication.md section 5 et
# skills/gestion-de-projet.md) : un cluster = une seule URL cible.
#
# volume_estime = volume cumulé du cluster (mot-clé principal + variantes retenues), pas le seul
# volume du mot-clé de tête, pour permettre un tri par priorité réelle (volume bon / difficulté faible).
#
# Usage : python scripts/populate-tracking-xlsx.py

import json
import os
import re
import unicodedata

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data', 'keywords')
SEEDS_PATH = os.path.join(DATA_DIR, 'seeds.json')
XLSX_PATH = os.path.join(DATA_DIR, 'tracking-mots-cles.xlsx')

INTENT_LABELS = {'I': 'Info', 'C': 'Commercial', 'T': 'Transactionnel'}

# Mapping silo -> persona auteur (skills/wordpress-publication.md section 4)
AUTHOR_MAP = {
    'Entretien & révision': 'A — Mécanique & technique',
    'Pannes & diagnostic': 'A — Mécanique & technique',
    'Pièces détachées & accessoires': 'A — Mécanique & technique',
    'Marques & modèles': 'B — Marques, essais & sport auto',
    'Essais & comparatifs': 'B — Marques, essais & sport auto',
    'Sport auto & passion': 'B — Marques, essais & sport auto',
    'Achat voiture neuve': 'C — Achat & mobilité électrique',
    "Voiture d'occasion": 'C — Achat & mobilité électrique',
    'Électrique & hybride': 'C — Achat & mobilité électrique',
    'Carte grise & démarches': 'D — Démarches, assurance & permis',
    'Assurance auto': 'D — Démarches, assurance & permis',
    'Permis & conduite': 'D — Démarches, assurance & permis',
    'Moto & scooter': 'E — Deux-roues & nouvelles mobilités',
    'Vélo & nouvelles mobilités': 'E — Deux-roues & nouvelles mobilités',
    'Mobilité partagée & transports': 'E — Deux-roues & nouvelles mobilités',
    'Carburants & consommation': 'F — Usages spécifiques & voyage',
    'Camping-car & van': 'F — Usages spécifiques & voyage',
    'Utilitaires & flottes pro': 'F — Usages spécifiques & voyage',
    'Road trips & voyage auto': 'F — Usages spécifiques & voyage',
}

# Ordre du plan de niche (STATE.md / plan-auto-mobilite-10000.html), pour trier les silos traités
# dans le même ordre que le reste du pipeline plutôt que par ordre alphabétique.
SILO_ORDER = list(AUTHOR_MAP.keys())

MAX_VARIANTES = 15


def slug(name):
    n = unicodedata.normalize('NFD', name.lower())
    n = ''.join(c for c in n if unicodedata.category(c) != 'Mn')
    n = re.sub(r'[^a-z0-9]+', '-', n).strip('-')
    return n


def load_silo_rows(silo_name):
    path = os.path.join(DATA_DIR, f'{slug(silo_name)}.json')
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    rows = []
    for keyword, entry in data.get('seeds', {}).items():
        candidates = entry.get('candidates') or []
        top_variantes = candidates[:MAX_VARIANTES]

        def as_int(v):
            return v if isinstance(v, (int, float)) else 0

        seed_volume = as_int(entry.get('volume'))
        volume_cluster = seed_volume + sum(as_int(c.get('volume')) for c in top_variantes)
        rows.append({
            'mot_cle_principal': keyword,
            'variantes': ';'.join(c['keyword'] for c in top_variantes),
            'silo': silo_name,
            'sous_cocon': entry.get('sub', ''),
            'intention': INTENT_LABELS.get(entry.get('intent'), ''),
            'volume_estime': volume_cluster,
            'url_cible': '',
            'auteur': AUTHOR_MAP.get(silo_name, ''),
            'statut': 'à faire',
            'date_publication': '',
        })
    # priorité : volume cumulé décroissant (volume bon d'abord), à l'intérieur d'un même silo
    rows.sort(key=lambda r: r['volume_estime'], reverse=True)
    return rows


def build_all_rows():
    all_rows = []
    processed_silos = []
    for silo_name in SILO_ORDER:
        rows = load_silo_rows(silo_name)
        if rows:
            processed_silos.append((silo_name, len(rows)))
            all_rows.extend(rows)
    return all_rows, processed_silos


def main():
    all_rows, processed_silos = build_all_rows()

    if not os.path.exists(XLSX_PATH):
        raise SystemExit(f'{XLSX_PATH} introuvable — lancer scripts/build-tracking-xlsx.py une première fois.')

    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb['Suivi']

    # Repart d'un onglet Suivi vierge (header conservé) pour éviter les doublons entre deux runs.
    ws.delete_rows(2, ws.max_row)

    headers = ['mot_cle_principal', 'variantes', 'silo', 'sous_cocon', 'intention',
               'volume_estime', 'url_cible', 'auteur', 'statut', 'date_publication']

    r = 2
    for row in all_rows:
        for i, h in enumerate(headers, start=1):
            ws.cell(row=r, column=i, value=row[h])
        r += 1

    ws.freeze_panes = 'A2'
    widths = [30, 60, 22, 22, 14, 14, 45, 24, 14, 16]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # Note de suivi dans l'onglet Légende : silos déjà couverts par cette génération.
    legend = wb['Légende']
    note_row = legend.max_row + 2
    legend.cell(row=note_row, column=1, value='Dernière génération automatique (populate-tracking-xlsx.py)').font = Font(name='Arial', bold=True)
    r2 = note_row + 1
    for silo_name, count in processed_silos:
        legend.cell(row=r2, column=1, value=silo_name)
        legend.cell(row=r2, column=2, value=f'{count} clusters')
        r2 += 1
    if not processed_silos:
        legend.cell(row=r2, column=1, value='(aucun silo P1 traité pour le moment)')

    wb.save(XLSX_PATH)
    total = len(all_rows)
    print(f'{total} clusters écrits dans {XLSX_PATH} — silos couverts : {", ".join(s for s, _ in processed_silos) or "aucun"}')


if __name__ == '__main__':
    main()

# Génère les fichiers JSON allégés consommés par les widgets interactifs du frontend
# (frontend/monauto/public/widgets/*.json) à partir des bases factuelles P2
# (data/factuel/*.json) — mêmes sources que les moteurs programmatiques, mais triées et
# nettoyées pour un usage 100% côté client (aucune clé technique, pas de champs
# "a_verifier"/sources bruts, tout ce qui reste doit être présentable tel quel).
#
# À relancer après tout enrichissement de data/factuel/ pour que les widgets reflètent
# les données les plus à jour (aucun impact sur le pipeline éditorial/moteurs — fichiers
# de sortie distincts, jamais lus par expand-moteurs.py/populate-tracking-xlsx.py).
#
# Usage : python scripts/build-widget-data.py
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib_py'))
import moteur_types as mt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACTUEL_DIR = os.path.join(ROOT, 'data', 'factuel')
OUT_DIR = os.path.join(ROOT, 'frontend', 'monauto', 'public', 'widgets')

# Marques composées de plusieurs mots — pour séparer correctement "marque" de "modèle"
# dans le champ "modele" des lots factuels (ex. "Land Rover Defender" -> marque="Land Rover").
# Liste non exhaustive mais couvre toutes les marques multi-mots rencontrées dans les 21
# lots marques-modeles-fiabilite-*.json (vérifiée par échantillonnage).
MULTI_WORD_BRANDS = [
    'Land Rover', 'Alfa Romeo', 'Aston Martin', 'Rolls-Royce', 'Mercedes-Benz', 'Mercedes-AMG',
    'Mercedes', 'DS Automobiles', 'Great Wall', 'GWM', 'Ssangyong',
]


# Corrections ponctuelles pour des entrées source précisément identifiées comme
# brandless/mal formées en testant le widget (ex. "C5 Aircross 2024" sans "Citroën" devant) —
# une poignée de cas fixes, pas une règle générique (le filtre isdigit()/année 4 chiffres
# au-dessus couvre déjà la majorité des cas). Clé = texte source original (avant nettoyage).
KNOWN_FIXES = {
    'c5 aircross 2024': ('Citroën', 'C5 Aircross'),
    'classe c 2024': ('Mercedes', 'Classe C'),
    'série 3 2024': ('BMW', 'Série 3'),
    'ds7 crossback': ('DS', 'DS7 Crossback'),
    'li auto mega': ('Li Auto', 'Mega'),
    'mg4': ('MG', 'MG4'),
}


def split_marque_modele(raw):
    clean = mt.strip_parens(str(raw))
    fix = KNOWN_FIXES.get(clean.lower())
    if fix:
        return fix
    for brand in MULTI_WORD_BRANDS:
        if clean.lower().startswith(brand.lower() + ' '):
            return brand, clean[len(brand):].strip()
        if clean.lower() == brand.lower():
            return brand, ''
    parts = clean.split(' ', 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return clean, ''


def load_many(pattern):
    return mt.load_many(FACTUEL_DIR, pattern)


def build_modeles():
    """Comparateur (M5) + sélecteur 'mon véhicule' (M3) partagent ce même fichier."""
    seg_map = json.load(open(os.path.join(FACTUEL_DIR, 'segments-modeles.json'), encoding='utf-8'))
    seen = set()
    out = []
    for r in load_many('marques-modeles-fiabilite-*.json'):
        raw = r.get('modele')
        if not raw:
            continue
        clean = mt.strip_parens(str(raw))
        if len(clean) < 3:
            continue
        key = mt.norm_key(clean)
        if not key or key in seen:
            continue
        marque, modele = split_marque_modele(raw)
        # Entrées source sans vraie marque (ex. "2008 2024" -> marque="2008", ou
        # "Qashqai 2024" -> marque="Qashqai"/modele="2024", le premier "mot" étant en
        # réalité le nom de modèle et non une marque) — connu, documenté dans STATE.md
        # (2026-07-20), jamais deviné : écartées du widget plutôt qu'affichées avec une
        # fausse marque à l'utilisateur.
        if marque.isdigit() or re.fullmatch(r'\d{4}', modele or ''):
            continue
        seen.add(key)
        out.append({
            'marque': marque,
            'modele': modele or marque,
            'segment': seg_map.get(clean.lower()),
            'fiabilite': mt.to_text(r.get('score_fiabilite'))[:220] or None,
            'pannes': mt.to_text(r.get('pannes_courantes'))[:280] or None,
        })
    out.sort(key=lambda x: (x['marque'], x['modele']))
    return out


def build_prix_entretien():
    cfg = json.load(open(os.path.join(ROOT, 'config', 'niches', 'auto-mobilite', 'moteurs.json'), encoding='utf-8'))
    m1 = next(m for m in cfg['moteurs'] if m['id'] == 'M1')
    label_map, aliases = m1['label_map'], m1['label_aliases']

    def presta_label(raw):
        k = mt.norm_field_key(raw)
        k = aliases.get(k, k)
        return label_map.get(k)

    out = []
    seen = set()
    for r in load_many('entretien-croisement-prix-marques-*.json'):
        presta, marque, modele = r.get('prestation'), r.get('marque'), r.get('modele')
        if not (presta and marque and modele):
            continue
        label = presta_label(presta)
        if not label:
            continue
        modele_clean = mt.strip_parens(str(modele))
        key = mt.norm_key(f'{label} {marque} {modele_clean}')
        if key in seen:
            continue
        seen.add(key)
        out.append({
            'prestation': label,
            'marque': marque,
            'modele': modele_clean,
            'motorisation': r.get('motorisation'),
            'prix_min': r.get('prix_ttc_min'),
            'prix_max': r.get('prix_ttc_max'),
            'temps_mo': r.get('temps_mo'),
        })
    out.sort(key=lambda x: (x['prestation'], x['marque'], x['modele']))
    return out


def build_codes_voyants():
    codes = []
    seen_codes = set()
    for r in load_many('codes-obd-*.json'):
        code = r.get('code')
        if not code:
            continue
        c = str(code).strip().upper()
        if c in seen_codes:
            continue
        seen_codes.add(c)
        codes.append({
            'code': c,
            'libelle': mt.to_text(r.get('libelle'))[:200],
            'gravite': r.get('gravite'),
            'causes': mt.to_text(r.get('causes_possibles'))[:320],
        })
    codes.sort(key=lambda x: x['code'])

    voyants = []
    seen_v = set()
    for r in load_many('pannes-*voyant*.json'):
        v = r.get('voyant')
        if not v:
            continue
        label = mt.strip_parens(str(v))
        key = mt.norm_key(label)
        if key in seen_v:
            continue
        seen_v.add(key)
        voyants.append({
            'voyant': label,
            'couleur': r.get('couleur'),
            'signification': mt.to_text(r.get('signification'))[:220],
            'gravite': r.get('gravite'),
            'action': mt.to_text(r.get('action_recommandee'))[:280],
        })
    voyants.sort(key=lambda x: x['voyant'])
    return {'codes': codes, 'voyants': voyants}


def build_demarches():
    out = []
    seen = set()
    for r in load_many('carte-grise-*demarche*.json'):
        d = r.get('demarche')
        if not d:
            continue
        label = mt.strip_parens(str(d))
        key = mt.norm_key(label)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            'demarche': label,
            'delai_legal': mt.to_text(r.get('delai_legal'))[:160],
            'delai_traitement': mt.to_text(r.get('delai_traitement_ants'))[:160],
            'cout': mt.to_text(r.get('cout_indicatif'))[:200],
            'documents': mt.to_text(r.get('documents_requis'))[:320],
        })
    out.sort(key=lambda x: x['demarche'])
    return out


def build_roadtrips():
    out = []
    seen = set()
    for r in load_many('roadtrips-destinations-*.json'):
        pays_raw = r.get('pays')
        if not pays_raw:
            continue
        pays = mt.fix_mojibake(str(pays_raw)).strip()
        key = mt.norm_key(pays)
        if key in seen:
            continue
        seen.add(key)
        out.append({
            'pays': pays,
            'systeme_peage': mt.fix_mojibake(mt.to_text(r.get('systeme_peage')))[:200],
            'prix': mt.fix_mojibake(mt.to_text(r.get('prix_indicatif')))[:220],
            'vehicules_concernes': mt.fix_mojibake(mt.to_text(r.get('vehicules_concernes')))[:160],
            'amende': mt.fix_mojibake(mt.to_text(r.get('amende_si_absente')))[:160],
            'particularites': mt.fix_mojibake(mt.to_text(r.get('particularites')))[:280],
        })
    out.sort(key=lambda x: x['pays'])
    return out


def write(name, data):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))  # compact : servi tel quel au client
    size_kb = os.path.getsize(path) / 1024
    n = len(data) if isinstance(data, list) else sum(len(v) for v in data.values())
    print(f'  {name:<22} {n:>5} entrées, {size_kb:>7.1f} Ko')


def main():
    print('Génération des données widgets (frontend/monauto/public/widgets/)')
    write('modeles.json', build_modeles())
    write('prix-entretien.json', build_prix_entretien())
    write('codes-voyants.json', build_codes_voyants())
    write('demarches.json', build_demarches())
    write('roadtrips.json', build_roadtrips())


if __name__ == '__main__':
    main()

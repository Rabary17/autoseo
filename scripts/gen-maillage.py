"""P3 - Génère/met à jour data/maillage/maillage.json à partir de tracking-mots-cles.xlsx.
Usage: python scripts/gen-maillage.py --all [--niche <id>]
           (recommandé : dérive automatiquement le hub_slug de chaque silo présent dans
           l'onglet Suivi via slugify() — évite de retaper les paires à la main à chaque
           nouveau silo/lot de candidats programmatiques promus)
       python scripts/gen-maillage.py "Silo & nom" "slug-hub" ["Autre silo" "autre-slug" ...] [--niche <id>]
           (mode explicite, pour ne régénérer qu'un ou deux silos précis)
--niche par défaut 'auto-mobilite' (config/niches/auto-mobilite/niche.json, data_dir='data' —
identique aux chemins historiques). Fusionne avec l'existant, n'écrase jamais les entrées d'un
autre silo.
"""
import argparse
import json
import re
import random
import sys
import os
import openpyxl

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib_py'))
import niche_config

random.seed(42)

def slugify(s):
    s = s.lower()
    repl = {'à':'a','â':'a','ä':'a','é':'e','è':'e','ê':'e','ë':'e','î':'i','ï':'i',
            'ô':'o','ö':'o','ù':'u','û':'u','ü':'u','ç':'c','œ':'oe','’':'-', "'":'-'}
    for k, v in repl.items():
        s = s.replace(k, v)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s

def anchor_variants(mot_cle, entite):
    return {
        "exacte_partielle": mot_cle,
        "naturelle_longue": f"tout savoir sur {mot_cle}" if len(mot_cle) < 30 else mot_cle,
        "entite_seule": entite,
        "generique": "cet article" if random.random() < 0.5 else "notre guide",
    }

def build_silo(rows, silo_name, hub_slug):
    # égalité stricte, pas une sous-chaîne : un test 'in' fusionnerait silencieusement deux
    # silos si le nom de l'un est un jour une sous-chaîne du nom d'un autre.
    filtered = [r for r in rows if r[2] and r[2] == silo_name]
    subs = {}
    skipped_no_sub = 0
    for r in filtered:
        if not r[3]:
            # sous_cocon vide/None (ligne mal remplie, ex. builder moteur incomplet) : on ne
            # la fusionne PAS sous une clé None/'' partagée avec d'autres lignes sans
            # sous-cocon — plutôt l'écarter et le signaler que produire une URL sous_hub
            # incohérente en silence.
            skipped_no_sub += 1
            continue
        subs.setdefault(r[3], []).append(r)
    if skipped_no_sub:
        print(f"  [warn] {silo_name} : {skipped_no_sub} ligne(s) sans sous_cocon ignorée(s) pour le maillage.")

    entries = []
    for sub_name, items in subs.items():
        sub_slug = slugify(sub_name)
        urls = [f"/{hub_slug}/{slugify(r[0])}" for r in items]
        for idx, r in enumerate(items):
            mot_cle = r[0]
            url = urls[idx]
            siblings = [u for j, u in enumerate(urls) if j != idx]
            random.shuffle(siblings)
            liens_lateraux = siblings[:min(5, max(3, len(siblings)))][:5]
            if len(liens_lateraux) < 3 and len(siblings) >= 3:
                liens_lateraux = siblings[:3]
            entries.append({
                "url": url,
                "mot_cle_principal": mot_cle,
                "silo": silo_name,
                "sous_hub": f"/{hub_slug}/{sub_slug}",
                "hub": f"/{hub_slug}",
                "liens_lateraux": liens_lateraux,
                "liens_transversaux": [],
                "ancres": anchor_variants(mot_cle, sub_name)
            })
    return entries

def main():
    argv = sys.argv[1:]
    niche_id = niche_config.DEFAULT_NICHE
    if '--niche' in argv:
        i = argv.index('--niche')
        niche_id = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    all_mode = argv == ['--all']

    niche = niche_config.load_niche(niche_id)
    xlsx_path = niche_config.data_path(niche, 'keywords', 'tracking-mots-cles.xlsx')
    out_path = niche_config.data_path(niche, 'maillage', 'maillage.json')

    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb['Suivi']
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    if all_mode:
        # Un hub_slug par silo distinct présent dans Suivi, dérivé de slugify() — couvre
        # aussi bien les silos 100% éditoriaux que ceux enrichis de candidats programmatiques,
        # sans avoir à connaître/retaper la liste des 19 silos à chaque exécution.
        distinct_silos = sorted({r[2] for r in rows if r[2]})
        pairs = [(s, slugify(s)) for s in distinct_silos]
        if not pairs:
            print("Aucun silo trouvé dans l'onglet Suivi — rien à faire.")
            sys.exit(0)
    elif not argv or len(argv) % 2 != 0:
        print('Usage: python scripts/gen-maillage.py --all [--niche <id>]')
        print('       python scripts/gen-maillage.py "Silo & nom" "slug-hub" [...] [--niche <id>]')
        sys.exit(1)
    else:
        pairs = list(zip(argv[0::2], argv[1::2]))

    all_entries = []
    for silo_name, hub_slug in pairs:
        all_entries += build_silo(rows, silo_name, hub_slug)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    existing = []
    if os.path.exists(out_path):
        with open(out_path, encoding='utf-8') as f:
            existing = json.load(f)

    existing_urls = {e['url'] for e in existing}
    merged = existing + [e for e in all_entries if e['url'] not in existing_urls]

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"{len(all_entries)} entrees traitees, {len(merged)} au total dans {out_path}")

if __name__ == '__main__':
    main()

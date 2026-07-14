"""P3 - Génère/met à jour data/maillage/maillage.json à partir de tracking-mots-cles.xlsx.
Usage: python scripts/gen-maillage.py "Silo & nom" "slug-hub" ["Autre silo" "autre-slug" ...]
Fusionne avec l'existant, n'écrase jamais les entrées d'un autre silo.
"""
import json
import re
import random
import sys
import os
import openpyxl

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
    filtered = [r for r in rows if r[2] and silo_name in r[2]]
    subs = {}
    for r in filtered:
        subs.setdefault(r[3], []).append(r)

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
    args = sys.argv[1:]
    if not args or len(args) % 2 != 0:
        print('Usage: python scripts/gen-maillage.py "Silo & nom" "slug-hub" [...]')
        sys.exit(1)
    pairs = list(zip(args[0::2], args[1::2]))

    wb = openpyxl.load_workbook('data/keywords/tracking-mots-cles.xlsx')
    ws = wb['Suivi']
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    all_entries = []
    for silo_name, hub_slug in pairs:
        all_entries += build_silo(rows, silo_name, hub_slug)

    out_path = 'data/maillage/maillage.json'
    os.makedirs('data/maillage', exist_ok=True)
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

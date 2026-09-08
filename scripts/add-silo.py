#!/usr/bin/env python
# Ajoute un silo à une niche EXISTANTE, sans éditer aucun code — industrialisation 2026-07-20.
# Avant : ajouter un silo exigeait d'éditer AUTHOR_MAP/SILO_ORDER dans populate-tracking-xlsx.py
# (et gen-maillage.py appelé avec la bonne paire silo/hub à la main). Ce script fait les deux
# opérations d'un coup, sur la config déclarative :
#   1. Ajoute le silo à config/niches/<id>/niche.json (silos[]).
#   2. Ajoute une entrée vide (sous-cocons sans mots-clés) à data/.../keywords/seeds.json, prête
#      pour que le contenu réel (mots-clés seed par sous-cocon) soit rempli avant de lancer P1 —
#      ce script ne DEVINE jamais de mots-clés, il ne fait que préparer la structure.
#
# Usage :
#   python scripts/add-silo.py <niche_id> "Nom du silo" hub-slug --author A \
#       --sous-cocons "Sous-cocon 1" "Sous-cocon 2" [...]
#
# Étapes suivantes affichées à la fin : remplir seeds.json, lancer fetch-keywords.js (P1),
# populate-tracking-xlsx.py, gen-maillage.py --all.
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib_py'))
import niche_config
import niche_firestore_sync


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('niche_id')
    parser.add_argument('silo_name')
    parser.add_argument('hub_slug')
    parser.add_argument('--author', required=True, help="Clé de persona déjà définie dans niche.json (ex. 'A')")
    parser.add_argument('--sous-cocons', nargs='+', default=[], help='Liste des sous-cocons du silo')
    args = parser.parse_args()

    niche = niche_config.load_niche(args.niche_id)

    if args.author not in niche['authors']:
        raise SystemExit(
            f"Persona '{args.author}' introuvable dans niche.json (personas définies : "
            f"{list(niche['authors'].keys())}). L'ajouter d'abord à config/niches/{args.niche_id}/niche.json."
        )

    if any(s['name'] == args.silo_name for s in niche['silos']):
        raise SystemExit(f"Le silo '{args.silo_name}' existe déjà dans cette niche.")
    if any(s['hub_slug'] == args.hub_slug for s in niche['silos']):
        raise SystemExit(f"Le hub_slug '{args.hub_slug}' est déjà utilisé par un autre silo de cette niche.")

    niche['silos'].append({
        'name': args.silo_name,
        'hub_slug': args.hub_slug,
        'author': args.author,
        'sous_cocons': args.sous_cocons,
        'seeds_file': f'{args.hub_slug}.json',
    })

    ndir = niche_config.niche_dir(args.niche_id)
    with open(os.path.join(ndir, 'niche.json'), 'w', encoding='utf-8') as f:
        json.dump(niche, f, ensure_ascii=False, indent=2)
    niche_firestore_sync.push_niche(args.niche_id)

    # Squelette dans seeds.json (fichier mère lu par fetch-keywords.js --niche) : sous-cocons
    # déjà déclarés, listes de mots-clés VIDES — jamais devinées.
    seeds_path = niche_config.data_path(niche, 'keywords', 'seeds.json')
    seeds = {}
    if os.path.exists(seeds_path):
        with open(seeds_path, encoding='utf-8') as f:
            seeds = json.load(f)
    if args.silo_name not in seeds:
        seeds[args.silo_name] = {
            'icon': '📄',
            'subs': [{'name': sc, 'kws': []} for sc in args.sous_cocons] or [{'name': args.silo_name, 'kws': []}],
        }
        os.makedirs(os.path.dirname(seeds_path), exist_ok=True)
        with open(seeds_path, 'w', encoding='utf-8') as f:
            json.dump(seeds, f, ensure_ascii=False, indent=2)
        seeds_created = True
    else:
        seeds_created = False

    print(f"Silo '{args.silo_name}' ajouté à la niche '{args.niche_id}' (hub /{args.hub_slug}, persona {args.author}).")
    if seeds_created:
        print(f"Squelette créé dans {os.path.relpath(seeds_path)} — {len(args.sous_cocons) or 1} sous-cocon(s), kws vides.")
        print("[important] Remplir les mots-clés seed par sous-cocon AVANT de lancer P1 (jamais devinés automatiquement).")
    else:
        print(f"Une entrée '{args.silo_name}' existait déjà dans {os.path.relpath(seeds_path)} — non modifiée.")

    print()
    print('Prochaines étapes :')
    print(f'  1. Éditer {os.path.relpath(seeds_path)} pour renseigner les mots-clés seed du silo.')
    print(f'  2. node scripts/fetch-keywords.js --niche {args.niche_id} --silo "{args.silo_name}"')
    print(f'  3. python scripts/populate-tracking-xlsx.py --niche {args.niche_id}')
    print(f'  4. python scripts/gen-maillage.py --all --niche {args.niche_id}')


if __name__ == '__main__':
    main()

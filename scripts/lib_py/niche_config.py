# Chargeur partagé de la config déclarative d'une niche — config/niches/<id>/niche.json.
#
# Avant l'industrialisation (2026-07-20), la taxonomie (silos, sous-cocons, auteurs) et les
# formules de "moteurs" programmatiques étaient codées en dur en Python, spécifiques à la
# niche "Auto & mobilité" (AUTHOR_MAP, SILO_ORDER dans populate-tracking-xlsx.py,
# PRESTATION_LABEL/SOUS_COCON dans expand-moteurs.py). Ajouter un silo ou une nouvelle niche
# exigeait donc d'éditer du code Python. Ce module centralise la lecture de la config JSON qui
# remplace ces dictionnaires : ajouter un silo = éditer/générer niche.json, jamais le code.
#
# Rétrocompatibilité : la niche par défaut 'auto-mobilite' pointe sur data_dir='data' (racine
# actuelle du projet), donc tous les scripts existants continuent de lire
# data/keywords/*, data/factuel/*, data/maillage/maillage.json exactement comme avant.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NICHES_DIR = os.path.join(ROOT, 'config', 'niches')
DEFAULT_NICHE = 'auto-mobilite'


class NicheConfigError(Exception):
    pass


def niche_dir(niche_id):
    return os.path.join(NICHES_DIR, niche_id)


def load_niche(niche_id=DEFAULT_NICHE):
    """Charge config/niches/<niche_id>/niche.json. Lève une erreur claire (jamais un
    dict par défaut deviné) si la niche n'existe pas — mieux vaut un échec net que de
    silencieusement retomber sur une autre niche."""
    path = os.path.join(niche_dir(niche_id), 'niche.json')
    if not os.path.exists(path):
        raise NicheConfigError(
            f"Niche '{niche_id}' introuvable ({path}). Niches disponibles : {list_niches()}. "
            f"Utiliser scripts/new-niche.py pour en créer une."
        )
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def load_moteurs(niche_id=DEFAULT_NICHE):
    """Charge config/niches/<niche_id>/moteurs.json (définitions déclaratives des moteurs
    programmatiques). Une niche sans moteurs.json (ou avec une liste vide) est valide —
    P1/P2/P3 éditorial ne dépendent pas des moteurs programmatiques."""
    path = os.path.join(niche_dir(niche_id), 'moteurs.json')
    if not os.path.exists(path):
        return {'moteurs': []}
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def list_niches():
    if not os.path.isdir(NICHES_DIR):
        return []
    return sorted(
        d for d in os.listdir(NICHES_DIR)
        if os.path.exists(os.path.join(NICHES_DIR, d, 'niche.json'))
    )


def data_path(niche, *parts):
    """Résout un chemin de données relatif à la racine data_dir de la niche (ex.
    data_path(niche, 'keywords', 'tracking-mots-cles.xlsx')). Pour 'auto-mobilite',
    data_dir='data' pointe sur la racine actuelle — chemins identiques à avant."""
    return os.path.join(ROOT, niche['data_dir'], *parts)


def author_map(niche):
    """{ nom_silo: label_auteur } — équivalent du AUTHOR_MAP historique."""
    return {s['name']: niche['authors'][s['author']]['label'] for s in niche['silos']}


def silo_order(niche):
    """Ordre de traitement des silos (ordre de niche.json['silos'], comme SILO_ORDER)."""
    return [s['name'] for s in niche['silos']]


def wp_author_slug_by_persona(niche):
    return {key: info['wp_slug'] for key, info in niche['authors'].items()}


def hub_slug(niche, silo_name):
    for s in niche['silos']:
        if s['name'] == silo_name:
            return s['hub_slug']
    return None

# Miroir Python de scripts/lib_js/niche-firestore-sync.js — pousse
# config/niches/<id>/niche.json vers Firestore (niches/{id}) après une
# création/édition locale (new-niche.py, add-silo.py). Repli gracieux : si
# FIREBASE_SERVICE_ACCOUNT_JSON n'est pas configuré, avertit et ne bloque
# jamais le script appelant — le fichier local reste utilisable seul, comme
# avant cette migration.
import json
import os

import niche_config

try:
    import firestore_client
except ImportError:
    firestore_client = None


def _has_firestore_configured():
    if os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON'):
        return True
    env_path = os.path.join(niche_config.ROOT, '.env')
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as f:
            return 'FIREBASE_SERVICE_ACCOUNT_JSON' in f.read()
    return False


def push_niche(niche_id):
    """Fichier local -> Firestore. Best-effort : n'échoue jamais le script appelant."""
    if not _has_firestore_configured() or firestore_client is None:
        print(f"niche_firestore_sync: FIREBASE_SERVICE_ACCOUNT_JSON absent — push ignore ({niche_id}).")
        return
    niche = niche_config.load_niche(niche_id)
    db = firestore_client.get_db()
    db.collection('niches').document(niche_id).set(niche)
    print(f"niche_firestore_sync: niche.json -> Firestore niches/{niche_id} : ok")

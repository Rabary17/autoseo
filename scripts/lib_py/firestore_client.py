# Client Firestore partagé côté Python — miroir de scripts/lib_js/firestore-client.js
# (même projet Firebase, mêmes credentials). Init paresseuse : ne se déclenche qu'au
# premier get_db(), jamais à l'import, pour ne pas casser les scripts qui n'ont pas
# besoin de Firestore (ex. gen-maillage.py une fois la niche déjà chargée en mémoire).
import json
import os

_app = None
_db = None


def _load_dotenv_fallback():
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(root, '.env')
    if not os.path.exists(env_path):
        return {}
    env = {}
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            if '=' not in line:
                continue
            key, _, value = line.partition('=')
            env[key.strip()] = value.strip()
    return env


_dotenv = _load_dotenv_fallback()


def _get_var(name):
    return os.environ.get(name) or _dotenv.get(name)


def get_db():
    global _app, _db
    if _db is not None:
        return _db
    raw = _get_var('FIREBASE_SERVICE_ACCOUNT_JSON')
    if not raw:
        raise RuntimeError(
            "firestore_client: FIREBASE_SERVICE_ACCOUNT_JSON doit etre defini (env ou .env local) — "
            "voir plan MVP SaaS interne pour la procedure de creation du compte de service Firebase."
        )
    try:
        service_account = json.loads(raw)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"firestore_client: FIREBASE_SERVICE_ACCOUNT_JSON illisible (JSON invalide) : {e}")
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        _app = firebase_admin.initialize_app(credentials.Certificate(service_account))
    else:
        _app = firebase_admin.get_app()
    _db = firestore.client()
    return _db

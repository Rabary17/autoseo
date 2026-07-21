#!/usr/bin/env python
# Classifie les modèles de data/factuel/marques-modeles-fiabilite-*.json par segment
# automobile (citadine, SUV compact, etc.) via des règles mots-clés — jamais un dictionnaire
# figé par modèle individuel (non maintenable), mais des patterns réutilisables. Un modèle non
# reconnu est EXCLU (pas de segment deviné) plutôt que mal classé — imprimé en fin de script
# pour revue manuelle éventuelle.
#
# À RELANCER après tout nouvel ajout de modèles (nouveau lot marques-modeles-fiabilite-*.json)
# pour que le moteur M5 (comparatifs par segment) en tienne compte.
#
# Sortie : data/factuel/segments-modeles.json — {modele_lower: segment}, consommé par le
# moteur M5 via le type générique 'grouped_versus' (scripts/lib_py/moteur_types.py).
import glob
import json
import re

def strip_parens(s):
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.split(r'\s*[,;:]\s*', s)[0]
    return re.sub(r'\s+', ' ', s).strip()

RULES = [
    (r'\b(mt-07|tmax|z650|cb500f|pcx125|vespa|liberty)\b', 'Moto & scooter'),

    (r'\b(silverado|sierra|ram 1500|\bram\b|f-150|f-250|super duty|hilux|ranger|amarok|\bl200\b|d-max|titan|tundra|gladiator|colorado)\b', 'Pickup'),
    (r'\b(kangoo|berlingo|partner|rifter|expert|jumpy|trafic|master|transit|ducato|jumper|boxer)\b', 'Utilitaire'),

    (r'\b(espace|scenic|scénic|picasso|touran|carnival|pacifica|odyssey|sienna|zafira|multivan|spacetourer|traveller|s-max|galaxy|807|\bc8\b|gran tourer)\b', 'Monospace'),

    (r'\b(911|mx-5|gr86|\bbrz\b|\btt\b|f-type|golf gti|m440i|amg a45|amg c63|charger|veloster|taycan|alpine|gr yaris|gr corolla|mustang|serie 4|tt rs|megane rs|mégane rs|208 gti|124 spider|370z|\bs3\b|\bz4\b|gr supra|i30 n)\b', 'Sportive & GT'),
    (r'\b(bentley|rolls-royce|urus|escalade|range rover(?! evoque)|wagoneer|hummer|\bq8\b|serie 7|classe s|gv80|panamera|\ba8\b|\bx6\b|\bgls\b|\bxj\b|\bls\b)\b', 'Premium & luxe'),

    (r'\b(2008|e-2008|3008|7008|5008|kadjar|arkana|austral|tiguan|t-roc|tucson|kona|creta|\basx\b|karoq|ateca|cx-30|cx-5|c5 aircross|c-hr|hr-v|compass|renegade|duster|bigster|\bq3\b|\bx1\b|\bgla\b|xc40|niro|\bev6\b|ioniq 5|solterra|ariya|zs ev|aion|model y|\bgv60\b|\bgv70\b|\bnx\b|enyaq|id\.4|id\.5|coolray|magnite|qashqai|kuga|grandland|macan|stelvio|tonale|q4 e-tron|\bix\b)\b', 'SUV compact'),
    (r'\b(captur|juke|t-cross|arona|bayon|cx-3|\bxv\b|c3 aircross|c4 cactus|stonic|\bpuma\b|mokka|vitara|jimny|s-cross|countryman|yaris cross|crossland|jeep avenger|\bavenger\b)\b', 'SUV urbain'),
    (r'\b(x-trail|rav4|outlander|grand cherokee|discovery sport|evoque|defender|land cruiser|\bx3\b|\bx5\b|\bq5\b|\bq7\b|\bglc\b|\bgle\b|xc60|xc90|kodiaq|sorento|santa fe|cr-v|sportage|\brx\b|cayenne|f-pace|forester)\b', 'SUV familial'),

    (r'\b(clio|twingo|\b108\b|\bc1\b|aygo|\b500\b|500e|panda|\bup!?\b|\bmii\b|citigo|\bkarl\b|\badam\b|corsa|\bka\b|picanto|\bi10\b|\bspark\b|swift|micra|polo|ibiza|fabia|\brio\b|punto|sandero|\bi20\b|jazz|\byaris\b|\b208\b|renault 5|\bfiesta\b|\bzoe\b|\bi3\b|logan|spring|\bc3\b|cooper)\b', 'Citadine'),

    (r'\b(golf|\b308\b|megane|astra|focus|\bceed\b|\bleon\b|\ba3\b|civic|\bi30\b|corolla|\bauris\b|mazda 3|\btipo\b|impreza|\bvesta\b|forte|cerato|\brapid\b|slavia|leaf|\bid\.3\b|prius|\bmg4\b|classe a|classe b|serie 1|\bc4\b(?! picasso| cactus)|\bkoleos\b)\b', 'Compacte'),

    (r'\b(passat|insignia|talisman|\b508\b|\b408\b|mondeo|\ba4\b|\ba6\b|serie 3|série 3|serie 5|classe c|classe e|superb|octavia|camry|accord|sonata|malibu|maxima|legacy|\bs60\b|\bs90\b|\bv60\b|\bes\b|stinger|elantra|300c|jetta|altima|model 3|model s|giulia|\bxe\b|\bxf\b|id\.7|\bi4\b|eqe|laguna)\b', 'Berline & break'),
]


def classify(model_name):
    low = model_name.lower()
    for pattern, segment in RULES:
        if re.search(pattern, low):
            return segment
    return None


def main():
    models = []
    seen = set()
    for f in sorted(glob.glob('data/factuel/marques-modeles-fiabilite-*.json')):
        with open(f, encoding='utf-8-sig') as fh:
            d = json.load(fh)
        recs = d if isinstance(d, list) else d.get('entrees', [])
        for r in recs:
            m = r.get('modele')
            if not m:
                continue
            clean = strip_parens(str(m))
            if len(clean) < 3:
                continue
            k = clean.lower()
            if k in seen:
                continue
            seen.add(k)
            models.append(clean)

    result = {}
    unclassified = []
    for m in models:
        seg = classify(m)
        if seg:
            result[m.lower()] = seg
        else:
            unclassified.append(m)

    with open('data/factuel/segments-modeles.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2, sort_keys=True)

    from collections import Counter
    counts = Counter(result.values())
    print(f'{len(result)}/{len(models)} modèles classés par segment.')
    for seg, c in sorted(counts.items(), key=lambda x: -x[1]):
        print(f'  {seg:<20} {c:>4}')
    print(f'\n{len(unclassified)} non classés (exclus de M5, pas devinés).')


if __name__ == '__main__':
    main()

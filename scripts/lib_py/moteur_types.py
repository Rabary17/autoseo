# Bibliothèque de "stratégies" génériques pour générer des candidats programmatiques
# (mots-clés composés par formule) à partir d'une base factuelle, PILOTÉES PAR CONFIG
# (config/niches/<id>/moteurs.json) plutôt que par du code Python spécifique à une niche.
#
# Avant l'industrialisation (2026-07-20), scripts/expand-moteurs.py codait en dur 7 "moteurs"
# spécifiques à l'automobile (prestation × marque × modèle, code OBD, modèle × angle...).
# Ajouter un moteur pour une nouvelle niche (ex. recette × ingrédient pour un site cuisine)
# exigeait d'écrire du nouveau code Python. Ce module extrait le PATTERN générique derrière
# les 7 moteurs existants en 4 "types" réutilisables :
#
#   - cross           : entité A (avec libellé mappé) × entité B (gabarit de champs)
#                        ex. M1 (prestation × véhicule), M4 (pièce × équipementier)
#   - single_entity    : un champ devient directement le mot-clé (avec préfixe/suffixe)
#                        ex. M2 (code OBD, voyant), M6 (démarche carte grise)
#   - entity_angles    : une entité × une liste fixe d'angles éditoriaux
#                        ex. M3 (modèle × fiabilité/pannes/entretien/occasion),
#                            M7 (pays × road-trip/péage/vignette)
#   - paired_versus    : les 2 premiers éléments d'un champ liste, mis en comparatif
#                        ex. sous-cas de M4 (Bosch vs Valeo)
#
# Un même moteur peut composer plusieurs de ces types s'il génère plusieurs familles de
# candidats (voir "sub_builders" dans le schéma moteurs.json).
import glob
import json
import os
import re
import unicodedata


# --------------------------------------------------------------------------- texte générique

def fix_mojibake(s):
    """Certains fichiers factuels ont été sauvés en double-encodage UTF-8. Si on détecte des
    marqueurs typiques, on retente un décodage latin-1 -> utf-8."""
    if not isinstance(s, str):
        return s
    if any(m in s for m in ('Ã', 'â‚¬', 'â€”', 'â€™', 'Â')):
        try:
            return s.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            return s
    return s


def strip_parens(s):
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.split(r'\s*[,;:]\s*', s)[0]
    return re.sub(r'\s+', ' ', s).strip()


def norm_kw(s):
    """Normalise un mot-clé candidat : minuscules, espaces compressés, apostrophes propres.
    Conserve les accents (mots-clés FR de Haloscan accentués)."""
    s = fix_mojibake(s)
    s = s.replace("’", "'").replace("‘", "'")
    s = s.lower()
    s = re.sub(r'\s+', ' ', s)
    return s.strip(" -'")


def norm_key(s):
    """Clé de déduplication : sans accents ni ponctuation."""
    s = unicodedata.normalize('NFD', norm_kw(s))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r"[^a-z0-9]+", ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def norm_field_key(raw):
    """Normalise la valeur BRUTE d'un champ (ex. 'prestation', 'demarche') en clé
    snake_case stable — insensible aux variantes de casse/espaces/accents/élisions
    rencontrées entre plusieurs fichiers factuels compilés à des sessions différentes
    (ex. 'plaquettes_frein' vs 'Plaquettes frein' vs 'plaquettes_de_frein')."""
    s = fix_mojibake(str(raw or ''))
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r"\b[dl]'", '', s)  # élision "d'allumage" -> "allumage"
    s = re.sub(r'[^a-z0-9]+', '_', s).strip('_')
    return s


def uniq(seq):
    seen, out = set(), []
    for x in seq:
        k = norm_key(x)
        if k and k not in seen:
            seen.add(k)
            out.append(norm_kw(x))
    return out


def to_text(v):
    """Aplatit une valeur factuelle en texte lisible (certains lots stockent une liste
    d'objets plutôt qu'une chaîne — évite d'écrire un repr Python brut)."""
    if v is None:
        return ''
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        parts = []
        for it in v:
            if isinstance(it, dict):
                parts.append(' '.join(str(x) for x in it.values() if x))
            else:
                parts.append(str(it))
        return ' ; '.join(p for p in parts if p)
    if isinstance(v, dict):
        return ' ; '.join(f'{k}: {val}' for k, val in v.items() if val)
    return str(v)


# --------------------------------------------------------------------------- chargement des données

def load_records(path):
    """Extrait la liste d'enregistrements d'un fichier factuel, quel que soit l'emballage."""
    import json
    try:
        with open(path, encoding='utf-8-sig') as f:
            data = json.load(f)
    except (Exception,) as e:
        print(f'  [warn] {os.path.basename(path)} illisible : {e}')
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ('entrees', 'codes', 'entries', 'items', 'data'):
            if isinstance(data.get(k), list):
                return data[k]
    return []


def load_many(factuel_dir, pattern):
    records = []
    for path in sorted(glob.glob(os.path.join(factuel_dir, pattern))):
        records.extend(load_records(path))
    return records


# --------------------------------------------------------------------------- résolution label/sous-cocon/silo

def resolve_key(raw, aliases):
    k = norm_field_key(raw)
    return aliases.get(k, k)


def resolve_by_rules(key_or_text, rules, default):
    """rules : liste de {"contains": [mots...], "label": "..."} — la première règle dont
    un des mots est une sous-chaîne de key_or_text (en minuscule) s'applique. Générique,
    utilisable pour n'importe quelle niche (pas seulement carte grise/automobile)."""
    low = key_or_text.lower()
    for rule in rules:
        if any(k in low for k in rule['contains']):
            return rule['label']
    return default


def resolve_label(key, moteur_def, warn_prefix=''):
    label = moteur_def.get('label_map', {}).get(key)
    if label:
        return label
    print(f"  [warn]{warn_prefix} clé non mappée dans label_map : {key!r} — candidat ignoré.")
    return None


def resolve_sous_cocon(key, moteur_def):
    sc_map = moteur_def.get('sous_cocon_map', {})
    if key in sc_map:
        return sc_map[key]
    rules = moteur_def.get('sous_cocon_rules')
    if rules:
        return resolve_by_rules(key, rules, moteur_def.get('sous_cocon_default', ''))
    return moteur_def.get('sous_cocon_default', '')


def resolve_silo(key, moteur_def):
    return moteur_def.get('silo_override_map', {}).get(key, moteur_def['silo_default'])


def render_note(record, note_fields):
    """note_fields : liste de specs génériques :
      {"type": "range", "min_field", "max_field", "template": "prix {min}-{max}€ TTC"}
      {"type": "value", "field", "template": "MO {value} min", "strip_suffix_regex": "..."}
      {"type": "value", "field"}  (pas de template -> valeur brute aplatie via to_text)
      {"type": "first_nonempty", "fields": ["pannes_courantes", "score_fiabilite"]}
          -> premier champ non vide de la liste (ex. M3/M7 : deux champs alternatifs
          selon ce qui a été renseigné dans le lot factuel)
    """
    bits = []
    for spec in note_fields or []:
        if spec['type'] == 'range':
            a, b = record.get(spec['min_field']), record.get(spec['max_field'])
            if a and b:
                bits.append(spec['template'].format(min=a, max=b))
        elif spec['type'] == 'value':
            v = record.get(spec['field'])
            if not v:
                continue
            v = fix_mojibake(to_text(v))
            if spec.get('strip_suffix_regex'):
                v = re.sub(spec['strip_suffix_regex'], '', v.strip(), flags=re.I)
            bits.append(spec['template'].format(value=v) if spec.get('template') else v)
        elif spec['type'] == 'first_nonempty':
            v = ''
            for f in spec['fields']:
                v = fix_mojibake(to_text(record.get(f)))
                if v:
                    break
            if v:
                bits.append(v)
    return ' ; '.join(bits)[:180]


def render_template(template, **kwargs):
    try:
        return template.format(**kwargs)
    except KeyError:
        return template


# --------------------------------------------------------------------------- stratégies

def _resolve_label_and_key(raw_a, moteur_def, warn_prefix):
    """label_mode 'map' (défaut) : clé normalisée -> label via label_map/label_aliases,
    candidat écarté si non mappé (ex. M1 : prestation -> "vidange"). label_mode 'identity' :
    le libellé est l'entité elle-même, nettoyée (ex. M4 : "Plaquettes de frein" telle quelle,
    pas de dictionnaire de traduction nécessaire)."""
    if moteur_def.get('label_mode') == 'identity':
        label = strip_parens(str(raw_a)) if moteur_def.get('strip_field_a') else str(raw_a)
        return label, resolve_key(raw_a, moteur_def.get('label_aliases', {}))
    key = resolve_key(raw_a, moteur_def.get('label_aliases', {}))
    label = resolve_label(key, moteur_def, warn_prefix=warn_prefix)
    return label, key


def build_cross(factuel_dir, moteur_def, out):
    """entité A (libellé résolu depuis field_a) × entité B — deux formes pour B :
      - field_b_template : gabarit combinant plusieurs champs scalaires du même
        enregistrement (ex. M1 : "{marque} {modele}")
      - field_b_list : un champ LISTE, une combinaison générée PAR ÉLÉMENT de la liste
        (ex. M4 : famille × chaque équipementier de equipementiers_reconnus)
    """
    recs = load_many(factuel_dir, moteur_def['source_glob'])
    field_a = moteur_def['field_a']
    n = 0
    for r in recs:
        raw_a = r.get(field_a)
        if not raw_a:
            continue

        label, key = _resolve_label_and_key(raw_a, moteur_def, warn_prefix=f" [{moteur_def.get('id')}]")
        if label is None:
            continue

        if 'field_b_list' in moteur_def:
            items = [str(x).strip() for x in (r.get(moteur_def['field_b_list']) or []) if str(x).strip()]
            b_values = items
        else:
            field_b_template = moteur_def['field_b_template']
            strip_fields = set(moteur_def.get('field_b_strip_parens', []))
            b_fields = {}
            missing = False
            for fname in re.findall(r'\{(\w+)\}', field_b_template):
                v = r.get(fname)
                if not v:
                    missing = True
                    break
                b_fields[fname] = strip_parens(str(v)) if fname in strip_fields else str(v)
            b_values = [] if missing else [render_template(field_b_template, **b_fields).strip()]

        for b in b_values:
            base = f'{label} {b}'.strip()
            variantes = uniq([
                render_template(t, base=base, label=label, b=b, **r)
                for t in moteur_def.get('variantes_templates', [])
            ])
            out.append({
                'moteur': moteur_def['label'],
                'mot_cle_principal': norm_kw(base),
                'variantes': variantes,
                'silo': resolve_silo(key, moteur_def),
                'sous_cocon': resolve_sous_cocon(key, moteur_def),
                'intention': moteur_def.get('intention', 'Info'),
                'entite_source': f'{label} / {b}' if 'field_b_list' in moteur_def else b,
                'note': render_note(r, moteur_def.get('note_fields')),
            })
            n += 1
    return n


def build_single_entity(factuel_dir, moteur_def, out):
    """Un champ devient directement (avec gabarit optionnel) le mot-clé principal.

    - strip_parens : nettoie les qualificatifs entre parenthèses de la valeur brute.
    - base_template ("{value} ...") : gabarit appliqué à la valeur (minuscule) pour former
      le mot-clé. Si template_unless_contains est défini et que ce texte apparaît déjà dans
      la valeur, le gabarit n'est PAS appliqué (évite ex. "carte grise carte grise").
    - sous_cocon_match_on: "key" (défaut, clé normalisée — ex. constante ou map exacte) |
      "value" (les sous_cocon_rules matchent le TEXTE BRUT en minuscule, pas une clé
      snake_case — nécessaire quand les règles contiennent des espaces/mots complets,
      ex. M6 "changement de titulaire").
    - variantes_templates : chaîne (toujours généré) OU dict {"template", "requires_field"}
      (généré seulement si ce champ est non vide dans l'enregistrement — ex. M2 voyants,
      la variante "{base} {couleur}" n'a de sens que si une couleur est renseignée).
    """
    recs = load_many(factuel_dir, moteur_def['source_glob'])
    field = moteur_def['field']
    base_template = moteur_def.get('base_template', '{value}')
    match_on_value = moteur_def.get('sous_cocon_match_on') == 'value'
    n = 0
    for r in recs:
        raw = r.get(field)
        if not raw:
            continue
        value = strip_parens(str(raw)) if moteur_def.get('strip_parens') else fix_mojibake(str(raw)).strip()
        low = value.lower()
        unless = moteur_def.get('template_unless_contains')
        if unless and unless.lower() in low:
            base = low
        else:
            base = render_template(base_template, value=low)

        key = resolve_key(value, moteur_def.get('label_aliases', {}))
        variantes = []
        for t in moteur_def.get('variantes_templates', []):
            if isinstance(t, dict):
                if not r.get(t.get('requires_field')):
                    continue
                t = t['template']
            variantes.append(render_template(t, base=base, value=low, **r))
        variantes = uniq(variantes)

        out.append({
            'moteur': moteur_def['label'],
            'mot_cle_principal': norm_kw(base),
            'variantes': variantes,
            'silo': resolve_silo(key, moteur_def),
            'sous_cocon': resolve_sous_cocon(low if match_on_value else key, moteur_def),
            'intention': moteur_def.get('intention', 'Info'),
            'entite_source': value,
            'note': render_note(r, moteur_def.get('note_fields')),
        })
        n += 1
    return n


def build_entity_angles(factuel_dir, moteur_def, out):
    """Une entité (field) × une liste fixe d'angles éditoriaux (moteur_def['angles'])."""
    recs = load_many(factuel_dir, moteur_def['source_glob'])
    field = moteur_def['field']
    min_len = moteur_def.get('min_entity_length', 0)
    dedup_by_entity = moteur_def.get('dedup_by_entity', False)
    n = 0
    seen_entities = set()
    for r in recs:
        raw = r.get(field)
        if not raw:
            continue
        entity = strip_parens(str(raw)) if moteur_def.get('strip_parens') else fix_mojibake(str(raw)).strip()
        if len(entity) < min_len:
            continue
        if dedup_by_entity:
            ek = norm_key(entity)
            if not ek or ek in seen_entities:
                continue
            seen_entities.add(ek)

        note = render_note(r, moteur_def.get('note_fields'))
        for angle in moteur_def['angles']:
            base = render_template(angle['suffix_template'], entity=entity)
            variantes = uniq([
                render_template(t, entity=entity.lower(), base=base)
                for t in angle.get('variantes_templates', [])
            ])
            out.append({
                'moteur': moteur_def['label'],
                'mot_cle_principal': norm_kw(base),
                'variantes': variantes,
                'silo': angle.get('silo', moteur_def.get('silo_default')),
                'sous_cocon': angle['sous_cocon'],
                'intention': angle.get('intention', moteur_def.get('intention', 'Info')),
                'entite_source': entity,
                'note': note,
            })
            n += 1
    return n


def build_paired_versus(factuel_dir, moteur_def, out):
    """Les 2 premiers éléments d'un champ liste (ex. équipementiers_reconnus), mis en comparatif."""
    recs = load_many(factuel_dir, moteur_def['source_glob'])
    entity_field = moteur_def['entity_field']
    list_field = moteur_def['list_field']
    n = 0
    for r in recs:
        entity = r.get(entity_field)
        items = [str(x).strip() for x in (r.get(list_field) or []) if str(x).strip()]
        if not entity or len(items) < 2:
            continue
        entity = strip_parens(str(entity))
        e1, e2 = items[0], items[1]
        base = render_template(moteur_def['base_template'], e1=e1, e2=e2, entity=entity)
        variantes = uniq([
            render_template(t, e1=e1, e2=e2, entity=entity)
            for t in moteur_def.get('variantes_templates', [])
        ])
        out.append({
            'moteur': moteur_def['label'],
            'mot_cle_principal': norm_kw(base),
            'variantes': variantes,
            'silo': moteur_def['silo_default'],
            'sous_cocon': moteur_def.get('sous_cocon_default', ''),
            'intention': moteur_def.get('intention', 'Info'),
            'entite_source': f'{entity} : {e1} vs {e2}',
            'note': render_note(r, moteur_def.get('note_fields')),
        })
        n += 1
    return n


def build_grouped_versus(factuel_dir, moteur_def, out):
    """Regroupe les entités d'un champ par une catégorie partagée résolue via un fichier de
    mapping externe (group_map_file, ex. data/factuel/segments-modeles.json : {modele: segment})
    — PAS un champ déjà présent dans les enregistrements. Comparatifs formés par PAIRES
    CONSÉCUTIVES après tri au sein de chaque groupe (croissance linéaire N-1 par groupe, pas
    combinatoire C(N,2)) — garantit que chaque comparatif oppose deux entités du même groupe
    (ex. même segment automobile), sans jamais deviner quelles paires précises seraient les
    plus recherchées : c'est la validation Haloscan qui tranchera ensuite.
    Une entité absente du mapping (non classée) est EXCLUE, jamais rattachée à un groupe par
    défaut."""
    recs = load_many(factuel_dir, moteur_def['source_glob'])
    entity_field = moteur_def['entity_field']
    group_map_path = os.path.join(factuel_dir, moteur_def['group_map_file'])
    with open(group_map_path, encoding='utf-8') as f:
        group_map = json.load(f)

    groups = {}
    seen_entities = set()
    for r in recs:
        raw = r.get(entity_field)
        if not raw:
            continue
        entity = strip_parens(str(raw)) if moteur_def.get('strip_parens') else fix_mojibake(str(raw)).strip()
        if len(entity) < moteur_def.get('min_entity_length', 0):
            continue
        ek = norm_key(entity)
        if not ek or ek in seen_entities:
            continue
        seen_entities.add(ek)
        group = group_map.get(entity.lower())
        if not group:
            continue
        groups.setdefault(group, []).append(entity)

    n = 0
    for group, entities in groups.items():
        entities = sorted(entities)
        for i in range(len(entities) - 1):
            e1, e2 = entities[i], entities[i + 1]
            k1, k2 = norm_key(e1), norm_key(e2)
            if k1 == k2 or k1.startswith(k2) or k2.startswith(k1):
                # même modèle de base (génération/variante différente, ex. "Jeep Compass" vs
                # "Jeep Compass 2", ou doublon d'alias "Peugeot Expert" vs "Peugeot Expert /
                # Citroen Jumpy") — pas un vrai comparatif, on saute cette paire.
                continue
            base = render_template(moteur_def['base_template'], e1=e1, e2=e2, group=group)
            variantes = uniq([
                render_template(t, e1=e1, e2=e2, group=group)
                for t in moteur_def.get('variantes_templates', [])
            ])
            out.append({
                'moteur': moteur_def['label'],
                'mot_cle_principal': norm_kw(base),
                'variantes': variantes,
                'silo': moteur_def.get('silo_default'),
                'sous_cocon': render_template(moteur_def.get('sous_cocon_template', '{group}'), group=group),
                'intention': moteur_def.get('intention', 'Commercial'),
                'entite_source': f'{e1} vs {e2} ({group})',
                'note': f'Comparatif au sein du segment {group}.',
            })
            n += 1
    return n


STRATEGIES = {
    'cross': build_cross,
    'single_entity': build_single_entity,
    'entity_angles': build_entity_angles,
    'paired_versus': build_paired_versus,
    'grouped_versus': build_grouped_versus,
}


def run_moteur(factuel_dir, moteur_def, out):
    """Un moteur peut avoir un seul type direct (moteur_def['type']), ou plusieurs
    sous-builders (moteur_def['sub_builders'] : liste de defs partageant id/label/silo par
    défaut, chacune avec son propre 'type' — ex. M4 = cross + paired_versus)."""
    if 'sub_builders' in moteur_def:
        total = 0
        for sub in moteur_def['sub_builders']:
            merged = {**moteur_def, **sub}
            merged.pop('sub_builders', None)  # sinon la fusion recree infiniment la meme cle
            total += run_moteur(factuel_dir, merged, out)
        return total
    strategy = STRATEGIES.get(moteur_def['type'])
    if not strategy:
        raise ValueError(f"Type de moteur inconnu : {moteur_def['type']!r} (moteur {moteur_def.get('id')})")
    return strategy(factuel_dir, moteur_def, out)

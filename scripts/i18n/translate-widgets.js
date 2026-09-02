#!/usr/bin/env node
// Traduction FR -> EN des données factuelles des outils interactifs
// (frontend/monauto/public/widgets/*.json -> public/widgets/en/*.json).
//
// Décision utilisateur du 2026-09-02 : "lancer le run complet, je valide
// après coup", suite à l'ajout de /outils/ sur la home et à la demande de
// dupliquer les outils en anglais. Script dédié plutôt qu'une extension de
// scripts/i18n/translate.js : ces fichiers sont des tableaux JSON plats issus
// de data/factuel/ (voir scripts/build-widget-data.py), pas des articles
// WordPress — ni pages/posts, ni maillage, ni gating éditorial à rejouer ici.
// Réutilise uniquement le client Mistral (même fournisseur/modèle que le
// reste de i18n/).
//
// "Assistant carte grise" (demarches.json) est volontairement EXCLU : décrit
// des démarches administratives françaises (SIV, ANTS, cerfa) sans équivalent
// pour un lecteur anglophone hors France — même logique déjà actée dans
// config/i18n.json (silos_traduisibles n'inclut pas "carte-grise-demarches").
//
// Stratégie : les champs à faible cardinalité (prestation, motorisation,
// segment, couleur, gravité — quelques dizaines de valeurs distinctes réparties
// sur des milliers de lignes) sont traduits UNE FOIS par lot ("lookup"), puis
// réappliqués par simple correspondance. Seuls les champs à texte libre
// réellement uniques par ligne (fiabilité/pannes, libellé/causes,
// signification/action, et tous les champs des road trips) sont traduits
// ligne par ligne, par lots.
//
// Usage :
//   node scripts/i18n/translate-widgets.js [--only=prix,modeles,codes,roadtrips]
const fs = require('fs');
const path = require('path');
const mistralClient = require('../autopublish/lib/mistral-client');

const WIDGETS_DIR = path.join(__dirname, '..', '..', 'frontend', 'monauto', 'public', 'widgets');
const OUT_DIR = path.join(WIDGETS_DIR, 'en');
const i18nConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'i18n.json'), 'utf8'));
const MODEL = i18nConfig.traduction.modele;
const MAX_TOKENS = i18nConfig.traduction.max_tokens;

const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;
const should = (key) => !ONLY || ONLY.has(key);

const SYSTEM_BASE = `Tu traduis des données factuelles automobiles du français vers l'anglais (variante britannique), pour des outils interactifs d'un site auto (pas des articles).

RÈGLES ABSOLUES
- Traduis le sens, jamais mot à mot : le résultat doit sonner naturel pour un lecteur natif.
- Ne change AUCUN nombre, prix, code (ex. codes défaut OBD comme "P0420"), ni unité. Une valeur en euros reste en euros, ne convertis jamais.
- Garde les noms de marques et de modèles de véhicules strictement inchangés (ex. "Peugeot", "308 GTi", "Fiat Ducato").
- Un terme administratif ou technique français sans équivalent direct (ex. "contrôle technique", "carte grise") se traduit littéralement en gardant le terme français entre parenthèses à la première occurrence utile. N'invente aucune équivalence réglementaire d'un autre pays.
- Ne remplace JAMAIS une institution ou un organisme français par un équivalent étranger (jamais DVLA, MOT, DMV, TÜV...).
- Si un champ d'entrée est une chaîne vide, renvoie une chaîne vide en sortie — n'invente rien pour la compléter.
- Si un champ vaut exactement "non applicable", renvoie-le identique et inchangé : c'est un marqueur technique lu par le code, pas du texte affiché.
- Réponds pour CHAQUE élément de la liste reçue, dans n'importe quel ordre, en recopiant le champ "id" tel quel (c'est la clé de réassemblage).`;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildBatchSchema(name, fields) {
  const properties = { id: { type: 'integer' } };
  for (const f of fields) properties[f] = { type: 'string' };
  return {
    name,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties,
            required: ['id', ...fields],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  };
}

// items: [{ id, <field>: string, ... }] (chaînes vides pour les valeurs absentes,
// jamais null — le schéma JSON strict n'accepte qu'un type par champ).
async function translateRows(label, items, fields, batchSize) {
  if (!items.length) return new Map();
  const schema = buildBatchSchema(`${label}_traduit`, fields);
  const out = new Map();
  const batches = chunk(items, batchSize);
  let totalOut = 0;
  for (const [i, batch] of batches.entries()) {
    process.stdout.write(`[${label}] lot ${i + 1}/${batches.length} (${batch.length} élément(s))...`);
    const res = await mistralClient.callMistral({
      model: MODEL,
      maxTokens: MAX_TOKENS,
      system: SYSTEM_BASE,
      messages: [{ role: 'user', content: JSON.stringify(batch) }],
      schema,
    });
    for (const item of res.parsed.items) out.set(item.id, item);
    totalOut += res.usage.output_tokens;
    console.log(` ok (${res.usage.output_tokens} tokens de sortie).`);
  }
  console.log(`[${label}] terminé — ${items.length} élément(s), ${totalOut} tokens de sortie au total.\n`);
  return out;
}

// Traduit une liste de chaînes distinctes (catégories) en un seul lot, renvoie
// une Map fr -> en. `null`/valeurs absentes ne sont jamais envoyées : gérées
// par l'appelant.
async function translateLookup(label, distinctValues) {
  const items = distinctValues.map((v, id) => ({ id, texte: v }));
  const translated = await translateRows(label, items, ['texte'], Math.max(items.length, 1));
  const map = new Map();
  for (const [id, v] of translated) map.set(distinctValues[id], v.texte);
  return map;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(WIDGETS_DIR, file), 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(data), 'utf8');
  console.log(`-> écrit public/widgets/en/${file}\n`);
}

// Bug d'encodage constaté dans prix-entretien.json ("Ã©lectrique" au lieu de
// "électrique", cohabitant avec la bonne orthographe) — corrigé ici pour ne
// pas dupliquer la catégorie côté anglais ; le fichier source français n'est
// pas modifié (hors périmètre de cette tâche).
function fixMojibake(s) {
  return s === 'Ã©lectrique' ? 'électrique' : s;
}

/* ---------- 1. Calculateur de prix d'entretien ---------- */

async function translatePrixEntretien() {
  const rows = readJson('prix-entretien.json');
  const prestations = [...new Set(rows.map((r) => r.prestation))];
  const motorisations = [...new Set(rows.map((r) => fixMojibake(r.motorisation)).filter(Boolean))];
  const lookup = await translateLookup('prix-entretien-categories', [...prestations, ...motorisations]);

  const out = rows.map((r) => ({
    ...r,
    prestation: lookup.get(r.prestation) ?? r.prestation,
    motorisation: r.motorisation ? lookup.get(fixMojibake(r.motorisation)) ?? r.motorisation : r.motorisation,
  }));
  writeJson('prix-entretien.json', out);
}

/* ---------- 2. Comparateur de véhicules / Mon véhicule ---------- */

async function translateModeles() {
  const rows = readJson('modeles.json');
  const segments = [...new Set(rows.map((r) => r.segment).filter(Boolean))];
  const segmentMap = await translateLookup('modeles-segments', segments);

  const items = rows.map((r, id) => ({ id, fiabilite: r.fiabilite || '', pannes: r.pannes || '' }));
  const translated = await translateRows('modeles-texte', items, ['fiabilite', 'pannes'], 50);

  const out = rows.map((r, id) => {
    const t = translated.get(id);
    return {
      ...r,
      segment: r.segment ? segmentMap.get(r.segment) ?? r.segment : r.segment,
      fiabilite: t && t.fiabilite ? t.fiabilite : r.fiabilite,
      pannes: t && t.pannes ? t.pannes : r.pannes,
    };
  });
  writeJson('modeles.json', out);
}

/* ---------- 3. Diagnostic (codes + voyants) ---------- */

async function translateCodesVoyants() {
  const data = readJson('codes-voyants.json');

  const gravitesCodes = [...new Set(data.codes.map((c) => c.gravite).filter(Boolean))];
  const gravitesVoyants = [...new Set(data.voyants.map((v) => v.gravite).filter(Boolean))];
  const couleurs = [...new Set(data.voyants.map((v) => v.couleur).filter(Boolean))];
  const lookup = await translateLookup('codes-voyants-categories', [
    ...new Set([...gravitesCodes, ...gravitesVoyants, ...couleurs]),
  ]);

  const codeItems = data.codes.map((c, id) => ({ id, libelle: c.libelle || '', causes: c.causes || '' }));
  const codesTraduits = await translateRows('codes', codeItems, ['libelle', 'causes'], 60);

  const voyantItems = data.voyants.map((v, id) => ({
    id,
    voyant: v.voyant || '',
    signification: v.signification || '',
    action: v.action || '',
  }));
  const voyantsTraduits = await translateRows('voyants', voyantItems, ['voyant', 'signification', 'action'], 45);

  const codes = data.codes.map((c, id) => {
    const t = codesTraduits.get(id);
    return {
      ...c,
      gravite: c.gravite ? lookup.get(c.gravite) ?? c.gravite : c.gravite,
      libelle: t && t.libelle ? t.libelle : c.libelle,
      causes: t ? t.causes : c.causes,
    };
  });
  const voyants = data.voyants.map((v, id) => {
    const t = voyantsTraduits.get(id);
    return {
      ...v,
      couleur: v.couleur ? lookup.get(v.couleur) ?? v.couleur : v.couleur,
      gravite: v.gravite ? lookup.get(v.gravite) ?? v.gravite : v.gravite,
      voyant: t && t.voyant ? t.voyant : v.voyant,
      signification: t && t.signification ? t.signification : v.signification,
      action: t ? t.action : v.action,
    };
  });
  writeJson('codes-voyants.json', { codes, voyants });
}

/* ---------- 4. Péages & vignettes en Europe ---------- */

async function translateRoadtrips() {
  const rows = readJson('roadtrips.json');
  const fields = ['pays', 'systeme_peage', 'prix', 'vehicules_concernes', 'amende', 'particularites'];
  const items = rows.map((r, id) => ({ id, ...Object.fromEntries(fields.map((f) => [f, r[f] || ''])) }));
  const translated = await translateRows('roadtrips', items, fields, 20);

  const out = rows.map((r, id) => {
    const t = translated.get(id) || {};
    const merged = { ...r };
    for (const f of fields) if (t[f]) merged[f] = t[f];
    return merged;
  });
  writeJson('roadtrips.json', out);
}

/* ---------- Orchestration ---------- */

(async () => {
  console.log(`=== Traduction des outils FR -> EN (modèle ${MODEL}) ===\n`);
  if (should('prix')) await translatePrixEntretien();
  if (should('modeles')) await translateModeles();
  if (should('codes')) await translateCodesVoyants();
  if (should('roadtrips')) await translateRoadtrips();
  console.log('Terminé. "Assistant carte grise" (demarches.json) volontairement non traduit — voir en-tête du script.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

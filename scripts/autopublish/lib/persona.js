// Mapping silo → auteur → skill de rédaction dédié. Source de vérité du
// mapping pour la niche auto-mobilité : skills/wordpress-publication.md
// section 4. Pour toute autre niche, la source de vérité est
// config/niches/<id>/niche.json (blocs `authors` et `silos[].author`) — ce
// module ne fait plus que les assembler, aucune donnée éditoriale codée en
// dur ici (voir plan MVP multi-niche, 2026-09-08).
const path = require('path');
const nichePaths = require('./niche-paths');

const SKILLS_DIR = nichePaths.niche.id === 'auto-mobilite'
  // Emplacement historique, conservé tel quel (référencé par STATE.md,
  // docs/architecture-autopublish.md, .claude/commands/p4-hubs.md et
  // p5-articles.md) — ne pas déplacer ces fichiers juste pour la symétrie.
  ? path.join(__dirname, '..', '..', '..', 'skills', 'redaction')
  : path.join(__dirname, '..', '..', '..', 'skills', 'redaction', nichePaths.niche.id);

function buildPersonas() {
  const authors = nichePaths.niche.authors || {};
  const personas = {};
  for (const [key, author] of Object.entries(authors)) {
    personas[key] = {
      nom: author.nom,
      genre: author.genre,
      age: author.age,
      intitule_role: author.intitule_role,
      bio: author.bio,
      silos: [], // rempli ci-dessous depuis niche.silos, seule source de vérité du rattachement
      skill: path.join(SKILLS_DIR, `auteur-${key.toLowerCase()}.md`),
    };
  }
  for (const silo of nichePaths.niche.silos || []) {
    const persona = personas[silo.author];
    if (!persona) {
      throw new Error(`persona: silo "${silo.name}" référence l'auteur "${silo.author}", absent de niche.json#authors`);
    }
    persona.silos.push(silo.name);
  }
  return personas;
}

const PERSONAS = buildPersonas();

// Silos YMYL (voir skills/wordpress-publication.md section 4 et section 5,
// gating : source officielle citée obligatoire) — déclarés explicitement par
// niche (niche.json#ymyl_silos), plutôt que déduits d'un persona particulier
// comme avant (fragile : ne tenait que parce que D était le seul persona YMYL
// de la niche auto-mobilité, une coïncidence qui ne généralise pas).
const YMYL_SILOS = new Set(nichePaths.niche.ymyl_silos || []);

const SILO_TO_PERSONA = {};
for (const [key, persona] of Object.entries(PERSONAS)) {
  for (const silo of persona.silos) SILO_TO_PERSONA[silo] = key;
}

function getPersonaKeyForSilo(silo) {
  const key = SILO_TO_PERSONA[silo];
  if (!key) throw new Error(`persona: aucun auteur mappé pour le silo "${silo}"`);
  return key;
}

function getPersonaForSilo(silo) {
  return PERSONAS[getPersonaKeyForSilo(silo)];
}

function isYmylSilo(silo) {
  return YMYL_SILOS.has(silo);
}

module.exports = { PERSONAS, getPersonaKeyForSilo, getPersonaForSilo, isYmylSilo, YMYL_SILOS };

#!/usr/bin/env node
// Crée les comptes WordPress (rôle Author) manquants pour les personas d'une
// niche. Idempotent : ignore les comptes déjà présents. À exécuter UNE FOIS
// par niche, à la main (pas de secret dédié requis, ce n'est pas une
// opération récurrente).
//
// Ces comptes ne servent qu'à être référencés comme `post_author` — aucun
// script du pipeline ne se connecte JAMAIS avec leurs identifiants propres
// (seul le compte admin, via Application Password, écrit dans WP). Le mot de
// passe généré ici est donc sans usage pratique ; il est affiché une fois à
// la création pour mémoire, mais peut être réinitialisé à tout moment depuis
// wp-admin si un accès réel est un jour nécessaire pour ce compte.
//
// IMPORTANT — le slug WordPress (`user_nicename`, dérivé automatiquement du
// `username` envoyé ci-dessous) DOIT être identique au slug utilisé par le
// frontend public (route `/auteur/<slug>`) : `run.js#resolveAuthorId` retrouve
// l'auteur exclusivement par égalité stricte sur ce slug
// (`config.WP_AUTHOR_SLUG_BY_PERSONA`, dérivé de `niche.json#authors[key].wp_slug`).
// `wp_insert_user` ne fait que `sanitize_title(username)` pour dériver le
// nicename (no-op si `wp_slug` est déjà un slug propre — minuscules, ASCII,
// tirets), donc le slug reste identique par construction TANT QUE `wp_slug`
// est déjà bien formé. Vérifié explicitement ci-dessous après coup, pour ne
// jamais laisser passer silencieusement un cas où ça ne tiendrait pas.
//
// Les comptes WordPress sont UNE TABLE UNIQUE PARTAGÉE PAR TOUT LE RÉSEAU
// (vrai aujourd'hui sur l'instance unique, et vrai demain sur Multisite —
// aucun changement de ce côté) : `wp_slug` doit donc être unique ACROSS
// TOUTES LES NICHES, pas seulement dans un seul niche.json. Deux personas de
// niches différentes qui choisiraient le même `wp_slug` par coïncidence
// finiraient rattachées au même compte WordPress. Détecté ci-dessous (le nom
// affiché du compte existant est comparé à celui attendu) plutôt que supposé.
const crypto = require('crypto');
const wp = require('./lib/wp-client');
const persona = require('./lib/persona');
const config = require('./config');
const nichePaths = require('./lib/niche-paths');

function randomPassword() {
  return crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, '');
}

// Rattache l'utilisateur au sous-site courant (résolu par `wp-client.js` via
// `wp_url`) avec le rôle `author` — no-op silencieux hors Multisite (voir
// wordpress/mu-plugins/monauto-headless.php, section 6bis).
async function attachToSite(userId) {
  const res = await wp.request('/network/add-user-to-site', {
    method: 'POST',
    namespace: 'monauto/v1',
    body: { user_id: userId, role: 'author' },
  });
  return res.already_member === false;
}

async function main() {
  const users = await wp.getAllUsers();

  for (const [key, info] of Object.entries(persona.PERSONAS)) {
    const slug = config.WP_AUTHOR_SLUG_BY_PERSONA[key];
    let userId;

    const existing = users.find(u => u.slug === slug);
    if (existing) {
      if (info.nom && existing.name && existing.name !== info.nom) {
        throw new Error(
          `create-missing-authors: le slug "${slug}" (persona ${key} de "${nichePaths.NICHE_ID}") ` +
          `est déjà utilisé par un autre compte WordPress ("${existing.name}", id ${existing.id}) — ` +
          `wp_slug doit être unique sur TOUT le réseau, pas seulement dans cette niche. ` +
          `Choisir un wp_slug différent dans niche.json.`
        );
      }
      console.log(`Persona ${key} (${slug}) : compte déjà présent (id ${existing.id}).`);
      userId = existing.id;
    } else {
      const password = randomPassword();
      const created = await wp.request('/users', {
        method: 'POST',
        body: {
          username: slug,
          name: info.nom,
          email: `${slug}@monauto.example`,
          password,
          roles: ['author'],
          description: info.bio,
          // acf.job_title exposé en REST par le mu-plugin (show_in_rest) — voir
          // wordpress/mu-plugins/monauto-headless.php. acf.same_as laissé vide : pas de
          // profil réseau social pour un persona éditorial fictif.
          acf: { job_title: info.intitule_role },
        },
      });
      if (created.slug !== slug) {
        throw new Error(
          `create-missing-authors: WordPress a dérivé le slug "${created.slug}" au lieu de "${slug}" ` +
          `attendu pour la persona ${key} — le frontend (route /auteur/${slug}) ne retrouverait jamais ` +
          `ce compte. Vérifier que wp_slug dans niche.json est déjà un slug propre (minuscules, ASCII, tirets).`
        );
      }
      console.log(`Persona ${key} (${slug}) : compte créé (id ${created.id}). Mot de passe généré (sans usage — non requis par le pipeline) : ${password}`);
      userId = created.id;
    }

    const attached = await attachToSite(userId);
    if (attached) console.log(`Persona ${key} (${slug}) : rattachée au sous-site "${nichePaths.NICHE_ID}" (rôle author).`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

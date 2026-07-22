#!/usr/bin/env node
// Crée les comptes WordPress (rôle Author) manquants pour les personas B à F
// — seule la persona A (julien-fabre) existe à ce jour (voir
// scripts/seed-monauto-test-content.js, qui a créé ce premier compte sur
// l'environnement de test). Idempotent : ignore les comptes déjà présents.
// À exécuter UNE FOIS, à la main, avec les identifiants WP de PRODUCTION
// dans l'environnement (WP_URL/WP_USER/WP_APP_PASSWORD) — jamais depuis la CI
// (pas de secret dédié requis, ce n'est pas une opération récurrente).
//
// Ces comptes ne servent qu'à être référencés comme `post_author` — aucun
// script du pipeline ne se connecte JAMAIS avec leurs identifiants propres
// (seul le compte admin, via Application Password, écrit dans WP). Le mot de
// passe généré ici est donc sans usage pratique ; il est affiché une fois à
// la création pour mémoire, mais peut être réinitialisé à tout moment depuis
// wp-admin si un accès réel est un jour nécessaire pour ce compte.
const crypto = require('crypto');
const wp = require('./lib/wp-client');
const persona = require('./lib/persona');
const config = require('./config');

function randomPassword() {
  return crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, '');
}

async function main() {
  const users = await wp.getAllUsers();

  for (const [key, info] of Object.entries(persona.PERSONAS)) {
    const slug = config.WP_AUTHOR_SLUG_BY_PERSONA[key];
    const existing = users.find(u => u.slug === slug);
    if (existing) {
      console.log(`Persona ${key} (${slug}) : compte déjà présent (id ${existing.id}).`);
      continue;
    }

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
    console.log(`Persona ${key} (${slug}) : compte créé (id ${created.id}). Mot de passe généré (sans usage — non requis par le pipeline) : ${password}`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

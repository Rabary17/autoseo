#!/usr/bin/env node
// Test de bout en bout, ISOLÉ de toute donnée réelle (ne touche jamais
// data/autopublish-state.json ni tracking-mots-cles.xlsx) — vérifie que
// chaque maillon fonctionne réellement : génération (Mistral API), relecture
// voix/faits obligatoire (2e appel Mistral), relecture lisibilité obligatoire
// (3e appel Mistral, ajoutée le 2026-07-28), sourcing d'image
// (Pexels/Unsplash/Pixabay), écriture WordPress (1 catégorie, 1 tag, 1
// article), puis le rapport quotidien doit le détecter. Article publié
// immédiatement (status=publish), titre préfixé "[TEST]" pour rester
// identifiable et facile à supprimer depuis wp-admin une fois la
// vérification faite.
const fs = require('fs');
const path = require('path');
const promptBuilder = require('./lib/prompt-builder');
const mistralClient = require('./lib/mistral-client');
const reviewModule = require('./lib/review');
const gating = require('./lib/gating');
const images = require('./lib/images');
const wp = require('./lib/wp-client');
const config = require('./config');

const LOG_PATH = path.join(__dirname, '..', '..', 'logs', 'autopublish', 'test-e2e-latest.md');
const TEST_SILO = 'Entretien & révision'; // persona A — seul compte auteur WP existant à ce jour
const TEST_SLUG = `test-autopublish-${Date.now()}`;

function writeLog(lines) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, lines.join('\n') + '\n', 'utf8');
}

// Portée module (pas locale à main()) : si main() rejette en cours de route,
// le gestionnaire .catch() tout en bas doit pouvoir écrire ce qui a déjà été
// accompli plutôt que de ne laisser aucune trace du point d'échec.
const steps = [];
function log(msg) {
  console.log(msg);
  steps.push(msg);
}

async function main() {
  log(`# Test end-to-end autopublish — ${new Date().toISOString()}`);
  log('');
  log('Test isolé : aucune modification de data/autopublish-state.json ni tracking-mots-cles.xlsx.');
  log('');

  const testItem = {
    mot_cle_principal: 'test de publication automatique',
    variantes: 'test autopublish',
    intention: 'Info',
    volume_estime: 0,
  };

  log('## 1/7 — Génération (Mistral API)');
  const genReq = promptBuilder.buildGenerationRequest({
    contentType: 'article', silo: TEST_SILO, item: testItem,
    maillageEntry: null, childLinks: [], facts: [],
  });
  const modelCfg = config.MODEL_BY_CONTENT_TYPE.article;
  const genResult = await mistralClient.callMistral({
    model: modelCfg.model,
    system: genReq.system, messages: genReq.messages, schema: genReq.schema,
  });
  log(`OK — modèle \`${genResult.model}\`, ${genResult.usage.output_tokens} tokens de sortie.`);
  log('');

  log('## 2/7 — Relecture voix/faits obligatoire (2e appel Mistral API)');
  const runDate = new Date().toISOString().slice(0, 10);
  const reviewResult = await reviewModule.reviewContent({
    contentType: 'article', silo: TEST_SILO, slug: TEST_SLUG,
    generatedContent: genResult.parsed, maillageEntry: null, facts: [], runDate,
    model: config.REVIEW_MODEL_BY_CONTENT_TYPE.article.model,
  });
  log(`OK — conforme sans correction : ${reviewResult.conforme ? 'oui' : 'non'}, corrections appliquées : ${reviewResult.corrections.length}.`);
  log(`Justification : ${reviewResult.justification}`);
  log('');

  log('## 3/7 — Relecture lisibilité obligatoire (3e appel Mistral API)');
  const readabilityResult = await reviewModule.reviewReadability({
    contentType: 'article', silo: TEST_SILO, slug: TEST_SLUG,
    generatedContent: reviewResult.content, runDate,
    model: config.REVIEW_MODEL_BY_CONTENT_TYPE.article.model,
  });
  log(`OK — conforme sans correction : ${readabilityResult.conforme ? 'oui' : 'non'}, corrections appliquées : ${readabilityResult.corrections.length}.`);
  log(`Justification : ${readabilityResult.justification}`);
  log('');
  const content = readabilityResult.content;

  log('## 4/7 — Vérification du gating (informatif seulement, ne bloque pas ce test)');
  const gatingResult = gating.runGating({
    contentType: 'article', silo: TEST_SILO, sousCocon: 'Test', content,
    clusterRow: null, trackingRows: null, maillageEntry: null,
    childLinksCount: 0, parentPublished: true, factsProvided: [],
  });
  log(gatingResult.passed ? 'PASS — les règles de gating passeraient sur ce contenu.' : `Règles non satisfaites (normal pour un contenu de test générique) : ${gatingResult.failures.map(f => f.message).join(' ; ')}`);
  log('');

  log('## 5/7 — Sourcing image (cascade Pexels → Unsplash → Pixabay)');
  let featuredMedia;
  try {
    const found = await images.findImage('entretien automobile garage', { silo: 'TEST' });
    if (found) {
      const { buffer, mimeType } = await images.downloadImage(found.url);
      const media = await wp.uploadMedia(buffer, `${TEST_SLUG}.jpg`, mimeType);
      featuredMedia = media.id;
      log(`OK — image trouvée via ${found.source}, uploadée dans WP (media id ${media.id}).`);
    } else {
      log('Aucune image trouvée par les 3 API — article publié sans image (non bloquant, comportement attendu).');
    }
  } catch (e) {
    log(`Échec du sourcing image (non bloquant) : ${e.message}`);
  }
  log('');

  log('## 6/7 — Écriture WordPress (catégorie, tag, article)');
  const categoryId = (await wp.findOrCreateTerm('categories', 'test-autopublish', { name: 'Test Autopublish', slug: 'test-autopublish' })).id;
  const tagId = (await wp.findOrCreateTerm('tags', 'test', { name: 'Test', slug: 'test' })).id;
  const users = await wp.getAllUsers();
  const authorId = users.find(u => u.slug === config.WP_AUTHOR_SLUG_BY_PERSONA.A)?.id;

  const post = await wp.createPost({
    title: `[TEST] ${content.title}`,
    slug: TEST_SLUG,
    status: 'publish',
    content: content.content_gutenberg,
    excerpt: content.excerpt,
    categories: [categoryId],
    tags: [tagId],
    author: authorId,
    featured_media: featuredMedia || undefined,
    acf: {
      tldr: content.excerpt,
      sources: (content.sources || []).map(s => s.label).join('\n'),
      faq: (content.faq || []).map(f => `${f.question} | ${f.answer}`).join('\n'),
    },
  });
  log(`OK — article publié : ${post.link} (id ${post.id}, catégorie #${categoryId}, tag #${tagId}).`);
  log('');

  log('## 7/7 — Résumé');
  log(`- Article de test : ${post.link}`);
  log(`- À supprimer manuellement depuis wp-admin une fois la vérification faite.`);
  log(`- Le prochain rapport quotidien (daily-report.js) doit lister cet article dans "Publié aujourd'hui".`);
  log(`- Coût de ce test : génération ${JSON.stringify(genResult.usage)}, relecture voix/faits ${JSON.stringify(reviewResult.usage)}, relecture lisibilité ${JSON.stringify(readabilityResult.usage)}.`);
}

// Le log doit être écrit même si le test échoue en cours de route (ex.
// écriture WP en échec à l'étape 6/7) — sinon un run raté ne laisse AUCUNE
// trace du point où il s'est arrêté, obligeant à rejouer aveuglément (voir le
// durcissement équivalent dans run.js).
main()
  .then(() => {
    writeLog(steps);
    console.log(`\nLog écrit : ${LOG_PATH}`);
  })
  .catch((e) => {
    console.error(e);
    log('');
    log(`## ÉCHEC — ${e.message}`);
    log('');
    log('```');
    log(String(e.stack || e));
    log('```');
    writeLog(steps);
    console.log(`\nLog écrit (échec) : ${LOG_PATH}`);
    process.exit(1);
  });

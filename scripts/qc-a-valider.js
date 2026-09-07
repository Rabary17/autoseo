// QC ponctuel des 12 articles "à valider" avant programmation (voir p5-schedule).
// Lecture seule WP — ne modifie rien. Usage: node scripts/qc-a-valider.js
const path = require('path');
const wp = require(path.join(__dirname, 'autopublish', 'lib', 'wp-client.js'));

const SLUGS = [
  'classement-f1-direct',
  'reglement-f1-2026-moteurs',
  'gp-de-france-retour',
  'track-day-prix-circuits-france',
  'assurance-track-day',
  'equipement-obligatoire-circuit',
  'assurance-trottinette-obligatoire',
  'vae-ville-confort-comparatif',
  'velo-cargo-electrique-famille',
  'vae-reconditionne-avis',
  'velotaf-debuter-conseils',
  'entretien-velo-electrique-cout',
];

function extractImageUrls(html) {
  const urls = [];
  const re = /<img[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) urls.push(m[1]);
  return urls;
}

function extractLinks(html) {
  const urls = [];
  const re = /<a[^>]+href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) urls.push(m[1]);
  return urls;
}

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.status;
  } catch (e) {
    return 'ERR:' + e.message;
  }
}

async function main() {
  for (const slug of SLUGS) {
    const post = await wp.findBySlug('posts', slug);
    if (!post) {
      console.log(`\n=== ${slug} === INTROUVABLE en WP`);
      continue;
    }
    const raw = post.content.raw || '';
    const rendered = post.content.rendered || '';
    const wordCount = raw.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const links = extractLinks(rendered);
    const images = extractImageUrls(rendered);
    const externalOrSuspect = links.filter(l => /exemple\.com|example\.com|localhost|lorem/i.test(l));
    console.log(`\n=== ${slug} ===`);
    console.log('id:', post.id, '| status:', post.status, '| date:', post.date, '| author:', post.author);
    console.log('title:', post.title.rendered);
    console.log('categories:', post.categories, '| tags:', post.tags, '| featured_media:', post.featured_media);
    console.log('word_count(raw approx):', wordCount);
    console.log('links found:', links.length, '| suspect links:', externalOrSuspect);
    console.log('images found:', images.length);
    if (images.length === 0) console.log('  -> AUCUNE image inline détectée');
    // check featured media
    if (post.featured_media) {
      const media = await wp.request(`/media/${post.featured_media}`);
      console.log('featured image url:', media.source_url, '| status check pending...');
      const st = await checkUrl(media.source_url);
      console.log('  featured image HTTP status:', st);
    } else {
      console.log('  -> PAS d\'image à la une (featured_media = 0)');
    }
    // sample check first 3 inline images
    for (const img of images.slice(0, 3)) {
      const st = await checkUrl(img);
      console.log('  image', img, '->', st);
    }
    // sample check first 5 internal links
    for (const l of links.slice(0, 8)) {
      const st = await checkUrl(l.startsWith('http') ? l : (process.env.WP_URL || '') + l);
      console.log('  link', l, '->', st);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });

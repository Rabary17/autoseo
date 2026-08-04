// Outil réutilisable de QC pour une page hub/sous-hub : corrige automatiquement
// les 2 défauts mécaniques récurrents (image isolée imbriquée dans un <p>,
// tableau sans <figure> englobante), puis rapporte tout le reste (liens
// externes cliquables, tirets cadratins, script étranger, meta tronqués)
// pour une revue manuelle. Usage : node _qc-page.js <pageId> [--apply]
const wp = require('./lib/wp-client');
const gating = require('./lib/gating');

const ID = Number(process.argv[2]);
const APPLY = process.argv.includes('--apply');

function fixIsolatedImages(content) {
  const re = /<!-- wp:paragraph -->\s*<p>(<!-- wp:image (\{[^}]*\}) -->\s*([\s\S]*?<\/figure>)\s*<!-- \/wp:image -->)<\/p>\s*<!-- \/wp:paragraph -->/g;
  return content.replace(re, (m, full, attrs, figure) => `<!-- wp:image ${attrs} -->\n${figure}\n<!-- /wp:image -->`);
}

function fixTablesMissingFigure(content) {
  return content.replace(/<table class="wp-block-table">([\s\S]*?)<\/table>/g,
    '<figure class="wp-block-table"><table>$1</table></figure>');
}

async function main() {
  const p = await wp.request(`/pages/${ID}?status=any&context=edit`);
  let content = p.content.raw;
  const before = content;

  content = fixIsolatedImages(content);
  content = fixTablesMissingFigure(content);

  console.log('=== ' + p.slug + ' (#' + ID + ') ===');
  console.log('images isolées corrigées :', (before.match(/<p><!-- wp:image/g) || []).length);
  console.log('tables sans figure corrigées :', (before.match(/<table class="wp-block-table">/g) || []).length);
  console.log('em-dash OK ?', !/\s—\s/.test(gating.stripHtmlToText(content)));
  console.log('foreign script OK ?', !/[一-鿿぀-ヿ가-힯]/.test(content + p.acf.meta_title + p.acf.meta_description));
  const extLinks = [...content.matchAll(/<a href="(https?:[^"]*)"[^>]*>([^<]*)<\/a>/g)];
  console.log('liens externes cliquables dans le corps :', extLinks.length ? extLinks.map(m => m[2] + ' -> ' + m[1]) : 'aucun');
  const faqExtLinks = [...(p.acf.faq || '').matchAll(/<a href="(https?:[^"]*)"/g)];
  console.log('liens externes cliquables dans la FAQ :', faqExtLinks.length);
  console.log('meta_title (' + p.acf.meta_title.length + '):', p.acf.meta_title);
  console.log('meta_description (' + p.acf.meta_description.length + '):', p.acf.meta_description);
  console.log('mots:', gating.countWords(content));
  console.log('mismatch imbriqué restant (autre motif) ?', /<p>[^<]*<!-- wp:image/.test(content));

  if (APPLY && content !== before) {
    await wp.request(`/pages/${ID}`, { method: 'POST', body: { content } });
    console.log('--> contenu mis à jour (corrections mécaniques uniquement).');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

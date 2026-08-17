const wp = require('./lib/wp-client');
const gating = require('./lib/gating');
const trackingXlsx = require('./lib/tracking-xlsx');
const maillage = require('./lib/maillage');

async function main() {
  const rows = trackingXlsx.readRows();
  const avRows = rows.filter(r => r.statut === 'à valider');
  const results = [];

  for (const row of avRows) {
    const maillageEntry = maillage.getEntryByKeyword(row.mot_cle_principal);
    const slug = maillageEntry ? maillageEntry.url.split('/').filter(Boolean).pop() : null;
    if (!slug) { results.push({ keyword: row.mot_cle_principal, error: 'pas de maillage' }); continue; }

    const found = await wp.findBySlug('posts', slug);
    if (!found) { results.push({ keyword: row.mot_cle_principal, error: 'post introuvable pour slug ' + slug }); continue; }

    const p = await wp.request(`/posts/${found.id}?status=any&context=edit`);
    const content = p.content.raw;
    const sources = (p.acf.sources || '').split('\n').filter(Boolean).map(label => ({ label, url: '' }));
    const faq = (p.acf.faq || '').split('\n').filter(Boolean).map(line => { const [q, a] = line.split(' | '); return { question: q, answer: a }; });
    const fakeContent = {
      content_gutenberg: content, title: p.title.raw, meta_title: p.acf.meta_title, meta_description: p.acf.meta_description,
      excerpt: p.excerpt.raw, sources, faq, tags: ['a', 'b', 'c'],
    };
    const result = gating.runGating({
      contentType: 'article', silo: row.silo, sousCocon: row.sous_cocon, content: fakeContent,
      clusterRow: row, trackingRows: rows, maillageEntry, childLinksCount: 0, parentPublished: true, factsProvided: Array(20).fill({}),
    });
    results.push({ id: found.id, keyword: row.mot_cle_principal, silo: row.silo, slug, passed: result.passed, failures: result.failures.map(f => f.message) });
  }

  for (const r of results) {
    console.log(
      (r.passed ? 'OK  ' : (r.error ? 'ERR ' : 'KO  ')),
      (r.silo || '').padEnd(28), (r.slug||r.keyword).padEnd(45),
      r.id ? '#' + r.id : '', r.error || (r.failures || []).join(' ; ')
    );
  }
  console.log('\nOK:', results.filter(r => r.passed).length, '/ KO:', results.filter(r => r.passed === false && !r.error).length, '/ ERR:', results.filter(r => r.error).length);
}

main().catch(e => { console.error(e); process.exit(1); });

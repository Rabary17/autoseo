// Test du réparateur de maillage, rejoué sur les 10 défauts réellement
// constatés le 2026-08-18 (QC manuelle des brouillons du silo Utilitaires &
// flottes pro) : chaque cas ci-dessous est un extrait fidèle du contenu qui
// avait échoué au gating ce jour-là. Vérifie que la réparation programmatique
// produit un contenu qui passe `checkMaillageResolved`.
const assert = require('assert');
const repair = require('./lib/maillage-repair');
const gating = require('./lib/gating');

const ENTRY = {
  url: '/utilitaires-flottes-pro/kangoo-master-electrique-avis',
  sous_hub: '/utilitaires-flottes-pro/utilitaires-electriques',
  hub: '/utilitaires-flottes-pro',
  liens_lateraux: ['/utilitaires-flottes-pro/recharge-flotte-entreprise'],
  ancres: { entite_seule: 'Utilitaires électriques' },
};

const P = h => `<!-- wp:paragraph -->\n<p>${h}</p>\n<!-- /wp:paragraph -->`;

const CASES = [
  {
    nom: 'lien vers un sous-hub étranger au cluster -> délié',
    html: P('Voir <a href="/utilitaires-flottes-pro/fiscalite-vehicule-pro">notre guide fiscal</a> pour la TVS.'),
    attendu: h => !h.includes('fiscalite-vehicule-pro') && h.includes('notre guide fiscal'),
  },
  {
    nom: 'lien vers le hub nu avec slash final -> recollé sur le hub réel',
    html: P('<a href="/utilitaires-flottes-pro/">Tout savoir sur la fiscalité</a> pour optimiser vos coûts.'),
    attendu: h => h.includes('href="/utilitaires-flottes-pro"') && h.includes('Tout savoir sur la fiscalité'),
  },
  {
    nom: 'faute de frappe dans l\'URL du sous-hub -> corrigée, lien conservé',
    entry: { ...ENTRY, sous_hub: '/utilitaires-flottes-pro/lld-gestion-de-flotte', ancres: { entite_seule: 'LLD & gestion de flotte' } },
    html: P('Voir <a href="/utilitaires-flottes-pro/lld-gestion-flotte">le dossier flotte</a>.'),
    attendu: h => h.includes('href="/utilitaires-flottes-pro/lld-gestion-de-flotte"') && h.includes('le dossier flotte'),
  },
  {
    nom: 'lien auto-référencé -> délié (jamais redirigé)',
    html: P('Voici comment faire, <a href="/utilitaires-flottes-pro/kangoo-master-electrique-avis">tout savoir sur le sujet</a>.'),
    attendu: h => !h.includes('kangoo-master-electrique-avis"') && h.includes('tout savoir sur le sujet'),
  },
  {
    nom: 'lien montant manquant -> ajouté avec l\'ancre du sous-cocon',
    html: P('Un texte sans aucun lien.'),
    attendu: h => h.includes('href="/utilitaires-flottes-pro/utilitaires-electriques"') && h.includes('Utilitaires électriques'),
  },
  {
    nom: 'lien latéral légitime -> conservé intact',
    html: P('Voir <a href="/utilitaires-flottes-pro/recharge-flotte-entreprise">la recharge de flotte</a>.'),
    attendu: h => h.includes('/utilitaires-flottes-pro/recharge-flotte-entreprise'),
  },
  {
    nom: 'esperluette dans l\'ancre -> échappée',
    entry: { ...ENTRY, ancres: { entite_seule: 'LLD & gestion de flotte' } },
    html: P('Un texte sans aucun lien.'),
    attendu: h => h.includes('LLD &amp; gestion de flotte') && !/LLD & gestion/.test(h),
  },
  {
    nom: 'lien inventé trop éloigné d\'une cible réelle -> délié, jamais deviné',
    html: P('Voir <a href="/utilitaires-flottes-pro/codes-obd-utilitaires">les codes défaut</a>.'),
    attendu: h => !h.includes('codes-obd-utilitaires') && h.includes('les codes défaut'),
  },
  {
    nom: 'deux cibles proches du même sous-cocon -> jamais confondues',
    entry: {
      ...ENTRY,
      liens_lateraux: ['/utilitaires-flottes-pro/recharge-flotte-entreprise', '/utilitaires-flottes-pro/recharge-flotte-particulier'],
    },
    html: P('Voir <a href="/utilitaires-flottes-pro/recharge-flotte-copropriete">la recharge</a>.'),
    attendu: h => !h.includes('recharge-flotte-copropriete') && !h.includes('recharge-flotte-particulier') && h.includes('la recharge'),
  },
];

let echecs = 0;
for (const c of CASES) {
  const entry = c.entry || ENTRY;
  const { content, repairs } = repair.repairArticleLinks({
    content: { content_gutenberg: c.html }, maillageEntry: entry,
  });
  const h = content.content_gutenberg;
  const ok = c.attendu(h);

  // Le gating doit accepter le résultat, sinon la réparation ne sert à rien.
  const g = gating.runGating({
    contentType: 'article', silo: 'Utilitaires & flottes pro', sousCocon: 'Utilitaires électriques',
    content: {
      content_gutenberg: h, title: 'Titre de test suffisamment long pour passer',
      meta_title: 'Titre meta de test correct 2026', meta_description: 'Une description meta de test suffisamment longue pour satisfaire la contrainte de longueur imposée par le gating sur ce champ.',
      excerpt: 'Un chapô de test.', sources: [{ label: 'Source test', url: '' }],
      faq: [{ question: 'Q ?', answer: 'R.' }], tags: ['a', 'b', 'c'],
    },
    clusterRow: { mot_cle_principal: 'test', silo: 'Utilitaires & flottes pro', sous_cocon: 'Utilitaires électriques' },
    trackingRows: [], maillageEntry: entry, childLinksCount: 0, parentPublished: true,
    factsProvided: Array(20).fill({}),
  });
  const maillageKo = g.failures.filter(f => f.rule === 'maillage_resolu');

  if (!ok || maillageKo.length) {
    echecs++;
    console.log(`KO  ${c.nom}`);
    console.log(`    réparations : ${repairs.join(' | ') || '(aucune)'}`);
    console.log(`    résultat    : ${h.replace(/\n/g, ' ')}`);
    if (maillageKo.length) console.log(`    gating      : ${maillageKo.map(f => f.message).join(' ; ')}`);
  } else {
    console.log(`OK  ${c.nom}  [${repairs.join(' | ') || 'aucune réparation nécessaire'}]`);
  }
}

console.log(`\n${CASES.length - echecs}/${CASES.length} cas OK`);
assert.strictEqual(echecs, 0, `${echecs} cas en échec`);

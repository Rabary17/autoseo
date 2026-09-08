// Porté depuis tonton-maj-v2/src/utils/uncertaintyMarkers.js (voir le plan
// MVP multi-niche du 2026-09-08). Retire les marqueurs de doute résiduels
// qu'un modèle génératif laisse parfois dans le texte ("[à vérifier]" etc.)
// — jamais en silence : la phrase concernée est remontée, jamais réparée
// sans trace, pour qu'une affirmation non sourcée reste visible avant
// publication. Opère sur la chaîne HTML directement (aucun DOM requis) :
// la version Tonton AI utilise `document.textContent` pour un extrait de
// phrase plus propre quand il tourne dans un navigateur, mais dégrade déjà
// proprement à `texte = src` sinon — comportement conservé ici tel quel.

const MARQUEURS = [
  /\[\s*(?:à|a)\s+v[eé]rifier\s*\]/gi,
  /\[\s*(?:à|a)\s+confirmer\s*\]/gi,
  /\[\s*(?:à|a)\s+sourcer\s*\]/gi,
  /\[\s*(?:à|a)\s+compl[eé]ter\s*\]/gi,
  /\[\s*non\s+v[eé]rifi[eé]e?s?\s*\]/gi,
  /\[\s*non\s+confirm[eé]e?s?\s*\]/gi,
  /\[\s*source\s*\?*\s*\]/gi,
  /\[\s*sources?\s+(?:à|a)\s+(?:v[eé]rifier|trouver|ajouter)\s*\]/gi,
  /\[\s*citation\s+needed\s*\]/gi,
  /\[\s*todo\s*\]/gi,
  /\[\s*\?+\s*\]/g,
];

function hasUncertaintyMarker(s = '') {
  return MARQUEURS.some((rx) => { rx.lastIndex = 0; return rx.test(String(s)); });
}

const recolle = (s) => String(s)
  .replace(/\(\s*\)/g, '')
  .replace(/\[\s*\]/g, '')
  .replace(/\(\s+/g, '(')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/[ \t]+([,.;:!?…)\]])/g, '$1')
  .replace(/[ \t]+$/gm, '');

const phraseAutour = (texte, at) => {
  const debut = Math.max(0, texte.lastIndexOf('.', at - 1) + 1);
  let fin = texte.indexOf('.', at);
  if (fin === -1) fin = texte.length;
  return texte.slice(debut, fin + 1).replace(/\s+/g, ' ').trim();
};

/**
 * @param {string} html
 * @returns {{ html: string, removed: Array<{marker:string, sentence:string}> }}
 */
function stripUncertaintyMarkers(html = '') {
  const src = String(html || '');
  if (!src) return { html: src, removed: [] };

  // Pas de DOM ici (contrairement à la version navigateur de Tonton AI) : le
  // texte porte encore ses balises, la phrase remontée peut donc contenir un
  // fragment de HTML — dégradation cosmétique acceptée, jamais fonctionnelle.
  const texte = src;
  const removed = [];
  MARQUEURS.forEach((rx) => {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(texte)) !== null) {
      removed.push({ marker: m[0].trim(), sentence: phraseAutour(texte, m.index) });
      if (m[0] === '') break;
    }
  });
  if (!removed.length) return { html: src, removed: [] };

  let out = src;
  MARQUEURS.forEach((rx) => { rx.lastIndex = 0; out = out.replace(rx, ''); });
  return { html: recolle(out), removed };
}

function uncertaintyReportLine(removed = []) {
  if (!removed || !removed.length) return '';
  const n = removed.length;
  const phrases = [...new Set(removed.map((r) => r.sentence))].slice(0, 3);
  return `⚠️ ${n} marqueur(s) de doute retiré(s) du texte (${[...new Set(removed.map((r) => r.marker))].join(', ')}) `
    + '— ils ne doivent JAMAIS partir en ligne. Les affirmations concernées restent À VÉRIFIER : '
    + phrases.map((p) => `« ${p} »`).join(' ')
    + (n > phrases.length ? ` (+ ${n - phrases.length} autre(s))` : '');
}

module.exports = { hasUncertaintyMarker, stripUncertaintyMarkers, uncertaintyReportLine };

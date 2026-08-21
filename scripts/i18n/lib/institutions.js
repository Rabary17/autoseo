// Detection de substitution d'institution etrangere dans une traduction
// (2026-08-18).
//
// Defaut CONSTATE, et le plus grave rencontre sur le chantier i18n :
// `taxi-conventionne-cpam` a ete traduit en « NHS-Approved Taxis », avec
// « NHS » 11 fois dans le corps et une meta-description affirmant que « CPAM
// reimburses 55 % of NHS-approved taxi fares ». Le NHS est britannique, la
// CPAM francaise, et les taux de remboursement cites sont ceux du droit
// francais : le texte attribue des regles francaises au systeme de sante
// britannique. Ce n'est pas une maladresse de style, c'est de la
// desinformation — et c'est precisement ce qui rend une traduction automatique
// dangereuse plutot que simplement mediocre.
//
// Le prompt de traduction l'interdit explicitement (« Ne transpose pas vers un
// autre pays et n'invente aucune equivalence reglementaire locale »). Le modele
// l'a fait quand meme. Meme lecon que pour les blocs Gutenberg et le maillage :
// une regle verifiable en code ne se delegue pas au modele.
//
// Methode : liste d'institutions publiques etrangeres, croisee avec l'absence
// du terme dans la SOURCE. Le croisement est essentiel — il evite de signaler
// une institution legitimement citee par l'original — et il rend la detection
// utilisable sans exception a maintenir.
//
// Volontairement PAS une detection generique de tout acronyme absent de la
// source : traduire « TVA » en « VAT » ou « poids lourd » en « HGV » est
// correct et courant. Seules les institutions PUBLIQUES d'un autre pays sont
// des substitutions illegitimes, parce qu'elles portent un cadre juridique qui
// n'est pas celui du contenu.

const INSTITUTIONS_ETRANGERES = [
  // Royaume-Uni
  'NHS', 'HMRC', 'DVLA', 'DVSA', 'TfL', 'Ofgem', 'Blue Badge', 'National Insurance',
  // Etats-Unis
  'Medicare', 'Medicaid', 'IRS', 'DMV', 'Social Security Administration', 'Obamacare', 'AAA',
  // Allemagne
  'Kraftfahrt-Bundesamt', 'Bundesamt', 'TUV', 'TÜV', 'Umweltplakette', 'Krankenkasse',
  // Italie
  'INPS', 'ASL', 'ACI', 'Telepass',
  // Espagne
  'Seguridad Social', 'DGT', 'ITV',
];

function stripToText(html) {
  return String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compte(texte, terme) {
  // Frontieres de mot posees a la main : `\b` ne fonctionne pas avec un terme
  // contenant un tiret ou une lettre accentuee (Kraftfahrt-Bundesamt, TÜV).
  const re = new RegExp(`(^|[^\\p{L}\\p{N}-])${escapeRegex(terme)}($|[^\\p{L}\\p{N}])`, 'giu');
  return (texte.match(re) || []).length;
}

/**
 * @param sourceHtml   contenu francais d'origine
 * @param traduction   { content_gutenberg, title, meta_title, meta_description }
 * @returns { ok, substitutions: [{ institution, occurrences }] }
 */
function checkNoForeignInstitution(sourceHtml, traduction) {
  const source = stripToText(sourceHtml);
  const cible = [
    stripToText(traduction.content_gutenberg),
    traduction.title || '', traduction.meta_title || '', traduction.meta_description || '',
  ].join(' ');

  const substitutions = [];
  for (const inst of INSTITUTIONS_ETRANGERES) {
    const dansCible = compte(cible, inst);
    if (!dansCible) continue;
    // Cite par la source : legitime, l'original en parlait deja.
    if (compte(source, inst)) continue;
    substitutions.push({ institution: inst, occurrences: dansCible });
  }
  return { ok: substitutions.length === 0, substitutions };
}

module.exports = { checkNoForeignInstitution, INSTITUTIONS_ETRANGERES, stripToText, compte };

// NOUVEAU module (n'existe ni dans autoseo ni dans tonton-maj-v2) — détecte
// et répare le défaut trouvé le 2026-09-07 en QC manuel sur 2 articles réels
// publiés en `draft` (vae-ville-confort-comparatif, entretien-velo-electrique-
// cout). Confirmé sur le HTML brut (content.raw) via l'API WP : le modèle
// écrit parfois, EN PLUS du jeton [[IMAGE:n]] correctement traité par
// resolveInlineImages() (voir run.js), une 2e tentative d'insertion d'image
// improvisée et tronquée en pleine génération. Deux fragments cassés en
// résultent systématiquement (4 occurrences observées sur 2 articles) :
//
// 1) Un bloc `wp:image` fantôme dont l'attribut src ne se ferme jamais et
//    enchaîne directement sur une balise de fermeture qui n'a rien à faire
//    là (`</p>`, `</figure>`) :
//      <!-- wp:image {"id":1,...} -->
//      <figure class="wp-block-image size-large"><img src="</p>
//      <!-- /wp:image -->
//
// 2) La "queue" orpheline de ce même tag `<img>` avorté, échouée seule comme
//    unique contenu d'un paragraphe Gutenberg suivant :
//      <!-- wp:paragraph -->
//      <p>" alt="Mécanicien vérifiant le moteur d'un vélo électrique en atelier"/></figure>
//      <!-- /wp:paragraph -->
//
// Le vrai bloc image (avec le média réellement uploadé) existe déjà par
// ailleurs dans le contenu — ces deux fragments sont donc toujours sans
// perte à supprimer entièrement, jamais un texte à "sauver".
//
// Principe de détection, dans les deux cas : une valeur d'attribut HTML
// (`src="..."`, `alt="..."`) ne contient JAMAIS un `<` non échappé avant sa
// guillemet fermante — c'est syntaxiquement impossible en HTML bien formé,
// donc zéro faux positif possible sur du contenu légitime.

// Bloc wp:image dont l'attribut src fuit directement sur une balise de
// fermeture au lieu de se refermer par une guillemet. Motif ANCRÉ juste après
// l'ouverture du bloc (jamais de `[\s\S]*?` traversant tout le document) :
// une première version non bornée (jusqu'au 2026-09-08) laissait le moteur
// regex, quand le bloc `wp:image` immédiatement suivant était un bloc
// LÉGITIME (src propre), continuer à chercher plus loin dans le document une
// autre occurrence cassée à faire correspondre au `[\s\S]*?` — engloutissant
// au passage tout le contenu réel (image légitime, paragraphes) entre les
// deux occurrences cassées. Constaté en conditions réelles sur
// assurance-track-day (#1923) : supprimait ~50% de l'article. Le motif ancré
// ci-dessous ne peut matcher QUE si le bloc `wp:image` qui suit IMMÉDIATEMENT
// (à l'espace près) est lui-même cassé — jamais de risque de traverser un
// bloc voisin valide.
const BROKEN_IMAGE_BLOCK_PATTERN =
  /<!--\s*wp:image(?:\s+\{[^}]*\})?\s*-->\s*<figure[^>]*>\s*<img\b[^>]*\bsrc\s*=\s*["']\s*<\/(?:p|figure|div)>\s*<!--\s*\/wp:image\s*-->\s*/gi;

// Paragraphe Gutenberg dont TOUT le contenu n'est que la queue orpheline d'un
// tag interrompu : ouvre sur une guillemet nue (jamais un début de phrase
// légitime), porte un pseudo-attribut, et se termine par un marqueur
// d'auto-fermeture suivi au choix d'une balise de fermeture parasite. Le
// `</p>` final est OPTIONNEL (`(?:<\/p>\s*)?`) : constaté en conditions
// réelles sur assurance-track-day (#1923) que le contenu stocké omet parfois
// cette fermeture (navigateur/éditeur la referme implicitement à l'affichage,
// mais le HTML brut stocké côté WP ne l'a pas) — sans quoi le motif ne
// matchait tout simplement jamais ces 3 fragments réels, laissant le paragraphe
// orphelin en place après réparation.
const ORPHANED_PARAGRAPH_BLOCK_PATTERN =
  /<!--\s*wp:paragraph(?:\s+\{[^}]*\})?\s*-->\s*<p[^>]*>\s*["'][^<>]*?[a-z-]+\s*=\s*["'][^<>]*["']\s*\/?>\s*(?:<\/(?:figure|p|div)>\s*)*(?:<\/p>\s*)?<!--\s*\/wp:paragraph\s*-->\s*/gi;

// Détecteur générique, pour ce qui survivrait aux deux réparations
// ci-dessus (variante non couverte, ou artefact déjà présent hors de ces
// deux formes exactes) : un attribut HTML dont la valeur contient un `<`
// non échappé avant sa guillemet fermante, TOUJOURS un défaut quelle que
// soit sa forme englobante.
const RAW_ANGLE_IN_ATTRIBUTE_PATTERN = /[a-z-]{2,20}\s*=\s*["'][^"'<>]*</gi;

/**
 * Supprime les fragments identifiés ci-dessus quand ils apparaissent sous
 * l'une des deux formes exactes déjà observées — jamais une sous-chaîne
 * mêlée à de la vraie prose : `repairContent()` doit rester un no-op strict
 * sur tout ce qui n'est pas 100% mécanique.
 * @param {string} html
 * @returns {{ html: string, removedCount: number }}
 */
function repairKnownArtifacts(html = '') {
  const src = String(html || '');
  if (!src) return { html: src, removedCount: 0 };
  let removedCount = 0;
  let out = src.replace(BROKEN_IMAGE_BLOCK_PATTERN, () => { removedCount += 1; return ''; });
  out = out.replace(ORPHANED_PARAGRAPH_BLOCK_PATTERN, () => { removedCount += 1; return ''; });
  return { html: out, removedCount };
}

/**
 * Détecteur bloquant pour le gating (voir gating.js#checkNoHtmlArtifacts) —
 * appelé APRÈS repairKnownArtifacts() dans content-repair.js. Tout ce qui
 * reste ici est un motif non couvert par la réparation mécanique, donc
 * signalé plutôt que publié tel quel.
 * @param {string} html
 * @returns {{ ok: boolean, findings: Array<{pattern:string, excerpt:string}> }}
 */
function findArtifacts(html = '') {
  const src = String(html || '');
  const findings = [];
  const scan = (pattern, label) => {
    const rx = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let m;
    while ((m = rx.exec(src)) !== null) {
      findings.push({ pattern: label, excerpt: m[0].slice(0, 200) });
      if (m[0] === '') { rx.lastIndex += 1; }
    }
  };
  scan(BROKEN_IMAGE_BLOCK_PATTERN, 'bloc_image_casse');
  scan(ORPHANED_PARAGRAPH_BLOCK_PATTERN, 'paragraphe_orphelin');
  scan(RAW_ANGLE_IN_ATTRIBUTE_PATTERN, 'attribut_html_invalide');
  return { ok: findings.length === 0, findings };
}

module.exports = {
  repairKnownArtifacts,
  findArtifacts,
  BROKEN_IMAGE_BLOCK_PATTERN,
  ORPHANED_PARAGRAPH_BLOCK_PATTERN,
  RAW_ANGLE_IN_ATTRIBUTE_PATTERN,
};

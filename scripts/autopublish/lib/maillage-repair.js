// Réparation programmatique du maillage interne, entre la relecture et le
// gating (2026-08-18, demande explicite de l'utilisateur).
//
// Pourquoi ce module existe : la boucle de relecture LLM RAPPORTE des
// corrections de maillage qu'elle n'applique pas réellement. Constaté sur le
// batch du 2026-08-18 — la relecture déclare noir sur blanc « Ajout du lien
// manquant vers `maillage.sous_hub` » sur des articles où `runGating`
// constate ensuite l'absence de ce même lien. Même symptôme les 2026-08-03 et
// 2026-08-10, jamais traité à la racine : à chaque lot, la moitié des échecs
// de gating tenaient à deux règles seulement, toutes deux vérifiables sans
// modèle.
//
// Ces deux règles (voir gating.js/checkMaillageResolved) sont purement
// mécaniques : l'ensemble des cibles autorisées est connu à l'avance, et le
// lien montant manquant s'insère sans jugement éditorial. Les faire vérifier
// par un LLM était un choix coûteux ET peu fiable. On les applique donc en
// code, et le gating reste la dernière ligne de défense (il revérifie tout
// après ce passage — ce module ne le remplace jamais).
//
// Volontairement hors périmètre : la longueur, la similarité, la voix de
// l'auteur, la qualité factuelle. Rien ici ne réécrit du contenu éditorial —
// on délie, on corrige une URL, on ajoute une phrase de liaison. Tout le
// reste reste du ressort de la relecture puis de la validation manuelle.

// Retire la balise <a> en conservant le texte d'ancre (ne supprime jamais de
// contenu rédactionnel : un lien inventé devient du texte simple).
function unlink(html, href) {
  const re = new RegExp(`<a\\s[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</a>`, 'gi');
  return html.replace(re, '$1');
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\s[^>]*href="([^"]*)"/gi;
  let m;
  while ((m = re.exec(html || ''))) hrefs.push(m[1]);
  return hrefs;
}

// Un lien inventé est parfois juste une faute de frappe sur une cible légitime
// (constaté le 2026-08-18 : `/utilitaires-flottes-pro/lld-gestion-flotte` pour
// `.../lld-gestion-de-flotte`, donc une 404 silencieuse en production plutôt
// qu'un lien absent). Quand un href non prévu ne diffère d'une cible attendue
// que par quelques caractères, le corriger vaut mieux que le délier : on
// conserve le maillage voulu au lieu de le perdre.
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

// Seuil volontairement bas : 2 caractères d'écart couvrent les cas réellement
// observés (segment "de" omis, tiret manquant, slash final) sans jamais
// rapprocher deux cibles distinctes d'un même sous-cocon, dont les slugs
// diffèrent toujours de bien davantage. Au-delà, on délie plutôt que de
// risquer un lien pointant vers le mauvais article.
const MAX_TYPO_DISTANCE = 2;

function closestExpected(href, expected) {
  const norm = s => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const target = norm(href);
  let best = null;
  let bestDist = Infinity;
  for (const e of expected) {
    const d = levenshtein(target, norm(e));
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return bestDist <= MAX_TYPO_DISTANCE ? best : null;
}

// Phrase de liaison portant le lien montant. L'ancre reprend `entite_seule`
// (le nom du sous-cocon) plutôt que le titre de l'article lui-même : une ancre
// qui répète le titre de la page courante décrit la source, pas la cible —
// défaut relevé manuellement les 2026-08-03 et 2026-08-18.
function buildUplinkParagraph(maillageEntry) {
  const label = (maillageEntry.ancres && maillageEntry.ancres.entite_seule) || 'le dossier complet';
  const safeLabel = label.replace(/&(?!amp;|lt;|gt;|#)/g, '&amp;');
  return '\n\n<!-- wp:paragraph -->\n'
    + `<p>Le dossier <a href="${maillageEntry.sous_hub}">${safeLabel}</a> replace ce sujet dans son ensemble.</p>\n`
    + '<!-- /wp:paragraph -->';
}

// Applique les réparations sur `content.content_gutenberg`. Retourne le
// contenu (muté par copie) et la liste des réparations faites, pour le log du
// run — une réparation silencieuse masquerait la défaillance de la relecture
// qu'on cherche justement à rendre visible.
function repairArticleLinks({ content, maillageEntry }) {
  const repairs = [];
  if (!maillageEntry || !content || typeof content.content_gutenberg !== 'string') {
    return { content, repairs };
  }

  let html = content.content_gutenberg;
  // Même ensemble que gating.js/checkMaillageResolved — les deux doivent
  // rester alignés, sinon ce module « répare » vers des cibles que le gating
  // refuse ensuite.
  const expected = new Set(
    [maillageEntry.sous_hub, maillageEntry.hub, ...(maillageEntry.liens_lateraux || [])].filter(Boolean)
  );

  for (const href of [...new Set(extractHrefs(html))]) {
    if (expected.has(href)) continue;

    // Lien vers sa propre URL : toujours délié, jamais redirigé (un article
    // qui se cite lui-même n'apporte rien au lecteur ni au maillage).
    if (maillageEntry.url && href === maillageEntry.url) {
      html = unlink(html, href);
      repairs.push(`lien auto-référencé délié (${href})`);
      continue;
    }

    const fix = closestExpected(href, expected);
    if (fix) {
      html = html.split(`href="${href}"`).join(`href="${fix}"`);
      repairs.push(`URL corrigée : ${href} -> ${fix}`);
    } else {
      html = unlink(html, href);
      repairs.push(`lien hors maillage délié (${href})`);
    }
  }

  if (maillageEntry.sous_hub && !extractHrefs(html).includes(maillageEntry.sous_hub)) {
    html += buildUplinkParagraph(maillageEntry);
    repairs.push(`lien montant vers le sous-hub ajouté (${maillageEntry.sous_hub})`);
  }

  return { content: { ...content, content_gutenberg: html }, repairs };
}

module.exports = { repairArticleLinks, extractHrefs, unlink, closestExpected };

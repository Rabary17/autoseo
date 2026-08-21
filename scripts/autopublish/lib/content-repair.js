// Reparations mecaniques du contenu genere, avant gating (2026-08-21).
//
// Ces deux defauts sont produits par le modele malgre une interdiction
// explicite dans le prompt, et tous deux sont reparables sans aucun jugement
// editorial. Les laisser bloquer un article au gating revient a jeter un
// contenu correct pour un caractere de ponctuation ou un commentaire de bloc
// mal ferme.
//
// Historique : la reparation des blocs Gutenberg existait deja mais vivait
// dans `scripts/i18n/lib/sanitize.js`, donc ne servait QU'AUX TRADUCTIONS —
// alors que le pipeline francais souffre exactement du meme defaut. Constate
// le 2026-08-21 : sur 6 articles etoffes, 1 rejete pour bloc mal ferme et 1
// pour tiret cadratin, les deux reparables ici. Remonte au niveau commun,
// `sanitize.js` delegue desormais a ce module.

/* ---------- Blocs Gutenberg ---------- */

// Le modele ferme parfois un bloc avec le mauvais commentaire
// (`<!-- wp:image -->` ferme par `<!-- /wp:list -->`). Invisible a l'ecran, le
// HTML rendu reste valide, mais la re-edition du bloc casse dans l'editeur
// WordPress. Reparable sans ambiguite : la pile des blocs ouverts dit
// exactement quel commentaire de fermeture etait attendu.
function repairGutenbergBlocks(html) {
  const re = /<!--\s*(\/?)wp:([a-z-]+)((?:\s+\{[^}]*\})?)\s*-->/g;
  const stack = [];
  const repairs = [];
  let out = '';
  let last = 0;
  let m;

  while ((m = re.exec(html))) {
    const [marker, slash, name] = m;
    out += html.slice(last, m.index);
    last = m.index + marker.length;

    if (!slash) {
      // Bloc auto-fermant (`<!-- wp:image {...} /-->`) : jamais empile.
      if (/\/-->$/.test(marker)) { out += marker; continue; }
      stack.push(name);
      out += marker;
    } else {
      const attendu = stack.pop();
      if (attendu && attendu !== name) {
        out += `<!-- /wp:${attendu} -->`;
        repairs.push(`fermeture "/wp:${name}" corrigee en "/wp:${attendu}"`);
      } else {
        out += marker;
      }
    }
  }
  out += html.slice(last);

  while (stack.length) {
    const name = stack.pop();
    out += `\n<!-- /wp:${name} -->`;
    repairs.push(`bloc "${name}" jamais ferme, fermeture ajoutee`);
  }

  return { html: out, repairs };
}

/* ---------- Tiret cadratin espace (regle francaise) ---------- */

// Interdit dans le contenu francais depuis le 2026-07-22 (demande explicite de
// l'utilisateur). Le modele en produit malgre l'interdiction, y compris dans
// les champs meta (constate le 2026-08-18). La substitution est mecanique :
// dans l'usage francais, un tiret cadratin espace se remplace par une virgule
// (incise) ou un deux-points (annonce). On choisit la virgule par defaut,
// jamais le deux-points : une virgule est correcte partout, un deux-points
// mal place change le sens de la phrase.
//
// A ne PAS confondre avec le tiret demi-cadratin U+2013 (« 50 – 180 € »),
// legitime dans une fourchette et volontairement hors perimetre.
const EM_DASH_ESPACE = /\s+—\s+/g;

function repairEmDash(texte) {
  const str = String(texte || '');
  if (!EM_DASH_ESPACE.test(str)) return { texte: str, remplacements: 0 };
  EM_DASH_ESPACE.lastIndex = 0;
  const remplacements = (str.match(EM_DASH_ESPACE) || []).length;
  return { texte: str.replace(EM_DASH_ESPACE, ', '), remplacements };
}

/**
 * Applique les deux reparations sur un contenu genere complet.
 * Le tiret cadratin est traite dans le corps ET dans les champs meta : la
 * regle de gating couvre les deux, et c'est dans une meta_description qu'il
 * avait echappe a la vigilance le 2026-08-18.
 */
function repairContent(content) {
  const repairs = [];
  const out = { ...content };

  const blocs = repairGutenbergBlocks(out.content_gutenberg || '');
  if (blocs.repairs.length) {
    out.content_gutenberg = blocs.html;
    repairs.push(...blocs.repairs.map(r => `bloc Gutenberg : ${r}`));
  }

  for (const champ of ['content_gutenberg', 'title', 'meta_title', 'meta_description', 'excerpt']) {
    const r = repairEmDash(out[champ]);
    if (r.remplacements) {
      out[champ] = r.texte;
      repairs.push(`tiret cadratin remplace par une virgule dans ${champ} (${r.remplacements})`);
    }
  }

  return { content: out, repairs };
}

module.exports = { repairContent, repairGutenbergBlocks, repairEmDash };

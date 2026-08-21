// Réécriture du maillage interne d'un article traduit (2026-08-18).
//
// C'est la partie du chantier i18n que la doc Next.js ne couvre jamais, et
// c'est pourtant celle qui casse en premier. Un article français contient des
// liens vers ses frères et son sous-hub, écrits en chemins français
// (/camping-car-van/hivernage-camping-car-checklist). Recopiés tels quels dans
// la version anglaise, ces liens renvoient le lecteur anglophone vers du
// contenu français : le maillage interne de la locale n'existe tout simplement
// pas, et le préfixe de langue seul n'y change rien.
//
// Même classe de bug que celui du 2026-08-03 (liens à 2 segments tombant en
// 404, corrigé par middleware.ts), mais multiplié par le nombre de langues.
//
// Politique de résolution, alignée sur lib/maillage-repair.js du pipeline
// français : quand la cible n'a PAS d'équivalent traduit, on délie en gardant
// le texte d'ancre. Jamais de lien vers la version française depuis un article
// traduit (ce serait un cul-de-sac linguistique pour le lecteur, et un signal
// de maillage incohérent pour les moteurs), jamais de lien vers une page qui
// n'existe pas encore.

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\s[^>]*href="([^"]*)"/gi;
  let m;
  while ((m = re.exec(html || ''))) hrefs.push(m[1]);
  return hrefs;
}

function unlink(html, href) {
  const re = new RegExp(`<a\\s[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</a>`, 'gi');
  return html.replace(re, '$1');
}

/**
 * @param html      contenu Gutenberg traduit, liens encore en chemins français
 * @param pathMap   Map chemin_fr -> chemin_traduit SANS préfixe de locale
 *                  (ex. "/camping-car-van/hivernage-..." -> "/motorhome-van/winterisation-...")
 * @param prefix    préfixe d'URL de la locale, "" pour le français ("/en" sinon)
 */
function remapLinks({ html, pathMap, prefix }) {
  let out = html;
  const remapped = [];
  const dropped = [];

  for (const href of [...new Set(extractHrefs(out))]) {
    // Liens externes : laissés strictement intacts. Le pipeline français n'en
    // produit plus (règle "aucun lien de source" du 2026-08-03), mais du
    // contenu corrigé à la main peut en contenir.
    if (!href.startsWith('/')) continue;

    const cible = pathMap.get(href.replace(/\/$/, ''));
    if (cible) {
      out = out.split(`href="${href}"`).join(`href="${prefix}${cible}"`);
      remapped.push(`${href} -> ${prefix}${cible}`);
    } else {
      out = unlink(out, href);
      dropped.push(href);
    }
  }

  return { html: out, remapped, dropped };
}

module.exports = { remapLinks, extractHrefs, unlink };

// Table des matières générée depuis le HTML rendu d'un article — extrait les
// <h1>/<h2>/<h3> (le H1 réel du titre de page est rendu séparément dans
// l'en-tête, donc n'importe quel h1 trouvé ici vient du corps généré ; rare
// mais possible sur du contenu ancien). Injecte un id dans chaque titre pour
// que les liens d'ancrage fonctionnent, même sur du contenu déjà publié qui
// n'en avait pas.
import { decodeEntities } from "./wp";

export interface TocItem {
  level: 1 | 2 | 3;
  id: string;
  text: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildToc(html: string): { toc: TocItem[]; html: string } {
  const toc: TocItem[] = [];
  const seenIds = new Map<string, number>();

  const outHtml = html.replace(
    /<h([1-3])([^>]*)>([\s\S]*?)<\/h[1-3]>/gi,
    (match, levelStr, attrs, inner) => {
      const level = Number(levelStr) as 1 | 2 | 3;
      const text = decodeEntities(inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (!text) return match;

      let id = slugify(text) || `section`;
      const count = seenIds.get(id) ?? 0;
      seenIds.set(id, count + 1);
      if (count > 0) id = `${id}-${count + 1}`;

      toc.push({ level, id, text });

      // Un id déjà présent (contenu plus récent qui en génère déjà) est
      // respecté tel quel plutôt que dupliqué — on ne réécrit que s'il manque.
      if (/\sid=/.test(attrs)) return match;
      return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    }
  );

  return { toc, html: outHtml };
}

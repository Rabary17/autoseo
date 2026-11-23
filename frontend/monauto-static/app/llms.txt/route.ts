import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { getAllHubs, getAllPosts } from "@/lib/posts";

// Fichier llms.txt (https://llmstxt.org) : pages piliers et articles récents,
// en URL canoniques. Généré au build (export statique).
export const dynamic = "force-static";

export function GET() {
  const piliers = getAllHubs().filter((h) => h.locale === "fr" && !h.parentSlug);
  const recents = getAllPosts().filter((p) => p.locale === "fr").slice(0, 30);

  const lignes = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Pages piliers",
    ...piliers.map((h) => `- [${h.title}](${SITE_URL}/${h.slug}/)${h.description ? `: ${h.description}` : ""}`),
    "",
    "## Articles récents",
    ...recents.map((p) => `- [${p.title}](${SITE_URL}/${p.slug}/)`),
    "",
  ];

  return new Response(lignes.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

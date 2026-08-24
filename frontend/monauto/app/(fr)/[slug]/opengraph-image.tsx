import { ImageResponse } from "next/og";
import { decodeEntities, getPageBySlug, getPostBySlug } from "@/lib/wp";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Runtime Node explicite : lib/wp.ts utilise node:http/https directement
// (voir commentaire en tête de ce fichier) pour contourner un souci de 502
// spécifique au build sur cette machine — incompatible avec le runtime Edge
// (par défaut pour les fichiers d'image OG), donc forcé ici.
export const runtime = "nodejs";

const stripAndDecode = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, "").trim());

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [post, page] = await Promise.all([
    getPostBySlug(slug).catch(() => null),
    getPageBySlug(slug).catch(() => null),
  ]);

  const rawTitle = post?.title.rendered ?? page?.title.rendered;
  const title = rawTitle ? stripAndDecode(rawTitle) : SITE_NAME;
  const cat = post?._embedded?.["wp:term"]?.[0]?.[0]?.name;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#14171C",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
          {SITE_NAME}
          <span style={{ color: "#1B54FF" }}>.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {cat && (
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 600,
                color: "#1B54FF",
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {cat}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, lineHeight: 1.15 }}>
            {title.length > 100 ? `${title.slice(0, 99)}…` : title}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

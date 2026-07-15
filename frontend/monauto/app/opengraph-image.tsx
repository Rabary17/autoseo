import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Carte OG par défaut (accueil, /rubriques/, pages sans image dédiée). Les
// segments qui ont besoin d'un titre dynamique (articles/pages) ont leur
// propre app/[slug]/opengraph-image.tsx qui prend le dessus.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#14171C",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
          {SITE_NAME}
          <span style={{ color: "#1B54FF" }}>.</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.7)", marginTop: 18 }}>
          Le média expert de l&apos;auto et de la mobilité
        </div>
      </div>
    ),
    { ...size }
  );
}

import type { NextConfig } from "next";

// ISR (Incremental Static Regeneration) sur Vercel, PAS d'export statique.
// Décision du 2026-07-14 (remplace le choix SSG pur du 2026-07-11) : à
// l'échelle de 10 000 articles publiés en continu (5/jour, des années durant),
// un rebuild complet à chaque publication est inutilement coûteux/lent, et
// même un rebuild quotidien régénère toujours TOUTES les pages pour rien.
// Avec l'ISR, chaque page article/auteur est générée à la demande au premier
// accès puis mise en cache indéfiniment ; seule la régénération ciblée d'UNE
// page précise est déclenchée (via /api/revalidate, appelé par le mu-plugin
// WordPress à la publication — voir docs/architecture-headless.md).
// Reste 100% gratuit sur le plan Vercel Hobby (l'ISR fait partie du forfait).
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true, // pas encore branché sur l'optimiseur d'image Vercel — à réévaluer plus tard
  },
  // Next.js streame par défaut <title>/meta description/canonical/robots dans
  // le <body> (après un <head> déjà fermé) pour tout crawler absent de sa
  // liste interne HTML_LIMITED_BOT_UA_RE — constaté via l'audit Screaming
  // Frog du 2026-08-05 (title/meta description/canonical/robots "en dehors du
  // <head>" sur 69-80% des pages). Cette liste ne couvre ni Screaming Frog, ni
  // les crawlers IA/GEO (GPTBot, ClaudeBot, PerplexityBot...) qui ne rendent
  // pas le JS — ils ne verraient donc jamais ces balises. `.*` force un rendu
  // synchrone (metadata déjà dans le <head> du 1er octet) pour absolument
  // toute requête ; le fetch WP sous-jacent est de toute façon déjà nécessaire
  // et mis en cache pour le contenu de la page, donc coût de latence négligeable.
  htmlLimitedBots: /.*/,
  // 301 des URLs de l'ancien site "Tech'Cars" (agence auto à Laval, domaine
  // racheté) trouvées via Wayback Machine (CDX API, 2026-07-29) — préserve le
  // jus de lien des 143 domaines référents vers les rubriques les plus proches
  // thématiquement. /contact existe déjà à l'identique (géré par trailingSlash).
  async redirects() {
    return [
      // www -> apex (domaine canonique = SITE_URL = https://techcars.fr) —
      // DOIT rester la première règle : sinon les redirections suivantes
      // matcheraient d'abord et renverraient vers .../categorie/... sur le
      // mauvais host. www.techcars.fr ajouté au projet Vercel le 2026-07-29
      // (cf. STATE.md) ; nécessite aussi l'enregistrement DNS A demandé par
      // Vercel côté registrar (Infomaniak) pour que le certificat TLS de ce
      // sous-domaine soit valide avant que cette règle ne s'applique.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.techcars.fr" }],
        destination: "https://techcars.fr/:path*",
        permanent: true,
      },
      { source: "/vehicule-d-occasion", destination: "/categorie/voiture-d-occasion/", permanent: true },
      { source: "/service-carte-grise", destination: "/categorie/carte-grise-demarches/", permanent: true },
      {
        source: "/location",
        destination: "/categorie/mobilite-partagee-transports/location-courte-longue-duree/",
        permanent: true,
      },
      // /favicon.ico : requêté par convention (navigateurs, bots) même quand
      // <link rel="icon"> pointe ailleurs (voir app/(fr)/layout.tsx, icons:
      // favicon.png) — confirmé en 404 réel dans l'export Search Console
      // "Statistiques d'exploration" du 2026-08-25.
      { source: "/favicon.ico", destination: "/favicon.png", permanent: true },
      // Fusion de quasi-doublons éditoriaux (audit du 2026-09-04, voir
      // docs/audit-contenu-refactorisation-2026-09.md) — les 2 articles
      // "changement de titulaire" répétaient le sous-hub (mêmes montants,
      // mêmes documents, rédigés à 4 jours d'écart), leur contenu unique a
      // été fusionné dedans avant dépublication.
      {
        source: "/changement-de-titulaire-carte-grise",
        destination: "/categorie/carte-grise-demarches/changement-de-titulaire/",
        permanent: true,
      },
      {
        source: "/changement-titulaire-carte-grise-en-ligne",
        destination: "/categorie/carte-grise-demarches/changement-de-titulaire/",
        permanent: true,
      },
      // Même audit : la marche à suivre pratique de cet article a été
      // fusionnée dans son quasi-doublon (plus complet sur les cas
      // particuliers) avant dépublication.
      {
        source: "/changement-adresse-carte-grise-gratuit",
        destination: "/changement-d-adresse-sur-la-carte-grise/",
        permanent: true,
      },
      // Même audit, 2e lot (2026-09-04) : 2 paires signalées par recoupement
      // lexical, vérifiées par lecture complète du texte avant fusion. Les 2
      // contenaient des chiffres contradictoires entre eux (tarif régional du
      // cheval fiscal, plafond du malus CO2) — le contenu unique a été
      // récupéré et un avertissement "à vérifier" ajouté sur les chiffres
      // encore incertains, voir docs/audit-contenu-refactorisation-2026-09.md.
      {
        source: "/cheval-fiscal-prix-par-region",
        destination: "/carte-grise-prix-par-region/",
        permanent: true,
      },
      {
        source: "/calcul-malus-occasion-importee",
        destination: "/taxe-co2-vehicule-occasion/",
        permanent: true,
      },
    ];
  },
  // En-têtes de sécurité manquants sur 100% des pages (audit Screaming Frog du
  // 2026-08-05, 239/292 URL). CSP volontairement permissive côté scripts/styles
  // ('unsafe-inline') : le site utilise un script inline pour le thème sombre
  // anti-FOUC (voir app/layout.tsx) et des styles inline générés par React —
  // une CSP stricte casserait ces deux usages. L'audit ne vérifie que la
  // présence de l'en-tête, pas le détail de sa politique (voir description du
  // rapport) ; un durcissement ultérieur (nonce) reste possible si besoin.
  async headers() {
    // NewsletterForm (Client Component) poste directement à l'API REST WP
    // publique depuis le navigateur (voir lib/public-env.ts) — connect-src
    // doit explicitement l'autoriser, sinon la CSP bloque ce fetch.
    const wpSiteUrl = (process.env.NEXT_PUBLIC_WP_SITE_URL ?? "").replace(/\/$/, "");
    const connectSrc = ["'self'", wpSiteUrl].filter(Boolean).join(" ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'self'; base-uri 'self'; object-src 'none'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;

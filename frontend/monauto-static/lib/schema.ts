// JSON-LD structuré — même modèle cible que techno-play.com et
// besthomeproject.com (2026-11-20) : entités (Organization, WebSite, Person)
// déclarées une fois avec un @id stable, puis référencées ailleurs
// (`{"@id": ...}`) plutôt que dupliquées à chaque page.
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_LINKS, SITE_LEGAL } from "./site";
import { resolveCoverImage, type Post } from "./posts";
import { resolveAuthor, authorUrl, type Author } from "./authors";
import { getCategory } from "./categories";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

function organizationRef() {
  return { "@id": ORGANIZATION_ID };
}

function urlAbsolue(src: string) {
  return /^https?:\/\//.test(src) ? src : `${SITE_URL}${src}`;
}

function companySchema() {
  return {
    "@type": "Organization",
    name: SITE_LEGAL.legalName,
    legalName: SITE_LEGAL.legalName,
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE_LEGAL.streetAddress,
      addressLocality: SITE_LEGAL.addressLocality,
      addressCountry: SITE_LEGAL.addressCountry,
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: SITE_LEGAL.contactEmail,
      availableLanguage: ["fr", "en"],
    },
  };
}

function organizationNode() {
  return {
    "@type": ["Organization", "NewsMediaOrganization"],
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    logo: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/#logo`,
      url: `${SITE_URL}/favicon.png`,
      contentUrl: `${SITE_URL}/favicon.png`,
      width: 192,
      height: 192,
    },
    ...(SOCIAL_LINKS.length > 0 ? { sameAs: SOCIAL_LINKS.map((s) => s.url) } : {}),
    publishingPrinciples: `${SITE_URL}/a-propos/`,
    parentOrganization: companySchema(),
  };
}

function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: organizationRef(),
  };
}

export function homepageSchema() {
  return { "@context": "https://schema.org", "@graph": [organizationNode(), websiteNode()] };
}

function personNode(author: Author) {
  const pageUrl = `${SITE_URL}${authorUrl(author)}`;
  const portraitId = `${pageUrl}#portrait`;
  return {
    "@type": "Person",
    "@id": `${pageUrl}#person`,
    name: author.name,
    url: pageUrl,
    jobTitle: author.role,
    description: author.shortBio,
    knowsAbout: author.expertise,
    ...(author.image
      ? { image: { "@type": "ImageObject", "@id": portraitId, url: urlAbsolue(author.image), contentUrl: urlAbsolue(author.image) } }
      : {}),
    worksFor: organizationRef(),
    sameAs: author.socials.map((s) => s.url),
    mainEntityOfPage: { "@id": pageUrl },
  };
}

function personRef(author: Author) {
  const pageUrl = `${SITE_URL}${authorUrl(author)}`;
  return { "@type": "Person", "@id": `${pageUrl}#person`, name: author.name, url: pageUrl };
}

export function profilePageSchema(author: Author) {
  const pageUrl = `${SITE_URL}${authorUrl(author)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": pageUrl,
        url: pageUrl,
        name: author.name,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntity: { "@id": `${pageUrl}#person` },
        ...(author.image ? { primaryImageOfPage: { "@id": `${pageUrl}#portrait` } } : {}),
        inLanguage: "fr-FR",
      },
      personNode(author),
    ],
  };
}

export function faqSchema(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function articleSchema(post: Post) {
  const cover = resolveCoverImage(post);
  const author = resolveAuthor(post.author);
  const category = post.category ? getCategory(post.category) : undefined;
  const pageUrl = `${SITE_URL}/${post.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${pageUrl}#article`,
    url: pageUrl,
    mainEntityOfPage: { "@id": pageUrl },
    headline: post.title,
    description: post.description,
    ...(cover.src ? { image: [urlAbsolue(cover.src)] } : {}),
    datePublished: post.date,
    dateModified: post.date,
    ...(category ? { articleSection: category.title } : {}),
    author: personRef(author),
    publisher: organizationRef(),
    inLanguage: post.locale === "en" ? "en" : "fr-FR",
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

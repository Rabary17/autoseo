export interface WpImageSize {
  source_url: string;
  width: number;
  height: number;
}

export interface WpImage {
  source_url: string;
  alt_text: string;
  media_details?: {
    width: number;
    height: number;
    // Uniquement les tailles enregistrées côté WP (monauto_card, monauto_hero,
    // thumbnail, full) — voir wp-content/mu-plugins/monauto-headless.php
    // section 0 et docs/architecture-headless.md section 9.
    sizes?: Record<string, WpImageSize>;
  };
}

export interface WpUser {
  id: number;
  slug: string;
  name: string;
  description: string;
  link: string;
  acf?: { job_title?: string; same_as?: string };
}

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  description: string;
  count: number;
  taxonomy: "category" | "post_tag";
  parent?: number;
}

export interface WpPage {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  date: string;
  modified: string;
  modified_gmt: string;
  parent: number;
  featured_media?: number;
  acf?: { tldr?: string; sources?: string; faq?: string; meta_title?: string; meta_description?: string; keywords?: string };
  _embedded?: {
    "wp:featuredmedia"?: WpImage[];
  };
}

export interface WpPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  author: number;
  categories: number[];
  tags: number[];
  acf?: { tldr?: string; sources?: string; faq?: string; meta_title?: string; meta_description?: string; keywords?: string };
  _embedded?: {
    author?: WpUser[];
    "wp:featuredmedia"?: WpImage[];
    "wp:term"?: WpTerm[][];
  };
}

export interface Source {
  label: string;
  url: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

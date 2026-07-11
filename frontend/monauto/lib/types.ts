export interface WpImage {
  source_url: string;
  alt_text: string;
  media_details?: { width: number; height: number };
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
  date: string;
  modified: string;
}

export interface WpPost {
  id: number;
  slug: string;
  date: string;
  modified: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  author: number;
  categories: number[];
  tags: number[];
  acf?: { tldr?: string; sources?: string };
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

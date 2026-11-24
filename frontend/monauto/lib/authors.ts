// Rédaction du site — source de vérité pour l'encart auteur, la page
// /auteur/<slug>/ et le JSON-LD Person. Généré depuis
// config/niches/auto-mobilite/niche.json (6 personas A-F) lors de la
// migration WordPress → Markdown (2026-11-20) — ces 6 auteurs existaient déjà
// côté WordPress (comptes /wp/v2/users), ce fichier en devient la seule
// source de vérité côté site. `expertise` dérivé des silos assignés à chaque
// auteur dans niche.json.
export interface AuthorSocial {
  label: string;
  url: string;
}

export interface Author {
  slug: string;
  name: string;
  initials: string;
  role: string;
  /** Photo de profil carrée, sous public/ — déjà présente (migrée depuis
   * frontend/monauto/public/authors/). */
  image?: string;
  shortBio: string;
  bio: string[];
  expertise: string[];
  socials: AuthorSocial[];
}

export const AUTHORS: Author[] = [
  {
    slug: "andrianina-rabarivelo",
    name: "Andrianina RABARIVELO",
    initials: "AR",
    role: "Rédacteur en chef",
    image: "/authors/andrianina-rabarivelo.webp",
    shortBio:
      "Rédacteur en chef du site, Andrianina RABARIVELO est développeur et responsable technique. Il fixe la ligne éditoriale et veille à ce que chaque article réponde à une vraie question de lecteur.",
    bio: [
      "Andrianina RABARIVELO est le rédacteur en chef du site. Développeur et responsable technique, il conçoit les automatisations éditoriales et fixe la ligne de la rédaction.",
      "Son critère, simple et sans pitié : un bon article se juge à une seule chose — est-ce que tu as réglé ton problème à la fin ?",
    ],
    expertise: ["Ligne éditoriale", "Automatisation"],
    socials: [],
  },
  {
    slug: "julien-fabre",
    name: "Julien Fabre",
    initials: "JF",
    role: "Mécanicien & rédacteur technique",
    image: "/authors/julien-fabre.webp",
    shortBio:
      "Mécanicien pendant douze ans en atelier indépendant avant de se consacrer à l'écriture technique. Julien traduit les diagnostics en explications concrètes — combien ça coûte, peut-on le faire soi-même, jusqu'où attendre avant que ça casse pour de bon.",
    bio: [
      "Mécanicien pendant douze ans en atelier indépendant avant de se consacrer à l'écriture technique. Julien traduit les diagnostics en explications concrètes — combien ça coûte, peut-on le faire soi-même, jusqu'où attendre avant que ça casse pour de bon.",
    ],
    expertise: ["Entretien & révision", "Pannes & diagnostic", "Pièces détachées & accessoires"],
    socials: [],
  },
  {
    slug: "thomas-lefevre",
    name: "Thomas Lefèvre",
    initials: "TL",
    role: "Essayeur automobile & passionné de sport auto",
    image: "/authors/thomas-lefevre.webp",
    shortBio:
      "Ancien pilote amateur en circuit, Thomas essaie et compare les modèles avec un œil de conducteur exigeant plutôt que de commercial. Il aime les chiffres qui ne mentent pas : consommation réelle, fiabilité constatée, valeur de revente.",
    bio: [
      "Ancien pilote amateur en circuit, Thomas essaie et compare les modèles avec un œil de conducteur exigeant plutôt que de commercial. Il aime les chiffres qui ne mentent pas : consommation réelle, fiabilité constatée, valeur de revente.",
    ],
    expertise: ["Marques & modèles", "Essais & comparatifs", "Sport auto & passion", "Combien ça coûte vraiment"],
    socials: [],
  },
  {
    slug: "camille-roussel",
    name: "Camille Roussel",
    initials: "CR",
    role: "Conseillère achat & spécialiste mobilité électrique",
    image: "/authors/camille-roussel.webp",
    shortBio:
      "Camille accompagne les lecteurs dans leurs décisions d'achat — neuf, occasion ou électrique — avec un objectif simple : éviter les regrets à 10 000 km. Elle suit de près l'évolution des aides, de l'autonomie réelle et des coûts cachés de l'électrique.",
    bio: [
      "Camille accompagne les lecteurs dans leurs décisions d'achat — neuf, occasion ou électrique — avec un objectif simple : éviter les regrets à 10 000 km. Elle suit de près l'évolution des aides, de l'autonomie réelle et des coûts cachés de l'électrique.",
    ],
    expertise: ["Achat voiture neuve", "Voiture d'occasion", "Électrique & hybride"],
    socials: [],
  },
  {
    slug: "sophie-andrieu",
    name: "Sophie Andrieu",
    initials: "SA",
    role: "Spécialiste démarches administratives auto",
    image: "/authors/sophie-andrieu.webp",
    shortBio:
      "Sophie décortique les démarches (carte grise, assurance, permis) pour qu'elles prennent le moins de temps possible — délais réels, documents à ne pas oublier, pièges à éviter. Elle n'est pas juriste et le dit clairement quand une situation dépasse le cadre d'un guide pratique.",
    bio: [
      "Sophie décortique les démarches (carte grise, assurance, permis) pour qu'elles prennent le moins de temps possible — délais réels, documents à ne pas oublier, pièges à éviter. Elle n'est pas juriste et le dit clairement quand une situation dépasse le cadre d'un guide pratique.",
    ],
    expertise: ["Carte grise & démarches", "Assurance auto", "Permis & conduite"],
    socials: [],
  },
  {
    slug: "karim-belaid",
    name: "Karim Belaïd",
    initials: "KB",
    role: "Spécialiste deux-roues & mobilités urbaines",
    image: "/authors/karim-belaid.webp",
    shortBio:
      "Karim roule en scooter, moto et vélo électrique selon les trajets — et écrit avec ce mélange d'usages en tête plutôt qu'un seul mode de transport. Sujet de prédilection : ce qui marche vraiment en ville au quotidien, pas en brochure.",
    bio: [
      "Karim roule en scooter, moto et vélo électrique selon les trajets — et écrit avec ce mélange d'usages en tête plutôt qu'un seul mode de transport. Sujet de prédilection : ce qui marche vraiment en ville au quotidien, pas en brochure.",
    ],
    expertise: ["Moto & scooter", "Vélo & nouvelles mobilités", "Mobilité partagée & transports"],
    socials: [],
  },
  {
    slug: "nathalie-moreau",
    name: "Nathalie Moreau",
    initials: "NM",
    role: "Spécialiste voyage & usages auto spécifiques",
    image: "/authors/nathalie-moreau.webp",
    shortBio:
      "Nathalie a parcouru une bonne partie de l'Europe en camping-car et carbure aux itinéraires bien préparés. Elle couvre aussi les usages moins grand public — utilitaires, flottes pro, consommation — avec le même souci du détail pratique.",
    bio: [
      "Nathalie a parcouru une bonne partie de l'Europe en camping-car et carbure aux itinéraires bien préparés. Elle couvre aussi les usages moins grand public — utilitaires, flottes pro, consommation — avec le même souci du détail pratique.",
    ],
    expertise: ["Carburants & consommation", "Camping-car & van", "Utilitaires & flottes pro", "Road trips & voyage auto"],
    socials: [],
  },
];

export const DEFAULT_AUTHOR_SLUG = "andrianina-rabarivelo";

export function getAuthor(slug: string | undefined): Author | undefined {
  return AUTHORS.find((a) => a.slug === slug);
}

export function resolveAuthor(value: string | undefined): Author {
  const bySlug = getAuthor(value);
  if (bySlug) return bySlug;
  const byName = AUTHORS.find((a) => a.name.toLowerCase() === value?.trim().toLowerCase());
  return byName ?? (getAuthor(DEFAULT_AUTHOR_SLUG) as Author);
}

export function authorUrl(author: Author) {
  return `/auteur/${author.slug}/`;
}

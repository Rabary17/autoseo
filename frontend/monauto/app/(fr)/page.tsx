import type { Metadata } from "next";
import Link from "next/link";
import HomeArticleCard from "@/components/HomeArticleCard";
import JsonLd from "@/components/JsonLd";
import NewsletterForm from "@/components/NewsletterForm";
import { getPosts } from "@/lib/wp";
import { SILOS } from "@/lib/taxonomy";
import { websiteSchema, organizationSchema } from "@/lib/schema";
import { pageMeta } from "@/lib/seo-meta";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: `${SITE_NAME} — Technologies automobiles et innovation mobilité`,
  description:
    "Motorisations, sécurité, transmission, autonomie et connectivité : explorez les technologies automobiles essentielles. Des guides techniques vérifiés par nos experts.",
  path: "/",
});

export const revalidate = 900;

// Périmètre accueil (charter 2026-10-02) : technologie automobile uniquement.
// Exclut vélo/trottinette, démarches carte grise, tarifs et comparatifs de services.
const HORS_SCOPE = /vélo|velo|trottinette|titulaire|duplicata|carte grise|configurateur|coût de possession|assurance|camping/i;

// Pictogrammes : tracés SVG inline (la CSP du site bloque les ressources externes).
const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

const RUBRIQUE_ICONS: Record<string, React.ReactNode> = {
  motorisations: (
    <svg {...ICON_PROPS}>
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  ),
  securite: (
    <svg {...ICON_PROPS}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  ),
  transmission: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  ),
  "autonomie-connectivite": (
    <svg {...ICON_PROPS}>
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path d="M12 18h.01" />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle cx="12" cy="12" r="2" />
      <path d="m13.41 10.59 5.66-5.66" />
    </svg>
  ),
  "reglementation-technique": (
    <svg {...ICON_PROPS}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  ),
};

// Question d’exemple affichée sur chaque tuile de rubrique (étiquette « Par exemple »).
const EXEMPLES: Record<string, string> = {
  motorisations: "Comment fonctionne un moteur hybride ?",
  securite: "À quoi servent l’ABS et l’ESP ?",
  transmission: "Quelle différence entre boîte manuelle et automatique ?",
  "autonomie-connectivite": "Qu’est-ce qu’un véhicule autonome, concrètement ?",
  "reglementation-technique": "Que vérifie le contrôle technique ?",
};

// Technologies automobiles actuelles (cartes de la section « Technologie automobile »).
const NOUVELLES_TECHNOLOGIES = [
  { titre: "Aides à la conduite ADAS", texte: "Freinage d’urgence et maintien de voie : des systèmes qui surveillent la route et interviennent en cas de danger." },
  { titre: "Industrie automobile actuelle", texte: "Électrification, électronique et logiciel transforment la fabrication, la conception et l’usage des véhicules." },
  { titre: "Conduite autonome", texte: "Niveaux d’autonomie et pilotage automatique : ce que le véhicule fait seul, et ce qui reste à la charge du conducteur." },
  { titre: "Mise à jour à distance (OTA)", texte: "Mises à jour du système embarqué transmises sans passer par un atelier, pour corriger ou ajouter des fonctions." },
  { titre: "Affichage tête haute (HUD)", texte: "Informations projetées sur le pare-brise, pour garder les yeux sur la route, avec des repères en réalité augmentée." },
  { titre: "Capteurs LiDAR et radars", texte: "Détection d’obstacles et télédétection : radars, lasers et caméras qui mesurent distances et vitesses autour du véhicule." },
  { titre: "Batterie solide", texte: "Une technologie encore en développement, qui promet une densité énergétique plus élevée et une meilleure autonomie." },
  { titre: "Cockpit numérique", texte: "Tableau de bord virtuel et écrans OLED qui remplacent les cadrans traditionnels par une instrumentation entièrement digitale." },
  { titre: "Infodivertissement connecté", texte: "Apple CarPlay et Android Auto, y compris sans fil, pour utiliser son smartphone en toute sécurité au volant." },
  { titre: "Intelligence artificielle automobile", texte: "Reconnaissance vocale embarquée et analyse prédictive qui anticipe l’usure ou les besoins d’entretien." },
  { titre: "Régulateur de vitesse adaptatif (ACC)", texte: "Maintien automatique de la vitesse et de la distance de sécurité avec le véhicule qui précède." },
  { titre: "Clé sur smartphone (UWB et NFC)", texte: "Déverrouillage et démarrage sans contact, grâce à la communication à courte portée entre téléphone et véhicule." },
  { titre: "Caméras 360 degrés et vision nocturne", texte: "Aide au stationnement et vision thermique, pour voir ce qui se passe autour du véhicule, de jour comme de nuit." },
  { titre: "Communication V2X", texte: "Échange de données entre véhicule, infrastructure et autres usagers, pour anticiper les dangers avant qu’ils ne se voient." },
  { titre: "Diagnostic embarqué et télématique", texte: "Prise OBD et suivi à distance : des données de fonctionnement qui permettent une maintenance prédictive." },
  { titre: "Recharge ultra-rapide 800 V", texte: "Architecture haute tension et gestion thermique qui réduisent le temps de recharge des véhicules électriques." },
];


const CHECK_ICON = (
  <svg {...ICON_PROPS} width={18} height={18}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// Quatre engagements éditoriaux (cartes de la section « méthode »).
const ENGAGEMENTS = [
  {
    titre: "Des sources identifiées",
    texte:
      "Documentation constructeur, normes, textes réglementaires, brevets, publications scientifiques et essais de notre rédaction. Chaque source est citée.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
  {
    titre: "Les faits d’abord",
    texte:
      "Ce qui est établi et ce qui relève de l’annonce sont séparés. Lorsqu’une information n’est pas confirmée, nous le disons.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    titre: "Des explications accessibles",
    texte:
      "Chaque terme technique est expliqué dès qu’il apparaît, avec des mots simples et des exemples tirés de la vie réelle.",
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
  {
    titre: "Des articles datés et corrigés",
    texte:
      "Chaque article indique sa date de publication. Toute erreur signalée donne lieu à une correction, mentionnée dans l’article.",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
];

const FAQ = [
  {
    q: "C’est quoi, techcars ?",
    a: "Un média francophone dédié à la technologie automobile. Il explique les systèmes qui équipent les véhicules, rubrique par rubrique, avec des mots simples.",
  },
  {
    q: "Faut-il s’y connaître en mécanique pour lire les articles ?",
    a: "Non. Les articles expliquent les termes techniques au moment où ils apparaissent, sans supposer de connaissances préalables.",
  },
  {
    q: "Par où commencer ?",
    a: "Choisissez une rubrique dans le menu ou sur cette page, puis un sous-thème. Chaque rubrique regroupe des guides classés par thème.",
  },
  {
    q: "D’où viennent vos informations ?",
    a: "De sources identifiées : documentation constructeur, normes et textes réglementaires, brevets, publications scientifiques et essais de notre rédaction. Elles sont citées.",
  },
  {
    q: "Comment signaler une erreur ?",
    a: "Écrivez-nous via la page Contact. Toute correction est mentionnée dans l’article concerné.",
  },
];

// Profils éditoriaux (personas fictifs, décision documentée dans STATE.md) : ils présentent
// la ligne d’une rubrique technique et ne décrivent aucun parcours personnel.
const EQUIPE = [
  {
    slug: "julien-fabre",
    nom: "Julien Fabre",
    role: "Mécanicien & rédacteur technique",
    sujets: "Motorisations · Diagnostic · Entretien",
    bio: "Julien explique les systèmes mécaniques : comment ils fonctionnent, quels signes doivent alerter, ce qui se vérifie soi-même et ce qui demande un atelier.",
  },
  {
    slug: "thomas-lefevre",
    nom: "Thomas Lefèvre",
    role: "Essayeur automobile",
    sujets: "Aides à la conduite · Freinage · Essais",
    bio: "Thomas compare les systèmes d’aide à la conduite et de freinage à partir d’essais et de données vérifiables : ce qu’ils font réellement, dans quelles conditions, et leurs limites.",
  },
  {
    slug: "karim-belaid",
    nom: "Karim Belaïd",
    role: "Spécialiste deux-roues & transmission",
    sujets: "Transmission · Deux-roues · Moteurs-roues",
    bio: "Karim explique comment la puissance arrive jusqu’à la roue sur les deux-roues : chaîne, courroie, arbre à cardan et moteurs intégrés aux roues, avec ce que chaque solution change au quotidien.",
  },
  {
    slug: "camille-roussel",
    nom: "Camille Roussel",
    role: "Spécialiste mobilité électrique",
    sujets: "Autonomie · Recharge · Électrique",
    bio: "Camille explique l’autonomie réelle des véhicules électriques, la recharge et les coûts sur la durée, pour distinguer les chiffres des fiches techniques et des usages.",
  },
  {
    slug: "nathalie-moreau",
    nom: "Nathalie Moreau",
    role: "Spécialiste connectivité & flottes",
    sujets: "Télématique · Flottes · Données de conduite",
    bio: "Nathalie explique la connectivité des véhicules utilitaires et de flotte : télématique, données de conduite, services à distance, et ce que ces données permettent réellement de suivre.",
  },
  {
    slug: "sophie-andrieu",
    nom: "Sophie Andrieu",
    role: "Spécialiste réglementation technique",
    sujets: "Normes · Contrôle technique · Homologation",
    bio: "Sophie décrit les normes et les contrôles qui encadrent les véhicules : contrôle technique, homologation, textes de référence, et ce qu’ils vérifient concrètement.",
  },
];

export default async function HomePage() {
  const { posts: fetched } = await getPosts(1, 30).catch((e) => {
    console.warn(`[HomePage] échec du fetch WP, fallback sur []: ${e}`);
    return { posts: [], total: 0, totalPages: 0 };
  });

  const posts = fetched
    .filter((p) => {
      const cat = p._embedded?.["wp:term"]?.[0]?.[0]?.name ?? "";
      return !HORS_SCOPE.test(`${cat} ${p.title.rendered}`);
    })
    .slice(0, 3);

  return (
    <>
      {/* Hero : titre principal et présentation */}
      <section className="hp-hero">
        <div className="wrap hp-wrap hp-hero__grid">
          <div className="hp-hero__text">
            <p className="hp-eyebrow">
              <span className="hp-dot" aria-hidden="true" />
              Média technique automobile
            </p>
            <h1>Technologie automobile</h1>
            <p className="hp-lead">
              Sur Tech cars, la technologie automobile s’explique pas à pas : moteurs, sécurité, transmission, autonomie,
              connectivité et réglementation. Chaque système est décrit sans jargon, et les faits établis sont toujours
              séparés des annonces.
            </p>
            <div className="hp-actions">
              <a className="btn btn--primary" href="#technologie-automobile">
                Comprendre la technologie automobile
              </a>
              <a className="btn btn--secondary" href="#rubriques">
                Choisir une rubrique
              </a>
            </div>
            <ul className="hp-proof">
              <li>
                {CHECK_ICON}
                Des sources citées pour chaque guide
              </li>
              <li>
                {CHECK_ICON}
                Faits établis et annonces séparés
              </li>
              <li>
                {CHECK_ICON}
                Articles datés, corrections signalées
              </li>
            </ul>
          </div>
          <figure className="hp-visual">
            <img
              className="hp-visual__img"
              src="/images/accueil-hero-1920.webp"
              srcSet="/images/accueil-hero-800.webp 800w, /images/accueil-hero-1920.webp 1920w"
              sizes="(min-width: 960px) 520px, 100vw"
              width={1920}
              height={1280}
              alt="Moteur automobile en gros plan : distribution et organes de motorisation"
              fetchPriority="high"
            />
            <img className="hp-visual__mark" src="/mark.png" alt="" width={56} height={56} aria-hidden="true" />
          </figure>
        </div>
      </section>

      {/* Technologie automobile : définition, technologies actuelles et liens vers les rubriques */}
      <section className="hp-section" id="technologie-automobile">
        <div className="wrap hp-wrap">
          <p className="hp-kicker">Le sujet</p>
          <h2 className="hp-h2">Technologie automobile</h2>
          <div className="hp-prose">
            <h3>Qu’est-ce que la technologie automobile ?</h3>
            <p>
              La technologie automobile regroupe l’ensemble des systèmes qui permettent à un véhicule de se déplacer,
              de se diriger, de ralentir, de protéger ses occupants et de communiquer. Elle couvre la motorisation, la
              transmission, la sécurité active et passive, l’électronique embarquée et les aides à la conduite.
            </p>
            <p>
              Comprendre ces systèmes aide à mieux choisir un véhicule, à entretenir sa voiture et à savoir ce que
              font réellement les technologies annoncées. Pour approfondir, consultez les guides sur la{" "}
              <Link href="/categorie/motorisations/">technologie des voitures électriques</Link> et sur la{" "}
              <Link href="/categorie/motorisations/">technologie des véhicules à moteur</Link>.
            </p>

            <h3>Quelles sont les nouvelles technologies utilisées dans le secteur automobile ?</h3>
            <p>
              L’industrie automobile actuelle combine électrification, électronique et logiciel. Les technologies
              suivantes sont celles que l’on rencontre le plus souvent aujourd’hui, dans les voitures neuves comme dans
              les modèles récents.
            </p>
          </div>

          <ul className="hp-promise-grid hp-tech-grid">
            {NOUVELLES_TECHNOLOGIES.map((t) => (
              <li key={t.titre} className="hp-promise-card">
                <h3>{t.titre}</h3>
                <p>{t.texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rubriques : tuiles photo avec pictogramme, description et question d’exemple */}
      <section className="hp-section" id="rubriques">
        <div className="wrap hp-wrap">
          <p className="hp-kicker">Les rubriques</p>
          <h2 className="hp-h2">Quelle technologie voulez-vous comprendre ?</h2>
          <p className="hp-intro">
            Choisissez une rubrique. Chacune regroupe des guides et des sous-thèmes, avec une question concrète en
            exemple.
          </p>
          <ul className="hp-trends">
            {SILOS.map((s) => (
              <li key={s.slug} className="hp-trend">
                <img
                  className="hp-trend__img"
                  src={`/silos/${s.slug}-cover.webp`}
                  alt=""
                  width={1600}
                  height={900}
                  loading="lazy"
                  decoding="async"
                />
                <div className="hp-trend__body">
                  <span className="hp-trend__tag" aria-hidden="true">
                    {RUBRIQUE_ICONS[s.slug]}
                  </span>
                  <h3>
                    <Link href={`/categorie/${s.slug}/`}>{s.name}</Link>
                  </h3>
                  <p>{s.desc}</p>
                  {EXEMPLES[s.slug] && <p className="hp-trend__example">Par exemple : « {EXEMPLES[s.slug]} »</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Derniers articles : cartes avec image, rubrique, titre, extrait, auteur et date */}
      <section className="hp-section" id="derniers-articles">
        <div className="wrap hp-wrap">
          <p className="hp-kicker">Le blog</p>
          <h2 className="hp-h2">Les derniers articles</h2>
          <p className="hp-intro">Guides techniques, décryptages et analyses publiés par notre rédaction.</p>
          {posts.length > 0 ? (
            <div className="hp-articles">
              {posts.map((p) => (
                <HomeArticleCard key={p.id} post={p} />
              ))}
            </div>
          ) : (
            <p className="hp-empty">Les prochains articles arrivent bientôt.</p>
          )}
          <div className="hp-actions hp-actions--end">
            <Link className="btn btn--secondary" href="/blog/">
              Tous les articles
            </Link>
          </div>
        </div>
      </section>

      {/* Méthode : quatre engagements éditoriaux */}
      <section className="hp-section">
        <div className="wrap hp-wrap">
          <p className="hp-kicker">Notre méthode</p>
          <h2 className="hp-h2">Comment nous traitons la technologie automobile</h2>
          <p className="hp-intro">Chaque article suit les mêmes règles. Vous savez donc à quoi vous attendre.</p>
          <ul className="hp-promise-grid">
            {ENGAGEMENTS.map((e) => (
              <li key={e.titre} className="hp-promise-card">
                <span className="hp-icon" aria-hidden="true">
                  {e.icon}
                </span>
                <h3>{e.titre}</h3>
                <p>{e.texte}</p>
              </li>
            ))}
          </ul>
          <p className="hp-note">
            <strong>Transparence.</strong> Nous ne publions pas de contenu sponsorisé déguisé. Pour en savoir plus sur
            notre méthode, consultez la page À propos.
          </p>
          <div className="hp-actions">
            <Link className="btn btn--primary" href="/a-propos/">
              Notre ligne éditoriale
            </Link>
            <Link className="btn btn--secondary" href="/contact/">
              Signaler une erreur
            </Link>
          </div>
        </div>
      </section>

      {/* Le média : image de rubrique et présentation */}
      <section className="hp-section">
        <div className="wrap hp-wrap hp-story">
          <figure className="hp-story__visual">
            <img
              src="/silos/motorisations-cover.webp"
              alt="Coupe d’un moteur automobile"
              width={1600}
              height={900}
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="hp-story__text">
            <p className="hp-kicker">Le média</p>
            <h2 className="hp-h2">Un média technique, pensé pour comprendre</h2>
            <p>
              techcars explique la technologie qui équipe les véhicules d’aujourd’hui et de demain : moteurs et
              motorisations électrifiées, aides à la conduite, transmissions, connectivité et réglementation technique.
            </p>
            <p>
              Chaque rubrique est découpée en sous-thèmes, pour avancer pas à pas : du fonctionnement d’un système à ses
              limites, en passant par les textes qui l’encadrent.
            </p>
            <div className="hp-actions">
              <Link className="btn btn--secondary" href="/a-propos/">
                En savoir plus sur le média
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Équipe éditoriale : un profil par rubrique technique couverte */}
      <section className="hp-section">
        <div className="wrap hp-wrap">
          <p className="hp-kicker">Notre équipe éditoriale</p>
          <h2 className="hp-h2">Des profils éditoriaux pour chaque rubrique</h2>
          <p className="hp-intro">
            Ces profils éditoriaux présentent la ligne de chaque rubrique. Ils ne décrivent aucun parcours personnel.
          </p>
          <ul className="hp-team-grid">
            {EQUIPE.map((m) => (
              <li key={m.slug} className="hp-team-card">
                <img
                  className="hp-team-card__photo"
                  src={`/authors/${m.slug}.webp`}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                />
                <h3>
                  <Link href={`/auteur/${m.slug}/`}>{m.nom}</Link>
                </h3>
                <p className="hp-team-card__role">{m.role}</p>
                <p className="hp-team-card__topics">{m.sujets}</p>
                <p className="hp-team-card__bio">{m.bio}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Questions fréquentes */}
      <section className="hp-section">
        <div className="wrap hp-wrap hp-faq">
          <div className="hp-faq__head">
            <h2 className="hp-h2">Questions fréquentes</h2>
            <p>
              Tout ce qu’il faut savoir sur techcars, en bref. Les autres réponses sont sur la{" "}
              <Link href="/faq/">page FAQ</Link>.
            </p>
          </div>
          <div className="hp-faq__list">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Appel à question : bandeau rouge sur image de rubrique */}
      <section className="hp-section">
        <div className="wrap hp-wrap">
          <div className="hp-cta">
            <img
              className="hp-cta__bg"
              src="/silos/reglementation-technique-cover.webp"
              alt=""
              width={1600}
              height={900}
              loading="lazy"
              decoding="async"
            />
            <div className="hp-cta__content">
              <h2>Une technologie vous intrigue ?</h2>
              <p>Dites-nous ce que vous aimeriez voir expliqué dans nos prochains guides.</p>
              <Link className="btn btn--light" href="/contact/">
                Écrire à la rédaction
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="hp-section hp-section--last">
        <div className="wrap hp-wrap">
          <div className="hp-nl">
            <h2>La newsletter techcars</h2>
            <p>Chaque semaine : nos derniers guides techniques, innovations et analyses en profondeur. Zéro spam.</p>
            <NewsletterForm />
          </div>
        </div>
      </section>

      <JsonLd data={{ "@context": "https://schema.org", ...websiteSchema() }} />
      <JsonLd data={{ "@context": "https://schema.org", ...organizationSchema() }} />
    </>
  );
}

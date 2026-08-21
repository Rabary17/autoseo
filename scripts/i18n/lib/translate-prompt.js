// Prompts et schémas de la traduction (2026-08-18).
//
// Principe directeur : traduire n'est PAS régénérer. Le contenu français a
// déjà été relu, gaté, corrigé à la main dans certains cas — la traduction
// doit le transporter fidèlement, pas le réécrire avec ses propres idées.
// D'où des instructions beaucoup plus contraignantes que celles de la
// génération : interdiction d'ajouter, de retirer, de réordonner.
//
// Deux appels distincts, volontairement séparés :
//   1. `buildSlugRequest` — traduit les TITRES de tout un silo en un seul
//      appel, pour en dériver les slugs. Doit se faire AVANT la traduction du
//      contenu : un article traduit contient des liens vers ses articles
//      frères, dont on a besoin de connaître le slug cible à l'avance.
//   2. `buildContentRequest` — traduit un article complet.

const LANG_NAMES = {
  en: 'anglais (variante britannique)',
  es: 'espagnol (Espagne)',
  it: 'italien',
  de: 'allemand (Allemagne)',
};

const EM_DASH_RULE = {
  en: "Le tiret cadratin (—) est une ponctuation anglaise normale : utilise-le librement là où l'anglais l'utiliserait naturellement.",
  de: "Le tiret cadratin (—) est une ponctuation allemande normale : utilise-le librement là où l'allemand l'utiliserait naturellement.",
  es: "N'utilise JAMAIS de tiret cadratin espacé ( — ). L'espagnol préfère la virgule, les deux-points ou les parenthèses.",
  it: "N'utilise JAMAIS de tiret cadratin espacé ( — ). L'italien préfère la virgule, les deux-points ou les parenthèses.",
};

/* ---------- 1. Slugs ---------- */

const SLUG_SCHEMA = {
  name: 'slugs_traduits',
  schema: {
    type: 'object',
    properties: {
      slugs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slug_fr: { type: 'string' },
            titre_traduit: { type: 'string' },
            slug_traduit: { type: 'string' },
          },
          required: ['slug_fr', 'titre_traduit', 'slug_traduit'],
          additionalProperties: false,
        },
      },
    },
    required: ['slugs'],
    additionalProperties: false,
  },
};

function buildSlugRequest({ locale, items }) {
  const langue = LANG_NAMES[locale] || locale;
  const system = `Tu traduis des titres d'articles automobiles du français vers l'${langue}, et tu en dérives des slugs d'URL.

RÈGLES POUR LE TITRE TRADUIT
- Traduis le sens, pas les mots. Un titre doit sonner naturel pour un lecteur natif.
- Conserve l'intention de recherche : si le titre français cible une question pratique, le titre traduit doit cibler la même question.
- Garde les noms propres, marques et modèles tels quels (Renault Master, Fiat Ducato).
- Ne remplace JAMAIS un organisme public français par un organisme étranger (jamais NHS, DVLA, Medicare, TÜV, INPS...). "taxi conventionné CPAM" ne devient pas "NHS-approved taxi" : la CPAM reste la CPAM.

RÈGLES POUR LE SLUG
- Uniquement des minuscules, des chiffres et des tirets. Aucun accent, aucun caractère spécial, aucun underscore.
- 3 à 6 mots maximum, en reprenant le mot-clé principal de la langue cible.
- Le slug doit être en langue cible, JAMAIS une translittération du français.
- Chaque slug doit être unique dans la liste.

Exemple pour l'anglais : "Hivernage camping-car : la checklist" -> titre "Motorhome Winterisation: The Complete Checklist", slug "motorhome-winterisation-checklist".`;

  const liste = items.map(i => `- slug_fr: ${i.slug}\n  titre: ${i.titre}`).join('\n');
  return {
    system,
    messages: [{ role: 'user', content: `Traduis ces ${items.length} titres et propose un slug pour chacun.\n\n${liste}` }],
    schema: SLUG_SCHEMA,
  };
}

/* ---------- 2. Contenu ---------- */

const CONTENT_SCHEMA = {
  name: 'article_traduit',
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      content_gutenberg: { type: 'string' },
      excerpt: { type: 'string' },
      meta_title: { type: 'string' },
      meta_description: { type: 'string' },
      faq: {
        type: 'array',
        items: {
          type: 'object',
          properties: { question: { type: 'string' }, answer: { type: 'string' } },
          required: ['question', 'answer'],
          additionalProperties: false,
        },
      },
    },
    required: ['title', 'content_gutenberg', 'excerpt', 'meta_title', 'meta_description', 'faq'],
    additionalProperties: false,
  },
};

function buildContentRequest({ locale, source, titreImpose }) {
  const langue = LANG_NAMES[locale] || locale;
  const system = `Tu traduis un article de blog automobile du français vers l'${langue}. Tu es traducteur, pas rédacteur.

INTERDICTIONS ABSOLUES
- N'ajoute AUCUNE information, section, phrase ou exemple absent de l'original.
- Ne supprime AUCUNE section, phrase, tableau ou élément de liste.
- Ne réordonne rien. L'ordre des titres et des paragraphes est identique à l'original.
- Ne modifie AUCUN chiffre, prix, date, pourcentage ou unité. Un prix en euros reste en euros, une distance en kilomètres reste en kilomètres. Ne convertis jamais.

STRUCTURE GUTENBERG
- Le contenu est en blocs Gutenberg WordPress. Tu dois rendre EXACTEMENT la même structure de blocs.
- Les commentaires de bloc (<!-- wp:paragraph -->, <!-- /wp:paragraph -->, etc.) sont recopiés à l'identique, jamais traduits, jamais supprimés, jamais réordonnés.
- Les attributs href des liens sont recopiés À L'IDENTIQUE. Ne traduis JAMAIS une URL. Le texte d'ancre, lui, se traduit normalement.
- Les balises HTML (<table>, <figure>, <strong>...) sont conservées telles quelles.

QUALITÉ DE LANGUE
- Écris comme un rédacteur natif, pas comme une traduction. Reformule les tournures qui sonneraient calquées.
- Conserve le rythme de l'original : phrases courtes, ton direct, pas de langue de bois.
- Garde les noms propres, marques et modèles tels quels.
- ${EM_DASH_RULE[locale] || EM_DASH_RULE.es}

CONTEXTE CULTUREL
- Le contenu parle de la France. Ne transpose pas vers un autre pays et n'invente aucune équivalence réglementaire locale.
- Quand une réalité française n'a pas d'équivalent (péage, aire de service, contrôle technique), traduis-la littéralement et garde le terme français entre parenthèses à la première occurrence.

INTERDICTION ABSOLUE : REMPLACER UNE INSTITUTION FRANÇAISE PAR UNE INSTITUTION ÉTRANGÈRE
- Ne remplace JAMAIS le nom d'un organisme public français par celui d'un organisme d'un autre pays. Jamais NHS, HMRC, DVLA, Medicare, IRS, DMV, TÜV, INPS, Seguridad Social, DGT, ni aucun équivalent.
- Un organisme français garde son nom, suivi d'une explication courte à la première occurrence.
- Exemple de ce qu'il NE FAUT PAS faire : traduire "taxi conventionné CPAM" par "NHS-approved taxi". La CPAM est française, le NHS britannique, et les taux de remboursement cités sont ceux du droit français. Écrire cela attribue des règles françaises au système de santé d'un autre pays : c'est faux, et le lecteur serait mal informé.
- Exemple de ce qu'il FAUT faire : "CPAM-approved taxi (CPAM is the French state health insurance fund)".
- La même règle vaut pour le titre, le slug proposé et les champs meta, pas seulement pour le corps du texte.

MÉTADONNÉES
- meta_title : 60 caractères maximum, jamais coupé en plein mot.
- meta_description : entre 120 et 158 caractères, jamais coupée en plein mot.`;

  const consigneTitre = titreImpose
    ? `\n\nLe titre traduit est IMPOSÉ (il détermine déjà l'URL publiée) : "${titreImpose}". Reprends-le exactement dans le champ title.`
    : '';

  const payload = {
    title: source.title,
    excerpt: source.excerpt,
    meta_title: source.meta_title,
    meta_description: source.meta_description,
    faq: source.faq,
    content_gutenberg: source.content_gutenberg,
  };

  return {
    system,
    messages: [{
      role: 'user',
      content: `Traduis cet article en ${langue}.${consigneTitre}\n\n${JSON.stringify(payload, null, 2)}`,
    }],
    schema: CONTENT_SCHEMA,
  };
}

/* ---------- 3. Taxonomie (silo + sous-cocons) ---------- */

// Traduite à part des articles, et une seule fois par silo : ces slugs
// composent le chemin de CHAQUE page de la locale (/en/<silo>/<sous-cocon>/).
// Une erreur ici se propage à toutes les URLs du silo, d'où un appel dédié
// plutôt qu'une dérivation approximative depuis les titres d'articles.
const TAXONOMY_SCHEMA = {
  name: 'taxonomie_traduite',
  schema: {
    type: 'object',
    properties: {
      silo_slug: { type: 'string' },
      silo_nom: { type: 'string' },
      sous_cocons: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slug_fr: { type: 'string' },
            nom_traduit: { type: 'string' },
            slug_traduit: { type: 'string' },
          },
          required: ['slug_fr', 'nom_traduit', 'slug_traduit'],
          additionalProperties: false,
        },
      },
    },
    required: ['silo_slug', 'silo_nom', 'sous_cocons'],
    additionalProperties: false,
  },
};

function buildTaxonomyRequest({ locale, silo }) {
  const langue = LANG_NAMES[locale] || locale;
  const system = `Tu traduis les rubriques d'un site automobile du français vers l'${langue}.

Ces libellés servent de RUBRIQUES DE NAVIGATION et composent les URLs du site. Ils doivent être :
- courts (1 à 3 mots), tels qu'un site natif les nommerait ;
- des termes de catégorie usuels dans la langue cible, pas des traductions littérales ;
- cohérents entre eux (même registre, même niveau de généralité).

Le slug suit les mêmes règles que pour les articles : minuscules, chiffres et tirets uniquement, aucun accent, 1 à 3 mots.

Exemple pour l'anglais : silo "Camping-car & van" -> nom "Motorhomes & Vans", slug "motorhomes-vans" ; sous-cocon "Entretien & hivernage" -> nom "Maintenance & Winterisation", slug "maintenance-winterisation".`;

  const liste = silo.sousCocons.map(c => `- slug_fr: ${c.slug}\n  nom: ${c.name}`).join('\n');
  return {
    system,
    messages: [{
      role: 'user',
      content: `Traduis ce silo et ses sous-rubriques.\n\nSilo : ${silo.name} (slug_fr: ${silo.slug})\n\nSous-rubriques :\n${liste}`,
    }],
    schema: TAXONOMY_SCHEMA,
  };
}

module.exports = { buildSlugRequest, buildContentRequest, buildTaxonomyRequest, LANG_NAMES };

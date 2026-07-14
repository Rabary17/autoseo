// Crée le jeu de contenu minimal pour valider la dynamisation headless :
// 1 catégorie, 1 tag, 1 auteur (persona A), 1 article complet, 1 page statique.
// Idempotent : réutilise l'élément existant si le slug est déjà présent.
const wp = require('./wp-client.js');

async function findOrCreate(type, query, payload) {
  const existing = await wp.request(`/${type}?${query}`);
  if (existing.length) return existing[0];
  return wp.request(`/${type}`, { method: 'POST', body: payload });
}

async function main() {
  const category = await findOrCreate(
    'categories',
    'slug=entretien',
    {
      name: 'Entretien & révision',
      slug: 'entretien',
      description: 'Tutos, prix et périodicités par modèle : vidange, freins, embrayage, distribution, climatisation, géométrie.',
    }
  );
  console.log('Catégorie', category.id, category.slug);

  const tag = await findOrCreate('tags', 'slug=vidange', {
    name: 'Vidange',
    slug: 'vidange',
  });
  console.log('Tag', tag.id, tag.slug);

  let author = (await wp.request('/users?slug=julien-fabre&context=edit')).find(u => u.slug === 'julien-fabre');
  if (!author) {
    author = await wp.request('/users', {
      method: 'POST',
      body: {
        username: 'julien-fabre',
        name: 'Julien Fabre',
        email: 'julien.fabre@monauto.example',
        password: 'M0n@ut0-Test-2026!',
        roles: ['author'],
        description: 'Mécanicien depuis 15 ans, spécialisé entretien et diagnostic. Rédige des guides concrets, sourcés et testés en atelier.',
      },
    });
    console.log('Auteur créé', author.id, author.slug);
  } else {
    console.log('Auteur existant', author.id, author.slug);
  }

  // Champs ACF auteur (job_title, same_as) — exposés nativement par ACF sur
  // /wp/v2/users (voir mu-plugins/monauto-headless.php). same_as : une URL par
  // ligne (texte brut), pas de tableau — ACF Free n'a pas de champ Repeater.
  await wp.request(`/users/${author.id}`, {
    method: 'POST',
    body: {
      acf: {
        job_title: 'Mécanicien, spécialiste entretien & révision',
        same_as: '',
      },
    },
  });

  const page = await findOrCreate('pages', 'slug=a-propos', {
    title: 'À propos de monauto',
    slug: 'a-propos',
    status: 'publish',
    content:
      '<!-- wp:paragraph -->\n<p>monauto est un média indépendant dédié à l\'auto et à la mobilité. Nos guides sont rédigés par une rédaction identifiée, sourcés et tenus à jour.</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:heading -->\n<h2>Notre méthode</h2>\n<!-- /wp:heading -->\n\n<!-- wp:paragraph -->\n<p>Chaque article cite ses sources (constructeurs, Sécurité routière, service-public.fr) et affiche sa date de mise à jour.</p>\n<!-- /wp:paragraph -->',
  });
  console.log('Page', page.id, page.slug);

  const articleContent = `<!-- wp:paragraph -->
<p>La vidange consiste à remplacer l'huile moteur usagée et son filtre pour préserver la lubrification et la longévité du moteur. Périodicité, prix moyen et signes qu'il ne faut pas ignorer : ce guide fait le point.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Quelle périodicité pour la vidange ?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>La plupart des constructeurs recommandent une vidange tous les 10 000 à 15 000 km, ou une fois par an si le kilométrage annuel est faible. Cet intervalle varie selon le type d'huile (minérale, semi-synthèse, 100 % synthèse) et l'usage du véhicule (trajets courts, remorquage, climat chaud).</p>
<!-- /wp:paragraph -->

<!-- wp:table -->
<figure class="wp-block-table"><table><thead><tr><th>Type d'huile</th><th>Intervalle indicatif</th></tr></thead><tbody><tr><td>Minérale</td><td>5 000 – 7 500 km</td></tr><tr><td>Semi-synthèse</td><td>7 500 – 10 000 km</td></tr><tr><td>100 % synthèse</td><td>10 000 – 15 000 km</td></tr></tbody></table></figure>
<!-- /wp:table -->

<!-- wp:heading -->
<h2>Prix moyen constaté</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Comptez entre 70 et 150 € en centre auto ou garage indépendant pour une citadine, huile et filtre inclus, et davantage en concession selon le modèle.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Peut-on la faire soi-même ?</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Oui, avec un cric, des chandelles, un bac de vidange et l'huile préconisée par le carnet d'entretien. L'huile usagée doit être rapportée en déchetterie ou centre auto, jamais jetée dans les égouts ou la nature.</p>
<!-- /wp:paragraph -->

<!-- wp:heading -->
<h2>Questions fréquentes</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><strong>Combien de temps dure une vidange ?</strong> Comptez environ 30 à 45 minutes en atelier, hors temps d'attente.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><strong>Que se passe-t-il si on dépasse l'intervalle recommandé ?</strong> L'huile perd ses propriétés lubrifiantes, ce qui accélère l'usure du moteur et peut annuler la garantie constructeur.</p>
<!-- /wp:paragraph -->`;

  // FAQ : mêmes questions/réponses, mot pour mot, que dans articleContent
  // ci-dessus (voir skills/geo.md section 3 — "questions dans le même ordre
  // que dans le texte").
  const faq = [
    {
      question: 'Combien de temps dure une vidange ?',
      answer: "Comptez environ 30 à 45 minutes en atelier, hors temps d'attente.",
    },
    {
      question: "Que se passe-t-il si on dépasse l'intervalle recommandé ?",
      answer:
        "L'huile perd ses propriétés lubrifiantes, ce qui accélère l'usure du moteur et peut annuler la garantie constructeur.",
    },
  ];

  const articlePayload = {
    title: 'Vidange : périodicité, prix et quand la faire soi-même',
    slug: 'vidange-guide',
    status: 'publish',
    content: articleContent,
    excerpt: 'Périodicité selon le type d\'huile, prix moyen constaté et étapes pour la faire soi-même en toute sécurité.',
    author: author.id,
    categories: [category.id],
    tags: [tag.id],
    acf: {
      tldr: 'Vidangez tous les 10 000 à 15 000 km (ou 1 fois/an) selon le type d\'huile. Comptez 70 à 150 € en atelier ; possible soi-même avec le bon équipement.',
      sources: "Carnet d'entretien constructeur | https://www.service-public.fr/particuliers/vosdroits/F2168",
      faq: faq.map(f => `${f.question} | ${f.answer}`).join('\n'),
    },
  };
  let article = await findOrCreate('posts', 'slug=vidange-guide', articlePayload);
  // Article déjà existant : on le remet à jour (contenu/ACF) pour que le
  // script reste utile après la première création, pas seulement à la création.
  article = await wp.request(`/posts/${article.id}`, { method: 'POST', body: articlePayload });
  console.log('Article', article.id, article.slug, article.status);

  console.log('\nSeed terminé. Vérifier :');
  console.log('  http://thermotowel.local/wp-json/wp/v2/posts?slug=vidange-guide&_embed=1');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    env[key] = valueParts.join('=');
  }
});

const WP_URL = env.WP_URL;
const WP_USER = env.WP_USER;
const WP_APP_PASSWORD = env.WP_APP_PASSWORD;

const ARTICLE_SLUGS = [
  'changement-adresse-carte-grise',
  'carte-carburant-particulier-cashback',
  'cession-vehicule-pour-destruction',
  'controle-technique-moto-2026',
  'plaque-ww-provisoire-duree',
  'ct-vehicule-electrique-specificites',
  'contre-visite-delai-defauts',
  'franchise-location-voiture-racheter',
  'taxe-co2-vehicule-occasion',
  'rectifier-erreur-carte-grise',
  'blablacar-daily-avis',
  'etancheite-camping-car-controle',
  'limitation-vitesse-camping-car'
];

async function request(path, options = {}) {
  const url = `${WP_URL}/wp-json/wp/v2${path}`;
  const auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  
  if (!res.ok) {
    throw new Error(`${res.status}`);
  }
  return res.json();
}

(async () => {
  for (const slug of ARTICLE_SLUGS) {
    try {
      const posts = await request(`/posts?slug=${slug}&_fields=id,slug,title,content,acf&per_page=1`);
      if (posts.length > 0) {
        const post = posts[0];
        console.log(`✓ ${slug}: ID ${post.id}`);
      } else {
        console.log(`✗ ${slug}: NOT FOUND`);
      }
    } catch (err) {
      console.log(`✗ ${slug}: ERROR`);
    }
  }
})();

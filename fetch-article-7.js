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
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return res.json();
}

(async () => {
  try {
    // Try exact slug match
    const posts = await request('/posts?slug=code-de-cession-obtenir&_fields=id,slug,title,content,acf&per_page=1');
    if (posts.length > 0) {
      const post = posts[0];
      console.log(JSON.stringify(post, null, 2));
    } else {
      console.log('Article not found');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();

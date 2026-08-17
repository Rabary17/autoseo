# Intégration newsletter → Zoho Campaigns

Synchronise chaque inscription au formulaire newsletter (stockée dans le CPT
`monauto_lead`, voir [docs/architecture-headless.md](architecture-headless.md)
section 8) vers une liste de diffusion Zoho Campaigns. Implémenté dans
[wordpress/mu-plugins/monauto-headless.php](../wordpress/mu-plugins/monauto-headless.php)
section 6 — **code générique, partagé par tous les sites**, seules 5
constantes changent d'un site à l'autre.

## 1. Ce qui est déjà fait (code)

- À chaque inscription newsletter réussie, une tâche différée (`wp_schedule_single_event`)
  pousse l'email vers Zoho Campaigns sans jamais ralentir la réponse au formulaire.
- En cas d'échec (Zoho indisponible, etc.), un cron horaire (`monauto_zoho_retry_sync`)
  réessaie automatiquement (20 emails max par passage).
- Si les constantes Zoho ci-dessous ne sont pas définies, tout reste
  silencieusement inactif — le site continue de fonctionner comme avant
  (email stocké localement, visible via `GET /wp-json/monauto/v1/newsletter`).
- Le flag `zoho_synced` (true/false) est renvoyé par ce même endpoint GET
  pour vérifier que la synchronisation a bien eu lieu.

## 2. Ce qu'il reste à faire côté Zoho (une seule fois, réutilisable pour tous les sites)

### 2.1 Créer l'app OAuth ("Self Client")

1. Aller sur https://api-console.zoho.com (connecté avec le compte Zoho qui a Zoho Campaigns).
2. **Add Client** → **Self Client**.
3. Noter le **Client ID** et le **Client Secret** générés — réutilisables pour tous les sites du réseau, pas besoin d'en recréer un par site.
4. Repérer le domaine du compte (visible dans l'URL une fois connecté à Zoho Campaigns) : `.com` (US/global), `.eu`, `.in`, `.com.cn`, `.jp`. C'est la valeur de `ZOHO_DC`.

### 2.2 Créer une liste de diffusion par site

1. Dans Zoho Campaigns → **Contacts** → **Mailing Lists** → créer une liste (ex. "Techcars – Newsletter").
2. Récupérer sa **List Key** (Zoho Campaigns → la liste → Settings, ou via l'API `GET /api/v1.1/getmailinglists`). C'est la valeur de `ZOHO_CAMPAIGNS_LIST_KEY`, propre à ce site.

### 2.3 Générer le refresh token (une fois par app, pas par site)

Dans api-console.zoho.com → l'app Self Client créée en 2.1 → onglet **Generate Code** :
- Scope : `ZohoCampaigns.contact.ALL` (constaté en pratique le 2026-08-17 : le
  scope `contact.CREATE,contact.READ` suffit pour lire les listes mais
  renvoie 401 sur l'ajout réel d'un contact — `contact.ALL` est nécessaire)
- Duration : 10 minutes (max) — le code doit être échangé rapidement
- Cliquer **Create**, copier le code généré.

Puis, **dans les 10 minutes**, échanger ce code contre un refresh token (ce refresh token, lui, n'expire pas sauf révocation) :

```bash
curl -X POST "https://accounts.zoho.<DC>/oauth/v2/token" \
  -d "code=<CODE_GENERE>" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "grant_type=authorization_code"
```

(remplacer `<DC>` par `com`/`eu`/`in`/... selon 2.1). La réponse JSON contient
`refresh_token` — c'est la valeur de `ZOHO_REFRESH_TOKEN`.

**À faire par l'utilisateur, jamais par un agent** (accès à un compte Zoho tiers) — voir la règle de sécurité du projet sur les identifiants/clés API.

### 2.4 Renseigner les constantes dans `wp-config.php` (par site)

```php
define('ZOHO_CLIENT_ID', '...');
define('ZOHO_CLIENT_SECRET', '...');
define('ZOHO_REFRESH_TOKEN', '...');
define('ZOHO_DC', 'com'); // ou eu/in/com.cn/jp selon le compte
define('ZOHO_CAMPAIGNS_LIST_KEY', '...'); // propre à ce site
```

Jamais commité dans le dépôt (même règle que `REVALIDATE_SECRET`/`SMTP_PASS`,
voir [docs/architecture-headless.md](architecture-headless.md) section 2.1).

## 3. Industrialisation (nouveaux sites)

Pour chaque nouveau site basé sur `monauto-headless.php` :
- **Client ID / Client Secret / DC** : identiques à techcars.fr, à copier tels quels (une seule app Zoho pour tout le réseau).
- **Refresh token** : idem, réutilisable tel quel (le token est lié à l'app, pas à un site) — donc à copier lui aussi, PAS à régénérer.
- **List Key** : seule valeur vraiment nouvelle par site — créer une nouvelle liste Zoho Campaigns (étape 2.2) et mettre sa clé dans le `wp-config.php` du nouveau site.

Donc en régime de croisière, brancher un nouveau site prend 2 minutes : créer
une liste Zoho Campaigns + copier 5 lignes de constantes (dont 4 identiques
partout).

## 4. Vérification après mise en place

```bash
curl -u "<user_admin>:<application_password>" \
  "https://<site-wordpress>/wp-json/monauto/v1/newsletter"
```

Chaque entrée doit afficher `"zoho_synced": true` après quelques minutes
(délai du cron de retry si la synchronisation immédiate a échoué). Vérifier
aussi côté Zoho Campaigns que le contact apparaît bien dans la liste.

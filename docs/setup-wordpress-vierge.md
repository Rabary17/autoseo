# Checklist — mise en place d'un WordPress vierge pour monauto

Contexte : `mntdev.passion4humanity.com` a un problème documenté et reproduit
sur un endpoint core WordPress — `current_user_can()` ne fonctionne pas
correctement pour un utilisateur authentifié via Application Password sur cet
hébergement précis (voir commentaire dans `wordpress/mu-plugins/monauto-headless.php`,
section 5). Toute écriture REST authentifiée (catégories, articles, media)
échoue en 401/403 même avec des identifiants corrects. Aucun contenu réel
n'ayant encore été publié, repartir d'un WordPress vierge — **idéalement sur
un hébergement différent** — est la voie la plus sûre plutôt que de continuer
à contourner ce problème sur l'hébergement actuel.

## 0. Avant tout : valider l'hébergement lui-même

Avant d'installer quoi que ce soit, vérifier que le nouvel hébergement supporte
correctement les Application Passwords :

1. Installer WordPress, créer un compte admin.
2. Créer une Application Password (Utilisateurs > Profil > Application Passwords).
3. Tester IMMÉDIATEMENT une écriture authentifiée, par exemple créer une catégorie via `curl` ou un script Node — **avant d'installer un seul plugin ou d'importer du contenu**. Si ça échoue en 401/403 alors que les identifiants sont corrects et le site en HTTPS, changer d'hébergeur plutôt que d'insister.

Ce test prend 2 minutes et évite de refaire tout le travail ci-dessous sur un
hébergement qui a le même problème.

## 1. Hébergement — pré-requis non négociables

- **HTTPS actif dès le premier jour** — WordPress désactive les Application Passwords sur HTTP (sauf localhost). Vérifié en HTTPS: `https://<domaine>` doit répondre 200 sans erreur de certificat.
- Pas de pare-feu/WAF qui bloque les requêtes sans User-Agent de navigateur (rencontré sur l'hébergement actuel) — à tester avec `curl -A "Mozilla/5.0" https://<domaine>/wp-json/`.
- PHP 8.1+ recommandé (cohérent avec ACF/Imagify récents).

## 2. Installation WordPress de base

- Version WordPress à jour.
- Permaliens : "Nom de l'article" (`/%postname%/`) — **indispensable**, sinon l'API REST (`?rest_route=`) et le mu-plugin de revalidation échouent silencieusement sur certaines routes.
- Créer le compte administrateur, générer une Application Password, refaire le test de l'étape 0.

## 3. Plugins requis

| Plugin | Rôle | Config |
|---|---|---|
| **ACF** (gratuit, pas PRO) | Champs `tldr`/`sources`/`faq` (article) et `job_title`/`same_as` (auteur) | Déjà déclarés en code dans le mu-plugin (`acf_add_local_field_group`) — rien à créer manuellement dans l'UI ACF |
| **Imagify** | Compression + conversion WebP à l'upload | Clé API déjà en main (utilisateur) — la renseigner dans Réglages > Imagify. Le reste des réglages (niveau agressif, redimensionnement 1600px, WebP) est déjà automatisé par le mu-plugin |

## 4. Mu-plugin — `wordpress/mu-plugins/monauto-headless.php`

Copier ce fichier (désormais versionné dans le repo) vers `wp-content/mu-plugins/`
sur le nouvel hébergement. Il gère : tailles d'image custom, config Imagify,
champs ACF, exposition REST, sécurisation (XML-RPC/RSS/comments off, noindex),
revalidation Next.js (ISR), endpoint newsletter.

Après dépôt, remplir dans wp-admin → **Réglages > Revalidation Next.js** :
- URL du site Next.js (`https://monauto-tau.vercel.app` ou le domaine définitif)
- Secret partagé (doit être identique à `REVALIDATE_SECRET` sur Vercel)

## 5. Comptes auteur (6 personas)

Une fois `WP_URL`/`WP_USER`/`WP_APP_PASSWORD` mis à jour (voir étape 7), lancer :

```
node scripts/autopublish/create-missing-authors.js
```

Crée les 5 comptes manquants (B à F) — le compte A (`julien-fabre`) doit être recréé aussi puisqu'on repart d'un site vierge (le script est idempotent, sans risque à relancer).

## 6. Contenu de test (optionnel mais recommandé)

`node scripts/seed-monauto-test-content.js` — recrée 1 catégorie, 1 tag, 1 auteur, 1 page, 1 article complet pour valider visuellement le rendu avant de lancer le pipeline réel. Nécessite d'adapter ce script au nouveau `WP_URL` (actuellement câblé sur `/wp-json/wp/v2`, pas `?rest_route=` — voir remarque dans `scripts/wp-client.js`).

## 7. Mettre à jour les secrets/variables d'environnement

- **GitHub Actions** (Settings > Secrets and variables > Actions) : `WP_URL`, `WP_USER`, `WP_APP_PASSWORD` avec les nouvelles valeurs.
- **Vercel** (frontend/monauto) : variable `WP_URL` (ou `WP_API_URL`) pointant vers le nouveau domaine WordPress.
- **`.env` local** : mettre à jour si des tests manuels sont faits depuis ce poste (ne jamais committer ce fichier).

## 8. Validation finale

1. Relancer le workflow GitHub Actions **"Test end-to-end monauto"** (`workflow_dispatch`) — doit désormais réussir de bout en bout (catégorie, tag, article, image, e-mail de rapport).
2. Vérifier dans wp-admin que l'article de test `[TEST] ...` est bien créé, avec la bonne catégorie/tag/image.
3. Supprimer l'article de test.
4. Repasser en revue [STATE.md](../STATE.md) et la Phase 0 (`data/autopublish-state.json`) avant de lancer un run réel.

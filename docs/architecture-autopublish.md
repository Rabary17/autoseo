# Architecture — pipeline de publication automatisée (`scripts/autopublish/`)

Documentation du système construit le 2026-07-14 et durci le 2026-07-15, sur
demande explicite de l'utilisateur : atteindre 10 000 articles sans attendre
des mois, en s'appuyant sur l'**API Mistral directe** (pas de session Claude
Code interactive), avec un **rythme hebdomadaire automatique** piloté par
GitHub Actions. **Migré de l'API Anthropic vers l'API Mistral le 2026-07-27**
(demande explicite de l'utilisateur, voir STATE.md) — la logique décrite
ci-dessous est inchangée, seul le fournisseur du modèle change. Complète
[skills/wordpress-publication.md](../skills/wordpress-publication.md)
(politique de gating et de calendrier, déjà spécifiée) — ce document décrit
**comment cette politique est exécutée par du code**, sans la réinventer.

Plan d'origine complet (contexte, décisions validées) :
`C:\Users\Rabary\.claude\plans\indexed-hugging-flurry.md`.

## 1. Vue d'ensemble

```
GitHub Actions (cron hebdo, lundi 6h)
  └─ scripts/autopublish/run.js
       ├─ lit data/autopublish-state.json (phase courante, silo en cours, budget)
       ├─ construit la file candidate (hubs/sous-hubs en Phase 0, articles en Phase 2)
       ├─ pour chaque pièce : génère (Mistral) → relit voix/faits (Mistral) → relit lisibilité (Mistral) → gating (code) → écrit dans WordPress
       └─ écrit logs/autopublish/<date>.md + met à jour STATE.md + commit (bot)
```

Aucune boucle agentique, aucun outil : **trois appels chat completions par
pièce** (génération, relecture voix/faits/maillage, relecture lisibilité —
ajoutée le 2026-07-28), jamais plus — voir section 4.

## 2. Fichiers

```
scripts/autopublish/
  run.js                  # orchestrateur, point d'entrée unique
  config.js                # budgets, mapping modèle/type, ordre des silos, destinataire du rapport
  daily-report.js           # rapport quotidien (aucun appel Mistral — lecture WP seule)
  test-e2e.js                # test isolé de bout en bout (1 article [TEST], ne touche jamais l'état réel)
  create-missing-authors.js   # crée les comptes WP manquants (personas B à F)
  lib/
    state.js                 # lit/écrit data/autopublish-state.json
    tracking-xlsx.js          # lit/écrit data/keywords/tracking-mots-cles.xlsx
    maillage.js                # lookup mot-clé/URL → hub/sous-hub/liens/ancres (maillage.json)
    factuel.js                  # charge data/factuel/*.json, exclut a_verifier:true
    persona.js                   # silo → auteur → chemin du skill dédié (skills/redaction/<auteur>.md)
    prompt-builder.js             # construit system (skill complet) + user (cluster/maillage/faits)
    mistral-client.js               # appel Chat Completions API, structured output, détecte finish_reason=length
    review.js                        # 2e + 3e appels — relecture voix/faits/maillage puis lisibilité, justifications loguées
    gating.js                         # vérifie les 9 règles de skills/wordpress-publication.md section 5
    similarity.js                      # TF-IDF + cosinus pur JS (data/similarity-index/)
    scheduler.js                        # calcule post_date selon la phase (voir section 6 du skill)
    images.js                            # cascade Pexels → Unsplash → Pixabay + ledger de déduplication
    wp-client.js                          # écriture WP via ?rest_route= (le /wp-json/ direct est bloqué
                                            # par le pare-feu de l'hébergement WP actuel)
```

## 3. Logique du run (`run.js`)

1. Charge l'état. **Si `phase === 1` (pause indexation) → s'arrête immédiatement**, ne génère/publie rien — la transition de phase reste une décision humaine (`/p6-indexation`), jamais automatique.
2. Construit la file candidate :
   - **Phase 0** : hubs/sous-hubs manquants (déduits de `maillage.json`, vérifiés absents côté WP via `wpPageExistsSafe`), jusqu'à 10/jour.
   - **Phase 2** : lignes `à faire` du silo en cours (`tracking-mots-cles.xlsx`), groupées par sous-cocon (le plus petit nombre d'articles en premier, voir `pickArticleQueueForSilo` — décision du 2026-07-28), interleavées par quota d'intention à l'intérieur de chaque sous-cocon, jusqu'au budget hebdomadaire courant (70/semaine = 10/jour, voir `config.js`).
3. Pour chaque candidat, **dans un bloc `try/catch` isolé** (une pièce en échec ne casse jamais le run — voir section 5) :
   a. `persona.js` résout l'auteur assigné et charge son skill dédié **complet**.
   b. `prompt-builder.js` construit system (skill + contraintes universelles) + user (cluster + maillage + faits factuels ciblés).
   c. `mistral-client.js` appelle Mistral une première fois (génération), structured output (schéma JSON forcé).
   d. `review.js` — relecture voix/faits/maillage obligatoire (2e appel), puis relecture lisibilité obligatoire (3e appel), voir section 4.
   e. `gating.js` vérifie les 9 règles (section 5 du skill wordpress-publication) sur le contenu (éventuellement corrigé).
   f. Échec de gating → statut `draft`, motif noté, `tracking-mots-cles.xlsx` reste `en rédaction`.
   g. Succès → `scheduler.js` calcule `post_date`, `images.js` cherche une image (ou repli sur image par défaut du silo), insertion WP en `future`, xlsx → `programmé`.
4. `report.js` écrit `logs/autopublish/<date>.md` (traités/pass/fail/motifs/coût réel via `response.usage`) et un bloc dédié dans `STATE.md`.

**`--dry-run` totalement indépendant de WordPress (2026-07-15)** : `resolveAuthorId`/`resolveCategoryId`/`resolveTagIds` court-circuitent désormais aussi en dry-run (comme `resolveFeaturedMedia` déjà avant) — plus aucun appel WP, lecture ou écriture, pendant un dry-run. Avant ce correctif, la résolution des catégories (`wp.findOrCreateTerm`) s'exécutait quand même et tentait une **création** réelle si la catégorie n'existait pas encore, ce qui aurait échoué sur l'hébergement WP actuellement bloqué (voir section 8) même en mode dry-run. Un dry-run valide donc maintenant génération + relecture + gating + planification en isolation complète — utile pour continuer à tester le pipeline pendant que le blocage WordPress est résolu séparément.

## 4. Génération + 2 relectures obligatoires (3 appels, jamais plus)

Après toute génération, un **second appel Chat Completions dédié** (`review.js`, fonction `reviewContent`) reçoit l'enveloppe générée, le skill complet de l'auteur, et les contraintes de gating pertinentes. Il doit :
1. Vérifier la conformité (voix de l'auteur, structure, règles factuelles/maillage).
2. Écrire une justification dans `logs/autopublish/<date>/<slug>-review-voix-faits.md` (jamais juste "OK").
3. Renvoyer l'enveloppe inchangée (`content: null`) ou corrigée (même schéma) — jamais de correction silencieuse.

Un **troisième appel dédié** (`review.js`, fonction `reviewReadability`, ajoutée le 2026-07-28 sur demande explicite de l'utilisateur) reçoit le résultat de la 2e passe et vérifie **uniquement** la lisibilité mécanique — voir `prompts/lisibilite.md` :
- Longueur de phrase (< 20 mots pour ≥ 75 % des phrases).
- Taille de paragraphe (≤ 150 mots) et de section entre deux H2/H3 (≤ 300 mots, ajoute des sous-titres si besoin).
- Connecteurs logiques (« cependant », « ainsi », « par conséquent »...) dans ≥ 30 % des phrases.

Ne touche jamais à la voix, aux faits ou au maillage (déjà validés par la 2e passe) — justification loguée dans `<slug>-review-lisibilite.md`.

Reste **structuré et unique par passe** (pas de boucle itérative) : génération + 1 relecture voix/faits + 1 relecture lisibilité par pièce, jamais plus. Un échec de gating renvoie en `draft`/`a_valider` pour reprise ou validation manuelle, pas de re-boucle dans le même run.

## 5. Répartition modèle & économie de tokens

| Type de contenu | Génération | Relecture (voix/faits + lisibilité) | Raison |
|---|---|---|---|
| hub / sous-hub | `mistral-large-latest` | `mistral-large-latest` | structuration de liens complexe, faible volume |
| article | `mistral-small-latest` | `mistral-medium-latest` | gros volume, contenu templaté — relecture allégée le 2026-07-27 (voir `config.js`) |

Les deux relectures d'une même pièce utilisent le même modèle (`config.REVIEW_MODEL_BY_CONTENT_TYPE`). Le skill complet de l'auteur est renvoyé identique en génération ET dans les deux relectures (pas de mécanisme de cache manuel côté appelant, voir `mistral-client.js` — `prompt_cache_key` ajouté le 2026-07-27 pour bénéficier du cache serveur Mistral sur ce préfixe répété).

## 6. Durcissement / isolation d'erreur (2026-07-15)

Principe : **un item qui échoue ne doit jamais faire planter tout le run**, et le rapport/l'état doivent **toujours** être écrits, même en cas d'échec fatal.

- Chaque bloc par pièce (génération/relecture/gating/insertion, pour hub/sous-hub/article) est encadré d'un `try/catch` qui note `status: 'erreur'` avec le message, puis continue la boucle.
- `main()` capture toute exception non prévue (`fatalError`), écrit quand même l'état et le rapport (dans des `try/catch` séparés), puis `process.exit(1)` seulement à la toute fin — jamais de sortie silencieuse sans trace.
- Retry réseau (`wp-client.js`) limité aux vraies erreurs réseau et aux codes HTTP 429/5xx — plus de retry sur 4xx (qui échoue de façon déterministe, retenter ne sert à rien).
- Caches en mémoire (auteurs/catégories/tags/utilisateurs WP) pour réduire les appels redondants dans un même run.
- Tolérance aux fichiers JSON corrompus : `similarity.js` et `images.js` (ledger) avertissent et repartent de zéro plutôt que de planter.
- `mistral-client.js` détecte explicitement une réponse tronquée (`finish_reason === 'length'`) avant de tomber dans le chemin générique "JSON invalide" — message d'erreur exploitable.
- `test-e2e.js` écrit son log (`logs/autopublish/test-e2e-latest.md`) **même si le test échoue en cours de route** (avant ce correctif, un échec à l'étape 5/6 ne laissait aucune trace du point d'arrêt).
- Workflows GitHub Actions (`autopublish.yml`, `test-e2e.yml`) : `git fetch origin main && git rebase origin/main` avant chaque `git push` du commit bot, pour éviter un rejet non-fast-forward si `main` a avancé entre le checkout et le commit (poussé depuis une autre session/poste).

## 7. Workflows GitHub Actions

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `.github/workflows/autopublish.yml` | `cron: '0 6 * * 1'` (lundi 6h) + `workflow_dispatch` (option `dry_run`) | Run hebdomadaire réel — programme toute la semaine à venir (WordPress publie seul chaque jour via `post_status=future`) |
| `.github/workflows/daily-report.yml` | `cron: '0 6 * * *'` (quotidien) | `daily-report.js` (aucun appel Mistral, lecture WP seule) → e-mail HTML : publié aujourd'hui, prévu demain, aperçu des jours suivants |
| `.github/workflows/test-e2e.yml` | `workflow_dispatch` uniquement | Test isolé de bout en bout (génération → relecture → image → écriture WP → rapport → e-mail) sur **un seul article `[TEST]`**, ne touche jamais `autopublish-state.json` ni `tracking-mots-cles.xlsx` réels |
| `.github/workflows/ci.yml` | push vers `main` + PR | Build Next.js + `node --check` sur tous les scripts (garde-fou, ne bloque pas les push directs — voir [docs/commandes.md](commandes.md)) |

Secrets requis (GitHub → Settings → Secrets and variables → Actions) : `MISTRAL_API_KEY`, `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `RI_PEXELS_KEY`, `RI_UNSPLASH_KEY`, `RI_PIXABAY_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`.

## 8. État actuel — bloquant (2026-07-15)

Le pipeline est **écrit et durci, mais aucun run réel n'a pu être validé** : toute écriture REST authentifiée sur `mntdev.passion4humanity.com` échoue en 401/403. Cause racine identifiée : `current_user_can('manage_options')` renvoie faux pour l'administrateur authentifié via Application Password sur cet hébergement précis, reproduit même sur un endpoint WordPress core — une restriction de l'environnement, pas un bug du pipeline. Voir [STATE.md](../STATE.md) (entrée du 2026-07-15) et [docs/setup-wordpress-vierge.md](setup-wordpress-vierge.md) pour la checklist de reprise sur un nouvel hébergement.

**Tant que ce blocage n'est pas levé** : `/p6-indexation`, la Phase 1→2 et tout run réel (`workflow_dispatch` sans `dry_run`) restent inutilisables en pratique — seul `--dry-run` peut s'exécuter sans écrire dans WP.

## 9. Secrets — ce qu'un agent ne fait jamais

Conformément à la politique de sécurité du projet, aucun agent ne crée de compte, ne renseigne de secret dans GitHub/Vercel/wp-admin, ni ne manipule de mot de passe. L'utilisateur configure lui-même les secrets listés section 7 ; l'agent peut lire/écrire le code qui les **consomme** (`process.env.X`), jamais leur valeur.

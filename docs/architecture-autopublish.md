# Architecture — pipeline de publication automatisée (`scripts/autopublish/`)

Documentation du système construit le 2026-07-14 et durci le 2026-07-15, sur
demande explicite de l'utilisateur : atteindre 10 000 articles sans attendre
des mois, en s'appuyant sur l'**API Anthropic directe** (pas de session Claude
Code interactive), avec un **rythme hebdomadaire automatique** piloté par
GitHub Actions. Complète [skills/wordpress-publication.md](../skills/wordpress-publication.md)
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
       ├─ pour chaque pièce : génère (Claude) → relit (Claude) → gating (code) → écrit dans WordPress
       └─ écrit logs/autopublish/<date>.md + met à jour STATE.md + commit (bot)
```

Aucune boucle agentique, aucun outil : **deux appels `messages.create` par
pièce** (génération, puis relecture obligatoire), jamais plus — voir section 4.

## 2. Fichiers

```
scripts/autopublish/
  run.js                  # orchestrateur, point d'entrée unique
  config.js                # budgets, mapping modèle/type, ordre des silos, destinataire du rapport
  daily-report.js           # rapport quotidien (aucun appel Claude — lecture WP seule)
  test-e2e.js                # test isolé de bout en bout (1 article [TEST], ne touche jamais l'état réel)
  create-missing-authors.js   # crée les comptes WP manquants (personas B à F)
  lib/
    state.js                 # lit/écrit data/autopublish-state.json
    tracking-xlsx.js          # lit/écrit data/keywords/tracking-mots-cles.xlsx
    maillage.js                # lookup mot-clé/URL → hub/sous-hub/liens/ancres (maillage.json)
    factuel.js                  # charge data/factuel/*.json, exclut a_verifier:true
    persona.js                   # silo → auteur → chemin du skill dédié (skills/redaction/<auteur>.md)
    prompt-builder.js             # construit system (skill complet) + user (cluster/maillage/faits)
    claude-client.js                # appel Messages API, structured output, détecte stop_reason=max_tokens
    review.js                        # 2e appel — relecture/auto-correction + justification loguée
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
   - **Phase 2** : lignes `à faire` du silo en cours (`tracking-mots-cles.xlsx`), triées volume décroissant + quota d'intention étalé, jusqu'au budget hebdomadaire courant (20/semaine au démarrage, voir `config.js`).
3. Pour chaque candidat, **dans un bloc `try/catch` isolé** (une pièce en échec ne casse jamais le run — voir section 5) :
   a. `persona.js` résout l'auteur assigné et charge son skill dédié **complet**.
   b. `prompt-builder.js` construit system (skill + contraintes universelles, `cache_control: "ephemeral"`) + user (cluster + maillage + faits factuels ciblés).
   c. `claude-client.js` appelle Claude une première fois (génération), structured output (schéma JSON forcé).
   d. `review.js` — relecture obligatoire (2e appel), voir section 4.
   e. `gating.js` vérifie les 9 règles (section 5 du skill wordpress-publication) sur le contenu (éventuellement corrigé).
   f. Échec de gating → statut `draft`, motif noté, `tracking-mots-cles.xlsx` reste `en rédaction`.
   g. Succès → `scheduler.js` calcule `post_date`, `images.js` cherche une image (ou repli sur image par défaut du silo), insertion WP en `future`, xlsx → `programmé`.
4. `report.js` écrit `logs/autopublish/<date>.md` (traités/pass/fail/motifs/coût réel via `response.usage`) et un bloc dédié dans `STATE.md`.

## 4. Génération + relecture obligatoire (2 appels, jamais plus)

Après toute génération, un **second appel Messages API dédié** (`review.js`) reçoit l'enveloppe générée, le skill complet de l'auteur, et les contraintes de gating pertinentes. Il doit :
1. Vérifier la conformité (voix de l'auteur, structure, règles factuelles/maillage).
2. Écrire une justification dans `logs/autopublish/<date>/<slug>-review.md` (jamais juste "OK").
3. Renvoyer l'enveloppe inchangée ou corrigée (même schéma) — jamais de correction silencieuse.

Reste **structuré et unique** (pas de boucle itérative) : génération + 1 relecture par pièce, jamais plus. Un échec de gating renvoie en `draft` pour reprise au run **suivant**, pas de re-boucle dans le même run.

## 5. Répartition modèle & économie de tokens

| Type de contenu | Modèle | Raison |
|---|---|---|
| hub / sous-hub | `claude-sonnet-5`, thinking adaptatif, effort `high` | structuration de liens complexe |
| article | `claude-haiku-4-5`, pas de thinking | gros volume, contenu templaté — Haiku n'accepte pas `thinking`/`effort` (erreur 400 si envoyés) |
| relecture (tous types) | `claude-sonnet-5`, thinking adaptatif, effort `medium` | jugement qualité, quel que soit le type relu |

Prompt caching sur le skill complet de l'auteur (`cache_control: "ephemeral"`) — réutilisé entre génération ET relecture, et entre pièces du même auteur dans un même run.

## 6. Durcissement / isolation d'erreur (2026-07-15)

Principe : **un item qui échoue ne doit jamais faire planter tout le run**, et le rapport/l'état doivent **toujours** être écrits, même en cas d'échec fatal.

- Chaque bloc par pièce (génération/relecture/gating/insertion, pour hub/sous-hub/article) est encadré d'un `try/catch` qui note `status: 'erreur'` avec le message, puis continue la boucle.
- `main()` capture toute exception non prévue (`fatalError`), écrit quand même l'état et le rapport (dans des `try/catch` séparés), puis `process.exit(1)` seulement à la toute fin — jamais de sortie silencieuse sans trace.
- Retry réseau (`wp-client.js`) limité aux vraies erreurs réseau et aux codes HTTP 429/5xx — plus de retry sur 4xx (qui échoue de façon déterministe, retenter ne sert à rien).
- Caches en mémoire (auteurs/catégories/tags/utilisateurs WP) pour réduire les appels redondants dans un même run.
- Tolérance aux fichiers JSON corrompus : `similarity.js` et `images.js` (ledger) avertissent et repartent de zéro plutôt que de planter.
- `claude-client.js` détecte explicitement une réponse tronquée (`stop_reason === 'max_tokens'`) avant de tomber dans le chemin générique "JSON invalide" — message d'erreur exploitable.
- `test-e2e.js` écrit son log (`logs/autopublish/test-e2e-latest.md`) **même si le test échoue en cours de route** (avant ce correctif, un échec à l'étape 5/6 ne laissait aucune trace du point d'arrêt).
- Workflows GitHub Actions (`autopublish.yml`, `test-e2e.yml`) : `git fetch origin main && git rebase origin/main` avant chaque `git push` du commit bot, pour éviter un rejet non-fast-forward si `main` a avancé entre le checkout et le commit (poussé depuis une autre session/poste).

## 7. Workflows GitHub Actions

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `.github/workflows/autopublish.yml` | `cron: '0 6 * * 1'` (lundi 6h) + `workflow_dispatch` (option `dry_run`) | Run hebdomadaire réel — programme toute la semaine à venir (WordPress publie seul chaque jour via `post_status=future`) |
| `.github/workflows/daily-report.yml` | `cron: '0 6 * * *'` (quotidien) | `daily-report.js` (aucun appel Claude, lecture WP seule) → e-mail HTML : publié aujourd'hui, prévu demain, aperçu des jours suivants |
| `.github/workflows/test-e2e.yml` | `workflow_dispatch` uniquement | Test isolé de bout en bout (génération → relecture → image → écriture WP → rapport → e-mail) sur **un seul article `[TEST]`**, ne touche jamais `autopublish-state.json` ni `tracking-mots-cles.xlsx` réels |
| `.github/workflows/ci.yml` | push vers `main` + PR | Build Next.js + `node --check` sur tous les scripts (garde-fou, ne bloque pas les push directs — voir [docs/commandes.md](commandes.md)) |

Secrets requis (GitHub → Settings → Secrets and variables → Actions) : `ANTHROPIC_API_KEY`, `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`, `RI_PEXELS_KEY`, `RI_UNSPLASH_KEY`, `RI_PIXABAY_KEY`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`.

## 8. État actuel — bloquant (2026-07-15)

Le pipeline est **écrit et durci, mais aucun run réel n'a pu être validé** : toute écriture REST authentifiée sur `mntdev.passion4humanity.com` échoue en 401/403. Cause racine identifiée : `current_user_can('manage_options')` renvoie faux pour l'administrateur authentifié via Application Password sur cet hébergement précis, reproduit même sur un endpoint WordPress core — une restriction de l'environnement, pas un bug du pipeline. Voir [STATE.md](../STATE.md) (entrée du 2026-07-15) et [docs/setup-wordpress-vierge.md](setup-wordpress-vierge.md) pour la checklist de reprise sur un nouvel hébergement.

**Tant que ce blocage n'est pas levé** : `/p6-indexation`, la Phase 1→2 et tout run réel (`workflow_dispatch` sans `dry_run`) restent inutilisables en pratique — seul `--dry-run` peut s'exécuter sans écrire dans WP.

## 9. Secrets — ce qu'un agent ne fait jamais

Conformément à la politique de sécurité du projet, aucun agent ne crée de compte, ne renseigne de secret dans GitHub/Vercel/wp-admin, ni ne manipule de mot de passe. L'utilisateur configure lui-même les secrets listés section 7 ; l'agent peut lire/écrire le code qui les **consomme** (`process.env.X`), jamais leur valeur.

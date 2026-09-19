---
description: Agent Développeur — publier l'article validé dans WordPress (catégorie Tests + sous-cocon) (usage $ARGUMENTS = "<slug>")
---

Slug demandé : $ARGUMENTS

Prérequis : `/agent-critique` a rendu un verdict **Validé** pour ce slug. Sinon, arrête-toi et
signale-le.

Étapes :
1. Vérifie que les catégories WordPress "Tests" (parente) et le sous-cocon concerné existent
   (créées via `node scripts/create-wp-category.js --niche=auto-mobilite --silo="Tests" --apply`
   si ce n'est pas déjà fait — voir [STATE.md](../../STATE.md) pour le statut).
2. Upload les captures du Testeur comme médias (`POST /wp/v2/media`), avec alt text descriptif.
3. Insère l'article via WP REST API en **`post_status = draft`** — jamais publié ni programmé
   directement, conformément au contrôle humain systématique de la phase 1
   ([skills/agents-ia.md](../../skills/agents-ia.md) section 5).
4. Assigne catégorie primaire (sous-cocon), tags (entités : marque/modèle/enseigne concernés),
   image à la une, auteur (B par défaut) — [skills/wordpress-publication.md](../../skills/wordpress-publication.md).
5. Marque le sujet `en rédaction` (pas `publié`) dans `tracking-mots-cles.xlsx`.
6. Signale à l'utilisateur que le brouillon est prêt pour relecture manuelle avant toute publication
   ou programmation réelle — ne jamais enchaîner automatiquement sur une programmation.

Ne jamais passer `post_status` à `publish` ou `future` depuis cette commande.

---
description: P4 — Rédiger les hubs/sous-hubs d'un silo (usage $ARGUMENTS = nom du silo)
---

Silo demandé : $ARGUMENTS

Prérequis : P3 (maillage) terminé pour ce silo dans `data/maillage/maillage.json`. Sinon, arrête-toi et signale-le.

Étapes :
1. Rédige le hub du silo (2 500–4 000 mots) : cible le mot-clé de tête du silo, liste éditorialisée de tous ses sous-hubs (pas un simple listing de liens), voir [skills/seo.md](../../skills/seo.md).
2. Rédige chaque sous-hub du silo (1 500–2 500 mots) : cible le mot-clé de tête du sous-cocon, liste éditorialisée de tous ses articles enfants (même s'ils ne sont pas encore rédigés — prévoir les liens).
3. Rédige en blocs **Gutenberg** valides, catégorie = le silo (hub) ou le sous-cocon (sous-hub), image à la une, auteur = persona du silo (voir [skills/wordpress-publication.md](../../skills/wordpress-publication.md) sections 1 à 4), dans la voix propre à cet auteur — [skills/redaction.md](../../skills/redaction.md).
4. Applique le schema.org requis (`Article`/`BlogPosting` + `BreadcrumbList`, `FAQPage` si pertinent) — voir [skills/geo.md](../../skills/geo.md).
5. Respecte la charte design : fonts système, sobre, mobile-first — voir [skills/design.md](../../skills/design.md).
6. Les hubs/sous-hubs passent en premier dans la file de publication (priorité absolue avant tout article enfant, voir [skills/wordpress-publication.md](../../skills/wordpress-publication.md) section 6) — insère-les en `draft`, c'est `/p5-schedule` qui les programmera en priorité.
7. Coche les sessions correspondantes dans la table P4 de la page d'actions et mets à jour [STATE.md](../../STATE.md).

Ne rédige pas les articles enfants dans cette commande — c'est le rôle de `/p5-articles`.

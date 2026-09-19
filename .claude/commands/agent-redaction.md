---
description: Agent Rédacteur — rédiger l'article strictement à partir du rapport du Testeur (usage $ARGUMENTS = "<slug>")
---

Slug demandé : $ARGUMENTS

Prérequis : `data/tests/rapports/<slug>.json` (Testeur) et `data/tests/briefs/<slug>.json`
(Journaliste) doivent exister. Sinon, arrête-toi et signale-le.

Étapes :
1. Charge le rapport et le brief. **Chaque affirmation factuelle de l'article doit être rattachable
   à un champ précis du rapport** (prix, tarif, observation) — jamais une donnée non présente dans
   le rapport, même plausible.
2. Rédige en respectant :
   - Structure et longueur adaptées au format comparatif/test (voir [skills/seo.md](../../skills/seo.md))
   - Réponse directe dès les premiers mots, structure question/réponse — [skills/geo.md](../../skills/geo.md)
   - Voix de l'auteur assigné (B — Thomas Lefèvre par défaut pour ce silo), sans tic d'écriture LLM
     — [skills/redaction.md](../../skills/redaction.md)
   - Mention explicite de la date du test et du caractère estimatif/non contractuel des chiffres
     si le sous-cocon est marqué YMYL (voir `ymyl_silos` dans `niche.json` — le silo Tests l'est).
   - Insertion des captures du Testeur comme preuves visuelles dans l'article (pas de générique) — **minimum 5 images réelles** (règle [skills/agents-ia.md](../../skills/agents-ia.md) section 4) ; si le rapport en fournit moins de 5, retourne au Testeur avant de rédiger plutôt que de publier un article sous le seuil.
3. Rédige en blocs **Gutenberg** valides, catégorie = "Tests" (parente) + sous-catégorie du
   sous-cocon, image à la une — [skills/wordpress-publication.md](../../skills/wordpress-publication.md).
4. Applique le schema.org approprié + BreadcrumbList — [skills/geo.md](../../skills/geo.md).
5. Sauvegarde le brouillon d'article (JSON ou Markdown intermédiaire) prêt pour la critique — ne
   publie rien à ce stade.

N'insère jamais l'article dans WordPress dans cette commande — c'est le rôle de `/agent-publier`,
après validation de `/agent-critique`.

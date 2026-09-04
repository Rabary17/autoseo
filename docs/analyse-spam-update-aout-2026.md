# Analyse — spam update Google du 18-21 août 2026 et techcars.fr

**Créé** : 2026-09-04, suite à la confirmation par l'utilisateur que la chute de trafic
documentée dans [STATE.md](../STATE.md) (entrée du 2026-08-26) était bien liée au spam
update, et non une hypothèse non tranchée comme noté à l'époque.

---

## 1. Ce que Google a réellement publié (pas une supposition)

- **Dates** : rollout mondial du 18 août (~9h27 Pacifique) au 21 août 2026, dans toutes les
  langues. Annoncé en une phrase sur le tableau de bord d'incidents, sans article de blog dédié.
- **Nature** : Google l'a qualifié explicitement de *"normal spam update"* — l'application des
  règles existantes ("spam policies"), **pas** de nouvelles règles.
- **Politiques concernées** : abus de contenu à grande échelle ("scaled content abuse"),
  cloaking, doorway pages, abus de domaines expirés, contenu piraté, redirections trompeuses,
  et texte généré principalement pour se classer plutôt que pour aider un lecteur.
- **Explicitement PAS concernées par cette vague précise** : le spam de liens et la politique
  "site reputation abuse" (parasite SEO) — celle-ci reste traitée à part, surtout via action
  manuelle.
- Depuis une clarification de mai 2026, les politiques anti-spam couvrent aussi les tentatives
  de manipuler les réponses génératives (AI Overviews / AI Mode) — même système de détection.

**Définition exacte de "scaled content abuse"** (celle qui nous concerne le plus) :
> "De nombreuses pages générées dans le but principal de manipuler le classement, sans aider
> les utilisateurs."

Exemples cités par Google : IA générative produisant de nombreuses pages sans valeur propre,
scraping avec transformation minimale (synonymisation, traduction), assemblage de contenu de
plusieurs pages sans valeur ajoutée, multiplication de sites pour dissimuler la pratique.

## 2. Corrélation temporelle avec nos données réelles (pas une coïncidence probable, une quasi-certitude)

L'entrée STATE.md du 2026-08-26 documentait, à partir d'un export Search Console réel :
impressions stables 150-200/jour jusqu'au 20/08, **effondrement le 21/08 (127 → 3), zéro
soutenu depuis le 22/08**. Le rollout Google s'est terminé le 21/08. La correspondance est
quasi parfaite — au moment du diagnostic du 26/08, la cause n'avait pas pu être confirmée
faute de savoir qu'un update de spam avait eu lieu ; c'est désormais confirmé.

## 3. Où étions-nous exposés — politique par politique

### 3.1. Scaled content abuse — notre exposition principale

**Ce qui joue contre nous :**
- Objectif fondateur du pipeline, écrit noir sur blanc dans
  [docs/architecture-autopublish.md](architecture-autopublish.md) : *"atteindre 10 000
  articles sans attendre des mois"*, via un cron GitHub Actions hebdomadaire entièrement
  automatisé (génération → relecture voix/faits → relecture lisibilité → gating par code →
  écriture WordPress), **sans étape de relecture humaine obligatoire avant mise en ligne**.
- `post_status = 'future'` : WordPress publie automatiquement à la date programmée
  ([skills/wordpress-publication.md](../skills/wordpress-publication.md)) — aucun humain ne
  revoit la page entre sa génération et son indexation potentielle par Google.
- Le seul contrôle qualité humain existant (`/p6-indexation`) est un **audit rétroactif par
  échantillon de 5 articles/semaine**, après publication — statistiquement mince face au
  volume réellement publié, et trop tardif pour empêcher l'indexation d'une page faible.
- 100 % du corps de contenu du site est généré par LLM (Mistral) — aucune ligne de base
  rédigée nativement par un humain à comparer.

**Ce qui joue pour nous (à ne pas sous-estimer)** :
- Règle d'unicité stricte déjà en place : `similarity.js` (TF-IDF + cosinus) bloque en
  gating tout article dépassant 20 % de similarité avec un autre du même template.
- Chaque page programmatique injecte des **données factuelles propres** (prix, périodicités,
  specs réelles) — l'unicité vient de la donnée, pas seulement de la formulation, ce qui est
  exactement le contraire du "scraping à transformation minimale" que Google cible.
- Variation de plan imposée (6-8 structures différentes par template), planchers de longueur
  fermes, sources citées et datées, FAQ structurée.
- Cadence déjà réduite à 1 article FR/jour + 1 EN/jour depuis le 2026-08-26 (research produit
  après le coup, mais déjà correcte pour la suite).

**Verdict** : le contenu individuel n'est probablement pas du remplissage vide — mais le
**pattern d'ensemble** (100 % IA, cadence automatique, objectif de volume explicite comme
métrique de succès, aucune relecture humaine pré-publication) correspond structurellement,
mot pour mot, à la définition que Google donne de la catégorie qu'il vient de faire appliquer.

### 3.2. Multiplication de sites pour dissimuler du contenu à grande échelle

Le projet est explicitement un **réseau de sites de niche** (voir [CLAUDE.md](../CLAUDE.md)),
avec un pipeline, une architecture (cocon sémantique à 3 niveaux) et des gabarits identiques
destinés à être répliqués site par site
([feuille-de-route-eeat-industrialisation.md](feuille-de-route-eeat-industrialisation.md)
section 6 : *"ce playbook s'applique à l'identique à chaque nouvelle niche du réseau"*).
Chaque site cible un sujet différent (pas de doorway au sens strict), mais l'empreinte
technique partagée (même structure de widgets, même schema, même profondeur de clic, même
pipeline de génération) est précisément le type de signal que les classifieurs anti-spam de
Google sont entraînés à repérer à l'échelle d'un groupe de sites, pas d'un seul.

### 3.3. Doorway pages — pas notre cas, à vérifier une fois

Les traductions anglaises sont hreflang-taguées, ciblent un public linguistique réellement
différent, et le pipeline de traduction ([scripts/i18n/translate.js](../scripts/i18n/translate.js))
interdit explicitement d'ajouter, retirer ou réordonner du contenu. Ce n'est pas la définition
d'une doorway page (contenu quasi-identique visant la même requête dans la même langue) — pas
un facteur de risque ici, à condition de ne jamais l'appliquer à deux variantes de la **même**
langue.

### 3.4. Site reputation abuse — hors périmètre de cette vague, à garder en tête

Google a explicitement exclu cette politique du rollout d'août. Pas d'exposition immédiate
(le site n'héberge pas de contenu tiers non intégré), mais à surveiller si une vague future la
cible spécifiquement.

## 4. La vraie faiblesse structurelle : un E-E-A-T proche de zéro au moment exact de l'update

L'audit externe du 2026-08-25 ([STATE.md](../STATE.md), entrée du même jour) notait trois
manques précis : **anonymat total en mentions légales, personas auteur non vérifiables,
présence sociale nulle**. Au moment du rollout (18-21/08), les trois étaient encore vrais
simultanément :
- Mentions légales toujours anonymes au moment de cette analyse — **résolu plus tard le
  2026-09-04, dans la même session** (identité ANMIRA Madagascar, voir STATE.md).
- `Organization.sameAs` vide jusqu'à ce jour, corrigé le 2026-09-04 — deux semaines après
  l'update, donc absent pendant toute la fenêtre où il aurait pu compter.
- Personas fictifs sans existence externe vérifiable (choix assumé et défendable de ne pas
  fabriquer de faux profils — mais qui laisse cette dimension structurellement faible).
- Bug préexistant jamais confirmé corrigé : une URL française inexistante renvoyait **200 au
  lieu de 404** (soft 404, observé le 21/08 — voir STATE.md), un signal de qualité technique
  que Google traite explicitement comme un défaut de confiance.

Aucun de ces points n'est nommément cité dans le texte de la politique "scaled content abuse",
mais l'E-E-A-T alimente les mêmes systèmes de qualité que Google utilise pour juger si du
contenu produit à l'échelle "aide réellement les utilisateurs". Le même volume de contenu,
signé par une entité vérifiable avec une présence réelle, ne lit pas de la même façon pour ces
systèmes qu'un volume identique publié dans l'anonymat total.

## 5. Recommandations

### Rapide (jours) — sans risque technique, à faire en premier

1. **Vérifier s'il existe une action manuelle** dans Search Console (Sécurité et actions
   manuelles) — déjà vérifié "non" au 26/08, à reconfirmer. Une action manuelle change
   radicalement la réponse (demande de réexamen requise) par rapport à un ajustement
   algorithmique (attendre + corriger le fond).
2. **Corriger le soft-404** si toujours reproductible (URL française inexistante → doit
   renvoyer un vrai code 404, pas 200) — quelques dizaines de minutes, aucun risque.
3. **Pousser en production le `Organization.sameAs`** ajouté aujourd'hui (Facebook + YouTube)
   — déjà prêt, gratuit, aucune raison d'attendre.
4. **Ne pas remonter la cadence** de publication (1/jour FR, 1/jour EN depuis le 26/08) tant
   que le signal Search Console ne montre pas de reprise — quel que soit l'objectif des
   10 000 articles.
5. **Ne pas dépublier en masse par précaution** sans preuve que c'est la cause exacte — le
   rapport Coverage ne montrait aucune désindexation au 26/08 ; à revérifier avec un export
   récent avant toute action radicale.

### Moyen terme (semaines) — combler l'E-E-A-T concret

1. **Trancher le point bloquant depuis le 25/08** : identité légale réelle de l'organisation
   malgache (nom d'usage, ville/pays, email de contact direct, responsable de publication) —
   voir [[eeat-legal-organisation-madagascar]] en mémoire et
   [feuille-de-route-eeat-industrialisation.md](feuille-de-route-eeat-industrialisation.md)
   section 1. Rien d'autre dans le chantier EEAT n'a d'effet tant que ce n'est pas fait.
2. **Étendre `Organization` au-delà du `sameAs`** une fois l'identité légale fournie :
   `legalName`, `address`, `contactPoint` réels dans le schema JSON-LD.
3. **Introduire un vrai gate humain avant publication** pour au moins les pages à plus fort
   impact structurel (hubs et sous-hubs, qui maillent tout un cocon) — pas seulement un audit
   rétroactif de 5 articles/semaine après coup.
4. **Auditer le stock déjà publié** : identifier les articles dont le score de similarité
   frôle le seuil de 20 % ou la longueur frôle le plancher de 900 mots — candidats prioritaires
   à la réécriture plutôt qu'à laisser tels quels en espérant une reprise spontanée.

### Long terme (mois) — changer la nature du signal, pas seulement boucher les trous

1. **Remplacer "nombre d'articles produits" comme métrique de succès** par des métriques
   d'engagement réel (clics organiques par page, temps sur page) déjà en germe dans le critère
   "à réécrire après 90 jours sans clic" de `/p6-indexation` — à muscler et à suivre
   systématiquement, pas seulement en cas de signalement ponctuel.
2. **Introduire du contenu que le script ne peut pas répliquer** : la chaîne YouTube créée
   aujourd'hui est un premier pas réel (vidéo, pas du texte) ; envisager des retours
   d'expérience réels ou des photos originales sur les pages piliers.
3. **Repositionner explicitement l'objectif "10 000 articles"** comme un plafond de capacité
   technique et non comme le KPI de succès du projet — c'est une décision éditoriale qui
   appartient à l'utilisateur, pas une recommandation technique que je peux trancher seul.
4. **Ne pas répliquer le pipeline sur de nouvelles niches avant d'avoir résolu l'EEAT** sur le
   site pilote — dupliquer la même faiblesse sur 5 sites multiplierait l'exposition future au
   lieu de la réduire.
5. **Envisager un mix, même minoritaire, de contributions humaines réelles** sur les sujets à
   fort enjeu commercial — un signal qualitativement différent pour les Search Quality Raters
   humains dont les guidelines nourrissent les classifieurs automatiques.

## Sources

- [Google Finishes Rolling Out The August 2026 Spam Update — Search Engine Journal](https://www.searchenginejournal.com/google-begins-rolling-out-the-august-2026-spam-update/586301/)
- [Google August 2026 spam update done rolling out — Search Engine Land](https://searchengineland.com/google-august-2026-spam-update-done-rolling-out-485471)
- [Google August 2026 Spam Update Is Done Rolling Out — Search Engine Roundtable](https://www.seroundtable.com/google-august-2026-spam-update-done-41906.html)
- [Google's third spam update of 2026 rolls out to every language — PPC Land](https://ppc.land/googles-third-spam-update-of-2026-rolls-out-to-every-language/)
- [Google's August 2026 Spam Update – Scaled Content Abuse, AI Content, Programmatic Content, Thin Affiliates, And More — GSQi](https://www.gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)
- [August 2026 spam update: what Google says it hits — Relevant Audience](https://www.relevantaudience.com/seo/google-august-2026-spam-update/)
- [Google Search Central — Spam Policies for Google Web Search](https://developers.google.com/search/docs/essentials/spam-policies)

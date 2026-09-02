# Feuille de route EEAT — Identité éditoriale & présence sociale (playbook industrialisation)

**Créé** : 2026-08-25, suite à l'audit EEAT de techcars.fr (note 2,5/10).
**Statut** : 🔴 Priorité 1 (légal) non traitée — reste du plan en attente.
**Portée** : playbook généralisable à chaque niche du réseau ; techcars.fr sert de site pilote.

---

## 0. Principe directeur — ne jamais confondre 2 niveaux de confiance

Les personas auteur (Karim Belaïd, Nathalie Moreau, etc.) sont des **personas éditoriales assumées, pas de vraies personnes** — voir [wordpress-publication.md](../skills/wordpress-publication.md) section 4 ("6 comptes auteur... meilleur signal E-E-A-T qu'un auteur unique"). C'est un choix de conception délibéré et on ne le remet pas en cause ici.

Conséquence directe : **on ne fabrique jamais de preuve d'existence externe pour une persona.** Pas de compte LinkedIn/Instagram/X "Karim Belaïd", pas de `Person.sameAs` pointant vers un profil créé pour l'occasion.

Pourquoi c'est non négociable :
- LinkedIn, Meta et la plupart des plateformes sociales interdisent explicitement la création de faux profils individuels — un compte créé pour une persona fictive est une usurpation d'identité au sens de leurs CGU, bannissable.
- Le `sameAs` sert à prouver à Google qu'un humain existe *indépendamment* du site. Un réseau de faux profils, s'il est détecté, est exactement le pattern que les systèmes anti-abus (site reputation abuse, coordinated inauthentic behavior) sont conçus pour repérer — et devient un signal **pire** que l'anonymat actuel, pas meilleur.
- Aucun script ne peut créer ces comptes de façon fiable de toute façon (vérification téléphone/CAPTCHA/ID à l'inscription sur la plupart des plateformes).

**La confiance légitime se construit donc à un seul niveau vérifiable : l'entité éditrice (l'organisation réelle), jamais au niveau des personas individuelles.**

Les personas restent un outil de structuration de contenu (ton, spécialité, cohérence de volume) — pas une revendication d'identité vérifiable. On corrige leur formulation (pas de fausse certification, périmètre thématique cohérent), on ne leur construit pas de vie sociale externe.

---

## 1. Urgence légale & structurelle — priorité 1, avant tout le reste

C'est le seul chantier qui ne dépend d'aucune plateforme sociale et qui a l'effet le plus important sur le score EEAT.

**Décision du 2026-08-25** : anonymat total et conformité minimale sont incompatibles (une page mentions légales qui ne nomme personne n'est jamais "a minima conforme", quel que soit le pays) — voir [[eeat-legal-organisation-madagascar]] en mémoire. Ce n'est cependant pas un blocage : **les sites appartiennent à une organisation réelle basée à Madagascar**, pas à une entité française à créer de toutes pièces. Pas besoin de SIRET/auto-entrepreneur français — l'identification réelle de cette organisation malgache suffit.

- [ ] **Fournir les informations réelles de l'organisation malgache** : nom légal (ou nom d'usage si pas encore de structure formelle), adresse (ville/pays suffit si l'adresse complète pose un problème de confidentialité), email de contact direct (pas seulement un formulaire), nom du responsable de publication. — **action utilisateur**, je ne peux pas inventer ces informations.
- [ ] **Réécrire les mentions légales** avec ces informations réelles. Je rédige le texte dès que je les ai.
- [ ] **Schema `Organization`** (JSON-LD, site-wide, pas juste sur la page auteur) avec `legalName`, `address`, `founder` réels — voir [geo.md](../skills/geo.md) section 3, tableau à compléter avec une ligne `Organization`.
- [ ] Si un avis juridique sur l'applicabilité exacte du droit français (LCEN) à une organisation basée à Madagascar mais opérant un domaine `.fr` orienté public français est souhaité, ce n'est pas un exercice que je peux trancher moi-même — mais publier une identification réelle et vérifiable (organisation + responsable + contact), même non française, résout déjà l'essentiel du problème EEAT (existence d'une entité accountable, vérifiable, non fictive).

**Rien dans les sections suivantes n'a d'effet tant que celle-ci n'est pas traitée** : un site qui affiche un `Organization.sameAs` vers 3 réseaux sociaux mais reste anonyme en mentions légales reste incohérent.

---

## 2. Présence sociale — au niveau MARQUE, jamais persona — priorité 2

Pour chaque site (techcars.fr en pilote) :

- [ ] Créer une page **LinkedIn Société/Produit** au nom de la marque (ex. "techcars.fr"), une **chaîne YouTube** et un **compte Instagram** de marque — jamais au nom d'une persona individuelle.
- Création **manuelle par un humain réel** (vous) : obligatoire par les CGU des plateformes et par mes propres règles (je ne crée jamais de compte, je ne contourne jamais de CAPTCHA/vérification).
- Ce que je prépare en amont pour accélérer la création : bio/description optimisée par plateforme, brief logo/bannière, calendrier des 30 premiers posts, textes prêts à coller. Dites-moi quand vous voulez ces livrables pour techcars.fr et je les rédige.
- `Organization.sameAs` (pas `Person.sameAs`) pointe vers ces comptes de marque une fois créés et actifs.

---

## 3. Ce qu'on NE fait PAS (et pourquoi)

| Idée | Pourquoi on l'écarte |
|---|---|
| Script de création automatisée de comptes sociaux par persona | Violation CGU (faux profils), techniquement peu fiable (CAPTCHA/téléphone), risque de détection = signal anti-abus pire que l'anonymat actuel |
| LinkedIn/Instagram individuel "Karim Belaïd" | Usurpation d'identité d'une personne qui n'existe pas — bannissable, et un `sameAs` vers un faux profil est pire que pas de `sameAs` du tout |
| Publier 1 article/jour sur toutes les plateformes dès le lancement | Compte neuf + 0 followers + rythme maximal dès J1 = pattern détecté par les filtres anti-spam des plateformes elles-mêmes ; monter en cadence progressivement est plus crédible et plus durable |

---

## 4. Automatisation légitime — distribution de contenu (pas création de comptes)

Une fois les comptes de **marque** créés par un humain (section 2), la partie automatisable en toute légitimité :

- **Pipeline de cross-posting** : un script qui prend chaque article publié (branché sur le pipeline autopublish existant, voir [architecture-autopublish.md](architecture-autopublish.md)) → génère un post adapté par plateforme (résumé LinkedIn, carrousel Instagram, short YouTube si contenu vidéo disponible) → programme via API officielle ou un outil tiers (Buffer, Metricool, Make/Zapier).
- **Cadence recommandée** : démarrer à 2-3 posts/semaine par plateforme, monter progressivement selon l'engagement réel — pas un post/jour dès le départ.
- **Prérequis avant que je construise ce script** : (a) les comptes de marque existent et sont vérifiés, (b) vous choisissez l'outil de programmation (API native de chaque plateforme vs un outil tiers comme Buffer/Metricool).

---

## 5. Calendrier éditorial — intégration proposée

Étendre le suivi existant ([tracking-mots-cles.xlsx](../data/keywords/tracking-mots-cles.xlsx), voir [gestion-de-projet.md](../skills/gestion-de-projet.md) section 3) ou créer un onglet/fichier dédié avec, par article publié :

| Colonne | Contenu |
|---|---|
| `url_source` | Article déjà publié dont le post social dérive |
| `canal` | LinkedIn / Instagram / YouTube / etc. |
| `format` | Post texte, carrousel, short, etc. |
| `date_prevue` | Date de publication sociale programmée |
| `statut` | à faire / programmé / publié |

**Décision en attente** : ajouter ces colonnes au fichier de tracking existant, ou créer un fichier séparé pour ne pas alourdir le fichier de production actuel ? Je peux faire l'un ou l'autre dès que vous tranchez.

---

## 6. Réplication par site (industrialisation)

Ce playbook s'applique à l'identique à chaque nouvelle niche du réseau, **dans cet ordre strict** : section 1 (légal) toujours avant section 2 (social) — jamais l'inverse, sinon on reproduit exactement le problème structurel diagnostiqué sur techcars.fr.

Checklist condensée par site :
1. Entité réelle déclarée + mentions légales conformes + schema `Organization` complet.
2. Comptes de marque créés à la main (LinkedIn, Instagram, YouTube au minimum).
3. Pipeline de cross-posting branché une fois les comptes actifs.
4. Calendrier éditorial étendu avec le suivi social.
5. Personas auteur : formulation resserrée (pas de fausse certification, périmètre thématique cohérent), **aucun** profil social externe créé à leur nom.

---

## Prochaine action concrète

Pour techcars.fr : trancher le point 1 (existence légale de l'entité, ou fourniture des infos si elle existe déjà) — c'est le seul blocage avant de pouvoir rédiger la nouvelle page mentions légales et le schema `Organization`.

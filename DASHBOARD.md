# 🎯 DASHBOARD AUTOSEO — Synthèse Globale

**Dernière mise à jour** : 2026-07-17 | **Status** : 🟡 En production contenu, monétisation documentée

---

## 🎬 **TODO EXHAUSTIF — ABSOLUMENT TOUT CE QUI RESTE À FAIRE**

### 📌 **DÉPENDANCES CLÉS**

```
P4 Articles (en cours)
  ↓ (débloque)
P5 Indexation (en attente)
  ↓ (besoin 1000 vis/jour)
TRIGGER Monétisation (Phase 1)
  ↓ (5 jours, puis trigger Phase 2)
Phase 2 Outils Interactifs
  ↓ (besoin RPM ≥ 50€)
Phase 3 Marketplace
  ↓ (besoin 50+ garages)
Phase 4 Premium & B2B
```

---

## 🎬 **TODO — ABSOLUMENT TOUT CE QUI RESTE À FAIRE**

### 🔴 **URGENT (Cette semaine)**

#### Task 1: Audit Trafic Actuel
- [ ] Accéder Google Analytics (https://analytics.google.com)
- [ ] Consulter "Utilisateurs" → dernier mois
- [ ] Calculer : Total utilisateurs / 30 jours = Visiteurs/jour moyen
- [ ] Noter résultat dans STATE.md
- [ ] Comparer avec baseline (~500 vis/jour attendu?)
- [ ] Vérifier trend (montée ou plateau?)
- [ ] Identifier top 20 pages par sessions
- [ ] Analyser pages avec taux rebond > 70%
- [ ] Vérifier durée moyenne session (target: > 2 min)

#### Task 2: Production Articles P4 (5-10 articles cette semaine)
- [ ] Générer batch keywords P1 haut-trafic : `/p1-keywords --priority=high-intent`
- [ ] Lister top 10 keywords par potential trafic
- [ ] Pour chaque keyword :
  - [ ] Générer article : `/p4-articles --keyword=[KEYWORD]`
  - [ ] Vérifier contenu généré (copier si OK, rejeter si faible)
  - [ ] Optimiser title : < 60 chars, keyword au début
  - [ ] Optimiser meta description : 155 chars, call-to-action
  - [ ] Ajouter image optimisée (compression, alt-text)
  - [ ] Ajouter 3-5 liens internes (P3 maillage)
  - [ ] Vérifier liens externes (credibilité)
  - [ ] Publier en WordPress
  - [ ] Indexer manuellement Google (GSC)
- [ ] Total : 5-10 articles publiés cette semaine

#### Task 3: Vérification Indexation Google
- [ ] Accéder Google Search Console (https://search.google.com/search-console)
- [ ] Aller Couverture
- [ ] Noter : "Pages indexées" total
- [ ] Comparer avec articles publiés (couverture %)
- [ ] Vérifier : Y a-t-il des erreurs d'indexation?
- [ ] Si pages non indexées :
  - [ ] Vérifier robots.txt (ne bloque pas?)
  - [ ] Soumettre sitemap.xml manuellement
  - [ ] Soumettre URLs non indexées (URL inspection)
- [ ] Vérifier mobile-friendly (GSC → Enhancementsments)
- [ ] Vérifier Core Web Vitals (target : tous GREEN)
- [ ] Consulter Performance → clicks, impressions, CTR trend

---

### 🟠 **IMPORTANT (Prochaines 2 semaines — Semaines 2-3)**

#### Contenu & SEO (P4) — Scalabiliser production
- [ ] **Augmenter cadence publication** (target: 3-5 articles/semaine)
  - [ ] Créer editorial calendar (30 days, 15 articles min)
  - [ ] Assigner keywords à chaque jour
  - [ ] Générer batch 5 articles : `/p4-articles --batch=5`
  - [ ] Réviser tous 5 en parallèle
  - [ ] Optimiser tous 5 en parallèle
  - [ ] Publier tous 5
  - [ ] Indexer tous 5 GSC
  - [ ] Répéter chaque 2-3 jours

- [ ] **Couvrir tous clusters keywords P1**
  - [ ] Lister tous clusters P1 (ex: Maintenance, Pannes, Assurance, etc)
  - [ ] Pour chaque cluster :
    - [ ] Identifier 5-10 keywords représentatifs
    - [ ] Générer articles (1 par keyword)
    - [ ] Lier articles entre eux (P3 maillage)
    - [ ] Créer hub page pour cluster
  - [ ] Total : 50+ articles min pour couvrir tous clusters

- [ ] **Ajouter liens internes P3 maillage**
  - [ ] Consulter : `/p3-mapping` résultat
  - [ ] Pour chaque article :
    - [ ] Identifier 3-5 articles connexes
    - [ ] Ajouter liens naturels (anchor text SEO-friendly)
    - [ ] Vérifier pas de cycles (A→B→A)
    - [ ] Vérifier liens pertinents (même sujet)

- [ ] **Optimiser images**
  - [ ] Pour chaque article :
    - [ ] Télécharger image (ou générer)
    - [ ] Compresser (TinyPNG ou Imagemin)
    - [ ] Ajouter alt-text descriptif (keywords si naturel)
    - [ ] Ajouter title (hover tooltip)
    - [ ] Vérifier format (JPG/WebP, pas PNG sauf logos)

- [ ] **Vérifier Core Web Vitals**
  - [ ] Accéder PageSpeed Insights (https://pagespeed.web.dev)
  - [ ] Entrer site URL
  - [ ] Vérifier 3 métriques:
    - [ ] LCP (Largest Contentful Paint) < 2.5s ✅
    - [ ] FID (First Input Delay) < 100ms ✅
    - [ ] CLS (Cumulative Layout Shift) < 0.1 ✅
  - [ ] Si rouge :
    - [ ] Identifier cause (images trop grosses? JS bloquant? Fonts?)
    - [ ] Fixer (compresser images, minify JS, lazy-load, etc)
    - [ ] Re-tester

#### Indexation & Visibilité (P5) — Bootleg indexing
- [ ] **Soumettre tous articles à GSC**
  - [ ] Accéder GSC
  - [ ] Pour chaque nouvel article :
    - [ ] Copier URL
    - [ ] Aller "URL inspection"
    - [ ] Coller URL
    - [ ] Cliquer "Indexer ce URL"
    - [ ] Attendre confirmation (ou relancer si rejet)

- [ ] **Vérifier crawl budget (GSC)**
  - [ ] Aller Stats → Demandes d'exploration
  - [ ] Vérifier : Combien d'URLs Googlebot crawl/jour?
  - [ ] Si < 50 : Site trop petit, normal
  - [ ] Si plateau : Améliorer performance ou autorité

- [ ] **Fixer erreurs 404 / redirects**
  - [ ] GSC → Couverture → Erreurs
  - [ ] Pour chaque 404 :
    - [ ] Vérifier cause (page supprimée? URL typo?)
    - [ ] Créer redirect 301 (si page remplacée)
    - [ ] Ou créer contenu manquant
  - [ ] GSC → Exploration → Soft 404 (contenus vides)
    - [ ] Ajouter contenu ou supprimer page

- [ ] **Vérifier robots.txt + sitemap.xml**
  - [ ] Accéder site.com/robots.txt
  - [ ] Vérifier:
    - [ ] Pas de `Disallow: /` (bloquerait tout!)
    - [ ] Pas de `Disallow: /wp-admin/` (OK)
    - [ ] Pas de blockage articles (`.html` ou `/blog/`)
  - [ ] Accéder site.com/sitemap.xml
  - [ ] Vérifier:
    - [ ] Contient 50+ URLs (coverage?)
    - [ ] URLs sont correctes (pas de typos)
    - [ ] Urls sont indexées (vérifier quelques-unes GSC)

#### Données Factuelles (P2) — Validation completeness
- [ ] **Valider 100% marques importées**
  - [ ] Lancer : `/p2-database --check-completeness`
  - [ ] Consulter rapport : Marques couvertes?
  - [ ] Expected: 39 marques (Renault, Peugeot, Citroen, BMW, Mercedes, Audi, Volkswagen, etc)
  - [ ] Si gaps :
    - [ ] Lancer : `/p2-database --force-complete --focus=missing-marques`
    - [ ] Attendre import
    - [ ] Vérifier gaps résolvus

- [ ] **Vérifier codes OBD (606 codes)**
  - [ ] Vérifier fichier : `data/factuel/codes-obd-*.json`
  - [ ] Compter entries : Expected 606
  - [ ] Si < 606 : Relancer `/p2-database --dataset=codes-obd`
  - [ ] Vérifier structure : code, description, cause, solution
  - [ ] Vérifier données par marque (P0420 coûte différent Renault vs BMW?)

- [ ] **Vérifier prix entretien (coverage)**
  - [ ] Vérifier fichier : `data/factuel/entretien-croisement-prix-marques-*.json`
  - [ ] Vérifier prestations couvertes :
    - [ ] Révision 15k km ✅
    - [ ] Changement plaquettes ✅
    - [ ] Changement filtres ✅
    - [ ] Remplacement pneus ✅
    - [ ] Réparation vitre ✅
  - [ ] Vérifier prix par marque (même prestation coûte différent par marque? OUI)
  - [ ] Si gaps : Relancer `/p2-database --force-complete`

---

### 🟡 **À FAIRE AVANT TRIGGER MONÉTISATION (1000 vis/jour) — 2-3 semaines avant trigger**

#### WordPress Setup — Foundation Infrastructure
- [ ] **Choisir hébergement** (si pas déjà fait)
  - [ ] Option 1: WordPress.com Business ($25/mois) → Plus simple
  - [ ] Option 2: OVH/Kinsta auto-hébergé → Plus contrôle technique
  - [ ] Décider basé sur : Budget, Contrôle, Expertise disponible
  - [ ] Créer compte hébergeur
  - [ ] Configurer domaine (DNS)
  - [ ] Installer WordPress (1-click si possible)

- [ ] **Installer plugins requis**
  - [ ] Accéder wp-admin → Plugins → Ajouter
  - [ ] [ ] Advanced Custom Fields Pro (ACF) — $99/an (REQUIS pour outils)
    - [ ] Acheter licences (1 minimum)
    - [ ] Installer + activer
    - [ ] Entrer licence clé (wp-admin → ACF → Settings)
  - [ ] [ ] Elementor Pro (Templates dynamiques) — $99/an
    - [ ] Installer + activer
  - [ ] [ ] Gravity Forms (Lead forms) — $199/an
    - [ ] Installer + activer
    - [ ] Obtenir clé licence
  - [ ] [ ] WP Mail SMTP (Envoi email)
    - [ ] Installer + activer
    - [ ] Connecter Gmail / SendGrid / autre
    - [ ] Tester envoi email test
  - [ ] [ ] Yoast SEO ou Rank Math (SEO on-page)
    - [ ] Installer
    - [ ] Configurer keywords focus
  - [ ] [ ] Zapier plugin (optionnel, si Zapier utilisé)
    - [ ] Installer + activer

- [ ] **Configuration basique WordPress**
  - [ ] wp-admin → Settings
    - [ ] [ ] General : Site title (ex: "Mon Auto")
    - [ ] [ ] General : Tagline
    - [ ] [ ] General : WordPress Address (https://monauto.fr)
    - [ ] [ ] General : Site Address (https://monauto.fr)
    - [ ] [ ] General : Timezone (Europe/Paris)
    - [ ] [ ] General : Date Format
  - [ ] wp-admin → Settings → Permalinks
    - [ ] [ ] Sélectionner : "Post name" (=/blog/article-name/)
    - [ ] [ ] Sauvegarder (refresh .htaccess)
  - [ ] wp-admin → Settings → Discussion
    - [ ] [ ] Activer/désactiver commentaires (selon préférence)

#### Outils Phase 1 — Infrastructure Dynamique (À PRÉPARER avant trigger)
- [ ] **Exécuter script CPTs** (Jour 0, avant Phase 1)
  - [ ] Vérifier: WordPress + ACF Pro + plugins installés ✅
  - [ ] Accéder serveur (SSH ou terminal WP)
  - [ ] Lancer : `wp eval-file scripts/setup-wordpress-cpts.php`
  - [ ] Attendre completion (affiche success message)
  - [ ] Vérifier: wp-admin → Pages → voir "Modèles Auto" CPT ✅
  - [ ] Vérifier: wp-admin → Outils → Champs personnalisés → 5 groupes ACF ✅

- [ ] **Importer données P2** (Jour 1-2, Phase 1)
  - [ ] Vérifier: Data P2 complète (`/p2-database --check`)
  - [ ] Lancer import :
    ```bash
    python scripts/import-p2-to-acf.py \
      --wordpress-url "https://monauto.fr" \
      --wp-user "admin" \
      --wp-password "[PASSWORD]" \
      --p2-path "data/factuel/" \
      --batch-size 100
    ```
  - [ ] Attendre completion (peut prendre 30-60 min)
  - [ ] Vérifier: `wp post list --post_type=auto_modele --format=count` → Expected: ~450
  - [ ] Vérifier: `wp post list --post_type=code_obd --format=count` → Expected: ~606
  - [ ] Spot-check 5 posts aléatoires (ACF fields remplis?)

- [ ] **Créer page Calculateur Budget** (Jour 3, Phase 1)
  - [ ] wp-admin → Pages → Ajouter new
  - [ ] Titre: "Calculateur Budget Entretien"
  - [ ] Slug: "budget"
  - [ ] Sélectionner template: [Créer custom template ou Elementor]
  - [ ] Ajouter shortcode calculateur (ou widget Elementor)
    - [ ] `[monauto-calculateur]` (ou équivalent)
  - [ ] Publier
  - [ ] Tester sur site: https://monauto.fr/budget/
    - [ ] Charger? ✅
    - [ ] Dropdown marques apparaît? ✅
    - [ ] Sélectionner Renault → Clio → 2020 → Voir résultat? ✅

- [ ] **Ajouter Gravity Forms pour lead capture** (Jour 3-4)
  - [ ] wp-admin → Forms → Ajouter new
  - [ ] Champs:
    - [ ] Nom (texte, obligatoire)
    - [ ] Email (email, obligatoire, email validation)
    - [ ] Téléphone (texte, format FR)
    - [ ] Marque/Modèle (hidden field pré-rempli du calculateur)
  - [ ] Settings
    - [ ] [ ] Form name: "Lead Calculateur"
    - [ ] [ ] Notifications: Envoyer email à admin@monauto.fr
    - [ ] [ ] Confirmation: Afficher message "Merci! Devis en attente"
    - [ ] [ ] Entry limit: Aucun
  - [ ] Publier
  - [ ] Tester soumission (vérifier email reçu)

- [ ] **Intégrer lien Vroomly** (Jour 4)
  - [ ] Insérer lien CTA dans template calculateur
  - [ ] Format: `https://vroomly.com/?aff=[AFF_ID]`
  - [ ] Tester lien (manuellement cliquer → vérifier Vroomly tracking)

#### Configuration Tiers (À PRÉPARER 1-2 semaines avant trigger)
- [ ] **Vroomly — Affiliation setup**
  - [ ] Aller https://partner.vroomly.com
  - [ ] Cliquer "S'inscrire"
  - [ ] Formulaire inscription :
    - [ ] [ ] Email (ambinintsoa@publithings.com)
    - [ ] [ ] Mot de passe
    - [ ] [ ] Nom complet (Adriano)
    - [ ] [ ] Téléphone (+33 ou +261)
    - [ ] [ ] Accepter conditions
  - [ ] Valider email (vérifier spam)
  - [ ] Valider téléphone (SMS reçu)
  - [ ] Dashboard ouvert → Aller "Paramètres"
    - [ ] [ ] Récupérer aff ID (ex: `aff_12345`)
    - [ ] [ ] Copier lien unique: `https://vroomly.com/?aff=aff_12345`
  - [ ] Ajouter lien dans WordPress (CTA calculateur)
  - [ ] Tester tracking :
    - [ ] Cliquer lien unique → Landing Vroomly
    - [ ] Vérifier: Cookie Vroomly présent (Dev tools → Application → Cookies)
    - [ ] Valider attribution 24h après via dashboard Vroomly

- [ ] **Zapier — Email automation setup**
  - [ ] Aller https://zapier.com
  - [ ] Créer compte:
    - [ ] [ ] Email
    - [ ] [ ] Password
    - [ ] [ ] Prenom + Name
  - [ ] Valider email (lien confirmation)
  - [ ] Dashboard → "Make a Zap"
  - [ ] Trigger: Gravity Forms (rechercher)
    - [ ] [ ] Sélectionner "New Entry" (quand new form submission)
    - [ ] [ ] Connecter WordPress (API REST)
    - [ ] [ ] Sélectionner form: "Lead Calculateur"
  - [ ] Action: Email (Gmail ou autre)
    - [ ] [ ] Connecter compte email
    - [ ] [ ] To: admin@monauto.fr
    - [ ] [ ] From: noreply@zapier.com
    - [ ] [ ] Subject: "Nouveau lead — {name} ({email})"
    - [ ] [ ] Body: "Marque: {marque}\nModele: {modele}\nTel: {phone}"
  - [ ] Test:
    - [ ] [ ] Remplir formulaire test WordPress
    - [ ] [ ] Vérifier email reçu en 2-3 min
  - [ ] Publier Zap

- [ ] **Google Analytics 4 — Setup tracking**
  - [ ] Aller https://analytics.google.com
  - [ ] Créer Property (si pas déjà):
    - [ ] [ ] Property name: "Mon Auto"
    - [ ] [ ] Sélectionner fuseau horaire: Europe/Paris
  - [ ] Ajouter Web Data Stream:
    - [ ] [ ] URL: https://monauto.fr
    - [ ] [ ] Nom stream: "Mon Auto Web"
  - [ ] Copier ID mesure (G-xxxxxxxx)
  - [ ] wp-admin → Plugins → Installer "Google Analytics for WordPress by MonsterInsights"
    - [ ] [ ] Connecter GA4
    - [ ] [ ] Entrer ID mesure
    - [ ] [ ] Activer event tracking
  - [ ] Créer segments custom:
    - [ ] [ ] Nom: "Calculateur Users"
      - Condition: Page title contains "Calculateur"
    - [ ] [ ] Nom: "Lead Converters"
      - Condition: Event name = "form_submit"
  - [ ] Créer dashboard custom:
    - [ ] [ ] Nom: "Revenue by Tool"
    - [ ] [ ] Cartes: Page views, Events, Users
  - [ ] Tester: Naviguer site → vérifier événements en real-time GA4

---

### 🟢 **PHASE 1 — À EXÉCUTER AU TRIGGER (Jour 1-5 après 1000 vis/jour)**

Voir checklist détaillée : [docs/checklist-lancement-monetisation.md](docs/checklist-lancement-monetisation.md)

- [ ] **Jour 1** : Exécuter script WordPress CPTs
- [ ] **Jour 2-3** : Importer P2 data
- [ ] **Jour 4** : Configurer Vroomly affiliation
- [ ] **Jour 5** : Mettre en live calculateur + CTAs

**Success criteria** :
- [ ] RPM ≥ 20€
- [ ] 30+ clics/jour vers Vroomly
- [ ] 10+ devis/jour chez Vroomly

---

### 🔵 **PHASE 2 — À EXÉCUTER APRÈS PHASE 1 (Semaine 3-4 si RPM ≥ 20€)**

- [ ] **Comparateur TCO**
  - [ ] Implémenter API endpoint `/wp-json/monauto/v1/compare-tco`
  - [ ] Créer page `/comparateur/`
  - [ ] Implémenter UI (select marques/modèles, résultat graphique)
  - [ ] Tester 5 comparaisons types

- [ ] **Diagnostic OBD**
  - [ ] Implémenter API endpoint `/wp-json/monauto/v1/diagnostic-obd`
  - [ ] Créer page `/diagnostic/`
  - [ ] Implémenter UI (input code, select marque/modèle)
  - [ ] Tester 10 codes OBD types

- [ ] **Intégrations**
  - [ ] Setup Brevo (email automation)
  - [ ] Configurer email sequences (confirm, 24h follow-up, 7j follow-up)
  - [ ] Tester automation end-to-end

**Success criteria** :
- [ ] 3 outils live
- [ ] 500+ tool views/jour
- [ ] 5%+ conversion outil → lead
- [ ] RPM ≥ 50€

---

### 🟣 **PHASE 3 — À EXÉCUTER APRÈS PHASE 2 (Mois 5-8 si RPM ≥ 50€)**

- [ ] **Marketplace Propriétaire**
  - [ ] Créer CPT GARAGE_PARTENAIRE (si pas fait en Phase 1)
  - [ ] Implémenter formulaire inscription garage
  - [ ] Implémenter dashboard garage (WordPress)
  - [ ] Configurer paiement Stripe
  - [ ] Tester workflow devis end-to-end

- [ ] **Recrutement Garages**
  - [ ] Créer script email outreach (50+ garages)
  - [ ] Tracker signups (CRM simple ou Google Sheets)
  - [ ] Valider garages (vérifier légalité, avis)

**Success criteria** :
- [ ] 50+ garages partenaires
- [ ] 50% leads → marketplace
- [ ] RPM ≥ 100€

---

### 🟣 **PHASE 4 — À EXÉCUTER APRÈS PHASE 3 (Mois 9-12)**

- [ ] **Subscriptions**
  - [ ] Implémenter système subscription (Stripe)
  - [ ] Créer page pricing
  - [ ] Implémenter features premium

- [ ] **Services Premium**
  - [ ] Setup Expert Auto (Q&A avec mécanicien)
  - [ ] Implémenter système paiement à la question

- [ ] **B2B Garage**
  - [ ] Créer listing premium pour garages
  - [ ] Implémenter landing page personalisée par garage

**Success criteria** :
- [ ] 1000+ subscribers
- [ ] Churn < 5%/mois
- [ ] Revenue 20k€+/mois

---

## 📊 **PIPELINE ACTUEL — P1-P2-P3**

| Phase | Objectif | Statut | Completion |
|-------|----------|--------|-----------|
| **P1** | Mots-clés SEO générés | ✅ Complété | 100% |
| **P2** | Données factuelles importées | ✅ Complété | 100% |
| **P3** | Maillage interne structure | ✅ Complété | 100% |
| **P4** | Articles générés | ⏳ Continu | ~80% |
| **P5** | Indexation Google | ⏳ Continu | ~60% |
| **P6** | Monétisation Phase 1 | 🔴 En attente trigger | 0% (prête) |

---

## 🎯 **STATUT GLOBAL**

```
Site : 300-500 visiteurs/jour → 🟡 Croissance lente
Articles : 50+ publiés → ✅ Base contenu solide
Trafic requis pour monétisation : 1000 vis/jour → 🔴 Pas atteint
Docs monétisation : COMPLÈTES ET PRÊTES → ✅ 100%
```

---

## 📁 **DOCUMENTS PRIORITÉS**

### 🔴 À CONSULTER RÉGULIÈREMENT

1. **[STATE.md](STATE.md)** ← Décisions + historique projet
   - Prochaine action concrète
   - Derniers changements de stratégie
   - Problèmes bloquants

2. **[MEMORY.md](.claude/projects/C--Users-Rabary-Desktop-autoseo/memory/MEMORY.md)** ← Contexte utilisateur + préférences
   - Profil Adriano (francophone, non-technique)
   - Feedback approches (ce qui marche vs. ce qui ne marche pas)

3. **[docs/checklist-lancement-monetisation.md](docs/checklist-lancement-monetisation.md)** ← Exécution Phase 1
   - À exécuter quand trafic = 1000 vis/jour
   - Jour par jour (5 jours)
   - 100% automatisable

---

## 🏗️ **ARCHITECTURE PROJET**

### Données & Contenu
```
data/
├── factuel/         ← P2 Data (marques, modèles, codes OBD, entretien)
│   ├── marques-modeles-fiabilite-*.json
│   ├── codes-obd-*.json
│   ├── entretien-croisement-prix-marques-*.json
│   └── [~15 fichiers JSON consolidés]
├── semantique/      ← P1 Keywords (clusters SEO)
└── mapping/         ← P3 Maillage interne
```

### Configuration
```
skills/                 ← Guides opérationnels par domaine
├── SEO.md
├── GEO.md
├── Design.md
├── Développement.md
└── Gestion-de-projet.md

docs/
├── commandes.md                          ← Slash commands (/p1, /p2, etc)
├── feuille-de-route-monetisation.md      ← Phases 1-4 + revenu projections
├── architecture-wordpress-dynamics.md    ← CPTs, ACF, API
└── checklist-lancement-monetisation.md   ← Jour par jour execution
```

### Scripts
```
scripts/
├── setup-wordpress-cpts.php    ← Créer 5 CPTs + ACF fields (run une fois)
└── import-p2-to-acf.py          ← Importer données P2 dans WordPress
```

---

## ⚡ **PROCHAINE ACTION CONCRÈTE (À FAIRE MAINTENANT)**

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 OBJECTIF COURT TERME : Atteindre 1000 vis/jour         │
│                                                             │
│  Étape 1 → Vérifier trafic actuel (GA4)                   │
│  Étape 2 → Publier 5-10 articles haut-intent (P4)         │
│  Étape 3 → Vérifier indexation (GSC)                      │
│  Étape 4 → Répéter jusqu'à trigger 1000 vis/jour          │
│                                                             │
│  ⚠️ NE PAS LANCER PHASE 1 tant que < 1000 vis/jour       │
└─────────────────────────────────────────────────────────────┘
```

### Action 1️⃣ (Aujourd'hui)
**Vérifier trafic Google Analytics**
```bash
Aller à : https://analytics.google.com
Consulter : Utilisateurs → Nombre utilisateurs (derniers 30j)
Diviser par 30 → Visiteurs/jour moyen
Comparer avec target 1000/jour
```
- Si ≥ 1000 vis/jour → **GO PHASE 1** (voir checklist)
- Si < 1000 vis/jour → **Continuer P4** (étape 2)

### Action 2️⃣ (Cette semaine)
**Publier articles P4** (5-10 minimum)
```bash
# Générer articles sur top keywords
/p4-articles --count=10 --priority=high-intent

# Optimiser on-page
- Vérifier title (60 chars, keyword naturel)
- Vérifier meta description (155 chars)
- Ajouter images optimisées (alt-text!)
- Ajouter liens internes P3

# Publier
wp post publish [ID] --porcelain
```

### Action 3️⃣ (Semaine 2)
**Vérifier indexation Google**
```bash
Aller à : https://search.google.com/search-console
Consulter : Couverture → Pages indexées
Comparer avec articles publiés
```
- Si pages non indexées → Soumettre sitemap
- Si pages indexées lentement → Vérifier robots.txt

### Action 4️⃣ (Continu)
**Répéter jusqu'à trigger**
- Chaque semaine : +5-10 articles P4
- Chaque semaine : Vérifier indexation
- Chaque jour : Monitorer GA4 trafic trend
- **Dès que trafic ≥ 1000/jour** → Notification ⚠️ → Lancer Phase 1

---

## 🎯 **OBJECTIFS COURT TERME (30 jours)**

- [ ] Augmenter trafic de 500 → 1000 visiteurs/jour
- [ ] Publier minimum 50 articles P4 (+ 20-30 existants = 70-80 total)
- [ ] Vérifier indexation 100% des articles
- [ ] **Trigger 1000 vis/jour trouvé?** → Passer Phase 1 monétisation

---

## 📝 **COMMENT METTRE À JOUR CE FICHIER**

Après chaque action majeure :

```markdown
1. Trafic a augmenté?
   → Update "Visiteurs/jour" en haut

2. Articles publiés?
   → Update "Articles publiés" + cocher [ ] dans TODO

3. Phase terminée?
   → Changer status ( ✅ Complété / ⏳ En cours / 🔴 En attente )

4. Nouvelle décision?
   → Update "Prochaine action concrète"

5. Nouveau document créé?
   → Ajouter lien dans "Index Complet"
```

---

## 💰 **MONÉTISATION — 4 PHASES DOCUMENTÉES**

| Phase | Période | Déclencheur | Revenu cible | Status |
|-------|---------|-------------|--------------|--------|
| **1** | Jour 1-5 | Trafic 1k/j | 500-1k€/mois | 📋 Documenté |
| **2** | Sem 3-4 | RPM ≥ 20€ | 2-5k€/mois | 📋 Documenté |
| **3** | Mois 5-8 | 100+ leads/j | 10-20k€/mois | 📋 Documenté |
| **4** | Mois 9-12 | 50 garages | 20-50k€/mois | 📋 Documenté |

**Voir** : [docs/feuille-de-route-monetisation.md](docs/feuille-de-route-monetisation.md)

---

## 🔧 **PILIERS DIFFÉRENCIATION (vs. Competitors)**

✅ **Comparateur TCO Dynamique**
- Achat + entretien + carburant + assurance + dépréciation
- Données factuelles P2
- Templates dynamiques `/comparateur/[marque1]-vs-[marque2]/`

✅ **Diagnostic OBD Interactif**
- 606 codes OBD avec causes + solutions
- Marque-spécifique (coûts différents)
- Matching garages locaux

✅ **Calculateur Budget Entretien**
- Modèle-spécifique par année
- Pessimiste / Moyen / Optimiste
- Lead magnet gratuit

---

## 📈 **MÉTRIQUES À TRACKER**

| Métrique | Cible | Fréquence | Source |
|----------|-------|-----------|--------|
| Visiteurs/jour | 1000+ | Quotidien | GA4 |
| Articles publiés | 100+ | Hebdo | WordPress |
| Impressions Google | 1k+ | Hebdo | GSC |
| CTR moyen | 4%+ | Hebdo | GSC |
| Temps moyen/page | 2+ min | Hebdo | GA4 |
| Taux rebond | < 60% | Hebdo | GA4 |

**Après trigger monétisation** :
- RPM (Revenu par 1000 vis)
- Clics affiliation
- Conversions lead
- Email delivery rate

---

## 🚨 **PROBLÈMES CONNUS & SOLUTIONS**

### Lent trafic growth
**Cause** : Pas assez d'articles / mauvaise SEO structure
**Solution** : Vérifier `skills/SEO.md` + augmenter publication cadence

### Données P2 incomplètes
**Cause** : Import partiels ou erreurs
**Solution** : Relancer `/p2-database` avec `--force-complete`

### Indexation Google lente
**Cause** : Autorité domaine faible, backlinks manquants
**Solution** : Vérifier GSC, submit sitemaps, vérifier crawlability

---

## 📞 **COMMANDES SLASH DISPONIBLES**

```bash
/p1-keywords        → Générer mots-clés SEO
/p2-database        → Importer données factuelles
/p3-mapping         → Structurer maillage interne
/p4-articles        → Générer articles (batch)
/p5-indexation      → Soumettre Google
/p6-monetisation    → [À exécuter à trigger]

/credit-check       → Vérifier budget tokens restants
/resume             → Résumé avancement complet
```

Voir [docs/commandes.md](docs/commandes.md) pour détails

---

## 📋 **CHECKLIST MISE À JOUR QUOTIDIENNE**

- [ ] Vérifier trafic Google Analytics (trend?)
- [ ] Vérifier indexation (GSC impressions)
- [ ] Vérifier articles en attente de publication
- [ ] **Si trafic ≥ 1000 vis/jour** → Notification critique ⚠️

---

## 📚 **LECTURES ESSENTIELLES (Par rôle)**

**Pour Adriano (propriétaire)** :
1. Ce fichier (DASHBOARD.md) ← Vous êtes ici
2. [STATE.md](STATE.md) ← Décisions + historique
3. [docs/feuille-de-route-monetisation.md](docs/feuille-de-route-monetisation.md) ← Quand passer Phase 1?

**Pour développeur/opérationnel** :
1. [docs/architecture-wordpress-dynamics.md](docs/architecture-wordpress-dynamics.md) ← Specs techniques
2. [scripts/setup-wordpress-cpts.php](scripts/setup-wordpress-cpts.php) ← Installation
3. [docs/checklist-lancement-monetisation.md](docs/checklist-lancement-monetisation.md) ← Exécution

**Pour marketing/contenu** :
1. [skills/SEO.md](skills/SEO.md) ← Stratégie contenu
2. [STATE.md](STATE.md) ← Où on en est
3. [docs/checklist-lancement-monetisation.md](docs/checklist-lancement-monetisation.md) ← Phase 1 placement CTAs

---

## ✨ **CONCEPT CLÉ**

> **Rien au hasard. Tout est préparé d'avance.**

- ✅ P1-P2-P3 complétés (données + keywords + structure)
- ✅ P4 en cours (articles production)
- ✅ P6 documentée et prête (4 phases monétisation)
- ✅ Architecture WordPress spécifiée (5 CPTs, ACF, API)
- ✅ Scripts d'installation prêts (one-click deployment)
- ✅ Execution checklist jour-par-jour (zéro décision à prendre)

**À partir du moment** où le trafic atteint **1000 vis/jour** :
- Jour 1-5 : Affiliation Vroomly live
- Sem 3-4 : Outils interactifs live
- Mois 5-8 : Marketplace propriétaire live
- Mois 9-12 : Subscriptions premium live

---

**Dernière mise à jour** : 2026-07-17 | **Prochaine mise à jour** : Après chaque action majeure

---

## 🔗 **Index Complet (Si besoin de plus de détails)**

- [CLAUDE.md](CLAUDE.md) — Instructions projet
- [STATE.md](STATE.md) — État avancement + historique
- [MEMORY.md](.claude/projects/C--Users-Rabary-Desktop-autoseo/memory/MEMORY.md) — Contexte utilisateur
- [docs/](docs/) — Tous les guides détaillés
- [skills/](skills/) — Guides opérationnels par domaine
- [scripts/](scripts/) — Implémentation technique
- [data/](data/) — Données P1-P2-P3

---

🚀 **Site en production. Monétisation prête. Aucun aléa.**

# Checklist Lancement Monétisation — Auto & Mobilité

**Déclencheur** : 🎯 Site atteint **1000 visiteurs/jour** (30-jours rolling average)

**Timeline totale** : ~3-4 semaines jusqu'à revenue live

---

## ⏱️ **PHASE 1 — Jour 1-5 (Affiliation Pure)**

### Jour 1 : Infrastructure WordPress

- [ ] **Exécuter le script CPTs**
  ```bash
  wp eval-file scripts/setup-wordpress-cpts.php
  ```
  Résultat attendu : 5 CPTs + taxonomies créés, ACF fields configurés

- [ ] **Vérifier installation**
  - [ ] `/wp-admin` → Pages → Modèles Auto (CPT auto_modele visible)
  - [ ] `/wp-admin` → Outils → Champs personnalisés (groupes ACF visibles)
  - [ ] `/wp-json/wp/v2/auto_modeles` répond en REST (test via Postman)

- [ ] **Activer plugins requis (si nécessaire)**
  - [ ] Advanced Custom Fields Pro (ACF)
  - [ ] Elementor Pro (pour templates dynamiques)
  - [ ] Gravity Forms (pour lead forms)

### Jour 2-3 : Importer Données P2

- [ ] **Exécuter script import**
  ```bash
  python scripts/import-p2-to-acf.py \
    --wordpress-url "https://monauto.fr" \
    --wp-user "admin" \
    --wp-password "$(wp eval 'echo WORDPRESS_PASSWORD;')" \
    --p2-path "data/factuel/"
  ```
  
  - [ ] Importer `marques-modeles-fiabilite-*.json` → CPT auto_modele
  - [ ] Importer `codes-obd-*.json` → CPT code_obd
  - [ ] Importer `entretien-croisement-prix-marques-*.json` → ACF repeater prestation_entretien
  
  Résultat attendu :
  - 450 posts auto_modele créés
  - 606 posts code_obd créés
  - 1000 entries prestation_entretien dans ACF

- [ ] **Vérifier import**
  ```bash
  # Compter posts créés
  wp post list --post_type=auto_modele --format=count
  # Expected: 450
  
  wp post list --post_type=code_obd --format=count
  # Expected: 606
  ```

### Jour 4 : Configurer Affiliation Vroomly

- [ ] **S'inscrire partenaire Vroomly**
  - [ ] Créer compte : https://partner.vroomly.com
  - [ ] Valider email + téléphone
  - [ ] Accepter conditions partenariat
  - [ ] Récupérer ID affiliation (ex: `aff_12345`)

- [ ] **Intégrer lien affiliation**
  - [ ] Copier lien unique : `https://vroomly.com/?aff=aff_12345`
  - [ ] Ajouter au shortcode `[lead-form]` (voir template ci-dessous)
  - [ ] Tester tracking : cliquer lien → cookie Vroomly set

- [ ] **Configurer Zapier (pour notifications leads)**
  - [ ] Créer compte Zapier : https://zapier.com
  - [ ] Créer Zap : Gravity Forms → Email
  - [ ] Test : soumettre formulaire test → email reçu

### Jour 5 : Mettre en live Calculateur Budget

- [ ] **Créer page `/budget/`**
  - [ ] Créer page WordPress "Calculateur Budget"
  - [ ] Assigner template `/templates/calculateur-budget.php`
  - [ ] Slug : `/budget/`
  - [ ] Publier

- [ ] **Tester calculateur**
  - [ ] Accéder : https://monauto.fr/budget/
  - [ ] Sélectionner Renault → Clio → 2020
  - [ ] Cliquer "Calculer"
  - [ ] Résultat : tableau budget moyen/pessimiste/optimiste
  - [ ] Formulaire lead visible → remplir → email Zapier reçu

- [ ] **Ajouter CTA sur articles existants**
  - [ ] Éditer 10-20 articles top-traffic (Google Analytics)
  - [ ] Ajouter widget en bas : "Calculer mon budget d'entretien" → lien `/budget/`
  - [ ] Publier

---

## ✅ **PHASE 1 SUCCESS CRITERIA**

- [ ] **Trafic** : 1000+ visiteurs/jour (vérifier GA)
- [ ] **Conversion** : ≥ 30 clics/jour vers Vroomly
- [ ] **Revenus** : ≥ 10 devis/jour accumulés chez Vroomly
- [ ] **RPM** : ≥ 20€ (20€ revenu pour 1000 visiteurs)
- [ ] **Zéro erreurs** : pas de 404, pas d'erreurs JavaScript console

**GO / NO-GO pour Phase 2** : Si RPM ≥ 20€ pendant 2 semaines → lancer Phase 2

---

## ⏱️ **PHASE 2 — Semaine 3-4 (Outils Interactifs)**

### Semaine 3 : Comparateur TCO

- [ ] **Créer page `/comparateur/`**
  - [ ] Créer page WordPress "Comparateur TCO"
  - [ ] Assigner template `/templates/comparateur-tco.php`
  - [ ] Slug : `/comparateur/`
  - [ ] Publier

- [ ] **Implémenter API endpoint**
  - [ ] Écrire `monauto_api_compare_tco()` dans `/wp-content/plugins/monauto-dynamics/api/endpoints.php`
  - [ ] Tester via Postman :
    ```
    POST /wp-json/monauto/v1/compare-tco
    {
      "marque1": "renault",
      "modele1": "clio",
      "marque2": "peugeot",
      "modele2": "208",
      "annees": 5
    }
    ```
  - [ ] Résultat : JSON avec TCO breakdown

- [ ] **Tester sur site**
  - [ ] Accéder : https://monauto.fr/comparateur/
  - [ ] Sélectionner 2 marques/modèles
  - [ ] Cliquer "Comparer"
  - [ ] Graphique + tableau rendu correctement

### Semaine 3 : Diagnostic OBD

- [ ] **Créer page `/diagnostic/`**
  - [ ] Créer page WordPress "Diagnostic OBD"
  - [ ] Assigner template `/templates/diagnostic-obd.php`
  - [ ] Slug : `/diagnostic/`
  - [ ] Publier

- [ ] **Implémenter API endpoint**
  - [ ] Écrire `monauto_api_diagnostic_obd()`
  - [ ] Tester via Postman :
    ```
    POST /wp-json/monauto/v1/diagnostic-obd
    {
      "code": "P0420",
      "marque": "renault",
      "modele": "clio"
    }
    ```

- [ ] **Tester sur site**
  - [ ] Accéder : https://monauto.fr/diagnostic/
  - [ ] Entrer code "P0420"
  - [ ] Sélectionner Renault
  - [ ] Résultat : causes + solutions + garages proches

### Semaine 4 : Intégrations + Optimisations

- [ ] **Ajouter outils sur articles**
  - [ ] Éditer articles sur coûts entretien
  - [ ] Ajouter widget : "Comparer avec une autre marque" → `/comparateur/`
  - [ ] Éditer articles sur pannes courantes
  - [ ] Ajouter widget : "Diagnostic OBD gratuit" → `/diagnostic/`

- [ ] **Setup email automation Zapier**
  - [ ] Gravity Forms → Brevo (ex-Sendinblue)
  - [ ] Email confirmation lead
  - [ ] Email 24h après : "Voici les garages recommandés"
  - [ ] Email 7j après : "Vous avez reçu X devis"

- [ ] **Vérifier analytics**
  - [ ] GA4 : taux conversion outil
  - [ ] Hotjar : où cliquent les users sur outils ?
  - [ ] Améliorer UX si conversion < 10%

---

## ✅ **PHASE 2 SUCCESS CRITERIA**

- [ ] **Outils live** : 3 outils fonctionnels (Calculateur, Comparateur, Diagnostic)
- [ ] **Trafic outils** : ≥ 500 outils views/jour
- [ ] **Conversion outil → lead** : ≥ 5%
- [ ] **RPM** : ≥ 50€ (augmenté 2.5x depuis Phase 1)
- [ ] **Leads** : ≥ 100 leads/jour

**GO / NO-GO pour Phase 3** : Si RPM ≥ 50€ ET 100+ leads/jour → lancer Phase 3

---

## ⏱️ **PHASE 3+ — Semaine 5+ (Marketplace Propriétaire)**

### Checklist résumée (voir `/docs/feuille-de-route-monetisation.md` pour détails)

- [ ] Créer CPT GARAGE_PARTENAIRE
- [ ] Intégration paiement Stripe
- [ ] Dashboard garage (login + gestion devis)
- [ ] Recrutement 50+ garages partenaires
- [ ] KPI tracker (garage performance)
- [ ] Support opérationnel (chat Crisp)

---

## 🚨 **PROBLÈMES COURANTS & SOLUTIONS**

### "Import P2 très lent"
**Solution** : 
- Batch size par défaut = 100. Réduire à 50 si timeout
- Désactiver plugins chats/analytics pendant import
- Relancer juste garages_partenaire si error

### "Outils ne répondent pas (404)"
**Solution** :
- Vérifier : `wp rewrite flush` (refresh permalinks)
- Vérifier : ACF fields existent (`wp acf-cli list-fields`)
- Vérifier : REST endpoints déclarés (`curl https://site/wp-json/monauto/v1/`)

### "Vroomly tracking ne marche pas"
**Solution** :
- Vérifier : aff ID correct dans lien
- Vérifier : cookies activés en développeur tools
- Tester : incognito (pas de cookies) → lien doit tracker uniquement sur landing Vroomly
- Contact Vroomly support si attribution nulle

### "Lead forms ne reçoivent pas emails"
**Solution** :
- Vérifier : Gravity Forms plugin actif
- Tester : remplir formulaire test → check email spam
- Vérifier : Zapier Zap active (check "runs" tab)
- Vérifier : SMTP WordPress configuré (WP Mail SMTP plugin)

---

## 📊 **MONITORING DASHBOARDS**

### Google Analytics 4 (Gratuit)

- [ ] Créer segment "Calculateur users"
  - Comportement → Événement `tool_view` avec paramètre `tool=budget`
  
- [ ] Créer segment "Lead converters"
  - Événement `lead_submit` 
  
- [ ] Dashboard : "Revenue by tool"
  - Tool views (Calculateur, Comparateur, Diagnostic)
  - Conversion rate (view → lead)
  - RPM par outil

### Vroomly Dashboard

- [ ] Vérifier chaque jour (première semaine)
  - Clics : https://partner.vroomly.com/stats/clicks
  - Demandes devis générées
  - Commission en attente de validation

### Zapier Logs

- [ ] Vérifier chaque zap
  - Runs ✅ / ❌
  - Emails envoyés vs. bounced
  - Latency (formulaire soumis → email reçu)

---

## 🎯 **KPI SEUILS D'ALERTE**

| KPI | Seuil OK | Seuil ALERTE | Action |
|-----|----------|---|---|
| **RPM** | ≥ 20€ (P1) / ≥ 50€ (P2) | < 10€ | Revoir UX, CTA placement |
| **Conversion outil** | ≥ 5% | < 2% | A/B test wording, timing |
| **Lead form completion** | ≥ 30% | < 15% | Form trop long ? Obligatoire pour peu ? |
| **Vroomly tracking** | 100% | < 80% | Check cookies, GDPR consent |
| **Email delivery** | ≥ 95% | < 90% | Spam issue ? Vérifier SPF/DKIM |

---

## 📋 **DOCUMENT DE HANDOVER (Après Phase 1)**

Si deléguation à opérationnel :

- [ ] Écrire guide "Ajouter nouveau garage" (formulaire inscription)
- [ ] Écrire guide "Relancer lead non-convertis"
- [ ] Créer dashboard finance (commission tracking)
- [ ] Nommer "responsable monétisation" (1 personne)

---

**Status Global** : 🟡 Prêt à déployer dès trigger (1000 vis/jour)

**Prochaine étape** : Attendre trafic → Jour 1 exécuter Phase 1

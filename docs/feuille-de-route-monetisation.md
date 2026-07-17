# Feuille de Route Monétisation — Auto & Mobilité

**Date création** : 2026-07-16  
**Dernière mise à jour** : 2026-07-16  
**Status** : 🟡 En attente traffic considérable  

---

## 📊 **Trigger de Lancement**

**Condition** : Lancer Phase 1 dès que le site atteint **1000 visiteurs/jour** (trafic considérable pour niche B2C auto FR)

**Indicateur** : Google Analytics 4 → 30-jour rolling average visiteurs/jour

---

## 🎯 **Phases de Monétisation**

### **PHASE 1 — Fondation Affiliation** (Mois 1-2 après trigger)
**Objectif** : Valider le modèle business avec zéro effort opérationnel  
**Revenu cible** : 500-1000€/mois  
**Charge** : 5 jours de travail

#### Qu'on fait
- ✅ Implémenter **Calculateur Budget Entretien** (outil dynamique)
  - CPT PRESTATION_ENTRETIEN + template `/budget/[marque]/[modele]/[annee]/`
  - API REST → calculs dynamiques
  - 39 marques × 100 modèles × 10 ans = 39k URLs générées
  
- ✅ Intégrer affiliation **Vroomly** (lien CTA "Demander devis")
  - Commission : 5-10% par devis accepté
  - Tracking via pixel Vroomly
  
- ✅ Lead magnet **"PDF Budget Entretien"**
  - Téléchargeable email opt-in
  - Auto-généré depuis les données P2
  
- ✅ Placement CTA en bas d'articles (100+ pages existantes)
  - "Calculer mon budget entretien"
  - "Demander un devis gratuit"

#### Métriques à tracker
- Clics vers Vroomly par jour
- Commissions reçues (dashboard Vroomly)
- Taux conversion visiteur → devis
- Revenu par 1000 visiteurs (RPM)

#### Success criteria
- RPM ≥ 20€ (= 20€ revenu pour 1000 visiteurs)
- 30 demandes devis/jour minimum
- Vroomly confirme attributions (pas de fraude)

---

### **PHASE 2 — Ecosystem Interactif** (Mois 3-4)
**Objectif** : Ajouter outils uniques pour augmenter engagement + revenus  
**Revenu cible** : 2000-5000€/mois  
**Charge** : 20 jours de travail

#### Qu'on fait
- ✅ **Comparateur TCO Dynamique**
  - CPT AUTO_MODELE + template `/comparateur/[marque1]-vs-[marque2]/`
  - Calcul : achat + entretien + carburant + assurance + dépréciation
  - CTA "Demander devis pour cette marque"
  - Impact SEO : nouvelles intents ("Renault vs. Peugeot coût")
  
- ✅ **Diagnostic OBD Interactif**
  - CPT CODE_OBD + template `/diagnostic/[code]/[marque]/[modele]/`
  - Récupère causes + solutions par marque
  - Maps garages locaux (via GARAGE_PARTENAIRE)
  - CTA "Prendre RDV chez garage X"
  
- ✅ **Lead magnets avancés**
  - "Checklist entretien par marque" (Notion embedée)
  - "Alerte pannes courantes" (SMS/Email)
  - "Guide pannes électriques" (PDF)
  
- ✅ **Intégration Zapier**
  - Lead form → Brevo (emailing automation)
  - Reminders : "Vous avez demandé un devis, voici les réponses"

#### Métriques à tracker
- Outil views par jour (Comparateur, Diagnostic, Calculateur)
- Taux conversion outil → lead
- Revenu par outil
- Engagement time (Hotjar heatmaps)

#### Success criteria
- 3 outils live + fonctionnels
- RPM ≥ 50€
- 100+ leads/jour générés
- Email open rate ≥ 25%

---

### **PHASE 3 — Marketplace Propriétaire** (Mois 5-8)
**Objectif** : Passer en modèle hybrid (affiliation + marketplace pour augmenter commission)  
**Revenu cible** : 10k-20k€/mois  
**Charge** : 40 jours de travail + support opérationnel

#### Qu'on fait
- ✅ **CPT GARAGE_PARTENAIRE**
  - Garage s'inscrit via formulaire WordPress
  - Propose tarifs par prestation (repeater ACF)
  - Accepte devis via dashboard WordPress
  - Évaluations/avis clients
  
- ✅ **Logique de matching devis**
  - Si garage partenaire nearby → priorité
  - Sinon → fallback affiliation Vroomly
  - Double revenu (commission partenaire 15-25% + affiliation)
  
- ✅ **Système paiement**
  - Stripe/PayPal pour paiement devis
  - Commission versée automatiquement à garage
  - Dashboard finance pour nous (comptabilité)
  
- ✅ **Support opérationnel**
  - Chat support (Crisp) pour garages
  - Modération avis clients
  - Dispute resolution si client/garage en désaccord

#### Métriques à tracker
- Nb garages partenaires actifs
- Nb devis marketplace vs. affiliation
- Taux de clôture (devis → réparation)
- Revenu marketplace vs. affiliation
- NPS (client satisfaction)

#### Success criteria
- 50+ garages partenaires
- 50% des leads → marketplace (vs. affiliation)
- Commission marketplace = 2x commission affiliation
- RPM ≥ 100€

---

### **PHASE 4 — Expansion Premium** (Mois 9-12)
**Objectif** : Ajouter services premium + subscription pour stabiliser revenus  
**Revenu cible** : 20k-50k€/mois  
**Charge** : 60 jours de travail + opérationnel continu

#### Qu'on fait
- ✅ **Subscription "Mon Budget Auto"**
  - Abonnement 9.99€/mois
  - Tracking entretien personnalisé
  - Alertes maintenance préventive
  - Historique réparations
  - Cible : 5% des visiteurs
  
- ✅ **Service "Expert Auto"**
  - Questions/réponses avec mécano certifié
  - 2€ par question (subscription possible 19.99€/mois illimité)
  
- ✅ **Publicités contextuelles**
  - Affichage pièces auto (partenariat eBay/Amazon Associates)
  - Assurances auto (partenariat LesFurets)
  - Carburant/électricité (GasBuddy équivalent FR)
  
- ✅ **B2B pour garagistes**
  - Listing premium marketplace (+50€/mois)
  - Landing page garage personnalisée
  - Intégration logiciel gestion garage (Synergiz, Argon2000)

#### Métriques à tracker
- Subscription churn rate
- LTV (lifetime value) client subscription
- Revenue per subscriber
- Ad CTR (click-through rate)
- B2B deal pipeline

#### Success criteria
- 1000+ subscribers actifs
- Churn rate < 5%/mois
- LTV subscription ≥ 100€
- Publicités génèrent 20% du revenu
- 10+ garages premium

---

## 💰 **Projections Financières**

### **Scénario Conservative** (1000 visiteurs/jour en Year 2)

| Phase | Durée | Visiteurs/jour | Revenu/mois | Revenu annuel |
|-------|-------|---|---|---|
| Phase 1 (Affiliation) | Mois 1-2 | 1k | 500€ | 3k€ |
| Phase 2 (Outils) | Mois 3-4 | 2k | 2k€ | 20k€ |
| Phase 3 (Marketplace) | Mois 5-8 | 5k | 10k€ | 80k€ |
| Phase 4 (Premium) | Mois 9-12 | 10k | 25k€ | 250k€ |
| **Total Year 2** | - | - | - | **353k€** |

### **Scénario Optimistic** (10k visiteurs/jour en Year 2)

| Phase | Durée | Visiteurs/jour | Revenu/mois | Revenu annuel |
|-------|-------|---|---|---|
| Phase 1 (Affiliation) | Mois 1-2 | 2k | 1k€ | 6k€ |
| Phase 2 (Outils) | Mois 3-4 | 5k | 8k€ | 80k€ |
| Phase 3 (Marketplace) | Mois 5-8 | 10k | 50k€ | 400k€ |
| Phase 4 (Premium) | Mois 9-12 | 15k | 150k€ | 1.2M€ |
| **Total Year 2** | - | - | - | **1.686M€** |

---

## 🛠️ **Dépendances Techniques**

Tous les CPTs, templates, APIs sont **documentés dans** `/docs/architecture-wordpress-dynamics.md`

Scripts d'implémentation :
- `/scripts/setup-wordpress-cpts.php` — créer les CPTs + champs ACF
- `/scripts/import-p2-to-acf.py` — importer P2 dans WordPress

**Prérequis** :
- ✅ WordPress Headless (REST API active)
- ✅ ACF Pro (repeaters, relationships)
- ✅ Elementor Pro (dynamic tags pour templates)
- ✅ Gravity Forms (formulaires leads)
- ✅ Zapier account (automation)

---

## 📅 **Timeline d'Exécution**

```
Traffic atteint 1000/jour
  ↓ (Jour 1-5)
Phase 1 — Implémenter Calculateur + Affiliation Vroomly
  ↓ (Semaine 2-3)
Valider RPM ≥ 20€
  ↓ (Jour 30)
Phase 2 — Ajouter Comparateur TCO + Diagnostic OBD
  ↓ (Semaine 6-8)
Valider RPM ≥ 50€ + 100+ leads/jour
  ↓ (Jour 90)
Phase 3 — Lancer Marketplace Propriétaire
  ↓ (Mois 5-8)
Recruter 50+ garages + stabiliser commission
  ↓ (Jour 180)
Phase 4 — Ajouter Subscriptions + Premium
  ↓ (Mois 9-12)
Équilibre revenu : 40% affiliation, 40% marketplace, 20% premium
  ↓ (Fin Year 2)
Revenu stabilisé 20k€+/mois
```

---

## ⚠️ **Risques & Mitigations**

| Risque | Probabilité | Mitigation |
|--------|---|---|
| **Taux conversion faible** (< 10 leads/jour) | Haute | A/B tester CTA wording, placement, timing. Si persiste → revoir UX |
| **Vroomly refuse partenariat** | Faible | Fallback : GoodMecano, IDGarages (même modèle) |
| **Garages ne paient pas devis** | Moyenne | Système paiement obligatoire (Stripe) avant livraison |
| **Churn subscription > 10%** | Moyenne | Feature releases mensuelles, support actif, pricing dynamique |
| **Concurrence lance copie** | Haute | Notre avantage = données P2 unique. Maintenir lead sur data quality |

---

## ✅ **Checklist Lancement Phase 1**

Voir `/docs/checklist-lancement-monetisation.md`

---

## 📞 **Questions / Décisions en Attente**

- [ ] Commission Vroomly confirmée (5-10% ?)
- [ ] Budget marketing Phase 1 (si traction lente)
- [ ] Quel PSP paiement ? (Stripe, Adyen, autre)
- [ ] Juridique : conditions générales, data privacy pour garages
- [ ] Support opérationnel : en-house ou freelance ?

---

**Statut Global** : 🟡 Documentation prête, implémentation en attente traffic 1k/jour

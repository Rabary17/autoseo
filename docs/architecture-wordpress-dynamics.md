# Architecture WordPress Dynamique — Specs Techniques

**Version** : 1.0  
**Date** : 2026-07-16  
**Status** : 🟡 Ready for implementation  

---

## 📦 **Custom Post Types (CPTs) à Créer**

### **1. AUTO_MODELE** — Véhicules / Modèles

```php
// wp-content/plugins/monauto-dynamics/cpts.php

register_post_type('auto_modele', [
  'label' => 'Modèles Auto',
  'public' => true,
  'show_in_rest' => true,
  'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
  'taxonomies' => ['marque', 'segment', 'motorisation'],
  'has_archive' => 'modeles',
  'rewrite' => ['slug' => 'modele/%marque%/%modele%/']
]);

// Taxonomies
register_taxonomy('marque', 'auto_modele', [
  'label' => 'Marque',
  'show_in_rest' => true,
  'rewrite' => ['slug' => 'marque']
]);

register_taxonomy('segment', 'auto_modele', [
  'label' => 'Segment',
  'hierarchical' => false,
  'show_in_rest' => true
]);

register_taxonomy('motorisation', 'auto_modele', [
  'label' => 'Motorisation',
  'show_in_rest' => true
]);
```

**Champs ACF (repeaters & relationships)** :
```
auto_modele
├── marque (text) — Renault, Peugeot, etc.
├── modele (text) — Clio, 208, etc.
├── annee_debut (number) — 2020
├── annee_fin (number) — 2026
├── motorisations (repeater)
│   ├── nom (essence/diesel/hybride/électrique)
│   ├── puissance_ch (number)
│   ├── conso_moyenne (number, L/100)
│   └── emissions_co2 (number)
├── prix_neuf (number) — €
├── depreciation_par_an (percentage)
├── score_fiabilite (slider, 1-10)
├── pannes_courantes (relationship → PANNE_COURANTE CPT)
│   └── ou repeater si pas de CPT dédié
├── couts_entretien_annuels (repeater)
│   ├── annee (2020, 2021, etc.)
│   ├── cost_moyen (number)
│   └── note (text)
├── image_voiture (image)
└── seo_description (textarea)
```

**Template** : `/templates/single-auto_modele.php`
```php
<?php
// Affiche fiche modèle avec :
// - Photo
// - Specs techniques (champs ACF)
// - Score fiabilité + pannes courantes
// - Coûts entretien annuels
// - CTA "Comparateur TCO"
// - CTA "Calculateur Budget"
// - Formulaire lead "Demander devis"
?>
```

---

### **2. PRESTATION_ENTRETIEN** — Services Auto

```php
register_post_type('prestation_entretien', [
  'label' => 'Prestations Entretien',
  'public' => true,
  'show_in_rest' => true,
  'supports' => ['title', 'editor', 'custom-fields'],
  'taxonomies' => ['categorie_prestation'],
  'has_archive' => 'prestations',
  'rewrite' => ['slug' => 'prestation/%categorie_prestation%/']
]);

register_taxonomy('categorie_prestation', 'prestation_entretien', [
  'label' => 'Catégorie',
  'hierarchical' => true,
  'show_in_rest' => true
]);
```

**Champs ACF** :
```
prestation_entretien
├── nom_prestation (text) — Vidange, Batterie, etc.
├── description_technique (wysiwyg)
├── frequence_km (number) — tous les 15000 km
├── duree_mo (number) — heures de main-d'oeuvre
├── prix_par_marque (repeater)
│   ├── marque (select → from MARQUE taxonomy)
│   ├── prix_ttc_min (number)
│   ├── prix_ttc_max (number)
│   └── garage_recommande (text, optionnel)
├── pieces_necessaires (repeater)
│   ├── nom (text)
│   ├── prix (number)
│   └── lien_achat (url)
├── difficulte_diy (select: facile/moyen/difficile)
├── risques_si_oublie (textarea)
├── video_tutorial (url/embed)
└── image_prestation (image)
```

**Template** : `/templates/single-prestation_entretien.php`
```php
<?php
// Affiche guide prestation avec :
// - Description technique
// - Coûts par marque (tableau)
// - Video tutoriel (si DIY)
// - Risques
// - CTA "Trouver un garage"
?>
```

---

### **3. CODE_OBD** — Diagnostic OBD-II

```php
register_post_type('code_obd', [
  'label' => 'Codes OBD',
  'public' => false, // Pas indexé seul
  'show_in_rest' => true,
  'supports' => ['title', 'editor', 'custom-fields'],
  'taxonomies' => ['categorie_obd']
]);

register_taxonomy('categorie_obd', 'code_obd', [
  'label' => 'Catégorie OBD',
  'show_in_rest' => true
]);
```

**Champs ACF** :
```
code_obd
├── code (text, unique) — P0420, P0101, etc.
├── libelle (text)
├── description (wysiwyg)
├── gravite (select: info/warning/danger)
├── causes_courantes (repeater)
│   ├── cause (text)
│   └── probabilite (percentage)
├── solutions_par_marque (repeater)
│   ├── marque (select)
│   ├── cout_moyen (number)
│   ├── solution (text)
│   └── garage_recommande_link (post → GARAGE_PARTENAIRE)
├── temps_diagnostic (number, min)
├── video_diagnostic (url/embed)
└── similar_codes (relationship → CODE_OBD)
```

**Accès** : Via API REST uniquement (pas de page publique)  
**Utilisation** : Outil Diagnostic OBD `/diagnostic/[code]/[marque]/[modele]/`

---

### **4. PANNE_COURANTE** — Pannes par Modèle

```php
register_post_type('panne_courante', [
  'label' => 'Pannes Courantes',
  'public' => false,
  'show_in_rest' => true,
  'supports' => ['title', 'editor', 'custom-fields']
]);
```

**Champs ACF** :
```
panne_courante
├── nom_panne (text)
├── marques_affectees (relationship → auto_modele)
├── signes_avant_coureurs (wysiwyg)
├── cout_reparation_moyen (number)
├── cout_reparation_min_max (repeater)
│   ├── marque (select)
│   ├── cout_min (number)
│   └── cout_max (number)
├── probabilite_par_km (repeater)
│   ├── km (50000, 100000, 150000)
│   └── probabilite (percentage)
├── solutions_diy_possible (boolean)
├── code_obd_associe (relationship → CODE_OBD)
└── video_tutorial (url/embed)
```

---

### **5. GARAGE_PARTENAIRE** — Garagistes (Phase 3+)

```php
register_post_type('garage_partenaire', [
  'label' => 'Garages Partenaires',
  'public' => true,
  'show_in_rest' => true,
  'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
  'has_archive' => 'garages',
  'rewrite' => ['slug' => 'garage/%ville%/']
]);

register_taxonomy('ville', 'garage_partenaire', [
  'label' => 'Ville',
  'show_in_rest' => true
]);
```

**Champs ACF** :
```
garage_partenaire
├── nom_garage (text)
├── adresse (text)
├── ville (taxonomy)
├── code_postal (text)
├── latitude (number)
├── longitude (number)
├── telephone (tel)
├── site_web (url)
├── horaires (repeater)
│   ├── jour (lun-dim)
│   └── heures (9h-18h)
├── specialites (repeater)
│   ├── marque (select)
│   └── services (multiselect: entretien/diagnostic/réparation)
├── tarifs_moyens (repeater)
│   ├── prestation (select → PRESTATION_ENTRETIEN)
│   └── prix (number)
├── commission_rate (percentage, 15-25%)
├── lien_affiliation (url, Vroomly/GoodMecano)
├── note_clients (slider, 1-5)
├── nb_avis (number)
├── avis_clients (repeater)
│   ├── auteur (text)
│   ├── note (slider)
│   ├── texte (textarea)
│   └── date (date)
├── statut_partenaire (select: actif/inactif/suspendu)
└── contrat_debut (date)
```

**Template** : `/templates/single-garage_partenaire.php`
```php
<?php
// Affiche fiche garage avec :
// - Maps géolocalisation
// - Horaires
// - Tarifs
// - Avis clients
// - CTA "Prendre RDV" (Zapier → email)
?>
```

---

## 🔌 **API REST Custom Endpoints**

Fichier : `wp-content/plugins/monauto-dynamics/api/endpoints.php`

### **POST /wp-json/monauto/v1/compare-tco**

```php
register_rest_route('monauto/v1', '/compare-tco', [
  'methods' => 'POST',
  'callback' => 'monauto_compare_tco',
  'permission_callback' => '__return_true'
]);

function monauto_compare_tco($request) {
  $params = $request->get_json_params();
  
  $marque1 = sanitize_text_field($params['marque1']);
  $modele1 = sanitize_text_field($params['modele1']);
  $marque2 = sanitize_text_field($params['marque2']);
  $modele2 = sanitize_text_field($params['modele2']);
  $annees = intval($params['annees']) ?? 5;
  
  // Récupère données P2
  $modele1_data = get_modele_data($marque1, $modele1);
  $modele2_data = get_modele_data($marque2, $modele2);
  
  if (!$modele1_data || !$modele2_data) {
    return new WP_Error('not_found', 'Modèle non trouvé');
  }
  
  // Calcule TCO
  $tco1 = calculate_tco($modele1_data, $annees);
  $tco2 = calculate_tco($modele2_data, $annees);
  
  // Récupère garages partenaires proches
  $user_location = geoip_detect2_get_client_location();
  $garages = get_nearby_garages(
    $user_location->latitude,
    $user_location->longitude,
    [$marque1, $marque2],
    20 // km
  );
  
  return [
    'modele1' => [
      'marque' => $marque1,
      'modele' => $modele1,
      'tco_total' => $tco1['total'],
      'breakdown' => $tco1['breakdown'] // achat, entretien, carburant, assurance, dépréciation
    ],
    'modele2' => [
      'marque' => $marque2,
      'modele' => $modele2,
      'tco_total' => $tco2['total'],
      'breakdown' => $tco2['breakdown']
    ],
    'difference' => $tco2['total'] - $tco1['total'],
    'winner' => $tco1['total'] < $tco2['total'] ? $marque1 : $marque2,
    'garages_nearby' => $garages
  ];
}
```

### **POST /wp-json/monauto/v1/diagnostic-obd**

```php
register_rest_route('monauto/v1', '/diagnostic-obd', [
  'methods' => 'POST',
  'callback' => 'monauto_diagnostic_obd',
  'permission_callback' => '__return_true'
]);

function monauto_diagnostic_obd($request) {
  $params = $request->get_json_params();
  
  $code = sanitize_text_field($params['code']); // P0420
  $marque = sanitize_text_field($params['marque']); // Renault
  $modele = sanitize_text_field($params['modele']); // Clio
  
  // Récupère CODE_OBD post
  $code_post = get_posts([
    'post_type' => 'code_obd',
    'meta_query' => [
      ['key' => 'code', 'value' => $code, 'compare' => '=']
    ]
  ])[0];
  
  if (!$code_post) {
    return new WP_Error('not_found', 'Code OBD non trouvé');
  }
  
  // Récupère solutions par marque
  $solutions = get_field('solutions_par_marque', $code_post->ID);
  $solution_for_marque = array_filter($solutions, fn($s) => $s['marque'] == $marque)[0] ?? null;
  
  // Récupère garages locaux
  $user_location = geoip_detect2_get_client_location();
  $garages = get_nearby_garages(
    $user_location->latitude,
    $user_location->longitude,
    [$marque],
    20
  );
  
  return [
    'code' => $code,
    'libelle' => get_field('libelle', $code_post->ID),
    'description' => get_field('description', $code_post->ID),
    'gravite' => get_field('gravite', $code_post->ID),
    'causes' => get_field('causes_courantes', $code_post->ID),
    'solution_for_marque' => $solution_for_marque,
    'cout_moyen' => $solution_for_marque['cout_moyen'] ?? null,
    'video' => get_field('video_diagnostic', $code_post->ID),
    'garages_nearby' => $garages,
    'cta' => [
      'text' => 'Prendre RDV chez un garage',
      'link' => '/garages/' . $marque . '/'
    ]
  ];
}
```

### **POST /wp-json/monauto/v1/calculate-budget**

```php
register_rest_route('monauto/v1', '/calculate-budget', [
  'methods' => 'POST',
  'callback' => 'monauto_calculate_budget',
  'permission_callback' => '__return_true'
]);

function monauto_calculate_budget($request) {
  $params = $request->get_json_params();
  
  $marque = sanitize_text_field($params['marque']);
  $modele = sanitize_text_field($params['modele']);
  $annee = intval($params['annee']);
  
  $modele_data = get_modele_data($marque, $modele);
  if (!$modele_data) {
    return new WP_Error('not_found', 'Modèle non trouvé');
  }
  
  $km_annuel = 15000; // Moyenne FR
  $budget = calculate_annual_budget($modele_data, $annee, $km_annuel);
  
  return [
    'marque' => $marque,
    'modele' => $modele,
    'annee' => $annee,
    'budget_moyen' => $budget['average'],
    'budget_pessimiste' => $budget['pessimistic'],
    'budget_optimiste' => $budget['optimistic'],
    'breakdown' => $budget['breakdown'], // [vidange, plaquettes, etc.]
    'pannes_courantes' => get_likely_pannes($modele_data, $annee),
    'cta' => [
      'text' => 'Recevoir un devis gratuit',
      'link' => '/form/devis-gratuit/?marque=' . $marque . '&modele=' . $modele
    ]
  ];
}
```

---

## 📄 **Templates Dynamiques**

### **1. `/templates/comparateur-tco.php`** (Outil Dynamique)

```php
<?php
/**
 * Template Comparateur TCO
 * URL pattern: /comparateur/[marque1]-vs-[marque2]/
 * Généré dynamiquement pour toutes les combinaisons marques×marques
 */

get_header();
?>

<div class="comparateur-tco-container">
  <h1>Comparer les coûts d'entretien</h1>
  
  <form id="form-compare-tco" class="compare-form">
    <div class="form-row">
      <div class="form-group">
        <label>Marque 1</label>
        <select name="marque1" id="marque1">
          <?php foreach (get_terms(['taxonomy' => 'marque']) as $term): ?>
            <option value="<?php echo $term->slug; ?>"><?php echo $term->name; ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      
      <div class="form-group">
        <label>Modèle 1</label>
        <select name="modele1" id="modele1">
          <!-- Chargé dynamiquement via JS -->
        </select>
      </div>
    </div>
    
    <div class="form-row">
      <div class="form-group">
        <label>Marque 2</label>
        <select name="marque2" id="marque2">
          <?php foreach (get_terms(['taxonomy' => 'marque']) as $term): ?>
            <option value="<?php echo $term->slug; ?>"><?php echo $term->name; ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      
      <div class="form-group">
        <label>Modèle 2</label>
        <select name="modele2" id="modele2">
          <!-- Chargé dynamiquement via JS -->
        </select>
      </div>
    </div>
    
    <button type="button" onclick="compareTCO()" class="btn-primary">
      Comparer les coûts
    </button>
  </form>
  
  <div id="result" class="tco-result">
    <!-- Rempli par JS après API call -->
  </div>
  
  <div class="cta-box">
    <h3>Intéressé ? Demandez un devis</h3>
    <a href="#lead-form" class="btn-cta">Demander un devis gratuit</a>
  </div>
</div>

<script>
async function compareTCO() {
  const marque1 = document.getElementById('marque1').value;
  const modele1 = document.getElementById('modele1').value;
  const marque2 = document.getElementById('marque2').value;
  const modele2 = document.getElementById('modele2').value;
  
  const response = await fetch('/wp-json/monauto/v1/compare-tco', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marque1, modele1, marque2, modele2, annees: 5 })
  });
  
  const data = await response.json();
  
  // Render chart + table
  document.getElementById('result').innerHTML = renderTCOResult(data);
}
</script>

<?php get_footer(); ?>
```

---

### **2. `/templates/diagnostic-obd.php`**

```php
<?php
/**
 * Template Diagnostic OBD Interactif
 * URL pattern: /diagnostic/[code]/[marque]/[modele]/
 */

get_header();
?>

<div class="diagnostic-obd-container">
  <h1>Diagnostic OBD — Code <?php echo sanitize_text_field($_GET['code']); ?></h1>
  
  <form id="form-diagnostic-obd" class="diagnostic-form">
    <div class="form-group">
      <label>Code OBD (ex: P0420)</label>
      <input type="text" name="code" placeholder="P0420" required>
    </div>
    
    <div class="form-group">
      <label>Marque de votre voiture</label>
      <select name="marque" required>
        <?php foreach (get_terms(['taxonomy' => 'marque']) as $term): ?>
          <option value="<?php echo $term->slug; ?>"><?php echo $term->name; ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    
    <button type="button" onclick="getDiagnosis()" class="btn-primary">
      Diagnostiquer
    </button>
  </form>
  
  <div id="diagnostic-result" class="diagnostic-result">
    <!-- Rempli par JS -->
  </div>
  
  <div class="nearby-garages">
    <h3>Garages recommandés près de chez vous</h3>
    <div id="garages-list">
      <!-- Chargé via JS -->
    </div>
  </div>
</div>

<?php get_footer(); ?>
```

---

### **3. `/templates/calculateur-budget.php`**

```php
<?php
/**
 * Template Calculateur Budget Entretien
 * URL pattern: /budget/[marque]/[modele]/[annee]/
 */

get_header();
?>

<div class="calculateur-budget-container">
  <h1>Calculer mon budget d'entretien</h1>
  
  <form id="form-budget" class="budget-form">
    <div class="form-row">
      <div class="form-group">
        <label>Marque</label>
        <select name="marque" required>
          <?php foreach (get_terms(['taxonomy' => 'marque']) as $term): ?>
            <option value="<?php echo $term->slug; ?>"><?php echo $term->name; ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      
      <div class="form-group">
        <label>Modèle</label>
        <select name="modele" required></select>
      </div>
      
      <div class="form-group">
        <label>Année d'achat</label>
        <input type="number" name="annee" min="2010" max="2026" required>
      </div>
    </div>
    
    <button type="button" onclick="calculateBudget()" class="btn-primary">
      Calculer
    </button>
  </form>
  
  <div id="budget-result" class="budget-result">
    <!-- Table avec moyens/pessimiste/optimiste -->
  </div>
  
  <div id="lead-form" class="lead-form-section">
    <h3>Intéressé par un devis ?</h3>
    <form id="lead-form-submit">
      <input type="hidden" name="marque" id="lead-marque">
      <input type="hidden" name="modele" id="lead-modele">
      <input type="email" name="email" placeholder="votre@email.com" required>
      <input type="tel" name="phone" placeholder="+33 6 xx xx xx xx">
      <button type="submit" class="btn-cta">Recevoir un devis gratuit</button>
    </form>
  </div>
</div>

<?php get_footer(); ?>
```

---

## 📊 **Schema de Base de Données (ACF)**

Tous les CPTs utilisent ACF pour stocker les données P2.

**Import P2 → WordPress** : Script Python `/scripts/import-p2-to-acf.py`

```python
# Pseudocode
import json
import requests

# Récupère données P2 (JSON files)
modeles = json.load(open('data/factuel/marques-modeles-fiabilite-lot*.json'))
codes_obd = json.load(open('data/factuel/codes-obd-lot*.json'))
croisements = json.load(open('data/factuel/entretien-croisement-prix-marques-echantillon.json'))

# Pour chaque modèle
for modele in modeles:
  post_data = {
    'post_type': 'auto_modele',
    'post_title': f"{modele['marque']} {modele['modele']}",
    'post_content': f"Fiche technique {modele['marque']} {modele['modele']}",
    'meta': {
      'marque': modele['marque'],
      'modele': modele['modele'],
      'score_fiabilite': modele['score_fiabilite'],
      'pannes_courantes': modele['pannes_courantes'],
      # etc.
    }
  }
  
  # POST /wp-json/wp/v2/auto_modele
  requests.post(f'{WP_URL}/wp-json/wp/v2/auto_modele', json=post_data, auth=(WP_USER, WP_PASS))

# Même logique pour codes OBD, croisements, etc.
```

---

## ✅ **Checklist Implémentation**

- [ ] CPT `auto_modele` créé + champs ACF
- [ ] CPT `prestation_entretien` créé + champs ACF
- [ ] CPT `code_obd` créé + champs ACF
- [ ] CPT `panne_courante` créé + champs ACF
- [ ] CPT `garage_partenaire` créé + champs ACF
- [ ] API endpoints (compare-tco, diagnostic-obd, calculate-budget)
- [ ] Templates dynamiques (comparateur, diagnostic, calculateur)
- [ ] Script import P2 → WordPress testé
- [ ] Tests E2E sur chaque outil
- [ ] Déploiement sur production

---

**Prêt pour implémentation Phase 1 dès trigger (1000 visiteurs/jour).**

<?php
/**
 * Setup WordPress CPTs & ACF Fields pour la monétisation
 *
 * Usage : Exécuter une fois via /wp-admin/admin.php?page=setup-cpts
 * Ou : wp eval-file scripts/setup-wordpress-cpts.php (WP-CLI)
 *
 * Crée :
 * - 5 CPTs (auto_modele, prestation_entretien, code_obd, panne_courante, garage_partenaire)
 * - Taxonomies (marque, segment, motorisation, categorie_prestation, categorie_obd)
 * - Champs ACF pour chaque CPT
 * - API REST endpoints
 */

// ============================================================================
// 1. REGISTER CPTs & TAXONOMIES
// ============================================================================

add_action('init', function() {

  // AUTO_MODELE
  register_post_type('auto_modele', [
    'label' => 'Modèles Auto',
    'public' => true,
    'publicly_queryable' => true,
    'show_ui' => true,
    'show_in_nav_menus' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'thumbnail', 'custom-fields', 'revisions'],
    'taxonomies' => ['marque', 'segment', 'motorisation'],
    'has_archive' => 'modeles',
    'rewrite' => [
      'slug' => 'modele',
      'with_front' => true,
      'hierarchical' => false
    ],
    'menu_icon' => 'dashicons-car',
    'rest_base' => 'auto_modeles'
  ]);

  // PRESTATION_ENTRETIEN
  register_post_type('prestation_entretien', [
    'label' => 'Prestations Entretien',
    'public' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
    'taxonomies' => ['categorie_prestation'],
    'has_archive' => 'prestations',
    'rewrite' => ['slug' => 'prestation'],
    'menu_icon' => 'dashicons-tools',
    'rest_base' => 'prestations'
  ]);

  // CODE_OBD
  register_post_type('code_obd', [
    'label' => 'Codes OBD',
    'public' => false, // Pas de page publique
    'show_ui' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'custom-fields'],
    'taxonomies' => ['categorie_obd'],
    'menu_icon' => 'dashicons-admin-generic',
    'rest_base' => 'codes-obd'
  ]);

  // PANNE_COURANTE
  register_post_type('panne_courante', [
    'label' => 'Pannes Courantes',
    'public' => false,
    'show_ui' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'custom-fields'],
    'menu_icon' => 'dashicons-warning',
    'rest_base' => 'pannes'
  ]);

  // GARAGE_PARTENAIRE
  register_post_type('garage_partenaire', [
    'label' => 'Garages Partenaires',
    'public' => true,
    'show_in_rest' => true,
    'supports' => ['title', 'editor', 'thumbnail', 'custom-fields'],
    'taxonomies' => ['ville'],
    'has_archive' => 'garages',
    'rewrite' => ['slug' => 'garage'],
    'menu_icon' => 'dashicons-location-alt',
    'rest_base' => 'garages'
  ]);

  // ===== TAXONOMIES =====

  // MARQUE (partagée entre auto_modele & prestation_entretien)
  register_taxonomy('marque', ['auto_modele', 'prestation_entretien'], [
    'label' => 'Marque Auto',
    'hierarchical' => false,
    'public' => true,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'marque']
  ]);

  // SEGMENT (citadine, berline, SUV, etc.)
  register_taxonomy('segment', 'auto_modele', [
    'label' => 'Segment Véhicule',
    'hierarchical' => false,
    'public' => true,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'segment']
  ]);

  // MOTORISATION (essence, diesel, hybride, électrique)
  register_taxonomy('motorisation', 'auto_modele', [
    'label' => 'Motorisation',
    'hierarchical' => false,
    'public' => true,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'motorisation']
  ]);

  // CATEGORIE_PRESTATION (moteur, freins, électrique, etc.)
  register_taxonomy('categorie_prestation', 'prestation_entretien', [
    'label' => 'Catégorie Prestation',
    'hierarchical' => true,
    'public' => true,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'prestation-categorie']
  ]);

  // CATEGORIE_OBD (moteur, transmission, électrique, etc.)
  register_taxonomy('categorie_obd', 'code_obd', [
    'label' => 'Catégorie OBD',
    'hierarchical' => true,
    'public' => false,
    'show_in_rest' => true
  ]);

  // VILLE (pour garages)
  register_taxonomy('ville', 'garage_partenaire', [
    'label' => 'Ville',
    'hierarchical' => false,
    'public' => true,
    'show_in_rest' => true,
    'rewrite' => ['slug' => 'garage-ville']
  ]);

}, 0);

// ============================================================================
// 2. REGISTER ACF FIELD GROUPS (require ACF Pro)
// ============================================================================

add_action('acf/init', function() {

  if (!function_exists('acf_add_local_field_group')) {
    error_log('❌ ACF Pro est requis pour cette installation');
    return;
  }

  // ===== AUTO_MODELE FIELDS =====
  acf_add_local_field_group([
    'key' => 'group_auto_modele',
    'title' => 'Données Modèle Auto',
    'fields' => [
      [
        'key' => 'field_marque',
        'label' => 'Marque',
        'name' => 'marque',
        'type' => 'text',
        'required' => 1
      ],
      [
        'key' => 'field_modele',
        'label' => 'Modèle',
        'name' => 'modele',
        'type' => 'text',
        'required' => 1
      ],
      [
        'key' => 'field_annee_debut',
        'label' => 'Année Début',
        'name' => 'annee_debut',
        'type' => 'number'
      ],
      [
        'key' => 'field_annee_fin',
        'label' => 'Année Fin',
        'name' => 'annee_fin',
        'type' => 'number'
      ],
      [
        'key' => 'field_motorisations',
        'label' => 'Motorisations',
        'name' => 'motorisations',
        'type' => 'repeater',
        'sub_fields' => [
          [
            'key' => 'field_mot_nom',
            'label' => 'Nom',
            'name' => 'nom',
            'type' => 'select',
            'choices' => [
              'essence' => 'Essence',
              'diesel' => 'Diesel',
              'hybride' => 'Hybride',
              'electrique' => 'Électrique',
              'gpl' => 'GPL',
              'gnv' => 'GNV'
            ]
          ],
          [
            'key' => 'field_mot_puissance',
            'label' => 'Puissance (ch)',
            'name' => 'puissance_ch',
            'type' => 'number'
          ],
          [
            'key' => 'field_mot_conso',
            'label' => 'Consommation (L/100)',
            'name' => 'conso_moyenne',
            'type' => 'number',
            'step' => 0.1
          ]
        ]
      ],
      [
        'key' => 'field_prix_neuf',
        'label' => 'Prix Neuf (€)',
        'name' => 'prix_neuf',
        'type' => 'number'
      ],
      [
        'key' => 'field_depreciation',
        'label' => 'Dépréciation Annuelle (%)',
        'name' => 'depreciation_par_an',
        'type' => 'number',
        'step' => 0.1
      ],
      [
        'key' => 'field_score_fiabilite',
        'label' => 'Score Fiabilité (1-10)',
        'name' => 'score_fiabilite',
        'type' => 'range',
        'min' => 1,
        'max' => 10
      ],
      [
        'key' => 'field_pannes_courantes_repeater',
        'label' => 'Pannes Courantes',
        'name' => 'pannes_courantes',
        'type' => 'repeater',
        'sub_fields' => [
          [
            'key' => 'field_panne_nom',
            'label' => 'Nom de la Panne',
            'name' => 'nom',
            'type' => 'text'
          ],
          [
            'key' => 'field_panne_cout',
            'label' => 'Coût Réparation Moyen (€)',
            'name' => 'cout_moyen',
            'type' => 'number'
          ],
          [
            'key' => 'field_panne_prob_km',
            'label' => 'Probabilité Alerte à (km)',
            'name' => 'probabilite_km',
            'type' => 'number'
          ]
        ]
      ]
    ],
    'location' => [
      [
        [
          'param' => 'post_type',
          'operator' => '==',
          'value' => 'auto_modele'
        ]
      ]
    ]
  ]);

  // ===== PRESTATION_ENTRETIEN FIELDS =====
  acf_add_local_field_group([
    'key' => 'group_prestation',
    'title' => 'Données Prestation',
    'fields' => [
      [
        'key' => 'field_prest_nom',
        'label' => 'Nom Prestation',
        'name' => 'nom_prestation',
        'type' => 'text',
        'required' => 1
      ],
      [
        'key' => 'field_prest_description',
        'label' => 'Description Technique',
        'name' => 'description_technique',
        'type' => 'wysiwyg'
      ],
      [
        'key' => 'field_prest_freq_km',
        'label' => 'Fréquence (tous les X km)',
        'name' => 'frequence_km',
        'type' => 'number'
      ],
      [
        'key' => 'field_prest_duree_mo',
        'label' => 'Durée Main-d\'Oeuvre (heures)',
        'name' => 'duree_mo',
        'type' => 'number',
        'step' => 0.5
      ],
      [
        'key' => 'field_prest_prix_marques',
        'label' => 'Prix par Marque',
        'name' => 'prix_par_marque',
        'type' => 'repeater',
        'sub_fields' => [
          [
            'key' => 'field_ppm_marque',
            'label' => 'Marque',
            'name' => 'marque',
            'type' => 'taxonomy',
            'taxonomy' => 'marque'
          ],
          [
            'key' => 'field_ppm_min',
            'label' => 'Prix Min TTC (€)',
            'name' => 'prix_ttc_min',
            'type' => 'number'
          ],
          [
            'key' => 'field_ppm_max',
            'label' => 'Prix Max TTC (€)',
            'name' => 'prix_ttc_max',
            'type' => 'number'
          ]
        ]
      ],
      [
        'key' => 'field_prest_difficulte',
        'label' => 'Difficulté DIY',
        'name' => 'difficulte_diy',
        'type' => 'select',
        'choices' => [
          'facile' => 'Facile',
          'moyen' => 'Moyen',
          'difficile' => 'Difficile'
        ]
      ]
    ],
    'location' => [
      [
        [
          'param' => 'post_type',
          'operator' => '==',
          'value' => 'prestation_entretien'
        ]
      ]
    ]
  ]);

  // ===== CODE_OBD FIELDS =====
  acf_add_local_field_group([
    'key' => 'group_code_obd',
    'title' => 'Données Code OBD',
    'fields' => [
      [
        'key' => 'field_code_value',
        'label' => 'Code OBD',
        'name' => 'code',
        'type' => 'text',
        'required' => 1
      ],
      [
        'key' => 'field_code_libelle',
        'label' => 'Libellé',
        'name' => 'libelle',
        'type' => 'text'
      ],
      [
        'key' => 'field_code_gravite',
        'label' => 'Gravité',
        'name' => 'gravite',
        'type' => 'select',
        'choices' => [
          'info' => 'Info',
          'warning' => 'Attention',
          'danger' => 'Danger'
        ]
      ],
      [
        'key' => 'field_code_causes',
        'label' => 'Causes Courantes',
        'name' => 'causes_courantes',
        'type' => 'repeater',
        'sub_fields' => [
          [
            'key' => 'field_cause_text',
            'label' => 'Cause',
            'name' => 'cause',
            'type' => 'text'
          ],
          [
            'key' => 'field_cause_prob',
            'label' => 'Probabilité (%)',
            'name' => 'probabilite',
            'type' => 'number'
          ]
        ]
      ],
      [
        'key' => 'field_code_solutions',
        'label' => 'Solutions par Marque',
        'name' => 'solutions_par_marque',
        'type' => 'repeater',
        'sub_fields' => [
          [
            'key' => 'field_sol_marque',
            'label' => 'Marque',
            'name' => 'marque',
            'type' => 'text'
          ],
          [
            'key' => 'field_sol_cout',
            'label' => 'Coût Moyen (€)',
            'name' => 'cout_moyen',
            'type' => 'number'
          ],
          [
            'key' => 'field_sol_solution',
            'label' => 'Solution',
            'name' => 'solution',
            'type' => 'textarea'
          ]
        ]
      ]
    ],
    'location' => [
      [
        [
          'param' => 'post_type',
          'operator' => '==',
          'value' => 'code_obd'
        ]
      ]
    ]
  ]);

  // ===== GARAGE_PARTENAIRE FIELDS =====
  acf_add_local_field_group([
    'key' => 'group_garage',
    'title' => 'Données Garage Partenaire',
    'fields' => [
      [
        'key' => 'field_garage_nom',
        'label' => 'Nom Garage',
        'name' => 'nom_garage',
        'type' => 'text',
        'required' => 1
      ],
      [
        'key' => 'field_garage_adresse',
        'label' => 'Adresse',
        'name' => 'adresse',
        'type' => 'text'
      ],
      [
        'key' => 'field_garage_codepostal',
        'label' => 'Code Postal',
        'name' => 'code_postal',
        'type' => 'text'
      ],
      [
        'key' => 'field_garage_lat',
        'label' => 'Latitude',
        'name' => 'latitude',
        'type' => 'number',
        'step' => 0.000001
      ],
      [
        'key' => 'field_garage_lng',
        'label' => 'Longitude',
        'name' => 'longitude',
        'type' => 'number',
        'step' => 0.000001
      ],
      [
        'key' => 'field_garage_phone',
        'label' => 'Téléphone',
        'name' => 'telephone',
        'type' => 'text'
      ],
      [
        'key' => 'field_garage_commission',
        'label' => 'Commission (%)',
        'name' => 'commission_rate',
        'type' => 'number',
        'step' => 0.1,
        'min' => 5,
        'max' => 50
      ],
      [
        'key' => 'field_garage_note',
        'label' => 'Note Clients (1-5)',
        'name' => 'note_clients',
        'type' => 'range',
        'min' => 1,
        'max' => 5
      ]
    ],
    'location' => [
      [
        [
          'param' => 'post_type',
          'operator' => '==',
          'value' => 'garage_partenaire'
        ]
      ]
    ]
  ]);

}, 20);

// ============================================================================
// 3. REGISTER REST API ENDPOINTS
// ============================================================================

add_action('rest_api_init', function() {

  // Compare TCO Endpoint
  register_rest_route('monauto/v1', '/compare-tco', [
    'methods' => 'POST',
    'callback' => 'monauto_api_compare_tco',
    'permission_callback' => '__return_true',
    'args' => [
      'marque1' => ['required' => true, 'type' => 'string'],
      'modele1' => ['required' => true, 'type' => 'string'],
      'marque2' => ['required' => true, 'type' => 'string'],
      'modele2' => ['required' => true, 'type' => 'string'],
      'annees' => ['type' => 'integer', 'default' => 5]
    ]
  ]);

  // Diagnostic OBD Endpoint
  register_rest_route('monauto/v1', '/diagnostic-obd', [
    'methods' => 'POST',
    'callback' => 'monauto_api_diagnostic_obd',
    'permission_callback' => '__return_true',
    'args' => [
      'code' => ['required' => true, 'type' => 'string'],
      'marque' => ['required' => true, 'type' => 'string'],
      'modele' => ['type' => 'string']
    ]
  ]);

  // Calculate Budget Endpoint
  register_rest_route('monauto/v1', '/calculate-budget', [
    'methods' => 'POST',
    'callback' => 'monauto_api_calculate_budget',
    'permission_callback' => '__return_true',
    'args' => [
      'marque' => ['required' => true, 'type' => 'string'],
      'modele' => ['required' => true, 'type' => 'string'],
      'annee' => ['required' => true, 'type' => 'integer']
    ]
  ]);

});

// ============================================================================
// 4. API CALLBACKS (Helpers)
// ============================================================================

function monauto_api_compare_tco($request) {
  // TODO: Implémentation dans monauto-dynamics/api/endpoints.php
  return new WP_REST_Response([
    'status' => 'not_implemented',
    'message' => 'Endpoint en construction'
  ], 501);
}

function monauto_api_diagnostic_obd($request) {
  // TODO: Implémentation
  return new WP_REST_Response([
    'status' => 'not_implemented'
  ], 501);
}

function monauto_api_calculate_budget($request) {
  // TODO: Implémentation
  return new WP_REST_Response([
    'status' => 'not_implemented'
  ], 501);
}

// ============================================================================
// 5. SETUP SUCCESS NOTIFICATION
// ============================================================================

add_action('admin_notices', function() {
  if (get_option('monauto_cpts_installed')) {
    echo '<div class="notice notice-success is-dismissible"><p>';
    echo '✅ <strong>MonAuto CPTs & ACF Fields installés avec succès!</strong><br>';
    echo 'CPTs créés: auto_modele, prestation_entretien, code_obd, panne_courante, garage_partenaire<br>';
    echo 'Taxonomies créées: marque, segment, motorisation, categorie_prestation, categorie_obd, ville<br>';
    echo 'Prochaine étape: <a href="#">Importer les données P2</a> via <code>scripts/import-p2-to-acf.py</code>';
    echo '</p></div>';
  }
});

// Marquer comme installé
if (!get_option('monauto_cpts_installed')) {
  add_option('monauto_cpts_installed', true);
}

// ============================================================================
// FIN
// ============================================================================
?>

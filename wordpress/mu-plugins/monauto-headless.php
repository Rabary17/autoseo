<?php
/**
 * Plugin Name: monauto — Headless Bridge
 * Description: Dynamisation headless du cocon monauto : champs ACF (article/auteur),
 *              exposition REST, sécurisation du back-office, webhook de rebuild
 *              vers le frontend Next.js à chaque publication.
 * Author: autoseo
 */

if (!defined('ABSPATH')) exit;

/* ==========================================================================
   0. Tailles d'image — uniquement celles réellement utilisées par le front
      Next.js (voir docs/architecture-headless.md section 9 pour le détail
      des mesures CSS ayant déterminé ces dimensions) :
      - monauto_card : cartes article (accueil, catégorie, page auteur)
      - monauto_hero : image à la une de l'article (LCP)
      Les deux en 16:10 recadré, dimensionnées pour couvrir l'affichage le
      plus large en écran rétine (x2) sans jamais servir un original surdimensionné.
   ========================================================================== */

// Hook 'plugins_loaded' priorité 1 (pas 'after_setup_theme', trop tardif) :
// Imagify calcule et met en cache (variable statique, le temps de la requête)
// la plus grande taille d'image *enregistrée* dès son propre chargement, pour
// valider son réglage "largeur max de redimensionnement". Si notre nettoyage
// de tailles arrive après cette première lecture, Imagify garde l'ancienne
// valeur (2048) pour le reste de la requête même si les tailles ont changé
// entre-temps. Priorité 1 : juste après l'enregistrement des tailles par
// défaut de WP core (_wp_add_additional_image_sizes, priorité 0), et avant
// le chargement du reste des plugins.
add_action('plugins_loaded', function () {
	add_image_size('monauto_card', 800, 500, true);
	add_image_size('monauto_hero', 1600, 1000, true);
	// WP core enregistre par défaut '1536x1536' et '2048x2048' (les tailles
	// "scaled") même sans thème actif — les retirer complètement (pas
	// seulement empêcher leur génération) est nécessaire pour qu'Imagify
	// accepte un seuil de redimensionnement à 1600px : sa validation refuse
	// une valeur inférieure à la plus grande taille *enregistrée*, pas
	// seulement générée (voir get_imagify_max_intermediate_image_size()).
	remove_image_size('1536x1536');
	remove_image_size('2048x2048');
}, 1);

// Retire les tailles WordPress par défaut non utilisées par le front — sans
// ça, chaque upload générait aussi medium/medium_large/large pour rien
// (espace disque + travail de compression Imagify inutiles).
add_filter('intermediate_image_sizes_advanced', function ($sizes) {
	unset($sizes['medium'], $sizes['medium_large'], $sizes['large']);
	return $sizes;
});

// WordPress conserve par défaut une copie "scaled" de tout original de plus
// de 2560px de large. Notre taille la plus grande (monauto_hero) est 1600px
// large — inutile de garder un original plus grand que ça.
add_filter('big_image_size_threshold', fn() => 1600);

/* ==========================================================================
   0bis. Imagify — compression + conversion WebP automatique à l'upload.
   Configure tout ce qui ne nécessite PAS la clé API (compression réelle
   impossible sans elle). La clé API doit être créée et renseignée par
   l'utilisateur lui-même dans Réglages > Imagify (jamais par un agent —
   voir règles de sécurité du projet), gratuite sur https://app.imagify.io.
   ========================================================================== */

add_action('init', function () {
	if (!class_exists('Imagify_Options')) return;

	$options = Imagify_Options::get_instance();
	$desired = [
		'auto_optimize'       => 1,    // optimise automatiquement chaque upload
		'backup'              => 1,    // garde l'original (retour arrière possible)
		'optimization_level'  => 1,    // "aggressive" — bon compromis qualité/poids (0=normal, 1=aggressive, 2=ultra)
		'resize_larger'       => 1,    // redimensionne tout original plus large que...
		'resize_larger_w'     => 1600, // ...notre plus grande taille réelle (monauto_hero)
		'convert_to_webp'     => 1,
		'optimization_format' => 'webp',
		'display_webp'        => 1,
		'display_webp_method' => 'picture', // <picture> avec repli natif, pas de réécriture serveur requise
	];

	// N'écrit en base que s'il y a un vrai écart — évite une réécriture de
	// l'option à chaque chargement d'une page wp-admin.
	$current = $options->get_all();
	$diff = array_diff_assoc($desired, array_intersect_key($current, $desired));
	if ($diff) {
		$options->set($desired);
	}
});

add_action('acf/init', function () {
	if (!function_exists('acf_add_local_field_group')) return;

	// -- Article + hub/sous-hub (post types "post" ET "page") : TL;DR + sources
	// vérifiables (GEO/EEAT). Les hubs/sous-hubs sont créés comme des pages WP
	// (voir scripts/autopublish/run.js, wp.createPage) — sans la règle de
	// localisation "page" ci-dessous, acf_fields envoyés à la création (tldr,
	// sources, faq) étaient silencieusement ignorés par ACF (aucun groupe de
	// champs ne s'appliquant à ce post type), constaté le 2026-07-22 sur les 2
	// premières pages hub/sous-hub réellement publiées.
	acf_add_local_field_group([
		'key' => 'group_monauto_article',
		'title' => 'monauto — Article',
		'fields' => [
			[
				'key' => 'field_monauto_tldr',
				'label' => "L'essentiel (TL;DR)",
				'name' => 'tldr',
				'type' => 'textarea',
				'instructions' => 'Réponse directe en 2-4 phrases, affichée en tête d\'article (voir skills/geo.md section 2).',
				'rows' => 3,
				'required' => 0,
			],
			[
				// ACF Free n'a pas de champ Repeater (PRO uniquement) : une source par
				// ligne, format "Libellé | URL". Parsé côté Next.js (lib/wp.ts).
				'key' => 'field_monauto_sources',
				'label' => 'Sources',
				'name' => 'sources',
				'type' => 'textarea',
				'instructions' => 'Une source par ligne, format "Libellé | URL" — voir skills/geo.md section 4.',
				'rows' => 3,
			],
			[
				// FAQ optionnelle, alimente le schema FAQPage (GEO — voir skills/geo.md
				// section 3). Une question par ligne, format "Question ? | Réponse."
				'key' => 'field_monauto_faq',
				'label' => 'FAQ',
				'name' => 'faq',
				'type' => 'textarea',
				'instructions' => 'Optionnel. Une question par ligne, format "Question ? | Réponse." — les questions/réponses doivent apparaître à l\'identique dans le texte visible (voir skills/geo.md section 3).',
				'rows' => 4,
			],
			[
				// Distinct du titre H1 (post_title) — pensé pour le SERP (mot-clé en
				// tête, ≤60 caractères), pas pour la lecture éditoriale. Jusqu'au
				// 2026-07-28, généré par le pipeline mais jamais persisté ni consommé
				// par le frontend (qui dérivait <title> du H1) — corrigé ce jour,
				// voir frontend/monauto/app/[slug]/page.tsx et app/categorie/[...slug]/page.tsx.
				'key' => 'field_monauto_meta_title',
				'label' => 'Titre SEO (balise <title>)',
				'name' => 'meta_title',
				'type' => 'text',
				'instructions' => 'Distinct du titre H1 — mot-clé principal en tête, ≤ 60 caractères. Utilisé pour la balise <title>/Open Graph, jamais affiché dans le corps de la page.',
				'maxlength' => 60,
			],
			[
				// Distinct de l'extrait (post_excerpt/tldr) — rédigée pour inciter au
				// clic dans les résultats de recherche, pas comme un simple résumé.
				// Même historique que meta_title ci-dessus (non branché avant le 2026-07-28).
				'key' => 'field_monauto_meta_description',
				'label' => 'Meta description SEO',
				'name' => 'meta_description',
				'type' => 'textarea',
				'instructions' => '≤ 155 caractères, incite au clic, mentionne un chiffre/donnée réelle si pertinent. Utilisée pour <meta name="description">/Open Graph, jamais affichée dans le corps de la page.',
				'rows' => 2,
				'maxlength' => 155,
			],
		],
		'location' => [
			[['param' => 'post_type', 'operator' => '==', 'value' => 'post']],
			[['param' => 'post_type', 'operator' => '==', 'value' => 'page']],
		],
		'show_in_rest' => 1,
	]);

	// -- Utilisateur (auteur) : intitulé de poste + profils vérifiables (Person/sameAs) --
	acf_add_local_field_group([
		'key' => 'group_monauto_author',
		'title' => 'monauto — Auteur',
		'fields' => [
			[
				'key' => 'field_monauto_job_title',
				'label' => 'Intitulé de poste',
				'name' => 'job_title',
				'type' => 'text',
				'instructions' => 'Ex. "Mécanicien, spécialiste entretien & révision" — jamais de titre réglementé non détenu (voir skills/wordpress-publication.md section 4).',
			],
			[
				// ACF Free n'a pas de champ Repeater : une URL par ligne.
				'key' => 'field_monauto_same_as',
				'label' => 'Profils vérifiables (sameAs)',
				'name' => 'same_as',
				'type' => 'textarea',
				'instructions' => 'Une URL par ligne (LinkedIn, profil auteur sur un autre site...).',
				'rows' => 3,
			],
		],
		'location' => [[['param' => 'user_form', 'operator' => '==', 'value' => 'edit']]],
		'show_in_rest' => 1,
	]);
});

/* ==========================================================================
   2. Exposition REST
   ========================================================================== */

// Note : ACF (depuis la v6) expose et accepte déjà nativement le champ "acf"
// sur /wp/v2/users pour un groupe de champs en location "user_form" avec
// show_in_rest activé — aucun register_rest_field manuel nécessaire ici.
// Le champ "same_as" est stocké en texte (une URL par ligne, ACF Free n'a pas
// de Repeater) : Next.js le découpe en tableau à la lecture (lib/wp.ts).

// Description utilisateur (bio) : le schéma core l'expose déjà en context "edit"
// (authentifié) via /wp/v2/users?context=edit ; on la republie aussi en context
// "view" pour un fetch anonyme depuis le build Next.js (contenu public, pas
// besoin d'auth). Un filtre plutôt qu'un register_rest_field additionnel, pour
// ne pas entrer en conflit avec le champ "description" déjà déclaré par WP core.
add_filter('rest_prepare_user', function ($response, $user) {
	$data = $response->get_data();
	if (empty($data['description'])) {
		$data['description'] = get_the_author_meta('description', $user->ID);
		$response->set_data($data);
	}
	return $response;
}, 10, 2);

/* ==========================================================================
   3. Sécurisation du back-office (site headless : seul le frontend Next.js
      est public — voir skills/developpement.md section 2)
   ========================================================================== */

// XML-RPC inutile en headless.
add_filter('xmlrpc_enabled', '__return_false');

// Le domaine WordPress ne doit jamais être indexé : seul le frontend Next.js
// doit apparaître dans Google / les moteurs génératifs.
add_action('template_redirect', function () {
	header('X-Robots-Tag: noindex, nofollow', true);
});
add_action('wp_head', function () {
	echo "<meta name=\"robots\" content=\"noindex, nofollow\">\n";
});

// Masquer la version WP (surface d'attaque réduite).
remove_action('wp_head', 'wp_generator');

// Flux RSS inutiles en headless (le frontend Next.js est la seule surface
// publique de contenu) — surface d'attaque et bruit de crawl en moins.
add_action('do_feed', function () { wp_die(__('Les flux RSS sont désactivés sur ce domaine.')); }, 1);
add_action('do_feed_rdf', function () { wp_die(__('Les flux RSS sont désactivés sur ce domaine.')); }, 1);
add_action('do_feed_rss', function () { wp_die(__('Les flux RSS sont désactivés sur ce domaine.')); }, 1);
add_action('do_feed_rss2', function () { wp_die(__('Les flux RSS sont désactivés sur ce domaine.')); }, 1);
add_action('do_feed_atom', function () { wp_die(__('Les flux RSS sont désactivés sur ce domaine.')); }, 1);
remove_action('wp_head', 'feed_links', 2);
remove_action('wp_head', 'feed_links_extra', 3);

// Commentaires natifs WP désactivés : pas d'UI de commentaires côté Next.js,
// et le back-office headless ne doit pas être une surface de spam/attaque.
add_filter('comments_open', '__return_false', 20, 2);
add_filter('pings_open', '__return_false', 20, 2);
add_filter('comments_array', '__return_empty_array', 10, 2);
add_action('admin_menu', function () {
	remove_menu_page('edit-comments.php');
});

/* ==========================================================================
   4. Revalidation Next.js (ISR) — remplace le rebuild complet du 2026-07-11.
      Décision du 2026-07-14 : passage de l'export statique à l'ISR sur
      Vercel (voir docs/architecture-headless.md). Chaque événement de
      publication/modification n'invalide QUE les pages concernées via
      revalidatePath (endpoint /api/revalidate côté Next.js), au lieu d'un
      rebuild complet quotidien — praticable même à 10 000 articles.

      Inspiré du plugin "next-revalidate" du projet de référence next-wp
      (github.com/9d8dev/next-wp/tree/main/plugin) : page de réglages dans
      wp-admin (pas de constante wp-config.php à éditer — plus adapté à un
      usage non technique), couverture large des événements (publication,
      dépublication, mise à la corbeille, catégories, profils auteur), envoi
      du secret via header HTTP plutôt qu'en query string, throttling pour
      éviter de spammer l'endpoint sur des sauvegardes rapprochées, et
      journal des dernières tentatives consultable dans l'admin.
   ========================================================================== */

function monauto_revalidate_settings() {
	return wp_parse_args(get_option('monauto_revalidate_settings', []), [
		'next_url'             => '',
		'webhook_secret'       => '',
		'enable_notifications' => true,
		'cooldown'             => 5, // secondes minimum entre deux envois
	]);
}

add_action('admin_menu', function () {
	add_options_page(
		'Revalidation Next.js',
		'Revalidation Next.js',
		'manage_options',
		'monauto-revalidate',
		'monauto_render_revalidate_settings_page'
	);
});

add_action('admin_init', function () {
	register_setting('monauto_revalidate', 'monauto_revalidate_settings', [
		'sanitize_callback' => function ($input) {
			return [
				'next_url'             => isset($input['next_url']) ? untrailingslashit(esc_url_raw($input['next_url'])) : '',
				'webhook_secret'       => isset($input['webhook_secret']) ? sanitize_text_field($input['webhook_secret']) : '',
				'enable_notifications' => !empty($input['enable_notifications']),
				'cooldown'             => isset($input['cooldown']) ? max(0, intval($input['cooldown'])) : 5,
			];
		},
	]);
});

function monauto_render_revalidate_settings_page() {
	if (!current_user_can('manage_options')) return;
	$s = monauto_revalidate_settings();
	$log = get_option('monauto_revalidate_log', []);
	?>
	<div class="wrap">
		<h1>Revalidation Next.js (ISR)</h1>
		<form method="post" action="options.php">
			<?php settings_fields('monauto_revalidate'); ?>
			<table class="form-table">
				<tr>
					<th><label for="next_url">URL du site Next.js</label></th>
					<td><input type="url" id="next_url" name="monauto_revalidate_settings[next_url]" value="<?php echo esc_attr($s['next_url']); ?>" class="regular-text" placeholder="https://monauto.vercel.app" /></td>
				</tr>
				<tr>
					<th><label for="webhook_secret">Secret partagé</label></th>
					<td><input type="text" id="webhook_secret" name="monauto_revalidate_settings[webhook_secret]" value="<?php echo esc_attr($s['webhook_secret']); ?>" class="regular-text" /><p class="description">Doit correspondre à la variable d'environnement REVALIDATE_SECRET sur Vercel.</p></td>
				</tr>
				<tr>
					<th><label for="cooldown">Délai minimum entre deux envois (s)</label></th>
					<td><input type="number" id="cooldown" name="monauto_revalidate_settings[cooldown]" value="<?php echo esc_attr($s['cooldown']); ?>" min="0" class="small-text" /></td>
				</tr>
				<tr>
					<th>Notifications admin</th>
					<td><label><input type="checkbox" name="monauto_revalidate_settings[enable_notifications]" <?php checked($s['enable_notifications']); ?> /> Afficher un message de succès/échec dans wp-admin</label></td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<h2>Dernières tentatives</h2>
		<?php if (empty($log)): ?>
			<p>Aucune tentative enregistrée pour l'instant.</p>
		<?php else: ?>
			<table class="widefat striped">
				<thead><tr><th>Date</th><th>Événement</th><th>Statut</th><th>Détail</th></tr></thead>
				<tbody>
					<?php foreach ($log as $entry): ?>
						<tr>
							<td><?php echo esc_html(wp_date('Y-m-d H:i:s', $entry['time'])); ?></td>
							<td><?php echo esc_html($entry['event']); ?></td>
							<td><?php echo $entry['success'] ? '✅ OK' : '❌ Échec'; ?></td>
							<td><code><?php echo esc_html(mb_substr($entry['message'], 0, 200)); ?></code></td>
						</tr>
					<?php endforeach; ?>
				</tbody>
			</table>
		<?php endif; ?>
	</div>
	<?php
}

function monauto_revalidate_log($event, $success, $message) {
	$log = get_option('monauto_revalidate_log', []);
	array_unshift($log, ['time' => time(), 'event' => $event, 'success' => $success, 'message' => $message]);
	update_option('monauto_revalidate_log', array_slice($log, 0, 20));
}

// Envoi throttlé de la requête de revalidation. $paths = tableau de chemins
// Next.js à invalider (ex: ["/vidange-guide/", "/", "/categorie/entretien/"]).
function monauto_send_revalidation($event, $paths) {
	$s = monauto_revalidate_settings();
	if (empty($s['next_url']) || empty($s['webhook_secret'])) {
		monauto_revalidate_log($event, false, 'URL ou secret non configuré (Réglages > Revalidation Next.js)');
		return;
	}

	$paths = array_values(array_filter(array_unique($paths)));
	if (empty($paths)) return;

	$last = get_transient('monauto_revalidate_last_sent');
	if ($last !== false && (time() - $last) < $s['cooldown']) {
		monauto_revalidate_log($event, false, 'Throttled (cooldown actif)');
		return;
	}
	set_transient('monauto_revalidate_last_sent', time(), max($s['cooldown'], 1));

	$endpoint = $s['next_url'] . '/api/revalidate';
	$response = wp_remote_post($endpoint, [
		'timeout' => 5,
		'headers' => [
			'Content-Type'      => 'application/json',
			'X-Webhook-Secret'  => $s['webhook_secret'],
		],
		'body' => wp_json_encode(['paths' => $paths]),
	]);

	$s_notify = $s['enable_notifications'];
	if (is_wp_error($response)) {
		monauto_revalidate_log($event, false, $response->get_error_message());
		if ($s_notify) add_action('admin_notices', function () use ($response) {
			echo '<div class="notice notice-error is-dismissible"><p>Revalidation Next.js échouée : ' . esc_html($response->get_error_message()) . '</p></div>';
		});
		return;
	}

	$code = wp_remote_retrieve_response_code($response);
	$body = wp_remote_retrieve_body($response);
	$success = $code >= 200 && $code < 300;
	monauto_revalidate_log($event, $success, $success ? $body : "HTTP {$code} — {$body}");
	if ($s_notify) add_action('admin_notices', function () use ($success, $code, $body, $paths) {
		$class = $success ? 'notice-success' : 'notice-error';
		$text = $success
			? 'Revalidation Next.js déclenchée pour : ' . esc_html(implode(', ', $paths))
			: 'Revalidation Next.js échouée (HTTP ' . esc_html($code) . ') : ' . esc_html($body);
		echo '<div class="notice ' . $class . ' is-dismissible"><p>' . $text . '</p></div>';
	});
}

// Chemins concernés par un article/page : lui-même, + accueil/rubrique/auteur
// si c'est un article (pas une simple page statique comme "À propos").
function monauto_paths_for_post($post) {
	$paths = ["/{$post->post_name}/"];

	if ($post->post_type !== 'post') {
		// Un hub/sous-hub est une page WP dont le slug correspond exactement à
		// une catégorie (voir resolveCategoryId dans scripts/autopublish/run.js)
		// — son contenu réel se rend désormais à l'URL imbriquée canonique
		// /categorie/... (2026-07-24, voir STATE.md et app/categorie/[...slug]/
		// page.tsx), en plus de l'URL plate ci-dessus qui redirige vers elle.
		$term = get_term_by('slug', $post->post_name, 'category');
		if ($term) {
			if ($term->parent) {
				$parent = get_term($term->parent, 'category');
				if ($parent && !is_wp_error($parent)) $paths[] = "/categorie/{$parent->slug}/{$term->slug}/";
			} else {
				$paths[] = "/categorie/{$term->slug}/";
			}
		}
		return $paths;
	}

	$paths[] = '/';
	$cats = get_the_category($post->ID);
	if (!empty($cats)) $paths[] = '/categorie/' . $cats[0]->slug . '/';
	$author = get_userdata($post->post_author);
	if ($author) $paths[] = '/auteur/' . $author->user_nicename . '/';
	return $paths;
}

// Publication, mise à jour, dépublication (tout changement de statut, y
// compris publish -> draft) — un seul hook plutôt que save_post + publish_post
// séparés, pour éviter les doubles déclenchements sur une même sauvegarde.
add_action('transition_post_status', function ($new_status, $old_status, $post) {
	if (!in_array($post->post_type, ['post', 'page'], true)) return;
	if (wp_is_post_revision($post->ID) || wp_is_post_autosave($post->ID)) return;
	if ($new_status === $old_status) return;
	if ($new_status !== 'publish' && $old_status !== 'publish') return; // ni publication ni dépublication

	monauto_send_revalidation("post:{$post->post_type}:{$new_status}", monauto_paths_for_post($post));
}, 10, 3);

// Mise à la corbeille — traité séparément car transition_post_status vers
// 'trash' n'est pas toujours fiable selon le contexte d'appel WP.
add_action('trashed_post', function ($post_id) {
	$post = get_post($post_id);
	if (!$post || !in_array($post->post_type, ['post', 'page'], true)) return;
	monauto_send_revalidation("post:trashed", monauto_paths_for_post($post));
});

// Catégories : la page /categorie/{slug}/ doit se régénérer si son libellé,
// sa description ou sa hiérarchie change.
foreach (['created_term', 'edited_term'] as $hook) {
	add_action($hook, function ($term_id, $tt_id, $taxonomy) {
		if ($taxonomy !== 'category') return;
		$term = get_term($term_id, 'category');
		if (!$term || is_wp_error($term)) return;
		monauto_send_revalidation("term:{$taxonomy}", ["/categorie/{$term->slug}/"]);
	}, 10, 3);
}

// Profils auteur (nom, bio, avatar ACF) : régénère la page /auteur/{slug}/.
foreach (['profile_update', 'user_register'] as $hook) {
	add_action($hook, function ($user_id) {
		$user = get_userdata($user_id);
		if (!$user) return;
		monauto_send_revalidation('user:profile', ["/auteur/{$user->user_nicename}/"]);
	});
}

/* ==========================================================================
   5. Formulaire newsletter — stockage des inscriptions + endpoint public
      d'écriture seule. Même en ISR, le frontend Next.js n'a pas de base de
      données propre : toute soumission de formulaire doit être envoyée
      directement à WordPress, seul serveur réel de cette architecture.
   ========================================================================== */

// CPT non public : jamais d'URL front-end, jamais indexé, visible uniquement
// dans wp-admin et uniquement par les administrateurs (les 6 comptes auteur
// de production ont le rôle Author, sans accès à ces données de contact —
// voir skills/wordpress-publication.md section 4).
add_action('init', function () {
	register_post_type('monauto_lead', [
		'labels' => [
			'name' => 'Inscriptions newsletter',
			'singular_name' => 'Inscription newsletter',
		],
		'public' => false,
		'publicly_queryable' => false,
		'show_ui' => true,
		'show_in_menu' => true,
		'show_in_rest' => false, // jamais via /wp/v2/ — uniquement notre route custom ci-dessous
		'menu_icon' => 'dashicons-email-alt',
		'supports' => ['title'],
		'capability_type' => 'monauto_lead',
		'map_meta_cap' => true,
		'capabilities' => [
			'edit_post' => 'manage_options',
			'read_post' => 'manage_options',
			'delete_post' => 'manage_options',
			'edit_posts' => 'manage_options',
			'edit_others_posts' => 'manage_options',
			'publish_posts' => 'manage_options',
			'read_private_posts' => 'manage_options',
			'delete_posts' => 'manage_options',
		],
	]);
});

// Domaines autorisés à appeler l'API en écriture depuis le navigateur (le
// frontend Next.js n'est pas sur le même domaine que WordPress). WP core
// n'envoie les en-têtes CORS que pour les origines de cette liste (filtre
// natif 'allowed_http_origins') — sans ça, le navigateur bloque la requête
// avant même qu'elle n'atteigne WordPress.
add_filter('allowed_http_origins', function ($origins) {
	$extra = defined('MONAUTO_FRONTEND_ORIGINS')
		? array_map('trim', explode(',', MONAUTO_FRONTEND_ORIGINS))
		: [];
	return array_unique(array_merge($origins, ['http://localhost:3000'], $extra));
});

add_action('rest_api_init', function () {
	register_rest_route('monauto/v1', '/newsletter', [
		'methods' => 'POST',
		'permission_callback' => '__return_true', // écriture publique volontaire, voir validations ci-dessous
		'callback' => function (WP_REST_Request $request) {
			// Honeypot : champ caché côté front, jamais rempli par un humain.
			// Un bot qui le remplit reçoit une fausse réponse de succès (rien
			// n'est enregistré) — pas d'indice qu'il a été détecté.
			if (!empty($request->get_param('site_web'))) {
				return new WP_REST_Response(['ok' => true], 201);
			}

			$email = sanitize_email((string) $request->get_param('email'));
			if (!is_email($email)) {
				return new WP_REST_Response(['ok' => false, 'error' => 'email_invalide'], 400);
			}

			// Limite basique anti-abus : 5 soumissions max par IP et par heure.
			$ip = $request->get_header('x-forwarded-for') ?: ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
			$rate_key = 'monauto_nl_' . md5($ip);
			$count = (int) get_transient($rate_key);
			if ($count >= 5) {
				return new WP_REST_Response(['ok' => false, 'error' => 'trop_de_tentatives'], 429);
			}
			set_transient($rate_key, $count + 1, HOUR_IN_SECONDS);

			// Dédoublonnage : un même email qui se réinscrit met juste à jour
			// la date/la source plutôt que de créer une nouvelle ligne.
			$existing = get_posts([
				'post_type' => 'monauto_lead',
				'post_status' => 'publish',
				'meta_key' => '_monauto_email',
				'meta_value' => $email,
				'posts_per_page' => 1,
				'fields' => 'ids',
			]);

			$post_id = $existing[0] ?? wp_insert_post([
				'post_type' => 'monauto_lead',
				'post_status' => 'publish',
				'post_title' => $email,
			], true);

			if (is_wp_error($post_id)) {
				return new WP_REST_Response(['ok' => false, 'error' => 'erreur_serveur'], 500);
			}

			update_post_meta($post_id, '_monauto_email', $email);
			update_post_meta($post_id, '_monauto_source_url', esc_url_raw((string) $request->get_param('source_url')));
			update_post_meta($post_id, '_monauto_submitted_at', current_time('mysql'));

			return new WP_REST_Response(['ok' => true], 201);
		},
	]);

	// Lecture des inscriptions — réservée aux administrateurs (le CPT n'a
	// volontairement pas d'écran REST public, voir 'show_in_rest' => false
	// ci-dessus). Authentification via Application Password (Basic Auth),
	// identique à scripts/wp-client.js. C'est le moyen de "récupérer toutes
	// les entrées" demandé : GET /wp-json/monauto/v1/newsletter avec les
	// identifiants admin.
	register_rest_route('monauto/v1', '/newsletter', [
		'methods' => 'GET',
		// Note : current_user_can('manage_options') s'est révélé faux ici même
		// pour l'administrateur authentifié via Application Password (constaté
		// en test — également reproduit sur /wp/v2/settings, un endpoint core,
		// donc pas un bug de ce plugin mais une restriction de cet
		// environnement/cette version de WP vis-à-vis des Application
		// Passwords). Vérification par rôle directement à la place : plus
		// robuste, et toujours strictement réservé aux administrateurs (les 6
		// comptes auteur de production ont le rôle Author, jamais Administrator
		// — voir skills/wordpress-publication.md section 4).
		'permission_callback' => fn() => in_array('administrator', wp_get_current_user()->roles, true),
		'callback' => function (WP_REST_Request $request) {
			$posts = get_posts([
				'post_type' => 'monauto_lead',
				'post_status' => 'publish',
				'posts_per_page' => -1,
				'orderby' => 'date',
				'order' => 'DESC',
			]);
			return new WP_REST_Response(array_map(fn($p) => [
				'id' => $p->ID,
				'email' => get_post_meta($p->ID, '_monauto_email', true),
				'source_url' => get_post_meta($p->ID, '_monauto_source_url', true),
				'submitted_at' => get_post_meta($p->ID, '_monauto_submitted_at', true),
			], $posts), 200);
		},
	]);
});

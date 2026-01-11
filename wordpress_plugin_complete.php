<?php
/**
 * Plugin Name: Steam Verde Launcher API (DB Optimized)
 * Description: API robusta com tabelas personalizadas para alta performance.
 * Version: 2.3
 * Author: Steam Verde Team
 */

if (!defined('ABSPATH'))
    exit;

// --- 1. CRIAÇÃO DAS TABELAS (Executa apenas na ativação) ---
register_activation_hook(__FILE__, 'sv_create_db_tables');
function sv_create_db_tables()
{
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    // Tabela: Biblioteca de Jogos
    $table_library = $wpdb->prefix . 'sv_user_library';
    $sql_library = "CREATE TABLE $table_library (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        app_id varchar(50) NOT NULL, -- Pode ser ID Steam ou Nome da Pasta
        game_name varchar(255) NOT NULL,
        cover_url varchar(500) DEFAULT '',
        last_played datetime DEFAULT NULL,
        playtime_minutes int(11) DEFAULT 0,
        is_favorite boolean DEFAULT 0,
        PRIMARY KEY  (id),
        UNIQUE KEY user_game (user_id, app_id), -- Evita duplicatas para o mesmo user/jogo
        KEY user_idx (user_id) -- Busca rapida por usuario
    ) $charset_collate;";

    // Tabela: Conquistas
    $table_achs = $wpdb->prefix . 'sv_user_achievements';
    $sql_achs = "CREATE TABLE $table_achs (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL,
        app_id varchar(50) NOT NULL,
        achievement_key varchar(100) NOT NULL,
        title varchar(255) DEFAULT '',
        description text,
        icon_url varchar(255) DEFAULT '',
        game_name varchar(255) DEFAULT '',
        unlocked_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        UNIQUE KEY user_ach (user_id, app_id, achievement_key),
        KEY user_app_idx (user_id, app_id)
    ) $charset_collate;";

    // Tabela: Amigos
    $table_friends = $wpdb->prefix . 'sv_user_friends';
    $sql_friends = "CREATE TABLE $table_friends (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id_1 bigint(20) NOT NULL,
        user_id_2 bigint(20) NOT NULL,
        status varchar(20) DEFAULT 'pending', -- pending, accepted, blocked
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        UNIQUE KEY friendship (user_id_1, user_id_2)
    ) $charset_collate;";

    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql_library);
    dbDelta($sql_achs);
    dbDelta($sql_friends);
}

// AUTO-UPDATE DB: Garante que as tabelas existem mesmo se atualizou via FTP/Editor
add_action('plugins_loaded', 'sv_check_db_update');
function sv_check_db_update()
{
    if (get_option('sv_db_version') != '2.3') {
        sv_create_db_tables();
        update_option('sv_db_version', '2.3');
    }
}

// --- 2. REGISTRO DE ENDPOINTS REST API ---
add_action('rest_api_init', function () {
    // Sincronização
    register_rest_route('steamverde/v1', '/library/sync', ['methods' => 'POST', 'callback' => 'sv_api_sync_library', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/auth/nonce', [
        'methods' => 'GET',
        'callback' => 'sv_api_get_nonce',
        'permission_callback' => '__return_true'
    ]);
    register_rest_route('steamverde/v1', '/achievements/sync', ['methods' => 'POST', 'callback' => 'sv_api_sync_achievements', 'permission_callback' => 'sv_api_auth_check']);

    // Perfil
    register_rest_route('steamverde/v1', '/profile/(?P<id>\d+)', ['methods' => 'GET', 'callback' => 'sv_api_get_db_profile', 'permission_callback' => '__return_true']);
    register_rest_route('steamverde/v1', '/me', ['methods' => 'GET', 'callback' => 'sv_api_get_current_user_basic', 'permission_callback' => '__return_true']);

    // Amigos
    register_rest_route('steamverde/v1', '/friend/request', ['methods' => 'POST', 'callback' => 'sv_api_friend_request', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/accept', ['methods' => 'POST', 'callback' => 'sv_api_friend_accept', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/pending', ['methods' => 'GET', 'callback' => 'sv_api_friend_pending', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/check', ['methods' => 'GET', 'callback' => 'sv_api_friend_check', 'permission_callback' => 'sv_api_auth_check']);

    // Gerenciamento de Amigos (Novos)
    register_rest_route('steamverde/v1', '/friend/remove', ['methods' => 'POST', 'callback' => 'sv_api_friend_remove', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/block', ['methods' => 'POST', 'callback' => 'sv_api_friend_block', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/unblock', ['methods' => 'POST', 'callback' => 'sv_api_friend_unblock', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/blocked', ['methods' => 'GET', 'callback' => 'sv_api_friend_blocked_list', 'permission_callback' => 'sv_api_auth_check']);

    // Configurações de Privacidade
    register_rest_route('steamverde/v1', '/settings/privacy', ['methods' => 'POST', 'callback' => 'sv_api_save_privacy', 'permission_callback' => 'sv_api_auth_check']);
});

// --- IMPLEMENTAÇÃO ---

// Auth Check Helper
function sv_api_auth_check($request)
{
    return is_user_logged_in();
}

function sv_api_get_nonce()
{
    // Se não estiver logado, tenta forçar auth via Cookie
    if (!is_user_logged_in()) {
        if (isset($_COOKIE[LOGGED_IN_COOKIE])) {
            $cookie = $_COOKIE[LOGGED_IN_COOKIE];
            $user_id = wp_validate_auth_cookie($cookie, 'logged_in');
            if ($user_id) {
                wp_set_current_user($user_id);
            }
        }
    }

    if (is_user_logged_in()) {
        error_log("[SV_API] Nonce Requested by User " . get_current_user_id());
        return ['nonce' => wp_create_nonce('wp_rest')];
    }

    return new WP_Error('no_auth', 'Not logged in', ['status' => 401]);
}

// SALVAR PRIVACIDADE
function sv_api_save_privacy($request)
{
    $user_id = get_current_user_id();
    $profile = $request->get_param('profile');
    $library = $request->get_param('library');

    if ($profile && in_array($profile, ['public', 'friends', 'private'])) {
        update_user_meta($user_id, 'sv_privacy_profile', $profile);
    }
    if ($library && in_array($library, ['public', 'friends', 'private'])) {
        update_user_meta($user_id, 'sv_privacy_library', $library);
    }
    return ['status' => 'saved'];
}

// OBTER PERFIL (COM PRIVACIDADE)
function sv_api_get_db_profile($data)
{
    global $wpdb;
    $target_id = $data['id'];
    $requester_id = get_current_user_id();

    $user = get_userdata($target_id);
    if (!$user)
        return new WP_Error('not_found', 'Usuário não existe', ['status' => 404]);

    // Definições de Privacidade
    $priv_profile = get_user_meta($target_id, 'sv_privacy_profile', true) ?: 'public';
    $priv_library = get_user_meta($target_id, 'sv_privacy_library', true) ?: 'public';

    $is_self = ($requester_id && $requester_id == $target_id);
    $is_friend = false;

    // Checa amizade
    if (!$is_self && ($priv_profile === 'friends' || $priv_library === 'friends') && $requester_id) {
        $table_friends = $wpdb->prefix . 'sv_user_friends';
        $check = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM $table_friends WHERE ((user_id_1 = %d AND user_id_2 = %d) OR (user_id_1 = %d AND user_id_2 = %d)) AND status = 'accepted'",
            $requester_id,
            $target_id,
            $target_id,
            $requester_id
        ));
        if ($check)
            $is_friend = true;
    }

    $can_see_details = ($is_self || $priv_profile === 'public' || ($priv_profile === 'friends' && $is_friend));
    $can_see_library = ($is_self || $priv_library === 'public' || ($priv_library === 'friends' && $is_friend));

    $games = [];
    $achs = [];

    if ($can_see_library) {
        $table_lib = $wpdb->prefix . 'sv_user_library';
        $games = $wpdb->get_results($wpdb->prepare(
            "SELECT app_id, game_name as name, cover_url as image FROM $table_lib WHERE user_id = %d ORDER BY last_played DESC LIMIT 50",
            $target_id
        ));

        $table_ach = $wpdb->prefix . 'sv_user_achievements';
        $achs = $wpdb->get_results($wpdb->prepare(
            "SELECT ach.app_id, ach.achievement_key as id, ach.title, ach.description, ach.icon_url as icon, ach.game_name, ach.unlocked_at 
             FROM $table_ach ach
             WHERE ach.user_id = %d",
            $target_id
        ), ARRAY_A);

        error_log("[SV_API] Fetching Profile ID: $target_id | CanSeeLibrary: " . ($can_see_library ? 'YES' : 'NO'));
        error_log("[SV_API] Achs Found: " . count($achs));
        if (count($achs) > 0)
            error_log("[SV_API] Sample Ach: " . print_r($achs[0], true));
    }

    $friends = [];
    if ($can_see_details) {
        $table_friends = $wpdb->prefix . 'sv_user_friends';
        $friends_raw = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id_1, user_id_2 FROM $table_friends 
             WHERE (user_id_1 = %d OR user_id_2 = %d) AND status = 'accepted'",
            $target_id,
            $target_id
        ));

        foreach ($friends_raw as $fr) {
            $friend_id = ($fr->user_id_1 == $target_id) ? $fr->user_id_2 : $fr->user_id_1;
            $u = get_userdata($friend_id);
            if ($u) {
                $friends[] = [
                    'id' => $u->ID,
                    'name' => $u->display_name,
                    'avatar' => get_avatar_url($u->ID)
                ];
            }
        }
    }

    return [
        'id' => $target_id,
        'nickname' => $user->display_name,
        'avatar' => get_avatar_url($target_id),
        'registered' => $user->user_registered,
        'library' => $games,
        'achievements' => $achs,
        'friends' => $friends,
        'privacy' => ['profile' => $priv_profile, 'library' => $priv_library],
        'is_friend' => $is_friend
    ];
}

// REMOVER AMIGO
function sv_api_friend_remove($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    $table = $wpdb->prefix . 'sv_user_friends';
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $table WHERE (user_id_1 = %d AND user_id_2 = %d) OR (user_id_1 = %d AND user_id_2 = %d)",
        $user_id,
        $target_id,
        $target_id,
        $user_id
    ));
    return ['status' => 'removed'];
}

// BLOQUEAR USUÁRIO
function sv_api_friend_block($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    $table = $wpdb->prefix . 'sv_user_friends';
    sv_api_friend_remove($request);
    $wpdb->insert($table, ['user_id_1' => $user_id, 'user_id_2' => $target_id, 'status' => 'blocked']);
    return ['status' => 'blocked'];
}

// DESBLOQUEAR USUÁRIO
function sv_api_friend_unblock($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    $table = $wpdb->prefix . 'sv_user_friends';
    $wpdb->query($wpdb->prepare(
        "DELETE FROM $table WHERE user_id_1 = %d AND user_id_2 = %d AND status = 'blocked'",
        $user_id,
        $target_id
    ));
    return ['status' => 'unblocked'];
}

// LISTA DE BLOQUEADOS
function sv_api_friend_blocked_list($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $table = $wpdb->prefix . 'sv_user_friends';
    $blocked = $wpdb->get_results($wpdb->prepare(
        "SELECT user_id_2 as blocked_id FROM $table WHERE user_id_1 = %d AND status = 'blocked'",
        $user_id
    ));
    $out = [];
    foreach ($blocked as $b) {
        $u = get_userdata($b->blocked_id);
        if ($u) {
            $out[] = ['id' => $u->ID, 'name' => $u->display_name, 'avatar' => get_avatar_url($u->ID)];
        }
    }
    return $out;
}

// AMIGO REQUEST
function sv_api_friend_request($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    if (!$target_id || $target_id == $user_id)
        return new WP_Error('invalid', 'ID Invalido', ['status' => 400]);
    $table = $wpdb->prefix . 'sv_user_friends';
    $exists = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE (user_id_1 = %d AND user_id_2 = %d) OR (user_id_1 = %d AND user_id_2 = %d)",
        $user_id,
        $target_id,
        $target_id,
        $user_id
    ));
    if ($exists) {
        if ($exists->status == 'accepted')
            return ['status' => 'already_friends'];
        if ($exists->status == 'pending')
            return ['status' => 'pending'];
        if ($exists->status == 'blocked')
            return ['status' => 'blocked'];
    }
    $wpdb->insert($table, ['user_id_1' => $user_id, 'user_id_2' => $target_id, 'status' => 'pending']);
    return ['status' => 'sent'];
}

// ACCEPT
function sv_api_friend_accept($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    $table = $wpdb->prefix . 'sv_user_friends';
    $wpdb->query($wpdb->prepare(
        "UPDATE $table SET status = 'accepted' WHERE user_id_1 = %d AND user_id_2 = %d AND status = 'pending'",
        $target_id,
        $user_id
    ));
    return ['status' => 'accepted'];
}

// PENDING
function sv_api_friend_pending($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $table = $wpdb->prefix . 'sv_user_friends';
    $received = $wpdb->get_results($wpdb->prepare("SELECT user_id_1 as friend_id FROM $table WHERE user_id_2 = %d AND status = 'pending'", $user_id));
    $sent = $wpdb->get_results($wpdb->prepare("SELECT user_id_2 as friend_id FROM $table WHERE user_id_1 = %d AND status = 'pending'", $user_id));

    $out_received = [];
    foreach ($received as $req) {
        $u = get_userdata($req->friend_id);
        if ($u)
            $out_received[] = ['id' => $u->ID, 'name' => $u->display_name, 'avatar' => get_avatar_url($u->ID)];
    }
    $out_sent = [];
    foreach ($sent as $req) {
        $u = get_userdata($req->friend_id);
        if ($u)
            $out_sent[] = ['id' => $u->ID, 'name' => $u->display_name, 'avatar' => get_avatar_url($u->ID)];
    }
    return ['received' => $out_received, 'sent' => $out_sent];
}

// CHECK FRIEND
function sv_api_friend_check($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $target_id = $request->get_param('target_id');
    $table = $wpdb->prefix . 'sv_user_friends';
    $rel = $wpdb->get_row($wpdb->prepare(
        "SELECT * FROM $table WHERE (user_id_1 = %d AND user_id_2 = %d) OR (user_id_1 = %d AND user_id_2 = %d)",
        $user_id,
        $target_id,
        $target_id,
        $user_id
    ));
    if (!$rel)
        return ['is_friend' => false, 'status' => 'none'];
    return ['is_friend' => ($rel->status === 'accepted'), 'status' => $rel->status];
}

// SYNC LIBRARY
function sv_api_sync_library($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $games = $request->get_param('games');
    if (!is_array($games))
        return new WP_Error('invalid_data', 'Dados inválidos', ['status' => 400]);
    $table = $wpdb->prefix . 'sv_user_library';
    $wpdb->query('START TRANSACTION');
    foreach ($games as $g) {
        $app_id = isset($g['appId']) ? $g['appId'] : sanitize_title($g['name']);
        $name = sanitize_text_field($g['name']);
        $cover = esc_url_raw($g['image']);
        $wpdb->query($wpdb->prepare(
            "INSERT INTO $table (user_id, app_id, game_name, cover_url, last_played) VALUES (%d, %s, %s, %s, NOW()) ON DUPLICATE KEY UPDATE game_name = VALUES(game_name), cover_url = VALUES(cover_url), last_played = NOW()",
            $user_id,
            $app_id,
            $name,
            $cover
        ));
    }
    $wpdb->query('COMMIT');
    return ['status' => 'success', 'count' => count($games)];
}

// SYNC ACHIEVEMENTS
function sv_api_sync_achievements($request)
{
    global $wpdb;
    $user_id = get_current_user_id();
    $items = $request->get_param('achievements');
    if (!is_array($items))
        return new WP_Error('invalid_data', 'Dados inválidos', ['status' => 400]);
    $table = $wpdb->prefix . 'sv_user_achievements';
    $wpdb->query('START TRANSACTION');
    $added = 0;
    foreach ($items as $item) {
        $raw_id = is_array($item) ? $item['id'] : $item;
        $title = (is_array($item) && isset($item['title'])) ? sanitize_text_field($item['title']) : '';
        $desc = (is_array($item) && isset($item['description'])) ? sanitize_text_field($item['description']) : '';
        $icon = (is_array($item) && isset($item['icon'])) ? esc_url_raw($item['icon']) : '';
        $gname = (is_array($item) && isset($item['gameName'])) ? sanitize_text_field($item['gameName']) : '';

        $parts = explode('-', $raw_id, 2);
        if (count($parts) < 2)
            continue;
        $app_id = sanitize_text_field($parts[0]);
        $ach_key = sanitize_text_field($parts[1]);
        $res = $wpdb->query($wpdb->prepare(
            "INSERT INTO $table (user_id, app_id, achievement_key, title, description, icon_url, game_name, unlocked_at) VALUES (%d, %s, %s, %s, %s, %s, %s, NOW()) 
             ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), icon_url=VALUES(icon_url), game_name=VALUES(game_name)",
            $user_id,
            $app_id,
            $ach_key,
            $title,
            $desc,
            $icon,
            $gname
        ));
        if ($res)
            $added++;
    }
    $wpdb->query('COMMIT');
    return ['status' => 'success', 'added' => $added];
}

// CURRENT USER
function sv_api_get_current_user_basic($request)
{
    $user_id = get_current_user_id();
    if (!$user_id)
        return new WP_Error('no_user', 'Nao logado', ['status' => 401]);
    $user = get_userdata($user_id);
    return ['id' => $user_id, 'name' => $user->display_name, 'avatar_urls' => ['96' => get_avatar_url($user_id)]];
}

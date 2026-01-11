<?php
/**
 * STEAM VERDE LAUNCHER API
 * Add this code to your theme's functions.php or a custom plugin.
 */

// 1. REGISTER ENDPOINTS
add_action('rest_api_init', function () {
    register_rest_route('steamverde/v1', '/profile/(?P<id>\d+)', [
        'methods' => 'GET',
        'callback' => 'sv_api_get_profile',
        'permission_callback' => '__return_true', // Public endpoint, but filtered by privacy
    ]);

    register_rest_route('steamverde/v1', '/friend/request', [
        'methods' => 'POST',
        'callback' => 'sv_api_friend_request',
        'permission_callback' => 'sv_api_auth_check',
    ]);
    
    register_rest_route('steamverde/v1', '/friend/list', [
        'methods' => 'GET',
        'callback' => 'sv_api_get_friends',
        'permission_callback' => 'sv_api_auth_check',
    ]);

    register_rest_route('steamverde/v1', '/settings/update', [
        'methods' => 'POST',
        'callback' => 'sv_api_update_settings',
        'permission_callback' => 'sv_api_auth_check',
    ]);
});

// 2. AUTH CHECK (Cookie based - simplificado para o exemplo)
function sv_api_auth_check($request) {
    return is_user_logged_in();
}

// 3. GET PROFILE
function sv_api_get_profile($data) {
    $target_id = $data['id'];
    $target_user = get_userdata($target_id);
    
    if (!$target_user) {
        return new WP_Error('no_user', 'Usuário não encontrado', ['status' => 404]);
    }

    // Get Meta Settings (Privacy)
    $privacy_profile = get_user_meta($target_id, 'sv_privacy_profile', true); // 'public', 'friends', 'private'
    $privacy_library = get_user_meta($target_id, 'sv_privacy_library', true); // 'public', 'friends', 'private'

    // Check relationship if needed
    $current_id = get_current_user_id();
    $is_self = ($current_id == $target_id);
    $is_friend = sv_check_friendship($current_id, $target_id);

    // Profile Visibility Logic
    if (!$is_self && $privacy_profile === 'private') {
        return new WP_Error('private', 'Este perfil é privado.', ['status' => 403]);
    }
    if (!$is_self && $privacy_profile === 'friends' && !$is_friend) {
        return new WP_Error('private', 'Este perfil é somente para amigos.', ['status' => 403]);
    }

    $response = [
        'id' => $target_id,
        'nickname' => $target_user->display_name,
        'avatar' => get_avatar_url($target_id),
        'registered' => $target_user->user_registered,
    ];

    // Library Visibility Logic
    if ($is_self || $privacy_library === 'public' || ($privacy_library === 'friends' && $is_friend)) {
        // Mocking Library Data (In real world, fetch from DB table 'sv_downloads' or similar)
        // For the launcher to send this data, we would need a sync endpoint. 
        // For now, we return empty or stored meta.
        $response['library'] = get_user_meta($target_id, 'sv_library_snapshot', true) ?: [];
    } else {
        $response['library_hidden'] = true;
    }
    
    return $response;
}

// 4. FRIEND REQUEST
function sv_api_friend_request($request) {
    $current_id = get_current_user_id();
    $target_id = $request['target_id'];
    
    if ($current_id == $target_id) return new WP_Error('error', 'Você não pode adicionar a si mesmo.', ['status' => 400]);

    // Simple Friendship Logic: Stored in User Meta as array of IDs
    // In production, use a proper table.
    $friends = get_user_meta($current_id, 'sv_friends', true) ?: [];
    
    if (in_array($target_id, $friends)) {
         return ['status' => 'already_friends', 'message' => 'Já são amigos.'];
    }
    
    // Auto-accept for prototype aggression
    $friends[] = $target_id;
    update_user_meta($current_id, 'sv_friends', $friends);
    
    // Bind the other way too
    $target_friends = get_user_meta($target_id, 'sv_friends', true) ?: [];
    if (!in_array($current_id, $target_friends)) {
        $target_friends[] = $current_id;
        update_user_meta($target_id, 'sv_friends', $target_friends);
    }

    return ['status' => 'success', 'message' => 'Amigo adicionado!'];
}

// 5. GET FRIENDS
function sv_api_get_friends($request) {
    $current_id = get_current_user_id();
    $friend_ids = get_user_meta($current_id, 'sv_friends', true) ?: [];
    
    $list = [];
    foreach ($friend_ids as $fid) {
        $u = get_userdata($fid);
        if ($u) {
            $list[] = [
                'id' => $fid,
                'name' => $u->display_name,
                'avatar' => get_avatar_url($fid),
                'status' => 'offline' // Needs complex presence system
            ];
        }
    }
    return $list;
}

// 6. UPDATE SETTINGS
function sv_api_update_settings($request) {
    $current_id = get_current_user_id();
    $params = $request->get_params();

    if (isset($params['privacy_profile'])) update_user_meta($current_id, 'sv_privacy_profile', sanitize_text_field($params['privacy_profile']));
    if (isset($params['privacy_library'])) update_user_meta($current_id, 'sv_privacy_library', sanitize_text_field($params['privacy_library']));
    
    // Sync Library Snapshot if sent
    if (isset($params['library_snapshot'])) {
        update_user_meta($current_id, 'sv_library_snapshot', $params['library_snapshot']);
    }

    return ['status' => 'success'];
}

function sv_check_friendship($user_a, $user_b) {
    $friends = get_user_meta($user_a, 'sv_friends', true) ?: [];
    return in_array($user_b, $friends);
}

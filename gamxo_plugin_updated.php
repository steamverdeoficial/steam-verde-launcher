<?php
/**
 * Plugin Name: Gamxo User Account
 * Description: Página completa de conta do usuário com integração WPDM - Versão Final com Status VIP, Correção de Cache e Identificação Launcher.
 * Version: 2.9.1 (Layout Fixed)
 * Author: Seu Nome
 */

if (!defined('ABSPATH')) {
    exit;
}

class GamxoUserAccount
{

    public function __construct()
    {
        add_action('init', array($this, 'init'));
    }

    public function init()
    {
        add_shortcode('gamxo_user_account', array($this, 'user_account_shortcode'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_loaded', array($this, 'handle_form_submissions'));
        add_action('wp_ajax_update_profile_photo', array($this, 'update_profile_photo'));
        add_filter('get_avatar_url', array($this, 'get_custom_avatar_url'), 10, 3);
        add_action('admin_bar_menu', array($this, 'add_admin_bar_menu'), 100);
        add_action('wp_ajax_delete_user_account', array($this, 'delete_user_account'));
        add_action('wp_ajax_remove_download_history', array($this, 'remove_download_history'));

        // --- CORREÇÃO DE CACHE (LITESPEED) ---
        // Força a página da conta a ser dinâmica (não cacheada)
        add_action('template_redirect', array($this, 'disable_account_page_cache'));
    }

    // Função para desligar o cache APENAS na página da conta
    public function disable_account_page_cache()
    {
        $page_id = get_option('gamxo_account_page_id');
        if ($page_id && is_page($page_id)) {
            // Define a constante do LiteSpeed para não cachear esta página
            if (!defined('LITESPEED_DISABLE_CACHE')) {
                define('LITESPEED_DISABLE_CACHE', true);
            }
            // Força cabeçalhos de não-cache do PHP para navegadores
            nocache_headers();
        }
    }

    public function enqueue_scripts()
    {
        wp_enqueue_style('gamxo-user-account', plugin_dir_url(__FILE__) . 'css/style.css');
        wp_enqueue_script('gamxo-user-account', plugin_dir_url(__FILE__) . 'js/script.js', array('jquery'), null, true);
        wp_localize_script('gamxo-user-account', 'gamxo_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('update_profile_photo_nonce'),
            'remove_download_nonce' => wp_create_nonce('remove_download_nonce')
        ));
    }

    public function add_admin_bar_menu($wp_admin_bar)
    {
        if (!is_user_logged_in())
            return;
        $account_url = get_permalink(get_option('gamxo_account_page_id'));
        if ($account_url) {
            $wp_admin_bar->add_node(array(
                'id' => 'my-account-gamxo',
                'title' => 'Minha Conta',
                'href' => $account_url,
                'meta' => array('class' => 'my-account-gamxo')
            ));
        }
    }

    public function get_custom_avatar_url($url, $id_or_email, $args)
    {
        $user_id = 0;
        if (is_numeric($id_or_email)) {
            $user_id = $id_or_email;
        } elseif (is_string($id_or_email) && ($user = get_user_by('email', $id_or_email))) {
            $user_id = $user->ID;
        } elseif (is_object($id_or_email)) {
            $user_id = $id_or_email->user_id;
        }
        if ($user_id) {
            $custom_avatar = get_user_meta($user_id, 'custom_avatar', true);
            if (!empty($custom_avatar)) {
                return $custom_avatar;
            }
        }
        return $url;
    }

    public function user_account_shortcode()
    {
        if (!is_user_logged_in()) {
            return $this->wpdm_login_form();
        }
        return $this->account_page();
    }

    private function wpdm_login_form()
    {
        if (shortcode_exists('wpdm_login_form')) {
            return do_shortcode('[wpdm_login_form]');
        }
        return $this->custom_login_form();
    }

    private function custom_login_form()
    {
        ob_start(); ?>
        <div class="gamxo-login-container">
            <div class="gamxo-login-form">
                <div class="gamxo-login-header">
                    <h2>Entrar na sua conta</h2>
                    <p>Digite suas credenciais para acessar sua conta</p>
                </div>
                <?php
                $args = array('echo' => false, 'redirect' => get_permalink(), 'label_username' => 'Nome de usuário ou email', 'label_password' => 'Senha', 'label_remember' => 'Lembrar-me', 'label_log_in' => 'Entrar');
                $login_form = wp_login_form($args);
                $login_form = str_replace('name="log"', 'name="log" placeholder="Nome de usuário ou email"', $login_form);
                $login_form = str_replace('name="pwd"', 'name="pwd" placeholder="Sua senha"', $login_form);
                $login_form = str_replace('name="wp-submit"', 'name="wp-submit" class="gamxo-login-btn"', $login_form);
                echo $login_form;
                ?>
                <div class="gamxo-login-links">
                    <p><a href="<?php echo wp_lostpassword_url(); ?>">Esqueceu a senha?</a></p>
                </div>
            </div>
        </div>
        <?php return ob_get_clean();
    }

    private function account_page()
    {
        global $wpdb;
        $current_user = wp_get_current_user();

        // Count Pending Friends Logic
        $friends_count = 0;
        $t_friends = $wpdb->prefix . 'sv_user_friends';
        // Suppress errors in case table checks fail on some configs
        $wpdb->suppress_errors();
        if ($wpdb->get_var("SHOW TABLES LIKE '$t_friends'") == $t_friends) {
            $friends_count = (int) $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t_friends WHERE user_id_2 = %d AND status = 'pending'", $current_user->ID));
        }
        $wpdb->show_errors();
        $active_tab = isset($_GET['tab']) ? sanitize_text_field($_GET['tab']) : 'dashboard';

        // --- VERIFICAÇÃO DE ASSINANTE BLINDADA ---
        $is_assinante = false;
        $status_html = '';

        if (function_exists('is_user_assinante')) {
            try {
                // Tenta verificar. Se o outro plugin der erro, caímos no catch.
                $is_assinante = is_user_assinante($current_user->ID);
                $status_html = $this->get_subscription_status_html($current_user->ID, $is_assinante);
            } catch (Exception $e) {
                // Falha silenciosa
                $is_assinante = false;
            } catch (Error $e) {
                // Falha fatal do PHP 7+
                $is_assinante = false;
            }
        }

        ob_start(); ?>
        <style>
            .gamxo-badge-count {
                background: #e74c3c;
                color: #fff;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: bold;
                margin-left: 5px;
                vertical-align: middle;
                display: inline-block;
                line-height: 1;
            }
        </style>
        <div class="gamxo-user-account">
            <!-- [CRUCIAL] IDENTIFICADOR OCULTO E NONCE REST PARA O LAUNCHER STEAM VERDE -->
            <div id="gamxo-launcher-identity" data-user-id="<?php echo esc_attr($current_user->ID); ?>"
                data-rest-nonce="<?php echo wp_create_nonce('wp_rest'); ?>" style="display:none;"></div>

            <div class="gamxo-account-header">
                <div class="user-avatar">
                    <?php echo get_avatar($current_user->ID, 96); ?>
                    <form id="profile-photo-form" enctype="multipart/form-data"><input type="file" name="profile_photo"
                            id="profile_photo" accept="image/*" style="display: none;"><button type="button"
                            onclick="document.getElementById('profile_photo').click()">Alterar foto</button></form>
                </div>
                <div class="user-info">
                    <h1>Olá, <?php echo esc_html($current_user->display_name); ?></h1>
                    <div class="gamxo-user-status-container">
                        <?php echo $status_html; ?>
                    </div>
                    <p class="welcome-text">Bem-vindo à sua área de conta</p>
                </div>
            </div>
            <nav class="gamxo-account-tabs">
                <a href="?tab=dashboard" class="<?php echo $active_tab == 'dashboard' ? 'active' : ''; ?>">Dashboard</a>
                <a href="?tab=downloads" class="<?php echo $active_tab == 'downloads' ? 'active' : ''; ?>">Meus Downloads</a>
                <a href="?tab=profile" class="<?php echo $active_tab == 'profile' ? 'active' : ''; ?>">Perfil</a>
                <a href="?tab=password" class="<?php echo $active_tab == 'password' ? 'active' : ''; ?>">Senha</a>
                <a href="?tab=friends" class="<?php echo $active_tab == 'friends' ? 'active' : ''; ?>">Amigos <?php if (!empty($friends_count) && $friends_count > 0)
                             echo '<span class="gamxo-badge-count">' . $friends_count . '</span>'; ?></a>
                <a href="?tab=activities" class="<?php echo $active_tab == 'activities' ? 'active' : ''; ?>">Atividades</a>
                <a href="?tab=delete-account" class="<?php echo $active_tab == 'delete-account' ? 'active' : ''; ?>">Excluir
                    Meus Dados</a>
                <a href="<?php echo wp_logout_url(home_url()); ?>" class="logout-btn">Sair</a>
            </nav>
            <div class="gamxo-account-content">
                <?php
                switch ($active_tab) {
                    case 'profile':
                        $this->profile_tab();
                        break;
                    case 'password':
                        $this->password_tab();
                        break;
                    case 'friends':
                        $this->friends_tab();
                        break;
                    case 'downloads':
                        $this->downloads_tab();
                        break;
                    case 'activities':
                        $this->activities_tab();
                        break;
                    case 'delete-account':
                        $this->delete_account_tab();
                        break;
                    default:
                        $this->dashboard_tab($status_html);
                        break; // Passa o HTML do status
                }
                ?>
            </div>
        </div>
        <?php return ob_get_clean();
    }

    /**
     * GERA O HTML DE STATUS + DATA
     */
    private function get_subscription_status_html($user_id, $is_assinante)
    {
        if (!$is_assinante) {
            $text = 'Não Assinante';
            $class = 'not-assinante';
            return '<span class="gamxo-user-badge ' . $class . '">' . $text . '</span>';
        }

        // É assinante: Vamos ver a data
        $text = 'Assinante';
        $class = 'is-assinante';
        $icon = '<svg class="gamxo-badge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>';

        $badge = '<span class="gamxo-user-badge ' . $class . '">' . $icon . $text . '</span>';

        // Verifica data de expiração (também blindada)
        $expiration_info = '';
        if (function_exists('get_assinante_end_date')) {
            try {
                $end_date_ts = get_assinante_end_date($user_id);

                if ($end_date_ts) {
                    $days_left = ceil(($end_date_ts - current_time('timestamp')) / DAY_IN_SECONDS);
                    $date_formatted = date_i18n('d/m/Y', $end_date_ts);

                    if ($days_left > 0) {
                        $expiration_info = '<span class="gamxo-sub-info expiry">Vence em: ' . $date_formatted . ' (' . $days_left . ' dias)</span>';
                    } else {
                        $expiration_info = '<span class="gamxo-sub-info expired">Expirou em: ' . $date_formatted . '</span>';
                    }
                } else {
                    $expiration_info = '<span class="gamxo-sub-info lifetime">∞ Vitalício</span>';
                }
            } catch (Exception $e) {
            } catch (Error $e) {
            }
        }

        return $badge . $expiration_info;
    }

    private function dashboard_tab($status_html)
    {
        $current_user = wp_get_current_user();
        $comments_count = $this->get_comments_count();
        $downloads_count = $this->get_download_count();
        $last_download = $this->get_last_download();
        ?>
        <div class="gamxo-dashboard">
            <h2>Visão Geral da Conta</h2>
            <div class="dashboard-stats">
                <div class="stat-card status-card">
                    <h3>Status da Conta</h3>
                    <div class="stat-text-status">
                        <?php echo $status_html; ?>
                    </div>
                </div>
                <div class="stat-card">
                    <h3>Membro desde</h3>
                    <p class="stat-number"><?php echo date('d/m/Y', strtotime($current_user->user_registered)); ?></p>
                </div>
                <div class="stat-card">
                    <h3>Comentários</h3>
                    <p class="stat-number"><?php echo $comments_count; ?></p>
                </div>
                <div class="stat-card">
                    <h3>Downloads</h3>
                    <p class="stat-number"><?php echo $downloads_count; ?></p>
                </div>
                <?php if ($last_download): ?>
                    <div class="stat-card">
                        <h3>Último Jogo Baixado</h3>
                        <p class="stat-text">
                            <a href="<?php echo get_permalink($last_download->package_id); ?>">
                                <?php echo esc_html($last_download->package_name); ?>
                            </a>
                        </p>
                    </div>
                <?php endif; ?>
            </div>
            <div class="recent-activities">
                <h3>Último Comentário</h3>
                <?php echo $this->get_recent_comment(); ?>
            </div>
        </div>
        <?php
    }

    private function profile_tab()
    {
        $current_user = wp_get_current_user();
        ?>
        <div class="gamxo-profile">
            <h2>Editar Perfil</h2>
            <?php if (isset($_GET['message']) && $_GET['message'] == 'profile_updated'): ?>
                <div class="gamxo-alert success">Perfil atualizado com sucesso!</div>
            <?php endif; ?>
            <form method="post" class="gamxo-form">
                <?php wp_nonce_field('update_profile', 'profile_nonce'); ?>
                <input type="hidden" name='action' value='update_profile'>
                <div class="form-group">
                    <label>Nome</label>
                    <input type="text" name="first_name" value="<?php echo esc_attr($current_user->first_name); ?>"
                        placeholder="Seu nome">
                </div>
                <div class="form-group">
                    <label>Sobrenome</label>
                    <input type="text" name="last_name" value="<?php echo esc_attr($current_user->last_name); ?>"
                        placeholder="Seu sobrenome">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="email" value="<?php echo esc_attr($current_user->user_email); ?>" required>
                </div>
                <div class="form-group">
                    <label>Nome de exibição</label>
                    <input type="text" name="display_name" value="<?php echo esc_attr($current_user->display_name); ?>">
                </div>
                <div class="form-group">
                    <label>Biografia</label>
                    <textarea name="description" rows="4"><?php echo esc_textarea($current_user->description); ?></textarea>
                </div>
                <button type="submit" class="gamxo-btn">Salvar alterações</button>
            </form>
        </div>
        <?php
    }

    private function password_tab()
    {
        ?>
        <div class="gamxo-password">
            <h2>Alterar Senha</h2>
            <?php if (isset($_GET['message'])): ?>
                <?php if ($_GET['message'] == 'password_updated'): ?>
                    <div class="gamxo-alert success">Senha alterada com sucesso!</div>
                <?php elseif ($_GET['message'] == 'password_error'): ?>
                    <div class="gamxo-alert error">Erro ao alterar senha. Verifique os dados.</div>
                <?php endif; ?>
            <?php endif; ?>
            <form method="post" class="gamxo-form">
                <?php wp_nonce_field('update_password', 'password_nonce'); ?>
                <input type="hidden" name="action" value="update_password">
                <div class="form-group">
                    <label>Senha atual</label>
                    <input type="password" name="current_password" required>
                </div>
                <div class="form-group">
                    <label>Nova senha</label>
                    <input type="password" name="new_password" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirmar nova senha</label>
                    <input type="password" name="confirm_password" required>
                </div>
                <button type="submit" class="gamxo-btn">Alterar senha</button>
            </form>
        </div>
        <?php
    }

    private function friends_tab()
    {
        global $wpdb;
        $current_user_id = get_current_user_id();
        $table_friends = $wpdb->prefix . 'sv_user_friends';

        // Buscar Pedidos RECEBIDOS (Onde user_id_2 sou eu)
        $pending = $wpdb->get_results($wpdb->prepare(
            "SELECT u.ID, u.display_name, u.user_email 
             FROM $table_friends f 
             JOIN {$wpdb->users} u ON u.ID = f.user_id_1 
             WHERE f.user_id_2 = %d AND f.status = 'pending'",
            $current_user_id
        ));

        // Buscar Pedidos ENVIADOS por Mim (Onde user_id_1 sou eu)
        $sent_requests = $wpdb->get_results($wpdb->prepare(
            "SELECT u.ID, u.display_name 
             FROM $table_friends f 
             JOIN {$wpdb->users} u ON u.ID = f.user_id_2 
             WHERE f.user_id_1 = %d AND f.status = 'pending'",
            $current_user_id
        ));

        // Buscar Amigos Aceitos (Ambas direções)
        $friends = $wpdb->get_results($wpdb->prepare(
            "SELECT u.ID, u.display_name 
             FROM $table_friends f
             JOIN {$wpdb->users} u ON (u.ID = f.user_id_1 AND f.user_id_2 = %d) OR (u.ID = f.user_id_2 AND f.user_id_1 = %d)
             WHERE f.status = 'accepted'",
            $current_user_id,
            $current_user_id
        ));

        ?>
        <div class="gamxo-friends">
            <h2>Meus Amigos</h2>

            <!-- RECEBIDOS -->
            <?php if (!empty($pending)): ?>
                <div class="friends-section pending">
                    <h3>Solicitações Recebidas</h3>
                    <div class="friends-grid">
                        <?php foreach ($pending as $p): ?>
                            <div class="friend-card pending-card">
                                <?php echo get_avatar($p->ID, 64); ?>
                                <div class="info">
                                    <h4><?php echo esc_html($p->display_name); ?></h4>
                                    <p>Quer ser seu amigo</p>
                                </div>
                                <div class="actions">
                                    <button class="gamxo-btn small accept-friend-btn" data-id="<?php echo $p->ID; ?>">Aceitar</button>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- ENVIADOS -->
            <?php if (!empty($sent_requests)): ?>
                <div class="friends-section sent">
                    <h3>Solicitações Enviadas</h3>
                    <div class="friends-grid">
                        <?php foreach ($sent_requests as $s): ?>
                            <div class="friend-card sent-card" style="opacity: 0.7;">
                                <?php echo get_avatar($s->ID, 64); ?>
                                <div class="info">
                                    <h4><?php echo esc_html($s->display_name); ?></h4>
                                    <p>Aguardando resposta...</p>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <!-- LISTA DE AMIGOS -->
            <div class="friends-section list">
                <h3>Lista de Amigos (<?php echo count($friends); ?>)</h3>
                <?php if (empty($friends)): ?>
                    <p>Você ainda não tem amigos adicionados.</p>
                <?php else: ?>
                    <div class="friends-grid">
                        <?php foreach ($friends as $f): ?>
                            <div class="friend-card">
                                <?php echo get_avatar($f->ID, 64); ?>
                                <h4><?php echo esc_html($f->display_name); ?></h4>
                                <a href="<?php echo home_url('/?p=' . get_option('gamxo_account_page_id') . '&tab=profile&user_id=' . $f->ID); ?>"
                                    class="view-profile">Ver Perfil</a>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>

            <script>
                document.addEventListener('DOMContentLoaded', function () {
                    const navbarIdentity = document.getElementById('gamxo-launcher-identity');
                    if(!navbarIdentity) return; // Segurança contra erro JS se div não existir
                    const nonce = navbarIdentity.getAttribute('data-rest-nonce');
                    
                    document.querySelectorAll('.accept-friend-btn').forEach(btn => {
                        btn.addEventListener('click', function () {
                            const targetId = this.getAttribute('data-id');
                            this.innerText = 'Aceitando...';
                            this.disabled = true;
                            fetch('/wp-json/steamverde/v1/friend/accept', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                                body: JSON.stringify({ target_id: targetId })
                            })
                                .then(r => r.json())
                                .then(d => {
                                    if (d.status === 'accepted') {
                                        alert('Amigo aceito!');
                                        location.reload();
                                    } else {
                                        alert('Erro: ' + JSON.stringify(d));
                                        this.innerText = 'Tentar Novamente';
                                        this.disabled = false;
                                    }
                                })
                                .catch(e => {
                                    alert('Erro de conexão: ' + e);
                                    this.innerText = 'Erro';
                                });
                        });
                    });
                });
            </script>

            <style>
                .friends-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 15px;
                    margin-bottom: 30px;
                }

                .friend-card {
                    background: #1a1a1a;
                    padding: 15px;
                    border-radius: 8px;
                    text-align: center;
                    border: 1px solid #333;
                }

                .friend-card img {
                    border-radius: 50%;
                    margin-bottom: 10px;
                }

                .pending-card {
                    border-color: #ff9800;
                    box-shadow: 0 0 5px rgba(255,152,0,0.2);
                }
                
                .sent-card {
                    border-color: #777;
                    border-style: dashed;
                }

                .gamxo-btn.small {
                    padding: 5px 15px;
                    font-size: 12px;
                    cursor: pointer;
                }
            </style>
        </div>
        <?php
    }

    private function downloads_tab()
    {
        $downloads = $this->get_user_downloads();
        ?>
        <div class="gamxo-downloads">
            <h2>Meus Downloads</h2>
            <?php if (isset($_GET['download_removed']) && $_GET['download_removed'] == 'success'): ?>
                <div class="gamxo-alert success">Download removido do histórico com sucesso!</div>
            <?php elseif (isset($_GET['download_removed']) && $_GET['download_removed'] == 'error'): ?>
                <div class="gamxo-alert error">Erro ao remover download do histórico.</div>
            <?php endif; ?>
            <?php if (empty($downloads)): ?>
                <div class="no-downloads">
                    <p>Você ainda não fez nenhum download.</p>
                </div>
            <?php else: ?>
                <div class="downloads-grid">
                    <?php foreach ($downloads as $download):
                        $package_id = $download->package_id;
                        if (!get_post_status($package_id))
                            continue;
                        $permalink = get_permalink($package_id);
                        $thumbnail = get_the_post_thumbnail($package_id, 'medium');
                        $fallback_image = '<div class="download-item-no-image">Sem Imagem</div>'; ?>
                        <div class="download-item">
                            <a href="<?php echo esc_url($permalink); ?>">
                                <div class="download-item-image"><?php echo !empty($thumbnail) ? $thumbnail : $fallback_image; ?></div>
                                <div class="download-item-content">
                                    <h3><?php echo esc_html($download->package_name); ?></h3>
                                    <p class="download-count">Baixado <?php echo $download->download_count; ?> vez(es)</p>
                                </div>
                            </a>
                            <div class="download-item-actions">
                                <form method="post" class="remove-download-form">
                                    <?php wp_nonce_field('remove_download_' . $package_id, 'remove_download_nonce'); ?>
                                    <input type="hidden" name="action" value="remove_download_history">
                                    <input type="hidden" name="package_id" value="<?php echo $package_id; ?>">
                                    <button type="submit" class="remove-download-btn"
                                        onclick="return confirm('Tem certeza que deseja remover este download do seu histórico?')">
                                        🗑️ Remover
                                    </button>
                                </form>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    private function activities_tab()
    {
        $comments = $this->get_user_comments();
        ?>
        <div class="gamxo-activities">
            <h2>Minhas Atividades</h2>
            <?php if (empty($comments)): ?>
                <div class="no-activities">
                    <p>Você ainda não fez nenhum comentário.</p>
                </div>
            <?php else: ?>
                <div class="comments-list">
                    <?php foreach ($comments as $comment):
                        $post_title = get_the_title($comment->comment_post_ID);
                        $post_link = get_permalink($comment->comment_post_ID);
                        ?>
                        <div class="comment-item">
                            <div class="comment-header">
                                <h3><a href="<?php echo $post_link; ?>"><?php echo $post_title; ?></a></h3>
                                <span class="comment-date"><?php echo date('d/m/Y H:i', strtotime($comment->comment_date)); ?></span>
                            </div>
                            <div class="comment-content">
                                <?php echo wpautop($comment->comment_content); ?>
                            </div>
                            <div class="comment-status">
                                Status:
                                <?php echo $comment->comment_approved == 1 ? 'Aprovado' : ($comment->comment_approved == 0 ? 'Aguardando moderação' : 'Reprovado'); ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    private function delete_account_tab()
    {
        $user_data_count = $this->get_user_data_count();
        ?>
        <div class="gamxo-delete-account">
            <h2>Excluir Minha Conta e Dados</h2>
            <div class="delete-account-warning">
                <div class="gamxo-alert error">
                    <h3>⚠️ ATENÇÃO: AÇÃO IRREVERSÍVEL</h3>
                    <p>A exclusão da sua conta é <strong>PERMANENTE</strong> и não pode ser desfeita.</p>
                </div>
                <div class="user-data-summary">
                    <h3>Seus dados que serão excluídos:</h3>
                    <ul>
                        <li><strong>Perfil de usuário:</strong> Todas as suas informações pessoais</li>
                        <li><strong>Comentários:</strong> <?php echo $user_data_count['comments']; ?> comentário(s)</li>
                        <li><strong>Histórico de Downloads:</strong> <?php echo $user_data_count['downloads']; ?> registro(s)
                        </li>
                        <li><strong>Metadados:</strong> Todas as informações adicionais do seu perfil</li>
                    </ul>
                </div>
                <div class="consequences-warning">
                    <h3>Consequências:</h3>
                    <ul>
                        <li>❌ Você perderá acesso a todos os recursos do site</li>
                        <li>❌ Seus comentários e histórico de downloads serão removidos</li>
                        <li>❌ Não será possível recuperar nenhuma informação</li>
                    </ul>
                </div>
            </div>
            <form id="delete-account-form" method="post" class="gamxo-form">
                <?php wp_nonce_field('delete_account', 'delete_account_nonce'); ?>
                <input type="hidden" name="action" value="delete_account">
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="confirm_understanding" required>
                        Eu entendo que esta ação é <strong>IRREVERSÍVEL</strong> e todos os meus dados serão
                        <strong>PERMANENTEMENTE EXCLUÍDOS</strong>.
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="confirm_password_check" required>
                        Confirmo que esta é minha decisão final e desejo prosseguir com a exclusão.
                    </label>
                </div>
                <div class="form-group">
                    <label>Digite sua senha atual para confirmar:</label>
                    <input type="password" name="current_password" required>
                </div>
                <div class="form-group">
                    <label>Digite "<strong>EXCLUIR MINHA CONTA</strong>" para confirmar:</label>
                    <input type="text" name="confirm_text" required pattern="EXCLUIR MINHA CONTA">
                </div>
                <button type="submit" class="gamxo-btn danger"
                    onclick="return confirm('Tem CERTEZA ABSOLUTA que deseja excluir permanentemente sua conta e todos os seus dados? Esta ação não pode ser desfeita!')">
                    🗑️ EXCLUIR PERMANENTEMENTE MINHA CONTA
                </button>
            </form>
        </div>
        <?php
    }

    private function get_user_downloads()
    {
        global $wpdb;
        $user_id = get_current_user_id();
        $wpdm_table = $wpdb->prefix . 'ahm_user_download_counts';

        if ($wpdb->get_var("SHOW TABLES LIKE '$wpdm_table'") != $wpdm_table) {
            return array();
        }

        $downloads = $wpdb->get_results($wpdb->prepare(
            "SELECT d.package_id, p.post_title as package_name, MAX(d.download_count) as download_count
             FROM {$wpdm_table} d
             INNER JOIN {$wpdb->posts} p ON d.package_id = p.ID
             WHERE d.user = %d AND p.post_status = 'publish'
             GROUP BY d.package_id
             ORDER BY MAX(d.download_count) DESC",
            $user_id
        ));

        return $downloads;
    }

    private function get_user_comments()
    {
        $user_id = get_current_user_id();
        $args = array('user_id' => $user_id, 'orderby' => 'comment_date', 'order' => 'DESC', 'number' => 20);
        return get_comments($args);
    }

    private function get_download_count()
    {
        global $wpdb;
        $user_id = get_current_user_id();
        $wpdm_table = $wpdb->prefix . 'ahm_user_download_counts';
        if ($wpdb->get_var("SHOW TABLES LIKE '$wpdm_table'") != $wpdm_table) {
            return 0;
        }
        return $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(DISTINCT package_id) FROM {$wpdm_table} WHERE user = %d",
            $user_id
        )) ?: 0;
    }

    private function get_comments_count()
    {
        global $wpdb;
        $user_id = get_current_user_id();
        return $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->comments} WHERE user_id = %d AND comment_approved = 1", $user_id)) ?: 0;
    }

    private function get_recent_comment()
    {
        $comments = $this->get_user_comments();
        if ($comments && count($comments) > 0) {
            $comment = $comments[0];
            $post_title = get_the_title($comment->comment_post_ID);
            $post_link = get_permalink($comment->comment_post_ID);
            $output = '<div class="recent-comment"><div class="comment-header"><h4><a href="' . $post_link . '">' . $post_title . '</a></h4><span class="comment-date">' . date('d/m/Y H:i', strtotime($comment->comment_date)) . '</span></div><div class="comment-content">' . wpautop($comment->comment_content) . '</div></div>';
            return $output;
        } else {
            return '<p>Você ainda não fez nenhum comentário.</p>';
        }
    }

    private function get_last_download()
    {
        global $wpdb;
        $user_id = get_current_user_id();
        $wpdm_table = $wpdb->prefix . 'ahm_user_download_counts';

        if ($wpdb->get_var("SHOW TABLES LIKE '$wpdm_table'") != $wpdm_table) {
            return null;
        }

        return $wpdb->get_row($wpdb->prepare(
            "SELECT d.package_id, p.post_title as package_name
             FROM {$wpdm_table} d
             INNER JOIN {$wpdb->posts} p ON d.package_id = p.ID
             WHERE d.user = %d AND p.post_status = 'publish'
             ORDER BY d.package_id DESC
             LIMIT 1",
            $user_id
        ));
    }

    private function get_user_data_count()
    {
        $user_id = get_current_user_id();
        global $wpdb;
        $comments_count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->comments} WHERE user_id = %d", $user_id));
        $downloads_count = $this->get_download_count();
        return array('comments' => $comments_count ?: 0, 'downloads' => $downloads_count ?: 0);
    }

    public function handle_form_submissions()
    {
        if (!is_user_logged_in())
            return;

        if (isset($_POST['action']) && $_POST['action'] == 'update_profile') {
            if (!wp_verify_nonce($_POST['profile_nonce'], 'update_profile'))
                return;
            $user_id = get_current_user_id();
            $userdata = array('ID' => $user_id);
            if (!empty($_POST['email']))
                $userdata['user_email'] = sanitize_email($_POST['email']);
            if (!empty($_POST['display_name']))
                $userdata['display_name'] = sanitize_text_field($_POST['display_name']);
            wp_update_user($userdata);
            if (!empty($_POST['first_name']))
                update_user_meta($user_id, 'first_name', sanitize_text_field($_POST['first_name']));
            if (!empty($_POST['last_name']))
                update_user_meta($user_id, 'last_name', sanitize_text_field($_POST['last_name']));
            if (!empty($_POST['description']))
                update_user_meta($user_id, 'description', sanitize_textarea_field($_POST['description']));
            wp_redirect(add_query_arg('message', 'profile_updated', wp_get_referer()));
            exit;
        }

        if (isset($_POST['action']) && $_POST['action'] == 'update_password') {
            if (!wp_verify_nonce($_POST['password_nonce'], 'update_password'))
                return;
            $user = wp_get_current_user();
            if ($user && wp_check_password($_POST['current_password'], $user->user_pass, $user->ID) && $_POST['new_password'] === $_POST['confirm_password']) {
                wp_set_password($_POST['new_password'], $user->ID);
                wp_set_current_user($user->ID);
                wp_set_auth_cookie($user->ID);
                wp_redirect(add_query_arg('message', 'password_updated', wp_get_referer()));
                exit;
            } else {
                wp_redirect(add_query_arg('message', 'password_error', wp_get_referer()));
                exit;
            }
        }

        if (isset($_POST['action']) && $_POST['action'] == 'delete_account') {
            if (!wp_verify_nonce($_POST['delete_account_nonce'], 'delete_account'))
                return;
            $user = wp_get_current_user();
            if ($user && wp_check_password($_POST['current_password'], $user->user_pass, $user->ID) && $_POST['confirm_text'] === 'EXCLUIR MINHA CONTA') {
                $this->delete_user_account_data($user->ID);
                wp_logout();
                wp_redirect(home_url('/?account_deleted=true'));
                exit;
            } else {
                wp_redirect(add_query_arg('tab', 'delete-account&message=error', wp_get_referer()));
                exit;
            }
        }

        // Novo: Remover download do histórico
        if (isset($_POST['action']) && $_POST['action'] == 'remove_download_history') {
            $package_id = intval($_POST['package_id']);
            if (!wp_verify_nonce($_POST['remove_download_nonce'], 'remove_download_' . $package_id)) {
                return;
            }

            $user_id = get_current_user_id();

            if ($this->remove_download_from_history($user_id, $package_id)) {
                wp_redirect(add_query_arg('download_removed', 'success', wp_get_referer()));
                exit;
            } else {
                wp_redirect(add_query_arg('download_removed', 'error', wp_get_referer()));
                exit;
            }
        }
    }

    /**
     * Remove um download do histórico do usuário
     */
    private function remove_download_from_history($user_id, $package_id)
    {
        global $wpdb;
        $wpdm_table = $wpdb->prefix . 'ahm_user_download_counts';

        if ($wpdb->get_var("SHOW TABLES LIKE '$wpdm_table'") != $wpdm_table) {
            return false;
        }

        $result = $wpdb->delete(
            $wpdm_table,
            array(
                'user' => $user_id,
                'package_id' => $package_id
            ),
            array('%d', '%d')
        );

        return $result !== false;
    }

    private function delete_user_account_data($user_id)
    {
        global $wpdb;
        $comments = get_comments(array('user_id' => $user_id));
        foreach ($comments as $comment) {
            wp_delete_comment($comment->comment_ID, true);
        }
        require_once(ABSPATH . 'wp-admin/includes/user.php');
        wp_delete_user($user_id);
        return true;
    }

    public function delete_user_account()
    {
        check_ajax_referer('delete_account_nonce', 'nonce');
        if (!is_user_logged_in()) {
            wp_send_json_error('Usuário não autenticado');
        }
        $user = wp_get_current_user();
        if ($user && wp_check_password($_POST['current_password'], $user->user_pass, $user->ID)) {
            $this->delete_user_account_data($user->ID);
            wp_send_json_success('Conta excluída com sucesso');
        } else {
            wp_send_json_error('Senha incorreta');
        }
    }

    /**
     * AJAX handler para remover download do histórico
     */
    public function remove_download_history()
    {
        check_ajax_referer('remove_download_nonce', 'nonce');

        if (!is_user_logged_in()) {
            wp_send_json_error('Usuário não autenticado');
        }

        $user_id = get_current_user_id();
        $package_id = intval($_POST['package_id']);

        if ($this->remove_download_from_history($user_id, $package_id)) {
            wp_send_json_success('Download removido do histórico');
        } else {
            wp_send_json_error('Erro ao remover download do histórico');
        }
    }

    public function update_profile_photo()
    {
        check_ajax_referer('update_profile_photo_nonce', 'nonce');
        if (!is_user_logged_in())
            wp_die('Unauthorized');
        if (!function_exists('wp_handle_upload'))
            require_once(ABSPATH . 'wp-admin/includes/file.php');
        $movefile = wp_handle_upload($_FILES['profile_photo'], array('test_form' => false));
        if ($movefile && !isset($movefile['error'])) {
            update_user_meta(get_current_user_id(), 'custom_avatar', $movefile['url']);
            wp_send_json_success(array('url' => $movefile['url']));
        } else {
            wp_send_json_error(array('message' => $movefile['error']));
        }
    }

    public static function activate()
    {
        if (!get_option('gamxo_account_page_id')) {
            $page_id = wp_insert_post(array('post_title' => 'Minha Conta', 'post_content' => '[gamxo_user_account]', 'post_status' => 'publish', 'post_type' => 'page'));
            update_option('gamxo_account_page_id', $page_id);
        }
    }

    public static function deactivate()
    {
        $page_id = get_option('gamxo_account_page_id');
        if ($page_id)
            wp_delete_post($page_id, true);
        delete_option('gamxo_account_page_id');
    }
}

new GamxoUserAccount();

register_activation_hook(__FILE__, array('GamxoUserAccount', 'activate'));
register_deactivation_hook(__FILE__, array('GamxoUserAccount', 'deactivate'));

// Adicionar CSS
function gamxo_user_account_styles()
{
    ?>
    <style>
        /* --- ANIMAÇÃO DE BRILHO --- */
        @keyframes gamxo-glow-pulse {

            0%,
            100% {
                transform: scale(1);
                opacity: 0.8;
            }

            50% {
                transform: scale(1.1);
                opacity: 1;
            }
        }

        .gamxo-user-account {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .gamxo-account-header {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%);
            border-radius: 12px;
            color: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .gamxo-account-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 30px;
            border-bottom: 2px solid #dee2e6;
            flex-wrap: wrap;
        }

        .gamxo-account-tabs a {
            padding: 15px 20px;
            text-decoration: none;
            color: #2a2a2a;
            border-bottom: 3px solid transparent;
            transition: all 0.3s ease;
            white-space: nowrap;
        }

        .gamxo-account-tabs a:hover {
            background-color: rgba(76, 175, 80, 0.1);
        }

        .gamxo-account-tabs a.active {
            border-bottom-color: #4CAF50;
            color: #4CAF50;
            background-color: rgba(76, 175, 80, 0.05);
        }

        .gamxo-account-tabs a.logout-btn {
            margin-left: auto;
            color: #dc3545;
        }

        .gamxo-account-tabs a.logout-btn:hover {
            background-color: rgba(220, 53, 69, 0.1);
        }

        .gamxo-account-content {
            background: #fff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .gamxo-form .form-group {
            margin-bottom: 20px;
        }

        .gamxo-form label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }

        .gamxo-form input,
        .gamxo-form textarea {
            width: 100%;
            max-width: 500px;
            padding: 12px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            font-family: inherit;
        }

        .gamxo-btn {
            background: #4CAF50;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.3s ease;
        }

        .gamxo-btn:hover {
            background: #45a049;
        }

        .gamxo-btn.danger {
            background: #dc3545;
        }

        .gamxo-btn.danger:hover {
            background: #c82333;
        }

        .gamxo-alert {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 5px;
        }

        .gamxo-alert.success {
            background: #d4edda;
            color: #28a745;
            border: 1px solid #c3e6cb;
        }

        .gamxo-alert.error {
            background: #f8d7da;
            color: #dc3545;
            border: 1px solid #f5c6cb;
        }

        /* Grid Downloads */
        .downloads-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 20px;
        }

        .download-item {
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #dee2e6;
            overflow: hidden;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .download-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }

        .download-item a {
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .download-item-image img,
        .download-item-no-image {
            width: 100%;
            height: auto;
            display: block;
            aspect-ratio: 4 / 5;
            object-fit: cover;
        }

        .download-item-no-image {
            width: 100%;
            aspect-ratio: 4 / 5;
            background-color: #e9ecef;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
        }

        .download-item-content {
            padding: 15px;
        }

        .download-item h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 1.1em;
            line-height: 1.4;
            color: #333;
        }

        .download-count {
            font-size: 0.9em;
            color: #6c757d;
            margin: 0;
        }

        .download-item-actions {
            padding: 10px 15px;
            border-top: 1px solid #e0e0e0;
            background: #f8f9fa;
        }

        .remove-download-form {
            text-align: center;
        }

        .remove-download-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s ease;
            width: 100%;
        }

        .remove-download-btn:hover {
            background: #c82333;
        }

        /* Dashboard Stats */
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #dee2e6;
            margin-bottom: 20px;
            transition: transform 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
        }

        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
            margin: 0;
        }

        .stat-card .stat-text {
            font-size: 1.1em;
            font-weight: 500;
            color: #333;
            margin: 10px 0 0 0;
        }

        .stat-card .stat-text a {
            color: inherit;
            text-decoration: none;
        }

        .stat-card .stat-text a:hover {
            color: #4CAF50;
        }

        .dashboard-stats {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .user-avatar {
            position: relative;
        }

        .user-avatar button {
            margin-top: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s ease;
        }

        .user-avatar button:hover {
            background: #45a049;
        }

        .no-downloads,
        .no-activities {
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            background: #f8f9fa;
            border: 1px dashed #dee2e6;
            border-radius: 8px;
        }

        .comments-list {
            margin-top: 20px;
        }

        .comment-item {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background: #f9f9f9;
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .comment-header h3 {
            margin: 0;
            font-size: 18px;
        }

        .comment-header h3 a {
            color: #4CAF50;
            text-decoration: none;
        }

        .comment-header h3 a:hover {
            text-decoration: underline;
        }

        .comment-date {
            color: #757575;
            font-size: 14px;
        }

        .comment-content {
            margin-bottom: 10px;
            line-height: 1.6;
        }

        .comment-status {
            font-style: italic;
            color: #757575;
            font-size: 14px;
        }

        .recent-comment {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            background: #f9f9f9;
        }

        .gamxo-login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 60vh;
            padding: 20px;
        }

        .gamxo-login-form {
            background: #fff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            width: 100%;
            max-width: 400px;
        }

        .gamxo-login-header {
            text-align: center;
            margin-bottom: 25px;
        }

        .gamxo-login-header h2 {
            color: #4CAF50;
            margin-bottom: 10px;
        }

        .gamxo-delete-account .delete-account-warning {
            margin-bottom: 30px;
        }

        .gamxo-delete-account .user-data-summary,
        .gamxo-delete-account .consequences-warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }

        /* --- STATUS VIP STYLING --- */
        .gamxo-account-header .user-info h1 {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }

        .gamxo-user-status-container {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        /* BADGE */
        .gamxo-user-badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 14px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 20px;
            vertical-align: middle;
            letter-spacing: 0.5px;
            text-shadow: none;
            margin-bottom: 5px;
        }

        .gamxo-badge-icon {
            width: 1.1em;
            height: 1.1em;
            display: inline-block;
            margin-right: 6px;
            fill: currentColor;
        }

        .gamxo-user-badge.is-assinante {
            background: linear-gradient(135deg, #FFD700, #FFB900);
            color: #4A2E04;
            border: 1px solid #FFC107;
            box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
        }

        .gamxo-user-badge.is-assinante .gamxo-badge-icon {
            animation: gamxo-glow-pulse 2s infinite ease-in-out;
        }

        .gamxo-user-badge.not-assinante {
            background-color: rgba(0, 0, 0, 0.1);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.3);
            opacity: 0.8;
        }

        /* DATA DE EXPIRAÇÃO */
        .gamxo-sub-info {
            font-size: 12px;
            font-weight: 500;
            padding: 3px 8px;
            border-radius: 4px;
            margin-left: 2px;
            display: inline-block;
        }

        .gamxo-sub-info.expiry {
            background: rgba(0, 0, 0, 0.15);
            color: #f0f0f0;
        }

        .gamxo-sub-info.lifetime {
            background: #E91E63;
            color: white;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(233, 30, 99, 0.3);
        }

        .gamxo-sub-info.expired {
            background: #dc3545;
            color: white;
        }

        /* No card de Status do Dashboard */
        .stat-card.status-card .stat-text-status {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }

        .stat-card .gamxo-user-badge {
            margin: 0;
            font-size: 1.1rem;
        }

        @media (max-width: 768px) {
            .gamxo-account-header {
                flex-direction: column;
                text-align: center;
            }

            .downloads-grid,
            .dashboard-stats {
                grid-template-columns: 1fr;
            }

            .gamxo-account-header .user-info h1 {
                justify-content: center;
            }

            .gamxo-user-status-container {
                align-items: center;
            }
        }
    </style>
    <?php
}
add_action('wp_head', 'gamxo_user_account_styles');

// Adicionar JS
function gamxo_user_account_scripts()
{
    ?>
    <script>
        jQuery(document).ready(function ($) {
            $('#profile_photo').change(function () {
                if (this.files && this.files[0]) {
                    var formData = new FormData();
                    formData.append('action', 'update_profile_photo');
                    formData.append('nonce', '<?php echo wp_create_nonce('update_profile_photo_nonce'); ?>');
                    formData.append('profile_photo', this.files[0]);
                    $.ajax({
                        url: '<?php echo admin_url('admin-ajax.php'); ?>',
                        type: 'POST', data: formData, processData: false, contentType: false,
                        success: function (response) {
                            if (response.success) {
                                var newUrl = response.data.url + '?' + new Date().getTime();
                                $('.user-avatar img').attr('src', newUrl);
                                alert('Foto atualizada com sucesso!');
                            } else { alert('Erro: ' + response.data.message); }
                        },
                        error: function () { alert('Erro ao enviar a imagem.'); }
                    });
                }
            });

            $('#delete-account-form').on('submit', function (e) {
                var confirmText = $('input[name="confirm_text"]').val();
                if (confirmText !== 'EXCLUIR MINHA CONTA') {
                    e.preventDefault();
                    alert('Por favor, digite exatamente "EXCLUIR MINHA CONTA" para confirmar.');
                    return false;
                }
                return confirm('⚠️ ATENÇÃO FINAL!\n\nTem CERTEZA ABSOLUTA que deseja excluir PERMANENTEMENTE sua conta?');
            });

            // AJAX para remover downloads
            $('.remove-download-form').on('submit', function (e) {
                e.preventDefault();

                var form = $(this);
                var packageId = form.find('input[name="package_id"]').val();

                if (!confirm('Tem certeza que deseja remover este download do seu histórico?')) {
                    return false;
                }

                $.ajax({
                    url: '<?php echo admin_url('admin-ajax.php'); ?>',
                    type: 'POST',
                    data: {
                        action: 'remove_download_history',
                        package_id: packageId,
                        nonce: '<?php echo wp_create_nonce('remove_download_nonce'); ?>'
                    },
                    success: function (response) {
                        if (response.success) {
                            form.closest('.download-item').fadeOut(300, function () {
                                $(this).remove();
                                // Recarregar a página se não houver mais downloads
                                if ($('.download-item').length === 0) {
                                    location.reload();
                                }
                            });
                        } else {
                            alert('Erro: ' + response.data);
                        }
                    },
                    error: function () {
                        alert('Erro ao remover download. Tente novamente.');
                    }
                });
            });
        });
    </script>
    <?php
}
add_action('wp_footer', 'gamxo_user_account_scripts');

// --- ADICIONE ISSO NO FINAL DO SEU ARQUIVO PHP DO PLUGIN ---
add_action('rest_api_init', function () {
    // Rota: steamverde.net/wp-json/steamverde/v1/avatar_find/DADO_DO_LOGIN
    register_rest_route('steamverde/v1', '/avatar_find/(?P<login_data>.+)', array(
        'methods' => 'GET',
        'callback' => 'sv_api_smart_avatar_lookup',
        'permission_callback' => '__return_true' // Público para o launcher ler
    ));

    // Nova Rota para Autenticação Segura (Nonce)
    register_rest_route('steamverde/v1', '/auth-nonce', array(
        'methods' => 'GET',
        'callback' => 'sv_api_get_secure_nonce',
        'permission_callback' => '__return_true'
    ));

    // ROTAS DE AMIGOS (Injetadas)
    register_rest_route('steamverde/v1', '/friend/request', ['methods' => 'POST', 'callback' => 'sv_api_friend_request', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/accept', ['methods' => 'POST', 'callback' => 'sv_api_friend_accept', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/pending', ['methods' => 'GET', 'callback' => 'sv_api_friend_pending', 'permission_callback' => 'sv_api_auth_check']);
    register_rest_route('steamverde/v1', '/friend/check', ['methods' => 'GET', 'callback' => 'sv_api_friend_check', 'permission_callback' => 'sv_api_auth_check']);
});

function sv_api_get_secure_nonce()
{
    if (!is_user_logged_in()) {
        return new WP_Error('rest_forbidden', 'User not logged in', array('status' => 401));
    }
    return array(
        'nonce' => wp_create_nonce('wp_rest'),
        'user_id' => get_current_user_id()
    );
}

function sv_api_smart_avatar_lookup($data)
{
    $input = urldecode($data['login_data']);
    $user = false;

    // 1. Verifica se é um e-mail
    if (is_email($input)) {
        $user = get_user_by('email', $input);
    } else {
        // 2. Se não for email, tenta pelo login (nome de usuário)
        $user = get_user_by('login', $input);
    }

    if (!$user) {
        // Retorna erro se não achar ninguém
        return new WP_Error('no_user', 'Usuário não encontrado', array('status' => 404));
    }

    $user_id = $user->ID;

    // 3. Pega a foto customizada do seu plugin
    $custom_avatar = get_user_meta($user_id, 'custom_avatar', true);

    // 4. Se não tiver, pega o padrão do WP
    $avatar_url = !empty($custom_avatar) ? $custom_avatar : get_avatar_url($user_id);

    // 5. Garante HTTPS
    $url = set_url_scheme($avatar_url, 'https');

    return array(
        'id' => $user_id,
        'username' => $user->user_login,
        'avatar' => $url
    );
}
// --- FIM DA LOGICA DE AMIGOS (MANTIDA NO OUTRO PLUGIN) ---
// Apenas mantivemos a rota de AUTH NONCE acima para o launcher conseguir autenticar.
?>
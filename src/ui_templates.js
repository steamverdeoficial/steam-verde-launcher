// src/ui_templates.js

const HTML_PROFILE_MODAL = `
<div class="sv-modal-header">
    <span style="font-weight:bold; font-size:16px;">PERFIL DE USUÁRIO</span>
    <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeProfile()">FECHAR (X)</span>
</div>
<div class="sv-modal-body sv-profile-body">
    <div class="sv-profile-header">
        <div class="sv-profile-avatar-wrapper">
            <img id="sv-profile-avatar" src="" onerror="this.src='https://secure.gravatar.com/avatar/?d=mm'">
        </div>
        <div class="sv-profile-info">
            <div class="sv-profile-name" id="sv-profile-name">Carregando...</div>
            <div class="sv-profile-id" id="sv-profile-id">ID: ...</div>
            <div class="sv-profile-actions" id="sv-profile-actions">
                <!-- Buttons injected here -->
            </div>
        </div>
    </div>
    
    <div class="sv-profile-tabs">
        <button class="sv-profile-tab active" onclick="window.svSwitchProfileTab('games')">JOGOS</button>
        <button class="sv-profile-tab" onclick="window.svSwitchProfileTab('achievements')">CONQUISTAS</button>
        <button class="sv-profile-tab" onclick="window.svSwitchProfileTab('friends')">AMIGOS</button>
    </div>

    <div id="sv-profile-content-games" class="sv-profile-content">
        <!-- Game List -->
    </div>
    <div id="sv-profile-content-achievements" class="sv-profile-content">
        <!-- Achievements List -->
    </div>
    <div id="sv-profile-content-friends" class="sv-profile-content">
        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="sv-friend-search" placeholder="ID do Usuário..." style="flex:1; background:#282c34; border:1px solid #444; color:#fff; padding:8px; border-radius:4px;">
            <button onclick="window.svSearchUser()" style="background:#a4d007; color:#1b2838; border:none; font-weight:bold; padding:0 15px; border-radius:4px; cursor:pointer;">VER PERFIL</button>
        </div>
        <div id="sv-friends-list">
             <!-- Friends List -->
        </div>
    </div>
</div>
`;

const HTML_SETTINGS_MODAL = `
<div class="sv-modal-header">
    <span style="font-weight:bold; font-size:16px;">CONFIGURAÇÕES</span>
    <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeSettings()">FECHAR (X)</span>
</div>
<div class="sv-modal-body">
    <div class="sv-settings-section">
        <div class="sv-settings-title">DIRETÓRIO DE INSTALAÇÃO</div>
        <div class="sv-settings-desc">Escolha onde seus jogos serão baixados e instalados.</div>
        <div class="sv-path-selector">
            <input type="text" id="sv-settings-path" readonly value="...">
            <button onclick="window.ipc.changeDownloadPath()">ALTERAR</button>
        </div>
    </div>

    <div class="sv-settings-separator"></div>

    <div class="sv-settings-section">
        <div class="sv-settings-title">PRIVACIDADE DO PERFIL</div>
        
        <div class="sv-setting-row">
            <div class="sv-setting-label">
                <span>Visibilidade das Conquistas</span>
                <small>Quem pode ver suas conquistas desbloqueadas</small>
            </div>
            <select id="sv-privacy-profile" onchange="window.svSavePrivacy()">
                <option value="public">Público (Todos)</option>
                <option value="friends">Somente Amigos</option>
                <option value="private">Privado (Ninguém)</option>
            </select>
        </div>

        <div class="sv-setting-row">
            <div class="sv-setting-label">
                <span>Visibilidade da Biblioteca</span>
                <small>Quem pode ver seus jogos baixados</small>
            </div>
            <select id="sv-privacy-library" onchange="window.svSavePrivacy()">
                <option value="public">Público (Todos)</option>
                <option value="friends">Somente Amigos</option>
                <option value="private">Privado (Ninguém)</option>
            </select>
        </div>
    </div>
    
    <div class="sv-settings-separator"></div>
    <div style="font-size:11px; color:#666; text-align:center; margin-top:20px;">
        Alterações de privacidade são salvas automaticamente.
    </div>
</div>
`;

const HTML_TOOLTIP = `
<div id="sv-tooltip" class="sv-tooltip">
    <div class="sv-tooltip-title" id="sv-tooltip-title"></div>
    <div class="sv-tooltip-desc" id="sv-tooltip-desc"></div>
</div>
`;

const HTML_CHAT_MODAL = `
<div id="sv-chat-modal">
    <div class="sv-chat-header" onclick="window.svToggleChatCollapse()">
        <span id="sv-chat-title" style="flex:1">CHAT</span>
        <span id="sv-chat-trash-btn" onclick="event.stopPropagation(); window.svClearChatHistory()" style="cursor:pointer; margin-right:10px; font-size:14px" title="Limpar Histórico">🗑️</span>
        <span id="sv-chat-mute-btn" onclick="event.stopPropagation(); window.svToggleMute()" style="cursor:pointer; margin-right:10px; font-size:12px" title="Silenciar">🔊</span>
        <span id="sv-chat-close-btn" onclick="event.stopPropagation(); window.svCloseChatUI()" style="color:#ff4d4d; cursor:pointer">X</span>
    </div>
    <div id="sv-chat-body" class="sv-chat-body"></div>
    <div class="sv-chat-input-area">
        <input type="text" id="sv-chat-input" class="sv-chat-input" placeholder="Enviar mensagem..." onkeypress="if(event.key==='Enter') window.svSendChatMsg()">
        <button onclick="window.svSendChatMsg()" style="background:#a4d007; color:#000; border:none; padding:0 10px; border-radius:4px; cursor:pointer; font-weight:bold;">></button>
    </div>
</div>
`;

module.exports = { HTML_PROFILE_MODAL, HTML_SETTINGS_MODAL, HTML_TOOLTIP, HTML_CHAT_MODAL };

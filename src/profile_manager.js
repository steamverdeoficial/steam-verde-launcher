const { ipcMain, dialog } = require('electron');
const axios = require('axios');
const fs = require('fs');
const firebaseMgr = require('./firebase_manager');

// BASE URL should match user's WordPress URL
const API_BASE = 'https://steamverde.net/wp-json/steamverde/v1';

class ProfileManager {
    constructor(mainWindow, userDataPath, notificationCallback = null) {
        this.mainWindow = mainWindow;
        this.userDataPath = userDataPath;
        this.notificationCallback = notificationCallback;
        this.lastReceivedCount = 0;
        this.currentUser = { id: 0, name: 'Guest', avatar: '' };
        this.settings = {
            privacyProfile: 'public',
            privacyLibrary: 'public'
        };
        this.nonce = '';
        this.cookieString = '';
    }

    setCurrentUser(user, cookieString = '') {
        this.currentUser = user || { id: 0, name: 'Guest', avatar: '' };
        // Garante que name nunca seja nulo
        if (!this.currentUser.name || this.currentUser.name === 'undefined') this.currentUser.name = 'Assinante';

        if (cookieString) this.cookieString = cookieString;

        // FIXED: Não esperar pelo nonce, tentar com cookies apenas
        if (this.cookieString && (!this.currentUser.id || this.currentUser.id === 0)) {
            console.log('[PROFILE] Triggering resolveUserId from setCurrentUser (cookies available)');
            this.resolveUserId();
        }
    }

    setNonce(nonce) {
        this.nonce = nonce;
        console.log('Nonce definido:', nonce);
        // Tenta novamente se ainda não tiver ID
        if (!this.currentUser.id || this.currentUser.id === 0) {
            this.resolveUserId();
        }
    }

    async resolveUserId(cookieStrVal = null) {
        console.log('[PROFILE] resolveUserId chamado.');
        if (cookieStrVal) this.cookieString = cookieStrVal;

        if (!this.cookieString) {
            console.log('[PROFILE] Sem cookies para resolver ID.');
            return;
        }

        try {
            console.log('[PROFILE] Tentando resolver User ID via API...');
            const headers = {
                'Cookie': this.cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamVerdeLauncher/1.2.1'
            };
            if (this.nonce) headers['X-WP-Nonce'] = this.nonce;

            // 1. TENTAR VIA ENDPOINT TOKENIZADO /me (Bypass de permissão de Assinante)
            let resolved = false;
            try {
                const urlMe = `${API_BASE}/me`;
                console.log(`[HTTP] GET ${urlMe}`);
                const resMe = await axios.get(urlMe, { headers });
                if (resMe.data && resMe.data.id) {
                    console.log('[PROFILE] ID resolvido via /me:', resMe.data.id);
                    this.currentUser.id = resMe.data.id;
                    try { firebaseMgr.init(this.currentUser.id); } catch (e) { }
                    if (resMe.data.name) this.currentUser.name = resMe.data.name;
                    // Tenta pegar avatar
                    if (resMe.data.avatar_urls) {
                        const urls = Object.values(resMe.data.avatar_urls);
                        if (urls.length > 0) this.currentUser.avatar = urls[urls.length - 1];
                    }
                    resolved = true;
                }
            } catch (eMe) {
                console.log('[PROFILE] /me falhou:', eMe.message);
                if (eMe.response) console.log('[PROFILE] /me status:', eMe.response.status);
            }

            // 2. FALLBACK API NATIVA (Se a primeira falhar)
            if (!resolved) {
                console.log('[PROFILE] Tentando API Nativa /wp/v2/users/me...');
                const res = await axios.get('https://steamverde.net/wp-json/wp/v2/users/me', { headers });
                if (res.data && res.data.id) {
                    this.currentUser.id = res.data.id;
                    try {
                        firebaseMgr.init(this.currentUser.id);
                        // [PRIVACY] Load settings
                        const p = await firebaseMgr.getPrivacy(this.currentUser.id);
                        if (p) this.settings = { ...this.settings, ...p };
                    } catch (e) { }
                    if (res.data.name) this.currentUser.name = res.data.name;
                    this.currentUser.name = res.data.name || '';
                    if (res.data.avatar_urls) {
                        const urls = Object.values(res.data.avatar_urls);
                        if (urls.length > 0) this.currentUser.avatar = urls[urls.length - 1];
                    }
                    console.log('[PROFILE] ID resolvido via nativa:', res.data.id);
                }
            }

            // PÓS-RESOLUÇÃO: Buscar perfil completo e atualizar UI
            if (this.currentUser.id > 0) {
                console.log('[PROFILE] Buscando perfil completo para ID:', this.currentUser.id);
                try {
                    const fullProfile = await this.getProfile(this.currentUser.id);
                    if (fullProfile) {
                        if (fullProfile.avatar) this.currentUser.avatar = fullProfile.avatar;
                        if (fullProfile.nickname) this.currentUser.name = fullProfile.nickname;
                    }
                } catch (errProfile) { }
                this.updateSidebarUI();
            }

        } catch (e) {
            console.warn('[PROFILE] Falha Geral ResolveUserId:', e.message);
            if (e.response) console.log('[PROFILE] Status Geral:', e.response.status);
            // Mantém Guest (0)
        }
    }

    setMainWindow(window) {
        this.mainWindow = window;
        this.startPolling();
        this.setupChatListeners();
        if (this.currentUser && this.currentUser.id && this.currentUser.id !== 0) {
            this.updateSidebarUI();
        }
    }

    setupChatListeners() {
        // [FIREBASE] Configurar listeners globais (notificações)
        try {
            const firebaseMgr = require('./firebase_manager');
            firebaseMgr.onNotification((senderId, notif) => {
                console.log("[PROFILE] Callback Notificação. Window OK?", (this.mainWindow && !this.mainWindow.isDestroyed()));
                if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                    console.log("[PROFILE] Enviando IPC chat-notification para renderer");
                    this.mainWindow.webContents.send('chat-notification', senderId, notif.text);

                    // [FAILSAFE REMOVED] - Renderer agora lida robustamente com IPC
                    // this.mainWindow.webContents.executeJavaScript(...)
                }
            });
        } catch (e) { console.error("[PROFILE] Erro setupChatListeners:", e); }
    }

    onRendererReady() {
        console.log('[PROFILE] Renderer Signal: Ready. Refreshing listeners.');
        this.setupChatListeners();
    }

    updateSidebarUI() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            // [SANITIZATION] Bloqueia 'undefined'
            const safeUser = {
                id: (this.currentUser && this.currentUser.id) ? this.currentUser.id : 0,
                name: (this.currentUser && this.currentUser.name && this.currentUser.name !== 'undefined') ? this.currentUser.name : 'Assinante',
                avatar: (this.currentUser && this.currentUser.avatar) ? this.currentUser.avatar : 'https://secure.gravatar.com/avatar/?d=mm'
            };

            this.mainWindow.webContents.send('update-user-info', safeUser);

            this.mainWindow.webContents.executeJavaScript(`
                if(window.svUserInfo) window.svUserInfo = ${JSON.stringify(safeUser)};
            `).catch(() => { });
        }
    }

    async getProfile(targetId) {
        console.log(`[PROFILE] getProfile chamado para ID: ${targetId}`);
        if (!targetId) targetId = this.currentUser.id;
        if (!targetId) {
            await new Promise(r => setTimeout(r, 500));
            targetId = this.currentUser.id;
        }

        let profileData = null;
        try {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                const result = await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/profile/${targetId}?_t=${Date.now()}', {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}'
                    },
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);

                if (result.error) throw new Error(result.error);
                // Tratar erro 404 da API
                if (result.code === 'not_found' || (result.data && result.data.status === 404)) {
                    return {
                        id: targetId,
                        nickname: 'Usuário não encontrado',
                        avatar: 'https://secure.gravatar.com/avatar/?d=mm',
                        library: [], achievements: [], friends: [],
                        error: true
                    };
                }

                if (result.code && result.message && result.data && result.data.status > 299) {
                    throw new Error(result.message);
                }

                profileData = result;
            } else {
                throw new Error("MainWindow unavailable");
            }

            // [PRIVACY BLOCKER]
            if (String(targetId) !== String(this.currentUser.id)) {
                const priv = await firebaseMgr.getPrivacy(targetId);
                if (priv) {
                    // Mapping: privacyProfile -> Achievements Visibility
                    const pAchievs = priv.privacyProfile || 'public';
                    const pLibrary = priv.privacyLibrary || 'public';

                    const isFriend = profileData.friends && Array.isArray(profileData.friends) && profileData.friends.some(f => String(f.id) === String(this.currentUser.id));

                    // Block Achievements
                    if (pAchievs === 'private' || (pAchievs === 'friends' && !isFriend)) {
                        profileData.achievements = [];
                        profileData.privacyAchievementsBlocked = true;
                    }

                    // Block Library
                    if (pLibrary === 'private' || (pLibrary === 'friends' && !isFriend)) {
                        profileData.library = [];
                        profileData.privacyLibraryBlocked = true;
                    }
                }
            }

            // [SYNC] Atualizar settings locais se for meu perfil
            if (String(targetId) === String(this.currentUser.id)) {
                if (profileData.privacy) {
                    this.settings.privacyProfile = profileData.privacy.profile || 'public';
                    this.settings.privacyLibrary = profileData.privacy.library || 'public';
                }
                // [FIREBASE] Monitorar amigos
                if (profileData.friends && Array.isArray(profileData.friends)) {
                    const fids = profileData.friends.map(f => f.id);
                    firebaseMgr.watchFriends(fids, (fid, status) => {
                        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                            this.mainWindow.webContents.send('friend-status', { id: fid, status });
                        }
                    });
                }

            }

            // [HYDRATION] Preencher dados visuais usando cache local
            if (profileData.achievements && Array.isArray(profileData.achievements)) {
                console.log(`[PROFILE] Hidratando ${profileData.achievements.length} conquistas...`);
                try {
                    const LA = require('./achievements_local');
                    const localList = LA.getList();
                    profileData.achievements = profileData.achievements.map(ach => {
                        // ach.id vem do backend (ex: "ACH_01")
                        // ach.app_id vem do backend (ex: "489830")
                        let key = ach.id && ach.id.includes('-') ? ach.id.split('-')[1] : ach.id;

                        const foundLocal = localList.find(l => l.id === key);
                        if (foundLocal) {
                            return {
                                ...ach,
                                title: foundLocal.title,
                                description: foundLocal.desc,
                                icon: foundLocal.icon,
                                type: 'launcher',
                                unlocked: true
                            };
                        }

                        // Fallback para Conquistas de Jogos (Remotas)
                        const matchingGame = (profileData.games && Array.isArray(profileData.games)) ? profileData.games.find(g => String(g.app_id) === String(ach.app_id)) : null;

                        return {
                            ...ach,
                            title: ach.title || key || 'Conquista Secreta',
                            description: ach.description || 'Desbloqueada em ' + (ach.unlocked_at || '???'),
                            icon: ach.icon || (ach.app_id ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${ach.app_id}/capsule_184x69.jpg` : ''),
                            gameName: ach.game_name || (matchingGame ? matchingGame.name : (ach.app_id ? `Jogo ${ach.app_id}` : 'Outros Jogos')),
                            type: 'game',
                            unlocked: true
                        };
                    });
                } catch (errHyd) { console.error('[PROFILE] Erro hydration:', errHyd); }
            }
            return profileData;

        } catch (e) {
            console.warn(`[PROFILE] Falha no Browser Fetch, tentando Axios fallback: ${e.message}`);
            // Fallback AXIOS (Sem cookies, mas funciona para perfis públicos ou se a janela estiver fechada)
            try {
                const headers = {};
                if (this.cookieString) {
                    headers['Cookie'] = this.cookieString;
                    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamVerdeLauncher/1.2.1';
                }
                if (this.nonce) headers['X-WP-Nonce'] = this.nonce;

                const res = await axios.get(`${API_BASE}/profile/${targetId}`, { timeout: 3000, headers });
                return res.data;
            } catch (axErr) {
                console.error(`[PROFILE] Fallback Axios também falhou: ${axErr.message}`);

                const is404 = axErr.response && axErr.response.status === 404;
                const errorMsg = is404 ? 'Usuário não encontrado' : 'Erro de Conexão';

                return {
                    id: targetId,
                    nickname: targetId == this.currentUser.id ? this.currentUser.name : errorMsg,
                    avatar: 'https://secure.gravatar.com/avatar/?d=mm',
                    library: [],
                    achievements: [],
                    friends: [],
                    error: true
                };
            }
        }
    }

    async addFriend(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/request', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}'
                    },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);
        } catch (e) { return { success: false, message: 'Erro ao adicionar' }; }
    }

    async syncLibrary(games) {
        if (!this.currentUser || !this.currentUser.id || this.currentUser.id === 0) return;
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        const simpleList = games.map(g => ({
            name: g.name,
            version: g.version || '1.0',
            image: g.cover || g.image || '',
            appId: g.path ? g.path.split(/[\\/]/).pop() : null
        }));

        try {
            console.log('[SYNC] Enviando biblioteca...');
            const result = await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/library/sync', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}'
                    },
                    body: JSON.stringify({ games: ${JSON.stringify(simpleList)} }),
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);
            console.log('[SYNC] Resultado:', result);
        } catch (e) {
            console.warn('[SYNC] Falha:', e.message);
        }
    }

    async syncAchievements(achievements) {
        if (!this.currentUser || !this.currentUser.id || this.currentUser.id === 0) return;
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

        const payloadItems = achievements.filter(a => a.unlocked).map(a => ({
            id: a.id.includes('-') ? a.id : `0-${a.id}`,
            title: a.title,
            description: a.description,
            icon: a.icon,
            gameName: a.gameName
        }));

        if (payloadItems.length === 0) return;

        try {
            console.log(`[SYNC] Enviando ${payloadItems.length} conquistas (com metadata):`, payloadItems.slice(0, 1), '...');

            const result = await this.mainWindow.webContents.executeJavaScript(`
                (function() {
                    // [FIX] Dynamic Nonce Retrieval
                    let freshNonce = '${this.nonce}';
                    try {
                        if (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) freshNonce = wpApiSettings.nonce;
                        else if (typeof userSettings !== 'undefined' && userSettings.nonce) freshNonce = userSettings.nonce;
                        // [FIX] API Nonce Endpoint should have been called before in Main, so this.nonce is fresh.
                    } catch(e) {}

                    return fetch('${API_BASE}/achievements/sync', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': freshNonce
                        },
                        body: JSON.stringify({ 
                            achievements: ${JSON.stringify(payloadItems)}
                        }),
                        credentials: 'include'
                    }).then(res => res.json()).catch(err => ({ error: err.toString() }));
                })();
            `);
            console.log('[SYNC] Resultado Sync Achievements:', result);
        } catch (e) { console.warn('Sync Ach Falhou:', e.message); }
    }

    async acceptFriendRequest(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(r=>r.json()).catch(e=>({error: e.toString()}))
            `);
        } catch (e) { return { success: false }; }
    }
    async rejectFriendRequest(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/reject', { // Oops, API não tem reject endpoint, geralmente deleta? Vamos assumir remove
                    method: 'POST', // Na verdade não implementei reject route no backend, mas 'remove' ou 'reject' se houver
                    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(r=>r.json()).catch(e=>({error: e.toString()}))
            `);
        } catch (e) { return { success: false }; }
    }

    // NOVOS MÉTODOS DE GERENCIAMENTO (Via Browser Context)
    async removeFriend(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/remove', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' 
                    },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);
        } catch (e) { console.error('Error removing friend:', e); return { success: false }; }
    }

    async blockFriend(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/block', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' 
                    },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);
        } catch (e) { console.error('Error blocking friend:', e); return { success: false }; }
    }

    async unblockFriend(targetId) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return { success: false };
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/unblock', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' 
                    },
                    body: JSON.stringify({ target_id: ${targetId} }),
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);
        } catch (e) { console.error('Error unblocking friend:', e); return { success: false }; }
    }

    async getBlockedUsers() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return [];
        try {
            return await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/blocked', {
                    headers: { 'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' },
                    credentials: 'include'
                }).then(res => res.json()).catch(err => [])
            `);
        } catch (e) { return []; }
    }

    async savePrivacy(settings) {
        this.settings = { ...this.settings, ...settings };
        try {
            await axios.post(`${API_BASE}/settings/update`, {
                privacy_profile: settings.privacyProfile,
                privacy_library: settings.privacyLibrary
            });
        } catch (e) { }
    }

    async checkFriendRequests() {
        if (!this.currentUser || !this.currentUser.id || !this.mainWindow || this.mainWindow.isDestroyed()) return;

        console.log('[PROFILE] Verificando Friend Requests (Via Browser Context)...');

        try {
            // Executa fetch DENTRO da janela do navegador (onde os cookies existem)
            // Isso evita 403 Forbidden por falta de cookie de sessão
            const result = await this.mainWindow.webContents.executeJavaScript(`
                fetch('${API_BASE}/friend/pending', {
                    headers: { 'X-WP-Nonce': (typeof wpApiSettings !== 'undefined' && wpApiSettings.nonce) ? wpApiSettings.nonce : '${this.nonce}' },
                    credentials: 'include'
                }).then(res => res.json()).catch(err => ({ error: err.toString() }))
            `);

            if (result.error) throw new Error(result.error);
            if (result.data && result.data.status === 403) throw new Error('WP Auth Error 403 (Browser)');

            let payload = { received: [], sent: [] };

            // Tratamento da resposta
            if (Array.isArray(result)) {
                payload.received = result;
            } else {
                payload.received = result.received || [];
                payload.sent = result.sent || [];
            }

            console.log('[PROFILE] Requests Success:', payload.received.length, 'rec,', payload.sent.length, 'sent');

            const rec = payload.received || [];
            if (rec.length > this.lastReceivedCount) {
                if (this.notificationCallback && rec.length > 0) {
                    const last = rec[rec.length - 1];
                    this.notificationCallback({
                        title: 'Nova Amizade',
                        desc: last.name + ' quer ser seu amigo!',
                        icon: last.avatar,
                        isGame: false
                    });
                }
            }
            this.lastReceivedCount = rec.length;

            this.mainWindow.webContents.send('friend-requests-update', payload);

        } catch (e) {
            console.error('[PROFILE] Erro CheckFriends (Browser):', e.message);
        }
    }

    startPolling() {
        // [IMPORTANT] Resolve ID e Inicia Firebase imediatamente
        this.resolveUserId();

        // Polling de 60s para não sobrecarregar
        setInterval(() => this.checkFriendRequests(), 60000);

        // Check inicial de friends com pequeno delay para garantir auth
        setTimeout(() => this.checkFriendRequests(), 3000);
    }

    // Removido getMockProfile que causava confusão.
    getMockProfile(id) { return null; }

    invalidateProfile(id) {
        if (this.profileCache && this.profileCache[id]) {
            console.log('[PROFILE] Invalidating Cache for ID:', id);
            delete this.profileCache[id];
        }
    }

    async savePrivacy(settings) {
        this.settings = { ...this.settings, ...settings };
        if (this.currentUser.id) await firebaseMgr.savePrivacy(this.currentUser.id, this.settings);
    }

    injectLocalLibrary(profileData, localGames) {
        if (String(profileData.id) === String(this.currentUser.id) && localGames && Array.isArray(localGames)) {
            const profileLib = localGames.map(g => ({
                name: g.name,
                image: (g.cover || g.image) ?
                    ((g.cover || g.image).startsWith('http') ? (g.cover || g.image) : 'file:///' + (g.cover || g.image).replace(/\\/g, '/'))
                    : 'https://steamverde.net/assets/img/default_game.jpg'
            }));
            profileData.library = profileLib;
        }
        return profileData;
    }

    injectLocalAchievements(profileData, localAchs) {
        if (String(profileData.id) === String(this.currentUser.id) && localAchs && Array.isArray(localAchs)) {
            const profAchs = localAchs.map(a => ({
                title: a.title,
                description: a.desc || a.description,
                icon: a.icon || '',
                unlocked: true,
                type: a.appId ? 'game' : 'launcher', // GameWatcher adds appId, LocalAch does not
                gameName: a.gameName || 'Desconhecido',
                appId: a.appId
            }));
            profileData.achievements = profAchs;
        }
        return profileData;
    }
}

module.exports = ProfileManager;

const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, onDisconnect, onValue, push, serverTimestamp, child, get, update, limitToLast, query, orderByKey, remove } = require("firebase/database");

const firebaseConfig = {
    apiKey: "AIzaSyAQ2m8jwxbxmC8XAOc_vJ7VAcsHaHRqwNU",
    authDomain: "steam-verde-launcher.firebaseapp.com",
    databaseURL: "https://steam-verde-launcher-default-rtdb.firebaseio.com",
    projectId: "steam-verde-launcher",
    storageBucket: "steam-verde-launcher.firebasestorage.app",
    messagingSenderId: "774054693110",
    appId: "1:774054693110:web:0332b0f0c95f46128684d7",
    measurementId: "G-54ZBRTEYV3"
};

class FirebaseManager {
    constructor() {
        this.app = null;
        this.db = null;
        this.userId = null;
        this.presenceRef = null;
        this.statusListeners = {}; // friendId -> offFunction
        this.chatListeners = {}; // chatId -> offFunction
    }

    // Inicializa conexão
    init(userId) {
        if (this.app) {
            // Se mudou de usuário, re-conectar? Por simplicidade, assume single user session por run
            if (this.userId !== userId) console.warn("Re-init com user diferente não suportado full sem reload");
            return;
        }

        console.log(`[FIREBASE] Inicializando para User ${userId}...`);
        this.userId = String(userId);
        this.app = initializeApp(firebaseConfig);
        this.db = getDatabase(this.app);

        // --- SISTEMA DE PRESENÇA ---
        // Referência: users/ID/status
        this.presenceRef = ref(this.db, `users/${this.userId}/status`);
        const connectedRef = ref(this.db, '.info/connected');

        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // Se desconectar (fechar app, crash, internet cair), define como Offline no servidor
                onDisconnect(this.presenceRef).set({
                    state: 'offline',
                    last_updated: serverTimestamp()
                });

                // Agora estamos online
                this.setPresence('online');
            }
        });

        // Se já houver callback de notificação registrado, inicia listener
        if (this.notificationCallback) this._startNotifListener();
    }

    _startNotifListener() {
        if (this.notifListenerStarted || !this.db || !this.userId) return;

        const notifRef = ref(this.db, `notifications/${this.userId}`);
        onValue(notifRef, (snap) => {
            console.log("[FIREBASE] Listener Notificação Disparado. Snapshot Exists?", snap.exists());
            if (snap.exists()) {
                snap.forEach((child) => {
                    const notif = child.val();
                    const senderId = child.key;
                    console.log("[FIREBASE] Nova Notificação detectada de:", senderId);
                    if (this.notificationCallback) this.notificationCallback(senderId, notif);
                });
            }
        });
        this.notifListenerStarted = true;
    }

    // Atualiza status (ex: 'online', 'playing', 'offline')
    setPresence(state, gameName = '') {
        if (!this.db || !this.presenceRef) return;

        const payload = {
            state: state,
            last_updated: serverTimestamp()
        };
        if (gameName) payload.game = gameName;
        else payload.game = null; // Remove jogo se não estiver jogando

        set(this.presenceRef, payload).catch(err => console.error("[FIREBASE] Erro ao setar presença:", err));
    }

    // Monitorar status de amigos
    watchFriends(friendIds, onUpdateCallback) {
        if (!this.db) return;

        // Remove listeners antigos se houver
        this.stopWatchingFriends();

        friendIds.forEach(fid => {
            const fidStr = String(fid);
            const friendRef = ref(this.db, `users/${fidStr}/status`);

            const listener = onValue(friendRef, (snap) => {
                const val = snap.val();
                if (val) {
                    onUpdateCallback(fidStr, val);
                } else {
                    onUpdateCallback(fidStr, { state: 'offline' });
                }
            });

            this.statusListeners[fidStr] = listener;
            // Nota: Em Firebase v9 modular, onValue retorna 'unsubscribe'. 
            // Precisaremos guardar essa função.
        });
    }

    stopWatchingFriends() {
        // onValue retorna a função de unsubscribe
        Object.values(this.statusListeners).forEach(unsub => unsub());
        this.statusListeners = {};
    }

    // --- SISTEMA DE CHAT ---

    savePrivacy(userId, settings) {
        if (!this.db) return;
        const pRef = ref(this.db, `users/${userId}/privacy`);
        return set(pRef, settings);
    }

    async getPrivacy(userId) {
        if (!this.db) return null;
        try {
            const snap = await get(ref(this.db, `users/${userId}/privacy`));
            return snap.val();
        } catch (e) { return null; }
    }

    // ID único da conversa: menorID_maiorID
    getChatId(friendId) {
        const u1 = parseInt(this.userId);
        const u2 = parseInt(friendId);
        return u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`;
    }

    sendMessage(friendId, text) {
        if (!this.db) return;
        const chatId = this.getChatId(friendId);
        const chatRef = ref(this.db, `chats/${chatId}/messages`);

        const newMsgRef = push(chatRef);
        set(newMsgRef, {
            sender: this.userId,
            text: text,
            timestamp: serverTimestamp()
        });

        // NOTIFICAÇÃO PARA O DESTINATÁRIO
        const notifRef = ref(this.db, `notifications/${friendId}/${this.userId}`);
        set(notifRef, {
            senderId: this.userId,
            text: text,
            timestamp: serverTimestamp()
        }).catch(e => console.error("Erro notificacao:", e));
    }

    // Escutar notificações de novas mensagens
    onNotification(callback) {
        this.notificationCallback = callback;
        this._startNotifListener();
    }

    clearNotification(friendId) {
        if (!this.db || !this.userId) return;
        const notifRef = ref(this.db, `notifications/${this.userId}/${friendId}`);
        set(notifRef, null).catch(() => { });
    }

    // Escutar mensagens de um amigo específico (ou chat aberto)
    listenToChat(friendId, onMessageCallback) {
        // Limpa notificação ao abrir chat
        this.clearNotification(friendId);

        const chatId = this.getChatId(friendId);
        // Se já ouvindo este chat, ignora
        if (this.chatListeners[chatId]) return;

        const chatRef = ref(this.db, `chats/${chatId}/messages`);
        // Pegar apenas as últimas 20 msg para não carregar histórico infinito logo de cara
        const recentQuery = query(chatRef, limitToLast(20));

        const unsub = onValue(recentQuery, (snap) => {
            const msgs = [];
            snap.forEach(childSnap => {
                msgs.push(childSnap.val());
            });
            onMessageCallback(chatId, msgs);
        });

        this.chatListeners[chatId] = unsub;
    }

    stopListeningChat(friendId) {
        const chatId = this.getChatId(friendId);
        if (this.chatListeners[chatId]) {
            this.chatListeners[chatId](); // Unsub
            delete this.chatListeners[chatId];
        }
    }

    clearChatHistory(friendId) {
        if (!this.db || !this.userId) return;
        const chatId = this.getChatId(friendId);
        const chatRef = ref(this.db, `chats/${chatId}/messages`);
        remove(chatRef).then(() => {
            console.log(`[FIREBASE] Histórico limpo para ${chatId}`);
            // Force empty update
            if (this.notificationCallback) this.notificationCallback(friendId, { text: "Histórico Limpo" });
        }).catch(e => console.error("Erro ao limpar chat:", e));
    }
}

module.exports = new FirebaseManager();

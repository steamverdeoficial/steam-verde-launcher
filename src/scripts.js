// src/scripts.js

const INJECT_LOADER_DOM = `if (!document.getElementById('sv-launcher-loader')) { const loader = document.createElement('div'); loader.id = 'sv-launcher-loader'; loader.innerHTML = '<div class="sv-spinner"></div>'; document.body.appendChild(loader); }`;

const FIND_IMAGE_LOGIC = `
  function svFindGameImage() {
      let gameImg = '';
      const img1 = document.querySelector('.package-image img');
      if (img1 && img1.src) return img1.src;
      const link1 = document.querySelector('.package-image a');
      if (link1 && link1.href && link1.href.match(/\\.(jpg|jpeg|png|webp)/i)) return link1.href;
      const imgFluid = document.querySelector('.entry-content img.img-fluid');
      if (imgFluid && imgFluid.src) return imgFluid.src;
      const allImgs = document.querySelectorAll('.entry-content img');
      let maxArea = 0; let bestImg = '';
      allImgs.forEach(img => { const area = img.width * img.height; if (area > maxArea && img.width > 100) { maxArea = area; bestImg = img.src; } });
      if (bestImg) return bestImg;
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg && ogImg.content) return ogImg.content;
      return '';
  }
`;

const CLICK_LISTENER_SCRIPT = ` 
  ${FIND_IMAGE_LOGIC} 
  document.body.addEventListener('click', (e) => { 
    const link = e.target.closest('a'); 
    if (link && link.href && (link.href.startsWith('magnet:') || link.href.endsWith('.torrent'))) {
         e.preventDefault(); e.stopPropagation();
         const gameImg = svFindGameImage();
         window.ipc.startTorrent(link.href, gameImg);
         return;
    }
    if (link && link.href) {
        if (link.href.includes('#') || link.href.startsWith('javascript:') || link.href === window.location.href) return; 
        if (!link.href.includes('steamverde.net')) return; 
        const loader = document.getElementById('sv-launcher-loader'); 
        if (loader) { 
            loader.classList.add('visible'); 
            setTimeout(() => { loader.classList.remove('visible'); }, 3000); 
        } 
    } 
  }); 
`;

const HIDE_LOADER_SCRIPT = `(function() { const loader = document.getElementById('sv-launcher-loader'); if (loader) { loader.classList.remove('visible'); setTimeout(() => { loader.style.display = 'none'; }, 200); } })();`;
const SHOW_UPDATE_BTN_SCRIPT = `const btn = document.getElementById('sv-update-btn'); if(btn) btn.style.display = 'flex';`;

// INJEÇÃO DA UI
const INJECT_UI_SCRIPT = `
    try {
        if(!window.UI_TEMPLATES) { window.UI_TEMPLATES = { HTML_PROFILE_MODAL: '', HTML_SETTINGS_MODAL: '', HTML_TOOLTIP: '' }; }
        ${FIND_IMAGE_LOGIC} 
        
        // [CHAT] Injetar Modal
        if(!document.getElementById('sv-chat-modal') && window.UI_TEMPLATES.HTML_CHAT_MODAL) {
             const chatDiv = document.createElement('div');
             chatDiv.innerHTML = window.UI_TEMPLATES.HTML_CHAT_MODAL;
             document.body.appendChild(chatDiv.firstElementChild);
        }



        // Tentar capturar Nonce do WordPress para API
        if(window.wpApiSettings && window.wpApiSettings.nonce) {
             console.log('[SV] Nonce encontrado:', window.wpApiSettings.nonce);
             window.ipc.saveNonce(window.wpApiSettings.nonce);
        } else {
             console.warn('[SV] WP Nonce não encontrado no window.');
        } 

        // [BYPASS] SCRAPING DE IDENTIDADE DO USUÁRIO
        // Tenta pegar o ID do user logado pelas classes do body (logged-in, author-123)
        // Isso é infalível se o usuário estiver logado no front-end.
        try {
            const bodyClasses = document.body.className.split(' ');
            let userId = 0;
            // Procura por classe 'author-123' ou 'user-id-123' (comum em temas WP)
            // Se nao tiver, tentamos pegar do adminbar se existir
            const adminBar = document.getElementById('wp-admin-bar-user-info');
            if (adminBar) {
                // Tenta extrair info do adminbar
                const usernameEl = adminBar.querySelector('.display-name');
                const avatarEl = adminBar.querySelector('img.avatar');
                if (usernameEl) console.log('[SV-SCRAPE] Username do AdminBar:', usernameEl.innerText);
            }

            // Fallback: Tenta achar variavel userSettings
            if (window.userSettings && window.userSettings.uid) {
                userId = parseInt(window.userSettings.uid);
                console.log('[SV-SCRAPE] ID encontrado em userSettings:', userId);
                if (userId > 0) window.ipc.forceSetUser(userId);
            }
        } catch (errScrape) {
            console.error('[SV-SCRAPE] Erro:', errScrape);
        } 
    
    // SISTEMA DE SOM
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playNotificationSound() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
    }

    // --- HOISTED CHAT FUNCTIONS (Rescue Race Condition) ---
    window.svBindChatEvents = function(silent = false) {
        if(!silent && window.ipc.log) window.ipc.log("[RENDERER] Binding Chat Events (Hoisted)...");
        const bindBtn = (id, handler, name) => {
            const el = document.getElementById(id);
            if(el) {
                if(!el.onclick || el.getAttribute('onclick')) {
                    el.removeAttribute('onclick');
                    el.onclick = (e) => { e.preventDefault(); e.stopPropagation(); handler(); };
                }
            }
        };
        bindBtn('sv-chat-close-btn', () => window.svCloseChatUI(), 'Close');
        bindBtn('sv-chat-trash-btn', () => window.svClearChatHistory(), 'Trash');
        bindBtn('sv-chat-mute-btn', () => window.svToggleMute(), 'Mute');
        const header = document.querySelector('.sv-chat-header');
        if(header && !header.onclick) {
             header.onclick = (e) => {
                 if(e.target !== header && e.target.tagName !== 'SPAN' && e.target.id !== 'sv-chat-title') return;
                 window.svToggleChatCollapse();
             }
        }
    };

    window.svChatFriendId = null;
    window.svChatIsOpen = false;
    
    window.svUpdateChatTitle = function(friendName, friendId) {
        const title = document.getElementById('sv-chat-title');
        const fid = friendId || window.svChatFriendId;
        if(title && fid) {
            // [DROPDOWN UI]
            title.style.position = 'relative'; // Ensure relative context for absolute dropdown
            title.innerHTML = \`
                <span style="vertical-align:middle">CHAT: \${friendName}</span>
                <span id="sv-chat-arrow" style="cursor:pointer;margin-left:8px;font-size:10px;vertical-align:middle;opacity:0.8;padding:5px">▼</span>
                <div id="sv-chat-dropdown" style="display:none;position:absolute;top:30px;left:50%;transform:translateX(-50%);background:#1f232b;border:1px solid #444;border-radius:4px;z-index:9999999;box-shadow:0 5px 15px rgba(0,0,0,0.5);min-width:140px;text-align:left">
                    <style>.sv-chat-dd-item:hover{background:#333}</style>
                    <div class="sv-chat-dd-item" style="padding:10px;cursor:pointer;border-bottom:1px solid #333;color:#eee" onclick="window.svSearchUser('\${fid}')">Ver Perfil</div>
                    <div class="sv-chat-dd-item" style="padding:10px;cursor:pointer;color:#ff6666" onclick="if(confirm('Bloquear usuário?')) window.ipc.blockFriend('\${fid}')">Bloquear</div>
                </div>
            \`;
            const arrow = document.getElementById('sv-chat-arrow');
            const dd = document.getElementById('sv-chat-dropdown');
            if(arrow && dd) {
                arrow.onclick = (e) => {
                    e.stopPropagation();
                    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
                };
                if(!window.svChatDdCloser) {
                    window.svChatDdCloser = (e) => {
                       const d = document.getElementById('sv-chat-dropdown');
                       if(d && d.style.display === 'block' && !d.contains(e.target) && e.target.id !== 'sv-chat-arrow') {
                           d.style.display = 'none';
                       }
                    };
                    document.addEventListener('click', window.svChatDdCloser);
                }
            }
        }
    };
    
    window.svOpenChat = function(friendId, friendName) {
        // [ANTI-FLICKER]
        if(window.svChatIsOpen && String(window.svChatFriendId) === String(friendId)) {
             const m = document.getElementById('sv-chat-modal');
             if(m && m.classList.contains('visible')) {
                 m.style.zIndex = '999999';
                 return; // DO NOT RESET UI
             }
        }

        window.svChatFriendId = friendId;
        window.svChatIsOpen = true;
        const modal = document.getElementById('sv-chat-modal');
        if(modal) {
            modal.style.display = 'none'; modal.offsetHeight; // Reflow
            modal.classList.add('visible');
            modal.style.height = '400px'; modal.style.display = 'flex'; modal.style.zIndex = '999999';
            window.svUpdateChatTitle(friendName, friendId);
            const btnMute = document.getElementById('sv-chat-mute-btn');
            if(btnMute) btnMute.innerText = window.svChatMuted ? '🔇' : '🔊';
            const body = document.getElementById('sv-chat-body');
            if(body) body.innerHTML = '<div style="color:#666;text-align:center;margin-top:20px;">Carregando...</div>';
            window.svBindChatEvents();
            window.ipc.openChat(friendId);
        }
    };

    window.svCloseChatUI = function() {
        window.svChatIsOpen = false;
        const modal = document.getElementById('sv-chat-modal');
        if(modal) { modal.classList.remove('visible'); modal.style.display = 'none'; }
        if(window.svChatFriendId) window.ipc.closeChat(window.svChatFriendId);
        window.svChatFriendId = null;
    };

    window.svSendChatMsg = function() {
        const input = document.getElementById('sv-chat-input');
        if(input && input.value.trim() !== '' && window.svChatFriendId) {
            window.ipc.sendChatMessage(window.svChatFriendId, input.value.trim());
            input.value = '';
        }
    };
    
    window.svClearChatHistory = function() {
        if(confirm("Tem certeza?")) { if(window.svChatFriendId) window.ipc.clearChat(window.svChatFriendId); }
    };
    
    let lastToggleTime = 0;
    window.svToggleChatCollapse = function() {
        const now = Date.now();
        if (now - lastToggleTime < 300) return; 
        lastToggleTime = now;
        const modal = document.getElementById('sv-chat-modal');
        if(modal) {
            const isSmall = modal.offsetHeight < 100;
            const newHeight = isSmall ? '400px' : '40px';
            modal.style.height = newHeight;
        }
    };
    
    window.svToggleMute = function() {
        window.svChatMuted = !window.svChatMuted;
        localStorage.setItem('sv-chat-muted', window.svChatMuted);
        const btn = document.getElementById('sv-chat-mute-btn');
        if(btn) btn.innerText = window.svChatMuted ? '🔇' : '🔊';
    };
    // ----------------------------------------------------

    if(window.ipc && window.ipc.onChatNotification) {
        window.ipc.onChatNotification((friendId, msgText) => {
            // [NAME RESOLUTION] Priority: Cache -> DOM -> Default
            let friendName = localStorage.getItem('sv-friend-name-' + friendId) || 'Nova Mensagem';
            
            const statusDot = document.getElementById('sv-status-' + friendId);
            if(statusDot && statusDot.parentElement) {
                const nameSpan = statusDot.parentElement.querySelector('span');
                if(nameSpan) friendName = nameSpan.innerText;
            }

            if(window.ipc.log) window.ipc.log("[RENDERER] Global Notification: " + friendId + " (" + friendName + ")");
            
            // Debug Availability
            if(window.ipc.log) window.ipc.log("[RENDERER] Checking svOpenChat type: " + typeof window.svOpenChat);

            // Async Safe Runner
            const safeOpenChat = () => {
                 try {
                     window.svOpenChat(friendId, friendName);
                     playNotificationSound();
                 } catch(err) { console.error("Chat Open Error:", err); }
            };

            // Garantir que SvOpenChat seja chamado
            if(window.svOpenChat) {
                safeOpenChat();
            } else {
                 if(window.ipc.log) window.ipc.log("[RENDERER] svOpenChat NOT READY. Starting Wait Loop...");
                 let tries = 0;
                 const waiter = setInterval(() => {
                     tries++;
                     if(window.svOpenChat) {
                         clearInterval(waiter);
                         if(window.ipc.log) window.ipc.log("[RENDERER] svOpenChat Ready after " + (tries*100) + "ms. Executing.");
                         safeOpenChat();
                     }
                     if(tries > 50) { // 5 seconds timeout
                         clearInterval(waiter);
                         if(window.ipc.log) window.ipc.log("[RENDERER] FATAL: svOpenChat never became ready.");
                     }
                 }, 100);
            }
        });
    }

    // [CHAT GLOBAL DELEGATION] - Opção Nuclear para corrigir Cliques Mortos
    // Isso roda no nível raiz, então pega o modal padrão ou injetado.
    document.body.addEventListener('click', (e) => {
         const modal = document.getElementById('sv-chat-modal');
         if(!modal) return;
         
         // [HANDLER] Botão Fechar (Interceptação Global)
         const closeBtn = e.target.closest('#sv-chat-close-btn');
         if(closeBtn) {
             if(window.ipc.log) window.ipc.log("[RENDERER] Global Close Button Clicked");
             if(window.svCloseChatUI) window.svCloseChatUI();
             return;
         }

         const hdr = e.target.closest('.sv-chat-header');
         // Se clicou no Header do Chat
         if(hdr && modal.contains(hdr)) {
              // Evitar botões (Lixeira, Fechar, Mute)
              if(e.target.closest('button') || e.target.tagName === 'BUTTON' || 
                 e.target.closest('.sv-icon-btn') || 
                 (e.target.id && (e.target.id.includes('trash') || e.target.id.includes('close') || e.target.id.includes('mute')))) {
                   return;
              }

              if(window.ipc && window.ipc.log) window.ipc.log("[RENDERER] Global Top-Level Click on Chat Header");
              if(window.svToggleChatCollapse) window.svToggleChatCollapse();
         }
         
    });


    // BADGES
    window.ipc.onUpdateBadges((event, data) => {
        const hasUnread = data.hasUnread;
        const playSound = data.playSound;
        const badgeTop = document.getElementById('sv-news-badge');
        const menuItem = document.getElementById('sv-menu-avisos');
        if (hasUnread) {
            if(badgeTop) badgeTop.style.display = 'block';
            if(menuItem) menuItem.classList.add('has-news');
            if(playSound) playNotificationSound();
        } else {
            if(badgeTop) badgeTop.style.display = 'none';
            if(menuItem) menuItem.classList.remove('has-news');
        }
    });

    // MENU LATERAL
    if (!document.getElementById('sv-side-menu')) {
        const overlay = document.createElement('div');
        overlay.id = 'sv-menu-overlay';
        overlay.onclick = () => window.ipc.toggleMenu();
        document.body.appendChild(overlay);

        const menu = document.createElement('div');
        menu.id = 'sv-side-menu';
        
        const icons = {
            games: '<svg viewBox="0 0 24 24"><path d="M21,6H3A2,2 0 0,0 1,8V16A2,2 0 0,0 3,18H21A2,2 0 0,0 23,16V8A2,2 0 0,0 21,6M10,15H8V17H6V15H4V13H6V11H8V13H10V15M20,11H18V13H20V11M20,15H18V17H20V15M17,11H15V13H17V11M17,15H15V17H17V15Z"/></svg>',
        };
        const iconGames = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradGames)" d="M21,6H3A2,2 0 0,0 1,8V16A2,2 0 0,0 3,18H21A2,2 0 0,0 23,16V8A2,2 0 0,0 21,6M10,15H8V17H6V15H4V13H6V11H8V13H10V15M20,11H18V13H20V11M20,15H18V17H20V15M17,11H15V13H17V11M17,15H15V17H17V15Z"/><defs><linearGradient id="gradGames" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" /><stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconNews = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradNews)" d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2M13 17H11V15H13V17M13 13H11V7H13V13Z"/><defs><linearGradient id="gradNews" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" /><stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconTrophy = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradTrophy)" d="M19 5H17C17 3.9 16.1 3 15 3H9C7.9 3 7 3.9 7 5H5C3.9 5 3 5.9 3 7V8C3 10.8 5.2 13 8 13.5V15C8 16.1 8.9 17 10 17H14C15.1 17 16 16.1 16 15V13.5C18.8 13 21 10.8 21 8V7C21 5.9 20.1 5 19 5M5 8V7H7V8C7 9.1 6.1 10 5 10C5 10 5 10 5 10V8M19 8V10C19 10 19 10 19 10C17.9 10 17 9.1 17 8V7H19V8M12 18C10.9 18 10 18.9 10 20H14C14 18.9 13.1 18 12 18Z"/><defs><linearGradient id="gradTrophy" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" /><stop offset="100%" style="stop-color:#FDB931;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconFolder = '<svg viewBox="0 0 24 24" style="fill:#8f98a0"><path d="M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z"/></svg>';

        const iconSettings = '<svg viewBox="0 0 24 24"><path style="fill:#8f98a0" d="M19.14,12.94C19.17,12.64 19.17,12.33 19.14,12.03L21.54,10.15C21.76,9.97 21.82,9.66 21.68,9.41L19.41,5.5C19.27,5.25 18.96,5.15 18.7,5.25L15.88,6.38C15.29,5.93 14.65,5.55 13.96,5.26L13.53,2.25C13.48,1.97 13.24,1.77 12.95,1.77H8.41C8.12,1.77 7.88,1.97 7.84,2.25L7.41,5.26C6.71,5.55 6.07,5.93 5.49,6.38L2.66,5.25C2.4,5.15 2.09,5.25 1.95,5.5L-0.32,9.41C-0.46,9.66 -0.4,9.97 -0.18,10.15L2.22,12.03C2.19,12.33 2.19,12.64 2.22,12.94L-0.18,14.82C-0.4,15 0.046,15.31 -0.32,15.56L1.95,19.47C2.09,19.72 2.4,19.82 2.66,19.72L5.49,18.59C6.07,19.04 6.71,19.42 7.41,19.71L7.84,22.72C7.88,23 8.12,23.2 8.41,23.2H12.95C13.24,23.2 13.48,23 13.53,22.72L13.96,19.71C14.65,19.42 15.29,19.04 15.88,18.59L18.7,19.72C18.96,19.82 19.27,19.72 19.41,19.47L21.68,15.56C21.82,15.31 21.76,15 21.54,14.82L19.14,12.94M10.68,12.5C10.68,14.7 8.89,16.5 6.68,16.5C4.47,16.5 2.68,14.7 2.68,12.5C2.68,10.29 4.47,8.5 6.68,8.5C8.89,8.5 10.68,10.29 10.68,12.5Z"/></svg>';
        
        // Inserir info do usuário no topo
        const userSection = \`
            <div style="padding: 20px 25px; border-bottom: 1px solid #282c34; display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                <img id="sv-menu-avatar" src="" style="width:40px; height:40px; border-radius:50%; border:2px solid #a4d007;">
                <div>
                   <div id="sv-menu-name" style="color:#fff; font-weight:bold; font-size:14px;">Usuário</div>
                   <div id="sv-menu-id" style="color:#8f98a0; font-size:11px;">ID: ...</div>
                </div>
            </div>
        \`;

        menu.innerHTML = userSection + \`
            <a class="sv-menu-item" onclick="window.ipc.openProfile()">\${iconGames} Meu Perfil</a>
            <a class="sv-menu-item" onclick="window.ipc.openMyGames()">\${iconFolder} Minha Biblioteca Local</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" id="sv-menu-avisos" onclick="window.ipc.openNotices()">\${iconNews} Avisos e Novidades</a>
            <a class="sv-menu-item" onclick="window.ipc.openAchievements()">\${iconTrophy} Conquistas</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" onclick="window.ipc.openSettings()"><svg viewBox="0 0 24 24" style="fill:#8f98a0"><path d="M19.1,12.9C19.1,12.6 19.1,12.3 19.1,12L21.5,10.1C21.7,10 21.8,9.7 21.7,9.4L19.4,5.5C19.3,5.3 19,5.2 18.7,5.3L15.9,6.4C15.3,6 14.7,5.6 14,5.3L13.5,2.3C13.5,2 13.3,1.8 13,1.8H8.4C8.1,1.8 7.9,2 7.8,2.3L7.4,5.3C6.7,5.6 6.1,6 5.5,6.4L2.7,5.3C2.4,5.2 2.1,5.3 2,5.5L-0.3,9.4C-0.4,9.6 -0.4,9.9 -0.2,10.1L2.2,12C2.2,12.3 2.2,12.6 2.2,12.9L-0.2,14.8C-0.4,15 -0.4,15.3 -0.3,15.6L1.9,19.5C2,19.7 2.4,19.8 2.7,19.7L5.5,18.6C6.1,19 6.7,19.4 7.4,19.7L7.8,22.7C7.9,23 8.1,23.2 8.4,23.2H13C13.3,23.2 13.5,23 13.6,22.7L14,19.7C14.7,19.4 15.3,19 15.9,18.6L18.7,19.7C19,19.8 19.3,19.7 19.4,19.5L21.7,15.6C21.8,15.3 21.8,15 21.6,14.8L19.1,12.9ZM10.7,12.5C10.7,14.7 8.9,16.5 6.7,16.5C4.5,16.5 2.7,14.7 2.7,12.5C2.7,10.3 4.5,8.5 6.7,8.5C8.9,8.5 10.7,10.3 10.7,12.5Z"/></svg> Configurações</a>
            <a class="sv-menu-item" onclick="window.ipc.openRD()"><svg viewBox="0 0 24 24" style="fill:#a4d007"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M10 17L15 12L10 7V17Z"/></svg> Real-Debrid</a>
            <div style="flex:1"></div> <a class="sv-menu-item" onclick="if(confirm('Isso fechará o launcher e resetará todas as configurações. Continuar?')) window.ipc.clearUserData()" style="color:#ff4d4d; border-top:1px solid #282c34; padding-top:20px; padding-bottom:20px">
               <svg viewBox="0 0 24 24" style="fill:#ff4d4d"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
               Limpar Dados
            </a>
        \`;
        document.body.appendChild(menu);
        
        // Atualizar info inicial se disponível
        if(window.svUserInfo) {
             const av = document.getElementById('sv-menu-avatar');
             const nm = document.getElementById('sv-menu-name');
             const id = document.getElementById('sv-menu-id');
             const uName = (window.svUserInfo.name && window.svUserInfo.name !== 'undefined') ? window.svUserInfo.name : 'Assinante';
             if(av) av.src = window.svUserInfo.avatar || 'https://secure.gravatar.com/avatar/?d=mm';
             if(nm) nm.innerText = uName;
             if(id) id.innerText = 'ID: ' + ((window.svUserInfo.id && window.svUserInfo.id !== 'undefined') ? window.svUserInfo.id : '...');
        }

        window.debugClearData = function() {
            if(confirm("ATENÇÃO: Isso limpará TODOS os dados do Launcher.")) { window.ipc.clearDataAndRestart(); }
        };

        // Ouvinte para atualizações de info do usuário via IPC (reativo)
        if(window.ipc && window.ipc.onUpdateUserInfo) {
            window.ipc.onUpdateUserInfo((event, user) => {
                 window.svUserInfo = user;
                 const av = document.getElementById('sv-menu-avatar');
                 const nm = document.getElementById('sv-menu-name');
                 const id = document.getElementById('sv-menu-id');
                 
                 const safeName = (user.name && user.name !== 'undefined' && user.name !== 'Guest') ? user.name : 'Assinante';
                 const safeId = (user.id && user.id !== 'undefined' && user.id > 0) ? user.id : '...';

                 if(av) av.src = user.avatar || 'https://secure.gravatar.com/avatar/?d=mm';
                 if(nm) nm.innerText = safeName;
                 if(id) id.innerText = 'ID: ' + safeId;
                 
                 // Also update titlebar if needed
                 const titleUser = document.querySelector('.sv-user-name');
                 if(titleUser) titleUser.innerText = safeName;
            });
            // Immediately request latest info
            if(window.ipc.getUserInfo) window.ipc.getUserInfo();
        }
    }

    // INJECT: MODAIS (Perfil, Config, etc)
    const { HTML_PROFILE_MODAL, HTML_SETTINGS_MODAL, HTML_TOOLTIP } = window.UI_TEMPLATES;
    
    // PERFIL
    if (!document.getElementById('sv-profile-modal')) {
        const modal = document.createElement('div');
        modal.id = 'sv-profile-modal';
        modal.innerHTML = HTML_PROFILE_MODAL;
        document.body.appendChild(modal);
        // Lógica de Tabs
        window.svSwitchProfileTab = function(tabName) {
            document.querySelectorAll('.sv-profile-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sv-profile-content').forEach(c => c.classList.remove('active'));
            
            const btn = document.querySelector('.sv-profile-tab[onclick*="' + tabName + '"]');
            const content = document.getElementById('sv-profile-content-' + tabName);
            
            if(btn) btn.classList.add('active');
            if(content) content.classList.add('active');
        };
    }    // CONFIGURAÇÕES
    if (!document.getElementById('sv-settings-modal')) {
        const modal = document.createElement('div');
        modal.id = 'sv-settings-modal';
        modal.innerHTML = HTML_SETTINGS_MODAL;
        document.body.appendChild(modal);

        window.svSavePrivacy = function() {
            const pProfile = document.getElementById('sv-privacy-profile').value;
            const pLibrary = document.getElementById('sv-privacy-library').value;
            window.ipc.savePrivacy({ privacyProfile: pProfile, privacyLibrary: pLibrary });
        };
    }

    // TOOLTIPS
    if (!document.getElementById('sv-tooltip')) {
        const div = document.createElement('div');
        div.id = 'sv-tooltip-container';
        div.innerHTML = HTML_TOOLTIP;
        document.body.appendChild(div.firstElementChild);
        
        // Lógica Global de Tooltip
        document.body.addEventListener('mouseover', (e) => {
            const icon = e.target.closest('.sv-achievement-card img') || e.target.closest('.mission-icon');
            if(icon) {
                 const card = icon.closest('.sv-achievement-card') || icon.closest('.mission-card');
                 if(!card) return;
                 const title = card.querySelector('.sv-ach-title') ? card.querySelector('.sv-ach-title').innerText : 'Conquista';
                 const desc = card.querySelector('.sv-ach-desc') ? card.querySelector('.sv-ach-desc').innerText : 'Descrição...';
                 const tt = document.getElementById('sv-tooltip');
                 document.getElementById('sv-tooltip-title').innerText = title;
                 document.getElementById('sv-tooltip-desc').innerText = desc;
                 const rect = icon.getBoundingClientRect();
                 tt.style.top = (rect.bottom + 10) + 'px';
                 tt.style.left = (rect.left - 20) + 'px';
                 tt.classList.add('visible');
            }
        });
        document.body.addEventListener('mouseout', (e) => {
             const icon = e.target.closest('.sv-achievement-card img') || e.target.closest('.mission-icon');
             if(icon) {
                 document.getElementById('sv-tooltip').classList.remove('visible');
             }
        });
    }

    // Listener para Atualizar Settings na UI
    window.ipc.onUpdateSettings((event, settings) => {
         const modal = document.getElementById('sv-settings-modal');
         if(modal) modal.style.display = 'flex';

         const pPath = document.getElementById('sv-settings-path');
         if(pPath) pPath.value = settings.downloadPath;
         const selProf = document.getElementById('sv-privacy-profile');
         const selLib = document.getElementById('sv-privacy-library');
         if(selProf && settings.privacyProfile) selProf.value = settings.privacyProfile;
         if(selLib && settings.privacyLibrary) selLib.value = settings.privacyLibrary;
    });

    // Listener para Preencher Perfil
    window.ipc.onOpenProfileData((event, data) => {
        if(window.ipc.log) window.ipc.log('[RENDERER] onOpenProfileData Recebido. Friends Count: ' + (data.friends ? data.friends.length : 'Nulo'));
        const modal = document.getElementById('sv-profile-modal');
        if(modal) modal.style.display = 'flex';
        
        document.getElementById('sv-profile-name').innerText = data.nickname;
        document.getElementById('sv-profile-id').innerText = 'ID: ' + data.id;
        document.getElementById('sv-profile-avatar').src = data.avatar;
        
        // Atualizar também o Sidebar (APENAS se for o perfil do PRÓPRIO usuário)
        const sideAv = document.getElementById('sv-menu-avatar');
        const sideNm = document.getElementById('sv-menu-name');
        const sideId = document.getElementById('sv-menu-id');
        
        // Verifica se é o próprio usuário comparando IDs
        // NOTA: window.svUserInfo é injetado no inicio
        const isMe = window.svUserInfo && String(window.svUserInfo.id) === String(data.id);
        
        if(isMe && sideAv && sideNm && sideId) {
             sideAv.src = data.avatar;
             sideNm.innerText = data.nickname;
             sideId.innerText = 'ID: ' + data.id;
        }

        // Renderizar Jogos
        const listGames = document.getElementById('sv-profile-content-games');
        listGames.innerHTML = '';
        
        if(data.library && data.library.length > 0) {
             // FORÇAR GRID JÁ NO CARREGAMENTO
             listGames.style.display = 'grid';
             listGames.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
             listGames.style.gap = '15px';
            
            data.library.forEach(game => {
                try {
                     const div = document.createElement('div');
                     div.className = 'sv-profile-game-card';
                     // Inline style fallback
                     div.style.cssText = 'background:#1f232b; border-radius:4px; overflow:hidden; transition:0.2s';
                     
                     const img = document.createElement('img');
                     img.src = game.image || 'https://steamverde.net/assets/img/default_game.jpg';
                     // Forçar tamanho da imagem
                     img.style.cssText = 'width:100%; height:200px; object-fit:cover; display:block';
                     
                     div.appendChild(img);

                     const loadText = document.createElement('div');
                     loadText.className = 'game-title';
                     loadText.innerText = game.name || 'Sem nome';
                     loadText.style.cssText = 'padding:10px; color:#fff; font-size:12px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis';
                     div.appendChild(loadText);
                     
                     listGames.appendChild(div);
                } catch(err) { console.error('Error rendering game card:', err); }
            });

        } else {
            listGames.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">Nenhum jogo encontrado na biblioteca local.</div>';
        }

        // Renderizar Conquistas (Agrupadas)
        const listAch = document.getElementById('sv-profile-content-achievements');
        if(listAch) {
            listAch.innerHTML = '';
            if(data.achievements && data.achievements.length > 0) {
                // Separar
                const launcherAchs = data.achievements.filter(a => a.type === 'launcher');
                const gameAchs = data.achievements.filter(a => a.type === 'game');

                const renderGroup = (title, list) => {
                    if(!list || list.length === 0) return '';
                    let h = '<div style="color:#a4d007;font-weight:bold;margin:15px 0 5px 0;font-size:14px;border-bottom:1px solid #333;padding-bottom:5px;">' + title + '</div><div class="sv-ach-grid">';
                    list.forEach(a => {
                        let st = a.title.replace(/"/g, '&quot;');
                        let sd = a.description.replace(/"/g, '&quot;');
                        let cls = a.unlocked ? '' : 'locked';
                        let iconHtml = '';
                        if(a.icon && (a.icon.startsWith('http') || a.icon.startsWith('file'))) {
                             iconHtml = '<img src="' + a.icon + '" style="width:48px;height:48px;">';
                        } else {
                             iconHtml = '<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:24px;background:#222;border-radius:4px">' + (a.icon || '🏆') + '</div>';
                        }
                        h += '<div class="sv-ach-item ' + cls + '" data-title="' + st + '" data-desc="' + sd + '" onmouseenter="window.svShowTooltip(this)" onmouseleave="window.svHideTooltip()">' + iconHtml + '</div>';
                    });
                    h += '</div>';
                    return h;
                };

                // 1. Renderizar Launcher Achievements
                let finalHtml = renderGroup('CONQUISTAS DO LAUNCHER', launcherAchs);

                // 2. Agrupar Game Achievements por Nome do Jogo
                const gamesGrouped = {};
                gameAchs.forEach(ga => {
                    const gName = ga.gameName || 'Outros Jogos';
                    if(!gamesGrouped[gName]) gamesGrouped[gName] = [];
                    gamesGrouped[gName].push(ga);
                });

                // 3. Renderizar cada grupo de jogo
                for (const [gName, gList] of Object.entries(gamesGrouped)) {
                    finalHtml += renderGroup('CONQUISTAS: ' + gName.toUpperCase(), gList);
                }

                listAch.innerHTML = finalHtml;
            } else {
                listAch.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">Nenhuma conquista registrada.</div>';
            }
     }

    // Tooltip Helpers Globais
    // --- CHAT LOGIC ---
    if(window.ipc.log) window.ipc.log("[RENDERER] CHECKPOINT: Pre-Chat Logic");
    window.svChatMuted = localStorage.getItem('sv-chat-muted') === 'true';
    const notifyAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 

    // [MANUAL BINDING] Bypass inline CSP issues or stopPropagation blockers
    // [OLD IMPLEMENTATION REMOVED - See Top of File - Hoisted for Race Condition Fix]
    // ------------------

    // [LEGACY NOTIFICATION LISTENER REMOVED - Using Top-Level Global Handler]
    // ------------------

    window.svShowTooltip = function(el) {
        let title = el.getAttribute('data-title');
        let desc = el.getAttribute('data-desc');
        // Tentar buscar tooltip elements no ui_templates inject
        let tt = document.getElementById('sv-tooltip');
        // Se nao existir, criar on-the-fly (fallback)
        if(!tt) {
             tt = document.createElement('div');
             tt.id = 'sv-tooltip';
             tt.className = 'sv-tooltip';
             tt.innerHTML = '<div id="sv-tooltip-title" class="sv-tooltip-title"></div><div id="sv-tooltip-desc" class="sv-tooltip-desc"></div>';
             document.body.appendChild(tt);
        }
        
        const ttt = document.getElementById('sv-tooltip-title');
        const ttd = document.getElementById('sv-tooltip-desc');
        
        if(tt && ttt && ttd) {
            ttt.innerText = title;
            ttd.innerText = desc;
            
            // Posicionar
            const rect = el.getBoundingClientRect();
            tt.style.top = (rect.bottom + 10) + 'px';
            tt.style.left = (rect.left + (rect.width/2) - 100) + 'px'; // Centralizar +-
            
            tt.classList.add('visible');
        }
    };
    
    window.svHideTooltip = function() {
        const tt = document.getElementById('sv-tooltip');
        if(tt) tt.classList.remove('visible');
    };

        // Renderizar Amigos
        if(window.ipc.log) window.ipc.log('[DEBUG] Render Friends. Count: ' + (data.friends ? data.friends.length : 'Nulo'));
        const listFriends = document.getElementById('sv-friends-list');
        listFriends.innerHTML = ''; // Limpar lista anterior mas manter o search input (que esta no HTML estatico)
        // OBS: O HTML do Search Input esta no template, entao innerHTML = '' vai apagar ele se nao cuidarmos.
        // Vamos apenas dar append na lista de amigos apos o search box se ele existir, 
        // ou recriar a estrutura se o template for estático.
        // WORKAROUND: O ui_templates ja tem o search box fixo. Vamos apenas adicionar os amigos numa div container se necessario, ou limpar filhos exeto o primeiro?
        // Melhor: Vamos assumir que sv-friends-list é O CONTAINER DOS AMIGOS, e o search box está ACIMA dele no template.
        // CHECK TEMPLATE: Sim, Search Box é irmao anterior do sv-friends-list. Entao podemos limpar sv-friends-list seguros.
        
        if(data.friends && data.friends.length > 0) {
             const allLists = document.querySelectorAll('#sv-friends-list');
             if(window.ipc.log) window.ipc.log('[DEBUG] Rendering in ' + allLists.length + ' lists.');
             
             // Limpar todas as listas encontradas
             allLists.forEach(l => l.innerHTML = '');

             // Criar fragmento com os amigos para clonar
             const frag = document.createDocumentFragment();
             
             data.friends.forEach(fr => {
                 const div = document.createElement('div');
                 div.className = 'sv-friend-item';
                 div.style.cssText = 'display:flex; align-items:center; padding:10px; border-bottom:1px solid #333; gap:10px; transition:0.2s; position:relative';
                 div.onmouseover = function(){ this.style.background = '#1f232b'; };
                 
                 localStorage.setItem('sv-friend-name-' + fr.id, fr.name);

                 if(window.svChatIsOpen && String(window.svChatFriendId) === String(fr.id)) {
                     window.svUpdateChatTitle(fr.name, fr.id);
                 }
                 div.onmouseout = function(){ this.style.background = 'transparent'; };
                 
                 const info = document.createElement('div');
                 info.style.cssText = 'display:flex; align-items:center; gap:10px; flex:1; cursor:pointer';
                 info.onclick = function() { window.svSearchUser(fr.id); };
                 info.innerHTML = \`<div id="sv-status-\${fr.id}" class="sv-status-dot offline" title="Offline"></div><img src="\${fr.avatar}" style="width:30px;height:30px;border-radius:50%"> <span style="color:#ccc">\${fr.name}</span>\`;
                 
                 const actions = document.createElement('div');
                 actions.className = 'sv-friend-actions';
                 actions.style.cssText = 'display:flex; gap:5px;';
                 
                 const btnChat = document.createElement('button');
                 btnChat.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#fff;vertical-align:middle"><path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H6L4,18V4H20V16Z" /></svg>';
                 btnChat.title = "Chat";
                 btnChat.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
                 btnChat.onclick = function(e) { e.stopPropagation(); window.svOpenChat(fr.id, fr.name); };
                 actions.appendChild(btnChat);

                 const btnRem = document.createElement('button');
                 btnRem.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#ff4d4d;vertical-align:middle"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>';
                 btnRem.title = "Desfazer Amizade";
                 btnRem.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
                 btnRem.onclick = function(e) { e.stopPropagation(); if(confirm('Desfazer amizade com ' + fr.name + '?')) window.ipc.removeFriend(fr.id); };
                 
                 const btnBlock = document.createElement('button');
                 btnBlock.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#888;vertical-align:middle"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12C4,13.85 4.63,15.55 5.68,16.91L16.91,5.68C15.55,4.63 13.85,4 12,4M12,20A8,8 0 0,0 20,12C20,10.15 19.37,8.45 18.32,7.09L7.09,18.32C8.45,19.37 10.15,20 12,20Z" /></svg>';
                 btnBlock.title = "Bloquear e Desfazer Amizade";
                 btnBlock.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
                 btnBlock.onclick = function(e) { e.stopPropagation(); if(confirm('Bloquear ' + fr.name + '? Vocês não verão mais o perfil um do outro.')) window.ipc.blockFriend(fr.id); };
                 
                 actions.appendChild(btnRem);
                 actions.appendChild(btnBlock);
                 
                 div.appendChild(info);
                 div.appendChild(actions);

                 frag.appendChild(div);
             });

             // Botão Bloqueados
             const blockDiv = document.createElement('div');
             // LOOP 1: Para cada Lista encontrada no DOM
             allLists.forEach(currentList => {
                 
                 // LOOP 2: Para cada Amigo
                 data.friends.forEach(fr => {
                     const div = document.createElement('div');
                     div.className = 'sv-friend-item';
                     // Layout Flexrow, padding, border
                     div.style.cssText = 'display:flex; align-items:center; padding:10px; border-bottom:1px solid #333; gap:10px; transition:0.2s; position:relative';
                     
                     // Hover Effect
                     div.onmouseover = function(){ this.style.background = '#1f232b'; };
                     div.onmouseout = function(){ this.style.background = 'transparent'; };

                     // Data Preservation
                     localStorage.setItem('sv-friend-name-' + fr.id, fr.name);
                     if(window.svChatIsOpen && String(window.svChatFriendId) === String(fr.id)) {
                         window.svUpdateChatTitle(fr.name, fr.id);
                     }
                     
                     // INFO (Avatar + Name + Status)
                     const info = document.createElement('div');
                     info.style.cssText = 'display:flex; align-items:center; gap:10px; flex:1; cursor:pointer';
                     info.onclick = function() { window.svSearchUser(fr.id); };
                     // [FIX] Status usa CLASSE agora para suportar multiplas listas: sv-status-user-{id}
                     info.innerHTML = '<div class="sv-status-dot offline sv-status-user-' + fr.id + '" title="Offline"></div><img src="' + fr.avatar + '" style="width:30px;height:30px;border-radius:50%"> <span style="color:#ccc">' + fr.name + '</span>';

    // ACTIONS (Always Visible now)
    const actions = document.createElement('div');
    actions.className = 'sv-friend-actions';
    actions.style.cssText = 'display:flex; gap:5px;';

    // BTN CHAT
    const btnChat = document.createElement('button');
    btnChat.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#fff;vertical-align:middle"><path d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H6L4,18V4H20V16Z" /></svg>';
    btnChat.title = "Chat";
    btnChat.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
    btnChat.onclick = function(e) {e.stopPropagation(); window.svOpenChat(fr.id, fr.name); };
    actions.appendChild(btnChat);

    // BTN REMOVE
    const btnRem = document.createElement('button');
    btnRem.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#ff4d4d;vertical-align:middle"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>';
    btnRem.title = "Desfazer Amizade";
    btnRem.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
    btnRem.onclick = function(e) {e.stopPropagation(); if(confirm('Desfazer amizade com ' + fr.name + '?')) window.ipc.removeFriend(fr.id); };

    // BTN BLOCK
    const btnBlock = document.createElement('button');
    btnBlock.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#888;vertical-align:middle"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12C4,13.85 4.63,15.55 5.68,16.91L16.91,5.68C15.55,4.63 13.85,4 12,4M12,20A8,8 0 0,0 20,12C20,10.15 19.37,8.45 18.32,7.09L7.09,18.32C8.45,19.37 10.15,20 12,20Z" /></svg>';
    btnBlock.title = "Bloquear";
    btnBlock.style.cssText = 'background:none; border:none; cursor:pointer; padding:5px;';
    btnBlock.onclick = function(e) {e.stopPropagation(); if(confirm('Bloquear ' + fr.name + '?')) window.ipc.blockFriend(fr.id); };

    actions.appendChild(btnRem);
    actions.appendChild(btnBlock);

    div.appendChild(info);
    div.appendChild(actions);

    // Append to CURRENT list iteration
    currentList.appendChild(div);
                 });

    // Botão Bloqueados (Para cada lista também)
    const btnBlocked = document.createElement('div');
    btnBlocked.style.cssText = 'text-align:center; padding:10px; margin-top:10px; border-top:1px solid #333; cursor:pointer; color:#888; font-size:12px; transition:0.2s';
    btnBlocked.innerText = 'GERENCIAR USUÁRIOS BLOQUEADOS';
    btnBlocked.onmouseover = function() {this.style.color = '#fff'};
    btnBlocked.onmouseout = function() {this.style.color = '#888'};
    btnBlocked.onclick = function() { if(window.ipc.getBlockedUsers) window.ipc.getBlockedUsers(); };
    currentList.appendChild(btnBlocked);

    // Force Visibility
    currentList.style.cssText = 'display:block; width:100%;';
             });

    if(window.ipc.log) window.ipc.log('Loop finalizado. Botões e Status recriados por instancia.');
        } else {
             const allLists = document.querySelectorAll('#sv-friends-list');
             allLists.forEach(l => l.innerHTML = '<div style="text-align:center; color:#666; padding:10px;">Lista de amigos vazia.</div>');
        }

    // Botões de Ação (Adicionar Amigo)
    const actions = document.getElementById('sv-profile-actions');
    actions.innerHTML = '';

    // Debug
    const myId = window.svUserInfo ? window.svUserInfo.id : 'null';
    console.log('[PROFILE] Abrindo ID:', data.id, 'Meu ID:', myId);

    // Se não for eu mesmo, mostrar botão adicionar
    if(window.svUserInfo && window.svUserInfo.id && data.id) {
             const myId = String(window.svUserInfo.id);
             const profId = String(data.id);
    if(myId !== profId && myId !== '0' && myId !== '999') {
                 const btnAdd = document.createElement('button');
    btnAdd.innerText = "ADICIONAR AMIGO";
    btnAdd.style.cssText = "background:#a4d007; color:#1b2838; border:none; padding:5px 10px; font-weight:bold; border-radius:3px; cursor:pointer;";
    btnAdd.onclick = function() {
        window.ipc.addFriend(data.id);
    this.innerText = "SOLICITAÇÃO ENVIADA";
    this.style.background = "#333";
    this.style.cursor = "default";
    this.disabled = true;
                     // alert('Solicitação enviada!'); // Removido alert intrusivo
                 };
    actions.appendChild(btnAdd);
             }
        }
    if(window.svSwitchProfileTab) {
             const tabs = document.querySelectorAll('.sv-profile-tab');
             if(tabs && tabs.length > 0) {tabs[0].click(); }
        }
        // Resetar para a primeira aba para evitar sobreposição visual
        setTimeout(() => {
             const tabs = document.querySelectorAll('.sv-profile-tab');
             if(tabs && tabs.length > 0) {tabs[0].click(); }
        }, 50);

    });

    // LISTENERS CHAT E STATUS
    window.ipc.onFriendStatusUpdate((event, data) => {
        // [FIX] Busca por CLASSE para atualizar todas as instâncias (em listas duplicadas)
        const dots = document.querySelectorAll('.sv-status-user-' + data.id);
        
        dots.forEach(dot => {
             // Preservar a classe identificadora
             const baseClass = 'sv-status-user-' + data.id;
             
             if(data.status.state === 'online' && data.status.game) {
                 dot.className = 'sv-status-dot online ' + baseClass;
                 dot.title = "Jogando: " + data.status.game;
             } else {
                 dot.className = 'sv-status-dot ' + (data.status.state || 'offline') + ' ' + baseClass;
                 dot.title = data.status.state || 'Offline';
             }
        });
    });
    window.ipc.onChatUpdate((event, {chatId, messages}) => {
        if(window.ipc.log) window.ipc.log("[RENDERER] ChatUpdate received. MsgCount: " + (messages ? Object.keys(messages).length : 0));
        const body = document.getElementById('sv-chat-body');
        if(body && messages) {
            body.innerHTML = '';
            const myId = window.svUserInfo ? String(window.svUserInfo.id) : '0';
            
            Object.values(messages).forEach(msg => {
                const div = document.createElement('div');
                div.className = 'sv-chat-msg ' + (String(msg.sender) === myId ? 'me' : 'them');
                
                // Texto da Mensagem (Seguro)
                const txtDiv = document.createElement('div');
                txtDiv.innerText = msg.text;
                div.appendChild(txtDiv);

                // Timestamp (Hora:Minuto)
                if(msg.timestamp) {
                     const d = new Date(msg.timestamp);
                     if(!isNaN(d.getTime())) {
                         const timeDiv = document.createElement('div');
                         timeDiv.style.cssText = 'font-size:9px; opacity:0.5; margin-top:3px; text-align:right; font-family:monospace; margin-bottom:-2px;';
                         timeDiv.innerText = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
                         div.appendChild(timeDiv);
                     }
                }
                
                body.appendChild(div);
            });
            body.scrollTop = body.scrollHeight;
        }
    });

    // Listener para Solicitações de Amizade E Lista de Bloqueados
    window.ipc.onFriendRequestsUpdate((event, payload) => {
        // [NOVO] Checa se é payload de bloqueados
        if(payload && payload.blocked) {
             const blocked = payload.blocked;
    // Mostra um Modal Simples
    const exist = document.getElementById('sv-blocked-modal');
    if(exist) exist.remove();

    const modal = document.createElement('div');
    modal.id = 'sv-blocked-modal';
    modal.className = 'sv-modal-overlay active';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center';

    let html = '<div style="background:#1b2838; width:400px; max-height:80vh; border:1px solid #333; border-radius:4px; display:flex; flex-direction:column">';
        html += '<div style="padding:15px; border-bottom:1px solid #333; font-weight:bold; color:#fff; display:flex; justify-content:space-between"><span>USUÁRIOS BLOQUEADOS</span> <span onclick="document.getElementById(\\'sv-blocked-modal\\').remove()" style="cursor:pointer;color:#ff4d4d">X</span></div>';
        html += '<div style="flex:1; overflow-y:auto; padding:10px;">';

            if(blocked.length === 0) {
                html += '<div style="text-align:center; color:#666; padding:20px;">Nenhum usuário bloqueado.</div>';
            } else {
                blocked.forEach(u => {
                    const av = u.avatar || 'https://secure.gravatar.com/avatar/?d=mm';
                    html += \`
            <div style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #333; gap:10px;">
                <img src="\${av}" style="width:30px;height:30px;border-radius:50%">
                    <span style="flex:1; color:#ccc">\${u.name}</span>
                    <button onclick="window.ipc.unblockFriend(\${u.id}); this.parentElement.remove()" style="background:none; border:1px solid #555; color:#aaa; font-size:10px; padding:3px 8px; cursor:pointer; border-radius:2px">DESBLOQUEAR</button>
            </div>
            \`;
                });
            }
            html += '</div></div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    return; // Encerra aqui se for apenas lista de bloqueados
        }

    // LÓGICA PADRÃO (Solicitações)
    const list = document.getElementById('sv-friends-list');
    if(!list) return;

    const oldReq = document.getElementById('sv-friend-requests-container');
    if(oldReq) oldReq.remove();

    let received = [];
    let sent = [];
    if(Array.isArray(payload)) {
        received = payload;
        } else if (payload) {
        received = payload.received || [];
    sent = payload.sent || [];
        }

    if(received.length === 0 && sent.length === 0) return;

    const container = document.createElement('div');
    container.id = 'sv-friend-requests-container';
    container.style.cssText = 'background:#222; margin-bottom:15px; border:1px solid #444; border-radius:4px; overflow:hidden';

    let html = '';

        if(received.length > 0) {
        html += '<div style="background:#a4d007; color:#1b2838; font-weight:bold; padding:5px 10px; font-size:12px;">SOLICITAÇÕES RECEBIDAS</div>';
            received.forEach(req => {
        html += '<div style="display:flex;align-items:center;padding:10px;gap:10px;border-bottom:1px solid #333;"><img src="' + (req.avatar || 'https://secure.gravatar.com/avatar/?d=mm') + '" style="width:30px;height:30px;border-radius:50%"><div style="flex:1"><div style="color:#fff;font-weight:bold;font-size:13px;">' + req.name + '</div><div style="color:#8f98a0;font-size:10px;">Quer ser seu amigo</div></div><button onclick="window.ipc.acceptFriend(' + req.id + ')" style="background:#a4d007;border:none;color:#1b2838;font-weight:bold;cursor:pointer;padding:4px 8px;border-radius:2px;font-size:11px">ACEITAR</button> <button onclick="window.ipc.rejectFriend(' + req.id + ')" style="background:#c21a1a;border:none;color:#fff;font-weight:bold;cursor:pointer;padding:4px 8px;border-radius:2px;margin-left:5px;font-size:11px">X</button></div>';
            });
        }

        if(sent.length > 0) {
        html += '<div style="background:#444; color:#fff; font-weight:bold; padding:5px 10px; font-size:12px; border-top:1px solid #333;">SOLICITAÇÕES ENVIADAS</div>';
            sent.forEach(req => {
        html += '<div style="display:flex;align-items:center;padding:10px;gap:10px;border-bottom:1px solid #333; opacity:0.7"><img src="' + (req.avatar || 'https://secure.gravatar.com/avatar/?d=mm') + '" style="width:30px;height:30px;border-radius:50%"><div style="flex:1"><div style="color:#ccc;font-weight:bold;font-size:13px;">' + req.name + '</div><div style="color:#8f98a0;font-size:10px;">Aguardando resposta...</div></div></div>';
            });
        }

    container.innerHTML = html;
    list.prepend(container);
    });

    // Função Pesquisar Usuário (Abre Perfil)
    window.svSearchUser = function(optId) {
        const idInput = document.getElementById('sv-friend-search');
    const idVal = optId || (idInput ? idInput.value.trim() : '');

    if(idVal) {
        // Chama IPC para abrir perfil dste ID
        window.ipc.openProfile(idVal);
    if(idInput) idInput.value = ''; // Limpar post search
        }
    };

    // Tab Switcher (Safe Version)
    window.svSwitchProfileTab = function(tabName) {
        try {
            // Explicitly hide known containers to avoid querySelector issues
            const cGames = document.getElementById('sv-profile-content-games');
    const cAchs = document.getElementById('sv-profile-content-achievements');
    const cFriends = document.getElementById('sv-profile-content-friends');

    if(cGames) cGames.style.display = 'none';
    if(cAchs) cAchs.style.display = 'none';
    if(cFriends) cFriends.style.display = 'none';

            document.querySelectorAll('.sv-profile-tab').forEach(el => el.classList.remove('active'));

    // Find triggering tab button
    const tabs = document.querySelectorAll('.sv-profile-tab');
    if(tabName === 'games' && tabs[0]) tabs[0].classList.add('active');
    if(tabName === 'achievements' && tabs[1]) tabs[1].classList.add('active');
    if(tabName === 'friends' && tabs[2]) tabs[2].classList.add('active');

    // Mostrar target
    const content = document.getElementById('sv-profile-content-' + tabName);
    if(content) {
                if(tabName === 'games') {
        content.style.display = 'grid';
    content.style.gridTemplateColumns = 'repeat(auto-fill, minmax(140px, 1fr))';
    content.style.gridAutoRows = 'max-content';
    content.style.alignItems = 'start';
    content.style.gap = '15px';
                } else {
        content.style.display = 'block';
                }
            }
        } catch(e) {console.error("Error switching tabs:", e); }
    };

    // LISTENER DE CONQUISTAS
    window.ipc.onAchievementUnlock((event, ach) => {
        playNotificationSound();
    window.ipc.showOverlay(ach);
    });

    // MINHA BIBLIOTECA
    if (!document.getElementById('sv-mygames-modal')) {
        const modal = document.createElement('div');
    modal.id = 'sv-mygames-modal';
    modal.innerHTML = \`
    <div class="sv-modal-header">
        <span style="font-weight:bold; font-size:16px;">MINHA BIBLIOTECA</span>
        <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeMyGames()">FECHAR (X)</span>
    </div>
    <div class="sv-modal-body" id="sv-mygames-list">
        <div style="text-align:center; padding:20px; color:#8f98a0">Carregando jogos...</div>
    </div>
    \`;
    document.body.appendChild(modal);
    }

    // LISTENER MINHA BIBLIOTECA (Reinserido)
    window.ipc.onUpdateMyGames((event, games) => {
        const list = document.getElementById('sv-mygames-list');
    if(!list) return;

    if(!games || games.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:#8f98a0">Você ainda não baixou nenhum jogo via Launcher.</div>';
    return;
        }

    list.innerHTML = '';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
    list.style.gap = '15px';
    list.style.padding = '15px';

        games.forEach(game => {
             const div = document.createElement('div');
    div.style.cssText = 'background:#1f232b; border-radius:4px; overflow:hidden; cursor:pointer; position:relative; transition:0.2s';
    div.onmouseover = function() {this.style.transform = 'scale(1.02)'; this.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'; };
    div.onmouseout = function() {this.style.transform = 'scale(1)'; this.style.boxShadow = 'none'; };

    // Ação ao clicar: Executar ou Abrir Pasta? Melhor abrir pasta por garantia
    div.onclick = function() { 
                 if(confirm('Abrir local de instalação de ' + game.name + '?')) {
        window.ipc.openGameFolder(game.path); 
                 }
             };

    // Imagem
    const img = document.createElement('img');
    img.src = game.image || 'https://steamverde.net/assets/img/default_game.jpg';
    img.style.cssText = 'width:100%; height:160px; object-fit:cover; display:block';

    // Título
    const title = document.createElement('div');
    title.innerText = game.name;
    title.style.cssText = 'padding:8px; color:#fff; font-size:11px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; background:rgba(0,0,0,0.8); position:absolute; bottom:0; width:100%';

    div.appendChild(img);
    div.appendChild(title);
    list.appendChild(div);
        });
    });

    // AVISOS
    if (!document.getElementById('sv-notices-modal')) {
        const modal = document.createElement('div');
    modal.id = 'sv-notices-modal';
    modal.innerHTML = \`
    <div class="sv-modal-header">
        <span style="font-weight:bold; font-size:16px;">AVISOS E NOVIDADES</span>
        <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeNotices()">FECHAR (X)</span>
    </div>
    <div class="sv-modal-body" id="sv-notices-list">
        <div style="text-align:center; padding:20px; color:#8f98a0">Verificando avisos...</div>
    </div>
    \`;
    document.body.appendChild(modal);
        
        window.ipc.onUpdateNotices((event, data) => {
            const list = document.getElementById('sv-notices-list');
    if(!list) return;
    const notices = data.notices;
    const readIds = data.readIds;
    if(notices.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px; color:#8f98a0">Nenhum aviso no momento.</div>';
    return;
            }
    list.innerHTML = '';
    window.svOpenNotice = function(index) {
                const noticeData = notices[index];
    if(noticeData) {
        window.ipc.openNoticeWindow(noticeData);
    window.ipc.markNoticeRead(noticeData.id); 
                }
            };
            notices.forEach((notice, index) => {
                const isRead = readIds.includes(notice.id);
    const item = document.createElement('div');
    item.className = isRead ? 'sv-notice-item' : 'sv-notice-item unread';
    const openBtn = \`<button class="sv-notice-btn" style="border-color:#a4d007; color:#a4d007" onclick="window.svOpenNotice(\${index})">ABRIR / LER</button>\`;
    const shortContent = notice.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...';
    item.innerHTML = \`
    <div class="sv-notice-header">
        <span class="sv-notice-title">\${notice.title} \${!isRead ? '<span style="color:#a4d007; font-size:10px; margin-left:5px">[NOVO]</span>' : ''}</span>
        <span class="sv-notice-date">\${notice.date}</span>
    </div>
    <div class="sv-notice-body">\${shortContent}</div>
    <div class="sv-notice-actions">
        \${openBtn}
        <button class="sv-notice-btn del" onclick="window.ipc.deleteNotice(\${notice.id})">EXCLUIR</button>
    </div>
    \`;
    list.appendChild(item);
            });
        });
    }

    // REAL-DEBRID
    if (!document.getElementById('sv-rd-modal')) {
        const modal = document.createElement('div');
    modal.id = 'sv-rd-modal';
    modal.innerHTML = \`
    <div class="sv-modal-header" style="border-bottom-color:#ffcc00">
        <span style="font-weight:bold; font-size:16px; color:#ffcc00">CONFIGURAÇÃO REAL-DEBRID</span>
        <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeRD()">FECHAR (X)</span>
    </div>
    <div class="sv-modal-body" style="padding:20px; display:flex; flex-direction:column;">
        <label style="color:#ccc; margin-bottom:5px; font-weight:bold">API Token do Real-Debrid:</label>
        <input type="password" id="rd-api-input" class="rd-input" placeholder="Cole seu Token aqui (ex: ABC123XYZ...)">
            <button class="rd-btn" onclick="saveRD()">SALVAR CONFIGURAÇÃO</button>
            <button class="rd-btn" style="background:#333; color:#fff" onclick="removeRD()">REMOVER / DESATIVAR</button>
            <div id="rd-status" class="rd-status">Status: Não configurado</div>
            <div style="margin-top:20px; font-size:11px; color:#666">
                Acesse <a href="#" style="color:#ffcc00" onclick="window.ipc.openExternal('https://real-debrid.com/apitoken')">real-debrid.com/apitoken</a> para pegar sua chave.
            </div>
    </div>
    \`;
    document.body.appendChild(modal);

    window.saveRD = function() {
            const token = document.getElementById('rd-api-input').value;
            if(token.trim().length > 5) {
        window.ipc.saveRDToken(token);
    document.getElementById('rd-status').innerText = 'Verificando...';
            }
        };

    window.removeRD = function() {
        window.ipc.removeRDToken();
    document.getElementById('rd-api-input').value = '';
    document.getElementById('rd-status').innerText = 'Token removido.';
        };
    }

    // BOTÃO FLUTUANTE
    if (!document.getElementById('sv-float-dl-btn')) {
        const btn = document.createElement('div');
    btn.id = 'sv-float-dl-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg> DOWNLOAD VIA LAUNCHER';
    btn.onclick = function() {
            if(this.classList.contains('install-mode')) return;
    const mag = document.querySelector('a[href^="magnet:"]');
    if(mag) {
                const gameImg = svFindGameImage();
    window.ipc.startTorrent(mag.href, gameImg);
            }
        };
    document.body.appendChild(btn);
    }

    // BARRA DE DOWNLOAD
    if (!document.getElementById('sv-download-bar')) {
        const bar = document.createElement('div');
    bar.id = 'sv-download-bar';
    bar.innerHTML = \`
    <div id="sv-dl-tabs"></div>
    <div id="sv-dl-graph-wrapper"><canvas id="sv-dl-canvas"></canvas></div>
    <div class="sv-dl-content">
        <div class="sv-dl-info">
            <div class="sv-dl-title">
                <svg style="width:20px;height:20px;fill:#a4d007" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z" /></svg>
                <span id="sv-dl-name">Conectando aos Trackers...</span>
            </div>
            <div class="sv-dl-progress-bg">
                <div class="sv-dl-progress-bar" id="sv-dl-bar"></div>
            </div>
            <div class="sv-dl-stats">
                <div class="sv-stat-item">
                    <svg class="sv-stat-icon" viewBox="0 0 24 24"><path d="M13,2.05L13,2.05L13,2.05L13,2.05L7,14H12V22L18,10H13V2.05Z" /></svg>
                    <span id="sv-dl-speed" class="sv-stat-val">0 KB/s</span>
                </div>
                <div class="sv-stat-item">
                    <svg class="sv-stat-icon" viewBox="0 0 24 24"><path d="M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z" /></svg>
                    <span id="sv-dl-peers" class="sv-stat-val">0 Peers</span>
                </div>
                <div class="sv-stat-item">
                    <svg class="sv-stat-icon" viewBox="0 0 24 24"><path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 12,2A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
                    <span id="sv-dl-eta" class="sv-stat-val">--:--</span>
                </div>
                <span id="sv-dl-perc" style="margin-left:auto; font-size:18px; font-weight:900; color:#a4d007; text-shadow:0 0 10px rgba(164,208,7,0.5)">0%</span>
            </div>
        </div>
        <div class="sv-dl-controls">
            <button class="sv-btn-icon btn-files" onclick="window.ipc.toggleFilesModal()" title="Arquivos">
                <svg viewBox="0 0 24 24"><path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V13H11V18H15Z" /></svg>
            </button>
            <button class="sv-btn-icon btn-pause" onclick="window.ipc.pauseTorrent()" title="Pausar / Continuar" id="sv-btn-pause">
                <svg id="icon-pause" viewBox="0 0 24 24"><path d="M14,19H18V5H14M6,19H10V5H6V19Z" /></svg>
                <svg id="icon-play" style="display:none" viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg>
            </button>
            <button class="sv-btn-icon btn-folder" onclick="window.ipc.openFolder()" title="Pasta Destino">
                <svg viewBox="0 0 24 24"><path d="M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,4Z" /></svg>
            </button>
            <button class="sv-btn-icon btn-stop" onclick="window.ipc.stopTorrent()" title="Cancelar e Excluir">
                <svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" /></svg>
            </button>
        </div>
    </div>

    <div id="sv-dl-legend">
        <div class="sv-legend-item"><div class="sv-legend-line" style="background:#a4d007;box-shadow:0 0 5px #a4d007"></div>Velocidade</div>
        <div class="sv-legend-item"><div class="sv-legend-line" style="background:#00d9ff;box-shadow:0 0 5px #00d9ff"></div>Conexões</div>
    </div>
    \`;
    document.body.appendChild(bar);
    window.dlCanvas = document.getElementById('sv-dl-canvas');
    window.dlCtx = window.dlCanvas.getContext('2d');

        window.ipc.onUpdateTabs((event, tabs) => {
            const container = document.getElementById('sv-dl-tabs');
    if(!container) return;
    container.innerHTML = '';
            tabs.forEach(tab => {
                const el = document.createElement('div');
    el.className = tab.active ? 'sv-dl-tab active' : 'sv-dl-tab';
    el.innerText = \`\${tab.progress}% - \${tab.name}\`;
                el.onclick = () => window.ipc.switchTab(tab.hash);
    container.appendChild(el);
            });
        });
    }

    if (!document.getElementById('sv-toggle-tab')) {
        const tab = document.createElement('div');
    tab.id = 'sv-toggle-tab';
    tab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" /></svg>';
    tab.onclick = function() {window.ipc.toggleDownloadBar(); };
    document.body.appendChild(tab);
    }

    if (!document.getElementById('sv-files-modal')) {
        const modal = document.createElement('div');
    modal.id = 'sv-files-modal';
    modal.innerHTML = \`
    <div class="sv-modal-header" style="color:#fff; padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between">
        <span style="font-weight:bold">GERENCIADOR DE ARQUIVOS</span>
        <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.toggleFilesModal()">FECHAR (X)</span>
    </div>
    <div class="sv-modal-body" id="sv-files-list"></div>
    \`;
    document.body.appendChild(modal);
    }

    function checkUI() {
        const mag = document.querySelector('a[href^="magnet:"]');
    const btn = document.getElementById('sv-float-dl-btn');
    const bar = document.getElementById('sv-download-bar');
    const tab = document.getElementById('sv-toggle-tab');

    // [HYDRATION] Garantir Chat Modal (Injeção Padrão)
    if (!document.getElementById('sv-chat-modal') && window.UI_TEMPLATES && window.UI_TEMPLATES.HTML_CHAT_MODAL) {
             const wrapper = document.createElement('div');
    wrapper.innerHTML = window.UI_TEMPLATES.HTML_CHAT_MODAL;
    const realModal = wrapper.firstElementChild;
    document.body.appendChild(realModal);
    // Ensure hidden initially
    realModal.classList.remove('visible');
        } else {
             // Se já existir, garantir bind e estado visual
             if(window.svBindChatEvents) window.svBindChatEvents(true);

    // [STATE ENFORCEMENT] Se deveria estar aberto, força aberto
    const modal = document.getElementById('sv-chat-modal');
    if(window.svChatIsOpen && modal) {
                 if(modal.style.display === 'none' || !modal.classList.contains('visible')) {
        modal.style.display = 'flex';
    modal.classList.add('visible');
    // Force Z-Index again
    modal.style.zIndex = '999999';
                 }
             }
        }


    if(btn) {
            if(btn.classList.contains('install-mode')) {
        btn.style.display = 'flex';
            } else {
                const shouldShow = mag ? 'flex' : 'none';
    if(btn.style.display !== shouldShow) btn.style.display = shouldShow;
            }
    if(bar && bar.classList.contains('visible')) {
                if(!btn.classList.contains('pushed-up')) btn.classList.add('pushed-up');
    if(!tab.classList.contains('raised')) tab.classList.add('raised');
    if(!tab.classList.contains('rotated')) tab.classList.add('rotated'); 
            } else {
                if(btn.classList.contains('pushed-up')) btn.classList.remove('pushed-up');
    if(tab.classList.contains('raised')) tab.classList.remove('raised');
    if(tab.classList.contains('rotated')) tab.classList.remove('rotated');
            }
        }

    // Atualizar Sidebar se ID for genérico (...)
    // Atualizar Sidebar se ID for genérico OU se ID for válido e difere do atual
    const sideId = document.getElementById('sv-menu-id');
    const sideAv = document.getElementById('sv-menu-avatar');
    const sideNm = document.getElementById('sv-menu-name');

    if(sideId && window.svUserInfo && window.svUserInfo.id && window.svUserInfo.id !== 999 && window.svUserInfo.id !== 194) {
             const currentTextId = sideId.innerText.replace('ID: ', '').trim();
    // Se o texto atual for "..." ou "0" ou diferente do ID real, força update
    if(currentTextId === '...' || currentTextId === '0' || String(currentTextId) !== String(window.svUserInfo.id)) {
                 if(sideAv) sideAv.src = window.svUserInfo.avatar || 'https://secure.gravatar.com/avatar/?d=mm';
    if(sideNm) sideNm.innerText = window.svUserInfo.name;
    sideId.innerText = 'ID: ' + window.svUserInfo.id;
             }
        }
    }



    if(window.ipc && window.ipc.rendererReady) window.ipc.rendererReady();
    setInterval(checkUI, 500);
    if(window.ipc.log) window.ipc.log("[RENDERER] CHECKPOINT: Script Finished");
    } catch(e) {
        console.error("UI Script Execution Error:", e);
    if(window.ipc && window.ipc.log) window.ipc.log("RENDERER UI ERROR: " + e.message + " | Stack: " + e.stack);
    }
    `;

const INJECT_TITLEBAR_SCRIPT = (userName, iconBase64, appVersion) => `
    if (!document.getElementById('sv-custom-titlebar')) { 
    const bar = document.createElement('div');
    bar.id = 'sv-custom-titlebar';
    bar.innerHTML = \`
    <div class="sv-left-area">
        <div class="sv-menu-btn" onclick="window.ipc.toggleMenu()">
            <svg viewBox="0 0 24 24"><path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" /></svg>
            <div id="sv-news-badge"></div>
        </div>
        <button class="sv-nav-btn" onclick="window.svNav('back')" title="Voltar"><svg viewBox="0 0 24 24"><path d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" /></svg></button>
        <button class="sv-nav-btn" onclick="window.svNav('forward')" title="Avançar"><svg viewBox="0 0 24 24"><path d="M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z" /></svg></button>
        <img src="${iconBase64}" class="sv-app-icon" style="margin-left:10px">
            <div class="sv-bar-logo" id="sv-app-title">STEAM VERDE</div>
    </div>
    <div class="sv-bar-controls">
        <div id="sv-friends-btn" onclick="window.svToggleFriendRequests()" style="cursor:pointer; margin-right:15px; display:flex; align-items:center; position:relative; color:#ccc; opacity:0.8" title="Solicitações de Amizade">
            <svg style="width:20px;height:20px;fill:currentColor" viewBox="0 0 24 24"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>
            <div id="sv-friends-badge" style="display:none; position:absolute; top:-2px; right:-2px; width:8px; height:8px; background:#a4d007; border-radius:50%; border:1px solid #171a21"></div>
            <div id="sv-friends-dropdown" style="display:none; position:absolute; top:35px; right:0; width:280px; background:#171a21; border:1px solid #333; z-index:9999; box-shadow:0 5px 15px rgba(0,0,0,0.8); padding:0; border-radius:4px; text-align:left; cursor:default" onclick="event.stopPropagation()">
                <div style="background:#1b2838; padding:8px 10px; border-bottom:1px solid #333; font-size:12px; font-weight:bold; color:#fff;">Solicitações de Amizade</div>
                <div id="sv-friends-list" style="max-height:300px; overflow-y:auto; padding:0;"></div>
                <div style="padding:8px; text-align:center; border-top:1px solid #333; font-size:11px; color:#aaa; cursor:pointer;" onclick="if(window.svUserInfo) { window.ipc.openProfile(window.svUserInfo.id); setTimeout(() => window.svSwitchProfileTab('friends'), 600); }">Ver Todas</div>
            </div>
        </div>
        <span class="sv-version-tag">v${appVersion} [Kronos]</span>
        <button id="sv-update-btn" title="Atualizar" onclick="window.ipc.restartAndUpdate()">
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg>
        </button>
        <div class="sv-user-menu" onclick="toggleSvDropdown()">
            <span class="sv-user-name">${userName.name}</span>
            <span class="sv-arrow">▼</span>
            <div id="sv-logout-dropdown">
                <div class="sv-logout-item" onclick="confirmLogout()">Sair da conta</div>
            </div>
        </div>
        <button class="sv-win-btn" onclick="window.ipc.minimize()" title="Minimizar"><svg viewBox="0 0 10 1"><path d="M0 0h10v1H0z" /></svg></button>
        <button class="sv-win-btn" onclick="window.ipc.maximize()" title="Maximizar"><svg viewBox="0 0 10 10"><path d="M0 0h10v10H0V0zm1 1v8h8V1H1z" /></svg></button>
        <button class="sv-win-btn sv-close-btn" onclick="window.ipc.close()" title="Fechar"><svg viewBox="0 0 10 10"><path d="M10 1L9 0 5 4 1 0 0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4z" /></svg></button>
    </div>
    \`;
    window.svPendingRequests = [];
    window.svRenderFriendRequests = function() {
          const list = document.getElementById('sv-friends-list');
    if(!list) return;
    if(window.svPendingRequests.length === 0) {
        list.innerHTML = '<div style="padding:15px; text-align:center; color:#666; font-size:12px">Nenhuma solicitação pendente.</div>';
    return;
          }
    let html = '';
          window.svPendingRequests.forEach(req => {
        html += '<div style="display:flex; align-items:center; padding:8px 10px; border-bottom:1px solid #222;">' +
        '<img src="' + (req.avatar || 'https://steamverde.net/wp-content/uploads/2023/12/default-avatar.png') + '" style="width:32px; height:32px; border-radius:4px; margin-right:8px;">' +
        '<div style="flex:1; overflow:hidden;">' +
        '<div style="font-size:13px; color:#ddd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (req.name || 'Usuário') + '</div>' +
        '</div>' +
        '<div style="display:flex; gap:5px;">' +
        '<button onclick="window.ipc.acceptFriend(\\'' + req.id + '\\'); this.closest(\\'div\\').style.opacity=\\'0.5\\'; this.disabled=true;" title="Aceitar" style="background:#5c7e10; border:none; color:white; width:24px; height:24px; border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✓</button>' +
'<button onclick="window.ipc.rejectFriend(\\'' + req.id + '\\'); this.closest(\\'div\\').style.opacity=\\'0.5\\'; this.disabled=true;" title="Recusar" style="background:#8c2929; border:none; color:white; width:24px; height:24px; border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center;">✕</button>' +
    '</div>' +
    '</div>';
          });
list.innerHTML = html;
      };

window.svToggleFriendRequests = function () {
    const dd = document.getElementById('sv-friends-dropdown');
    if (dd) {
        if (dd.style.display === 'none') {
            dd.style.display = 'block';
            window.svRenderFriendRequests();
        } else {
            dd.style.display = 'none';
        }
    } else {
        window.svOpenFriendRequests();
    }
};

document.addEventListener('click', function (e) {
    if (!e.target.closest('#sv-friends-btn')) {
        const dd = document.getElementById('sv-friends-dropdown');
        if (dd) dd.style.display = 'none';
    }
});

window.svOpenFriendRequests = function () {
    if (window.svUserInfo && window.svUserInfo.id) {
        window.ipc.openProfile(window.svUserInfo.id);
        setTimeout(() => { if (window.svSwitchProfileTab) window.svSwitchProfileTab('friends'); }, 600);
    } else {
        const uid = '${userName && userName.id ? userName.id : ""}';
        if (uid) window.ipc.openProfile(uid);
        else window.ipc.openProfile('me');
        setTimeout(() => { if (window.svSwitchProfileTab) window.svSwitchProfileTab('friends'); }, 600);
    }
};

if (window.ipc && window.ipc.onFriendRequestsUpdate) {
    window.ipc.onFriendRequestsUpdate((event, data) => {
        const badge = document.getElementById('sv-friends-badge');
        const rec = (data && data.received) ? data.received : [];
        window.svPendingRequests = rec;
        if (badge) {
            if (rec.length > 0) badge.style.display = 'block';
            else badge.style.display = 'none';
        }
        const dd = document.getElementById('sv-friends-dropdown');
        if (dd && dd.style.display !== 'none') window.svRenderFriendRequests();
    });
}
document.body.prepend(bar);

window.svNav = function (direction) {
    const loader = document.getElementById('sv-launcher-loader');
    if (loader) loader.classList.add('visible');
    if (direction === 'back') window.ipc.goBack();
    else window.ipc.goForward();
};

const updateTitle = () => {
    const titleEl = document.getElementById('sv-app-title');
    if (titleEl && document.title) {
        let clean = document.title.replace(' - Steam Verde', '').replace(' | Steam Verde', '');
        titleEl.innerText = clean + ' | STEAM VERDE';
    }
};
updateTitle();
new MutationObserver(updateTitle).observe(document.querySelector('title'), { childList: true, subtree: true });
window.toggleSvDropdown = function () { document.getElementById('sv-logout-dropdown').classList.toggle('show'); };
window.confirmLogout = function () { if (confirm("Tem certeza que deseja sair da sua conta?")) { window.ipc.logout(); } };
document.addEventListener('click', function (e) { if (!e.target.closest('.sv-user-menu')) { document.getElementById('sv-logout-dropdown').classList.remove('show'); } });
  }
`;

module.exports = { INJECT_LOADER_DOM, CLICK_LISTENER_SCRIPT, HIDE_LOADER_SCRIPT, SHOW_UPDATE_BTN_SCRIPT, INJECT_UI_SCRIPT, INJECT_TITLEBAR_SCRIPT };

    try {
        if(!window.UI_TEMPLATES) { window.UI_TEMPLATES = { HTML_PROFILE_MODAL: '', HTML_SETTINGS_MODAL: '', HTML_TOOLTIP: '' }; }
        
  function svFindGameImage() {
      let gameImg = '';
      const img1 = document.querySelector('.package-image img');
      if (img1 && img1.src) return img1.src;
      const link1 = document.querySelector('.package-image a');
      if (link1 && link1.href && link1.href.match(/\.(jpg|jpeg|png|webp)/i)) return link1.href;
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
        const userSection = `
            <div style="padding: 20px 25px; border-bottom: 1px solid #282c34; display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                <img id="sv-menu-avatar" src="" style="width:40px; height:40px; border-radius:50%; border:2px solid #a4d007;">
                <div>
                   <div id="sv-menu-name" style="color:#fff; font-weight:bold; font-size:14px;">Usuário</div>
                   <div id="sv-menu-id" style="color:#8f98a0; font-size:11px;">ID: ...</div>
                </div>
            </div>
        `;

        menu.innerHTML = userSection + `
            <a class="sv-menu-item" onclick="window.ipc.openProfile()">${iconGames} Meu Perfil</a>
            <a class="sv-menu-item" onclick="window.ipc.openMyGames()">${iconFolder} Minha Biblioteca Local</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" id="sv-menu-avisos" onclick="window.ipc.openNotices()">${iconNews} Avisos e Novidades</a>
            <a class="sv-menu-item" onclick="window.ipc.openAchievements()">${iconTrophy} Conquistas</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" onclick="window.ipc.openSettings()"><svg viewBox="0 0 24 24" style="fill:#8f98a0"><path d="M19.1,12.9C19.1,12.6 19.1,12.3 19.1,12L21.5,10.1C21.7,10 21.8,9.7 21.7,9.4L19.4,5.5C19.3,5.3 19,5.2 18.7,5.3L15.9,6.4C15.3,6 14.7,5.6 14,5.3L13.5,2.3C13.5,2 13.3,1.8 13,1.8H8.4C8.1,1.8 7.9,2 7.8,2.3L7.4,5.3C6.7,5.6 6.1,6 5.5,6.4L2.7,5.3C2.4,5.2 2.1,5.3 2,5.5L-0.3,9.4C-0.4,9.6 -0.4,9.9 -0.2,10.1L2.2,12C2.2,12.3 2.2,12.6 2.2,12.9L-0.2,14.8C-0.4,15 -0.4,15.3 -0.3,15.6L1.9,19.5C2,19.7 2.4,19.8 2.7,19.7L5.5,18.6C6.1,19 6.7,19.4 7.4,19.7L7.8,22.7C7.9,23 8.1,23.2 8.4,23.2H13C13.3,23.2 13.5,23 13.6,22.7L14,19.7C14.7,19.4 15.3,19 15.9,18.6L18.7,19.7C19,19.8 19.3,19.7 19.4,19.5L21.7,15.6C21.8,15.3 21.8,15 21.6,14.8L19.1,12.9ZM10.7,12.5C10.7,14.7 8.9,16.5 6.7,16.5C4.5,16.5 2.7,14.7 2.7,12.5C2.7,10.3 4.5,8.5 6.7,8.5C8.9,8.5 10.7,10.3 10.7,12.5Z"/></svg> Configurações</a>
            <a class="sv-menu-item" onclick="window.ipc.openRD()"><svg viewBox="0 0 24 24" style="fill:#a4d007"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M10 17L15 12L10 7V17Z"/></svg> Real-Debrid</a>
            <div style="flex:1"></div> <a class="sv-menu-item" onclick="window.debugClearData()" style="color:#ff4d4d; border-top:1px solid #282c34; padding-top:20px; padding-bottom:20px">
               <svg viewBox="0 0 24 24" style="fill:#ff4d4d"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
               Limpar Dados
            </a>
        `;
        document.body.appendChild(menu);
        
        // Atualizar info inicial se disponível
        if(window.svUserInfo) {
             const av = document.getElementById('sv-menu-avatar');
             const nm = document.getElementById('sv-menu-name');
             const id = document.getElementById('sv-menu-id');
             if(av) av.src = window.svUserInfo.avatar || 'https://secure.gravatar.com/avatar/?d=mm';
             if(nm) nm.innerText = window.svUserInfo.name;
             if(id) id.innerText = 'ID: ' + (window.svUserInfo.id || '...');
        }

        window.debugClearData = function() {
            if(confirm("ATENÇÃO: Isso limpará TODOS os dados do Launcher.")) { window.ipc.clearDataAndRestart(); }
        };
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
        const modal = document.getElementById('sv-profile-modal');
        if(modal) modal.style.display = 'flex';
        
        document.getElementById('sv-profile-name').innerText = data.nickname;
        document.getElementById('sv-profile-id').innerText = 'ID: ' + data.id;
        document.getElementById('sv-profile-avatar').src = data.avatar;
        
        // Atualizar também o Sidebar (caso esteja desatualizado)
        const sideAv = document.getElementById('sv-menu-avatar');
        const sideNm = document.getElementById('sv-menu-name');
        const sideId = document.getElementById('sv-menu-id');
        if(sideAv && sideNm && sideId && data.id !== 999 && data.id !== 194) {
             sideAv.src = data.avatar;
             sideNm.innerText = data.nickname;
             sideId.innerText = 'ID: ' + data.id;
        }

        // Renderizar Jogos
        const listGames = document.getElementById('sv-profile-content-games');
        listGames.innerHTML = '';
        if(data.library && data.library.length > 0) {
            data.library.forEach(game => {
                 const div = document.createElement('div');
                 div.className = 'sv-game-card';
                 div.innerHTML = '<div class="sv-game-info"><div class="sv-game-title">' + game.name + '</div></div>';
                 listGames.appendChild(div);
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
                        h += '<div class="sv-ach-item ' + cls + '" data-title="' + st + '" data-desc="' + sd + '" onmouseenter="window.svShowTooltip(this)" onmouseleave="window.svHideTooltip()"><img src="' + a.icon + '" style="width:48px;height:48px;"></div>';
                    });
                    h += '</div>';
                    return h;
                };

                listAch.innerHTML = renderGroup('CONQUISTAS DO LAUNCHER', launcherAchs) + 
                                    renderGroup('CONQUISTAS DE JOGOS', gameAchs);
            } else {
                listAch.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">Nenhuma conquista registrada.</div>';
            }
     }
    });

    // Tooltip Helpers Globais
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
        const listFriends = document.getElementById('sv-friends-list');
        listFriends.innerHTML = ''; // Limpar lista anterior mas manter o search input (que esta no HTML estatico)
        // OBS: O HTML do Search Input esta no template, entao innerHTML = '' vai apagar ele se nao cuidarmos.
        // Vamos apenas dar append na lista de amigos apos o search box se ele existir, 
        // ou recriar a estrutura se o template for estático.
        // WORKAROUND: O ui_templates ja tem o search box fixo. Vamos apenas adicionar os amigos numa div container se necessario, ou limpar filhos exeto o primeiro?
        // Melhor: Vamos assumir que sv-friends-list é O CONTAINER DOS AMIGOS, e o search box está ACIMA dele no template.
        // CHECK TEMPLATE: Sim, Search Box é irmao anterior do sv-friends-list. Entao podemos limpar sv-friends-list seguros.
        
        if(data.friends && data.friends.length > 0) {
             data.friends.forEach(fr => {
                 const div = document.createElement('div');
                 div.style.cssText = 'display:flex; align-items:center; padding:10px; border-bottom:1px solid #333; gap:10px; cursor:pointer; transition:0.2s';
                 div.onmouseover = function(){ this.style.background = '#1f232b'; };
                 div.onmouseout = function(){ this.style.background = 'transparent'; };
                 div.onclick = function() { window.svSearchUser(fr.id); }; // Clicar no amigo abre perfil dele
                 div.innerHTML = `<img src="${fr.avatar}" style="width:30px;height:30px;border-radius:50%"> <span style="color:#ccc">${fr.name}</span>`;
                 listFriends.appendChild(div);
             });
        } else {
             listFriends.innerHTML = '<div style="text-align:center; color:#666; padding:10px;">Lista de amigos vazia.</div>';
        }

        // Botões de Ação (Adicionar Amigo)
        const actions = document.getElementById('sv-profile-actions');
        actions.innerHTML = '';
        
        // Debug
        const myId = window.svUserInfo ? window.svUserInfo.id : 'null';
        console.log('[PROFILE] Abrindo ID:', data.id, 'Meu ID:', myId);

        // Se não for eu mesmo, mostrar botão adicionar
        // FIX: Comparação estrita de strings para evitar problemas de tipo (1 vs "1")
        if(window.svUserInfo && String(data.id) !== String(window.svUserInfo.id)) {
             const btnAdd = document.createElement('button');
             btnAdd.innerText = "ADICIONAR AMIGO";
             btnAdd.style.cssText = "background:#a4d007; color:#1b2838; border:none; padding:5px 10px; font-weight:bold; border-radius:3px; cursor:pointer;";
             btnAdd.onclick = function() { window.ipc.addFriend(data.id); alert('Solicitação enviada!'); };
             actions.appendChild(btnAdd);
        }
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

    // Tab Switcher
    window.svSwitchProfileTab = function(tabName) {
        // Ocultar todos
        document.querySelectorAll('.sv-profile-content').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.sv-profile-tab').forEach(el => el.classList.remove('active'));
        
        // Mostrar target
        const content = document.getElementById('sv-profile-content-' + tabName);
        if(content) content.style.display = 'block';
        
        // Ativar aba (hack simples procurando pelo texto ou index)
        const tabs = document.querySelectorAll('.sv-profile-tab');
        if(tabName === 'games') tabs[0].classList.add('active');
        if(tabName === 'achievements') tabs[1].classList.add('active');
        if(tabName === 'friends') tabs[2].classList.add('active');
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
        modal.innerHTML = `
            <div class="sv-modal-header">
                <span style="font-weight:bold; font-size:16px;">MINHA BIBLIOTECA</span>
                <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeMyGames()">FECHAR (X)</span>
            </div>
            <div class="sv-modal-body" id="sv-mygames-list">
                <div style="text-align:center; padding:20px; color:#8f98a0">Carregando jogos...</div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // AVISOS
    if (!document.getElementById('sv-notices-modal')) {
        const modal = document.createElement('div');
        modal.id = 'sv-notices-modal';
        modal.innerHTML = `
            <div class="sv-modal-header">
                <span style="font-weight:bold; font-size:16px;">AVISOS E NOVIDADES</span>
                <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.closeNotices()">FECHAR (X)</span>
            </div>
            <div class="sv-modal-body" id="sv-notices-list">
                <div style="text-align:center; padding:20px; color:#8f98a0">Verificando avisos...</div>
            </div>
        `;
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
                const openBtn = `<button class="sv-notice-btn" style="border-color:#a4d007; color:#a4d007" onclick="window.svOpenNotice(${index})">ABRIR / LER</button>`;
                const shortContent = notice.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...';
                item.innerHTML = `
                    <div class="sv-notice-header">
                        <span class="sv-notice-title">${notice.title} ${!isRead ? '<span style="color:#a4d007; font-size:10px; margin-left:5px">[NOVO]</span>' : ''}</span>
                        <span class="sv-notice-date">${notice.date}</span>
                    </div>
                    <div class="sv-notice-body">${shortContent}</div>
                    <div class="sv-notice-actions">
                        ${openBtn}
                        <button class="sv-notice-btn del" onclick="window.ipc.deleteNotice(${notice.id})">EXCLUIR</button>
                    </div>
                `;
                list.appendChild(item);
            });
        });
    }

    // REAL-DEBRID
    if (!document.getElementById('sv-rd-modal')) {
        const modal = document.createElement('div');
        modal.id = 'sv-rd-modal';
        modal.innerHTML = `
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
        `;
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
        bar.innerHTML = `
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
        `;
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
                el.innerText = `${tab.progress}% - ${tab.name}`;
                el.onclick = () => window.ipc.switchTab(tab.hash);
                container.appendChild(el);
            });
        });
    }

    if (!document.getElementById('sv-toggle-tab')) {
        const tab = document.createElement('div');
        tab.id = 'sv-toggle-tab';
        tab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" /></svg>';
        tab.onclick = function() { window.ipc.toggleDownloadBar(); };
        document.body.appendChild(tab);
    }

    if (!document.getElementById('sv-files-modal')) {
        const modal = document.createElement('div');
        modal.id = 'sv-files-modal';
        modal.innerHTML = `
            <div class="sv-modal-header" style="color:#fff; padding:15px; border-bottom:1px solid #333; display:flex; justify-content:space-between">
                <span style="font-weight:bold">GERENCIADOR DE ARQUIVOS</span>
                <span style="cursor:pointer; font-weight:bold; color:#ff4d4d" onclick="window.ipc.toggleFilesModal()">FECHAR (X)</span>
            </div>
            <div class="sv-modal-body" id="sv-files-list"></div>
        `;
        document.body.appendChild(modal);
    }

    function checkUI() {
        const mag = document.querySelector('a[href^="magnet:"]');
        const btn = document.getElementById('sv-float-dl-btn');
        const bar = document.getElementById('sv-download-bar');
        const tab = document.getElementById('sv-toggle-tab');
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
        const sideId = document.getElementById('sv-menu-id');
        if(sideId && sideId.innerText.includes('...') && window.svUserInfo && window.svUserInfo.id && window.svUserInfo.id !== 999 && window.svUserInfo.id !== 194) {
             const sideAv = document.getElementById('sv-menu-avatar');
             const sideNm = document.getElementById('sv-menu-name');
             if(sideAv) sideAv.src = window.svUserInfo.avatar;
             if(sideNm) sideNm.innerText = window.svUserInfo.name;
             sideId.innerText = 'ID: ' + window.svUserInfo.id;
        }
    }
    setInterval(checkUI, 500);
    } catch(e) {
        console.error("UI Script Execution Error:", e);
        if(window.ipc && window.ipc.log) window.ipc.log("RENDERER UI ERROR: " + e.message + " | Stack: " + e.stack);
    }

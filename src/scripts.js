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
    ${FIND_IMAGE_LOGIC} 
    
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
        
        const iconGames = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradGames)" d="M21,6H3A2,2 0 0,0 1,8V16A2,2 0 0,0 3,18H21A2,2 0 0,0 23,16V8A2,2 0 0,0 21,6M10,15H8V17H6V15H4V13H6V11H8V13H10V15M20,11H18V13H20V11M20,15H18V17H20V15M17,11H15V13H17V11M17,15H15V17H17V15Z"/><defs><linearGradient id="gradGames" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" /><stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconNews = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradNews)" d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2M13 17H11V15H13V17M13 13H11V7H13V13Z"/><defs><linearGradient id="gradNews" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f093fb;stop-opacity:1" /><stop offset="100%" style="stop-color:#f5576c;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconTrophy = '<svg viewBox="0 0 24 24"><path style="fill:url(#gradTrophy)" d="M19 5H17C17 3.9 16.1 3 15 3H9C7.9 3 7 3.9 7 5H5C3.9 5 3 5.9 3 7V8C3 10.8 5.2 13 8 13.5V15C8 16.1 8.9 17 10 17H14C15.1 17 16 16.1 16 15V13.5C18.8 13 21 10.8 21 8V7C21 5.9 20.1 5 19 5M5 8V7H7V8C7 9.1 6.1 10 5 10C5 10 5 10 5 10V8M19 8V10C19 10 19 10 19 10C17.9 10 17 9.1 17 8V7H19V8M12 18C10.9 18 10 18.9 10 20H14C14 18.9 13.1 18 12 18Z"/><defs><linearGradient id="gradTrophy" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" /><stop offset="100%" style="stop-color:#FDB931;stop-opacity:1" /></linearGradient></defs></svg>';
        const iconFolder = '<svg viewBox="0 0 24 24" style="fill:#8f98a0"><path d="M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z"/></svg>';

        menu.innerHTML = \`
            <a class="sv-menu-item" onclick="window.ipc.openMyGames()">\${iconGames} Meus Jogos</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" id="sv-menu-avisos" onclick="window.ipc.openNotices()">\${iconNews} Avisos e Novidades</a>
            <a class="sv-menu-item" onclick="window.ipc.openAchievements()">\${iconTrophy} Conquistas</a>
            <div class="sv-menu-divider"></div>
            <a class="sv-menu-item" onclick="window.ipc.changeDownloadPath()">\${iconFolder} Alterar Pasta de Download</a>
            <a class="sv-menu-item" onclick="window.ipc.openRD()"><svg viewBox="0 0 24 24" style="fill:#a4d007"><path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M19 19H5V5H19V19M10 17L15 12L10 7V17Z"/></svg> Real-Debrid</a>
            <div style="flex:1"></div> <a class="sv-menu-item" onclick="window.debugClearData()" style="color:#ff4d4d; border-top:1px solid #282c34; padding-top:20px; padding-bottom:20px">
               <svg viewBox="0 0 24 24" style="fill:#ff4d4d"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
               Limpar Dados / Debug
            </a>
        \`;
        document.body.appendChild(menu);

        window.debugClearData = function() {
            if(confirm("ATENÇÃO: Isso limpará TODOS os dados do Launcher.")) { window.ipc.clearDataAndRestart(); }
        };
    }

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
        tab.onclick = function() { window.ipc.toggleDownloadBar(); };
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
    }
    setInterval(checkUI, 500);
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
        <span class="sv-version-tag">v${appVersion} [Athena][-BETA-]</span> 
        <button id="sv-update-btn" title="Atualizar" onclick="window.ipc.restartAndUpdate()"> 
            <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg> 
        </button> 
        <div class="sv-user-menu" onclick="toggleSvDropdown()"> 
            <span class="sv-user-name">${userName}</span> 
            <span class="sv-arrow">▼</span> 
            <div id="sv-logout-dropdown"> 
                <div class="sv-logout-item" onclick="confirmLogout()">Sair da conta</div> 
            </div> 
        </div> 
        <button class="sv-win-btn" onclick="window.ipc.minimize()" title="Minimizar"><svg viewBox="0 0 10 1"><path d="M0 0h10v1H0z"/></svg></button> 
        <button class="sv-win-btn" onclick="window.ipc.maximize()" title="Maximizar"><svg viewBox="0 0 10 10"><path d="M0 0h10v10H0V0zm1 1v8h8V1H1z"/></svg></button> 
        <button class="sv-win-btn sv-close-btn" onclick="window.ipc.close()" title="Fechar"><svg viewBox="0 0 10 10"><path d="M10 1L9 0 5 4 1 0 0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4z"/></svg></button> 
      </div> 
    \`; 
    document.body.prepend(bar); 
    
    window.svNav = function(direction) {
        const loader = document.getElementById('sv-launcher-loader'); 
        if (loader) loader.classList.add('visible');
        if (direction === 'back') window.ipc.goBack();
        else window.ipc.goForward();
    };

    const updateTitle = () => { 
        const titleEl = document.getElementById('sv-app-title'); 
        if(titleEl && document.title) { 
             let clean = document.title.replace(' - Steam Verde', '').replace(' | Steam Verde', '');  
             titleEl.innerText = clean + ' | STEAM VERDE';  
        } 
    }; 
    updateTitle(); 
    new MutationObserver(updateTitle).observe(document.querySelector('title'), { childList: true, subtree: true }); 
    window.toggleSvDropdown = function() { document.getElementById('sv-logout-dropdown').classList.toggle('show'); }; 
    window.confirmLogout = function() { if(confirm("Tem certeza que deseja sair da sua conta?")) { window.ipc.logout(); } }; 
    document.addEventListener('click', function(e) { if (!e.target.closest('.sv-user-menu')) { document.getElementById('sv-logout-dropdown').classList.remove('show'); } }); 
  } 
`;

module.exports = { INJECT_LOADER_DOM, CLICK_LISTENER_SCRIPT, HIDE_LOADER_SCRIPT, SHOW_UPDATE_BTN_SCRIPT, INJECT_UI_SCRIPT, INJECT_TITLEBAR_SCRIPT };
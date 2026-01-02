// preload.js
const { contextBridge, ipcRenderer, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let installPath = null; 
let archivePath = null;

contextBridge.exposeInMainWorld('ipc', {
    minimize: () => ipcRenderer.send('site-minimize'),
    maximize: () => ipcRenderer.send('site-maximize'),
    close: () => ipcRenderer.send('site-close'),
    logout: () => ipcRenderer.send('site-logout'),
    restartAndUpdate: () => ipcRenderer.send('restart-app'),
    onShowUpdateBtn: (callback) => ipcRenderer.on('show-update-btn', callback),
    openExternal: (url) => shell.openExternal(url),
    log: (msg) => ipcRenderer.send('console-log', msg),
    goBack: () => ipcRenderer.send('nav-back'),
    goForward: () => ipcRenderer.send('nav-forward'),
    startTorrent: (url, image) => ipcRenderer.send('start-torrent-download', url, image),
    pauseTorrent: () => ipcRenderer.send('torrent-pause'),
    stopTorrent: () => ipcRenderer.send('torrent-stop'),
    openFolder: () => ipcRenderer.send('torrent-open-folder'),
    switchTab: (infoHash) => ipcRenderer.send('switch-download-tab', infoHash),
    onUpdateTabs: (callback) => ipcRenderer.on('update-download-tabs', callback),
    
    toggleFilesModal: () => {
        const modal = document.getElementById('sv-files-modal');
        if(modal) {
            const isHidden = (modal.style.display === 'none' || modal.style.display === '');
            if (isHidden) {
                modal.style.display = 'flex';
                ipcRenderer.send('request-file-list');
            } else {
                modal.style.display = 'none';
            }
        }
    },
    
    toggleMenu: () => {
        const menu = document.getElementById('sv-side-menu');
        const overlay = document.getElementById('sv-menu-overlay');
        if(menu && overlay) {
            menu.classList.toggle('open');
            overlay.classList.toggle('visible');
        }
    },

    toggleDownloadBar: () => {
        const bar = document.getElementById('sv-download-bar');
        if (!bar) return;
        if (bar.classList.contains('visible')) {
            bar.classList.remove('visible'); 
            localStorage.setItem('sv-bar-collapsed', 'true'); 
        } else {
            bar.classList.add('visible'); 
            localStorage.setItem('sv-bar-collapsed', 'false'); 
        }
    },

    toggleFile: (index, checked, isPriority) => {
        ipcRenderer.send('torrent-toggle-file', index, checked, isPriority);
        if(isPriority) {
            const btn = document.getElementById(`prio-${index}`);
            if(btn) btn.classList.toggle('active');
        }
    },

    openNotices: () => {
        const modal = document.getElementById('sv-notices-modal');
        if(modal) modal.style.display = 'flex';
        ipcRenderer.send('get-notices'); 
        const menu = document.getElementById('sv-side-menu');
        const overlay = document.getElementById('sv-menu-overlay');
        if(menu) menu.classList.remove('open');
        if(overlay) overlay.classList.remove('visible');
    },
    closeNotices: () => {
        const modal = document.getElementById('sv-notices-modal');
        if(modal) modal.style.display = 'none';
    },
    markNoticeRead: (id) => ipcRenderer.send('mark-notice-read', id),
    deleteNotice: (id) => ipcRenderer.send('delete-notice', id),
    onUpdateNotices: (callback) => ipcRenderer.on('update-notices-list', callback),
    openNoticeWindow: (notice) => ipcRenderer.send('open-notice-window', notice),
    onUpdateBadges: (callback) => ipcRenderer.on('update-badges', callback),

    openRD: () => {
        const menu = document.getElementById('sv-side-menu');
        const overlay = document.getElementById('sv-menu-overlay');
        const rdModal = document.getElementById('sv-rd-modal');
        if(menu) menu.classList.remove('open');
        if(overlay) overlay.classList.remove('visible');
        if(rdModal) rdModal.style.display = 'flex';
    },
    closeRD: () => {
        const rdModal = document.getElementById('sv-rd-modal');
        if(rdModal) rdModal.style.display = 'none';
    },
    saveRDToken: (token) => ipcRenderer.send('rd-save-token', token),
    removeRDToken: () => ipcRenderer.send('rd-remove-token'),

    openMyGames: () => {
        const modal = document.getElementById('sv-mygames-modal');
        if(modal) modal.style.display = 'flex';
        ipcRenderer.send('get-my-games'); 
        const menu = document.getElementById('sv-side-menu');
        const overlay = document.getElementById('sv-menu-overlay');
        if(menu) menu.classList.remove('open');
        if(overlay) overlay.classList.remove('visible');
    },
    closeMyGames: () => {
        const modal = document.getElementById('sv-mygames-modal');
        if(modal) modal.style.display = 'none';
    },
    // Função para ABRIR PASTA
    openGameFolder: (path) => ipcRenderer.send('open-game-folder', path),
    // Função para EXECUTAR ARQUIVO
    launchInstaller: (path) => ipcRenderer.send('launch-installer', path),
    
    removeGame: (name) => {
        if(confirm(`Tem certeza que deseja remover "${name}" da sua lista?\nIsso não apaga os arquivos do PC, apenas o atalho.`)) {
            ipcRenderer.send('remove-game-from-db', name);
        }
    }
});

// LISTENERS
ipcRenderer.on('install-ready', (event, path) => {
    installPath = path; 
    const btn = document.getElementById('sv-float-dl-btn');
    if(btn) {
        btn.classList.add('install-mode');
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg> INSTALAR AGORA';
        btn.style.background = '';
        btn.onclick = function() {
            ipcRenderer.send('launch-installer', installPath);
        };
    }
});

ipcRenderer.on('archive-ready', (event, data) => {
    const btn = document.getElementById('sv-float-dl-btn');
    if(!btn) return;
    archivePath = data.path;
    btn.classList.add('install-mode');
    
    if (data.type === 'zip') {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19,9H15V3H9V9H5L12,16L19,9M5,18V20H19V18H5Z" /></svg> EXTRAIR E INSTALAR';
        btn.style.background = 'linear-gradient(90deg, #d35400 0%, #e67e22 100%)'; 
        btn.onclick = function() {
            btn.innerHTML = 'EXTRAINDO... (AGUARDE)';
            btn.style.pointerEvents = 'none'; 
            btn.style.opacity = '0.8';
            ipcRenderer.send('extract-archive', archivePath);
        };
    } else {
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,4Z"/></svg> ABRIR PARA INSTALAR';
        btn.style.background = 'linear-gradient(90deg, #2c3e50 0%, #4ca1af 100%)'; 
        btn.onclick = function() {
            ipcRenderer.send('launch-installer', archivePath); 
        };
    }
});

ipcRenderer.on('extract-done', (event, res) => {
    const btn = document.getElementById('sv-float-dl-btn');
    if(!btn) return;
    if(res.success) {
        if(res.setup) {
            btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z" /></svg> INSTALAR AGORA';
            btn.style.background = 'linear-gradient(90deg, #6a11cb 0%, #2575fc 100%)';
            btn.style.pointerEvents = 'auto';
            btn.onclick = function() {
                ipcRenderer.send('launch-installer', res.setup);
            };
        } else {
            btn.innerHTML = 'INSTALAÇÃO MANUAL (PASTA)';
            btn.style.pointerEvents = 'auto';
            btn.onclick = () => ipcRenderer.send('open-game-folder', res.folder);
        }
    } else {
        btn.innerHTML = 'ERRO NA EXTRAÇÃO';
        btn.style.background = 'red';
        setTimeout(() => { btn.style.display = 'none'; }, 3000);
    }
});

ipcRenderer.on('my-games-list', (event, games) => {
    const list = document.getElementById('sv-mygames-list');
    if(!list) return;
    if(games.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:40px; color:#8f98a0">Você ainda não baixou nenhum jogo via Launcher.</div>';
        return;
    }
    list.innerHTML = '';
    games.forEach(game => {
        const safeGamePath = game.path.replace(/\\/g, '/');
        const safeName = game.name.replace(/'/g, "\\'"); 
        let iconHtml = '';
        if (game.image && game.image.startsWith('http')) {
            iconHtml = `<img src="${game.image}" style="width:50px; height:70px; object-fit:cover; border-radius:4px; margin-right:15px; border:1px solid #333;">`;
        } else {
            iconHtml = `<svg style="width:30px;height:30px;fill:#a4d007; margin-right:15px;" viewBox="0 0 24 24"><path d="M20,6H16V4A2,2 0 0,0 14,2H10A2,2 0 0,0 8,4V6H4A2,2 0 0,0 2,8V18A2,2 0 0,0 4,20H20A2,2 0 0,0 20,6M10,4H14V6H10V4M20,18H4V8H20V18Z"/></svg>`;
        }
        let hasSetup = false;
        let setupFile = '';
        try {
            if(fs.existsSync(game.path)) {
                if(fs.statSync(game.path).isDirectory()) {
                    const files = fs.readdirSync(game.path);
                    const setup = files.find(f => f.toLowerCase().includes('setup.exe') || f.toLowerCase().includes('install.exe'));
                    if(setup) { hasSetup = true; setupFile = setup; }
                }
            }
        } catch(e) {}
        
        // PULO DO GATO: Garante que o setupPath aponte para o ARQUIVO .EXE
        const setupPath = hasSetup ? path.join(game.path, setupFile).replace(/\\/g, '/') : '';
        
        const item = document.createElement('div');
        item.className = 'sv-game-card';
        item.innerHTML = `
            ${iconHtml}
            <div class="sv-game-info">
                <div class="sv-game-title">${game.name}</div>
                <div class="sv-game-path">${safeGamePath}</div>
            </div>
            <div class="sv-game-actions">
                ${hasSetup ? `<button class="sv-btn-small btn-play" onclick="window.ipc.launchInstaller('${setupPath}')"><svg style="width:14px;height:14px;fill:#1b2838" viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg> INSTALAR</button>` : ''}
                <button class="sv-btn-small btn-folder-small" onclick="window.ipc.openGameFolder('${safeGamePath}')">
                    <svg style="width:14px;height:14px;fill:#fff" viewBox="0 0 24 24"><path d="M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,4Z"/></svg>
                </button>
                <button class="sv-btn-small" style="background:#333; color:#ff4d4d;" title="Remover da lista" onclick="window.ipc.removeGame('${safeName}')">
                    <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
                </button>
            </div>
        `;
        list.appendChild(item);
    });
});

ipcRenderer.on('torrent-progress', (event, data) => {
    const doc = document;
    const bar = doc.getElementById('sv-download-bar');
    const tab = doc.getElementById('sv-toggle-tab');
    const isCollapsed = localStorage.getItem('sv-bar-collapsed') === 'true';

    if (tab) tab.style.display = 'flex';
    if (bar) {
        if (!isCollapsed && !bar.classList.contains('visible')) bar.classList.add('visible');
        if (isCollapsed && bar.classList.contains('visible')) bar.classList.remove('visible');
    }
    if(doc.getElementById('sv-dl-name')) doc.getElementById('sv-dl-name').innerText = data.name;
    if(doc.getElementById('sv-dl-bar')) doc.getElementById('sv-dl-bar').style.width = data.progress + '%';
    if(doc.getElementById('sv-dl-peers')) doc.getElementById('sv-dl-peers').innerText = data.peers + (typeof data.peers === 'string' && data.peers.includes('RD') ? "" : " Peers");
    if(doc.getElementById('sv-dl-eta')) doc.getElementById('sv-dl-eta').innerText = data.eta;
    if(doc.getElementById('sv-dl-perc')) doc.getElementById('sv-dl-perc').innerText = data.progress + '%';
    const speedEl = doc.getElementById('sv-dl-speed');
    if(speedEl) {
        if(data.paused) speedEl.innerText = "PAUSADO"; 
        else speedEl.innerText = data.speed;
    }
    const iPause = doc.getElementById('icon-pause');
    const iPlay = doc.getElementById('icon-play');
    if(iPause && iPlay) {
        if(data.paused) { iPause.style.display = 'none'; iPlay.style.display = 'block'; } 
        else { iPause.style.display = 'block'; iPlay.style.display = 'none'; }
    }
    const canvas = doc.getElementById('sv-dl-canvas');
    if (canvas && data.chart && data.peersChart) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        const maxVal = Math.max(...data.chart, 100000); 
        const step = canvas.width / (data.chart.length - 1);
        data.chart.forEach((val, index) => {
            const x = index * step;
            const y = canvas.height - ((val / maxVal) * (canvas.height * 0.9)); 
            if(index === 0) ctx.moveTo(x, y);
            else {
                const prevX = (index - 1) * step;
                const prevY = canvas.height - ((data.chart[index-1] / maxVal) * (canvas.height * 0.9));
                const cx = (prevX + x) / 2;
                ctx.quadraticCurveTo(cx, prevY, x, y);
            }
        });
        ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.closePath();
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "rgba(164, 208, 7, 0.4)");    
        gradient.addColorStop(1, "rgba(23, 26, 33, 0)");        
        ctx.fillStyle = gradient; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(164, 208, 7, 0.9)"; ctx.stroke();
        
        ctx.beginPath();
        const maxPeers = Math.max(...data.peersChart, 10); 
        data.peersChart.forEach((val, index) => {
            const x = index * step;
            const y = canvas.height - ((val / maxPeers) * (canvas.height * 0.8)); 
            if(index === 0) ctx.moveTo(x, y);
            else {
                const prevX = (index - 1) * step;
                const prevY = canvas.height - ((data.peersChart[index-1] / maxPeers) * (canvas.height * 0.8));
                const cx = (prevX + x) / 2;
                ctx.quadraticCurveTo(cx, prevY, x, y);
            }
        });
        ctx.lineWidth = 2; ctx.strokeStyle = "#00d9ff"; ctx.stroke();
    }
});

ipcRenderer.on('torrent-files', (event, files) => {
    const list = document.getElementById('sv-files-list');
    if(!list) return;
    list.innerHTML = ''; 
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'sv-file-item';
        item.style.cssText = "display:flex; align-items:center; padding:12px; border-bottom:1px solid #282c34; color:#ccc; transition: background 0.2s;";
        item.onmouseover = () => { item.style.background = '#232d3d'; };
        item.onmouseout = () => { item.style.background = 'transparent'; };
        item.innerHTML = `<input type="checkbox" class="sv-checkbox" checked style="accent-color:#a4d007; transform:scale(1.2); cursor:pointer;" onchange="window.ipc.toggleFile(${file.index}, this.checked, false)"><span class="sv-file-name" title="${file.name}" style="flex:1; margin:0 15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px;">${file.name}</span><span class="sv-file-size" style="font-family:monospace; color:#8f98a0; font-size:12px;">${file.size}</span><button id="prio-${file.index}" class="sv-prio-btn" title="Alta Prioridade" onclick="window.ipc.toggleFile(${file.index}, true, true)" style="background:none; border:none; color:#555; cursor:pointer; margin-left:10px; transition: all 0.2s;"><svg style="width:18px;height:18px;fill:currentColor" viewBox="0 0 24 24"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" /></svg></button>`;
        list.appendChild(item);
    });
});

ipcRenderer.on('torrent-done', () => {
    const bar = document.getElementById('sv-dl-bar');
    if(bar) bar.style.borderTop = '1px solid #43b581';
});
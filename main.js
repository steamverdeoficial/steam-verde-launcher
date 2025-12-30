const { app, BrowserWindow, ipcMain, session, shell, dialog, Notification } = require('electron'); 
const path = require('path'); 
const fs = require('fs');  
const DiscordRPC = require('discord-rpc'); 
const { autoUpdater } = require('electron-updater'); 
const log = require('electron-log'); 
const WebTorrent = require('webtorrent'); 

// --- CONFIGURAÇÃO ---
const torrentClient = new WebTorrent();
let currentTorrent = null;
let downloadPath = app.getPath('downloads'); 
// DADOS PARA OS GRÁFICOS
let chartData = new Array(150).fill(0); // Velocidade
let peersData = new Array(150).fill(0); // Peers 
let isPausedManual = false; 

// TRACKERS
const AGGRESSIVE_TRACKERS = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://9.rarbg.com:2810/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "udp://opentracker.i2p.rocks:6969/announce",
    "udp://tracker.internetwarriors.net:1337/announce",
    "udp://tracker.leechers-paradise.org:6969/announce",
    "udp://coppersurfer.tk:6969/announce",
    "udp://tracker.zer0day.to:1337/announce",
    "http://tracker.openbittorrent.com:80/announce",
    "udp://open.stealth.si:80/announce",
    "udp://exodus.desync.com:6969/announce",
    "wss://tracker.openwebtorrent.com"
];

autoUpdater.logger = log; 
autoUpdater.logger.transports.file.level = 'info'; 
autoUpdater.autoDownload = true; 

const DISCORD_CLIENT_ID = '1443601234077417546';  
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SteamVerdeLauncher'; 
const COOKIE_DOMAIN = 'https://steamverde.net';  
const NAVIGATE_URL  = 'https://steamverde.net';  

let loginWindow, siteWindow, loadingWindow;  
let currentUser = { name: 'Assinante', avatar: '' }; 

function getIconBase64() { 
    try { 
        const p = path.join(__dirname, 'assets', 'icon.ico'); 
        if (fs.existsSync(p)) return `data:image/x-icon;base64,${fs.readFileSync(p).toString('base64')}`; 
    } catch (e) {} return '';  
} 

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const TITLE_BAR_CSS = ` 
  html { padding-top: 0px !important; height: 100vh; box-sizing: border-box; } 
  body { margin-top: 0 !important; } 
  header, .site-header, #masthead, .elementor-location-header, .elementor-section-fixed, .elementor-sticky--active { top: 32px !important; } 
  .rt-slider-progress-bar, .rt-slider-progress {top: 32px !important; }
  #wpadminbar { top: 32px !important; } 
  #sv-custom-titlebar { position: fixed; top: 0; left: 0; width: 100%; height: 32px; background: #171a21; color: #c7d5e0; z-index: 2147483647; display: flex; justify-content: space-between; align-items: center; font-family: 'Segoe UI', sans-serif; user-select: none; -webkit-app-region: drag; box-shadow: 0 2px 5px rgba(0,0,0,0.5); box-sizing: border-box; } 
  .sv-left-area { display: flex; align-items: center; height: 100%; overflow: hidden; padding-left: 10px; flex-shrink: 0; } 
  .sv-app-icon { height: 18px; width: 18px; margin-right: 10px; pointer-events: none; -webkit-user-drag: none; } 
  .sv-bar-logo { font-size: 12px; font-weight: bold; letter-spacing: 1px; color: #8f98a0; white-space: nowrap; } 
  .sv-bar-controls { display: flex; height: 100%; -webkit-app-region: no-drag; align-items: center; } 
  .sv-version-tag { font-size: 11px; color: #576574; margin-right: 10px; cursor: default; opacity: 0.8; }
  #sv-update-btn { display: none; color: #43b581; cursor: pointer; margin-right: 15px; background: transparent; border: none; align-items: center; height: 100%; animation: sv-pulse 2s infinite; } 
  #sv-update-btn:hover { color: #a4d007; } 
  @keyframes sv-pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } } 
  .sv-user-menu { position: relative; display: flex; align-items: center; cursor: pointer; padding: 0 15px; height: 100%; transition: 0.2s; border-left: 1px solid #282c34; } 
  .sv-user-menu:hover { background: #323f55; color: white; } 
  .sv-user-name { font-size: 12px; font-weight: 600; margin-right: 8px; color: #a4d007; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } 
  .sv-arrow { font-size: 8px; } 
  #sv-logout-dropdown { position: absolute; top: 32px; right: 0; background: #323f55; width: 150px; display: none; flex-direction: column; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border-bottom-left-radius: 4px; } 
  #sv-logout-dropdown.show { display: flex; } 
  .sv-logout-item { padding: 12px 15px; font-size: 12px; cursor: pointer; color: #c7d5e0; text-decoration: none; } 
  .sv-logout-item:hover { background: #c21a1a; color: white; } 
  .sv-win-btn { width: 45px; height: 100%; border: none; background: transparent; color: #8f98a0; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s; padding: 0; } 
  .sv-win-btn svg { width: 10px; height: 10px; fill: currentColor; } 
  .sv-win-btn:not(.sv-close-btn):hover { background: #323f55; color: white; } 
  #sv-custom-titlebar .sv-bar-controls .sv-close-btn:hover { background: #a4d007 !important; color: #171a21 !important; } 
`; 

const CUSTOM_UI_CSS = `
  .adsbygoogle, .ad-container, .advertising, .anuncio, 
  div[id^="google_ads"], iframe[src*="google"], .admaven-banner, .pop-under {
      position: absolute !important; left: -9999px !important; visibility: hidden !important;
  }

  /* BOTÃO FLUTUANTE */
  #sv-float-dl-btn {
      position: fixed; bottom: 25px; right: 100px;
      background: linear-gradient(90deg, #a4d007 0%, #46bd14 100%);
      color: #fff; padding: 14px 28px; border-radius: 40px;
      font-family: 'Segoe UI', sans-serif; font-weight: 800; font-size: 14px;
      box-shadow: 0 0 20px rgba(164, 208, 7, 0.4);
      cursor: pointer; z-index: 2147483646; 
      display: none; align-items: center; gap: 12px; 
      transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s;
      border: 2px solid rgba(255,255,255,0.1); letter-spacing: 0.5px;
  }
  #sv-float-dl-btn.pushed-up { bottom: 140px !important; }
  #sv-float-dl-btn:hover { transform: scale(1.05); }
  #sv-float-dl-btn svg { width: 24px; height: 24px; fill: white; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }

  /* BOTÃO TOGGLE */
  #sv-toggle-tab {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      width: 60px; height: 20px;
      background: #0f1115;
      border-top-left-radius: 10px; border-top-right-radius: 10px;
      border: 1px solid #a4d007; border-bottom: none;
      z-index: 2147483648; 
      cursor: pointer; display: none; 
      justify-content: center; align-items: center;
      box-shadow: 0 -5px 15px rgba(0,0,0,0.5);
      transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }
  #sv-toggle-tab.raised { bottom: 110px; } 
  #sv-toggle-tab:hover { background: #a4d007; }
  #sv-toggle-tab svg { width: 20px; height: 20px; fill: #fff; transition: transform 0.3s; }
  #sv-toggle-tab.rotated svg { transform: rotate(180deg); }

  /* BARRA PRINCIPAL */
  #sv-download-bar {
      position: fixed; bottom: -140px; left: 0; width: 100%; height: 110px;
      background: #0f1115; border-top: 1px solid #a4d007;
      z-index: 2147483647 !important; 
      display: flex; align-items: center;
      transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1);
      padding: 0; box-shadow: 0 -10px 50px rgba(0,0,0,1);
      overflow: hidden; 
  }
  #sv-download-bar.visible { bottom: 0; }

  /* LEGENDA CORRIGIDA */
  #sv-dl-legend {
      position: absolute; top: 15px; right: 30px;
      display: flex; gap: 15px; 
      z-index: 100 !important; /* Camada superior dentro da barra */
      pointer-events: none;
      font-family: 'Segoe UI', sans-serif; font-size: 11px; font-weight: 800;
  }
  .sv-legend-item { 
      display: flex; align-items: center; gap: 6px; 
      color: #ffffff !important; 
      text-shadow: 0 1px 4px rgba(0,0,0,1); 
      letter-spacing: 0.5px;
  }
  .sv-legend-dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); }

  #sv-dl-graph-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
  #sv-dl-canvas { width: 100%; height: 100%; display: block; }

  .sv-dl-content { position: relative; z-index: 2; display: flex; width: 100%; height: 100%; align-items: center; padding: 0 30px; background: linear-gradient(90deg, rgba(15,17,21,0.95) 0%, rgba(15,17,21,0.7) 40%, rgba(15,17,21,0.7) 60%, rgba(15,17,21,0.95) 100%); }
  .sv-dl-info { display: flex; flex-direction: column; flex: 1; margin-right: 40px; justify-content: center; }
  .sv-dl-title { color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 10px; }
  .sv-dl-progress-bg { width: 100%; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; position: relative; margin-bottom: 10px; }
  .sv-dl-progress-bar { height: 100%; background: linear-gradient(90deg, #a4d007, #d4ff33); width: 0%; transition: width 0.3s ease; box-shadow: 0 0 15px rgba(164,208,7,0.6); }
  .sv-dl-stats { display: flex; gap: 25px; align-items: center; color: #ccc; font-size: 12px; font-family: 'Segoe UI', monospace; font-weight: 500; }
  .sv-stat-item { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
  .sv-stat-icon { width: 16px; height: 16px; fill: #a4d007; }
  .sv-stat-val { color: #fff; font-weight: bold; }
  .sv-dl-controls { display: flex; gap: 15px; align-items: center; z-index: 10; pointer-events: auto; }
  .sv-btn-icon { border: none; width: 48px; height: 48px; border-radius: 12px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s; background: rgba(40, 44, 52, 0.8); color: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .sv-btn-icon:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
  .sv-btn-icon svg { width: 28px; height: 28px; fill: currentColor; }
  .btn-files:hover { background: #fff; color: #1b2838; } .btn-pause:hover { background: #ffcc00; color: #000; } .btn-folder:hover { background: #00d9ff; color: #000; } .btn-stop:hover { background: #ff4d4d; color: #fff; }
  .sv-prio-btn.active { color: #ffcc00 !important; filter: drop-shadow(0 0 5px rgba(255, 204, 0, 0.8)); transform: scale(1.1); }
  
  #sv-files-modal { position: fixed; bottom: 120px; right: 30px; width: 500px; max-height: 500px; background: #1b2838; border: 1px solid #46bd14; border-radius: 10px; display: none; flex-direction: column; z-index: 2147483647 !important; box-shadow: 0 20px 50px rgba(0,0,0,1); }
`;

const LOADING_CSS = ` 
  #sv-launcher-loader { position: fixed; top: 32px; left: 0; width: 100%; height: calc(100% - 32px); background-color: rgba(27, 40, 56, 0.85); z-index: 2147483646; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; display: none; } 
  #sv-launcher-loader.visible { opacity: 1; display: flex !important; pointer-events: auto; } 
  .sv-spinner { width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #a4d007; animation: sv-spin 0.8s linear infinite; } 
  @keyframes sv-spin { to { transform: rotate(360deg); } } 
`; 

const INJECT_LOADER_DOM = `if (!document.getElementById('sv-launcher-loader')) { const loader = document.createElement('div'); loader.id = 'sv-launcher-loader'; loader.innerHTML = '<div class="sv-spinner"></div>'; document.body.appendChild(loader); }`; 
const CLICK_LISTENER_SCRIPT = ` 
  document.body.addEventListener('click', (e) => { 
    const link = e.target.closest('a'); 
    if (link && link.href) { 
        if (link.href.startsWith('magnet:') || link.href.endsWith('.torrent')) {
             e.preventDefault(); e.stopPropagation();
             window.ipc.startTorrent(link.href);
             return;
        }
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

// --- INJEÇÃO DA BARRA E BOTÃO TOGGLE ---
const INJECT_UI_SCRIPT = `
    if (!document.getElementById('sv-float-dl-btn')) {
        const btn = document.createElement('div');
        btn.id = 'sv-float-dl-btn';
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z" /></svg> DOWNLOAD VIA LAUNCHER';
        btn.onclick = function() {
            const mag = document.querySelector('a[href^="magnet:"]');
            if(mag) window.ipc.startTorrent(mag.href);
        };
        document.body.appendChild(btn);
    }

    if (!document.getElementById('sv-download-bar')) {
        const bar = document.createElement('div');
        bar.id = 'sv-download-bar';
        bar.innerHTML = \`
            <div id="sv-dl-graph-wrapper">
                <canvas id="sv-dl-canvas"></canvas>
                <div id="sv-dl-legend">
                    <div class="sv-legend-item"><div class="sv-legend-dot" style="background:#a4d007;box-shadow:0 0 5px #a4d007"></div>Velocidade</div>
                    <div class="sv-legend-item"><div class="sv-legend-dot" style="background:#00d9ff;box-shadow:0 0 5px #00d9ff"></div>Conexões</div>
                </div>
            </div>
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
                            <svg class="sv-stat-icon" viewBox="0 0 24 24"><path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" /></svg>
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
        \`;
        document.body.appendChild(bar);
        window.dlCanvas = document.getElementById('sv-dl-canvas');
        window.dlCtx = window.dlCanvas.getContext('2d');
    }

    if (!document.getElementById('sv-toggle-tab')) {
        const tab = document.createElement('div');
        tab.id = 'sv-toggle-tab';
        tab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z" /></svg>';
        tab.onclick = function() {
            window.ipc.toggleDownloadBar();
        };
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
            const shouldShow = mag ? 'flex' : 'none';
            if(btn.style.display !== shouldShow) btn.style.display = shouldShow;
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
          <img src="${iconBase64}" class="sv-app-icon"> 
          <div class="sv-bar-logo" id="sv-app-title">STEAM VERDE</div> 
      </div> 
      <div class="sv-bar-controls"> 
        <span class="sv-version-tag">v${appVersion} [Aziris][-BETA-]</span> 
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

function updateSplashStatus(text, percent = null) { 
    if (loadingWindow && !loadingWindow.isDestroyed()) { 
        const code = ` 
            const textEl = document.querySelector('.loading-text'); 
            if(textEl) textEl.innerText = "${text}"; 
            if (${percent !== null}) { 
                let barContainer = document.getElementById('sv-update-bar-container'); 
                if (!barContainer) { 
                    barContainer = document.createElement('div'); 
                    barContainer.id = 'sv-update-bar-container'; 
                    barContainer.style.cssText = "width: 200px; height: 6px; background: #171a21; border-radius: 3px; margin-top: 15px; overflow: hidden; border: 1px solid #333;"; 
                    const barFill = document.createElement('div'); 
                    barFill.id = 'sv-update-bar-fill'; 
                    barFill.style.cssText = "width: 0%; height: 100%; background: #a4d007; transition: width 0.2s ease;"; 
                    barContainer.appendChild(barFill); 
                    if(textEl) textEl.parentNode.insertBefore(barContainer, textEl.nextSibling); 
                } 
                const fill = document.getElementById('sv-update-bar-fill'); 
                if(fill) fill.style.width = "${percent}%"; 
            } 
        `; 
        loadingWindow.webContents.executeJavaScript(code).catch(() => {}); 
    } 
} 

function createLoadingWindow() { 
  loadingWindow = new BrowserWindow({ 
    width: 600, height: 600, frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true,  
    webPreferences: { nodeIntegration: false }, 
    icon: path.join(__dirname, 'assets', 'icon.ico'), show: false 
  }); 
  loadingWindow.loadFile('loading.html'); 
  loadingWindow.once('ready-to-show', () => { loadingWindow.show(); }); 
} 

function createLoginWindow() { 
  loginWindow = new BrowserWindow({ 
    width: 400, height: 600, title: 'Steam Verde Launcher', icon: path.join(__dirname, 'assets', 'icon.ico'), 
    resizable: false, frame: false, transparent: true,  
    webPreferences: { nodeIntegration: true, contextIsolation: false }, 
    autoHideMenuBar: true, backgroundColor: '#00000000', show: false 
  }); 
  loginWindow.loadFile('login.html'); 
  loginWindow.once('ready-to-show', () => { loginWindow.show(); if (loadingWindow) loadingWindow.close(); }); 
  loginWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; }); 
} 

function createSiteWindow(targetUrl) { 
  siteWindow = new BrowserWindow({ 
    width: 1280, height: 800, minWidth: 1024, title: 'Steam Verde', icon: path.join(__dirname, 'assets', 'icon.ico'), 
    frame: false,  
    webPreferences: { 
        nodeIntegration: false, 
        contextIsolation: true, 
        enableBlinkFeatures: 'OverlayScrollbars', 
        sandbox: false, 
        preload: path.join(__dirname, 'preload.js') 
    }, 
    autoHideMenuBar: true, backgroundColor: '#1b2838', show: false 
  }); 

  siteWindow.webContents.setUserAgent(CHROME_USER_AGENT); 
  setupNetworkInterception(siteWindow.webContents.session); 
  siteWindow.loadURL(targetUrl); 

  siteWindow.once('ready-to-show', () => { 
    siteWindow.show(); siteWindow.maximize();  
    setDiscordActivity('Navegando na Biblioteca', 'Assinante VIP'); 
    if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close(); 
  }); 
  siteWindow.on('closed', () => { app.quit(); }); 

  siteWindow.webContents.on('dom-ready', async () => { 
    try { 
        await siteWindow.webContents.insertCSS(TITLE_BAR_CSS); 
        await siteWindow.webContents.insertCSS(LOADING_CSS); 
        await siteWindow.webContents.insertCSS(CUSTOM_UI_CSS); 

        const iconBase64 = getIconBase64(); 
        await siteWindow.webContents.executeJavaScript(INJECT_TITLEBAR_SCRIPT(currentUser.name, iconBase64, app.getVersion())); 
        await siteWindow.webContents.executeJavaScript(INJECT_UI_SCRIPT); 
        await siteWindow.webContents.executeJavaScript(INJECT_LOADER_DOM); 
        await siteWindow.webContents.executeJavaScript(CLICK_LISTENER_SCRIPT); 
        await siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT); 
    } catch (e) { console.log(e); } 
  }); 

  siteWindow.webContents.on('did-stop-loading', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); }); 
  siteWindow.webContents.on('did-fail-load', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); }); 
   
  siteWindow.webContents.on('will-navigate', (event, url) => {  
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) {  
          event.preventDefault(); 
          startTorrentDownload(url);
          siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {});  
      }  
  }); 
  siteWindow.webContents.setWindowOpenHandler(({ url }) => {  
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) {  
          startTorrentDownload(url);
          siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {});  
          return { action: 'deny' };  
      }  
      if (url.startsWith('http') && !url.includes('steamverde.net')) { shell.openExternal(url); return { action: 'deny' }; }  
      return { action: 'allow' };  
  }); 
} 

function setupNetworkInterception(sess) { 
    const filter = { urls: ['magnet:*', '*://*/*.torrent*'] }; 
    sess.webRequest.onBeforeRequest(filter, (details, callback) => { 
        startTorrentDownload(details.url);
        callback({ cancel: true }); 
    }); 
} 

function startTorrentDownload(magnetLink) {
    if (currentTorrent) {
        dialog.showMessageBox(siteWindow, { type: 'info', title: 'Fila Cheia', message: 'Já existe um download em andamento.' });
        return;
    }

    siteWindow.webContents.executeJavaScript(`
        localStorage.setItem('sv-bar-collapsed', 'false');
        document.getElementById('sv-download-bar').classList.add('visible');
        document.getElementById('sv-toggle-tab').style.display = 'flex';
    `);

    isPausedManual = false; 

    client.add(magnetLink, { path: downloadPath, announce: AGGRESSIVE_TRACKERS }, (torrent) => {
        currentTorrent = torrent;
        
        const filesData = torrent.files.map((f, index) => ({
            index: index,
            name: f.name,
            size: formatBytes(f.length),
            checked: true 
        }));
        siteWindow.webContents.send('torrent-files', filesData);

        const interval = setInterval(() => {
            if (!currentTorrent || currentTorrent.destroyed) {
                clearInterval(interval);
                return;
            }

            if (isPausedManual) {
                chartData.push(0); chartData.shift(); 
                peersData.push(0); peersData.shift(); 
                
                const data = {
                    name: torrent.name,
                    progress: (torrent.progress * 100).toFixed(1),
                    speed: '0 B/s', 
                    peers: 0,
                    eta: "PAUSADO",
                    paused: true,
                    chart: chartData,
                    peersChart: peersData
                };
                if (siteWindow && !siteWindow.isDestroyed()) siteWindow.webContents.send('torrent-progress', data);
                return; 
            }

            chartData.push(torrent.downloadSpeed); chartData.shift(); 
            peersData.push(torrent.numPeers); peersData.shift(); 

            let eta = '--:--';
            if (torrent.timeRemaining && torrent.timeRemaining < 86400000) { 
                 const hrs = Math.floor(torrent.timeRemaining / 3600000);
                 const mins = Math.floor((torrent.timeRemaining % 3600000) / 60000);
                 const secs = Math.floor((torrent.timeRemaining % 60000) / 1000);
                 if(hrs > 0) eta = `${hrs}h ${mins}m`;
                 else eta = `${mins}m ${secs}s`;
            }

            const data = {
                name: torrent.name,
                progress: (torrent.progress * 100).toFixed(1),
                speed: formatBytes(torrent.downloadSpeed) + '/s',
                peers: torrent.numPeers,
                eta: eta,
                paused: false,
                chart: chartData,
                peersChart: peersData
            };

            if (siteWindow && !siteWindow.isDestroyed()) {
                siteWindow.webContents.send('torrent-progress', data);
            }
        }, 1000);

        torrent.on('done', () => {
            if (isPausedManual) return;
            // Libera trava do arquivo e avisa usuário
            new Notification({ title: 'Steam Verde', body: 'Download Concluído! Arquivo Liberado.' }).show();
            if(siteWindow && !siteWindow.isDestroyed()) {
                siteWindow.webContents.send('torrent-done');
                // Força status 100% visual
                siteWindow.webContents.send('torrent-progress', {
                    name: torrent.name, progress: "100.0", speed: "0 B/s", peers: 0, eta: "CONCLUÍDO", paused: false, chart: chartData, peersChart: peersData
                });
            }
            torrent.destroy(() => { currentTorrent = null; });
        });
    });
}

ipcMain.on('torrent-pause', () => {
    if (!currentTorrent) return;
    isPausedManual = !isPausedManual; 
    if (isPausedManual) {
        currentTorrent.pause();
        currentTorrent.files.forEach(file => file.deselect());
        currentTorrent.deselect(0, currentTorrent.pieces.length - 1, false);
    } else {
        currentTorrent.resume();
        currentTorrent.files.forEach(file => file.select());
        currentTorrent.select(0, currentTorrent.pieces.length - 1, false);
    }
});

ipcMain.on('torrent-stop', () => {
    if(currentTorrent) {
        const fullPath = path.join(currentTorrent.path, currentTorrent.name);
        currentTorrent.destroy({ force: true }, () => {
            setTimeout(() => {
                try { fs.rm(fullPath, { recursive: true, force: true }, () => {}); } catch(e) {}
            }, 1000); 
        });
        currentTorrent = null;
        chartData.fill(0);
        peersData.fill(0); 
        isPausedManual = false;
        if(siteWindow) siteWindow.webContents.executeJavaScript(`
            document.getElementById('sv-download-bar').classList.remove('visible');
            document.getElementById('sv-toggle-tab').style.display = 'none';
            localStorage.setItem('sv-bar-collapsed', 'false');
        `);
    }
});

ipcMain.on('torrent-toggle-file', (event, index, selected, isPriority) => {
    if(currentTorrent && currentTorrent.files[index]) {
        if(selected) currentTorrent.files[index].select();
        else currentTorrent.files[index].deselect();
    }
});

ipcMain.on('torrent-open-folder', () => shell.openPath(downloadPath));
ipcMain.on('console-log', (event, msg) => console.log("[RENDERER]", msg));
ipcMain.on('start-torrent-download', (event, url) => startTorrentDownload(url));

const client = torrentClient;

app.whenReady().then(() => { 
  app.commandLine.appendSwitch('enable-gpu-rasterization'); 
  createLoadingWindow(); 
  initDiscordRPC(); 
  if (app.isPackaged) { 
      updateSplashStatus('Verificando atualizações...'); 
      autoUpdater.checkForUpdatesAndNotify(); 
      setInterval(() => { autoUpdater.checkForUpdates(); }, 1000 * 60 * 1); 
  } else { 
      checkLoginAndStart(); 
  } 
}); 

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); }); 
autoUpdater.on('update-not-available', () => { if (!siteWindow && !loginWindow) checkLoginAndStart(); }); 
autoUpdater.on('error', () => { if (!siteWindow && !loginWindow) checkLoginAndStart(); }); 
autoUpdater.on('download-progress', (p) => { if (loadingWindow) updateSplashStatus('Baixando: ' + Math.round(p.percent) + '%', Math.round(p.percent)); }); 
autoUpdater.on('update-downloaded', () => { if (loadingWindow) autoUpdater.quitAndInstall(); else if (siteWindow) siteWindow.webContents.executeJavaScript(SHOW_UPDATE_BTN_SCRIPT).catch(() => {}); }); 

async function checkLoginAndStart() { 
    updateSplashStatus('Iniciando...'); 
    try { 
        const cookies = await session.defaultSession.cookies.get({ url: COOKIE_DOMAIN }); 
        const authCookie = cookies.find(c => c.name.startsWith('wordpress_logged_in_')); 
        const now = Date.now() / 1000; 
        if (authCookie && authCookie.expirationDate > now) { 
            const cookieVal = decodeURIComponent(authCookie.value); 
            currentUser.name = cookieVal.split('|')[0] || "Assinante";  
            createSiteWindow(NAVIGATE_URL); 
        } else { setTimeout(() => createLoginWindow(), 1000); } 
    } catch (error) { createLoginWindow(); } 
} 

ipcMain.on('site-minimize', () => siteWindow.minimize()); 
ipcMain.on('site-maximize', () => { if (siteWindow.isMaximized()) siteWindow.unmaximize(); else siteWindow.maximize(); }); 
ipcMain.on('site-close', () => app.quit()); 
ipcMain.on('restart-app', () => autoUpdater.quitAndInstall()); 
ipcMain.on('site-logout', async () => { await session.defaultSession.clearStorageData(); app.relaunch(); app.exit(0); }); 
ipcMain.on('minimize-login', () => { if (loginWindow) loginWindow.minimize(); }); 
ipcMain.on('close-login', () => { if (loginWindow) loginWindow.close(); }); 
ipcMain.on('login-success', async (event, data) => { 
  const cookie = { url: COOKIE_DOMAIN, name: data.cookieName, value: data.cookieValue, expirationDate: Date.now() / 1000 + 31536000 }; 
  currentUser.name = data.user_display_name || "Assinante"; 
  try { await session.defaultSession.cookies.set(cookie); createLoadingWindow(); if (loginWindow) loginWindow.close(); createSiteWindow(data.url); } catch (e) { createSiteWindow(data.url); } 
}); 

let rpc; 
function initDiscordRPC() { 
    DiscordRPC.register(DISCORD_CLIENT_ID); 
    rpc = new DiscordRPC.Client({ transport: 'ipc' }); 
    rpc.on('ready', () => { setDiscordActivity('Iniciando...', 'Aguardando...'); }); 
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(console.error); 
} 
function setDiscordActivity(details, state) { 
    if (!rpc) return; 
    rpc.setActivity({ 
        details: details, state: state, startTimestamp: Date.now(), 
        largeImageKey: 'logo_steam', largeImageText: 'Steam Verde Launcher', 
        instance: false, buttons: [{ label: 'Acessar Site', url: 'https://steamverde.net' }] 
    }).catch(console.error); 
}
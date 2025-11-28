const { app, BrowserWindow, ipcMain, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs'); 
const DiscordRPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// --- CONFIGURAÇÕES ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;

const DISCORD_CLIENT_ID = '1443601234077417546'; 
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

let loginWindow;
let siteWindow;
let loadingWindow; 
let currentUser = { name: 'Assinante', avatar: '' };

function getIconBase64() {
    try {
        const iconPath = path.join(__dirname, 'assets', 'icon.ico');
        if (fs.existsSync(iconPath)) {
            const bitmap = fs.readFileSync(iconPath);
            return `data:image/x-icon;base64,${bitmap.toString('base64')}`;
        }
    } catch (e) { console.error(e); }
    return ''; 
}

// ==========================================================
// --- 1. CSS DA BARRA ---
// ==========================================================
const TITLE_BAR_CSS = `
  body { margin-top: 32px !important; }
  #wpadminbar { top: 32px !important; }
  @media screen and (max-width: 782px) {
      #wpadminbar { top: 32px !important; }
      body { margin-top: 32px !important; }
  }

  #sv-custom-titlebar {
    position: fixed; top: 0; left: 0; width: 100%; height: 32px;
    background: #171a21; color: #c7d5e0; 
    z-index: 2147483647; 
    display: flex; justify-content: space-between; align-items: center;
    font-family: 'Segoe UI', sans-serif; user-select: none;
    -webkit-app-region: drag; 
    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
    box-sizing: border-box;
  }

  .sv-left-area { display: flex; align-items: center; height: 100%; overflow: hidden; padding-left: 10px; flex-shrink: 0; }
  .sv-app-icon { height: 18px; width: 18px; margin-right: 10px; pointer-events: none; -webkit-user-drag: none; }
  .sv-bar-logo { font-size: 12px; font-weight: bold; letter-spacing: 1px; color: #8f98a0; white-space: nowrap; }
  
  .sv-bar-controls { display: flex; height: 100%; -webkit-app-region: no-drag; align-items: center; }

  #sv-update-btn {
      display: none; color: #43b581; cursor: pointer; margin-right: 15px;
      background: transparent; border: none; align-items: center; height: 100%;
      animation: sv-pulse 2s infinite;
  }
  #sv-update-btn:hover { color: #a4d007; }
  @keyframes sv-pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }

  .sv-user-menu { position: relative; display: flex; align-items: center; cursor: pointer; padding: 0 15px; height: 100%; transition: 0.2s; border-left: 1px solid #282c34; }
  .sv-user-menu:hover { background: #323f55; color: white; }
  .sv-user-name { font-size: 12px; font-weight: 600; margin-right: 8px; color: #a4d007; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-arrow { font-size: 8px; }
  
  #sv-logout-dropdown { position: absolute; top: 32px; right: 0; background: #323f55; width: 150px; display: none; flex-direction: column; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border-bottom-left-radius: 4px; }
  #sv-logout-dropdown.show { display: flex; }
  .sv-logout-item { padding: 12px 15px; font-size: 12px; cursor: pointer; color: #c7d5e0; }
  .sv-logout-item:hover { background: #c21a1a; color: white; }

  .sv-win-btn { width: 45px; height: 100%; border: none; background: transparent; color: #8f98a0; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s; padding: 0; }
  .sv-win-btn svg { width: 10px; height: 10px; fill: currentColor; }
  
  .sv-win-btn:not(.sv-close-btn):hover { background: #323f55; color: white; }
  #sv-custom-titlebar .sv-bar-controls .sv-close-btn:hover { background: #a4d007 !important; color: #171a21 !important; }
`;

// ==========================================================
// --- 2. SCRIPTS INJETADOS ---
// ==========================================================

const INJECT_TITLEBAR_SCRIPT = (userName, iconBase64) => `
  if (!document.getElementById('sv-custom-titlebar')) {
    const bar = document.createElement('div');
    bar.id = 'sv-custom-titlebar';
    bar.innerHTML = \`
      <div class="sv-left-area">
          <img src="${iconBase64}" class="sv-app-icon">
          <div class="sv-bar-logo" id="sv-app-title">STEAM VERDE</div>
      </div>
      
      <div class="sv-bar-controls">
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

const UPDATE_NAME_SCRIPT = `
  (function() {
    function findUserName() {
        let name = '';
        const wpBarName = document.querySelector('#wp-admin-bar-my-account .display-name');
        if (wpBarName) { name = wpBarName.innerText; } else {
            const gamxoName = document.querySelector('.gamxo-account-header .user-info h1');
            if (gamxoName) { name = gamxoName.innerText.replace('Olá,', '').replace('Assinante', '').replace('Não Assinante', '').replace('VIP', '').trim(); }
        }
        if (name && name.length > 0) { const barName = document.querySelector('.sv-user-name'); if (barName) barName.innerText = name; }
    }
    findUserName();
    setTimeout(findUserName, 1000); setTimeout(findUserName, 3000); setTimeout(findUserName, 5000);
  })();
`;

const LOADING_CSS = `
  #sv-launcher-loader { position: fixed; top: 32px; left: 0; width: 100%; height: calc(100% - 32px); background-color: rgba(27, 40, 56, 0.85); z-index: 2147483646; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; display: none; }
  #sv-launcher-loader.visible { opacity: 1; display: flex !important; pointer-events: auto; }
  .sv-spinner { width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #a4d007; animation: sv-spin 0.8s linear infinite; }
  @keyframes sv-spin { to { transform: rotate(360deg); } }
`;
const INJECT_LOADER_DOM = `if (!document.getElementById('sv-launcher-loader')) { const loader = document.createElement('div'); loader.id = 'sv-launcher-loader'; loader.innerHTML = '<div class="sv-spinner"></div>'; document.body.appendChild(loader); }`;
const CLICK_LISTENER_SCRIPT = `document.body.addEventListener('click', (e) => { const link = e.target.closest('a'); if (link && link.href) { if (link.href.startsWith('magnet:') || link.href.endsWith('.torrent') || link.href.includes('#') || link.href.startsWith('javascript:')) return; if (!link.href.includes('steamverde.net')) return; const loader = document.getElementById('sv-launcher-loader'); if (loader) loader.classList.add('visible'); } });`;
const HIDE_LOADER_SCRIPT = `(function() { const loader = document.getElementById('sv-launcher-loader'); if (loader) { loader.classList.remove('visible'); setTimeout(() => { loader.style.display = 'none'; }, 200); } })();`;
const SHOW_UPDATE_BTN_SCRIPT = `const btn = document.getElementById('sv-update-btn'); if(btn) btn.style.display = 'flex';`;

function updateSplashStatus(text) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
        const code = `const textEl = document.querySelector('.loading-text'); if(textEl) textEl.innerText = "${text}";`;
        loadingWindow.webContents.executeJavaScript(code).catch(() => {});
    }
}

// ==========================================================
// --- JANELAS ---
// ==========================================================

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
    webPreferences: { nodeIntegration: false, contextIsolation: true, enableBlinkFeatures: 'OverlayScrollbars', sandbox: false, preload: path.join(__dirname, 'preload.js') },
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
        const iconBase64 = getIconBase64();
        await siteWindow.webContents.executeJavaScript(INJECT_TITLEBAR_SCRIPT(currentUser.name, iconBase64));
        await siteWindow.webContents.executeJavaScript(UPDATE_NAME_SCRIPT);
        await siteWindow.webContents.executeJavaScript(INJECT_LOADER_DOM);
        await siteWindow.webContents.executeJavaScript(CLICK_LISTENER_SCRIPT);
        await siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT);
    } catch (e) { console.log(e); }
  });

  siteWindow.webContents.on('did-stop-loading', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); });
  siteWindow.webContents.on('did-fail-load', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); });
  
  siteWindow.webContents.on('will-navigate', (event, url) => { 
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) { 
          event.preventDefault(); shell.openExternal(url); 
          siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); 
      } 
  });
  siteWindow.webContents.setWindowOpenHandler(({ url }) => { 
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) { 
          shell.openExternal(url); 
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
        const url = details.url;
        if (url.startsWith('magnet:') || url.endsWith('.torrent')) { shell.openExternal(url); callback({ cancel: true }); return; }
        callback({ cancel: false });
    });
}

// --- START ---
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

autoUpdater.on('update-not-available', () => { 
    if (!siteWindow && !loginWindow) checkLoginAndStart(); 
});
autoUpdater.on('error', () => { 
    if (!siteWindow && !loginWindow) checkLoginAndStart(); 
});
autoUpdater.on('download-progress', (p) => { 
    if (loadingWindow && !loadingWindow.isDestroyed()) {
        updateSplashStatus('Baixando: ' + Math.round(p.percent) + '%'); 
    }
});
autoUpdater.on('update-downloaded', () => { 
    if (loadingWindow && !loadingWindow.isDestroyed()) {
        updateSplashStatus('Instalando...'); autoUpdater.quitAndInstall();
    } else if (siteWindow && !siteWindow.isDestroyed()) {
        siteWindow.webContents.executeJavaScript(SHOW_UPDATE_BTN_SCRIPT).catch(() => {});
    }
});

async function checkLoginAndStart() {
    updateSplashStatus('Iniciando...');
    try {
        const cookies = await session.defaultSession.cookies.get({ url: 'https://steamverde.net' });
        const authCookie = cookies.find(c => c.name.startsWith('wordpress_logged_in_'));
        const now = Date.now() / 1000;

        if (authCookie && authCookie.expirationDate > now) {
            currentUser.name = "Assinante VIP"; 
            createSiteWindow('https://steamverde.net/novo');
        } else {
            setTimeout(() => createLoginWindow(), 1000);
        }
    } catch (error) { createLoginWindow(); }
}

// --- IPCs ---
ipcMain.on('site-minimize', () => siteWindow.minimize());
ipcMain.on('site-maximize', () => { if (siteWindow.isMaximized()) siteWindow.unmaximize(); else siteWindow.maximize(); });
ipcMain.on('site-close', () => app.quit());
ipcMain.on('restart-app', () => autoUpdater.quitAndInstall());
ipcMain.on('site-logout', async () => {
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    app.relaunch(); app.exit(0);
});
ipcMain.on('minimize-login', () => { if (loginWindow) loginWindow.minimize(); });
ipcMain.on('close-login', () => { if (loginWindow) loginWindow.close(); });
ipcMain.on('login-success', async (event, data) => {
  // SEGURANÇA: Verifica se veio o cookie. Se não vier, para tudo.
  if (!data || !data.cookieValue || !data.cookieName) {
      console.error("Tentativa de acesso sem cookie bloqueada.");
      return;
  }

  const cookie = { url: 'https://steamverde.net', name: data.cookieName, value: data.cookieValue, expirationDate: data.expirationDate };
  currentUser.name = data.user_display_name || "Assinante";
  try {
    await session.defaultSession.cookies.set(cookie);
    createLoadingWindow();
    if (loginWindow) loginWindow.close();
    createSiteWindow(data.url);
  } catch (error) {
    if (loginWindow) loginWindow.close();
    createSiteWindow(data.url);
  }
});

let rpc;
function initDiscordRPC() {
    if (DISCORD_CLIENT_ID === '1443601234077417546') return;
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
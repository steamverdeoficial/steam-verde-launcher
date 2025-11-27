const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('path');
const DiscordRPC = require('discord-rpc');
const { autoUpdater } = require('electron-updater'); // Atualizador
const log = require('electron-log'); // Logs

// --- CONFIGURAÇÃO DE LOGS ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App iniciando...');

// --- CONFIGURAÇÃO DO DISCORD ---
const DISCORD_CLIENT_ID = '1443601234077417546'; 

let loginWindow;
let siteWindow;
let loadingWindow; 

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// --- CSS DO LOADER INTERNO ---
const LOADING_CSS = `
  #sv-launcher-loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(27, 40, 56, 0.85); z-index: 2147483647; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; display: none; }
  #sv-launcher-loader.visible { opacity: 1; display: flex !important; pointer-events: auto; }
  .sv-spinner { width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #a4d007; animation: sv-spin 0.8s linear infinite; }
  @keyframes sv-spin { to { transform: rotate(360deg); } }
`;
const INJECT_LOADER_DOM = `if (!document.getElementById('sv-launcher-loader')) { const loader = document.createElement('div'); loader.id = 'sv-launcher-loader'; loader.innerHTML = '<div class="sv-spinner"></div>'; document.body.appendChild(loader); }`;
const CLICK_LISTENER_SCRIPT = `document.body.addEventListener('click', (e) => { const link = e.target.closest('a'); if (link && link.href) { if (link.href.startsWith('magnet:') || link.href.endsWith('.torrent') || link.href.includes('#') || link.href.startsWith('javascript:')) return; if (!link.href.includes('steamverde.net')) return; const loader = document.getElementById('sv-launcher-loader'); if (loader) loader.classList.add('visible'); } });`;
const HIDE_LOADER_SCRIPT = `(function() { const loader = document.getElementById('sv-launcher-loader'); if (loader) { loader.classList.remove('visible'); setTimeout(() => { loader.style.display = 'none'; }, 200); } })();`;

// --- FUNÇÃO PARA ATUALIZAR TEXTO DO SPLASH ---
function updateSplashStatus(text) {
    if (loadingWindow && !loadingWindow.isDestroyed()) {
        // Injeta JS na splash screen para mudar o texto
        const code = `
            const textEl = document.querySelector('.loading-text');
            if(textEl) textEl.innerText = "${text}";
        `;
        loadingWindow.webContents.executeJavaScript(code).catch(() => {});
    }
}

// --- CRIAÇÃO DAS JANELAS ---

function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 600, height: 600, frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, 
    webPreferences: { nodeIntegration: false },
    icon: path.join(__dirname, 'build', 'icon.ico'),
    show: false
  });
  loadingWindow.loadFile('loading.html');
  loadingWindow.once('ready-to-show', () => { loadingWindow.show(); });
}

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400, height: 600, title: 'Steam Verde Launcher', icon: path.join(__dirname, 'build', 'icon.ico'),
    resizable: false, frame: false, transparent: true, 
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    autoHideMenuBar: true, backgroundColor: '#00000000', show: false
  });
  loginWindow.loadFile('login.html');
  loginWindow.once('ready-to-show', () => { 
      loginWindow.show(); 
      if (loadingWindow) loadingWindow.close(); // Fecha o loader quando o login aparece
  });
  loginWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function createSiteWindow(targetUrl) {
  siteWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, title: 'Steam Verde', icon: path.join(__dirname, 'build', 'icon.ico'), frame: true, 
    webPreferences: { nodeIntegration: false, contextIsolation: true, enableBlinkFeatures: 'OverlayScrollbars', sandbox: true },
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
  siteWindow.webContents.on('dom-ready', async () => { try { await siteWindow.webContents.insertCSS(LOADING_CSS); await siteWindow.webContents.executeJavaScript(INJECT_LOADER_DOM); await siteWindow.webContents.executeJavaScript(CLICK_LISTENER_SCRIPT); await siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT); } catch (e) {} });
  siteWindow.webContents.on('did-stop-loading', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); });
  siteWindow.webContents.on('did-fail-load', () => { siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); });
  siteWindow.webContents.on('will-navigate', (event, url) => { if (url.startsWith('magnet:') || url.endsWith('.torrent')) { event.preventDefault(); shell.openExternal(url); siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); } });
  siteWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('magnet:') || url.endsWith('.torrent')) { shell.openExternal(url); siteWindow.webContents.executeJavaScript(HIDE_LOADER_SCRIPT).catch(() => {}); return { action: 'deny' }; } if (url.startsWith('http') && !url.includes('steamverde.net')) { shell.openExternal(url); return { action: 'deny' }; } return { action: 'allow' }; });
}

function setupNetworkInterception(sess) {
    const filter = { urls: ['magnet:*', '*://*/*.torrent*'] };
    sess.webRequest.onBeforeRequest(filter, (details, callback) => {
        const url = details.url;
        if (url.startsWith('magnet:') || url.endsWith('.torrent')) { shell.openExternal(url); callback({ cancel: true }); return; }
        callback({ cancel: false });
    });
}

// --- INICIALIZAÇÃO DO APP ---

app.whenReady().then(() => {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  
  // 1. Abre a Splash Screen primeiro
  createLoadingWindow();

  // 2. Inicia o Discord
  initDiscordRPC();

  // 3. Verifica Atualizações
  if (app.isPackaged) {
      updateSplashStatus('Verificando atualizações...');
      autoUpdater.checkForUpdatesAndNotify();
  } else {
      // Se estiver em modo de desenvolvimento (npm start), pula a verificação
      log.info('Modo Dev: Pulando atualizações.');
      setTimeout(() => {
          createLoginWindow();
      }, 2000); // Espera 2s só para ver a splash
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- EVENTOS DO AUTO-UPDATER ---

autoUpdater.on('checking-for-update', () => {
    updateSplashStatus('Buscando atualizações...');
});

autoUpdater.on('update-available', () => {
    updateSplashStatus('Nova versão encontrada! Baixando...');
});

autoUpdater.on('update-not-available', () => {
    updateSplashStatus('Iniciando...');
    // Se não tem atualização, abre o Login após um breve delay
    setTimeout(() => {
        createLoginWindow();
    }, 1000);
});

autoUpdater.on('error', (err) => {
    updateSplashStatus('Erro na atualização. Iniciando...');
    log.error('Erro no Auto-Updater:', err);
    // Em caso de erro, inicia mesmo assim
    setTimeout(() => {
        createLoginWindow();
    }, 2000);
});

autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Baixando: ' + Math.round(progressObj.percent) + '%';
    updateSplashStatus(log_message);
});

autoUpdater.on('update-downloaded', () => {
    updateSplashStatus('Instalando agora...');
    autoUpdater.quitAndInstall();
});

// --- CONTROLES IPC ---
ipcMain.on('minimize-login', () => { if (loginWindow) loginWindow.minimize(); });
ipcMain.on('close-login', () => { if (loginWindow) loginWindow.close(); });

// --- LOGIN ---
ipcMain.on('login-success', async (event, data) => {
  const cookie = { url: 'https://steamverde.net', name: data.cookieName, value: data.cookieValue, expirationDate: Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60) };
  try {
    await session.defaultSession.cookies.set(cookie);
    createLoadingWindow(); // Mostra splash de novo entre login e site
    updateSplashStatus('Carregando Biblioteca...');
    if (loginWindow) loginWindow.close();
    createSiteWindow(data.url);
  } catch (error) {
    if (loginWindow) loginWindow.close();
    createSiteWindow(data.url);
  }
});

// --- DISCORD RPC ---
let rpc;
function initDiscordRPC() {
    if (DISCORD_CLIENT_ID === 'SEU_CLIENT_ID_DO_DISCORD_AQUI') return;
    DiscordRPC.register(DISCORD_CLIENT_ID);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });
    rpc.on('ready', () => { setDiscordActivity('Na tela de Login', 'Aguardando...'); });
    rpc.login({ clientId: DISCORD_CLIENT_ID }).catch(console.error);
}
function setDiscordActivity(details, state) {
    if (!rpc) return;
    rpc.setActivity({
        details: details, state: state, startTimestamp: Date.now(),
        largeImageKey: 'bola2steam_verde_oficial2025', largeImageText: 'Steam Verde Launcher',
        instance: false, buttons: [{ label: 'Acessar Site', url: 'https://steamverde.net' }]
    }).catch(console.error);
}
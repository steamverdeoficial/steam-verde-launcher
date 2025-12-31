// main.js
const { app, BrowserWindow, ipcMain, session, shell, dialog, Notification } = require('electron'); 
const path = require('path'); 
const fs = require('fs');  
const DiscordRPC = require('discord-rpc'); 
const { autoUpdater } = require('electron-updater'); 
const log = require('electron-log'); 
const WebTorrent = require('webtorrent'); 

// --- MÓDULOS SEPARADOS ---
const Styles = require('./src/styles');
const Scripts = require('./src/scripts');
const RD = require('./src/realdebrid');

// --- CONFIGURAÇÃO ---
const torrentClient = new WebTorrent();
let currentTorrent = null;
let downloadPath = app.getPath('downloads'); 
// DADOS PARA OS GRÁFICOS
let chartData = new Array(150).fill(0); 
let peersData = new Array(150).fill(0); 
let isPausedManual = false; 

// Inicializa RD Token
RD.loadToken();

// DATABASE LOCAL
const gamesDbPath = path.join(app.getPath('userData'), 'games.json');
if (!fs.existsSync(gamesDbPath)) { fs.writeFileSync(gamesDbPath, JSON.stringify([])); }

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

// FUNÇÃO SAVE DB
function saveGameToDb(name, path) {
    try {
        const data = fs.readFileSync(gamesDbPath);
        const games = JSON.parse(data);
        if (!games.find(g => g.name === name)) {
            games.push({ name: name, path: path, date: new Date().toISOString() });
            fs.writeFileSync(gamesDbPath, JSON.stringify(games));
        }
    } catch (e) { console.error(e); }
}

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
        // --- AQUI USAMOS OS MÓDULOS IMPORTADOS ---
        await siteWindow.webContents.insertCSS(Styles.TITLE_BAR_CSS); 
        await siteWindow.webContents.insertCSS(Styles.LOADING_CSS); 
        await siteWindow.webContents.insertCSS(Styles.CUSTOM_UI_CSS); 

        const iconBase64 = getIconBase64(); 
        await siteWindow.webContents.executeJavaScript(Scripts.INJECT_TITLEBAR_SCRIPT(currentUser.name, iconBase64, app.getVersion())); 
        await siteWindow.webContents.executeJavaScript(Scripts.INJECT_UI_SCRIPT); 
        await siteWindow.webContents.executeJavaScript(Scripts.INJECT_LOADER_DOM); 
        await siteWindow.webContents.executeJavaScript(Scripts.CLICK_LISTENER_SCRIPT); 
        await siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT); 
    } catch (e) { console.log(e); } 
  }); 

  siteWindow.webContents.on('did-stop-loading', () => { siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT).catch(() => {}); }); 
  siteWindow.webContents.on('did-fail-load', () => { siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT).catch(() => {}); }); 
   
  siteWindow.webContents.on('will-navigate', (event, url) => {  
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) {  
          event.preventDefault(); 
          startTorrentDownload(url);
          siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT).catch(() => {});  
      }  
  }); 
  siteWindow.webContents.setWindowOpenHandler(({ url }) => {  
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) {  
          startTorrentDownload(url);
          siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT).catch(() => {});  
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

async function startTorrentDownload(magnetLink) {
    if (currentTorrent) {
        dialog.showMessageBox(siteWindow, { type: 'info', title: 'Fila Cheia', message: 'Já existe um download em andamento.' });
        return;
    }

    // --- INTERCEPTAÇÃO REAL DEBRID ---
    // Se o RD assumir, ele retorna true e a gente para por aqui.
    // Passamos helpers para o módulo
    const rdHandled = await RD.handleMagnet(magnetLink, siteWindow, downloadPath, {
        saveGameToDb,
        formatBytes
    });

    if(rdHandled) return; // RD assumiu ou usuário cancelou

    // --- FLUXO TORRENT PADRÃO (SE NÃO FOR RD) ---
    siteWindow.webContents.executeJavaScript(`
        localStorage.setItem('sv-bar-collapsed', 'false');
        document.getElementById('sv-download-bar').classList.add('visible');
        document.getElementById('sv-toggle-tab').style.display = 'flex';
        document.getElementById('sv-dl-name').innerText = "Conectando aos Trackers...";
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
            
            new Notification({ title: 'Steam Verde', body: 'Download Concluído! Arquivo Pronto para Instalar.' }).show();
            
            if(siteWindow && !siteWindow.isDestroyed()) {
                siteWindow.webContents.send('torrent-done');
                siteWindow.webContents.send('torrent-progress', {
                    name: torrent.name, progress: "100.0", speed: "0 B/s", peers: 0, eta: "Download Concluído", paused: false, chart: chartData, peersChart: peersData
                });
            }

            const fullPath = path.join(downloadPath, torrent.name);
            saveGameToDb(torrent.name, fullPath); // SALVA

            fs.readdir(fullPath, (err, files) => {
                if(!err && files) {
                    const setup = files.find(f => f.toLowerCase().includes('setup.exe')) 
                               || files.find(f => f.toLowerCase().includes('install.exe'))
                               || files.find(f => f.toLowerCase().endsWith('.exe'));
                    
                    if(setup) {
                        const setupPath = path.join(fullPath, setup);
                        siteWindow.webContents.send('install-ready', setupPath);
                    }
                }
            });

            torrent.destroy(() => { currentTorrent = null; });
        });
    });
}

ipcMain.on('launch-installer', (event, filePath) => {
    shell.openPath(filePath);
});

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
    // 1. Tenta cancelar RD
    if(RD.cancelDownload()) {
         chartData.fill(0); peersData.fill(0);
         if(siteWindow) siteWindow.webContents.executeJavaScript(`
            document.getElementById('sv-download-bar').classList.remove('visible');
            document.getElementById('sv-toggle-tab').style.display = 'none';
         `);
         return;
    }

    // 2. Cancela Torrent Normal
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
            document.getElementById('sv-float-dl-btn').classList.remove('install-mode');
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

// IPCs MENU
ipcMain.on('get-my-games', (event) => {
    try {
        const data = fs.readFileSync(gamesDbPath);
        const games = JSON.parse(data);
        event.reply('my-games-list', games);
    } catch (e) { event.reply('my-games-list', []); }
});

ipcMain.on('remove-game-from-db', (event, gameName) => {
    try {
        if (fs.existsSync(gamesDbPath)) {
            const data = JSON.parse(fs.readFileSync(gamesDbPath));
            // Filtra removendo o jogo que tem o nome igual
            const newGames = data.filter(g => g.name !== gameName);
            fs.writeFileSync(gamesDbPath, JSON.stringify(newGames));
            
            // Atualiza a lista na hora para o usuário ver sumindo
            event.reply('my-games-list', newGames);
        }
    } catch (e) { console.error(e); }
});

ipcMain.on('open-game-folder', (event, folderPath) => {
    shell.openPath(folderPath);
});

// --- IPCs REAL DEBRID ---
ipcMain.on('rd-save-token', (e, token) => {
    RD.saveToken(token);
    // Tenta validar e dar feedback visual
    RD.getUserInfo().then(info => {
        if(info) {
             new Notification({title: "Real-Debrid", body: `Conectado como ${info.username}`}).show();
             siteWindow.webContents.executeJavaScript(`document.getElementById('rd-status').innerText = "Conectado: ${info.username} (Premium)"; document.getElementById('rd-status').style.color="#a4d007";`);
        } else {
             new Notification({title: "Real-Debrid", body: `Token Inválido`}).show();
             siteWindow.webContents.executeJavaScript(`document.getElementById('rd-status').innerText = "Erro: Token Inválido"; document.getElementById('rd-status').style.color="red";`);
        }
    });
});
ipcMain.on('rd-remove-token', () => RD.removeToken());


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
autoUpdater.on('update-downloaded', () => { if (loadingWindow) autoUpdater.quitAndInstall(); else if (siteWindow) siteWindow.webContents.executeJavaScript(Scripts.SHOW_UPDATE_BTN_SCRIPT).catch(() => {}); }); 

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
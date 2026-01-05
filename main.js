// main.js
const { app, BrowserWindow, ipcMain, session, shell, dialog, Notification, screen } = require('electron'); 
const path = require('path'); 
const fs = require('fs'); 
const DiscordRPC = require('discord-rpc'); 
const { autoUpdater } = require('electron-updater'); 
const log = require('electron-log'); 
const { execFile, spawn } = require('child_process');
const sevenBin = require('7zip-bin');

// --- MÓDULOS ---
const Styles = require('./src/styles');
const Scripts = require('./src/scripts');
const RD = require('./src/realdebrid');
const Notifications = require('./src/notifications'); 
const TorrentManager = require('./src/downloader');
const LocalAch = require('./src/achievements_local');
const GameWatcher = require('./src/achievements_watcher');

// --- CONFIGURAÇÃO E DADOS ---
const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) {
    try { fs.mkdirSync(userDataPath, { recursive: true }); } catch(e) {}
}

// ARQUIVO DE CONFIGURAÇÃO (Para salvar a pasta de download)
const configPath = path.join(userDataPath, 'config.json');
let downloadPath = app.getPath('downloads'); // Valor padrão inicial

// Carrega configuração salva se existir
try {
    if (fs.existsSync(configPath)) {
        const conf = JSON.parse(fs.readFileSync(configPath));
        if (conf.downloadPath && fs.existsSync(conf.downloadPath)) {
            downloadPath = conf.downloadPath;
        }
    }
} catch (e) { console.error("Erro ao carregar config:", e); }

let torrentMgr = null; 
let gameWatcher = null; 

RD.loadToken();

const gamesDbPath = path.join(userDataPath, 'games.json');
if (!fs.existsSync(gamesDbPath)) { fs.writeFileSync(gamesDbPath, JSON.stringify([])); }

autoUpdater.logger = log; 
autoUpdater.logger.transports.file.level = 'info'; 
autoUpdater.autoDownload = true; 

const DISCORD_CLIENT_ID = '1443601234077417546';  
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 SteamVerdeLauncher'; 
const COOKIE_DOMAIN = 'https://steamverde.net';  
const NAVIGATE_URL  = 'https://steamverde.net';  

let loginWindow, siteWindow, loadingWindow;  
let currentUser = { name: 'Assinante', avatar: '' }; 

if (process.platform === 'win32') {
    app.setAppUserModelId('com.steamverde.launcher');
}

// --- FUNÇÕES UTILITÁRIAS ---
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

function saveGameToDb(name, path, image) {
    try {
        const data = fs.readFileSync(gamesDbPath);
        const games = JSON.parse(data);
        if (!games.find(g => g.name === name)) {
            games.push({ name: name, path: path, image: image || '', date: new Date().toISOString() });
            fs.writeFileSync(gamesDbPath, JSON.stringify(games));
            if(siteWindow) LocalAch.incrementStat('downloads', siteWindow);
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

// --- OVERLAY DE CONQUISTAS ---
let overlayWindow = null;

function showAchievementOverlay(achievement) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize; 

    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
    }

    overlayWindow = new BrowserWindow({
        x: width - 350, 
        y: height - 100, 
        width: 340,
        height: 100,
        frame: false,
        transparent: true, 
        alwaysOnTop: true, 
        skipTaskbar: true, 
        focusable: false, 
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    overlayWindow.loadFile(path.join(__dirname, 'assets', 'overlay.html'));

    overlayWindow.webContents.on('did-finish-load', () => {
        overlayWindow.webContents.send('set-achievement', achievement);
    });

    const closeOverlay = () => {
        setTimeout(() => {
            if (overlayWindow && !overlayWindow.isDestroyed()) {
                overlayWindow.close();
            }
        }, 4500);
    };

    if (siteWindow && !siteWindow.isDestroyed()) {
        if (siteWindow.isFocused()) {
            closeOverlay();
        } else {
            siteWindow.once('focus', () => {
                closeOverlay();
            });
        }
    } else {
        closeOverlay();
    }
}

// --- JANELA DE AVISOS ---
function createNoticeWindow(notice) {
    const win = new BrowserWindow({ 
        width: 500, height: 600, 
        frame: false, 
        transparent: false,
        backgroundColor: '#1b2838',
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; background: #1b2838; color: #c7d5e0; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; border: 1px solid #a4d007; box-sizing: border-box; }
            .title-bar { height: 32px; background: #171a21; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; -webkit-app-region: drag; border-bottom: 1px solid #333; }
            .title { font-weight: bold; font-size: 12px; color: #fff; letter-spacing: 1px; }
            .close-btn { -webkit-app-region: no-drag; background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 16px; padding: 0 10px; height: 100%; display: flex; align-items: center; transition: 0.2s; }
            .close-btn:hover { background: #c21a1a; color: white; }
            .content { flex: 1; padding: 20px; overflow-y: auto; word-wrap: break-word; }
            .content::-webkit-scrollbar { width: 8px; }
            .content::-webkit-scrollbar-track { background: #171a21; }
            .content::-webkit-scrollbar-thumb { background: #323f55; border-radius: 4px; }
            .content::-webkit-scrollbar-thumb:hover { background: #a4d007; }
            h2 { margin-top: 0; color: #a4d007; border-bottom: 1px solid #333; padding-bottom: 10px; }
            .date { font-size: 11px; color: #666; margin-bottom: 15px; display: block; }
            img { max-width: 100%; height: auto; border-radius: 4px; }
            a { color: #47bfff; text-decoration: none; }
            a:hover { text-decoration: underline; }
        </style>
    </head>
    <body>
        <div class="title-bar">
            <span class="title">STEAM VERDE - AVISO</span>
            <button class="close-btn" onclick="window.close()">✕</button>
        </div>
        <div class="content">
            <h2>${notice.title}</h2>
            <span class="date">Publicado em: ${notice.date}</span>
            <div>${notice.content}</div>
        </div>
    </body>
    </html>`;
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
}

// --- JANELA LISTA DE CONQUISTAS ---
function createAchievementsWindow() {
    const win = new BrowserWindow({ 
        width: 900, height: 700, 
        frame: false, transparent: false, backgroundColor: '#1b2838',
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    const localList = LocalAch.getList();
    const gameList = gameWatcher ? gameWatcher.getAllUnlocked() : [];

    let launcherHtml = '';
    localList.forEach(ach => {
        const cssClass = ach.unlocked ? 'mission-card unlocked' : 'mission-card locked';
        let footerHtml = '';
        if (ach.unlocked) {
            footerHtml = `<div class="ach-xp">+${ach.xp} XP</div>`;
        } else if (ach.progress) {
            const pct = Math.min(100, (ach.progress.cur / ach.progress.max) * 100);
            footerHtml = `
                <div class="ach-prog-wrapper">
                    <div class="ach-prog-text">${ach.progress.cur} / ${ach.progress.max} ${ach.progress.label}</div>
                    <div class="ach-prog-bar">
                        <div class="ach-prog-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        } else {
            footerHtml = `<div class="ach-xp locked-xp">+${ach.xp} XP</div>`;
        }

        launcherHtml += `
            <div class="${cssClass}">
                <div class="mission-icon">${ach.icon}</div>
                <div class="info">
                    <div class="ach-title">${ach.title}</div>
                    <div class="ach-desc">${ach.desc}</div>
                    ${footerHtml}
                </div>
            </div>`;
    });

    const groupedGames = {};
    gameList.forEach(ach => {
        if (!groupedGames[ach.appId]) {
            groupedGames[ach.appId] = {
                name: ach.gameName,
                items: []
            };
        }
        groupedGames[ach.appId].items.push(ach);
    });

    let gamesHtml = '';
    if (Object.keys(groupedGames).length === 0) {
        gamesHtml = '<div style="text-align:center; color:#666; padding:20px; font-style:italic;">Nenhuma conquista de jogo detectada ainda.</div>';
    } else {
        for (const [appId, group] of Object.entries(groupedGames)) {
            gamesHtml += `
                <div class="game-category-container">
                    <div class="game-category-title">${group.name}</div>
                    <div class="game-category-line"></div>
                </div>
                <div class="grid">
            `;
            group.items.forEach(ach => {
                const divId = `card-${ach.uniqueId}`; 
                gamesHtml += `
                <div class="game-card unlocked" id="${divId}">
                    <div class="game-icon-wrapper">
                        <img src="${ach.icon}" id="img-${ach.uniqueId}" onerror="this.src='https://cdn.cloudflare.steamstatic.com/steam/apps/${ach.appId}/capsule_184x69.jpg'">
                    </div>
                    <div class="info">
                        <div class="ach-title" id="title-${ach.uniqueId}">${ach.title}</div>
                        <div class="ach-desc" id="desc-${ach.uniqueId}">${ach.desc}</div>
                    </div>
                </div>`;
            });
            gamesHtml += `</div>`; 
        }
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; background: #121418; color: #c7d5e0; font-family: 'Segoe UI', sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; border: 1px solid #a4d007; box-sizing: border-box; }
            .title-bar { height: 32px; background: #171a21; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; -webkit-app-region: drag; border-bottom: 1px solid #333; }
            .title { font-weight: bold; font-size: 13px; color: #a4d007; letter-spacing: 1px; display:flex; align-items:center; gap:10px; }
            .close-btn { -webkit-app-region: no-drag; background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 16px; padding: 0 15px; height: 100%; display: flex; align-items: center; transition: 0.2s; }
            .close-btn:hover { background: #c21a1a; color: white; }
            .content { flex: 1; padding: 20px; overflow-y: auto; }
            .content::-webkit-scrollbar { width: 8px; }
            .content::-webkit-scrollbar-track { background: #121418; }
            .content::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
            
            h2 { color: #fff; border-bottom: 2px solid #333; padding-bottom: 10px; margin-top: 30px; font-size: 18px; }
            h2:first-of-type { margin-top: 0; }
            
            .game-category-container { margin-top: 30px; margin-bottom: 10px; }
            .game-category-title { font-size: 14px; font-weight: bold; color: #a4d007; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 10px; }
            .game-category-line { width: 50%; height: 2px; background: linear-gradient(90deg, #333, transparent); margin-top: 5px; margin-bottom: 15px; }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
            
            .mission-card, .game-card { 
                background: #1b1e24; 
                border: 1px solid #333; 
                border-radius: 6px; 
                padding: 6px 10px; 
                display: flex; 
                align-items: center; 
                gap: 15px; 
                transition: 0.2s; 
                position: relative; 
                overflow: hidden; 
            }
            .unlocked { border-color: #a4d007; background: linear-gradient(45deg, #1b1e24, #232830); }
            .locked { opacity: 0.5; filter: grayscale(1); }
            .mission-icon { font-size: 24px; min-width: 40px; display:flex; justify-content:center; }
            .game-card { height: 80px; } 
            .game-icon-wrapper { width: 64px; height: 64px; min-width: 64px; border-radius: 6px; overflow: hidden; background: #000; }
            .game-icon-wrapper img { width: 100%; height: 100%; object-fit: cover; }
            .info { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
            .ach-title { font-weight: bold; color: #fff; font-size: 13px; margin-bottom: 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .ach-desc { color: #8f98a0; font-size: 11px; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 4px; }
            .ach-xp { font-size: 10px; color: #FFD700; font-weight: bold; border: 1px solid #FFD700; display: inline-block; padding: 2px 6px; border-radius: 4px; }
            .locked-xp { color: #666; border-color: #444; }
            .ach-prog-wrapper { width: 100%; display: flex; flex-direction: column; gap: 3px; }
            .ach-prog-text { font-size: 10px; color: #a4d007; font-weight: bold; text-align: right; }
            .ach-prog-bar { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; }
            .ach-prog-fill { height: 100%; background: linear-gradient(90deg, #a4d007, #d4ff33); box-shadow: 0 0 5px rgba(164,208,7,0.5); }
        </style>
    </head>
    <body>
        <div class="title-bar">
            <span class="title">🏆 CONQUISTAS E TROFÉUS</span>
            <button class="close-btn" onclick="window.close()">✕</button>
        </div>
        <div class="content">
            <h2>MISSÕES STEAM VERDE</h2>
            <div class="grid">${launcherHtml}</div>
            <h2 style="margin-top: 40px; border-color: #a4d007;">TROFÉUS DE JOGOS (DESBLOQUEADOS)</h2>
            ${gamesHtml}
        </div>
        <script>
            const { ipcRenderer } = require('electron');
            ipcRenderer.on('update-ach-ui', (event, data) => {
                const uid = data.uniqueId;
                const titleEl = document.getElementById('title-' + uid);
                const descEl = document.getElementById('desc-' + uid);
                const imgEl = document.getElementById('img-' + uid);
                if (titleEl) titleEl.innerText = data.title;
                if (descEl) descEl.innerText = data.desc;
                if (imgEl && data.icon) imgEl.src = data.icon;
            });
        </script>
    </body>
    </html>`;
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
}

// --- CRIAÇÃO DE JANELAS ---
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

  torrentMgr = new TorrentManager(siteWindow, Notifications, RD);
  
  if (!gameWatcher) {
      gameWatcher = new GameWatcher(siteWindow);
      gameWatcher.start();
  }

  siteWindow.webContents.setUserAgent(CHROME_USER_AGENT); 
  setupNetworkInterception(siteWindow.webContents.session); 
  siteWindow.loadURL(targetUrl); 

  siteWindow.once('ready-to-show', () => { 
    siteWindow.show(); siteWindow.maximize();  
    setDiscordActivity('Navegando na Biblioteca', 'Assinante VIP'); 
    if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close(); 
    setTimeout(() => Notifications.checkNewNotices(siteWindow), 3000); 
    setInterval(() => Notifications.checkNewNotices(siteWindow), 60000);
    LocalAch.checkStartup(siteWindow);
    setInterval(() => LocalAch.incrementStat('minutes_online', siteWindow), 60000);
  }); 
  siteWindow.on('closed', () => { app.quit(); }); 

  siteWindow.webContents.on('dom-ready', async () => { 
    try { 
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
          event.preventDefault(); startTorrentDownload(url, '');
          siteWindow.webContents.executeJavaScript(Scripts.HIDE_LOADER_SCRIPT).catch(() => {});  
      }  
  }); 
  siteWindow.webContents.setWindowOpenHandler(({ url }) => {  
      if (url.startsWith('magnet:') || url.endsWith('.torrent')) {  
          startTorrentDownload(url, '');
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
        startTorrentDownload(details.url, ''); callback({ cancel: true }); 
    }); 
} 

// --- FUNÇÃO DE DOWNLOAD ATUALIZADA (Usa a variável global downloadPath) ---
async function startTorrentDownload(magnetLink, gameImage) {
    if (torrentMgr) {
        // Agora usamos a variável downloadPath que é mutável pelo usuário
        const rdHandled = await RD.handleMagnet(magnetLink, siteWindow, downloadPath, {
            saveGameToDb, formatBytes: (b) => torrentMgr.formatBytes(b), gameImage 
        });
        if(rdHandled) return; 
        torrentMgr.startDownload(magnetLink, downloadPath, gameImage, saveGameToDb);
    }
}

// --- IPC HANDLERS ---
ipcMain.on('nav-back', () => { if(siteWindow && siteWindow.webContents.canGoBack()) siteWindow.webContents.goBack(); });
ipcMain.on('nav-forward', () => { if(siteWindow && siteWindow.webContents.canGoForward()) siteWindow.webContents.goForward(); });

ipcMain.on('launch-installer', (event, filePath) => { 
    if (torrentMgr) torrentMgr.pauseByPath(filePath);
    setTimeout(() => { shell.openPath(filePath); }, 500);
});

// --- NOVO: Handler para mudar pasta de download ---
ipcMain.on('change-download-path', async (event) => {
    if(!siteWindow) return;
    const result = await dialog.showOpenDialog(siteWindow, {
        properties: ['openDirectory'],
        title: 'Selecione a nova pasta padrão para Downloads',
        defaultPath: downloadPath
    });

    if(!result.canceled && result.filePaths.length > 0) {
        const newPath = result.filePaths[0];
        downloadPath = newPath; // Atualiza a variável global
        
        // Salva no arquivo de config
        try {
            fs.writeFileSync(configPath, JSON.stringify({ downloadPath: newPath }));
            dialog.showMessageBox(siteWindow, {
                type: 'info',
                title: 'Sucesso',
                message: `Pasta de download alterada para:\n${newPath}`,
                buttons: ['OK']
            });
        } catch(e) {
            console.error("Erro ao salvar config:", e);
        }
    }
});

ipcMain.on('torrent-pause', () => { if(torrentMgr) torrentMgr.togglePause(); });
ipcMain.on('torrent-stop', () => { 
    if(RD.cancelDownload()) {
        if(siteWindow) siteWindow.webContents.send('torrent-progress', { paused: true, speed: 'CANCELADO' }); 
        return;
    }
    if(torrentMgr) torrentMgr.stopCurrent(); 
});
ipcMain.on('torrent-toggle-file', (event, index, selected) => { if(torrentMgr) torrentMgr.toggleFile(index, selected); });
ipcMain.on('torrent-open-folder', () => shell.openPath(downloadPath)); // Usa a pasta atual
ipcMain.on('start-torrent-download', (event, url, image) => startTorrentDownload(url, image));
ipcMain.on('switch-download-tab', (event, infoHash) => { if(torrentMgr) torrentMgr.setActive(infoHash); });
ipcMain.on('request-file-list', () => { if(torrentMgr) torrentMgr.sendFilesList(); });

ipcMain.on('extract-archive', (event, archivePath) => {
    const fileNameNoExt = path.basename(archivePath, path.extname(archivePath));
    const targetDir = path.join(path.dirname(archivePath), fileNameNoExt);
    let pathTo7zip = sevenBin.path7za;
    if (app.isPackaged) { pathTo7zip = pathTo7zip.replace('app.asar', 'app.asar.unpacked'); }
    event.reply('extract-start');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const args = ['x', archivePath, `-o${targetDir}`, '-y', '-bsp1'];
    execFile(pathTo7zip, args, (error, stdout, stderr) => {
        if (error) {
            dialog.showMessageBox({ type: 'error', title: 'Erro na Extração', message: 'Detalhe: ' + stderr });
            event.reply('extract-done', { success: false }); return;
        }
        let setupPath = null;
        try {
            function findSetup(dir) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        const found = findSetup(fullPath);
                        if (found) return found;
                    } else {
                        const name = file.toLowerCase();
                        if (name.includes('setup.exe') || name.includes('install.exe') || (name.endsWith('.exe') && !name.includes('crash') && !name.includes('unity'))) {
                            return fullPath;
                        }
                    }
                }
                return null;
            }
            setupPath = findSetup(targetDir);
            event.reply('extract-done', { success: true, setup: setupPath, folder: targetDir });
        } catch(e) { event.reply('extract-done', { success: true, setup: null, folder: targetDir }); }
    });
});

ipcMain.on('get-my-games', (event) => {
    try {
        const data = fs.readFileSync(gamesDbPath);
        event.reply('my-games-list', JSON.parse(data));
    } catch (e) { event.reply('my-games-list', []); }
});

ipcMain.on('remove-game-from-db', (event, gameName) => {
    try {
        if (fs.existsSync(gamesDbPath)) {
            const data = JSON.parse(fs.readFileSync(gamesDbPath));
            const newGames = data.filter(g => g.name !== gameName);
            fs.writeFileSync(gamesDbPath, JSON.stringify(newGames));
            event.reply('my-games-list', newGames);
        }
    } catch (e) { console.error(e); }
});
ipcMain.on('open-game-folder', (event, folderPath) => { shell.openPath(folderPath); });
ipcMain.on('rd-save-token', (e, token) => { 
    RD.saveToken(token); 
    if(siteWindow) LocalAch.setStat('rd_linked', true, siteWindow);
});
ipcMain.on('rd-remove-token', () => RD.removeToken());
ipcMain.on('get-notices', () => { if(siteWindow) Notifications.checkNewNotices(siteWindow); });
ipcMain.on('mark-notice-read', (e, id) => { if(siteWindow) Notifications.markAsRead(id, siteWindow); });
ipcMain.on('delete-notice', (e, id) => { if(siteWindow) Notifications.deleteNotice(id, siteWindow); });
ipcMain.on('open-notice-window', (e, notice) => { createNoticeWindow(notice); }); 
ipcMain.on('console-log', (event, msg) => console.log("[RENDERER]", msg));

// IPC CONQUISTAS
ipcMain.on('open-achievements-window', () => { createAchievementsWindow(); });

// IPC OVERLAY
ipcMain.on('show-overlay', (event, ach) => {
    showAchievementOverlay(ach);
});

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
autoUpdater.on('update-downloaded', () => { 
    if (loadingWindow) {
        autoUpdater.quitAndInstall(); 
    } else if (siteWindow) {
        siteWindow.webContents.executeJavaScript(Scripts.SHOW_UPDATE_BTN_SCRIPT).catch(() => {});
        Notifications.sendSystemNotification('Nova Atualização', 'Clique para instalar.', siteWindow, null, () => autoUpdater.quitAndInstall());
    } 
});
autoUpdater.on('download-progress', (p) => { if (loadingWindow) updateSplashStatus('Baixando: ' + Math.round(p.percent) + '%', Math.round(p.percent)); }); 

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
    rpc.setActivity({ details: details, state: state, startTimestamp: Date.now(), largeImageKey: 'logo_steam', largeImageText: 'Steam Verde Launcher', instance: false, buttons: [{ label: 'Acessar Site', url: 'https://steamverde.net' }] }).catch(console.error); 
}
// src/realdebrid.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const { app, dialog, Notification } = require('electron');

let rdToken = null;
let rdActiveDownload = null;

const RD_API = 'https://api.real-debrid.com/rest/1.0';
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const rdConfigPath = path.join(app.getPath('userData'), 'rd_config.json');

// Agente KeepAlive
const agent = new https.Agent({  
    keepAlive: true,
    keepAliveMsecs: 5000,
    maxSockets: Infinity
});

function loadToken() {
    try {
        if(fs.existsSync(rdConfigPath)) {
            const data = JSON.parse(fs.readFileSync(rdConfigPath));
            rdToken = data.token;
            return rdToken;
        }
    } catch(e) {}
    return null;
}

function saveToken(token) {
    rdToken = token;
    fs.writeFileSync(rdConfigPath, JSON.stringify({ token }));
}

function removeToken() {
    rdToken = null;
    if(fs.existsSync(rdConfigPath)) fs.unlinkSync(rdConfigPath);
}

const headers = () => ({ Authorization: `Bearer ${rdToken}` });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getUserInfo() {
    if(!rdToken) return null;
    try {
        const res = await axios.get(`${RD_API}/user`, { headers: headers() });
        return res.data;
    } catch(e) { return null; }
}

class DownloadManager {
    constructor(url, filePath, win, callbacks) {
        this.url = url;
        this.filePath = filePath;
        this.win = win;
        this.callbacks = callbacks;
        this.canceled = false;
        this.totalBytes = 0;
        this.downloadedBytes = 0;
        this.writer = null;
        this.currentRequest = null;
        
        this.chartData = new Array(150).fill(0);
        this.peersData = new Array(150).fill(100);
        this.lastTime = Date.now();
        this.lastLoaded = 0;
    }

    async start() {
        try {
            const headRes = await axios.head(this.url, { 
                headers: { 'User-Agent': CHROME_USER_AGENT },
                httpsAgent: agent 
            });
            this.totalBytes = parseInt(headRes.headers['content-length'], 10);
            console.log(`[RD-MANAGER] Tamanho Total Detectado: ${this.totalBytes}`);
        } catch (e) {
            console.log("[RD-MANAGER] Não foi possível pegar tamanho via HEAD.");
        }

        return this.downloadLoop();
    }

    async downloadLoop() {
        let retries = 0;
        const MAX_RETRIES = 50; 

        while (!this.canceled && (this.downloadedBytes < this.totalBytes || this.totalBytes === 0)) {
            try {
                if (fs.existsSync(this.filePath)) {
                    this.downloadedBytes = fs.statSync(this.filePath).size;
                } else {
                    this.downloadedBytes = 0;
                }

                if (this.totalBytes > 0 && this.downloadedBytes >= this.totalBytes) {
                    console.log("[RD-MANAGER] Arquivo já está completo.");
                    break; 
                }

                const requestHeaders = { 
                    'User-Agent': CHROME_USER_AGENT,
                    'Connection': 'keep-alive'
                };
                
                let isResume = false;
                if (this.downloadedBytes > 0) {
                    requestHeaders['Range'] = `bytes=${this.downloadedBytes}-`;
                    isResume = true;
                    console.log(`[RD-MANAGER] Tentando resumir de: ${this.downloadedBytes}`);
                }

                const controller = new AbortController();
                this.currentRequest = controller;
                
                const response = await axios({
                    url: this.url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: requestHeaders,
                    timeout: 0, 
                    httpsAgent: agent,
                    signal: controller.signal,
                    validateStatus: (status) => status < 400 
                });

                // BLINDAGEM CONTRA CORRUPÇÃO (200 vs 206)
                if (isResume && response.status === 200) {
                    console.warn("[RD-MANAGER] Resume rejeitado (200 OK). Reiniciando para evitar corrupção.");
                    this.downloadedBytes = 0;
                    this.writer = fs.createWriteStream(this.filePath, { flags: 'w' });
                } else {
                    const flags = this.downloadedBytes > 0 ? 'a' : 'w';
                    this.writer = fs.createWriteStream(this.filePath, { flags: flags });
                }

                if (this.totalBytes === 0 && response.headers['content-length']) {
                    const contentLength = parseInt(response.headers['content-length'], 10);
                    this.totalBytes = (response.status === 206) ? (contentLength + this.downloadedBytes) : contentLength;
                }

                await this.streamToFile(response.data);
                retries = 0; 
                
            } catch (err) {
                if (this.canceled) return false;
                console.error(`[RD-MANAGER] Erro: ${err.message}. Reconectando em 3s...`);
                retries++;
                if (retries > MAX_RETRIES) throw new Error("Muitas falhas consecutivas.");
                if (this.writer) this.writer.close();
                await sleep(3000);
            }
        }

        if (this.canceled) return false;
        return true;
    }

    streamToFile(stream) {
        return new Promise((resolve, reject) => {
            let sessionDownloaded = 0;
            let lastActivity = Date.now();

            const watchdog = setInterval(() => {
                if(this.canceled) { clearInterval(watchdog); reject(new Error("Canceled")); return; }
                if(Date.now() - lastActivity > 20000) { 
                    console.log("[RD-MANAGER] Watchdog: Travado. Reiniciando...");
                    clearInterval(watchdog);
                    stream.destroy(); 
                    reject(new Error("Timeout Watchdog"));
                }
            }, 5000);

            stream.on('data', (chunk) => {
                this.downloadedBytes += chunk.length;
                sessionDownloaded += chunk.length;
                lastActivity = Date.now();
                
                if(!this.writer.write(chunk)) {
                    stream.pause();
                    this.writer.once('drain', () => stream.resume());
                }

                const now = Date.now();
                if (now - this.lastTime >= 1000) {
                    const speed = (sessionDownloaded - this.lastLoaded) / ((now - this.lastTime) / 1000);
                    this.lastLoaded = sessionDownloaded;
                    this.lastTime = now;
                    this.updateUI(speed);
                }
            });

            stream.on('end', () => {
                clearInterval(watchdog);
                this.writer.end();
                resolve();
            });

            stream.on('error', (err) => {
                clearInterval(watchdog);
                this.writer.end();
                reject(err);
            });
        });
    }

    updateUI(speed) {
        this.chartData.push(speed); this.chartData.shift();
        const percent = this.totalBytes > 0 ? ((this.downloadedBytes / this.totalBytes) * 100).toFixed(1) : 0;
        
        let etaFormatted = "--:--";
        if(speed > 0 && this.totalBytes > 0) {
            const etaSeconds = (this.totalBytes - this.downloadedBytes) / speed;
            const mins = Math.floor(etaSeconds / 60);
            const secs = Math.floor(etaSeconds % 60);
            etaFormatted = `${mins}m ${secs}s`;
        }

        this.win.webContents.send('torrent-progress', {
            name: path.basename(this.filePath),
            progress: percent,
            speed: this.callbacks.formatBytes(speed) + '/s',
            peers: "RD/RESUME",
            eta: etaFormatted,
            paused: false,
            chart: this.chartData,
            peersChart: this.peersData
        });
    }

    cancel() {
        this.canceled = true;
        if(this.currentRequest) this.currentRequest.abort();
        if(this.writer) this.writer.close();
    }
}

async function handleMagnet(magnetLink, win, downloadPath, callbacks) {
    if (!rdToken) return false;

    // Recupera a imagem passada nos callbacks
    const gameImage = callbacks.gameImage || '';

    const choice = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Baixar via Real-Debrid (Alta Velocidade)', 'Baixar via Torrent (P2P Tradicional)', 'Cancelar'],
        defaultId: 0,
        title: 'Real-Debrid Detectado',
        message: 'Como deseja baixar este jogo?',
        detail: 'Real-Debrid usa servidores HTTP diretos. Torrent usa conexões P2P.'
    });

    if (choice.response === 2) return true; 
    if (choice.response === 1) return false; 

    try {
        win.webContents.executeJavaScript(`
            localStorage.setItem('sv-bar-collapsed', 'false');
            document.getElementById('sv-download-bar').classList.add('visible');
            document.getElementById('sv-toggle-tab').style.display = 'flex';
            document.getElementById('sv-dl-name').innerText = "Real-Debrid: Processando...";
        `);

        // 1. ADD MAGNET
        const addData = new URLSearchParams(); addData.append('magnet', magnetLink);
        const addRes = await axios.post(`${RD_API}/torrents/addMagnet`, addData, { headers: headers() });
        const torrentId = addRes.data.id;

        // 2. WAIT INFO
        let info;
        while(true) {
            const infoRes = await axios.get(`${RD_API}/torrents/info/${torrentId}`, { headers: headers() });
            info = infoRes.data;
            if(info.status === 'waiting_files_selection') break;
            if(info.status === 'magnet_error') throw new Error('Erro no Magnet Link (RD)');
            await sleep(1000);
        }

        // 3. SELECT FILES
        const selectData = new URLSearchParams(); selectData.append('files', 'all');
        await axios.post(`${RD_API}/torrents/selectFiles/${torrentId}`, selectData, { headers: headers() });

        // 4. WAIT CONVERSION
        win.webContents.executeJavaScript(`document.getElementById('sv-dl-name').innerText = "Real-Debrid: Convertendo...";`);
        while(true) {
            const infoRes = await axios.get(`${RD_API}/torrents/info/${torrentId}`, { headers: headers() });
            info = infoRes.data;
            if(info.status === 'downloaded') break;
            if(info.status === 'error') throw new Error('Erro na conversão do RD');
            
            const progress = info.progress || 0;
            win.webContents.send('torrent-progress', {
                name: "Real-Debrid: Convertendo...",
                progress: progress.toFixed(1),
                speed: "Server Side",
                peers: 0,
                eta: "Aguarde...",
                paused: false,
                chart: new Array(150).fill(0),
                peersChart: new Array(150).fill(0)
            });
            await sleep(1000);
        }

        const links = info.links;
        if(links.length === 0) throw new Error('Nenhum link gerado.');
        const linkToUnrestrict = links[0];
        
        const unrestrictData = new URLSearchParams(); unrestrictData.append('link', linkToUnrestrict);
        const unrestrictRes = await axios.post(`${RD_API}/unrestrict/link`, unrestrictData, { headers: headers() });
        const downloadUrl = unrestrictRes.data.download;
        const fileName = unrestrictRes.data.filename;
        const finalPath = path.join(downloadPath, fileName);

        // 5. START DOWNLOAD
        win.webContents.executeJavaScript(`document.getElementById('sv-dl-name').innerText = "Baixando: ${fileName}";`);
        
        rdActiveDownload = new DownloadManager(downloadUrl, finalPath, win, callbacks);
        
        const success = await rdActiveDownload.start();

        if (success) {
            new Notification({ title: 'Steam Verde', body: 'Download Real-Debrid Concluído!' }).show();
            win.webContents.send('torrent-done');
            
            // Salva no banco COM A IMAGEM
            callbacks.saveGameToDb(fileName, finalPath, gameImage);
            
            // Detecta extensão para exibir botão correto
            const ext = path.extname(fileName).toLowerCase();
            if (ext === '.zip') {
                 win.webContents.send('archive-ready', { path: finalPath, type: 'zip' });
            } else if (ext === '.rar') {
                 win.webContents.send('archive-ready', { path: finalPath, type: 'rar' });
            } else if (ext === '.exe') {
                 win.webContents.send('install-ready', finalPath);
            } else {
                 win.webContents.send('install-ready', path.dirname(finalPath));
            }

            win.webContents.send('torrent-progress', {
                name: fileName, progress: "100.0", speed: "0 B/s", peers: 0, eta: "Concluído", paused: false, chart: new Array(150).fill(0), peersChart: new Array(150).fill(0)
            });
            
            try { await axios.delete(`${RD_API}/torrents/delete/${torrentId}`, { headers: headers() }); } catch(e){}
        } else {
            console.log("[RD] Cancelado. Limpando...");
            try { fs.unlinkSync(finalPath); } catch(e){}
        }

        rdActiveDownload = null;
        return true;

    } catch(err) {
        console.error("[RD] Erro Fatal:", err);
        dialog.showMessageBox(win, { type: 'error', title: 'Erro Real-Debrid', message: err.message });
        rdActiveDownload = null;
        return false; 
    }
}

function cancelDownload() {
    if(rdActiveDownload) {
        rdActiveDownload.cancel();
        return true;
    }
    return false;
}

module.exports = { loadToken, saveToken, removeToken, getUserInfo, handleMagnet, cancelDownload };
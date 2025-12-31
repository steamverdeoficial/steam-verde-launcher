// src/realdebrid.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const { app, dialog, Notification } = require('electron');

let rdToken = null;
let rdActiveDownload = null; // Objeto de controle

const RD_API = 'https://api.real-debrid.com/rest/1.0';
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const rdConfigPath = path.join(app.getPath('userData'), 'rd_config.json');

// Agente para manter conexões vivas
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

// --- CLASSE GERENCIADORA DE DOWNLOAD ---
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
        
        // Dados Gráficos
        this.chartData = new Array(150).fill(0);
        this.peersData = new Array(150).fill(100);
        this.lastTime = Date.now();
        this.lastLoaded = 0;
    }

    async start() {
        // 1. Pegar tamanho total primeiro (HEAD request)
        try {
            const headRes = await axios.head(this.url, { 
                headers: { 'User-Agent': CHROME_USER_AGENT },
                httpsAgent: agent 
            });
            this.totalBytes = parseInt(headRes.headers['content-length'], 10);
            console.log(`[RD-MANAGER] Tamanho Total: ${this.totalBytes}`);
        } catch (e) {
            console.error("[RD-MANAGER] Falha ao pegar tamanho. Tentando GET direto...");
        }

        return this.downloadLoop();
    }

    async downloadLoop() {
        let retries = 0;
        const MAX_RETRIES = 50; // Tenta muitas vezes antes de desistir

        while (!this.canceled && (this.downloadedBytes < this.totalBytes || this.totalBytes === 0)) {
            try {
                // Verifica quanto já temos no disco
                if (fs.existsSync(this.filePath)) {
                    this.downloadedBytes = fs.statSync(this.filePath).size;
                } else {
                    this.downloadedBytes = 0;
                }

                if (this.totalBytes > 0 && this.downloadedBytes >= this.totalBytes) {
                    console.log("[RD-MANAGER] Arquivo já está completo no disco.");
                    break; 
                }

                console.log(`[RD-MANAGER] Iniciando/Retomando de: ${this.downloadedBytes} bytes (Tentativa ${retries})`);

                // Configura Range se não for o começo
                const requestHeaders = { 
                    'User-Agent': CHROME_USER_AGENT,
                    'Connection': 'keep-alive'
                };
                if (this.downloadedBytes > 0) {
                    requestHeaders['Range'] = `bytes=${this.downloadedBytes}-`;
                }

                // Cria Stream de Escrita (Append se já tem dados, Write se é novo)
                const flags = this.downloadedBytes > 0 ? 'a' : 'w';
                this.writer = fs.createWriteStream(this.filePath, { flags: flags });

                // Faz a requisição
                const controller = new AbortController();
                this.currentRequest = controller;
                
                const response = await axios({
                    url: this.url,
                    method: 'GET',
                    responseType: 'stream',
                    headers: requestHeaders,
                    timeout: 0, // Sem timeout do axios
                    httpsAgent: agent,
                    signal: controller.signal
                });

                // Se não tinhamos o tamanho total, pega agora
                if (this.totalBytes === 0 && response.headers['content-length']) {
                    this.totalBytes = parseInt(response.headers['content-length'], 10) + this.downloadedBytes;
                }

                // Processa o stream
                await this.streamToFile(response.data);

                // Se chegou aqui sem erro, ou acabou ou o loop vai checar se completou
                retries = 0; // Reseta retries se baixou algo com sucesso
                
            } catch (err) {
                if (this.canceled) return false;
                
                console.error(`[RD-MANAGER] Erro na conexão: ${err.message}. Reconectando em 3s...`);
                retries++;
                if (retries > MAX_RETRIES) throw new Error("Muitas falhas de conexão consecutivas.");
                
                if (this.writer) this.writer.close(); // Garante que fecha o arquivo para não corromper
                await sleep(3000); // Espera 3s antes de tentar de novo
            }
        }

        if (this.canceled) return false;
        
        // Sucesso Final
        return true;
    }

    streamToFile(stream) {
        return new Promise((resolve, reject) => {
            let sessionDownloaded = 0;
            let lastActivity = Date.now();

            // Watchdog local
            const watchdog = setInterval(() => {
                if(this.canceled) { clearInterval(watchdog); reject(new Error("Canceled")); return; }
                if(Date.now() - lastActivity > 20000) { // 20s sem dados
                    console.log("[RD-MANAGER] Watchdog: Conexão travada. Reiniciando...");
                    clearInterval(watchdog);
                    stream.destroy(); // Mata o stream para forçar o catch do loop
                    reject(new Error("Timeout Watchdog"));
                }
            }, 5000);

            stream.on('data', (chunk) => {
                this.downloadedBytes += chunk.length;
                sessionDownloaded += chunk.length;
                lastActivity = Date.now();
                
                // Escreve no disco
                if(!this.writer.write(chunk)) {
                    stream.pause();
                    this.writer.once('drain', () => stream.resume());
                }

                // UI Updates
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
            peers: "RD/RESUME", // Indicador visual que estamos usando o novo sistema
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


// --- LÓGICA PRINCIPAL EXPORTADA ---

async function handleMagnet(magnetLink, win, downloadPath, callbacks) {
    if (!rdToken) return false;

    const choice = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Baixar via Real-Debrid (Alta Velocidade)', 'Baixar via Torrent (P2P Tradicional)', 'Cancelar'],
        defaultId: 0,
        title: 'Real-Debrid Detectado',
        message: 'Você tem o Real-Debrid configurado. Como deseja baixar este jogo?',
        detail: 'Real-Debrid usa servidores HTTP diretos. Torrent usa conexões P2P.'
    });

    if (choice.response === 2) return true; 
    if (choice.response === 1) return false; 

    try {
        // UI SETUP
        win.webContents.executeJavaScript(`
            localStorage.setItem('sv-bar-collapsed', 'false');
            document.getElementById('sv-download-bar').classList.add('visible');
            document.getElementById('sv-toggle-tab').style.display = 'flex';
            document.getElementById('sv-dl-name').innerText = "Real-Debrid: Processando Magnet...";
        `);

        // 1. ADD MAGNET
        console.log("[RD] Adicionando magnet...");
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
        win.webContents.executeJavaScript(`document.getElementById('sv-dl-name').innerText = "Real-Debrid: Convertendo/Baixando no Servidor...";`);
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

        // 5. GET LINK
        const links = info.links;
        if(links.length === 0) throw new Error('Nenhum link gerado.');
        const linkToUnrestrict = links[0];
        
        const unrestrictData = new URLSearchParams(); unrestrictData.append('link', linkToUnrestrict);
        const unrestrictRes = await axios.post(`${RD_API}/unrestrict/link`, unrestrictData, { headers: headers() });
        const downloadUrl = unrestrictRes.data.download;
        const fileName = unrestrictRes.data.filename;
        const finalPath = path.join(downloadPath, fileName);

        // 6. START DOWNLOAD MANAGER
        win.webContents.executeJavaScript(`document.getElementById('sv-dl-name').innerText = "Baixando: ${fileName}";`);
        
        rdActiveDownload = new DownloadManager(downloadUrl, finalPath, win, callbacks);
        
        const success = await rdActiveDownload.start();

        if (success) {
            new Notification({ title: 'Steam Verde', body: 'Download Real-Debrid Concluído!' }).show();
            win.webContents.send('torrent-done');
            callbacks.saveGameToDb(fileName, finalPath);
            win.webContents.send('torrent-progress', {
                name: fileName, progress: "100.0", speed: "0 B/s", peers: 0, eta: "Concluído", paused: false, chart: new Array(150).fill(0), peersChart: new Array(150).fill(0)
            });
            
            // Tenta limpar o torrent do RD pra não encher a conta do usuário
            try { await axios.delete(`${RD_API}/torrents/delete/${torrentId}`, { headers: headers() }); } catch(e){}
        } else {
            // Cancelado pelo usuário
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
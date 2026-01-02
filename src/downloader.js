// src/downloader.js
const WebTorrent = require('webtorrent');
const path = require('path');
const fs = require('fs');

class TorrentManager {
    constructor(mainWindow, notificationsModule, rDModule) {
        this.client = new WebTorrent();
        this.downloads = new Map(); 
        this.activeHash = null; 
        this.win = mainWindow;
        this.Notifs = notificationsModule;
        this.RD = rDModule;
        
        this.TRACKERS = [
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://9.rarbg.com:2810/announce",
            "udp://tracker.openbittorrent.com:80/announce",
            "udp://opentracker.i2p.rocks:6969/announce",
            "udp://tracker.internetwarriors.net:1337/announce",
            "udp://tracker.leechers-paradise.org:6969/announce",
            "udp://coppersurfer.tk:6969/announce",
            "udp://tracker.zer0day.to:1337/announce",
            "wss://tracker.openwebtorrent.com"
        ];
    }

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // --- NOVO: Pausa o torrent se tentarmos rodar o setup dele ---
    pauseByPath(targetPath) {
        if (!targetPath) return;
        const target = path.normalize(targetPath).toLowerCase();
        
        this.downloads.forEach((data, hash) => {
            // Caminho base do download
            const torrentPath = path.join(data.savePath, data.name);
            const normalizedTorrent = path.normalize(torrentPath).toLowerCase();

            // Se o arquivo alvo está DENTRO da pasta deste torrent
            if (target.includes(normalizedTorrent)) {
                if (!data.isManualPause) {
                    console.log(`[TorrentManager] Pausando seed para liberar arquivo: ${data.name}`);
                    data.isManualPause = true;
                    data.torrent.pause();
                    // Deselecionar arquivos ajuda a soltar o handle do disco
                    data.torrent.files.forEach(file => file.deselect());
                    data.torrent.deselect(0, data.torrent.pieces.length - 1, false);
                    this.updateProgress(hash);
                }
            }
        });
    }

    startDownload(magnetLink, savePath, gameImage, saveDbCallback) {
        this.win.webContents.executeJavaScript(`
            localStorage.setItem('sv-bar-collapsed', 'false');
            document.getElementById('sv-download-bar').classList.add('visible');
            document.getElementById('sv-toggle-tab').style.display = 'flex';
        `);

        const torrent = this.client.add(magnetLink, { path: savePath, announce: this.TRACKERS });

        const dlData = {
            torrent: torrent,
            name: "Obtendo Metadados...", 
            image: gameImage,
            chart: new Array(150).fill(0),
            peersChart: new Array(150).fill(0),
            paused: false,
            isManualPause: false,
            savePath: savePath,
            ready: false
        };

        this.downloads.set(torrent.infoHash, dlData);
        this.setActive(torrent.infoHash); 

        torrent.on('metadata', () => {
            if(this.downloads.has(torrent.infoHash)) {
                const data = this.downloads.get(torrent.infoHash);
                data.name = torrent.name;
                data.ready = true;
                this.sendTabsList(); 
            }
        });

        const interval = setInterval(() => {
            if (torrent.destroyed) {
                clearInterval(interval);
                return;
            }
            this.updateProgress(torrent.infoHash);
        }, 1000);

        torrent.on('done', () => {
            this.Notifs.sendSystemNotification('Download Concluído!', `O jogo ${torrent.name} foi finalizado.`, this.win);
            saveDbCallback(torrent.name, path.join(savePath, torrent.name), gameImage);
            this.updateProgress(torrent.infoHash);
            
            const fullPath = path.join(savePath, torrent.name);
            this.findSetupAndNotify(fullPath);
        });
    }

    setActive(infoHash) {
        if (this.downloads.has(infoHash)) {
            this.activeHash = infoHash;
            this.updateProgress(infoHash); 
            this.sendFilesList(infoHash);
            this.sendTabsList(); 
        }
    }

    updateProgress(infoHash) {
        const data = this.downloads.get(infoHash);
        if (!data) return;

        const torrent = data.torrent;

        if (data.isManualPause) {
            data.chart.push(0); 
        } else {
            data.chart.push(torrent.downloadSpeed);
        }
        data.chart.shift();
        
        data.peersChart.push(torrent.numPeers); 
        data.peersChart.shift();

        if (this.activeHash === infoHash && this.win && !this.win.isDestroyed()) {
            
            let eta = '--:--';
            if (data.ready && torrent.timeRemaining && torrent.timeRemaining < 86400000 && torrent.downloadSpeed > 0) { 
                 const hrs = Math.floor(torrent.timeRemaining / 3600000);
                 const mins = Math.floor((torrent.timeRemaining % 3600000) / 60000);
                 const secs = Math.floor((torrent.timeRemaining % 60000) / 1000);
                 eta = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs}s`;
            } else if (!data.ready) {
                eta = "Calculando...";
            }

            const uiData = {
                name: data.name, 
                progress: (torrent.progress * 100).toFixed(1),
                speed: data.isManualPause ? 'PAUSADO' : this.formatBytes(torrent.downloadSpeed) + '/s',
                peers: torrent.numPeers,
                eta: data.isManualPause ? 'PAUSADO' : eta,
                paused: data.isManualPause,
                chart: data.chart,
                peersChart: data.peersChart
            };

            this.win.webContents.send('torrent-progress', uiData);
            this.sendTabsList(); 
        }
    }

    sendTabsList() {
        const tabs = [];
        this.downloads.forEach((val, key) => {
            tabs.push({
                hash: key,
                name: val.name,
                progress: (val.torrent.progress * 100).toFixed(0),
                active: key === this.activeHash
            });
        });
        this.win.webContents.send('update-download-tabs', tabs);
    }

    sendFilesList(infoHash = null) {
        const hash = infoHash || this.activeHash;
        const data = this.downloads.get(hash);
        if (!data || !data.torrent || !data.ready) {
            this.win.webContents.send('torrent-files', []);
            return;
        }

        const filesData = data.torrent.files.map((f, index) => ({
            index: index,
            name: f.name,
            size: this.formatBytes(f.length),
            checked: true 
        }));
        this.win.webContents.send('torrent-files', filesData);
    }

    togglePause() {
        if (!this.activeHash) return;
        const data = this.downloads.get(this.activeHash);
        if (!data) return;

        data.isManualPause = !data.isManualPause;
        
        if (data.isManualPause) {
            data.torrent.pause();
            data.torrent.files.forEach(file => file.deselect());
            data.torrent.deselect(0, data.torrent.pieces.length - 1, false);
        } else {
            data.torrent.resume();
            data.torrent.files.forEach(file => file.select());
            data.torrent.select(0, data.torrent.pieces.length - 1, false);
        }
        this.updateProgress(this.activeHash);
    }

    stopCurrent() {
        if (!this.activeHash) return;
        const data = this.downloads.get(this.activeHash);
        
        if (data) {
            const torrentName = data.torrent.name; 
            const folderPath = data.savePath;
            
            data.torrent.destroy({ force: true }, () => {
                console.log(`[TorrentManager] Torrent ${torrentName} destruído.`);
            });

            try { 
                if (torrentName) {
                    const fullPath = path.join(folderPath, torrentName);
                    if (fs.existsSync(fullPath)) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                }
            } catch(e) { console.error("[TorrentManager] Erro ao deletar arquivos:", e); }

            this.downloads.delete(this.activeHash);
            
            if (this.downloads.size > 0) {
                const nextHash = this.downloads.keys().next().value;
                this.setActive(nextHash);
            } else {
                this.activeHash = null;
                this.win.webContents.executeJavaScript(`
                    document.getElementById('sv-download-bar').classList.remove('visible');
                    document.getElementById('sv-toggle-tab').style.display = 'none';
                    localStorage.setItem('sv-bar-collapsed', 'false');
                `);
            }
            this.sendTabsList();
        }
    }

    toggleFile(index, selected) {
        if (!this.activeHash) return;
        const data = this.downloads.get(this.activeHash);
        if (data && data.torrent && data.torrent.files[index]) {
             if(selected) data.torrent.files[index].select();
             else data.torrent.files[index].deselect();
        }
    }

    findSetupAndNotify(fullPath) {
        fs.readdir(fullPath, (err, files) => {
            if(!err && files) {
                const setup = files.find(f => 
                    f.toLowerCase().includes('setup.exe') || 
                    f.toLowerCase().includes('install.exe') || 
                    (f.toLowerCase().endsWith('.exe') && !f.toLowerCase().includes('crash') && !f.toLowerCase().includes('unity'))
                );
                if(setup) {
                    const setupPath = path.join(fullPath, setup);
                    this.win.webContents.send('install-ready', setupPath);
                }
            }
        });
    }
}

module.exports = TorrentManager;
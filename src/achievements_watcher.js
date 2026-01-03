// src/achievements_watcher.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { BrowserWindow } = require('electron'); // Necessário para enviar o sinal para a janela

// SEU SERVIDOR
const API_URL = 'https://steamverde.net/wp-json/steamverde/v1/achievement';

// ARQUIVO ONDE VAMOS SALVAR AS TRADUÇÕES NO SEU PC
const CACHE_FILE = path.join(process.env.APPDATA, 'steam-verde-cache.json');

const WATCH_PATHS = [
    { name: 'Goldberg', path: path.join(process.env.APPDATA, 'Goldberg SteamEmu Saves'), type: 'json' },
    { name: 'RUNE', path: path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Documents', 'Steam', 'RUNE'), type: 'ini' },
    { name: 'CODEX', path: path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Documents', 'Steam', 'CODEX'), type: 'ini' },
    { name: 'FLT', path: path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Documents', 'Steam', 'FLT'), type: 'ini' },
    { name: 'EMPRESS', path: path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Documents', 'Steam', 'EMPRESS'), type: 'ini' },
    { name: 'TENOKE', path: path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Documents', 'Steam', 'TENOKE'), type: 'ini' }
];

const IGNORED_KEYS = [
    'Count', 'Language', 'UserName', 'AccountId', 'ListenPort', 'MaximumConnection', 
    'VoiceServer', 'Stats', 'Version', 'Lobby', 'SteamAchievements', 'Achievements', 
    'General', 'Settings', 'SaveDate'
];

// Carrega o cache do arquivo para a memória ao iniciar
let metaCache = {};
try {
    if (fs.existsSync(CACHE_FILE)) {
        metaCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        console.log('[WATCHER] Cache local carregado com sucesso!');
    }
} catch (e) { metaCache = {}; }

const fileStates = {};

class GameWatcher {
    constructor(mainWindow) {
        this.win = mainWindow;
        this.interval = null;
    }

    start() {
        console.log('[WATCHER] Monitoramento com Cache Persistente iniciado.');
        // Mantém o scan rodando para detectar conquistas novas ENQUANTO joga
        this.interval = setInterval(() => this.scan(), 4000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    // --- FUNÇÃO 1: Usada para preencher a Janela de Conquistas ---
    getAllUnlocked() {
        let allAchievements = [];
        WATCH_PATHS.forEach(source => {
            if (!fs.existsSync(source.path)) return;
            try {
                const folders = fs.readdirSync(source.path);
                folders.forEach(appId => {
                    let filePath = this.findTargetFile(source, appId);
                    if (filePath) {
                        const unlocked = this.readFileSafe(filePath, source.type);
                        unlocked.forEach(achKey => {
                            if(!allAchievements.find(a => a.id === achKey && a.appId === appId)) {
                                const cacheKey = `${appId}-${achKey}`;
                                const cached = metaCache[cacheKey];
                                
                                // Se não tem no cache, dispara a busca silenciosa
                                if (!cached) this.fetchMeta(appId, achKey);

                                allAchievements.push({
                                    appId: appId,
                                    id: achKey,
                                    // ID ÚNICO para o HTML encontrar e substituir depois
                                    uniqueId: `${appId}_${achKey.replace(/[^a-zA-Z0-9]/g, '')}`,
                                    title: cached ? cached.title : this.localFormat(achKey),
                                    desc: cached ? cached.desc : 'Carregando tradução...',
                                    icon: cached ? cached.icon : `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`,
                                    // Se tiver cache usa, se não, usa o fallback que a API V9 vai corrigir depois
                                    gameName: cached ? cached.gameName : `JOGO: ${appId}`
                                });
                            }
                        });
                    }
                });
            } catch (e) {}
        });
        return allAchievements;
    }

    // --- FUNÇÃO 2: O Scan contínuo (Para Notificações) ---
    scan() {
        WATCH_PATHS.forEach(source => {
            if (!fs.existsSync(source.path)) return;
            try {
                const folders = fs.readdirSync(source.path);
                folders.forEach(appId => {
                    let targetFile = this.findTargetFile(source, appId);
                    if (targetFile) this.checkFile(appId, targetFile, source.type);
                });
            } catch (e) {}
        });
    }

    findTargetFile(source, appId) {
        if (source.type === 'json') {
            const p = path.join(source.path, appId, 'achievements.json');
            return fs.existsSync(p) ? p : null;
        } else {
            const pathsToCheck = [
                path.join(source.path, appId, 'achievements.ini'),
                path.join(source.path, appId, 'remote', 'achievements.ini'),
                path.join(source.path, appId, 'steam_settings', 'achievements.ini')
            ];
            return pathsToCheck.find(p => fs.existsSync(p)) || null;
        }
    }

    checkFile(appId, filePath, type) {
        try {
            const stats = fs.statSync(filePath);
            const mtime = stats.mtimeMs;
            if (!fileStates[filePath]) {
                fileStates[filePath] = { mtime, data: this.readFileSafe(filePath, type) };
                return;
            }
            // Se o arquivo mudou (nova conquista salva)
            if (fileStates[filePath].mtime !== mtime) {
                const oldData = fileStates[filePath].data;
                const newData = this.readFileSafe(filePath, type);
                fileStates[filePath] = { mtime, data: newData };
                
                // Pega apenas as NOVAS
                const newItems = newData.filter(x => !oldData.includes(x));
                newItems.forEach(achKey => this.notify(appId, achKey));
            }
        } catch (e) {}
    }

    readFileSafe(filePath, type) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            if (type === 'json') return JSON.parse(content).map(k => k.name || k); // Suporte a Goldberg JSON
            else if (type === 'ini') {
                const lines = content.split(/\r?\n/);
                const unlocked = [];
                let isSection = false;
                lines.forEach(line => {
                    let l = line.trim();
                    if (!l || l.startsWith(';') || l.startsWith('#')) return;
                    if (l.startsWith('[') && l.endsWith(']')) {
                        const sectionName = l.slice(1, -1);
                        if (!IGNORED_KEYS.includes(sectionName)) isSection = sectionName;
                        else isSection = false;
                        return;
                    }
                    const eqIdx = l.indexOf('=');
                    if (eqIdx === -1) return;
                    const key = l.substring(0, eqIdx).trim();
                    const val = l.substring(eqIdx + 1).trim();
                    
                    if (key.toLowerCase() === 'achieved' && (val === '1' || val.toLowerCase() === 'true')) {
                        if (typeof isSection === 'string') unlocked.push(isSection);
                    } else if ((isSection === 'SteamAchievements' || isSection === 'Achievements' || isSection === false) && (val === '1' || val.toLowerCase() === 'true')) {
                        if (!IGNORED_KEYS.includes(key) && isNaN(key)) unlocked.push(key);
                    }
                });
                return unlocked;
            }
        } catch (e) { return []; }
        return [];
    }

    // --- Dispara o TOAST (Notificação) ---
    async notify(appId, achKey) {
        if (IGNORED_KEYS.includes(achKey)) return;
        const meta = await this.fetchMeta(appId, achKey); // Busca dados bonitos
        if (this.win && !this.win.isDestroyed()) {
            this.win.webContents.send('achievement-unlocked', {
                id: achKey,
                title: meta.title,
                desc: meta.desc,
                icon: meta.icon,
                isGame: true 
            });
        }
    }

    localFormat(rawId) {
        let clean = rawId.replace(/^com[\s._]square[\s._]enix[\s._]/i, '').replace(/achievement/i, '');
        clean = clean.replace(/[_.]/g, ' ').replace(/^\d+\s*/, '');
        clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
        return clean.charAt(0).toUpperCase() + clean.slice(1).trim();
    }

    // --- NOVA LÓGICA VITAL: Busca na API e avisa a Janela ---
    async fetchMeta(appId, achKey) {
        const key = `${appId}-${achKey}`;
        if (metaCache[key]) return metaCache[key];

        // Fallback inicial enquanto carrega
        let res = {
            title: this.localFormat(achKey),
            desc: 'Conquista desbloqueada',
            icon: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`,
            gameName: `JOGO: ${appId}`
        };

        try {
            const response = await axios.get(API_URL, {
                params: { appid: appId, name: achKey },
                timeout: 8000 
            });

            if (response.data && (response.status === 200 || response.status === 304)) {
                res = response.data;
                
                // SALVA NO CACHE
                metaCache[key] = res;
                fs.writeFileSync(CACHE_FILE, JSON.stringify(metaCache, null, 2));

                // *** AQUI ESTÁ A CORREÇÃO MÁGICA ***
                // Avisa qualquer janela aberta para atualizar o texto "Carregando..."
                const uniqueId = `${appId}_${achKey.replace(/[^a-zA-Z0-9]/g, '')}`;
                BrowserWindow.getAllWindows().forEach(w => {
                    w.webContents.send('update-ach-ui', {
                        uniqueId: uniqueId,
                        title: res.title,
                        desc: res.desc,
                        icon: res.icon,
                        gameName: res.gameName
                    });
                });
            }
        } catch (e) {}

        metaCache[key] = res;
        return res;
    }
}

module.exports = GameWatcher;
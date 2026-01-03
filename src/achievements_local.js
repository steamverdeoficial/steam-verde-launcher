// src/achievements_local.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const userDataPath = app.getPath('userData');
const DB_PATH = path.join(userDataPath, 'my_achievements.json');

// --- LISTA DE CONQUISTAS DO LAUNCHER (ATUALIZADA) ---
const LAUNCHER_ACHIEVEMENTS = [
    // Iniciais
    { id: 'welcome', title: 'Bem-vindo ao Clube', desc: 'Abriu o Steam Verde Launcher pela primeira vez.', icon: '👋', xp: 10 },
    
    // Downloads
    { id: 'first_dl', title: 'O Primeiro de Muitos', desc: 'Baixou seu primeiro jogo.', icon: '🎮', xp: 50 },
    { id: 'collector_5', title: 'Colecionador Iniciante', desc: 'Baixou 5 jogos na biblioteca.', icon: '📚', xp: 100 },
    { id: 'collector_10', title: 'Biblioteca Recheada', desc: 'Baixou 10 jogos no total.', icon: '🔥', xp: 200 },
    { id: 'collector_20', title: 'HD Infinito', desc: 'Alcançou a marca de 20 jogos baixados.', icon: '💾', xp: 500 },

    // Real-Debrid
    { id: 'rd_user', title: 'Velocidade da Luz', desc: 'Configurou o Real-Debrid.', icon: '⚡', xp: 150 },
    
    // Horários
    { id: 'early_bird', title: 'Café com Jogos', desc: 'Abriu o launcher de manhã (06h - 10h).', icon: '☕', xp: 30 },
    { id: 'weekend_warrior', title: 'Fim de Semana Gamer', desc: 'Usou o launcher num Sábado ou Domingo.', icon: '📅', xp: 40 },
    { id: 'night_owl', title: 'Coruja Noturna', desc: 'Usou o launcher de madrugada (00h - 05h).', icon: '🦉', xp: 30 },
    
    // Tempo de Uso
    { id: 'marathon', title: 'Maratonista', desc: 'Ficou 5 horas com o launcher aberto.', icon: '⏱️', xp: 200 },

    // --- NOVAS: DIAS CONSECUTIVOS (STREAK) ---
    { id: 'streak_7', title: 'Fiel da Balança', desc: 'Entrou no launcher por 7 dias seguidos.', icon: '🗓️', xp: 300 },
    { id: 'streak_30', title: 'Viciado?', desc: 'Entrou no launcher por 30 dias seguidos! Haja jogo!', icon: '💎', xp: 1000 }
];

class LocalAchievements {
    constructor() {
        this.data = {
            unlocked: [],
            stats: { 
                downloads: 0, 
                minutes_online: 0, 
                rd_linked: false,
                last_login_date: '', // Data formato YYYY-MM-DD
                login_streak: 0      // Contador de dias seguidos
            }
        };
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DB_PATH)) {
                const raw = JSON.parse(fs.readFileSync(DB_PATH));
                this.data = { ...this.data, ...raw };
                
                // Garante que os campos novos existam se for usuário antigo
                if (!this.data.stats.last_login_date) this.data.stats.last_login_date = '';
                if (!this.data.stats.login_streak) this.data.stats.login_streak = 0;
            }
        } catch (e) {}
    }

    save() {
        try { fs.writeFileSync(DB_PATH, JSON.stringify(this.data)); } catch (e) {}
    }

    // Retorna lista formatada para o Front-end
    getList() {
        return LAUNCHER_ACHIEVEMENTS.map(ach => ({
            ...ach,
            unlocked: this.data.unlocked.includes(ach.id),
            isGame: false
        }));
    }

    unlock(id, win) {
        if (!this.data.unlocked.includes(id)) {
            this.data.unlocked.push(id);
            this.save();
            
            const ach = LAUNCHER_ACHIEVEMENTS.find(a => a.id === id);
            if (ach && win && !win.isDestroyed()) {
                win.webContents.send('achievement-unlocked', { ...ach, isGame: false });
            }
        }
    }

    // --- TRIGGERS ---
    incrementStat(stat, win, amount = 1) {
        if (typeof this.data.stats[stat] !== 'undefined') {
            this.data.stats[stat] += amount;
            this.checkRules(win);
            this.save();
        }
    }

    setStat(stat, val, win) {
        this.data.stats[stat] = val;
        this.checkRules(win);
        this.save();
    }

    checkRules(win) {
        if (this.data.stats.downloads >= 1) this.unlock('first_dl', win);
        if (this.data.stats.downloads >= 5) this.unlock('collector_5', win);
        if (this.data.stats.downloads >= 10) this.unlock('collector_10', win);
        if (this.data.stats.downloads >= 20) this.unlock('collector_20', win);
        
        if (this.data.stats.minutes_online >= 300) this.unlock('marathon', win);
        if (this.data.stats.rd_linked) this.unlock('rd_user', win);

        // Checa Streaks
        if (this.data.stats.login_streak >= 7) this.unlock('streak_7', win);
        if (this.data.stats.login_streak >= 30) this.unlock('streak_30', win);
    }

    // Chamado quando o launcher abre
    checkStartup(win) {
        this.unlock('welcome', win);
        
        const now = new Date();
        const h = now.getHours();
        const day = now.getDay(); // 0 = Domingo, 6 = Sabado

        // Regras de Horário
        if (h >= 0 && h < 5) this.unlock('night_owl', win);
        if (h >= 6 && h < 10) this.unlock('early_bird', win);
        if (day === 0 || day === 6) this.unlock('weekend_warrior', win);

        // --- LÓGICA DE DIAS CONSECUTIVOS (STREAK) ---
        const todayStr = now.toISOString().split('T')[0]; // "2023-10-27"
        const lastLogin = this.data.stats.last_login_date;

        if (lastLogin !== todayStr) {
            if (lastLogin) {
                // Calcula a diferença em dias
                const date1 = new Date(lastLogin);
                const date2 = new Date(todayStr);
                const diffTime = Math.abs(date2 - date1);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

                if (diffDays === 1) {
                    // Entrou ontem, continua o combo!
                    this.data.stats.login_streak += 1;
                } else {
                    // Quebrou o combo (mais de 1 dia sem entrar)
                    this.data.stats.login_streak = 1;
                }
            } else {
                // Primeira vez logando com esse sistema
                this.data.stats.login_streak = 1;
            }
            
            // Salva a data de hoje
            this.data.stats.last_login_date = todayStr;
            this.save();
            
            // Verifica se desbloqueou algo com o novo valor
            this.checkRules(win);
            
            // Log para debug (aparece no terminal do VS Code)
            console.log(`[STREAK] Dias consecutivos: ${this.data.stats.login_streak}`);
        }
    }
}

module.exports = new LocalAchievements();
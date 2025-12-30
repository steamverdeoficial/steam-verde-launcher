const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
    minimize: () => ipcRenderer.send('site-minimize'),
    maximize: () => ipcRenderer.send('site-maximize'),
    close: () => ipcRenderer.send('site-close'),
    logout: () => ipcRenderer.send('site-logout'),
    restartAndUpdate: () => ipcRenderer.send('restart-app'),
    onShowUpdateBtn: (callback) => ipcRenderer.on('show-update-btn', callback),
    
    startTorrent: (url) => ipcRenderer.send('start-torrent-download', url),
    pauseTorrent: () => ipcRenderer.send('torrent-pause'),
    stopTorrent: () => ipcRenderer.send('torrent-stop'),
    openFolder: () => ipcRenderer.send('torrent-open-folder'),
    
    toggleFilesModal: () => {
        const modal = document.getElementById('sv-files-modal');
        if(modal) {
            if(modal.style.display === 'flex') modal.style.display = 'none';
            else modal.style.display = 'flex';
        }
    },
    
    toggleDownloadBar: () => {
        const bar = document.getElementById('sv-download-bar');
        if (!bar) return;
        if (bar.classList.contains('visible')) {
            bar.classList.remove('visible'); 
            localStorage.setItem('sv-bar-collapsed', 'true'); 
        } else {
            bar.classList.add('visible'); 
            localStorage.setItem('sv-bar-collapsed', 'false'); 
        }
    },
    
    toggleFile: (index, checked, isPriority) => {
        ipcRenderer.send('torrent-toggle-file', index, checked, isPriority);
        if(isPriority) {
            const btn = document.getElementById(`prio-${index}`);
            if(btn) btn.classList.toggle('active');
        }
    },
    
    log: (msg) => ipcRenderer.send('console-log', msg)
});

ipcRenderer.on('torrent-progress', (event, data) => {
    const doc = document;
    
    const bar = doc.getElementById('sv-download-bar');
    const tab = doc.getElementById('sv-toggle-tab');
    const isCollapsed = localStorage.getItem('sv-bar-collapsed') === 'true';

    if (tab) tab.style.display = 'flex';

    if (bar) {
        if (!isCollapsed && !bar.classList.contains('visible')) bar.classList.add('visible');
        if (isCollapsed && bar.classList.contains('visible')) bar.classList.remove('visible');
    }

    if(doc.getElementById('sv-dl-name')) doc.getElementById('sv-dl-name').innerText = data.name;
    if(doc.getElementById('sv-dl-bar')) doc.getElementById('sv-dl-bar').style.width = data.progress + '%';
    if(doc.getElementById('sv-dl-peers')) doc.getElementById('sv-dl-peers').innerText = data.peers + ' Peers';
    if(doc.getElementById('sv-dl-eta')) doc.getElementById('sv-dl-eta').innerText = data.eta;
    if(doc.getElementById('sv-dl-perc')) doc.getElementById('sv-dl-perc').innerText = data.progress + '%';

    const speedEl = doc.getElementById('sv-dl-speed');
    if(speedEl) {
        if(data.paused) speedEl.innerText = "PAUSADO"; 
        else speedEl.innerText = data.speed;
    }

    const iPause = doc.getElementById('icon-pause');
    const iPlay = doc.getElementById('icon-play');
    if(iPause && iPlay) {
        if(data.paused) { 
            iPause.style.display = 'none'; iPlay.style.display = 'block'; 
        } else { 
            iPause.style.display = 'block'; iPlay.style.display = 'none'; 
        }
    }

    // --- GRÁFICO DUPLO (VELOCIDADE + PEERS) ---
    const canvas = doc.getElementById('sv-dl-canvas');
    if (canvas && data.chart && data.peersChart) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. DESENHA VELOCIDADE (VERDE - COM FUNDO)
        ctx.beginPath();
        const maxVal = Math.max(...data.chart, 100000); 
        const step = canvas.width / (data.chart.length - 1);
        
        data.chart.forEach((val, index) => {
            const x = index * step;
            const y = canvas.height - ((val / maxVal) * (canvas.height * 0.9)); 
            if(index === 0) ctx.moveTo(x, y);
            else {
                const prevX = (index - 1) * step;
                const prevY = canvas.height - ((data.chart[index-1] / maxVal) * (canvas.height * 0.9));
                const cx = (prevX + x) / 2;
                ctx.quadraticCurveTo(cx, prevY, x, y);
            }
        });
        
        ctx.lineTo(canvas.width, canvas.height);
        ctx.lineTo(0, canvas.height);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "rgba(164, 208, 7, 0.4)");   
        gradient.addColorStop(0.5, "rgba(164, 208, 7, 0.1)"); 
        gradient.addColorStop(1, "rgba(23, 26, 33, 0)");      
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(164, 208, 7, 0.9)";
        ctx.stroke();

        // 2. DESENHA PEERS (AZUL CYAN - SEM FUNDO, POR CIMA)
        ctx.beginPath();
        // Escala normalizada para peers (mínimo 10 para evitar divisão por zero)
        const maxPeers = Math.max(...data.peersChart, 10); 
        
        data.peersChart.forEach((val, index) => {
            const x = index * step;
            // Usa 80% da altura para não colar no topo
            const y = canvas.height - ((val / maxPeers) * (canvas.height * 0.8)); 
            
            if(index === 0) ctx.moveTo(x, y);
            else {
                const prevX = (index - 1) * step;
                const prevY = canvas.height - ((data.peersChart[index-1] / maxPeers) * (canvas.height * 0.8));
                const cx = (prevX + x) / 2;
                ctx.quadraticCurveTo(cx, prevY, x, y);
            }
        });
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#00d9ff"; // Azul Cyan Elétrico
        ctx.stroke();
    }
});

ipcRenderer.on('torrent-files', (event, files) => {
    const list = document.getElementById('sv-files-list');
    if(!list) return;
    list.innerHTML = ''; 
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'sv-file-item';
        item.style.cssText = "display:flex; align-items:center; padding:12px; border-bottom:1px solid #282c34; color:#ccc; transition: background 0.2s;";
        item.onmouseover = () => { item.style.background = '#232d3d'; };
        item.onmouseout = () => { item.style.background = 'transparent'; };

        item.innerHTML = `
            <input type="checkbox" class="sv-checkbox" checked style="accent-color:#a4d007; transform:scale(1.2); cursor:pointer;" onchange="window.ipc.toggleFile(${file.index}, this.checked, false)">
            <span class="sv-file-name" title="${file.name}" style="flex:1; margin:0 15px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:13px;">${file.name}</span>
            <span class="sv-file-size" style="font-family:monospace; color:#8f98a0; font-size:12px;">${file.size}</span>
            <button id="prio-${file.index}" class="sv-prio-btn" title="Alta Prioridade" onclick="window.ipc.toggleFile(${file.index}, true, true)" style="background:none; border:none; color:#555; cursor:pointer; margin-left:10px; transition: all 0.2s;">
                <svg style="width:18px;height:18px;fill:currentColor" viewBox="0 0 24 24"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" /></svg>
            </button>
        `;
        list.appendChild(item);
    });
});

ipcRenderer.on('torrent-done', () => {
    const bar = document.getElementById('sv-dl-bar');
    if(bar) bar.style.borderTop = '1px solid #43b581';
    alert("Download Concluído! Seus arquivos estão na pasta Downloads.");
});
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipc', {
    minimize: () => ipcRenderer.send('site-minimize'),
    maximize: () => ipcRenderer.send('site-maximize'),
    close: () => ipcRenderer.send('site-close'),
    logout: () => ipcRenderer.send('site-logout'),
    restartAndUpdate: () => ipcRenderer.send('restart-app'),

    // ESSA LINHA É A CHAVE DO SUCESSO:
    onShowUpdateBtn: (callback) => ipcRenderer.on('show-update-btn', callback)
});
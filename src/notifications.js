// src/notifications.js
const { Notification, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const NOTICES_API = 'https://steamverde.net/wp-json/steamverde/v1/notices';

// --- CORREÇÃO: RECRIA PASTA SE NÃO EXISTIR ---
const userDataPath = app.getPath('userData');
if (!fs.existsSync(userDataPath)) {
    try { fs.mkdirSync(userDataPath, { recursive: true }); } catch(e) {}
}
// ---------------------------------------------

const NOTICES_DB = path.join(userDataPath, 'notifications.json');

if (!fs.existsSync(NOTICES_DB)) {
    fs.writeFileSync(NOTICES_DB, JSON.stringify({ read: [], deleted: [] }));
}

function getIconPath() {
    return path.join(__dirname, '..', 'assets', 'icon.ico'); 
}

function sendSystemNotification(title, body, mainWindow = null, onClickUrl = null, onClickAction = null) {
    if (process.platform === 'win32') {
        app.setAppUserModelId('com.steamverde.launcher');
    }

    const notif = new Notification({
        title: title,
        body: body,
        icon: getIconPath(),
        silent: true 
    });

    if (onClickAction) {
        notif.on('click', onClickAction);
    } else if (onClickUrl) {
        notif.on('click', () => {
            if (onClickUrl.startsWith('http')) shell.openExternal(onClickUrl);
        });
    }

    notif.show();

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('play-sound');
    }
}

let notifiedSessionIds = [];

async function checkNewNotices(mainWindow) {
    try {
        const response = await axios.get(NOTICES_API, { timeout: 5000 });
        const serverNotices = response.data;

        if(!Array.isArray(serverNotices)) return;

        const localData = JSON.parse(fs.readFileSync(NOTICES_DB));
        const readIds = localData.read || [];
        const deletedIds = localData.deleted || [];

        const activeNotices = serverNotices.filter(n => !deletedIds.includes(n.id));
        let unreadCount = 0;
        let shouldPlaySound = false;

        activeNotices.forEach(notice => {
            if (!readIds.includes(notice.id)) {
                unreadCount++;
                
                if (!notifiedSessionIds.includes(notice.id)) {
                    sendSystemNotification('Steam Verde - Novo Aviso', notice.title, mainWindow);
                    notifiedSessionIds.push(notice.id);
                    shouldPlaySound = true;
                }
            }
        });

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-notices-list', { notices: activeNotices, readIds: readIds });
            mainWindow.webContents.send('update-badges', { hasUnread: unreadCount > 0, playSound: shouldPlaySound });
        }

    } catch (error) {
    }
}

function markAsRead(id, mainWindow) {
    try {
        const localData = JSON.parse(fs.readFileSync(NOTICES_DB));
        if (!localData.read.includes(id)) {
            localData.read.push(id);
            fs.writeFileSync(NOTICES_DB, JSON.stringify(localData));
        }
        checkNewNotices(mainWindow);
    } catch(e){}
}

function deleteNotice(id, mainWindow) {
    try {
        const localData = JSON.parse(fs.readFileSync(NOTICES_DB));
        if (!localData.deleted.includes(id)) {
            localData.deleted.push(id);
            fs.writeFileSync(NOTICES_DB, JSON.stringify(localData));
        }
        checkNewNotices(mainWindow);
    } catch(e){}
}

module.exports = { sendSystemNotification, checkNewNotices, markAsRead, deleteNotice };
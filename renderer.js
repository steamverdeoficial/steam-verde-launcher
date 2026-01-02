const { ipcRenderer } = require('electron');

// --- 1. CONTROLE DA JANELA (Minimizar e Fechar) ---
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
        ipcRenderer.send('minimize-login');
    });
}

if (btnClose) {
    btnClose.addEventListener('click', () => {
        ipcRenderer.send('close-login');
    });
}

// --- 2. ELEMENTOS DO FORMULÁRIO ---
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('error-msg');
// Captura o checkbox "Permanecer Conectado"
const rememberMe = document.getElementById('rememberMe');

// URL da API
const API_URL = 'https://steamverde.net/wp-json/steamverde/v1/launcher-login';

// --- 3. LÓGICA DE LOGIN ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // UI Loading (Feedback visual)
    loginBtn.disabled = true;
    loginBtn.textContent = 'VERIFICANDO...';
    errorMsg.style.display = 'none';

    const login = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Verifica se o elemento existe antes de pegar a propriedade checked
    const isRemember = rememberMe ? rememberMe.checked : false;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                login: login,
                password: password,
                remember: isRemember
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // SUCESSO: Login aprovado
            loginBtn.textContent = 'ACESSO PERMITIDO!';
            loginBtn.style.background = '#a4d007'; // Verde Steam Verde
            
            setTimeout(() => {
                // Envia o comando para o main.js fechar essa janela e abrir o site
                ipcRenderer.send('login-success', {
                    url: 'https://steamverde.net', 
                    cookieName: data.cookie_name,
                    cookieValue: data.cookie_value,
                    expirationDate: data.cookie_expiration,
                    user_display_name: data.user_display_name 
                });
            }, 1000);

        } else {
            // ERRO: Senha errada ou NÃO é assinante
            throw new Error(data.message || 'Erro desconhecido');
        }

    } catch (error) {
        const msg = error.message.toLowerCase();
        
        // CORREÇÃO AQUI: Adicionei verificação para "vip" e "apenas"
        if (msg.includes('assinante') || msg.includes('permissão') || msg.includes('vip') || msg.includes('apenas')) {
             errorMsg.innerHTML = `
                Acesso negado. Você precisa ser um assinante.<br>
                <a href="#" onclick="require('electron').shell.openExternal('https://steamverde.net/assinante/')" style="color:#a4d007; font-weight:bold; cursor:pointer;">CLIQUE AQUI PARA ASSINAR</a>
             `;
        } else {
             errorMsg.textContent = error.message;
        }
        
        errorMsg.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'ENTRAR NA CONTA';
        loginBtn.style.background = ''; // Volta a cor original
    }
});
# 🎮 Steam Verde Launcher

![Version](https://img.shields.io/github/package-json/v/steamverdeoficial/steam-verde-launcher?style=for-the-badge&color=a4d007)
![Platform](https://img.shields.io/badge/platform-Windows-blue?style=for-the-badge&logo=windows)
![Status](https://img.shields.io/badge/status-Stable-success?style=for-the-badge)

> **A experiência definitiva para a comunidade Steam Verde.** Navegação limpa, downloads instantâneos e integração social.

<div align="center">
  <img src="https://i.imgur.com/ktJdZFC.png" alt="Preview do Launcher" width="40%">
  <br>
  <em>(Interface moderna, sem bordas e focada em performance)</em>
</div>

---

## ⚡ Sobre o Projeto

O **Steam Verde Launcher** é um aplicativo desktop desenvolvido em **Electron**, criado para oferecer uma experiência "Premium" e exclusiva para os apoiadores da comunidade Steam Verde. 

Diferente de acessar pelo navegador comum, o Launcher oferece um ambiente controlado, otimizado para jogos e livre de distrações.

## ✨ Funcionalidades Exclusivas

| Recurso | Descrição |
| :--- | :--- |
| **🚫 Zero Anúncios** | Graças ao nosso sistema de injeção inteligente, **todas** as propagandas, banners e pop-ups são bloqueados nativamente. Navegação 100% limpa. |
| **⚡ Magnet Link Nativo** | Chega de avisos de "Abrir aplicativo?". O Launcher intercepta links `magnet:` e `.torrent` e abre seu cliente (qBittorrent/uTorrent) instantaneamente. |
| **🎮 Discord RPC** | Mostre para seus amigos o que você está fazendo! Integração rica com Discord mostrando "Navegando na Biblioteca" e tempo decorrido. |
| **🔐 Login Persistente** | Sistema de Auto-Login seguro. Marque "Permanecer Conectado" e acesse sua biblioteca direto, sem digitar senha toda vez. |
| **🖥️ UI Imersiva** | Design "Frameless" (sem bordas do Windows), barra de título personalizada, Splash Screen animada e Modo Escuro nativo. |
| **🔄 Auto-Updater** | Você nunca precisa baixar uma nova versão manualmente. O Launcher se atualiza sozinho assim que abrimos novidades. |

---

## 💎 Para Quem é Este Launcher?

Este software é **exclusivo para Assinantes VIP** da Steam Verde.

O acesso ao sistema de login é bloqueado via API para usuários gratuitos. Ao se tornar um assinante, você não apenas apoia a comunidade, mas desbloqueia a melhor forma de navegar e baixar seus jogos.

### Ainda não é Assinante?

Não perca tempo com pop-ups e esperas. Tenha prioridade e conforto.

<a href="https://steamverde.net/novo/assinante/" target="_blank">
  <img src="https://img.shields.io/badge/CLIQUE_AQUI_PARA_ASSINAR_AGORA-a4d007?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Assinar Agora" height="50">
</a>

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído utilizando tecnologias web modernas empacotadas para Desktop:

* [Electron](https://www.electronjs.org/) - Framework base.
* [Node.js](https://nodejs.org/) - Backend do aplicativo.
* [Discord RPC](https://discord.com/developers/docs/topics/rpc) - Integração de status.
* [Electron Builder](https://www.electron.build/) - Compilação e empacotamento.
* [Electron Updater](https://www.electron.build/auto-update) - Sistema de atualização OTA (Over-the-air).

---
<div align="center">

Made with 💚 by <strong>Steam Verde Dev Team</strong> </div>

## 📦 Instalação e Desenvolvimento

Se você deseja apenas usar o Launcher, baixe o instalador `.exe` na aba [Releases](https://github.com/steamverdeoficial/steam-verde-launcher/releases).

Se você é desenvolvedor e quer contribuir ou testar o código:

### Pré-requisitos
* Node.js (v16 ou superior)
* Git

### Rodando localmente

```bash
# 1. Clone o repositório
git clone [https://github.com/steamverdeoficial/steam-verde-launcher.git](https://github.com/steamverdeoficial/steam-verde-launcher.git)

# 2. Entre na pasta
cd steam-verde-launcher

# 3. Instale as dependências
npm install

# 4. Inicie em modo de desenvolvimento
npm start

📜 Licença

Este projeto é proprietário e distribuído exclusivamente pela Steam Verde. O uso do Launcher requer uma conta ativa e regular na plataforma.

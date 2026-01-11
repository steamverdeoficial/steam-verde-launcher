// src/styles.js

const TITLE_BAR_CSS = ` 
  html { padding-top: 0px !important; height: 100vh; box-sizing: border-box; } 
  body { margin-top: 0 !important; } 
  header, .site-header, #masthead, .elementor-location-header, .elementor-section-fixed, .elementor-sticky--active { top: 32px !important; } 
  .rt-slider-progress-bar, .rt-slider-progress {top: 32px !important; }
  #wpadminbar { top: 32px !important; } 
  #sv-custom-titlebar { position: fixed; top: 0; left: 0; width: 100%; height: 32px; background: #171a21; color: #c7d5e0; z-index: 2147483647; display: flex; justify-content: space-between; align-items: center; font-family: 'Segoe UI', sans-serif; user-select: none; -webkit-app-region: drag; box-shadow: 0 2px 5px rgba(0,0,0,0.5); box-sizing: border-box; } 
  .sv-left-area { display: flex; align-items: center; height: 100%; overflow: hidden; padding-left: 10px; flex-shrink: 0; } 
  .sv-app-icon { height: 18px; width: 18px; margin-right: 10px; pointer-events: none; -webkit-user-drag: none; } 
  .sv-bar-logo { font-size: 12px; font-weight: bold; letter-spacing: 1px; color: #8f98a0; white-space: nowrap; } 
  .sv-bar-controls { display: flex; height: 100%; -webkit-app-region: no-drag; align-items: center; } 
  .sv-version-tag { font-size: 11px; color: #576574; margin-right: 10px; cursor: default; opacity: 0.8; }
  #sv-update-btn { display: none; color: #43b581; cursor: pointer; margin-right: 15px; background: transparent; border: none; align-items: center; height: 100%; animation: sv-pulse 2s infinite; -webkit-app-region: no-drag; } 
  #sv-update-btn:hover { color: #a4d007; } 
  @keyframes sv-pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } } 
  .sv-user-menu { position: relative; display: flex; align-items: center; cursor: pointer; padding: 0 15px; height: 100%; transition: 0.2s; border-left: 1px solid #282c34; -webkit-app-region: no-drag; } 
  .sv-user-menu:hover { background: #323f55; color: white; } 
  .sv-user-name { font-size: 12px; font-weight: 600; margin-right: 8px; color: #a4d007; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } 
  .sv-arrow { font-size: 8px; } 
  #sv-logout-dropdown { position: absolute; top: 32px; right: 0; background: #323f55; width: 150px; display: none; flex-direction: column; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border-bottom-left-radius: 4px; } 
  #sv-logout-dropdown.show { display: flex; } 
  .sv-logout-item { padding: 12px 15px; font-size: 12px; cursor: pointer; color: #c7d5e0; text-decoration: none; } 
  .sv-logout-item:hover { background: #c21a1a; color: white; } 
  .sv-win-btn { width: 45px; height: 100%; border: none; background: transparent; color: #8f98a0; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: background 0.2s; padding: 0; -webkit-app-region: no-drag; } 
  .sv-win-btn svg { width: 10px; height: 10px; fill: currentColor; } 
  .sv-win-btn:not(.sv-close-btn):hover { background: #323f55; color: white; } 
  #sv-custom-titlebar .sv-bar-controls .sv-close-btn:hover { background: #a4d007 !important; color: #171a21 !important; } 
  
  .sv-menu-btn { width: 40px; height: 100%; display: flex; justify-content: center; align-items: center; cursor: pointer; border-right: 1px solid #282c34; color: #8f98a0; transition: 0.2s; -webkit-app-region: no-drag !important; position: relative; }
  .sv-menu-btn:hover { background: #323f55; color: #fff; }
  .sv-menu-btn svg { width: 24px; height: 24px; fill: currentColor; }

  .sv-nav-btn { -webkit-app-region: no-drag !important; background: transparent; border: none; color: #8f98a0; width: 34px; height: 100%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; margin: 0; }
  .sv-nav-btn:hover { color: #fff; background: #323f55; }
  .sv-nav-btn svg { width: 20px !important; height: 20px !important; fill: currentColor; min-width: 20px; min-height: 20px; }

  #sv-news-badge { width: 8px; height: 8px; background: #a4d007; border-radius: 50%; position: absolute; top: 6px; right: 6px; display: none; box-shadow: 0 0 5px #a4d007; z-index: 10; border: 1px solid #171a21; }
  .sv-menu-item.has-news { border-left-color: #a4d007; background: rgba(164, 208, 7, 0.1); }
  .sv-menu-item.has-news::after { content: '!'; color: #1b2838; font-weight: bold; background: #a4d007; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; margin-left: auto; }
`;

const CUSTOM_UI_CSS = `
  .adsbygoogle, .ad-container, .advertising, .anuncio, 
  div[id^="google_ads"], iframe[src*="google"], .admaven-banner, .pop-under {
      position: absolute !important; left: -9999px !important; visibility: hidden !important;
  }

  /* CHAT */
  #sv-chat-modal {
      position: fixed; bottom: 0; right: 300px; width: 300px; height: 400px; 
      background: #171a21; border: 1px solid #333; border-top-left-radius: 6px; border-top-right-radius: 6px;
      display: none; flex-direction: column; z-index: 20000; box-shadow: 0 -5px 20px rgba(0,0,0,0.5);
  }
  #sv-chat-modal.visible { display: flex; }
  .sv-chat-header { background: #1f232b; padding: 10px; font-weight: bold; color: #fff; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; cursor: pointer; border-radius: 6px 6px 0 0; }
  .sv-chat-body { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; font-size: 13px; background: #121418; }
  .sv-chat-input-area { padding: 10px; border-top: 1px solid #333; display: flex; gap: 5px; background: #1f232b; }
  .sv-chat-input { flex: 1; background: #0f1115; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; outline: none; }
  .sv-chat-input:focus { border-color: #a4d007; }
  .sv-chat-msg { max-width: 80%; padding: 8px; border-radius: 4px; word-wrap: break-word; }
  .sv-chat-msg.me { align-self: flex-end; background: #3c4a63; color: #fff; }
  .sv-chat-msg.them { align-self: flex-start; background: #282c34; color: #ccc; }

  /* STATUS DOT */
  .sv-status-dot { width: 10px; height: 10px; border-radius: 50%; background: #666; display: inline-block; margin-right: 8px; border: 2px solid #1b2838; }
  .sv-status-dot.online { background: #a4d007; box-shadow: 0 0 5px #a4d007; }
  .sv-status-dot.offline { background: #666; }

  /* SIDE MENU */
  #sv-side-menu {
      position: fixed; top: 32px; left: -300px; width: 280px; height: calc(100% - 32px);
      background: #121418; border-right: 1px solid #a4d007;
      z-index: 2147483647; transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column; padding-top: 20px;
      box-shadow: 5px 0 20px rgba(0,0,0,0.5);
  }
  #sv-side-menu.open { left: 0; }
  .sv-menu-item { padding: 15px 25px; color: #c7d5e0; font-family: 'Segoe UI', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: 0.2s; border-left: 3px solid transparent; text-decoration: none; }
  .sv-menu-item:hover { background: #1f232b; color: #fff; border-left-color: #a4d007; }
  .sv-menu-item svg { width: 24px; height: 24px; }
  .sv-menu-divider { height: 1px; background: #282c34; margin: 10px 0; }
  
  #sv-menu-overlay { position: fixed; top: 32px; left: 0; width: 100%; height: calc(100% - 32px); background: rgba(0,0,0,0.5); z-index: 2147483646; opacity: 0; pointer-events: none; transition: opacity 0.3s; }
  #sv-menu-overlay.visible { opacity: 1; pointer-events: auto; }

  /* CONQUISTAS MODAL */
  #sv-achievements-modal { 
      position: fixed; 
      top: 100px; 
      left: calc(50% - 350px);
      width: 700px; 
      height: 500px; 
      border: 1px solid #FFD700; 
      background: #121418; 
      z-index: 2147483647 !important; 
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  }
  .sv-achievements-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; padding: 10px; }
  
  .sv-achievement-card { 
      background: #171a21; border: 1px solid #333; border-radius: 6px; padding: 10px; 
      display: flex; align-items: center; gap: 0; transition: 0.2s; position: relative; overflow: hidden;
      height: 80px; /* Altura fixa para o cartão não estourar */
  }
  
  .sv-achievement-card.locked { opacity: 0.5; filter: grayscale(1); }
  .sv-achievement-card.unlocked { border-color: #FFD700; background: linear-gradient(45deg, #171a21, #1f232b); }
  .sv-achievement-card.unlocked::after {
      content: '✔'; position: absolute; top: 5px; right: 10px; color: #FFD700; font-size: 16px; font-weight: bold;
  }

  /* === GOLPE FINAL NOS ÍCONES GIGANTES === */
  /* Travamos o Flexbox e forçamos os limites */
  #sv-achievements-modal .sv-achievement-card img,
  #sv-achievements-modal img,
  .sv-ach-icon img,
  .sv-ach-icon {
      width: 64px !important;
      height: 64px !important;
      min-width: 64px !important;
      max-width: 64px !important;
      object-fit: cover !important;
      flex: 0 0 64px !important; /* ESSE É O SEGREDO DO FLEXBOX */
      border-radius: 6px !important;
      margin-right: 15px !important;
      display: block !important;
  }
  /* ======================================= */

  .sv-ach-info { flex: 1; overflow: hidden; display: flex; flex-direction: column; justify-content: center; }
  .sv-ach-title { font-weight: bold; color: #fff; font-size: 13px; margin-bottom: 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sv-ach-desc { color: #8f98a0; font-size: 11px; line-height:1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .sv-ach-xp { font-size: 10px; color: #FFD700; font-weight: bold; margin-top: 5px; border: 1px solid #FFD700; display: inline-block; padding: 2px 6px; border-radius: 4px; width: fit-content; }

  /* TOAST DE CONQUISTA */
  #sv-ach-toast {
      position: fixed; bottom: 20px; right: -400px; width: 320px;
      background: #171a21; border-left: 4px solid #FFD700;
      padding: 15px; display: flex; align-items: center; gap: 15px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.8); z-index: 2147483650;
      transition: right 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border-radius: 4px; pointer-events: none;
  }
  #sv-ach-toast.show { right: 20px; }
  .sv-toast-icon { font-size: 30px; animation: sv-bounce 1s infinite; display: flex; align-items: center; }
  .sv-toast-text { color: #fff; font-weight: bold; font-size: 14px; }
  .sv-toast-sub { color: #FFD700; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  @keyframes sv-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

  /* BOTÃO FLUTUANTE */
  #sv-float-dl-btn { position: fixed; bottom: 25px; right: 100px; background: linear-gradient(90deg, #a4d007 0%, #46bd14 100%); color: #fff; padding: 14px 28px; border-radius: 40px; font-family: 'Segoe UI', sans-serif; font-weight: 800; font-size: 14px; box-shadow: 0 0 20px rgba(164, 208, 7, 0.4); cursor: pointer; z-index: 2147483645; display: none; align-items: center; gap: 12px; transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.2s ease, box-shadow 0.2s ease; border: 2px solid rgba(255,255,255,0.1); letter-spacing: 0.5px; }
  #sv-float-dl-btn.pushed-up { bottom: 140px !important; }
  #sv-float-dl-btn:hover { transform: scale(1.05) translateY(-2px); box-shadow: 0 10px 30px rgba(164, 208, 7, 0.6); background: #b8e60d; }
  #sv-float-dl-btn.install-mode { background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%) !important; box-shadow: 0 0 20px rgba(106, 17, 203, 0.5) !important; }
  #sv-float-dl-btn.install-mode:hover { background: #7b2dd6 !important; }
  #sv-float-dl-btn svg { width: 24px; height: 24px; fill: white; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }

  /* BARRA PRINCIPAL */
  #sv-download-bar { position: fixed; bottom: -140px; left: 0; width: 100%; height: 110px; background: #0f1115; border-top: 1px solid #a4d007; z-index: 2147483647 !important; display: flex; align-items: center; transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1); padding: 0; box-shadow: 0 -10px 50px rgba(0,0,0,1); overflow: visible !important; }
  #sv-download-bar.visible { bottom: 0; }

  /* CSS DAS ABAS */
  #sv-dl-tabs {
    position: absolute;
    top: -29px; 
    left: 0;
    display: flex;
    gap: 4px;
    z-index: 2147483640;
    padding-left: 20px;
    align-items: flex-end; 
  }
  .sv-dl-tab {
    background: #171a21; 
    color: #8f98a0;
    padding: 6px 15px 4px 15px; 
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    font-size: 11px;
    font-weight: bold;
    cursor: pointer;
    border: 1px solid #333;
    border-bottom: 1px solid #a4d007; 
    max-width: 150px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.2s;
    opacity: 0.7;
    height: 28px; 
    box-sizing: border-box;
  }
  .sv-dl-tab.active {
    background: #0f1115; 
    color: #a4d007;
    border-color: #a4d007;
    border-bottom: 1px solid #0f1115; 
    z-index: 2147483650; 
    opacity: 1;
    padding-bottom: 5px;
    height: 30px; 
    margin-bottom: -1px; 
    box-shadow: 0 -2px 10px rgba(0,0,0,0.5);
  }
  .sv-dl-tab:hover {
    color: #fff;
    background: #282c34;
    opacity: 1;
  }

  /* LEGENDA */
  #sv-dl-legend { position: absolute; top: 5px; right: 30px; display: flex; gap: 20px; z-index: 2147483648 !important; pointer-events: none; font-family: 'Segoe UI', sans-serif; font-size: 11px; font-weight: 700; }
  .sv-legend-item { display: flex; align-items: center; gap: 8px; color: #ffffff !important; opacity: 1 !important; text-shadow: 0 0 4px #000, 0 0 2px #000; letter-spacing: 0.5px; }
  .sv-legend-line { width: 18px; height: 4px; border-radius: 2px; display:block; box-shadow: 0 0 5px rgba(0,0,0,0.5); }

  #sv-dl-graph-wrapper { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
  #sv-dl-canvas { width: 100%; height: 100%; display: block; }
  .sv-dl-content { position: relative; z-index: 2; display: flex; width: 100%; height: 100%; align-items: center; padding: 0 30px; background: linear-gradient(90deg, rgba(15,17,21,0.95) 0%, rgba(15,17,21,0.7) 40%, rgba(15,17,21,0.7) 60%, rgba(15,17,21,0.95) 100%); }
  .sv-dl-info { display: flex; flex-direction: column; flex: 1; margin-right: 40px; justify-content: center; }
  .sv-dl-title { color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 10px; }
  .sv-dl-progress-bg { width: 100%; height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; position: relative; margin-bottom: 10px; }
  .sv-dl-progress-bar { height: 100%; background: linear-gradient(90deg, #a4d007, #d4ff33); width: 0%; transition: width 0.3s ease; box-shadow: 0 0 15px rgba(164,208,7,0.6); }
  .sv-dl-stats { display: flex; gap: 25px; align-items: center; color: #ccc; font-size: 12px; font-family: 'Segoe UI', monospace; font-weight: 500; }
  .sv-stat-item { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.3); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }
  .sv-stat-icon { width: 16px; height: 16px; fill: #a4d007; }
  .sv-stat-val { color: #fff; font-weight: bold; }
  .sv-dl-controls { display: flex; gap: 15px; align-items: center; z-index: 10; pointer-events: auto; }
  .sv-btn-icon { border: none; width: 48px; height: 48px; border-radius: 12px; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: all 0.2s; background: rgba(40, 44, 52, 0.8); color: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
  .sv-btn-icon:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
  .sv-btn-icon svg { width: 28px; height: 28px; fill: currentColor; }
  .btn-files:hover { background: #fff; color: #1b2838; } .btn-pause:hover { background: #ffcc00; color: #000; } .btn-folder:hover { background: #00d9ff; color: #000; } .btn-stop:hover { background: #ff4d4d; color: #fff; }
  .sv-prio-btn.active { color: #ffcc00 !important; filter: drop-shadow(0 0 5px rgba(255, 204, 0, 0.8)); transform: scale(1.1); }
  
  /* MODAL */
  #sv-files-modal, #sv-mygames-modal, #sv-rd-modal, #sv-notices-modal, #sv-achievements-modal { position: fixed; bottom: 120px; right: 30px; width: 500px; max-height: 400px; background: #1b2838; border: 1px solid #46bd14; border-radius: 10px; display: none; flex-direction: column; z-index: 2147483647 !important; box-shadow: 0 20px 50px rgba(0,0,0,1); overflow: hidden; }
  #sv-mygames-modal, #sv-rd-modal, #sv-notices-modal, #sv-achievements-modal { top: 50%; left: 50%; transform: translate(-50%, -50%); width: 700px; height: 500px; bottom: auto; right: auto; max-height: none; }
  #sv-rd-modal { width: 500px; height: auto; min-height: 300px; border-color: #ffcc00; }
  .sv-modal-header { 
      color:#fff; 
      padding:15px; 
      border-bottom:1px solid #333; 
      display:flex; 
      justify-content:space-between; 
      background: #171a21; 
      cursor: move; /* Indica que é arrastável */
      user-select: none; /* Impede selecionar texto ao arrastar */
  }
  .sv-modal-body { overflow-y: auto; flex: 1; padding: 10px; }
  .sv-modal-body::-webkit-scrollbar { width: 8px; } .sv-modal-body::-webkit-scrollbar-track { background: #171a21; } .sv-modal-body::-webkit-scrollbar-thumb { background: #323f55; border-radius: 4px; } .sv-modal-body::-webkit-scrollbar-thumb:hover { background: #a4d007; }

  .sv-game-card { display: flex; align-items: center; background: #171a21; border: 1px solid #282c34; padding: 15px; margin-bottom: 10px; border-radius: 6px; transition: 0.2s; }
  .sv-game-card:hover { border-color: #a4d007; background: #1f232b; }
  .sv-game-info { flex: 1; margin-left: 15px; }
  .sv-game-title { color: #fff; font-weight: bold; font-size: 14px; margin-bottom: 5px; }
  .sv-game-path { color: #8f98a0; font-size: 11px; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 350px; }
  .sv-game-actions { display: flex; gap: 10px; }
  .sv-btn-small { padding: 8px 15px; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: 0.2s; }
  .btn-play { background: #a4d007; color: #1b2838; } .btn-play:hover { background: #b8e60d; }
  .btn-folder-small { background: #323f55; color: #fff; } .btn-folder-small:hover { background: #45526c; }
  
  #sv-toggle-tab { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 60px; height: 20px; background: #0f1115; border-top-left-radius: 10px; border-top-right-radius: 10px; border: 1px solid #a4d007; border-bottom: none; z-index: 2147483648; cursor: pointer; display: none; justify-content: center; align-items: center; box-shadow: 0 -5px 15px rgba(0,0,0,0.5); transition: bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
  #sv-toggle-tab.raised { bottom: 110px; } #sv-toggle-tab:hover { background: #a4d007; } #sv-toggle-tab svg { width: 20px; height: 20px; fill: #fff; transition: transform 0.3s; } #sv-toggle-tab.rotated svg { transform: rotate(180deg); }

  /* RD STYLES */
  .rd-input { width: 100%; background: #282c34; border: 1px solid #444; color: #fff; padding: 10px; border-radius: 4px; margin-bottom: 10px; box-sizing: border-box; }
  .rd-btn { background: #ffcc00; color: #000; padding: 10px 20px; border: none; font-weight: bold; cursor: pointer; border-radius: 4px; width: 100%; margin-top: 10px; }
  .rd-btn:hover { background: #e6b800; }
  .rd-status { font-size: 12px; margin-top: 10px; text-align: center; color: #8f98a0; }
  
  /* PROFILE GAMES */
  .sv-profile-game-card {
      background: #1f232b; 
      border-radius: 5px; 
      overflow: hidden; 
      transition: 0.2s; 
      cursor: pointer; 
      display: flex; 
      flex-direction: column;
      border: 1px solid transparent;
      height: fit-content;
  }
  .sv-profile-game-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 15px rgba(0,0,0,0.5);
      border-color: #a4d007;
  }
  .sv-profile-game-card img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
  }
  .sv-profile-game-card .game-title {
      padding: 10px;
      text-align: center;
      font-weight: bold;
      font-size: 12px;
      color: #fff;
      white-space: normal;
      overflow: visible;
      line-height: 1.3;
      height: auto;
  }

  /* CSS DOS AVISOS */
  #sv-notices-modal { width: 600px; height: 500px; border: 1px solid #a4d007; }
  .sv-notice-item { background: #171a21; border-left: 3px solid #333; margin-bottom: 10px; padding: 15px; border-radius: 4px; transition: 0.2s; position: relative; }
  .sv-notice-item.unread { border-left-color: #a4d007; background: #1f232b; }
  .sv-notice-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  .sv-notice-title { font-weight: bold; color: #fff; font-size: 14px; }
  .sv-notice-date { font-size: 11px; color: #8f98a0; }
  .sv-notice-body { font-size: 13px; color: #c7d5e0; line-height: 1.4; margin-top: 8px; }
  .sv-notice-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  .sv-notice-btn:hover { color: #fff; border-color: #fff; }
  .sv-notice-btn.del:hover { color: #ff4d4d; border-color: #ff4d4d; }

  /* PERFIL MODAL */
  #sv-profile-modal { 
      width: 800px; 
      height: 600px; 
      border: 1px solid #a4d007; 
      display: none; 
      flex-direction: column; 
      position: fixed; 
      top: 50%; 
      left: 50%; 
      transform: translate(-50%, -50%); 
      z-index: 10000; 
      background: #0f1115; 
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
  }
  .sv-profile-header { display: flex; align-items: center; padding: 20px; background: #121418; border-bottom: 1px solid #333; gap: 20px; }
  .sv-profile-avatar-wrapper { width: 80px; height: 80px; border-radius: 50%; border: 2px solid #a4d007; overflow: hidden; padding: 2px; }
  .sv-profile-avatar-wrapper img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
  .sv-profile-info { flex: 1; }
  .sv-profile-name { font-size: 20px; color: #fff; font-weight: bold; margin-bottom: 5px; }
  .sv-profile-id { font-size: 12px; color: #8f98a0; font-family: monospace; }
  .sv-profile-actions { margin-top: 10px; display: flex; gap: 10px; }
  
  .sv-profile-tabs { display: flex; background: #171a21; border-bottom: 1px solid #333; }
  .sv-profile-tab { flex: 1; padding: 15px; background: transparent; border: none; color: #8f98a0; font-weight: bold; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
  .sv-profile-tab:hover { color: #fff; background: #1f232b; }
  .sv-profile-tab.active { color: #a4d007; border-bottom-color: #a4d007; }

  .sv-profile-body { padding: 0; display:flex; flex-direction:column; flex:1; overflow: hidden; }
  .sv-profile-content { display: none; padding: 20px; overflow-y: auto; height: 100%; }
  .sv-profile-content.active { display: block; }

  /* ACHIEVEMENTS GRID */
  .sv-ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 10px; padding: 10px; }
  .sv-ach-item { width: 64px; height: 64px; background: #171a21; border: 1px solid #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; cursor: help; transition: 0.2s; }
  .sv-ach-item:hover { border-color: #a4d007; background: #1f232b; }
  .sv-ach-item img { width: 48px; height: 48px; object-fit: contain; }
  .sv-ach-item.locked { filter: grayscale(100%) opacity(0.5); }
  
  /* CONFIGURAÇÕES MODAL */
  #sv-settings-modal {
      width: 500px;
      height: 400px;
      border: 1px solid #a4d007;
      display: none;
      flex-direction: column;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      background: #0f1115;
      box-shadow: 0 0 20px rgba(0,0,0,0.8);
  }

  /* SETTINGS CSS */
  #sv-settings-modal { width: 500px; height: auto; min-height: 400px; border: 1px solid #a4d007; }
  .sv-settings-section { margin-bottom: 20px; }
  .sv-settings-title { color: #a4d007; font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
  .sv-settings-desc { color: #8f98a0; font-size: 12px; margin-bottom: 10px; }
  .sv-path-selector { display: flex; gap: 10px; }
  .sv-path-selector input { flex: 1; background: #0f1115; border: 1px solid #333; color: #ccc; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 11px; }
  .sv-path-selector button { background: #323f55; color: #fff; border: none; padding: 0 15px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold; }
  .sv-path-selector button:hover { background: #45526c; }
  .sv-settings-separator { height: 1px; background: #333; margin: 20px 0; }
  
  .sv-setting-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
  .sv-setting-label { display: flex; flex-direction: column; }
  .sv-setting-label span { color: #c7d5e0; font-size: 13px; font-weight: 500; }
  .sv-setting-label small { color: #666; font-size: 11px; }
  .sv-setting-row select { background: #0f1115; border: 1px solid #333; color: #fff; padding: 5px; border-radius: 4px; width: 140px; }

  /* TOOLTIP Z-INDEX SUPREMO */
  .sv-tooltip {
      position: absolute; pointer-events: none; z-index: 2147483647 !important;
      background: rgba(23, 26, 33, 0.98); border: 1px solid #a4d007;
      padding: 10px 15px; border-radius: 4px; max-width: 250px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.8);
      opacity: 0; transition: opacity 0.1s;
      display: none; top: 0; left: 0;
  }
  .sv-tooltip.visible { opacity: 1; display: block; }
  .sv-tooltip-title { color: #a4d007; font-weight: bold; font-size: 12px; margin-bottom: 3px; }
  .sv-tooltip-desc { color: #ccc; font-size: 11px; line-height: 1.3; }
`;

const LOADING_CSS = ` 
  #sv-launcher-loader { position: fixed; top: 32px; left: 0; width: 100%; height: calc(100% - 32px); background-color: rgba(27, 40, 56, 0.85); z-index: 2147483646; display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; display: none; } 
  #sv-launcher-loader.visible { opacity: 1; display: flex !important; pointer-events: auto; } 
  .sv-spinner { width: 50px; height: 50px; border: 4px solid rgba(255, 255, 255, 0.1); border-radius: 50%; border-top-color: #a4d007; animation: sv-spin 0.8s linear infinite; } 
  @keyframes sv-spin { to { transform: rotate(360deg); } } 
`;

module.exports = { TITLE_BAR_CSS, CUSTOM_UI_CSS, LOADING_CSS };
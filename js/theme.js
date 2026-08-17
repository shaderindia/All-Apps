(function() {
  const THEME_KEY = 'shader7_theme';
  const PWA_DISMISS_KEY = 'shader7_pwa_dismissed';
  
  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyTheme(theme) {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      if (document.body) {
        if (theme === 'dark') {
          document.body.classList.add('dark-theme');
          document.body.classList.remove('light-theme');
        } else {
          document.body.classList.add('light-theme');
          document.body.classList.remove('dark-theme');
        }
      }
    } catch (e) {}
    updateToggleButtonIcon(theme);
  }

  window.toggleShader7Theme = function() {
    const current = getStoredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {}
    applyTheme(next);
  };

  function updateToggleButtonIcon(theme) {
    try {
      const btns = document.querySelectorAll('.theme-toggle-btn');
      btns.forEach(function(btn) {
        const icon = btn.querySelector('i');
        if (icon) {
          if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            btn.setAttribute('title', 'Switch to Light Mode');
            btn.setAttribute('aria-label', 'Switch to Light Mode');
          } else {
            icon.className = 'fa-solid fa-moon';
            btn.setAttribute('title', 'Switch to Dark Mode');
            btn.setAttribute('aria-label', 'Switch to Dark Mode');
          }
        }
      });
    } catch (e) {}
  }

  // Handle URL previewOnly parameter for embedding ONLY clean resume paper previews
  if (window.location.search.includes('previewOnly')) {
    const injectPreviewStyle = function() {
      const style = document.createElement('style');
      style.id = 'preview-only-style-override';
      style.textContent = `
        header, .header-inner, section.intro, section.form-panel, .mobile-preview-button, 
        .resume-guide-section, footer, .controls-card, .font-picker-card, .top-bar, 
        .action-buttons, .form-section, .btn, nav, .ad-banner, ins.adsbygoogle,
        .pwa-floating-banner, #pwa-install-banner, #pwa-install-btn {
          display: none !important;
        }
        html, body {
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
        }
        .container, .builder-layout {
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          display: block !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .preview-panel {
          display: block !important;
          width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        #resumePreview, .resume-page, .resume-container {
          display: block !important;
          transform: scale(0.62) !important;
          transform-origin: top center !important;
          margin: 0 auto !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15) !important;
        }
      `;
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
      }
    };
    injectPreviewStyle();
  }

  // --- PWA Universal Installation Management ---
  window.deferredPwaPrompt = null;

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window.deferredPwaPrompt = e;
    showPwaInstallElements();
  });

  function showPwaInstallElements() {
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (isStandalone) return;

      const installBtns = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn');
      installBtns.forEach(btn => {
        btn.style.display = 'inline-flex';
      });

      const dismissedTime = localStorage.getItem(PWA_DISMISS_KEY);
      const isDismissed = dismissedTime && (Date.now() - parseInt(dismissedTime, 10)) < 7 * 24 * 60 * 60 * 1000;
      
      const banner = document.getElementById('pwa-install-banner');
      if (banner && !isDismissed) {
        banner.style.display = 'flex';
      }
    } catch (e) {}
  }

  // Auto-reveal install triggers on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showPwaInstallElements);
  } else {
    showPwaInstallElements();
  }

  window.triggerPwaInstall = async function() {
    // Provide immediate tactile click feedback on all clicked install buttons
    const activeBtns = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn');
    activeBtns.forEach(b => {
      b.style.transform = 'scale(0.95)';
      setTimeout(() => { b.style.transform = ''; }, 200);
    });

    if (window.deferredPwaPrompt) {
      try {
        window.deferredPwaPrompt.prompt();
        showPwaToast("Opening installation prompt in browser...");
        const { outcome } = await window.deferredPwaPrompt.userChoice;
        if (outcome === 'accepted') {
          showPwaToast("✓ SHADER7 App Installed Successfully!");
          window.dismissPwaBanner();
        }
        window.deferredPwaPrompt = null;
      } catch (err) {
        showUniversalInstallModal();
      }
    } else {
      showUniversalInstallModal();
    }
  };

  window.dismissPwaBanner = function() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.style.display = 'none';
    }
    try {
      localStorage.setItem(PWA_DISMISS_KEY, Date.now().toString());
    } catch (e) {}
  };

  function showPwaToast(msg) {
    const existing = document.querySelector('.pwa-toast-alert');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pwa-toast-alert';
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981;"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function showUniversalInstallModal() {
    const existing = document.getElementById('pwa-install-modal');
    if (existing) existing.remove();

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const isChromiumDesktop = !isIos && !isAndroid && (!!window.chrome || navigator.userAgent.includes("Edg"));

    let modalTitle = 'Install SHADER7 App';
    let instructionsHtml = '';

    if (isStandalone) {
      modalTitle = 'Already Installed';
      instructionsHtml = `
        <div style="text-align: center; padding: 1rem 0;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 1.75rem; margin-bottom: 1rem;">
            <i class="fa-solid fa-check"></i>
          </div>
          <p style="font-weight: 700; font-size: 1.05rem; margin-bottom: 0.5rem;">SHADER7 is already installed!</p>
          <p style="font-size: 0.9rem; color: var(--text-muted, #64748b);">You are currently running the suite in standalone application mode.</p>
        </div>
      `;
    } else if (isIos) {
      modalTitle = 'Install on iPhone & iPad';
      instructionsHtml = `
        <p style="font-size: 0.92rem; margin-bottom: 1.25rem; color: var(--text-muted, #64748b);">Add SHADER7 to your home screen for quick offline access:</p>
        <div style="background: rgba(125, 125, 125, 0.08); border-radius: 14px; padding: 1.1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 0.85rem;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">1</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Tap the <strong>Share button</strong> <i class="fa-solid fa-arrow-up-from-bracket" style="color: #0284c7;"></i> at the bottom of Safari.</div>
          </div>
          <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 0.85rem;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">2</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Scroll down and select <strong>Add to Home Screen</strong> <i class="fa-regular fa-square-plus" style="color: #059669;"></i>.</div>
          </div>
          <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">3</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Tap <strong>Add</strong> in the top-right corner.</div>
          </div>
        </div>
      `;
    } else if (isAndroid) {
      modalTitle = 'Install on Android';
      instructionsHtml = `
        <p style="font-size: 0.92rem; margin-bottom: 1.25rem; color: var(--text-muted, #64748b);">Install SHADER7 to your home screen:</p>
        <div style="background: rgba(125, 125, 125, 0.08); border-radius: 14px; padding: 1.1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 0.85rem;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #1d4ed8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">1</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Tap the <strong>three dots menu (⋮)</strong> at the top right of your browser.</div>
          </div>
          <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">2</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</div>
          </div>
        </div>
      `;
    } else {
      modalTitle = 'Install Desktop App';
      instructionsHtml = `
        <p style="font-size: 0.92rem; margin-bottom: 1.25rem; color: var(--text-muted, #64748b);">Install SHADER7 directly to your computer as a standalone desktop app:</p>
        <div style="background: rgba(125, 125, 125, 0.08); border-radius: 14px; padding: 1.1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 0.85rem;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #1d4ed8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">1</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Look at the <strong>right side of your browser address bar</strong> (URL bar at the top).</div>
          </div>
          <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 0.85rem;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">2</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Click the <strong>Install App icon</strong> <i class="fa-solid fa-desktop" style="color: #059669;"></i> or <i class="fa-solid fa-download" style="color: #1d4ed8;"></i>.</div>
          </div>
          <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">3</div>
            <div style="font-size: 0.9rem; line-height: 1.4;">Click <strong>Install</strong> to add SHADER7 to your desktop and taskbar.</div>
          </div>
        </div>
      `;
    }

    const modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.className = 'pwa-modal-backdrop';
    modal.innerHTML = `
      <div class="pwa-modal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #1d4ed8, #7c3aed); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
              <i class="fa-solid fa-shapes"></i>
            </div>
            <h3 style="font-weight: 800; font-size: 1.15rem; margin: 0;">${modalTitle}</h3>
          </div>
          <button onclick="document.getElementById('pwa-install-modal').remove()" style="background: none; border: none; font-size: 1.4rem; cursor: pointer; color: inherit; line-height: 1; padding: 0.3rem;" aria-label="Close">&times;</button>
        </div>
        ${instructionsHtml}
        <button onclick="document.getElementById('pwa-install-modal').remove()" style="width: 100%; padding: 0.8rem; border-radius: 99px; background: linear-gradient(135deg, #1d4ed8, #1e40af); color: white; border: none; font-weight: 700; font-size: 0.92rem; cursor: pointer; transition: transform 0.2s;">Got It</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    });
  }

  // Inject PWA styling
  const pwaStyle = document.createElement('style');
  pwaStyle.textContent = `
    .pwa-toast-alert {
      position: fixed;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      padding: 0.85rem 1.75rem;
      border-radius: 99px;
      font-size: 0.92rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      box-shadow: 0 15px 35px rgba(0,0,0,0.35);
      z-index: 100002;
      transition: opacity 0.3s ease;
      max-width: 90vw;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.15);
      animation: pwaToastPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pwaToastPop {
      from { transform: translate(-50%, -20px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    .pwa-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      animation: pwaFadeIn 0.2s ease-out;
    }
    @keyframes pwaFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .pwa-modal-card {
      background: var(--bg-card, #ffffff);
      color: var(--text-main, #0f172a);
      border-radius: 22px;
      padding: 1.75rem;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 50px rgba(0,0,0,0.35);
      border: 1px solid var(--border, rgba(0,0,0,0.1));
      animation: pwaModalPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pwaModalPop {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .pwa-floating-banner {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background: var(--bg-card, #ffffff);
      color: var(--text-main, #0f172a);
      border: 1px solid var(--border, rgba(0,0,0,0.1));
      border-radius: 18px;
      padding: 1rem 1.25rem;
      box-shadow: 0 15px 35px rgba(0,0,0,0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      max-width: 440px;
      animation: pwaSlideUp 0.3s ease-out;
    }
    @keyframes pwaSlideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (max-width: 600px) {
      .pwa-floating-banner {
        left: 0.75rem;
        right: 0.75rem;
        bottom: 0.75rem;
        padding: 0.75rem 0.9rem;
        gap: 0.75rem;
        max-width: none;
      }
      .pwa-app-icon {
        width: 36px;
        height: 36px;
        font-size: 1rem;
      }
      .pwa-title {
        font-size: 0.85rem;
      }
      .pwa-desc {
        font-size: 0.72rem;
      }
      .pwa-btn-install {
        padding: 0.45rem 0.8rem;
        font-size: 0.76rem;
      }
    }
    .pwa-banner-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .pwa-app-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #1d4ed8, #7c3aed);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .pwa-title {
      font-weight: 800;
      font-size: 0.92rem;
      line-height: 1.2;
      margin-bottom: 0.15rem;
    }
    .pwa-desc {
      font-size: 0.78rem;
      color: var(--text-muted, #64748b);
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pwa-banner-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .pwa-btn-install {
      background: linear-gradient(135deg, #1d4ed8, #1e40af);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 99px;
      font-weight: 700;
      font-size: 0.82rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: transform 0.2s;
      white-space: nowrap;
    }
    .pwa-btn-install:hover { transform: scale(1.04); }
    .pwa-btn-dismiss {
      background: transparent;
      border: none;
      color: var(--text-muted, #64748b);
      font-size: 1.3rem;
      cursor: pointer;
      padding: 0.2rem;
      line-height: 1;
    }
  `;
  document.head.appendChild(pwaStyle);

  // Sync theme changes across tabs
  try {
    window.addEventListener('storage', function(e) {
      if (e.key === THEME_KEY) {
        applyTheme(e.newValue || 'light');
      }
    });
  } catch (e) {}

  // Apply default theme immediately before body render
  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', function() {
    applyTheme(getStoredTheme());
    showPwaInstallElements();
  });
})();

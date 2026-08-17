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

  window.triggerPwaInstall = async function() {
    if (window.deferredPwaPrompt) {
      window.deferredPwaPrompt.prompt();
      const { outcome } = await window.deferredPwaPrompt.userChoice;
      if (outcome === 'accepted') {
        window.dismissPwaBanner();
      }
      window.deferredPwaPrompt = null;
    } else {
      // Check for iOS Safari
      const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

      if (isStandalone) {
        showPwaToast("App is already installed on your device!");
      } else if (isIos) {
        showIosInstallModal();
      } else {
        showPwaToast("To install, click the browser menu (⋮) and select 'Install app' or 'Add to Home screen'.");
      }
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
    const toast = document.createElement('div');
    toast.className = 'pwa-toast-alert';
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function showIosInstallModal() {
    const existing = document.getElementById('pwa-ios-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'pwa-ios-modal';
    modal.className = 'pwa-ios-modal-backdrop';
    modal.innerHTML = `
      <div class="pwa-ios-modal-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-weight: 800; font-size: 1.15rem; margin: 0;"><i class="fa-brands fa-apple"></i> Install on iOS</h3>
          <button onclick="document.getElementById('pwa-ios-modal').remove()" style="background: none; border: none; font-size: 1.3rem; cursor: pointer; color: inherit;">&times;</button>
        </div>
        <p style="font-size: 0.9rem; margin-bottom: 1.25rem; opacity: 0.85;">Install SHADER7 Suite to your iPhone or iPad home screen:</p>
        <ol style="font-size: 0.88rem; padding-left: 1.25rem; line-height: 1.8; margin-bottom: 1.5rem;">
          <li>Tap the <strong>Share</strong> button <i class="fa-solid fa-arrow-up-from-bracket" style="color: #0284c7;"></i> at the bottom of Safari.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong> <i class="fa-regular fa-square-plus" style="color: #059669;"></i>.</li>
          <li>Tap <strong>Add</strong> in the top-right corner.</li>
        </ol>
        <button onclick="document.getElementById('pwa-ios-modal').remove()" style="width: 100%; padding: 0.75rem; border-radius: 99px; background: #1d4ed8; color: white; border: none; font-weight: 700; cursor: pointer;">Got It</button>
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
      bottom: 2rem;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      color: #f8fafc;
      padding: 0.85rem 1.5rem;
      border-radius: 99px;
      font-size: 0.9rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      transition: opacity 0.3s ease;
      max-width: 90vw;
      text-align: center;
    }
    .pwa-ios-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .pwa-ios-modal-card {
      background: var(--bg-card, #ffffff);
      color: var(--text-main, #0f172a);
      border-radius: 20px;
      padding: 1.75rem;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      border: 1px solid var(--border, rgba(0,0,0,0.1));
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
        left: 1rem;
        right: 1rem;
        bottom: 1rem;
        max-width: none;
      }
    }
    .pwa-banner-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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

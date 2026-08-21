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

  // --- PWA Universal Installation Engine ---
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

      const installBtns = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn, .pwa-btn-install');
      installBtns.forEach(btn => {
        btn.style.display = 'inline-flex';
        // Attach direct non-bubbling listener to bypass third-party ad click interceptors
        if (!btn.dataset.pwaBound) {
          btn.dataset.pwaBound = 'true';
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            window.triggerPwaInstall(e);
          }, true);
        }
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

  window.triggerPwaInstall = function(event) {
    if (event) {
      try {
        event.stopPropagation();
        event.preventDefault();
      } catch (e) {}
    }

    // Physical haptic vibration feedback if supported
    try {
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    } catch (e) {}

    // Tactile button bounce feedback on all install buttons
    const activeBtns = document.querySelectorAll('#pwa-install-btn, .pwa-install-btn, .pwa-btn-install');
    activeBtns.forEach(b => {
      b.style.transform = 'scale(0.92)';
      setTimeout(() => { b.style.transform = ''; }, 200);
    });

    let promptTriggered = false;

    if (window.deferredPwaPrompt) {
      try {
        window.deferredPwaPrompt.prompt();
        promptTriggered = true;
        showPwaToast("Opening browser install prompt in address bar / screen...");
        
        // Handle user choice asynchronously
        const currentPrompt = window.deferredPwaPrompt;
        currentPrompt.userChoice.then(function(choiceResult) {
          if (choiceResult && choiceResult.outcome === 'accepted') {
            showPwaToast("✓ SHADER7 App Installed Successfully!");
            window.dismissPwaBanner();
            const existing = document.getElementById('pwa-install-modal');
            if (existing) existing.remove();
          }
          window.deferredPwaPrompt = null;
        }).catch(function() {});
      } catch (err) {
        console.warn("PWA prompt invocation error:", err);
        promptTriggered = false;
      }
    }

    // If native prompt was not triggered (or on iOS/Firefox/Brave), show clear step-by-step modal
    if (!promptTriggered) {
      showUniversalInstallModal(false);
    }
  };

  window.dismissPwaBanner = function(e) {
    if (e) e.stopPropagation?.();
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
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 1.15rem;"></i> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  function showUniversalInstallModal(isPromptOpened) {
    const existing = document.getElementById('pwa-install-modal');
    if (existing) existing.remove();

    // Comprehensive device detection including modern iPadOS
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isStandalone) {
      showPwaToast("✓ SHADER7 is already running in standalone installed mode!");
    } else if (isIos) {
      showPwaToast("iOS: Tap Share (⎙) -> 'Add to Home Screen'");
    } else if (isPromptOpened) {
      showPwaToast("Browser install prompt opened on screen!");
    }

    const defaultTab = isIos ? 'ios' : (isAndroid ? 'android' : 'pc');

    const modal = document.createElement('div');
    modal.id = 'pwa-install-modal';
    modal.className = 'pwa-modal-backdrop';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="pwa-modal-card" onclick="event.stopPropagation()">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #1d4ed8, #7c3aed); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; box-shadow: 0 4px 14px rgba(29, 78, 216, 0.35); flex-shrink: 0;">
              <i class="fa-solid fa-shapes"></i>
            </div>
            <div>
              <h3 style="font-weight: 900; font-size: 1.25rem; margin: 0; color: inherit; line-height: 1.2;">Install SHADER7 App</h3>
              <span style="font-size: 0.76rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">100% Free • Works Offline</span>
            </div>
          </div>
          <button onclick="document.getElementById('pwa-install-modal').remove()" style="background: rgba(125,125,125,0.1); border: none; font-size: 1.4rem; cursor: pointer; color: inherit; line-height: 1; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s;" aria-label="Close">&times;</button>
        </div>

        <!-- OS Selector Tabs -->
        <div class="pwa-tabs-bar" style="display: flex; gap: 6px; background: rgba(125,125,125,0.1); padding: 4px; border-radius: 12px; margin-bottom: 1.25rem;">
          <button id="pwa-tab-btn-ios" onclick="window.switchPwaTab('ios')" class="pwa-tab-btn ${defaultTab === 'ios' ? 'active' : ''}">
            <i class="fa-brands fa-apple"></i> iOS (iPhone/iPad)
          </button>
          <button id="pwa-tab-btn-android" onclick="window.switchPwaTab('android')" class="pwa-tab-btn ${defaultTab === 'android' ? 'active' : ''}">
            <i class="fa-brands fa-android"></i> Android
          </button>
          <button id="pwa-tab-btn-pc" onclick="window.switchPwaTab('pc')" class="pwa-tab-btn ${defaultTab === 'pc' ? 'active' : ''}">
            <i class="fa-solid fa-laptop"></i> PC / Mac
          </button>
        </div>

        <!-- Tab 1: iOS (iPhone & iPad) Step-by-Step -->
        <div id="pwa-tab-content-ios" class="pwa-tab-content ${defaultTab === 'ios' ? 'active' : ''}" style="${defaultTab === 'ios' ? 'display: block;' : 'display: none;'}">
          <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.25); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.65rem; color: #0369a1; font-size: 0.88rem; font-weight: 700;">
            <i class="fa-brands fa-apple" style="font-size: 1.35rem; color: #0284c7; flex-shrink: 0;"></i>
            <span>Install on iOS without App Store in 3 simple steps:</span>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.1rem; margin-bottom: 1.15rem;">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #0284c7; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">1</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                In <strong>Safari</strong>, tap the <strong>Share icon</strong> <i class="fa-solid fa-arrow-up-from-bracket" style="color: #0284c7; font-size: 1.05rem; margin: 0 0.25rem;"></i> on the bottom toolbar (or top on iPad).
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">2</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Scroll down the menu and tap <strong>Add to Home Screen</strong> <i class="fa-regular fa-square-plus" style="color: #059669; font-size: 1.05rem; margin: 0 0.25rem;"></i>.
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">3</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Tap <strong>Add</strong> in the top-right corner. The app icon will appear instantly on your home screen!
              </div>
            </div>
          </div>

          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 0.65rem 0.85rem; font-size: 0.82rem; color: #b45309; line-height: 1.4; display: flex; gap: 0.5rem; align-items: center;">
            <i class="fa-solid fa-lightbulb" style="font-size: 0.95rem; color: #d97706; flex-shrink: 0;"></i>
            <span><strong>Tip:</strong> If viewing inside Chrome or Instagram, tap Share <i class="fa-solid fa-arrow-up-from-bracket"></i> or open in Safari for native home screen install.</span>
          </div>
        </div>

        <!-- Tab 2: Android Step-by-Step -->
        <div id="pwa-tab-content-android" class="pwa-tab-content ${defaultTab === 'android' ? 'active' : ''}" style="${defaultTab === 'android' ? 'display: block;' : 'display: none;'}">
          ${isPromptOpened ? `
            <div style="background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.65rem; color: #065f46; font-size: 0.88rem; font-weight: 700;">
              <i class="fa-solid fa-circle-check" style="font-size: 1.25rem; color: #10b981; flex-shrink: 0;"></i>
              <span>Install dialog opened! Tap <strong>"Install"</strong> or <strong>"Add"</strong> on your screen.</span>
            </div>
          ` : `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.65rem; color: #047857; font-size: 0.88rem; font-weight: 700;">
              <i class="fa-brands fa-android" style="font-size: 1.35rem; color: #10b981; flex-shrink: 0;"></i>
              <span>Install to Android Home Screen for fast standalone app mode:</span>
            </div>
          `}

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.1rem; margin-bottom: 1.15rem;">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #1d4ed8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">1</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Tap the <strong>three dots menu (⋮)</strong> at the top right of Chrome (or bottom bar in Samsung Internet).
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">2</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong> <i class="fa-solid fa-mobile-screen" style="color: #059669; font-size: 1rem; margin: 0 0.2rem;"></i>.
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">3</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Confirm by tapping <strong>Install</strong>.
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Desktop PC / Mac Step-by-Step -->
        <div id="pwa-tab-content-pc" class="pwa-tab-content ${defaultTab === 'pc' ? 'active' : ''}" style="${defaultTab === 'pc' ? 'display: block;' : 'display: none;'}">
          ${isPromptOpened ? `
            <div style="background: rgba(16, 185, 129, 0.14); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.65rem; color: #065f46; font-size: 0.88rem; font-weight: 700;">
              <i class="fa-solid fa-circle-check" style="font-size: 1.25rem; color: #10b981; flex-shrink: 0;"></i>
              <span>Address bar prompt opened! Click <strong>Install</strong> to complete.</span>
            </div>
          ` : `
            <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.15rem; display: flex; align-items: center; gap: 0.65rem; color: #1e40af; font-size: 0.88rem; font-weight: 700;">
              <i class="fa-solid fa-laptop-code" style="font-size: 1.25rem; color: #3b82f6; flex-shrink: 0;"></i>
              <span>Install SHADER7 as a native Windows / Mac desktop app:</span>
            </div>
          `}

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.1rem; margin-bottom: 1.15rem;">
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #1d4ed8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">1</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Look at the <strong>right side of your URL address bar</strong> at the top.
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start; margin-bottom: 1rem;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">2</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Click the <strong>Install icon</strong> <i class="fa-solid fa-download" style="color: #1d4ed8; font-size: 1rem; margin: 0 0.2rem;"></i> or <i class="fa-solid fa-desktop" style="color: #059669; font-size: 1rem; margin: 0 0.2rem;"></i>, or click browser menu (⋮) &rarr; <strong>"Cast, save and share"</strong> / <strong>"Install SHADER7"</strong>.
              </div>
            </div>
            <div style="display: flex; gap: 0.85rem; align-items: flex-start;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #7c3aed; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">3</div>
              <div style="font-size: 0.92rem; line-height: 1.45; color: #1e293b;">
                Click <strong>Install</strong> in the dialog to open in full screen.
              </div>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
          <button onclick="document.getElementById('pwa-install-modal').remove()" style="flex: 1; padding: 0.85rem; border-radius: 99px; background: linear-gradient(135deg, #1d4ed8, #1e40af); color: white; border: none; font-weight: 800; font-size: 0.95rem; cursor: pointer; box-shadow: 0 6px 18px rgba(29, 78, 216, 0.4); transition: transform 0.15s ease;" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">Got It</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Global Tab Switcher for PWA Modal
  window.switchPwaTab = function(tabName) {
    const tabs = ['ios', 'android', 'pc'];
    tabs.forEach(t => {
      const btn = document.getElementById('pwa-tab-btn-' + t);
      const content = document.getElementById('pwa-tab-content-' + t);
      if (btn && content) {
        if (t === tabName) {
          btn.classList.add('active');
          content.style.display = 'block';
        } else {
          btn.classList.remove('active');
          content.style.display = 'none';
        }
      }
    });
  };

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    });
  }

  // Inject PWA styling with maximal z-index and explicit light/dark themes
  const pwaStyle = document.createElement('style');
  pwaStyle.textContent = `
    #pwa-install-btn, .pwa-install-btn, .pwa-btn-install {
      pointer-events: auto !important;
      cursor: pointer !important;
      position: relative !important;
      z-index: 1000 !important;
    }
    .pwa-toast-alert {
      position: fixed;
      top: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #f8fafc;
      padding: 0.85rem 1.75rem;
      border-radius: 99px;
      font-size: 0.92rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.65rem;
      box-shadow: 0 15px 35px rgba(0,0,0,0.45);
      z-index: 2147483647 !important;
      transition: opacity 0.3s ease;
      max-width: 90vw;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.2);
      animation: pwaToastPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes pwaToastPop {
      from { transform: translate(-50%, -20px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    .pwa-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 2147483647 !important;
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
      background: #ffffff;
      color: #0f172a;
      border-radius: 24px;
      padding: 1.85rem;
      max-width: 460px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      border: 1px solid rgba(0,0,0,0.1);
      animation: pwaModalPop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      font-family: 'Outfit', system-ui, -apple-system, sans-serif;
    }
    [data-theme="dark"] .pwa-modal-card {
      background: #111827;
      color: #f8fafc;
      border-color: rgba(255,255,255,0.15);
    }
    [data-theme="dark"] .pwa-modal-card h3 {
      color: #f8fafc !important;
    }
    [data-theme="dark"] .pwa-modal-card p {
      color: #94a3b8 !important;
    }
    [data-theme="dark"] .pwa-modal-card div[style*="background: #f8fafc"] {
      background: #1e293b !important;
      border-color: rgba(255,255,255,0.1) !important;
    }
    [data-theme="dark"] .pwa-modal-card div[style*="color: #1e293b"] {
      color: #f1f5f9 !important;
    }
    .pwa-tab-btn {
      flex: 1;
      padding: 0.55rem 0.35rem;
      border-radius: 9px;
      border: none;
      background: transparent;
      color: inherit;
      opacity: 0.7;
      font-weight: 700;
      font-size: 0.78rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      transition: all 0.2s ease;
      white-space: nowrap;
      font-family: inherit;
    }
    .pwa-tab-btn:hover {
      opacity: 0.95;
    }
    .pwa-tab-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      opacity: 1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
    }
    [data-theme="dark"] .pwa-tab-btn.active {
      background: #1e293b;
      color: #60a5fa;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
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

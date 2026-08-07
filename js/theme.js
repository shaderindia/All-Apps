(function() {
  const THEME_KEY = 'shader7_theme';
  
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
        .action-buttons, .form-section, .btn, nav, .ad-banner, ins.adsbygoogle {
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
  });
})();

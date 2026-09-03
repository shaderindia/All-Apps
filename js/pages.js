(() => {
  // Presentation pages always start light, independently of the webapps' preference.
  const root = document.documentElement;
  root.setAttribute('data-theme', 'light');

  window.toggleShader7Theme = () => {
    const dark = root.getAttribute('data-theme') !== 'dark';
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.querySelectorAll('.theme-toggle-btn').forEach(button => {
      button.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
      const icon = button.querySelector('i');
      if (icon) icon.className = `fa-solid fa-${dark ? 'sun' : 'moon'}`;
    });
  };

  const toc = document.querySelector('.article-toc');
  if (toc) {
    const desktop = window.matchMedia('(min-width: 981px)');
    const setToc = () => { toc.open = desktop.matches; };
    setToc();
    desktop.addEventListener('change', setToc);
  }

  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    document.querySelectorAll('.install-note').forEach(note => { note.hidden = true; });
  });
  window.triggerPwaInstall = async event => {
    event?.preventDefault();
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      return;
    }
    let dialog = document.querySelector('.install-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'install-dialog';
      dialog.setAttribute('aria-labelledby', 'install-title');
      dialog.innerHTML = '<h2 id="install-title">Keep Shader7 handy</h2><p>Open your browser menu and choose “Install app” or “Add to Home Screen” if available. On iPhone or iPad, open Safari, tap Share, then “Add to Home Screen”. You can also bookmark this page.</p><form method="dialog"><button class="btn-primary">Got it</button></form>';
      document.body.append(dialog);
    }
    dialog.showModal();
  };
})();

(() => {
  const dialog = document.getElementById('sampleDialog');
  if (!dialog) return;
  const select = document.getElementById('sampleTemplateSelect');
  const title = document.getElementById('sampleDialogTitle');
  const image = document.getElementById('sampleDialogImage');
  const imageScroll = document.getElementById('sampleImageScroll');
  const zoomButton = document.getElementById('sampleZoomButton');
  const useLink = document.getElementById('useSampleTemplate');
  const names = ['Classic photo CV', 'Blue two-column', 'Modern navy sidebar', 'Color header', 'Classic maroon', 'Europass-inspired'];
  let opener = null;

  function setZoom(zoomed) {
    imageScroll.classList.toggle('is-zoomed', zoomed);
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.textContent = zoomed ? 'Fit page' : 'Zoom to 100%';
    imageScroll.scrollTo(0, 0);
  }

  function showTemplate(value) {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > 6) return;
    select.value = String(id);
    title.textContent = `Template ${id}: ${names[id - 1]}`;
    image.src = `previews/template${id}.png`;
    image.alt = `Actual built-in sample resume for Template ${id}: ${names[id - 1]}`;
    useLink.href = `template${id}/index.html`;
    useLink.setAttribute('aria-label', `Use Template ${id}: ${names[id - 1]}`);
    imageScroll.scrollTo(0, 0);
  }

  document.querySelectorAll('[data-preview]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      setZoom(false);
      showTemplate(button.dataset.preview);
      dialog.showModal();
      document.getElementById('closeSampleDialog').focus();
    });
  });
  select.addEventListener('change', () => showTemplate(select.value));
  document.getElementById('previousSample').addEventListener('click', () => showTemplate((Number(select.value) + 4) % 6 + 1));
  document.getElementById('nextSample').addEventListener('click', () => showTemplate(Number(select.value) % 6 + 1));
  zoomButton.addEventListener('click', () => setZoom(!imageScroll.classList.contains('is-zoomed')));
  document.getElementById('closeSampleDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.target === select || imageScroll.classList.contains('is-zoomed')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const id = Number(select.value);
      showTemplate(event.key === 'ArrowLeft' ? (id + 4) % 6 + 1 : id % 6 + 1);
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
  const requested = new URLSearchParams(window.location.search).get('preview');
  if (/^[1-6]$/.test(requested || '')) {
    showTemplate(requested);
    dialog.showModal();
  }
})();

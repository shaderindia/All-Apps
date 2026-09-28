(() => {
  const dialog = document.getElementById('sampleDialog');
  if (!dialog) return;
  const select = document.getElementById('sampleTemplateSelect');
  const title = document.getElementById('sampleDialogTitle');
  const image = document.getElementById('sampleDialogImage');
  const useLink = document.getElementById('useSampleTemplate');
  const names = ['Classic photo CV', 'Blue two-column', 'Modern navy sidebar', 'Color header', 'Classic maroon', 'Europass-inspired'];
  let opener = null;

  function showTemplate(value) {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > 6) return;
    select.value = String(id);
    title.textContent = `Template ${id}: ${names[id - 1]}`;
    image.src = `previews/template${id}.png`;
    image.alt = `Actual built-in sample resume for Template ${id}: ${names[id - 1]}`;
    useLink.href = `template${id}/index.html`;
  }

  document.querySelectorAll('[data-preview]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      showTemplate(button.dataset.preview);
      dialog.showModal();
      document.getElementById('closeSampleDialog').focus();
    });
  });
  select.addEventListener('change', () => showTemplate(select.value));
  document.getElementById('previousSample').addEventListener('click', () => showTemplate((Number(select.value) + 4) % 6 + 1));
  document.getElementById('nextSample').addEventListener('click', () => showTemplate(Number(select.value) % 6 + 1));
  document.getElementById('closeSampleDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => opener?.focus());
  const requested = new URLSearchParams(window.location.search).get('preview');
  if (/^[1-6]$/.test(requested || '')) {
    showTemplate(requested);
    dialog.showModal();
  }
})();

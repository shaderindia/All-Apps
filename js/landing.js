(() => {
  const search = document.getElementById('app-search');
  const clear = document.getElementById('clear-search');
  const reset = document.getElementById('reset-filters');
  const count = document.getElementById('results-count');
  const empty = document.getElementById('empty-state');
  const message = document.getElementById('empty-message');
  const buttons = [...document.querySelectorAll('.filter-tab')];
  let category = 'all';

  // Match words in any order, including accents and punctuation such as "G-code".
  const normalize = (value) => value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();

  const cards = [...document.querySelectorAll('.tool-card')].map(element => {
    const text = normalize(`${element.textContent} ${element.dataset.keywords}`);
    return { element, category: element.dataset.category, text, words: text.split(/\s+/) };
  });

  function filter() {
    const query = search.value.trim();
    const normalized = normalize(query);
    const words = normalized ? normalized.split(/\s+/) : [];
    let visible = 0;

    cards.forEach(card => {
      const matches = (category === 'all' || category === card.category)
        // A single-letter term (e.g. the G in G-code) must match a full word.
        && words.every(word => word.length === 1 ? card.words.includes(word) : card.text.includes(word));
      card.element.hidden = !matches;
      if (matches) visible += 1;
    });

    const selected = buttons.find(button => button.dataset.category === category);
    const categoryText = category === 'all' ? '' : ` in ${selected.textContent.trim()}`;
    count.textContent = `${visible} ${visible === 1 ? 'tool' : 'tools'}${categoryText}${query ? ` for “${query}”` : ''}`;
    clear.hidden = !search.value;
    empty.hidden = visible !== 0;
    message.textContent = query
      ? `No tools match “${query}”${categoryText}. Try fewer words or show all tools.`
      : `There are no tools${categoryText}. Choose another category or show all tools.`;
  }

  function selectCategory(value) {
    category = value;
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.category === category));
    });
  }

  search.addEventListener('input', filter);
  search.addEventListener('search', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Escape' && search.value) {
      event.preventDefault();
      search.value = '';
      filter();
    }
  });
  clear.addEventListener('click', () => {
    search.value = '';
    search.focus();
    filter();
  });
  reset.addEventListener('click', () => {
    search.value = '';
    selectCategory('all');
    search.focus();
    filter();
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    selectCategory(button.dataset.category);
    filter();
  }));

  // Static cards and links remain usable if JavaScript is unavailable.
  document.getElementById('directory-controls').hidden = false;
  filter();
})();

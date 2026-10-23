(function () {
  'use strict';
  const cards = Array.from(document.querySelectorAll('[data-game]'));
  const search = document.getElementById('search');
  const filters = Array.from(document.querySelectorAll('[data-filter]'));
  const count = document.getElementById('game-count');
  const empty = document.getElementById('empty-state');
  const upcoming = document.getElementById('coming-soon');
  let activeFilter = 'all';
  function normalize(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function update() {
    const query = normalize(search.value);
    let visible = 0;
    for (const card of cards) {
      const matches = (!query || normalize(card.dataset.search).includes(query))
        && (activeFilter === 'all' || card.dataset.multiplayer === 'true');
      card.hidden = !matches;
      if (matches) visible++;
    }
    upcoming.hidden = !!query || activeFilter !== 'all';
    empty.hidden = visible !== 0;
    count.textContent = query || activeFilter !== 'all' ? `Zobrazeno: ${visible} z ${cards.length}` : `${cards.length} ${cards.length === 1 ? 'hra připravená' : cards.length < 5 ? 'hry připravené' : 'her připravených'} ke spuštění`;
  }
  for (const filter of filters) filter.addEventListener('click', () => {
    activeFilter = filter.dataset.filter;
    for (const button of filters) {
      const selected = button === filter;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    update();
  });
  search.addEventListener('input', update);
  document.getElementById('library-tools').hidden = false;
  update();
})();

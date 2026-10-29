(function () {
  'use strict';
  const messageElement = document.getElementById('portal-messages');
  // Keep cached Czech pages usable while their shared script is being updated.
  const messages = messageElement ? JSON.parse(messageElement.textContent) : {
    play: 'Hrát {title}', preview: 'Ukázka hry {title} s původní grafikou',
    ready_one: '{total} hra připravená ke spuštění', ready_few: '{total} hry připravené ke spuštění',
    ready_other: '{total} her připravených ke spuštění', shown: 'Zobrazeno: {visible} z {total}'
  };
  function text(key, values) { return messages[key].replace(/\{(\w+)\}/g, (_, name) => values[name]); }
  const cards = Array.from(document.querySelectorAll('[data-game]'));
  const featured = document.querySelector('.featured-game');
  if (featured && cards.length) {
    let index = Math.max(0, cards.findIndex(card => card.dataset.game === featured.dataset.featuredId));
    // Remember this tab's last pick so a refresh always advances to the next game.
    try {
      const previous = cards.findIndex(card => card.dataset.game === sessionStorage.getItem('atari800.featuredGame'));
      if (previous !== -1) index = (previous + 1) % cards.length;
      sessionStorage.setItem('atari800.featuredGame', cards[index].dataset.game);
    } catch (_) { /* The default game still works when browser storage is blocked. */ }
    const card = cards[index];
    const title = card.dataset.title;
    const href = card.querySelector('a').getAttribute('href');
    const action = document.getElementById('featured-action');
    featured.href = action.href = href;
    featured.dataset.featuredId = card.dataset.game;
    featured.setAttribute('aria-label', text('play', {title}));
    document.getElementById('featured-action-label').textContent = text('play', {title});
    document.getElementById('featured-title').textContent = title;
    document.getElementById('featured-position').textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    const image = featured.querySelector('.arena-image');
    image.src = card.querySelector('img').getAttribute('src');
    image.alt = text('preview', {title});
    const logo = featured.querySelector('.screen-logo img');
    logo.src = card.dataset.logo;
    logo.alt = title;
    const separator = document.createElement('b');
    separator.textContent = '·';
    document.getElementById('featured-details').replaceChildren(card.dataset.genre + ' ', separator, ' ' + card.dataset.players);
  }
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
    count.textContent = query || activeFilter !== 'all'
      ? text('shown', {visible, total: cards.length})
      : text(cards.length === 1 ? 'ready_one' : cards.length < 5 ? 'ready_few' : 'ready_other', {total: cards.length});
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

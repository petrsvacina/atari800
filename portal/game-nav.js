/* Portal navigation only; game language and mechanics are independent. */
(function () {
  'use strict';
  if (new URLSearchParams(location.search).get('lang') !== 'en') return;
  const back = document.querySelector('.portal-back');
  if (!back) return;
  back.href = '../../en/';
  back.textContent = '← ALL GAMES';
  back.lang = 'en';
  const home = document.querySelector('.brand');
  if (home?.getAttribute('href') === 'index.html') home.href = 'index.html?lang=en';
  const caption = back.parentElement.querySelector('small');
  if (caption) {
    caption.textContent = 'ATARI800 · WEB ARCADE';
    caption.lang = 'en';
  }
})();

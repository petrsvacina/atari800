import {Adventure} from './engine.mjs';
import {render} from './screen.mjs';
import {StoryMusic} from './audio.mjs';

const data = globalThis.NEVERENDING_DATA;
const $ = id => document.getElementById(id);
const storage = {
  get(key) { try { return localStorage.getItem('neverending-story-' + key); } catch { return null; } },
  set(key, value) { localStorage.setItem('neverending-story-' + key, value); }
};
const dictionary = {
  cs: {
    category: '1986 · GRAFICKÁ ADVENTURA', subtitle: 'Nekonečný příběh', travel: 'Kam dál?', actions: 'Rozhlédni se. Zeptej se. Objevuj.',
    help: 'Piš jednoduché příkazy. Diakritiku převedeme automaticky. Hra rozpoznává první tři písmena slov. Přepnutí CZ/EN zachová postup a změní i slovník příkazů.',
    examples: 'Například: s · sv · vezmi jidlo · o', prompt: 'Napiš příkaz…', input: 'Příkaz', send: 'Provést ↵',
    startTitle: 'Příběh čeká na tebe.', startText: 'Původní dobrodružství. Dva jazyky. Jedna rozehraná hra.', start: 'Začít příběh →',
    continue: 'Pokračovat →', pause: 'Stiskni mezerník nebo tlačítko pro pokračování.', pauseTitle: 'Příběh pokračuje…',
    new: '↺ Nová hra', save: '↓ Uložit', load: '↑ Načíst', soundOn: '♫ Zvuk zapnutý', soundOff: '♫ Zvuk vypnutý', fullscreen: '⛶ Celá obrazovka',
    up: '↑ Nahoru', down: '↓ Dolů', preview: 'HTML5 / JavaScript', switched: 'Jazyk změněn. Rozehraná hra pokračuje.',
    quick: [['Rozhlédnout', 'p'], ['Inventář', 'o'], ['Počkat', 'cekej']], dirs: ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ', 'nahoru', 'dolu'],
    saved: 'Hra uložena.', loaded: 'Hra načtena.', error: 'Operace se nezdařila.', noSave: 'Prázdná pozice', slots: 'Vyber pozici',
    confirm: 'Začít novou hru? Neuložený postup se ztratí.', quit: 'Opravdu ukončit příběh?', yes: 'Ano', no: 'Ne',
    ended: 'Konec příběhu', again: 'Hrát znovu →', musicError: 'Přehrávání hudby není dostupné.',
    audioNotice: 'Hudba se ještě připravuje.', manual: 'Návod (PDF) ↗', manualTitle: 'Český návod a mapy, 8 stran',
  },
  en: {
    category: '1986 · GRAPHIC ADVENTURE', subtitle: 'An adventure in Fantasia', travel: 'Where next?', actions: 'Look around. Ask. Discover.',
    help: 'Type simple commands. The game recognizes the first three letters of each word. Switching CZ/EN preserves your progress and also changes the command vocabulary.',
    examples: 'For example: n · ne · take food · i', prompt: 'Type a command…', input: 'Command', send: 'Enter ↵',
    startTitle: 'A story awaits you.', startText: 'The original adventure. Two languages. One saved journey.', start: 'Begin the story →',
    continue: 'Continue →', pause: 'Press Space or the button to continue.', pauseTitle: 'The story continues…',
    new: '↺ New game', save: '↓ Save', load: '↑ Load', soundOn: '♫ Sound on', soundOff: '♫ Sound off', fullscreen: '⛶ Fullscreen',
    up: '↑ Up', down: '↓ Down', preview: 'HTML5 / JavaScript', switched: 'Language changed. Your adventure continues.',
    quick: [['Look around', 'l'], ['Inventory', 'i'], ['Wait', 'wait']], dirs: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'up', 'down'],
    saved: 'Game saved.', loaded: 'Game loaded.', error: 'The operation failed.', noSave: 'Empty slot', slots: 'Choose a slot',
    confirm: 'Start a new game? Unsaved progress will be lost.', quit: 'Really quit the story?', yes: 'Yes', no: 'No',
    ended: 'The story ends', again: 'Play again →', musicError: 'Music playback is unavailable.', audioNotice: 'Music is being prepared.',
    manual: 'Walkthrough (CZ PDF) ↗', manualTitle: 'Czech walkthrough and maps, 8 pages',
  }
};
let language = new URL(location.href).searchParams.get('lang') || storage.get('language') || 'cs';
if (!(language in dictionary)) language = 'cs';
let busy = false, started = false, continuation = null, overlayMode = 'start', frame = 0;
let sound = storage.get('sound') !== 'off', wantsMusic = true;
const music = new StoryMusic(globalThis.NEVERENDING_AUDIO);
const t = key => dictionary[language][key];
function status(key) { $('status').textContent = t(key); }
function update() {
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    if (!game.state) return;
    render($('game'), data, game, language);
    $('chapter').textContent = ['I', 'II', 'III'][game.state.chapter] + ' / III';
    $('location').textContent = 'FANTASIA · ' + (language === 'cs' ? 'ČÁST ' : 'PART ') + (game.state.chapter + 1);
  });
}
function controls() {
  $('command').disabled = $('send').disabled = !started || busy || game.ended;
  $('save').disabled = !started || busy;
  $('new').disabled = busy;
  $('load').disabled = busy;
  for (const button of document.querySelectorAll('[data-direction],#quick button')) button.disabled = !started || busy || game.ended;
}
function overlay(mode, callback) {
  overlayMode = mode; continuation = callback;
  $('overlay').dataset.mode = mode;
  $('overlay').hidden = false;
  overlayText();
  if (mode !== 'start') $('continue').focus({preventScroll: true});
}
function overlayText() {
  $('overlay-title').textContent = t(overlayMode === 'start' ? 'startTitle' : overlayMode === 'ended' ? 'ended' : 'pauseTitle');
  $('overlay-text').textContent = t(overlayMode === 'start' ? 'startText' : 'pause');
  $('continue').textContent = t(overlayMode === 'start' ? 'start' : overlayMode === 'ended' ? 'again' : 'continue');
}
function resume() { const callback = continuation; continuation = null; $('overlay').hidden = true; callback?.(); }
async function playMusic() {
  music.setEnabled(sound);
  if (!wantsMusic) { music.stop(); return; }
  // Called after a user gesture; failure is visible and does not stop gameplay.
  try { await music.play(); } catch { status('musicError'); }
}
async function run(task) {
  if (busy) return;
  busy = true; controls();
  try {
    await task(); update();
    if (game.ended) overlay('ended', newGame);
    const last = game.events.filter(e => e[0] === 'music').at(-1);
    if (last && wantsMusic !== last[1]) { wantsMusic = last[1]; await playMusic(); }
  } catch (error) { console.error(error); status('error'); }
  finally { busy = false; controls(); }
}
async function chooseSlot(mode, snapshot) {
  const dialog = $('slots'); $('slots-title').textContent = t('slots'); $('slots-list').replaceChildren();
  return new Promise(resolve => {
    let result = null;
    for (let i = 1; i <= 8; i++) {
      let saved = null;
      try { saved = JSON.parse(storage.get('slot-' + i)); } catch { /* Empty or invalid slot. */ }
      if (saved?.game?.format !== 'neverending-story-native') saved = null;
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = String(i).padStart(2, '0') + ' · ' + (saved ? (language === 'cs' ? 'Část ' : 'Part ') + (saved.game.chapter + 1) : t('noSave'));
      if (saved) { const time = document.createElement('small'); time.textContent = new Date(saved.time).toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-GB'); button.append(time); }
      button.disabled = mode === 'load' && !saved;
      button.onclick = () => {
        try {
          if (mode === 'save') { storage.set('slot-' + i, JSON.stringify({time: Date.now(), game: snapshot})); status('saved'); }
          else { result = saved.game; }
          dialog.close();
        } catch (error) { console.error(error); status('error'); }
      };
      $('slots-list').append(button);
    }
    dialog.addEventListener('close', () => resolve(result), {once: true});
    dialog.showModal();
  });
}
const game = new Adventure(data.rules, {
  update,
  pause: () => new Promise(resolve => { update(); overlay('pause', resolve); }),
  confirm: async () => confirm(t('quit')),
  save: snapshot => chooseSlot('save', snapshot),
  load: () => chooseSlot('load'),
  music: enabled => {
    wantsMusic = enabled;
    if (enabled) void music.play(true).catch(() => status('musicError'));
    else music.stop();
  },
});
async function newGame() {
  $('overlay').hidden = true; started = true; wantsMusic = true;
  void playMusic();
  await run(() => game.start());
}
async function command(line) {
  if (busy || !started || game.ended) return;
  const normalized = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z ]/g, '');
  $('command').value = '';
  await run(() => game.command(normalized, data.languages[language].vocabulary));
}
function localize() {
  document.documentElement.lang = language;
  const portalHome = document.body.dataset.portalHome;
  $('back').href = portalHome ? portalHome + (language === 'en' ? 'en/' : '') : '../?lang=' + language;
  $('back').textContent = portalHome ? (language === 'en' ? '← All games' : '← Všechny hry') : '← Atari XL/XE';
  const labels = {category: 'category', subtitle: 'subtitle', 'travel-title': 'travel', 'actions-title': 'actions', help: 'help', examples: 'examples',
    send: 'send', new: 'new', save: 'save', load: 'load', manual: 'manual', fullscreen: 'fullscreen', up: 'up', down: 'down', preview: 'preview'};
  for (const [id, key] of Object.entries(labels)) $(id).textContent = t(key);
  $('manual').title = t('manualTitle');
  $('sound').textContent = t(sound ? 'soundOn' : 'soundOff'); $('sound').setAttribute('aria-pressed', String(sound));
  $('command').placeholder = t('prompt'); $('command').setAttribute('aria-label', t('input'));
  $('game').setAttribute('aria-label', language === 'cs' ? 'Herní obrazovka' : 'Game screen');
  const loadingArt = $('loading-art');
  if (loadingArt) loadingArt.alt = language === 'cs' ? 'Původní načítací obrazovka hry The NeverEnding Story' : 'Original Atari loading screen for The NeverEnding Story';
  for (const button of document.querySelectorAll('[data-lang]')) button.setAttribute('aria-pressed', String(button.dataset.lang === language));
  $('quick').replaceChildren();
  for (const [label, line] of t('quick')) {
    const button = document.createElement('button'); button.textContent = label; button.onclick = () => command(line); $('quick').append(button);
  }
  $('compass').replaceChildren();
  for (const direction of [8, 1, 2, 7, 0, 3, 6, 5, 4]) {
    if (!direction) { const center = document.createElement('span'); center.className = 'center'; center.textContent = '✧'; $('compass').append(center); continue; }
    const button = document.createElement('button'); button.dataset.direction = direction; button.textContent = t('dirs')[direction - 1];
    button.onclick = () => command(t('dirs')[direction - 1]); $('compass').append(button);
  }
  overlayText(); controls(); update();
}
for (const button of document.querySelectorAll('[data-lang]')) button.onclick = () => {
  language = button.dataset.lang;
  try { storage.set('language', language); } catch { /* Session-only preference. */ }
  const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);
  // No engine action or turn is generated by a language change.
  localize(); status('switched');
};
$('continue').onclick = () => { void playMusic(); resume(); };
$('command-form').onsubmit = event => { event.preventDefault(); void command($('command').value); };
$('up').onclick = () => command(t('dirs')[8]); $('down').onclick = () => command(t('dirs')[9]);
$('new').onclick = () => { if (!started || confirm(t('confirm'))) void newGame(); };
$('save').onclick = () => run(() => chooseSlot('save', game.snapshot()));
$('load').onclick = () => run(async () => {
  const saved = await chooseSlot('load');
  if (saved) { game.restore(saved); started = true; $('overlay').hidden = true; status('loaded'); }
});
$('sound').onclick = () => {
  sound = !sound; try { storage.set('sound', sound ? 'on' : 'off'); } catch { /* Session-only preference. */ }
  localize(); void playMusic();
};
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.machine').requestFullscreen(); }
  catch { status('error'); }
};
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !$('overlay').hidden && !$('slots').open && !['INPUT','TEXTAREA'].includes(event.target.tagName)) {
    event.preventDefault(); resume();
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) music.pause(); else if (started) music.resume(); });
localize(); overlay('start', newGame);

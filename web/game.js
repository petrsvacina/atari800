(function () {
  'use strict';
const I=globalThis.AtariI18n||{t:value=>value,html:value=>value,locale:'cs-CZ'};
  const $ = id => document.getElementById(id);
  const setText = (id, text) => { text=I.t(text); if ($(id).textContent !== text) $(id).textContent = I.t(text); };
  const assets = globalThis.DYNA_ASSETS;
  const { Game, W, H, TILE, FPS } = globalThis.DynakillersEngine;
  const canvas = $('game'), ctx = canvas.getContext('2d', { alpha: false });
  const names = ['HRÁČ 1', 'HRÁČ 2', 'HRÁČ 3'];
  const playerColors = ['#91cc92', '#edc279', '#b6a0e2'];
  const keys = new Set(), touch = new Set();
  const bindings = [
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', bomb: 'Space' },
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', bomb: 'KeyQ' },
    { left: 'KeyJ', right: 'KeyL', up: 'KeyI', down: 'KeyK', bomb: 'KeyU' },
  ];
  let game = new Game(assets), paused = false, previous = 0, accumulator = 0;
  let selectedArena = 0, lastPanel = '', overlayState = 'menu';
  let muted = false, audioMode = 'both';
  try {
    const saved = JSON.parse(localStorage.getItem('dynakillers-options') || 'null');
    if (saved) {
      if (['bot', '2', '3'].includes(saved.mode)) $('mode').value = saved.mode;
      if ([4, 8, 16, 32].includes(saved.rounds)) $('rounds').value = String(saved.rounds);
      selectedArena = Number.isInteger(saved.arena) ? Math.max(0, Math.min(7, saved.arena)) : 0;
      $('rotate').checked = saved.rotate !== false;
      muted = saved.muted === true;
      if (['both', 'music', 'samples'].includes(saved.audioMode)) audioMode = saved.audioMode;
    }
  } catch (_) { /* file:// storage can be unavailable in private browsing. */ }

  $('audio-mode').value = audioMode;
  const sound = new globalThis.DynakillersAudio(assets, { onStatus: message => setText('music-status', message) });
  function syncAudio() { sound.synchronize(game.state, paused || document.hidden, audioMode, muted); }

  // Approximation of the PAL hues. Pixels, maps and animation shapes come from the original.
  const hues = [[185, 185, 185], [195, 148, 65], [193, 112, 59], [183, 85, 70],
    [176, 78, 119], [149, 91, 167], [112, 100, 187], [81, 113, 182],
    [66, 131, 175], [63, 147, 153], [72, 156, 104], [106, 155, 83],
    [143, 151, 65], [164, 144, 64], [178, 133, 65], [187, 122, 67]];
  function atariColor(value) {
    const rgb = hues[value >> 4], lum = value & 15;
    const factor = .13 + lum / 11;
    return `rgb(${rgb.map(v => Math.min(255, Math.round(v * factor))).join(',')})`;
  }
  const tileCache = new Map();
  function tileImage(type, arena = 0, fire = false) {
    const key = `${type}/${arena}/${fire}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const tile = document.createElement('canvas'); tile.width = tile.height = 16;
    const c = tile.getContext('2d');
    const palette = ['#080909', ...assets.palettes[arena].map(atariColor)];
    if (fire) palette[3] = '#e8a64b';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      // A1EF: each 16×16 tile is TL, BL, TR, BR in the 4-colour character set.
      const character = type * 4 + (x >> 2) * 2 + (y >> 3);
      const byte = assets.font[character * 8 + (y & 7)];
      const color = byte >> (6 - (x & 3) * 2) & 3;
      c.fillStyle = palette[color]; c.fillRect(x * 2, y, 2, 1);
    }
    tileCache.set(key, tile); return tile;
  }
  function sprite(c, p, x, y, scale = 1) {
    const direction = p.direction || 0;
    const frame = p.moving ? Math.floor(p.animation / 8) % 3 : 0;
    const base = direction * 48;
    const shades = [null, playerColors[p.id], ['#376d42', '#856333', '#625481'][p.id], ['#bee1a7', '#ffe3a7', '#dfd0ff'][p.id]];
    for (let row = 0; row < 12; row++) {
      const offset = row < 6 ? base + row : base + 12 + frame * 12 + row - 6;
      const a = assets.sprites[offset], b = assets.sprites[offset + 6];
      for (let bit = 0; bit < 8; bit++) {
        const value = (a >> (7 - bit) & 1) | ((b >> (7 - bit) & 1) << 1);
        if (value) { c.fillStyle = shades[value]; c.fillRect(x + bit * 2 * scale, y + row * scale, 2 * scale, scale); }
      }
    }
  }
  function renderArena(c, terrain, arena, scale = 1) {
    c.imageSmoothingEnabled = false;
    for (let i = 0; i < 240; i++) c.drawImage(tileImage(terrain[i], arena), i % W * TILE * scale, Math.floor(i / W) * TILE * scale, TILE * scale, TILE * scale);
  }
  function preview() {
    const c = $('arena-preview').getContext('2d');
    c.fillStyle = '#101519'; c.fillRect(0, 0, 200, 120);
    const mask = assets.maps[selectedArena];
    for (let i = 0; i < 240; i++) if (mask[i]) {
      c.fillStyle = '#b69a69'; c.fillRect(i % 20 * 10 + 1, Math.floor(i / 20) * 10 + 1, 8, 8);
    }
    c.fillStyle = playerColors[0]; c.fillRect(2, 2, 6, 6);
    c.fillStyle = playerColors[1]; c.fillRect(192, 2, 6, 6);
    $('arena-number').textContent = I.t(`0${selectedArena + 1} / 08`);
    $('arena').value = selectedArena;
    if (game.state === 'menu') draw();
  }
  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.scale(2, 2);
    if (game.state === 'menu') {
      const terrain = assets.maps[selectedArena].map((c, i) => c ? 1 : ((i * 13 % 19) < 9 ? 2 : 0));
      renderArena(ctx, terrain, selectedArena);
    } else {
      renderArena(ctx, game.terrain, game.arena);
      for (const b of game.bombs) {
        const x = b.cell % 20 * 16, y = Math.floor(b.cell / 20) * 16;
        ctx.drawImage(tileImage(7, game.arena), x, y);
        ctx.fillStyle = b.fuse % 24 < 12 ? '#f5d68c' : '#b35837';
        ctx.fillRect(x + 8, y + 2, 2, 2);
      }
      for (const flame of game.flames) {
        const remaining = flame.until - game.tick, type = remaining > 10 ? 8 : remaining > 5 ? 9 : 10;
        for (const cell of flame.cells) ctx.drawImage(tileImage(type, game.arena, true), cell % 20 * 16, Math.floor(cell / 20) * 16);
      }
      for (const p of game.players) {
        if (!p.alive && game.tick - p.deathTick > 31) continue;
        ctx.globalAlpha = p.alive ? 1 : Math.max(0, 1 - (game.tick - p.deathTick) / 32);
        sprite(ctx, p, Math.round(p.x - 8), Math.round(p.y - 6));
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    $('countdown').hidden = game.state !== 'ready' || paused;
    if (game.state === 'ready') setText('countdown', game.countdown > 25 ? 'PŘIPRAV SE' : 'START!');
  }
  function label(id) { return I.t(game.options.bot && id === 1 ? 'POČÍTAČ' : names[id]); }
  function scores() {
    const players = game.state === 'menu' ? Array.from({ length: game.options.players }, (_, id) => ({ id, alive: true, bombs: 1, power: 3 })) : game.players;
    const signature = JSON.stringify([game.state === 'menu', players.map(p => [p.alive, p.bombs, p.power, p.effect]), game.scores, game.options.bot]);
    if (signature === lastPanel) return;
    lastPanel = signature;
    $('scoreboard').replaceChildren();
    for (const p of players) {
      const card = document.createElement('div'); card.className = 'score-card' + (p.alive ? '' : ' dead');
      const icon = document.createElement('canvas'); icon.width = 32; icon.height = 24;
      sprite(icon.getContext('2d'), { ...p, direction: 0 }, 0, 0, 2);
      const info = document.createElement('div'), name = document.createElement('span'), detail = document.createElement('small');
      name.className = 'name'; name.style.color = playerColors[p.id]; name.textContent = I.t(label(p.id));
      detail.textContent = I.t(!p.alive ? 'MIMO HRU' : p.effect !== undefined && p.effect !== null ? game.effectName(p) : `BOMBY ${p.bombs} · DOSAH ${p.power - 1}`);
      info.append(name, detail);
      const score = document.createElement('span'); score.className = 'score'; score.textContent = I.t(game.scores?.[p.id] || 0);
      card.append(icon, info, score); $('scoreboard').append(card);
    }
  }
  function showOverlay(kicker, title, text, button, hint = '') {
    $('overlay').hidden = false;
    $('overlay-kicker').textContent = I.t(kicker); $('overlay-title').textContent = I.t(title);
    $('overlay-text').textContent = I.t(text); $('play').replaceChildren(document.createTextNode(I.t(button) + '  ↵'));
    $('overlay-hint').textContent = I.t(hint);
  }
  function ui() {
    syncAudio();
    const state = paused ? 'paused' : game.state;
    $('music-preview').hidden = state !== 'menu';
    $('overlay-hint').hidden = state === 'menu';
    setText('music-preview', sound.titlePlaying ? 'Ⅱ Pozastavit titulní hudbu' : '♪ Přehrát titulní hudbu');
    $('music-preview').setAttribute('aria-pressed', String(sound.titlePlaying));
    if (overlayState !== state) {
      overlayState = state;
      $('overlay').hidden = ['playing', 'ready'].includes(state);
      if (state === 'paused') showOverlay('CHVÍLE NA NÁDECH', 'Hra je pozastavená.', 'Aréna počká. Vrať se, až budeš připravený.', 'POKRAČOVAT');
      if (state === 'roundOver') showOverlay(`KOLO ${game.round} / ${game.options.rounds}`, game.winner === null ? 'Nikdo nepřežil.' : `${label(game.winner)} vyhrává.`, game.winner === null ? 'Remíza. Bod tentokrát nezískává nikdo.' : 'Další aréna, další šance.', 'DALŠÍ KOLO');
      if (state === 'matchOver') {
        const max = Math.max(...game.scores), winners = game.scores.map((s, i) => s === max ? i : -1).filter(i => i >= 0);
        showOverlay('KONEC SOUBOJE', winners.length === 1 ? `${label(winners[0])} vítězí!` : 'Vyrovnaný souboj.', game.scores.map((s, i) => `${label(i)}: ${s}`).join('  ·  '), 'HRÁT ZNOVU', 'Novou sestavu nastavíš tlačítkem „Nová hra“.');
      }
    }
    const active = game.state !== 'menu' && game.state !== 'matchOver';
    $('settings').disabled = active;
    $('pause').disabled = !['playing', 'ready'].includes(game.state);
    $('pause').querySelector('span').textContent = I.t(paused ? 'Pokračovat' : 'Pauza');
    setText('screen-label', game.state === 'menu' ? 'PŘIPRAVEN K BOJI' : paused ? 'HRA POZASTAVENA' : game.state === 'playing' ? 'SOUBOJ PROBÍHÁ' : game.state === 'ready' ? 'ZA CHVÍLI ZAČÍNÁME' : 'KOLO UKONČENO');
    setText('round-label', game.state === 'menu' ? 'ATARI XL / XE → WEB' : `KOLO ${String(game.round).padStart(2, '0')} / ${String(game.options.rounds).padStart(2, '0')} · ARÉNA 0${game.arena + 1}`);
    setText('elapsed', `${String(Math.floor(game.tick / FPS / 60)).padStart(2, '0')}:${String(Math.floor(game.tick / FPS) % 60).padStart(2, '0')}`);
    const effect = game.players[0]?.effect;
    setText('game-status', game.state === 'menu' ? 'Vyber režim a vstup do arény.' : paused ? 'Stiskni P nebo Pokračovat.' : effect !== undefined && effect !== null ? `${game.effectName(game.players[0])} · ${Math.ceil((game.players[0].effectUntil - game.tick) / FPS)} s` : 'Výbuchy jsou nebezpečné pro všechny hráče.');
    scores();
  }
  function saveOptions() {
    try { localStorage.setItem('dynakillers-options', JSON.stringify({ mode: $('mode').value, rounds: +$('rounds').value, arena: selectedArena, rotate: $('rotate').checked, muted, audioMode })); } catch (_) {}
  }
  function start() {
    sound.init();
    keys.clear(); touch.clear(); accumulator = 0;
    if (paused) { paused = false; ui(); canvas.focus({ preventScroll: true }); return; }
    if (game.state === 'roundOver') game.nextRound();
    else {
      sound.restartGame();
      game = new Game(assets, { players: $('mode').value === '3' ? 3 : 2, bot: $('mode').value === 'bot', arena: selectedArena, rounds: +$('rounds').value, rotate: $('rotate').checked });
      game.start();
      globalThis.dynakillers = game;
      saveOptions();
    }
    ui(); canvas.focus({ preventScroll: true });
  }
  function pause() {
    if (!['playing', 'ready'].includes(game.state)) return;
    paused = !paused; keys.clear(); touch.clear(); accumulator = 0; ui();
    if (!paused) canvas.focus({ preventScroll: true });
  }
  function menu() {
    paused = false; keys.clear(); touch.clear();
    game = new Game(assets); overlayState = 'menu'; lastPanel = '';
    showOverlay('KLASIKA Z ATARI. NOVĚ V PROHLÍŽEČI.', 'Poslední přežije.', 'Proboř si cestu. Sbírej bonusy. A hlavně uteč před vlastní bombou.', 'SPUSTIT HRU', 'Nastav si souboj v panelu nastavení.');
    updateMode(); preview(); ui();
  }
  function mute() {
    muted = !muted; syncAudio(); updateSound(); saveOptions();
  }
  function updateSound() {
    $('sound').setAttribute('aria-pressed', String(muted));
    $('sound').querySelector('span').textContent = I.t(muted ? 'Zvuk vypnutý' : 'Zvuk zapnutý');
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('.arcade').requestFullscreen();
      canvas.focus({ preventScroll: true });
    } catch (_) { $('game-status').textContent = I.t('Prohlížeč nepovolil celou obrazovku.'); }
  }
  function inputs() {
    const result = bindings.map((map, id) => Object.fromEntries(Object.entries(map).map(([action, key]) => [action, keys.has(key) || (id === 0 && touch.has(action))])));
    let pads = [];
    try { pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean); } catch (_) {}
    for (let i = 0; i < Math.min(pads.length, result.length); i++) {
      const p = pads[i], r = result[i];
      r.left ||= p.axes[0] < -.35 || !!p.buttons[14]?.pressed;
      r.right ||= p.axes[0] > .35 || !!p.buttons[15]?.pressed;
      r.up ||= p.axes[1] < -.35 || !!p.buttons[12]?.pressed;
      r.down ||= p.axes[1] > .35 || !!p.buttons[13]?.pressed;
      r.bomb ||= !!p.buttons[0]?.pressed || !!p.buttons[1]?.pressed;
    }
    return result;
  }
  function frame(now) {
    const delta = Math.min(100, previous ? now - previous : 0); previous = now;
    if (!paused) {
      accumulator += delta;
      while (accumulator >= 1000 / FPS) { game.step(inputs()); accumulator -= 1000 / FPS; }
    }
    let exploded = false;
    for (const e of game.events.splice(0)) {
      if (e.type === 'explode' && !exploded) { sound.play([2, 4, 6][Math.floor(Math.random() * 3)]); exploded = true; }
      else if (e.type === 'pickup') sound.play(8);
      else if (e.type === 'random') sound.play(12);
      else if (e.type === 'ready') sound.play(10);
      else if (e.type === 'death') sound.play(14);
    }
    draw(); ui(); requestAnimationFrame(frame);
  }
  $('play').addEventListener('click', start);
  $('pause').addEventListener('click', pause);
  $('restart').addEventListener('click', menu);
  $('sound').addEventListener('click', () => {
    if (!sound.unlocked) { sound.init(); muted = false; syncAudio(); updateSound(); saveOptions(); }
    else mute();
    if (game.state !== 'menu') canvas.focus({ preventScroll: true });
  });
  $('music-preview').addEventListener('click', () => {
    if (audioMode === 'samples') { audioMode = 'both'; $('audio-mode').value = audioMode; }
    muted = false; sound.togglePreview(); syncAudio(); updateSound(); saveOptions();
  });
  $('audio-mode').addEventListener('change', () => {
    audioMode = $('audio-mode').value;
    sound.init(); syncAudio(); saveOptions();
    if (game.state !== 'menu') canvas.focus({ preventScroll: true });
  });
  $('fullscreen').addEventListener('click', fullscreen);
  $('arena-prev').addEventListener('click', () => { selectedArena = (selectedArena + 7) % 8; preview(); });
  $('arena-next').addEventListener('click', () => { selectedArena = (selectedArena + 1) % 8; preview(); });
  function updateMode() {
    document.querySelector('.third-control').hidden = $('mode').value !== '3';
    $('settings-note').textContent = I.t($('mode').value === 'bot' ? 'Režim proti počítači je doplněk webové verze.' : 'Lokální souboj. Všichni hráči hrají na tomto počítači.');
    if (game.state === 'menu') {
      game.options.players = $('mode').value === '3' ? 3 : 2;
      game.options.bot = $('mode').value === 'bot';
      scores();
    }
  }
  $('mode').addEventListener('change', updateMode);
  document.addEventListener('keydown', e => {
    if (e.target.matches('select,input') && !['Escape', 'KeyP'].includes(e.code)) return;
    if (e.target.matches('button,a') && !['Escape', 'KeyP', 'KeyM', 'KeyR', 'KeyF'].includes(e.code)) return;
    if (bindings.some(map => Object.values(map).includes(e.code))) { e.preventDefault(); keys.add(e.code); }
    if (e.repeat) return;
    if (e.code === 'Enter' && (game.state !== 'playing' && game.state !== 'ready' || paused)) { e.preventDefault(); start(); }
    if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); pause(); }
    if (e.code === 'KeyM') mute();
    if (e.code === 'KeyR') menu();
    if (e.code === 'KeyF') fullscreen();
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); touch.clear(); if (!paused && ['playing', 'ready'].includes(game.state)) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !paused && ['playing', 'ready'].includes(game.state)) pause(); syncAudio(); });
  window.addEventListener('pagehide', () => sound.stop());
  for (const b of document.querySelectorAll('[data-control]')) {
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); touch.add(b.dataset.control); b.classList.add('active'); sound.init(); });
    const release = () => { touch.delete(b.dataset.control); b.classList.remove('active'); };
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', release);
  }
  window.addEventListener('gamepadconnected', () => { $('gamepad-note').textContent = I.t('Gamepad připojen. Směrový kříž / páčka + A pro bombu.'); });
  for (const [tile, title, description] of [[3, 'NÁHODA', 'Efekt na 30 sekund'], [4, 'STOP', 'Zruší náhodný efekt'], [5, 'BOMBA +', 'Více bomb najednou'], [6, 'PLAMEN +', 'Delší výbuch']]) {
    const item = document.createElement('div'); item.className = 'bonus-item';
    const icon = document.createElement('canvas'); icon.width = icon.height = 16;
    icon.getContext('2d').drawImage(tileImage(tile), 0, 0);
    const text = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = I.t(title); small.textContent = I.t(description); text.append(strong, small); item.append(icon, text); $('bonus-list').append(item);
  }
  updateMode();
  updateSound(); preview(); ui(); requestAnimationFrame(frame);
})();

(function () {
  'use strict';
const I=globalThis.AtariI18n||{t:value=>value,html:value=>value,locale:'cs-CZ'};
  const $ = id => document.getElementById(id), E = globalThis.GooniesEngine;
  const graphics = globalThis.GOONIES_GRAPHICS, levels = globalThis.GOONIES_LEVELS;
  const canvas = $('game'), view = canvas.getContext('2d');
  const surface = document.createElement('canvas'); surface.width = 336; surface.height = 240;
  const ctx = surface.getContext('2d'); ctx.imageSmoothingEnabled = view.imageSmoothingEnabled = false;
  const audio = new GooniesAudio({ onStatus: text => { $('audio-status').textContent = I.t(text); } });
  const keys = new Set(), touch = new Set(), images = new Map();
  let game = null, muted = false, ready = false, last = 0, accumulator = 0, best = 0, stamp = '', gamepadFire = false;
  try { best = Number(localStorage.getItem('atari800.goonies.best')) || 0; muted = localStorage.getItem('atari800.goonies.muted') === 'true'; } catch (_) {}
  const imageSources = [...graphics.scenes.map(s => s.src), graphics.title?.src, graphics.ending?.src].filter(Boolean);
  $('start').disabled = true;
  Promise.all(imageSources.map(src => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { images.set(src, image); resolve(); }; image.onerror = reject; image.src = src;
  }))).then(() => { ready = true; $('start').disabled = false; draw(); }, () => { $('overlay-copy').textContent = I.t('Grafiku se nepodařilo načíst. Zkus obnovit stránku.'); });
  function text(value, x, y, color = '#6352ff', align = 'left', size = 7) {
    ctx.font = `${size}px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace'}`;
    ctx.textBaseline = 'top'; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(I.t(value), x, y);
  }
  // Filled in from the original bitmap frames; every frame remains pixel aligned.
  const spriteCache = new Map();
  function nativeSprite(scene, logical, phase) {
    const frame = GOONIES_ORIGINAL.scenes[scene].frames[logical]?.[phase]; if (!frame) return null;
    const key = `native:${scene}:${logical}:${phase}`; if (spriteCache.has(key)) return spriteCache.get(key);
    const output = document.createElement('canvas'); output.width = frame.width; output.height = frame.height;
    const c = output.getContext('2d'), pixels = c.createImageData(frame.width, frame.height), bytes = atob(frame.packed), stride = frame.width / 8;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
      const color = bytes.charCodeAt(y * stride + (x >> 3)) >> (6 - ((x & 7) >> 1) * 2) & 3;
      if (!color) continue;
      const hex = graphics.palette[color]; pixels.data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], (y * frame.width + x) * 4);
    }
    c.putImageData(pixels, 0, 0); spriteCache.set(key, output); return output;
  }
  function drawActor(p, portrait) {
    if (!portrait || p?.escaped) return;
    const scene = game?.scene ?? Number($('scene').value), n = p.native || GOONIES_ORIGINAL.scenes[scene].players[p.id];
    const image = nativeSprite(scene, n.baseFrame + 6, 0);
    if (image) portrait.drawImage(image, 16 - image.width, 38 - image.height * 2, image.width * 2, image.height * 2);
  }
  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 336, 240);
    const meta = !game ? graphics.title || graphics.scenes[0] : game.phase === 'complete' && !game.practice ? graphics.ending || graphics.scenes[game.scene] : graphics.scenes[game.scene];
    const background = images.get(meta.src); if (background) ctx.drawImage(background, 8, 32, 320, 176);
    if (game) {
      if (game.phase !== 'complete' || game.practice) {
        const source = GooniesRaster.compose(game), image = ctx.createImageData(320, 176);
        const palette = graphics.palette.map(hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255]);
        for (let i = 0; i < source.length; i++) image.data.set(palette[source[i]], i * 4);
        ctx.putImageData(image, 8, 32);
      }
      text('SCORE', 8, 16); text(String(game.score), 70, 16); text('HI ' + Math.max(best, game.score), 112, 16); text('LIVES ' + game.lives, 251, 16);
      if (game.phase === 'hurt') text('ZKUSÍME TO ZNOVU', 168, 219, '#e1bb72', 'center', 8);
      if (game.paused) { ctx.fillStyle = '#0009'; ctx.fillRect(8, 32, 320, 176); text('PAUZA', 168, 111, '#e1bb72', 'center', 13); }
    } else { text('THE GOONIES', 168, 16, '#6352ff', 'center'); }
    view.clearRect(0, 0, 672, 480); view.drawImage(surface, 0, 0, 672, 480);
  }
  function updateUI() {
    const signature = !game ? `menu:${audio.preview}:${muted}` : [game.scene, game.selected, game.phase, game.paused, game.score, game.lives, game.message, game.players.map(p => `${p.escaped}:${p.attached}:${p.climbing}:${p.rail}`).join('/'), muted].join('|');
    if (signature === stamp) return; stamp = signature;
    $('mute').setAttribute('aria-pressed', String(muted)); $('mute').firstChild.textContent = I.t(muted ? '♪ Ztlumeno ' : '♪ Zvuk ');
    $('music-preview').textContent = I.t(audio.preview ? '■ Zastavit původní hudbu' : '♪ Přehrát původní hudbu');
    $('pause').disabled = !game || ['over', 'complete'].includes(game.phase);
    $('switch').disabled = !game || game.mode === 'two' || game.paused;
    $('pause').firstChild.textContent = I.t(game?.paused ? '▶ Pokračovat ' : 'Ⅱ Pauza ');
    const level = game?.level || levels[Number($('scene').value)];
    $('objective-title').textContent = I.t(level.name); $('objective-copy').textContent = I.t(level.objective);
    $('hint-copy').textContent = I.t(level.hint);
    $('scene-label').textContent = I.t(game ? level.name.toUpperCase() : 'CESTA K POKLADU');
    $('stage-count').textContent = I.t(game ? `${String(game.scene + 1).padStart(2, '0')} / 08` : '08 SCÉN · DVA KAMARÁDI');
    $('message').textContent = I.t(game?.message || 'Jeden drží. Druhý hledá cestu. Spolu se dostanou dál.');
    for (let i = 0; i < 2; i++) {
      const button = $('player-' + i), p = game?.players[i];
      button.classList.toggle('active', !!game && (game.mode === 'two' || i === game.selected));
      button.classList.toggle('escaped', !!p?.escaped); button.setAttribute('aria-pressed', String(!!game && i === game.selected));
      $('player-' + i + '-status').textContent = I.t(p?.escaped ? 'V BEZPEČÍ' : p?.attached || p?.rail ? 'DRŽÍ MECHANISMUS' : game && (game.mode === 'two' || i === game.selected) ? 'TVŮJ TAH' : 'ČEKÁ NA PARŤÁKA');
      const portrait = button.querySelector('canvas').getContext('2d'); portrait.clearRect(0, 0, 32, 40); drawActor(p || { id: i, facing: 1 }, portrait);
    }
    $('progress').replaceChildren(...levels.map((l, i) => { const bar = document.createElement('span'); bar.className = i < (game?.scene || 0) ? 'done' : i === (game?.scene || 0) ? 'current' : ''; bar.title = I.t(`${i + 1}. ${l.name}`); return bar; }));
    const ended = game && ['over', 'complete'].includes(game.phase);
    $('overlay').hidden = !!game && !ended;
    if (ended) {
      $('overlay-title').textContent = I.t(game.phase === 'over' ? 'Nevzdávej se, Goonie.' : game.practice ? 'Místnost je vaše.' : 'Jste praví Goonies!');
      $('overlay-kicker').textContent = I.t(game.phase === 'over' ? 'DALŠÍ POKUS ČEKÁ' : 'SPOLU AŽ K POKLADU');
      $('overlay-copy').textContent = I.t(`Skóre ${game.score.toLocaleString(I.locale)}. ${game.practice ? 'Vyber další trénink, nebo celou výpravu.' : game.phase === 'complete' ? 'Oba kamarádi jsou v bezpečí.' : 'Každá past má řešení. Zkus jinou cestu.'}`);
      $('start').firstChild.textContent = I.t('ZAČÍT ZNOVU ');
      if (game.score > best) { best = game.score; try { localStorage.setItem('atari800.goonies.best', String(best)); } catch (_) {} }
    }
  }
  function start() {
    if (!ready) return; audio.unlock(); audio.preview = false;
    const scene = Number($('scene').value); game = new E.Game({ mode: $('mode').value, scene, practice: scene !== 0 });
    globalThis.goonies = game; keys.clear(); touch.clear(); stamp = ''; canvas.focus(); $('hint-copy').hidden = true; $('hint').setAttribute('aria-expanded', 'false'); updateUI();
  }
  function menu() {
    game = null; globalThis.goonies = null; keys.clear(); touch.clear(); stamp = '';
    $('overlay-title').innerHTML = I.html('Poklad nepočká.<br>Kamaráda nenecháš.');
    $('overlay-kicker').textContent = I.t('DATASOFT · STEVEN SPIELBERG');
    $('overlay-copy').innerHTML = I.html('Dva Goonies. Osm nástrah.<br>Najdi cestu z domu Fratelliových až na pirátskou loď.');
    $('start').firstChild.textContent = I.t('VYRAZIT ZA POKLADEM '); updateUI();
  }
  function pause() { if (game && !['over', 'complete'].includes(game.phase)) { game.paused = !game.paused; keys.clear(); touch.clear(); } }
  function toggleMute() { audio.unlock(); muted = !muted; try { localStorage.setItem('atari800.goonies.muted', String(muted)); } catch (_) {} }
  function switchActor(id) { if (!game || game.mode !== 'solo') return; if (id !== undefined) { if (game.selected !== id) game.switchActor(); } else game.switchActor(); }
  $('start').addEventListener('click', start); $('music-preview').addEventListener('click', () => { audio.togglePreview(); stamp = ''; });
  $('switch').addEventListener('click', () => switchActor()); $('touch-switch').addEventListener('click', () => switchActor());
  $('pause').addEventListener('click', pause); $('mute').addEventListener('click', toggleMute); $('menu').addEventListener('click', menu);
  $('fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else $('arcade').requestFullscreen?.().catch(() => {}); });
  $('hint').addEventListener('click', () => { $('hint-copy').hidden = !$('hint-copy').hidden; $('hint').setAttribute('aria-expanded', String(!$('hint-copy').hidden)); });
  for (let i = 0; i < 2; i++) $('player-' + i).addEventListener('click', () => switchActor(i));
  $('scene').addEventListener('change', () => { if (!game) { stamp = ''; updateUI(); } });
  window.addEventListener('keydown', event => {
    if (['SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Enter'].includes(code)) {
      if (code !== 'Tab' || (game && document.activeElement === canvas)) event.preventDefault();
    }
    keys.add(code); audio.unlock();
    if (!event.repeat) {
      if (code === 'Space' || (code === 'Tab' && document.activeElement === canvas)) switchActor();
      else if (code === 'Digit1') switchActor(0); else if (code === 'Digit2') switchActor(1);
      else if (code === 'KeyP' || code === 'Escape') pause(); else if (code === 'KeyM') toggleMute();
      else if (code === 'KeyR') menu(); else if (code === 'KeyF') $('fullscreen').click();
      else if (code === 'Enter' && (!game || ['complete', 'over'].includes(game.phase))) start();
    }
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  function loseFocus() { keys.clear(); touch.clear(); if (game && game.phase === 'playing') game.paused = true; }
  window.addEventListener('blur', loseFocus); document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); });
  for (const button of document.querySelectorAll('[data-key]')) {
    const release = event => { event.preventDefault(); touch.delete(button.dataset.key); };
    button.addEventListener('pointerdown', event => { event.preventDefault(); audio.unlock(); button.setPointerCapture(event.pointerId); touch.add(button.dataset.key); });
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', () => touch.delete(button.dataset.key));
  }
  function inputs() {
    const result = [{}, {}], first = { left: keys.has('ArrowLeft') || touch.has('left'), right: keys.has('ArrowRight') || touch.has('right'), up: keys.has('ArrowUp') || touch.has('up'), down: keys.has('ArrowDown') || touch.has('down') };
    if (!game) return result;
    result[game.mode === 'solo' ? game.selected : 0] = first;
    if (game.mode === 'two') result[1] = { left: keys.has('KeyA'), right: keys.has('KeyD'), up: keys.has('KeyW'), down: keys.has('KeyS') };
    const pads = Array.from(navigator.getGamepads?.() || []).filter(Boolean);
    pads.slice(0, game.mode === 'two' ? 2 : 1).forEach((pad, i) => {
      const target = result[game.mode === 'solo' ? game.selected : i];
      target.left ||= pad.axes[0] < -.35 || pad.buttons[14]?.pressed;
      target.right ||= pad.axes[0] > .35 || pad.buttons[15]?.pressed;
      target.up ||= pad.axes[1] < -.35 || pad.buttons[12]?.pressed;
      target.down ||= pad.axes[1] > .35 || pad.buttons[13]?.pressed;
    });
    const fire = pads[0]?.buttons[0]?.pressed || false;
    if (fire && !gamepadFire) switchActor(); gamepadFire = fire;
    return result;
  }
  function frame(now) {
    if (!last) last = now; accumulator = Math.min(accumulator + (now - last) / 1000, .1); last = now;
    while (accumulator >= 1 / E.HZ) {
      if (game) { game.step(inputs()); for (const event of game.drainEvents()) audio.event(event); }
      accumulator -= 1 / E.HZ;
    }
    audio.sync(!!game && !['complete', 'over'].includes(game.phase), !!game?.paused, muted);
    updateUI(); draw(); requestAnimationFrame(frame);
  }
  updateUI(); requestAnimationFrame(frame);
})();

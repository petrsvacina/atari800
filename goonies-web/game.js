(function () {
  'use strict';
  const $ = id => document.getElementById(id), E = globalThis.GooniesEngine;
  const graphics = globalThis.GOONIES_GRAPHICS, levels = globalThis.GOONIES_LEVELS;
  const canvas = $('game'), view = canvas.getContext('2d');
  const surface = document.createElement('canvas'); surface.width = 336; surface.height = 240;
  const ctx = surface.getContext('2d'); ctx.imageSmoothingEnabled = view.imageSmoothingEnabled = false;
  const audio = new GooniesAudio({ onStatus: text => { $('audio-status').textContent = text; } });
  const keys = new Set(), touch = new Set(), images = new Map();
  let game = null, muted = false, ready = false, last = 0, accumulator = 0, best = 0, stamp = '', gamepadFire = false;
  try { best = Number(localStorage.getItem('atari800.goonies.best')) || 0; muted = localStorage.getItem('atari800.goonies.muted') === 'true'; } catch (_) {}
  const imageSources = [...graphics.scenes.map(s => s.src), graphics.title?.src, graphics.ending?.src].filter(Boolean);
  $('start').disabled = true;
  Promise.all(imageSources.map(src => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { images.set(src, image); resolve(); }; image.onerror = reject; image.src = src;
  }))).then(() => { ready = true; $('start').disabled = false; draw(); }, () => { $('overlay-copy').textContent = 'Grafiku se nepodařilo načíst. Zkus obnovit stránku.'; });
  function text(value, x, y, color = '#6352ff', align = 'left', size = 7) {
    ctx.font = `${size}px ${getComputedStyle(document.body).getPropertyValue('--mono') || 'monospace'}`;
    ctx.textBaseline = 'top'; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(value, x, y);
  }
  // Filled in from the original bitmap frames; every frame remains pixel aligned.
  const spriteCache = new Map();
  function sprite(kind, frame = 0) {
    const bank = graphics.sprites || {};
    const aliases = { chair: 8 + frame % 4, cooler: 12, coolerDown: 13, ball: 14, fire: 15, rock: 1 + frame % 5, egg: 6 + frame % 2, bird: 0 };
    let group;
    if (kind.startsWith('character:')) group = bank.characters?.[Number(kind.split(':')[1])];
    else if (kind in aliases) { group = bank.objects; frame = aliases[kind]; }
    else if (kind === 'chest') { group = bank.roomObjects?.[7]; frame = 2; }
    else if (kind === 'spring') { group = bank.roomObjects?.[4]; frame = group?.frames.findIndex(f => f.sourceAddress === 'B2F6') ?? 0; }
    else if (kind === 'cage') { group = bank.roomObjects?.[5]; frame = 0; }
    else if (kind === 'boom') { group = bank.roomObjects?.[7]; frame = 1; }
    else if (kind === 'sloth') { group = bank.roomObjects?.[7]?.frames.filter(f => f.actorFrames?.some(a => a.logicalFrame === 57)); }
    else group = bank[kind];
    if (!group) return null;
    const frames = Array.isArray(group) ? group : group.frames;
    if (!frames?.length) return null;
    const entry = frames[((frame % frames.length) + frames.length) % frames.length];
    const key = kind + ':' + (frame % frames.length); if (spriteCache.has(key)) return spriteCache.get(key);
    const width = entry.width || group.width || 8, height = entry.height || group.height || 16;
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const c = output.getContext('2d'), data = c.createImageData(width, height);
    let pixels = entry.pixels;
    if (typeof pixels === 'string') pixels = Uint8Array.from(atob(pixels), ch => ch.charCodeAt(0));
    const palette = entry.palette || group.palette || graphics.palette;
    if (!pixels || !palette) return null;
    for (let i = 0; i < width * height; i++) {
      const index = pixels[i]; if (!index) continue;
      const color = palette[index]; if (!color) continue;
      const rgb = Array.isArray(color) ? color : [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      data.data.set([...rgb, 255], i * 4);
    }
    c.putImageData(data, 0, 0); spriteCache.set(key, output); return output;
  }
  function drawActor(p, portrait = null) {
    if (p.escaped) return;
    const pair = graphics.sprites?.sceneCharacters?.[game?.scene || 0] || [0, 1];
    const character = pair[p.id], poses = graphics.sprites?.characters?.[character]?.poses || {};
    const step = Math.floor((game?.age || 0) / 7), left = p.facing < 0;
    let frame = left ? 1 : 0;
    if (p.climbing) frame = (poses.climb || [6, 7])[step % 2];
    else if (p.attached || p.rail != null) frame = poses.hang ?? 8;
    else if (game && !p.grounded) frame = left ? poses.jumpLeft ?? 5 : poses.jumpRight ?? 4;
    else if (Math.abs(p.vx) > 0) frame = (left ? poses.walkLeft || [1, 3] : poses.walkRight || [0, 2])[step % 2];
    const sloth = game?.scene === 7 && p.id === 1;
    const image = sloth ? sprite('sloth', Math.abs(p.vx) > 0 ? step % 4 : 0) : sprite('character:' + character, frame);
    if (!image) return;
    const target = portrait || ctx, x = portrait ? 16 : Math.round(8 + p.x), y = portrait ? 38 : Math.round(32 + p.y);
    if (!portrait && !game.paused && p.invincible && game.age % 10 < 3) return;
    target.save(); target.translate(x, y); if (portrait) target.scale(2, 2); if (sloth && left) target.scale(-1, 1);
    target.drawImage(image, -Math.floor(image.width / 2), -image.height); target.restore();
    if (!portrait && game.mode === 'solo' && p.id === game.selected) {
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y - image.height - 5, 5, 1); ctx.fillRect(x - 1, y - image.height - 4, 3, 1); ctx.fillRect(x, y - image.height - 3, 1, 1);
    }
  }
  function drawDynamics() {
    const s = game.state;
    for (const o of Object.values(game.objects)) {
      const x = Math.round(o.x + 8), y = Math.round(o.y + 32);
      let kind = o.sprite || o.id;
      if (o.id === 'key' && s.key) continue;
      if (o.id === 'cooler' && s.cooler) kind = 'coolerDown';
      if (o.id === 'cage' && !s.cageDropped) continue;
      if (o.id === 'boom' && s.boomRaised) { const image = sprite('boom'); if (image) ctx.drawImage(image, x - image.width / 2, o.raisedY + 32 - image.height); continue; }
      const image = sprite(kind, Math.floor(game.age / 10));
      if (image) ctx.drawImage(image, x - Math.floor(image.width / 2), y - image.height);
      if (o.id === 'key' && !s.key) { ctx.fillStyle = '#eee'; ctx.fillRect(x - 2, y - 6, 4, 4); ctx.fillRect(x + 1, y - 4, 6, 1); ctx.fillRect(x + 5, y - 4, 1, 3); }
      if (['leverA', 'leverB'].includes(o.id)) { ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (s[o.id] ? 5 : -5), y - 7); ctx.stroke(); }
    }
    for (const gate of game.level.platforms.filter(p => p.gate)) if (game.isHeld(gate.gate)) {
      ctx.fillStyle = '#000'; ctx.fillRect(gate.x1 + 8, gate.y + 31, gate.x2 - gate.x1, 3);
    }
    if (game.scene === 0 && !s.cooler) {
      const o = game.objects.fire; if (o) {
        const image = sprite('fire', Math.floor(game.age / 6)); if (image) ctx.drawImage(image, o.x + 4, o.y + 32 - image.height);
      }
    }
    for (const r of game.rocks) {
      const image = sprite('rock', Math.floor(game.age / 8));
      if (image) ctx.drawImage(image, r.x + 4, r.y + 24); else { ctx.fillStyle = '#c8c8ce'; ctx.fillRect(Math.round(r.x + 5), Math.round(r.y + 26), 6, 6); }
    }
    for (const egg of game.eggs) {
      const image = sprite('egg', Math.floor(game.age / 8));
      if (image) ctx.drawImage(image, egg.x + 4, egg.y + 25); else { ctx.fillStyle = '#d8d5cc'; ctx.fillRect(Math.round(egg.x + 5), Math.round(egg.y + 27), 6, 5); }
    }
    if (game.scene === 4 && s.eggs) {
      const pile = game.objects.pile;
      for (let i = 0; i < s.eggs; i++) { ctx.fillStyle = '#e3dfd8'; ctx.fillRect(pile.x + 2 + i * 3, pile.y + 25 - i * 8, 14 - i * 2, 7); }
    }
    if (game.scene === 3) {
      for (let i = 0; i < s.boards; i++) { const image = sprite('objects', 16); if (image) ctx.drawImage(image, 48, 180 - i * 8); }
    }
    if (game.scene === 1 && !game.isHeld('crank')) {
      const image = sprite('rock', 0); if (image) for (let y = 85; y < 130; y += 6) ctx.drawImage(image, 70, y + 32);
    }
    for (const p of game.level.platforms.filter(p => p.color)) {
      ctx.fillStyle = game.platformVisible(p.color) ? ({ blue: '#5038e6', white: '#efefef', red: '#9e2e0c' })[p.color] : '#000';
      ctx.fillRect(p.x1 + 8, p.y + 31, p.x2 - p.x1, 2);
    }
    for (const e of game.enemyPositions()) {
      if (e.kind === 'fratelli' && s.distracted) continue;
      const image = sprite(e.kind, Math.floor(game.age / 8)); if (image) ctx.drawImage(image, Math.round(e.x + 8 - image.width / 2), Math.round(e.y + 32 - image.height / 2));
    }
    if (game.ready()) {
      const exit = game.level.exit;
      ctx.fillStyle = game.age % 50 < 25 ? '#e1bb72' : '#fff';
      ctx.fillRect(exit.x + 6, exit.y + 35, 5, 1);
    }
  }
  function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 336, 240);
    const meta = !game ? graphics.title || graphics.scenes[0] : game.phase === 'complete' && !game.practice ? graphics.ending || graphics.scenes[game.scene] : graphics.scenes[game.scene];
    const background = images.get(meta.src); if (background) ctx.drawImage(background, 8, 32, 320, 176);
    if (game) {
      drawDynamics(); for (const p of game.players) drawActor(p);
      text('SCORE', 8, 16); text(String(game.score), 70, 16); text('HI ' + Math.max(best, game.score), 112, 16); text('LIVES ' + game.lives, 251, 16);
      if (game.phase === 'hurt') text('ZKUSÍME TO ZNOVU', 168, 219, '#e1bb72', 'center', 8);
      if (game.paused) { ctx.fillStyle = '#0009'; ctx.fillRect(8, 32, 320, 176); text('PAUZA', 168, 111, '#e1bb72', 'center', 13); }
    } else { text('THE GOONIES', 168, 16, '#6352ff', 'center'); }
    view.clearRect(0, 0, 672, 480); view.drawImage(surface, 0, 0, 672, 480);
  }
  function updateUI() {
    const signature = !game ? `menu:${audio.preview}:${muted}` : [game.scene, game.selected, game.phase, game.paused, game.score, game.lives, game.message, game.players.map(p => `${p.escaped}:${p.attached}:${p.climbing}`).join('/'), muted].join('|');
    if (signature === stamp) return; stamp = signature;
    $('mute').setAttribute('aria-pressed', String(muted)); $('mute').firstChild.textContent = muted ? '♪ Ztlumeno ' : '♪ Zvuk ';
    $('music-preview').textContent = audio.preview ? '■ Zastavit původní hudbu' : '♪ Přehrát původní hudbu';
    $('pause').disabled = !game || ['over', 'complete'].includes(game.phase);
    $('switch').disabled = !game || game.mode === 'two' || game.paused;
    $('pause').firstChild.textContent = game?.paused ? '▶ Pokračovat ' : 'Ⅱ Pauza ';
    const level = game?.level || levels[Number($('scene').value)];
    $('objective-title').textContent = level.name; $('objective-copy').textContent = level.objective;
    $('hint-copy').textContent = level.hint;
    $('scene-label').textContent = game ? level.name.toUpperCase() : 'CESTA K POKLADU';
    $('stage-count').textContent = game ? `${String(game.scene + 1).padStart(2, '0')} / 08` : '08 SCÉN · DVA KAMARÁDI';
    $('message').textContent = game?.message || 'Jeden drží. Druhý hledá cestu. Spolu se dostanou dál.';
    for (let i = 0; i < 2; i++) {
      const button = $('player-' + i), p = game?.players[i];
      button.classList.toggle('active', !!game && (game.mode === 'two' || i === game.selected));
      button.classList.toggle('escaped', !!p?.escaped); button.setAttribute('aria-pressed', String(!!game && i === game.selected));
      $('player-' + i + '-status').textContent = p?.escaped ? 'V BEZPEČÍ' : p?.attached ? 'DRŽÍ MECHANISMUS' : game && (game.mode === 'two' || i === game.selected) ? 'TVŮJ TAH' : 'ČEKÁ NA PARŤÁKA';
      const portrait = button.querySelector('canvas').getContext('2d'); portrait.clearRect(0, 0, 32, 40); drawActor(p || { id: i, facing: 1 }, portrait);
    }
    $('progress').replaceChildren(...levels.map((l, i) => { const bar = document.createElement('span'); bar.className = i < (game?.scene || 0) ? 'done' : i === (game?.scene || 0) ? 'current' : ''; bar.title = `${i + 1}. ${l.name}`; return bar; }));
    const ended = game && ['over', 'complete'].includes(game.phase);
    $('overlay').hidden = !!game && !ended;
    if (ended) {
      $('overlay-title').textContent = game.phase === 'over' ? 'Nevzdávej se, Goonie.' : game.practice ? 'Místnost je vaše.' : 'Jste praví Goonies!';
      $('overlay-kicker').textContent = game.phase === 'over' ? 'DALŠÍ POKUS ČEKÁ' : 'SPOLU AŽ K POKLADU';
      $('overlay-copy').textContent = `Skóre ${game.score.toLocaleString('cs-CZ')}. ${game.practice ? 'Vyber další trénink, nebo celou výpravu.' : game.phase === 'complete' ? 'Oba kamarádi jsou v bezpečí.' : 'Každá past má řešení. Zkus jinou cestu.'}`;
      $('start').firstChild.textContent = 'ZAČÍT ZNOVU ';
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
    $('overlay-title').innerHTML = 'Poklad nepočká.<br>Kamaráda nenecháš.';
    $('overlay-kicker').textContent = 'DATASOFT · STEVEN SPIELBERG';
    $('overlay-copy').innerHTML = 'Dva Goonies. Osm nástrah.<br>Najdi cestu z domu Fratelliových až na pirátskou loď.';
    $('start').firstChild.textContent = 'VYRAZIT ZA POKLADEM '; updateUI();
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

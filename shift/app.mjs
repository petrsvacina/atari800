import {Shift} from './engine.mjs';
import {Screen} from './screen.mjs';
import {ShiftAudio} from './audio.mjs';

const en = new URLSearchParams(location.search).get('lang') === 'en';
const messages = {
  eyebrow:'2024 · PUZZLE PLATFORMER',intro:'Change your perspective. Find a way.',
  paused:'PAUSED',resume:'▶ Continue',start:'Start game →','start-hint':'The original world. A different point of view.',
  'code-label':'Level code','code-play':'Play →','code-skip':'From the beginning',restart:'↺ Restart · R',pause:'Ⅱ Pause · P',
  mute:'Sound on',fullscreen:'⛶ Fullscreen',how:'Two worlds. One way out.',
  guide:'Reach the gate. Flip the black and white world, find keys and operate platforms. Watch out for spikes — everything changes when you turn it around.',
  move:'Move',jump:'Jump',shift:'Flip the world',keys:'Restart · music/effects · pause',
  original:'Based on the game by Antony Lavelle and Armor Games.',author:'Original game ↗'
};
const $ = id => document.getElementById(id), canvas = $('game'), screen = new Screen(canvas, SHIFT_DATA), audio = new ShiftAudio(SHIFT_AUDIO);
if (en) {
  document.documentElement.lang = 'en';
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = messages[el.dataset.t]);
  $('back').textContent = '← BACK TO THE ARCADE';
  canvas.setAttribute('aria-label','Shift · game screen');
}
$('back').href=(document.body.dataset.portalHome||'../')+(en?'en/':'');
$(en ? 'en' : 'cs').setAttribute('aria-current','page');
let phase = 'title', game = new Shift(SHIFT_DATA), paused = false, panel = [...SHIFT_DATA.panels[0]], keys = new Set();
let cursor = 0, menuDelay = 0, previousFire = false, randomCursor = 0x2d, reveal = null, endingConfirm = false;
const touch = globalThis.AtariTouchJoystick?.mount({host:document.querySelector('.touch-controls'),action:'fire',enabled:()=>!paused,
  onInteract:()=>audio.unlock().catch(showAudioError)});
const FPS = 1773447/(312*114);
function showAudioError() { $('phase').textContent = en ? 'Audio unavailable — try the sound button.' : 'Zvuk se nespustil — zkus tlačítko Zvuk.'; }
function labels() {
  $('phase').textContent = paused ? (en?'PAUSED':'PAUZA') : phase === 'game' ? (game.level===36 ? (en?'SECRET ROOM':'TAJNÁ MÍSTNOST') : `${en?'LEVEL':'ÚROVEŇ'} ${String(game.level+1).padStart(2,'0')} / 36`) : (en?'BLACK. WHITE. AND SOMETHING IN BETWEEN.':'ČERNÁ. BÍLÁ. A NĚCO MEZI.');
  $('sound-mode').textContent = audio.mode ? (en?'♫ Music · S':'♫ Hudba · S') : (en?'♪ Effects · S':'♪ Efekty · S');
  $('mute').textContent = audio.muted ? (en?'Sound off':'Zvuk vypnutý') : (en?'Sound on':'Zvuk zapnutý');
  $('pause').textContent = paused ? (en?'▶ Continue · P':'▶ Pokračovat · P') : (en?'Ⅱ Pause · P':'Ⅱ Pauza · P');
}
function clearInput() { keys.clear(); touch?.clear(); previousFire = false; }
function returnTitle() {
  phase='title';panel=[...SHIFT_DATA.panels[0]];reveal=null;endingConfirm=false;
  clearInput();$('welcome').hidden=false;$('code-form').hidden=true;
  canvas.focus();labels();
}
function pause(value = !paused) {
  if (phase !== 'game') return;
  paused = value; clearInput(); accumulator = 0;
  $('pause-overlay').hidden = !value; audio.pause(value); labels(); if (!value) canvas.focus();
}
function codeMenu() {
  phase = 'code'; clearInput(); cursor = 0; menuDelay = 15;
  $('welcome').hidden = true; $('code-form').hidden = false; $('code').value = '0000';
  panel = [...SHIFT_DATA.panels[1]]; reveal = {target:[...panel],column:0,ticks:0}; panel.fill(0);
  audio.unlock().catch(showAudioError); canvas.focus(); labels();
}
function start(level = 0) {
  const random = () => SHIFT_DATA.random[randomCursor++ & 255] & 127;
  let a, b; do { a=random(); } while(!a || a>=99); do { b=random(); } while(b<10 || b>=100);
  game = new Shift(SHIFT_DATA, level,[SHIFT_DATA.bcd[a],SHIFT_DATA.bcd[b]]); game.music=audio.mode;
  phase = 'game'; panel = null; reveal = null;
  paused = false; endingConfirm=false; clearInput(); $('welcome').hidden = true; $('code-form').hidden = true; $('pause-overlay').hidden = true;
  accumulator = 0; audio.unlock().catch(showAudioError); audio.pause(false); canvas.focus(); labels();
}
function playCode() {
  const code = $('code').value.toUpperCase();
  if (code === '0000') { start(); return; }
  const level = SHIFT_DATA.levels.findIndex(l => l.code === code);
  if (level < 0) { $('code-hint').textContent = en?'Unknown code. Check all four characters.':'Neznámý kód. Zkontroluj všechny čtyři znaky.'; return; }
  $('code-hint').textContent = ''; start(level);
}
function input() {
  const state = {left:keys.has('ArrowLeft')||keys.has('KeyA'),right:keys.has('ArrowRight')||keys.has('KeyD'),
    up:keys.has('ArrowUp')||keys.has('KeyW'),down:keys.has('ArrowDown'),fire:keys.has('Space')||keys.has('ShiftLeft')||keys.has('ShiftRight')};
  touch?.buttons(state);
  for (const p of navigator.getGamepads?.() || []) if (p) {
    state.left ||= p.axes[0]<-.35 || p.buttons[14]?.pressed; state.right ||= p.axes[0]>.35 || p.buttons[15]?.pressed;
    state.up ||= p.axes[1]<-.35 || p.buttons[12]?.pressed; state.down ||= p.axes[1]>.35 || p.buttons[13]?.pressed;
    state.fire ||= p.buttons[0]?.pressed;
  }
  return state;
}
function tick() {
  const buttons = input();
  if (phase === 'title') { randomCursor=(randomCursor+1)&255;if (buttons.fire && !previousFire) codeMenu(); }
  else if (phase === 'code') {
    if (reveal) {
      if (!(reveal.ticks++ % 2)) {
        for (let y=0;y<25;y++) for (const x of [reveal.column,39-reveal.column]) panel[y*40+x]=reveal.target[y*40+x];
        if (++reveal.column === 20) reveal=null;
      }
    } else {
      const value = $('code').value.toUpperCase().padEnd(4,'0').slice(0,4);
      for (let i=0;i<4;i++) { panel[540+i]=/[A-F]/.test(value[i])?value.charCodeAt(i)-64:Number(value[i])+48;panel[580+i]=cursor===i?46:0; }
      if (menuDelay) menuDelay--;
      else if (buttons.up || buttons.down || buttons.left || buttons.right) {
        if (buttons.left || buttons.right) cursor=(cursor+(buttons.right?1:3))%4;
        else {
          const n=(parseInt(value[cursor],16)+(buttons.up?1:15))%16;
          $('code').value=value.slice(0,cursor)+n.toString(16).toUpperCase()+value.slice(cursor+1);
          const matched=SHIFT_DATA.levels.findIndex(l=>l.code===$('code').value);
          if(matched>=0)start(matched);
        }
        menuDelay=9;
      } else if (buttons.fire && !previousFire) start(); // Original FIRE skips code entry.
    }
  } else if (!paused) {
    if (game.ended) {
      if (buttons.fire) endingConfirm=true;
      if (endingConfirm && !Object.values(buttons).some(Boolean)) {returnTitle();return;}
    }
    let bits=15; if(buttons.up)bits&=~1;if(buttons.down)bits&=~2;if(buttons.left)bits&=~4;if(buttons.right)bits&=~8;if(buttons.fire)bits|=16;
    for (const event of game.tick(bits)) {
      if (event.type==='sound') audio.effect(event.name);
      if (event.type==='level') labels();
      if (event.type==='music') {audio.setMode(event.music);labels();}
      if (event.type==='ending') { $('phase').textContent=en?'THE END':'KONEC';audio.setMode(true); }
    }
  }
  previousFire=buttons.fire;
}
let previous=performance.now(),accumulator=0;
function frame(now) {
  const elapsed=Math.min(now-previous,150);previous=now;
  if (!paused) { accumulator+=elapsed;while(accumulator>=1000/FPS){tick();accumulator-=1000/FPS;} }
  screen.draw(game,panel);requestAnimationFrame(frame);
}
$('start').addEventListener('click',codeMenu);
$('skip').addEventListener('click',()=>start());
$('code-form').addEventListener('submit',event=>{event.preventDefault();playCode();});
$('code').addEventListener('input',()=>{$('code').value=$('code').value.replace(/[^0-9a-f]/gi,'').toUpperCase();});
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',()=>pause(false));
$('restart').addEventListener('click',()=>{if(phase==='game'){if(game.ended){start();return;}game.restartRequested=true;if(paused)pause(false);}else codeMenu();});
$('sound-mode').addEventListener('click',()=>{audio.setMode(!audio.mode);game.music=audio.mode;audio.unlock().catch(showAudioError);labels();});
$('mute').addEventListener('click',()=>{audio.mute();if(!audio.muted)audio.unlock().catch(showAudioError);labels();});
$('fullscreen').addEventListener('click',async()=>{
  const target=document.querySelector('.arcade');
  if(document.fullscreenElement)await document.exitFullscreen();
  else if(document.webkitFullscreenElement)document.webkitExitFullscreen();
  else if(target.requestFullscreen)await target.requestFullscreen();
  else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();
});
const mapped = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','Space','ShiftLeft','ShiftRight']);
document.addEventListener('keydown',event=>{
  if(event.target instanceof HTMLInputElement)return;
  if(mapped.has(event.code)){event.preventDefault();keys.add(event.code);}
  if(event.repeat)return;
  if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();pause();}
  if(event.code==='KeyR'&&phase==='game')game.restartRequested=true;
  if(event.code==='KeyS'){$('sound-mode').click();event.preventDefault();}
  if(event.code==='Enter'&&phase==='title')codeMenu();
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();if(phase==='game')pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(phase==='game')pause(true);}});
globalThis.shiftDebug={get game(){return game;},get phase(){return phase;},get paused(){return paused;},
  get audio(){return {state:audio.context?.state,loaded:Object.keys(audio.buffers),music:audio.mode,muted:audio.muted};}};
labels();screen.draw(game,panel);requestAnimationFrame(frame);

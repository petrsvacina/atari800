import {Fred} from './engine.mjs';
import {Screen} from './screen.mjs';
import {FredAudio} from './audio.mjs';
const en=new URLSearchParams(location.search).get('lang')==='en', $=id=>document.getElementById(id);
const words={eyebrow:'1991 · ACTION PLATFORMER',intro:'The Stone Age. A hard life.',paused:'PAUSED',resume:'▶ Continue',
  again:'Play again →',start:'Start game →','start-hint':'Ten levels of prehistoric adventure.',restart:'↺ Restart · R',pause:'Ⅱ Pause · P',
  mute:'Sound on',fullscreen:'⛶ Fullscreen · F',how:'Stones against the Stone Age.',controls:'CONTROLS',move:'Move',jump:'Jump · climb',down:'Climb down',fire:'Throw a stone · spray',weapons:'Stones · spray',
  keys:'Restart · music/effects · pause · fullscreen',guide:'Find your way through all ten levels. Collect stones, break pots, and look for supplies and protection. At the end of each level, you have limited time to move on.',
  'music-hint':'The Music / Effects switch corresponds to the Atari OPTION key.',original:'Native HTML5 version based on the supplied Czech Atari XL/XE original.'};
if(en){document.documentElement.lang='en';document.querySelectorAll('[data-t]').forEach(el=>el.textContent=words[el.dataset.t]);$('back').textContent='← ALL GAMES';$('edition-caption').textContent='ATARI800 · WEB ARCADE';$('title-picture').alt='Original Fred title screen';$('game').setAttribute('aria-label','Fred · game screen');}
$('back').href=(document.body.dataset.portalHome||'../dist/')+(en?'en/':'');document.querySelector('.brand').href='index.html'+(en?'?lang=en':'');
const screen=new Screen($('game'),FRED_DATA),audio=new FredAudio(FRED_AUDIO),keys=new Set();
let game=new Fred(FRED_DATA),started=false,paused=false,divider=0;
const touch=globalThis.AtariTouchJoystick?.mount({host:document.querySelector('.touch-controls'),action:'shoot',enabled:()=>started&&!paused&&!game.ended,onInteract:()=>audio.unlock().catch(audioError)});
function audioError(){console.warn('Fred audio could not start.');$('phase').textContent=en?'Try the sound button to enable audio.':'Pro spuštění zvuku zkus tlačítko Zvuk.';}
function clearInput(){keys.clear();touch?.clear();}
function labels(){
  $('phase').textContent=paused?(en?'PAUSED':'PAUZA'):started?`${en?'LEVEL':'ÚROVEŇ'} ${String(game.level+1).padStart(2,'0')} / 10`:(en?'THE ADVENTURE BEGINS':'DOBRODRUŽSTVÍ ZAČÍNÁ');
  $('sound-mode').textContent=audio.mode?(en?'♫ Music · M':'♫ Hudba · M'):(en?'♪ Effects · M':'♪ Efekty · M');
  $('mute').textContent=audio.muted?(en?'Sound off':'Zvuk vypnutý'):(en?'Sound on':'Zvuk zapnutý');
  $('pause').textContent=paused?(en?'▶ Continue · P':'▶ Pokračovat · P'):(en?'Ⅱ Pause · P':'Ⅱ Pauza · P');
}
function start(){
  const high=game.highScore,level=started&&!game.complete?FRED_DATA.levelsAfterDeath[game.level]:0;
  game=new Fred(FRED_DATA,level);game.highScore=high;started=true;paused=false;divider=0;clearInput();
  $('welcome').hidden=true;$('title-picture').hidden=true;$('game').hidden=false;$('pause-overlay').hidden=true;$('ending').hidden=true;
  $('ending').classList.remove('completed');
  document.querySelector('.arcade').classList.add('is-playing');
  audio.request(128);audio.request(57);audio.pause(false);audio.unlock().catch(audioError);$('game').focus();labels();screen.draw(game);
}
function pause(value=!paused){if(!started||game.ended)return;paused=value;clearInput();$('pause-overlay').hidden=!value;audio.pause(value);labels();if(!value)$('game').focus();}
function input(){
  const b={left:keys.has('ArrowLeft')||keys.has('KeyA'),right:keys.has('ArrowRight')||keys.has('KeyD'),up:keys.has('ArrowUp')||keys.has('KeyW'),down:keys.has('ArrowDown')||keys.has('KeyS'),fire:keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight')};
  touch?.buttons(b);
  for(const pad of navigator.getGamepads?.()||[])if(pad){b.left||=pad.axes[0]<-.35||pad.buttons[14]?.pressed;b.right||=pad.axes[0]>.35||pad.buttons[15]?.pressed;b.up||=pad.axes[1]<-.35||pad.buttons[12]?.pressed;b.down||=pad.axes[1]>.35||pad.buttons[13]?.pressed;b.fire||=pad.buttons[0]?.pressed;}
  let stick=15;if(b.up)stick&=~1;if(b.down)stick&=~2;if(b.left)stick&=~4;if(b.right)stick&=~8;return {stick,fire:b.fire};
}
function events(list){
  for(const event of list) {
    if(event.type==='sound')audio.request(event.id);
    if(event.type==='level'||event.type==='death')labels();
    if(event.type==='gameover'||event.type==='complete'){
      $('ending-title').textContent=event.type==='complete'?(en?'YOU MADE IT!':'DOKÁZAL JSI TO!'):(en?'GAME OVER':'KONEC HRY');
      $('ending-score').textContent=(en?'Score: ':'Skóre: ')+game.score.slice().reverse().map(n=>n.toString(16).padStart(2,'0')).join('');
      $('ending').hidden=false;clearInput();
      if(event.type==='complete'){
        $('title-picture').src='assets/ending.png';$('title-picture').hidden=false;$('game').hidden=true;
        $('ending').classList.add('completed');
      }
    }
  }
}
function tick(){
  if(!started||paused||game.ended)return;
  if(game.stageFrames){const b=input();events(game.advanceStage(b.stick,b.fire));return;}
  if(++divider<3)return;divider=0;
  const b=input(),collision=screen.raster(game,{drawSprites:false,hud:false}).collisions;
  events(game.frame(b.stick,b.fire,collision));
}
let previous=performance.now(),accumulator=0;const fps=1773447/(312*114);
function frame(now){const elapsed=Math.min(now-previous,150);previous=now;if(!paused){accumulator+=elapsed;while(accumulator>=1000/fps){tick();accumulator-=1000/fps;}}if(started)screen.draw(game);requestAnimationFrame(frame);}
$('start').addEventListener('click',start);$('again').addEventListener('click',start);$('restart').addEventListener('click',start);
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',()=>pause(false));
$('sound-mode').addEventListener('click',()=>{audio.setMode(!audio.mode);audio.unlock().catch(audioError);labels();});
$('mute').addEventListener('click',()=>{audio.mute();if(!audio.muted)audio.unlock().catch(audioError);labels();});
$('fullscreen').addEventListener('click',async()=>{const target=document.querySelector('.arcade');try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement)document.webkitExitFullscreen();else if(target.requestFullscreen)await target.requestFullscreen();else target.webkitRequestFullscreen?.();}catch(error){console.warn('Fullscreen unavailable',error);}});
const mapped=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','ControlLeft','ControlRight']);
document.addEventListener('keydown',event=>{
  if(event.metaKey||event.altKey||event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
  if(mapped.has(event.code)){event.preventDefault();keys.add(event.code);if(!started&&event.code==='Space')start();}
  if(event.ctrlKey)return;if(event.repeat)return;
  if(event.code==='Enter'&&!started)start();
  if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();pause();}
  if(event.code==='KeyR')start();if(event.code==='KeyM'){$('sound-mode').click();event.preventDefault();}
  if(event.code==='KeyF'){$('fullscreen').click();event.preventDefault();}
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();if(started)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started)pause(true);}});
globalThis.fredDebug={get game(){return game;},get paused(){return paused;},get audio(){return {state:audio.context?.state,music:audio.mode,loaded:!!audio.buffer,muted:audio.muted};}};
labels();requestAnimationFrame(frame);

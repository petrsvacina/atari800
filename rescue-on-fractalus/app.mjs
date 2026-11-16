import {Fractalus,PAL_HZ} from './engine.mjs';
import {prepareCockpit,drawCockpit} from './cockpit.mjs';
import * as spriteApi from './sprites.mjs';
import {ThemeDriver} from './sound.mjs';
import {FractalusAudio} from './audio.mjs';
import {prepareIntro,IntroSequence} from './intro.mjs';

const $=id=>document.getElementById(id),en=new URLSearchParams(location.search).get('lang')==='en';
const words={'play-intro':'Play introduction','skip-intro':'Skip introduction · Enter / Space →',eyebrow:'1985 · RESCUE MISSION',intro:'You are not alone in the mountains.',paused:'PAUSED',resume:'▶ Continue',again:'Try again →',level:'Level',start:'Launch →',restart:'↺ Restart · R',pause:'Ⅱ Pause · P',mute:'♫ Sound on',fullscreen:'⛶ Fullscreen · F',thrust:'Thrust',land:'L · Land',systems:'S · Systems',airlock:'A · Airlock',boost:'B · Return',how:'Bring them home.',guide:'Find the downed pilots, land nearby and switch your systems off. Wait for a knock before opening the airlock. Return when the mothership light comes on.',controls:'CONTROLS',bank:'Bank left / right',pitch:'Descend / climb',fire:'Torpedo','thrust-change':'Change thrust',actions:'Land · systems · airlock · return',keys:'Pause · restart · fullscreen · sound',display:'DISPLAY',graphics:'Rendering','original-rate':'Original pace','smooth-rate':'Smoother display','graphics-hint':'Both modes use the same flight and input timing.',standard:'TV standard'};
if(en){document.documentElement.lang='en';document.querySelectorAll('[data-t]').forEach(el=>el.textContent=words[el.dataset.t]);$('back').textContent='← ALL GAMES';$('edition-caption').textContent='ATARI800 · WEB ARCADE';$('title-picture').alt='Original Rescue on Fractalus! cockpit';$('game').setAttribute('aria-label','Game screen');$('level').setAttribute('aria-label','Starting level');document.querySelector('[data-command="7"]').setAttribute('aria-label','Increase thrust');document.querySelector('[data-command="6"]').setAttribute('aria-label','Decrease thrust');}
$('back').href=(document.body.dataset.portalHome||'../dist/')+(en?'en/':'');document.querySelector('.brand').href='index.html'+(en?'?lang=en':'');
const audio=new FractalusAudio(),keys=new Set(),heldDuringIntro=new Set(),ctx=$('game').getContext('2d',{alpha:false});
let data,game,theme,intro,started=false,paused=false,failed=false,previous=performance.now(),accumulator=0,paintedTick=-1;
$('start').disabled=true;
function levels(min=1,max=16,current=4){$('level').replaceChildren(...Array.from({length:max-min+1},(_,i)=>new Option(String(min+i).padStart(2,'0'),String(min+i))));$('level').value=String(Math.min(max,Math.max(min,current)));}
levels();
try{$('graphics').value=localStorage.getItem('fractalus.graphics')||'original';}catch{}
const touch=globalThis.AtariTouchJoystick?.mount({host:document.querySelector('.touch-controls'),action:'shoot',enabled:()=>started&&!paused&&!intro&&!game?.ended&&game?.phase==='flight',onInteract:()=>audio.unlock().catch(audioError)});
function audioError(error){console.warn('Fractalus audio',error);$('phase').textContent=en?'Use the sound button to enable audio.':'Zvuk spustíš tlačítkem Zvuk.';}
function clearInput(){keys.clear();touch?.clear();if(game){game.commandQueue.length=0;game.input={port:255,fire:false};}}
function fatal(error){failed=true;paused=true;clearInput();audio.pause(true);$('error').hidden=false;$('error').textContent=(en?'The game stopped: ':'Hra se zastavila: ')+error.message;console.error(error);}
function labels(){
  $('skip-intro').hidden=!intro;
  for(const button of document.querySelectorAll('[data-command]'))button.disabled=!!intro;
  $('mute').textContent=audio.muted?(en?'♫ Sound off':'♫ Zvuk vypnutý'):(en?'♫ Sound on':'♫ Zvuk zapnutý');
  $('pause').textContent=paused?(en?'▶ Continue · P':'▶ Pokračovat · P'):(en?'Ⅱ Pause · P':'Ⅱ Pauza · P');
  if(paused)$('phase').textContent=en?'PAUSED':'PAUZA';
  else if(intro)$('phase').textContent=({logo:'LUCASFILM GAMES',carrier:en?'MOTHERSHIP':'MATEŘSKÁ LOĎ',hangar:en?'LAUNCH BAY':'STARTOVNÍ HANGÁR',tunnel:en?'LAUNCH TUNNEL':'STARTOVNÍ TUNEL',space:en?'SPACE':'VESMÍR',planet:'FRACTALUS',descent:en?'DESCENT':'SESTUP'})[intro.phase];
  else if(started)$('phase').textContent=game.phase==='flight'?`${en?'MISSION':'MISE'} ${String(game.state.level).padStart(2,'0')} · VALKYRIE`:game.phase==='gameover'?'GAME OVER':en?'MOTHERSHIP':'MATEŘSKÁ LOĎ';
}
function start({continueMission=false}={}) {
  if(!data)return;
  try {
    if(continueMission)game.launch(Number($('level').value));
    else game=new Fractalus(data,{level:Number($('level').value),seed:crypto.getRandomValues(new Uint32Array(1))[0],standard:$('standard').value,spriteApi});
    intro=$('play-intro').checked?new IntroSequence(data.intro,{level:game.state.level,includeStation:!continueMission,state:game.state}):null;
    started=true;paused=false;failed=false;accumulator=0;previous=performance.now();paintedTick=-1;clearInput();
    $('welcome').hidden=true;$('title-picture').hidden=true;$('game').hidden=false;$('pause-overlay').hidden=true;$('ending').hidden=true;$('error').hidden=true;$('standard').disabled=true;
    document.querySelector('.arcade').classList.add('is-playing');
    audio.clockHz=game.clockHz;audio.pause(false);audio.unlock().catch(audioError);audio.write(intro?intro.registers:game.registers);$('game').focus();labels();draw();
  } catch(error){fatal(error);}
}
function finishIntro(){intro=null;clearInput();accumulator=0;previous=performance.now();paintedTick=-1;audio.write(game.registers);labels();draw();}
function pause(value=!paused){if(!started||game.ended||failed)return;paused=value;clearInput();accumulator=0;previous=performance.now();$('pause-overlay').hidden=!value;audio.pause(value);labels();if(!value)$('game').focus();}
function input() {
  const b={left:keys.has('ArrowLeft'),right:keys.has('ArrowRight'),up:keys.has('ArrowUp'),down:keys.has('ArrowDown'),fire:keys.has('Space')||keys.has('ControlLeft')||keys.has('ControlRight')};
  touch?.buttons(b);
  for(const pad of navigator.getGamepads?.()||[])if(pad){b.left||=pad.axes[0]<-.35||pad.buttons[14]?.pressed;b.right||=pad.axes[0]>.35||pad.buttons[15]?.pressed;b.up||=pad.axes[1]<-.35||pad.buttons[12]?.pressed;b.down||=pad.axes[1]>.35||pad.buttons[13]?.pressed;b.fire||=pad.buttons[0]?.pressed||pad.buttons[7]?.pressed;}
  let port=255;if(b.up)port&=~1;if(b.down)port&=~2;if(b.left)port&=~4;if(b.right)port&=~8;return {port,fire:b.fire};
}
function draw() {
  if(intro){intro.draw(ctx);return;}
  const terrain=game.terrain($('graphics').value==='smooth');
  const state=game.cockpitState();drawCockpit(ctx,state,terrain);spriteApi.drawSprites(ctx,state,game.pm,{terrain});
  if(game.state.viewportEnabled===false){ctx.fillStyle='#000';ctx.fillRect(0,22,320,94);}
  paintedTick=game.ticks;
}
function events() {
  for(const event of game.events.splice(0)) {
    clearInput();
    if(event.type==='mission') {
      levels(event.minimum,event.maximum,event.minimum);
      $('ending-title').textContent=event.completed?(en?'MISSION COMPLETE':'MISE SPLNĚNA'):(en?'WELCOME ABOARD':'VÍTEJ NA PALUBĚ');
      $('again').textContent=en?'Next mission →':'Další mise →';$('welcome').hidden=false;$('start').hidden=true;
    } else if(event.type==='gameover') {
      $('ending-title').textContent='GAME OVER';$('again').textContent=en?'Try again →':'Zkusit znovu →';levels();$('standard').disabled=false;
    }
    $('ending-score').textContent=(en?'Score: ':'Skóre: ')+game.state.score;$('ending').hidden=false;labels();
  }
}
function frame(now) {
  const elapsed=Math.min(150,Math.max(0,now-previous));previous=now;
  if(data&&!paused&&!failed) {
    accumulator+=elapsed;const interval=1000/(started?game.hz:PAL_HZ);
    try {
      while(accumulator>=interval) {
        if(intro){if(!intro.tick()){finishIntro();break;}audio.write(intro.registers);}
        else if(started&&!game.ended&&game.phase!=='standby'){game.tick(input());audio.write(game.registers);events();}
        else if(!started){theme.step();audio.write(theme.registers);}
        accumulator-=interval;
      }
      if(intro){labels();draw();}else if(started&&paintedTick!==game.ticks)draw();
    } catch(error){fatal(error);}
  }
  requestAnimationFrame(frame);
}
$('start').addEventListener('click',()=>start());$('again').addEventListener('click',()=>start({continueMission:game?.phase==='standby'}));$('restart').addEventListener('click',()=>start());
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',()=>pause(false));
$('skip-intro').addEventListener('click',()=>{if(intro)finishIntro();});
$('mute').addEventListener('click',()=>{audio.mute();if(!audio.muted)audio.unlock().catch(audioError);labels();});
$('graphics').addEventListener('change',()=>{try{localStorage.setItem('fractalus.graphics',$('graphics').value);}catch{}paintedTick=-1;if(started)draw();});
$('fullscreen').addEventListener('click',async()=>{const target=document.querySelector('.arcade');try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.webkitFullscreenElement)document.webkitExitFullscreen();else if(target.requestFullscreen)await target.requestFullscreen();else target.webkitRequestFullscreen?.();}catch(error){console.warn('Fullscreen',error);}clearInput();});
for(const button of document.querySelectorAll('[data-command]'))button.addEventListener('click',()=>{if(started&&!paused&&!intro){game.command(Number(button.dataset.command));audio.unlock().catch(audioError);}});
const commands={KeyL:0,KeyA:63,KeyB:21,KeyS:62,Equal:7,NumpadAdd:7,Minus:6,NumpadSubtract:6};
const stickKeys=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ControlLeft','ControlRight']);
document.addEventListener('keydown',event=>{
  if(event.metaKey||event.altKey||event.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
  if(heldDuringIntro.has(event.code)){event.preventDefault();return;}
  if(intro&&(event.code==='Space'||event.code==='Enter')){event.preventDefault();heldDuringIntro.add(event.code);if(!event.repeat&&!paused)finishIntro();return;}
  if(intro&&(stickKeys.has(event.code)||event.code in commands)){event.preventDefault();heldDuringIntro.add(event.code);return;}
  if(stickKeys.has(event.code)){event.preventDefault();keys.add(event.code);if(!started&&event.code==='Space'&&!event.repeat)start();}
  if(event.ctrlKey||event.repeat)return;
  if(event.code in commands){event.preventDefault();if(started&&!paused)game.command(commands[event.code]);}
  if(event.code==='Enter'&&!started)start();
  if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();pause();}
  if(event.code==='KeyR')start();if(event.code==='KeyF'){event.preventDefault();$('fullscreen').click();}if(event.code==='KeyM'){event.preventDefault();$('mute').click();}
});
document.addEventListener('keyup',event=>{keys.delete(event.code);heldDuringIntro.delete(event.code);});
window.addEventListener('blur',()=>{heldDuringIntro.clear();clearInput();if(started)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started)pause(true);}});
globalThis.fractalusDebug={get game(){return game;},get intro(){return intro;},get paused(){return paused;},get audio(){return {state:audio.context?.state,loaded:!!audio.node,muted:audio.muted};}};
try {
  const names=['bootstrap','trigonometry','geometry','raster','objects','sound','rescue','systems','lifecycle','cockpit','sprites','timing','intro'];
  const values=globalThis.FRACTALUS_ASSETS?names.map(name=>globalThis.FRACTALUS_ASSETS[name]):await Promise.all(names.map(async name=>{const response=await fetch(new URL(`./assets/${name}.json`,import.meta.url));if(!response.ok)throw new Error(`${name}: ${response.status}`);return response.json();}));
  const loaded=Object.fromEntries(names.map((name,i)=>[name,values[i]]));prepareCockpit(loaded.cockpit);spriteApi.prepareSprites(loaded.sprites);loaded.intro=await prepareIntro(loaded.intro);theme=new ThemeDriver(loaded.sound);data=loaded;$('start').disabled=false;
}catch(error){fatal(error);}
labels();previous=performance.now();requestAnimationFrame(frame);

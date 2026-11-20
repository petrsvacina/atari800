import {decodeAssets,renderFrame,rgbaImage} from './raster.mjs';
import {Robbo,RobboRandom,PAL_HZ} from './engine.mjs';
import {Sound} from './sound.mjs';
import {RobboAudio} from './audio.mjs';
import {TitleLogo,TitleTypist,prepareTitle} from './title.mjs';
import {renderTitle} from './title-raster.mjs';
import {Ending,prepareEnding} from './ending.mjs';

const $=id=>document.getElementById(id);
const english=new URLSearchParams(location.search).get('lang')==='en';
const text=english?{
  eyebrow:'1989 · ACTION PUZZLE',intro:'One little robot. Fifty-six ways home.',
  start:'Start game →','start-hint':'Collect the screws. Find your capsule.',restart:'↺ Restart · R',pause:'Ⅱ Pause · P',paused:'PAUSED','pause-hint':'The next screw can wait.',resume:'▶ Resume',
  'sound-on':'♫ Sound on · M','sound-off':'♫ Sound off · M',fullscreen:'⛶ Fullscreen · F',mission:'ONE SCREW AT A TIME.',
  guide:'Collect the required screws on each planet, then return to the open capsule. Push crates, unlock doors and watch out for magnets, bullets and the inhabitants of these worlds.',
  controls:'CONTROLS',move:'Move / push a crate',fire:'FIRE + direction: shoot',suicide:'Retry at the cost of one life',shortcuts:'Pause · restart · sound · fullscreen',gamepad:'Gamepad and touch joystick supported.',
  journey:'56 ORIGINAL PLANETS',checkpoint:'You start with eight spare lives. After game over, restart from the beginning of the last group of four planets.',footer:'Native HTML5 version · Original levels, graphics and sound effects.',
  gameover:'GAME OVER',again:'Play again →',back:'← ALL GAMES',edition:'ATARI800 · WEB ARCADE',title:'56 PLANETS · ONE ROBOT',planet:'PLANET',demo:'DEMONSTRATION',congratulations:'THE JOURNEY HOME',score:'Score',continue:'Start from planet',
}:{
  'sound-on':'♫ Zvuk zapnutý · M','sound-off':'♫ Zvuk vypnutý · M',back:'← VŠECHNY HRY',edition:'ATARI800 · WEBOVÁ HERNA',title:'56 PLANET · JEDEN ROBOT',planet:'PLANETA',demo:'UKÁZKA HRY',congratulations:'CESTA DOMŮ',score:'Skóre',continue:'Začít od planety',
};
document.documentElement.lang=english?'en':'cs';
for(const node of document.querySelectorAll('[data-t]'))if(text[node.dataset.t])node.textContent=text[node.dataset.t];
const portalHome=document.body.dataset.portalHome||'../dist/';
$('back').textContent=text.back;
$('back').href=portalHome+(english?'en/':'');
$('edition-caption').textContent=text.edition;
$('brand').href=english?'?lang=en':'index.html';$('language').textContent=english?'Česky →':'English →';$('language').href=english?'?lang=cs':'?lang=en';$('language').lang=english?'cs':'en';
const assets=decodeAssets(),media=globalThis.ROBBO_MEDIA;
const sound=new Sound(media.sound),audio=new RobboAudio(),titleData=prepareTitle(media.title);
const endingData=await prepareEnding(media.ending);
const canvas=$('game'),context=canvas.getContext('2d',{alpha:false}),arcade=document.querySelector('.arcade'),screen=document.querySelector('.screen');
const keys=new Set(),suppressed=new Set();let game=null,ending=null,checkpoint=0,paused=false,clock=0,logo,typist,titleRandom,endingArmed=false,touchBlocked=false,gamepadBlocked=false;
function clearInput(){for(const key of keys)suppressed.add(key);keys.clear();touch?.clear();touchBlocked=true;gamepadBlocked=true;}
function safeUnlock(){audio.unlock().catch(error=>console.warn('Robbo audio:',error));}
function title({tail=null}={}){
  clearInput();game=null;ending=null;paused=false;audio.pause(false);
  if(tail===null)sound.reset();else sound.trigger(tail);
  titleRandom=new RobboRandom(0);logo=new TitleLogo(titleData,{random:()=>titleRandom.next()});typist=new TitleTypist(titleData,{clock});logo.step(clock);
  $('welcome').hidden=false;$('pause-overlay').hidden=true;$('gameover').hidden=true;screen.classList.remove('is-playing');arcade.classList.remove('is-playing');updateLabels();draw();
}
function start({demo=false}={}){
  clearInput();paused=false;audio.pause(false);ending=null;
  game=new Robbo(assets,{level:checkpoint,seed:0,sound,demo});game.state.clock=clock;
  $('welcome').hidden=!demo;$('pause-overlay').hidden=true;$('gameover').hidden=true;screen.classList.toggle('is-playing',!demo);arcade.classList.toggle('is-playing',!demo);updateLabels();canvas.focus();draw();
}
function begin(){safeUnlock();start();}
function pause(value=!paused){if(!game&&!ending)return;paused=value;clearInput();audio.pause(value);$('pause-overlay').hidden=!value;if(!value)canvas.focus();}
function updateLabels(){
  $('phase').textContent=ending?text.congratulations:game?`${game.state.demo?text.demo:text.planet} ${String(game.state.level+1).padStart(2,'0')} / 56`:text.title;
  $('mute').textContent=text[audio.muted?'sound-off':'sound-on'];$('mute').setAttribute('aria-pressed',String(!audio.muted));
  $('start').textContent=checkpoint?`${text.continue} ${String(checkpoint+1).padStart(2,'0')} →`:(text.start??'Začít hru →');
}
function bcdScore(score){return Array.from(score,n=>(n>>>4).toString()+(n&15).toString()).join('').replace(/^0+(?=\d)/,'');}
function input(){
  const value={left:keys.has('ArrowLeft')||keys.has('KeyA'),right:keys.has('ArrowRight')||keys.has('KeyD'),up:keys.has('ArrowUp')||keys.has('KeyW'),down:keys.has('ArrowDown')||keys.has('KeyS'),fire:keys.has('Space')||keys.has('ShiftLeft')||keys.has('ShiftRight')};
  const stick=touch?.read();if(!stick?.fire)touchBlocked=false;
  if(stick){for(const key of ['left','right','up','down'])value[key]||=stick[key];value.fire||=stick.fire&&!touchBlocked;}
  const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);
  if(pad){
    const fire=!!pad.buttons[0]?.pressed||!!pad.buttons[1]?.pressed;if(!fire)gamepadBlocked=false;value.fire||=fire&&!gamepadBlocked;
    value.left||=pad.axes[0]<-.4||!!pad.buttons[14]?.pressed;value.right||=pad.axes[0]>.4||!!pad.buttons[15]?.pressed;
    value.up||=pad.axes[1]<-.4||!!pad.buttons[12]?.pressed;value.down||=pad.axes[1]>.4||!!pad.buttons[13]?.pressed;
  }else gamepadBlocked=false;
  return{stick:15&~(value.up?1:0)&~(value.down?2:0)&~(value.left?4:0)&~(value.right?8:0),fire:value.fire};
}
const touch=globalThis.AtariTouchJoystick?.mount({host:document.querySelector('.touch-controls'),action:'shoot',enabled:()=>!!game&&!game.state.demo&&!paused&&game.phase!=='gameover',onInteract:()=>safeUnlock()});
function tick(){
  clock=(clock+1)&255;const controls=input();
  if(ending){
    if(!controls.fire)endingArmed=true;ending.step({fire:endingArmed&&controls.fire});audio.write(ending.registers);
    if(ending.done){checkpoint=0;title({tail:ending.returnEffect});}return;
  }
  if(game){
    if(game.state.demo&&controls.fire){begin();return;}
    game.tick(controls);clock=game.state.clock;
    for(const event of game.events.splice(0)){
      if(event.type==='gameover'){
        checkpoint=event.checkpoint;$('result').textContent=`${text.score}: ${bcdScore(event.score)} · ${text.continue} ${checkpoint+1}`;$('gameover').hidden=false;clearInput();
      }
      if(event.type==='complete'){ending=new Ending(endingData,{random:()=>game.randomByte()});endingArmed=false;clearInput();}
      if(event.type==='demo-end'){title();return;}
    }
    audio.write(sound.registers,sound.footsteps.splice(0));updateLabels();return;
  }
  titleRandom.advance(35568);sound.step(clock);typist.step(clock);logo.step(clock);sound.titleTick(typist.soundKind);audio.write(sound.registers);
  if(typist.demoRequested)start({demo:true});
}
function draw(){
  const frame=ending?{width:320,height:240,pixels:ending.pixels}:game?renderFrame(assets,game.state):renderTitle(assets,titleData,logo,typist);
  const rgba=rgbaImage(ending?{palette:ending.data.palette}:assets,frame);context.putImageData(new ImageData(rgba.data,320,240),0,0);
}
async function fullscreen(){
  clearInput();const active=document.fullscreenElement||document.webkitFullscreenElement;
  if(active){await(document.exitFullscreen?.()??document.webkitExitFullscreen?.());return;}
  if(arcade.classList.contains('is-fullscreen')){arcade.classList.remove('is-fullscreen');document.body.classList.remove('robbo-fullscreen');return;}
  try{const request=arcade.requestFullscreen??arcade.webkitRequestFullscreen;if(request){await request.call(arcade);return;}}catch{/* iPhone and restricted hosts use a full-window view. */}
  arcade.classList.add('is-fullscreen');document.body.classList.add('robbo-fullscreen');
}
$('start').addEventListener('click',begin);$('again').addEventListener('click',begin);$('restart').addEventListener('click',()=>{if(game)checkpoint=game.state.level&252;title();});
$('pause').addEventListener('click',()=>pause());$('resume').addEventListener('click',()=>{safeUnlock();pause(false);});
$('mute').addEventListener('click',()=>{safeUnlock();audio.mute();updateLabels();});$('fullscreen').addEventListener('click',()=>fullscreen().catch(console.warn));
const gameplayKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','Space','ShiftLeft','ShiftRight']);
document.addEventListener('keydown',event=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName))return;
  if(gameplayKeys.has(event.code)){
    if(event.target?.tagName==='BUTTON'&&event.code==='Space')return;
    event.preventDefault();if(suppressed.has(event.code)||event.repeat)return;
    if(event.target?.tagName==='BUTTON')canvas.focus();
    safeUnlock();if((!game||game.state.demo)&&!ending&&['Space','ShiftLeft','ShiftRight'].includes(event.code)){begin();suppressed.add(event.code);return;}
    if(!paused)keys.add(event.code);return;
  }
  if(event.repeat)return;
  if(event.code==='KeyF'){event.preventDefault();fullscreen().catch(console.warn);}
  if(event.code==='KeyP'){event.preventDefault();pause();}
  if(event.code==='KeyM'){event.preventDefault();safeUnlock();audio.mute();updateLabels();}
  if(event.code==='KeyR'){event.preventDefault();if(game)checkpoint=game.state.level&252;title();}
  if(event.code==='Escape'){
    if(arcade.classList.contains('is-fullscreen')){fullscreen();return;}
    if(!paused&&!ending&&game&&!game.state.demo)game.kill();
  }
});
document.addEventListener('keyup',event=>{keys.delete(event.code);suppressed.delete(event.code);});
function background(){clearInput();if((game||ending)&&!paused)pause(true);}
globalThis.addEventListener('blur',background);document.addEventListener('visibilitychange',()=>{if(document.hidden)background();});document.addEventListener('fullscreenchange',clearInput);
let previous=performance.now(),accumulator=0;
function frame(now){const elapsed=Math.min(100,Math.max(0,now-previous));previous=now;if(!paused){accumulator+=elapsed;while(accumulator>=1000/PAL_HZ){accumulator-=1000/PAL_HZ;tick();}draw();}else accumulator=0;requestAnimationFrame(frame);}
globalThis.robboDebug={get game(){return game;},get ending(){return ending;},get typist(){return typist;},get audio(){return audio;},start:(level=0)=>{checkpoint=Math.min(55,Math.max(0,level|0));start();},tick,draw};
title();requestAnimationFrame(frame);

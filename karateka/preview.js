(function(){'use strict';
const english=new URLSearchParams(location.search).get('lang')==='en';
const messages={preview:'DEVELOPMENT PREVIEW',eyebrow:'THE ROAD TO AKUMA’S PALACE',title:'Original movement.<br>A livelier pace.',lead:'Local combat preview. The campaign, cinematics and sound are still in progress.',arena:'COMBAT PREVIEW',reset:'↺ Restart',pause:'Ⅱ Pause',fullscreen:'⛶ Fullscreen',ready:'Press Space to take a fighting stance.',stance:'STANCE',punch:'PUNCH',kick:'KICK',tempo:'PACE',slow:'Relaxed · 12 steps/s',normal:'Lively · 18 steps/s',fast:'Fast · 24 steps/s',guard:'GUARD APPEARANCE',controls:'CONTROLS',move:'Move',stance2:'Fighting stance / stand up',punches:'Punch high / middle / low',kicks:'Kick high / middle / low',bow:'Bow',pause2:'Pause',note:'This preview checks the integration of animation and combat. It is not a completed port of the whole game.'};
if(english){document.documentElement.lang='en';document.title='Karateka · development preview';for(const el of document.querySelectorAll('[data-t]'))el.innerHTML=messages[el.dataset.t];document.querySelector('#language').textContent='ČESKY ↗';document.querySelector('#language').href='?lang=cs';}
const $=s=>document.querySelector(s),canvas=$('#game'),ctx=canvas.getContext('2d'),game=new KaratekaFight(),keys=new Set(),once=new Set();
const bitmap=new KaratekaBitmap(),characters=new KaratekaCharacters(),backgroundPixels=new Uint8Array(160*153),raw=atob(KARATEKA_PREVIEW_BACKGROUND),screen=document.createElement('canvas');screen.width=160;screen.height=153;const screenContext=screen.getContext('2d');
for(let i=0;i<raw.length;i++)for(let pixel=0;pixel<4;pixel++)backgroundPixels[i*4+pixel]=raw.charCodeAt(i)>>(6-pixel*2)&3;
let loaded=true,paused=false,previous=0,accumulator=0,lastPhase='';
function restart(){game.reset(Number($('#guard').value));paused=false;keys.clear();once.clear();accumulator=0;lastPhase='';status();paint();}
function status(){if(game.phase===lastPhase)return;lastPhase=game.phase;$('#status').textContent=game.phase==='lost'?(english?'The guard won. Restart to try another pace.':'Stráž zvítězila. Zkus nový souboj nebo jiné tempo.'):game.phase==='won'?(english?'The guard is defeated. This preview ends here.':'Stráž je poražena. Tento náhled zde končí.'):(english?messages.ready:'Mezerníkem přejdi do bojového postoje.');}
function input(){let height=keys.has('ArrowUp')?-1:keys.has('ArrowDown')?1:0,punch=false,kick=false;
 for(const [code,h,kind] of [['KeyQ',-1,0],['KeyA',0,0],['KeyZ',1,0],['KeyW',-1,1],['KeyS',0,1],['KeyX',1,1]])if(keys.has(code)){height=h;if(kind)kick=true;else punch=true;}
 const result={move:(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),height,punch,kick,stance:once.has('Space'),bow:once.has('KeyB')};once.clear();return result;
}
function health(){
 bitmap.rectangle(0,181,40,188,0);
 if(game.health[0]>=3||game.clock&1){let x=0,phase=1;for(let i=0;i<game.health[0];i++){bitmap.blit(KARATEKA_ART.art[0x0b12],x,181,phase,1,true);phase+=2;if(phase>=8){phase-=8;x++;}x++;}}
 if(game.health[1]>=3||game.clock&1){let x=38,phase=6;for(let i=0;i<game.health[1];i++){bitmap.blit(KARATEKA_ART.art[0x0b1c],x,181,phase,1);phase-=2;if(phase<0){phase+=8;x--;}x--;}}
}
const color0=[6,6,6],pink=[228,137,144],white=[226,226,226],sky=[94,181,255],grey=[134,134,134],blue=[67,135,253],dimPink=[202,108,122];
const skyPalette=[color0,pink,sky,white],playPalette=[color0,pink,grey,white],statusPalette=[color0,dimPink,blue,white];
function paint(){ctx.imageSmoothingEnabled=false;ctx.fillStyle='#060606';ctx.fillRect(0,0,320,240);if(!loaded){ctx.fillStyle='#ddd';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(english?'LOADING…':'NAČÍTÁNÍ…',160,120);return;}
 bitmap.pixels.set(backgroundPixels);characters.lowerMask(bitmap,game.hero);characters.lowerMask(bitmap,game.enemy);characters.draw(bitmap,game.hero);characters.draw(bitmap,game.enemy,0,game.kind,true);health();screenContext.putImageData(new ImageData(bitmap.rgba(y=>y<82?skyPalette:y<146?playPalette:statusPalette),160,153),0,0);ctx.fillStyle='rgb('+sky.join(',')+')';ctx.fillRect(0,24,320,24);ctx.drawImage(screen,0,0,160,146,0,48,320,146);ctx.drawImage(screen,0,146,160,7,0,198,320,7);
 if(paused||game.phase!=='playing'){ctx.fillStyle='#060606b5';ctx.fillRect(60,78,200,44);ctx.textAlign='center';ctx.font='bold 12px monospace';ctx.fillStyle='#e6bd80';ctx.fillText(paused?(english?'PAUSED':'PAUZA'):game.phase==='won'?(english?'GUARD DEFEATED':'STRÁŽ PORAŽENA'):(english?'DEFEAT':'PORÁŽKA'),160,104);}
}
function frame(now){const delta=Math.min(200,Math.max(0,now-previous));previous=now;if(loaded&&!paused&&!document.hidden){accumulator+=delta;const step=1000/Number($('#tempo').value);let count=0;while(accumulator>=step&&count++<6){game.tick(input());accumulator-=step;}status();}else accumulator=0;paint();requestAnimationFrame(frame);}
function togglePause(){paused=!paused;keys.clear();once.clear();paint();}
const accepted=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyQ','KeyA','KeyZ','KeyW','KeyS','KeyX','KeyB']);
window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='KeyP'){if(!e.repeat)togglePause();e.preventDefault();return;}if(!accepted.has(e.code))return;e.preventDefault();if(!keys.has(e.code))once.add(e.code);keys.add(e.code);});window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();once.clear();paused=true;});
for(const button of document.querySelectorAll('[data-key]')){const code=button.dataset.key;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(code);once.add(code);});for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(code));}
$('#reset').onclick=restart;$('#guard').onchange=restart;$('#pause').onclick=togglePause;$('#tempo').onchange=()=>{accumulator=0;};$('#fullscreen').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await $('#arcade').requestFullscreen?.();};canvas.onclick=()=>{canvas.focus();if(paused)togglePause();};status();requestAnimationFrame(frame);
// Read-only QA snapshot; no emulated CPU or original program is present.
window.karatekaPreview={game,get paused(){return paused;},get loaded(){return loaded;}};
})();

import {Adventure2} from './engine.mjs';
import {render2,readable2} from './screen.mjs';
import {StoryMusic} from './audio.mjs';

const data=globalThis.NEVERENDING2_DATA,$=id=>document.getElementById(id);
const store={get(key){try{return localStorage.getItem('neverending-story-2-'+key);}catch{return null;}},set(key,value){localStorage.setItem('neverending-story-2-'+key,value);}};
const words={
  cs:{category:'2021 · GRAFICKÁ ADVENTURA',subtitle:'Nekonečný příběh pokračuje.',edition:'ATARI800 · WEBOVÁ HERNA',back:'← VŠECHNY HRY',
    start:'Začít příběh →',continue:'Pokračovat →',send:'Provést ↵',prompt:'Napiš příkaz…',input:'Příkaz',new:'↺ Nová hra',save:'↓ Uložit',load:'↑ Načíst',manual:'Návod ↗',
    soundOn:'♫ Zvuk zapnutý',soundOff:'♫ Zvuk vypnutý',fullscreen:'⛶ Celá obrazovka',travel:'Kam dál?',actions:'Rozhlédni se. Zeptej se. Objevuj.',
    help:'Použij původní zkratky příkazů. Diakritiku převedeme automaticky. Přepnutí CZ/EN zachová rozehranou hru a změní i její texty a příkazy.',
    examples:'Například: s · pro krovi · seb bobule',dirs:['S','V','J','Z'],commands:['s','v','j','z'],quick:[['Rozhlédnout','r'],['Inventář','i']],verbs:[['Prozkoumat','pro'],['Sebrat','seb'],['Použít','pou'],['Dát','dej'],['Číst','cti'],['Říct','rek']],
    slots:'Vyber pozici',empty:'Prázdná pozice',part:'Část',room:'Místnost',intro:'Úvod',saved:'Hra uložena.',loaded:'Hra načtena.',switched:'Jazyk změněn. Rozehraná hra pokračuje.',
    error:'Operace se nezdařila.',confirm:'Začít novou hru? Neuložený postup se ztratí.',musicError:'Hudbu se nepodařilo spustit.',transcript:'Text příběhu'},
  en:{category:'2021 · GRAPHIC ADVENTURE',subtitle:'The story continues.',edition:'ATARI800 · WEB ARCADE',back:'← ALL GAMES',
    start:'Begin the story →',continue:'Continue →',send:'Enter ↵',prompt:'Type a command…',input:'Command',new:'↺ New game',save:'↓ Save',load:'↑ Load',manual:'Manual ↗',
    soundOn:'♫ Sound on',soundOff:'♫ Sound off',fullscreen:'⛶ Fullscreen',travel:'Where next?',actions:'Look around. Ask. Discover.',
    help:'Use the original command abbreviations. Switching CZ/EN keeps your progress and changes both the story text and command vocabulary.',
    examples:'For example: n · exa bush · take berries',dirs:['N','E','S','W'],commands:['n','e','s','w'],quick:[['Look around','r'],['Inventory','i']],verbs:[['Examine','exa'],['Take','take'],['Use','use'],['Give','give'],['Read','rea'],['Say','say']],
    slots:'Choose a slot',empty:'Empty slot',part:'Part',room:'Room',intro:'Introduction',saved:'Game saved.',loaded:'Game loaded.',switched:'Language changed. Your adventure continues.',
    error:'The operation failed.',confirm:'Start a new game? Unsaved progress will be lost.',musicError:'Music playback is unavailable.',transcript:'Story text'},
};
let language=new URL(location.href).searchParams.get('lang')||store.get('language')||'cs';if(!words[language])language='cs';
let started=false,sound=store.get('sound')!=='off',musicEpoch=0;const t=key=>words[language][key];
const game=new Adventure2(data,language),music=new StoryMusic(globalThis.NEVERENDING2_AUDIO);
function status(key){$('status').textContent=t(key);}
function paint(){
  render2($('game'),data,game);
  $('chapter').textContent=game.part?['','I','II'][game.part]+' / II':t('intro');
  $('location').textContent=game.part?'FANTASIA · '+t('part').toUpperCase()+' '+game.part:'FANTASIA';
  const input=started&&game.phase==='input';$('command').disabled=$('send').disabled=!input;
  $('save').disabled=!started;$('overlay').hidden=started&&game.phase!=='pause';
  $('overlay').dataset.mode=started?'pause':'start';$('continue').textContent=t(started?'continue':'start');
  for(const b of document.querySelectorAll('#compass button,#quick button,#verbs button'))b.disabled=!input;
  $('transcript').textContent=readable2(game.events.filter(e=>e[0]==='text').map(e=>e[1]).join(''),language);
}
async function play(){if(!started)return;music.setEnabled(sound);const restart=musicEpoch!==game.musicEpoch;musicEpoch=game.musicEpoch;try{await music.play(restart);}catch{status('musicError');}}
function localize(){
  document.documentElement.lang=language;
  const home=document.body.dataset.portalHome;
  $('back').href=home?home+(language==='en'?'en/':''):'../'+(language==='en'?'?lang=en':'');$('back').textContent=t('back');
  document.querySelector('.brand').href='index.html?lang='+language;
  const labels={category:'category',subtitle:'subtitle','edition-caption':'edition',send:'send',new:'new',save:'save',load:'load',manual:'manual',fullscreen:'fullscreen',
    'travel-title':'travel','actions-title':'actions',help:'help',examples:'examples','transcript-title':'transcript'};
  for(const [id,key] of Object.entries(labels))$(id).textContent=t(key);
  $('manual').href=language==='cs'?'assets/manual-cs.pdf':'assets/manual-en.jpg';$('manual').hreflang=language;
  $('sound').textContent=t(sound?'soundOn':'soundOff');$('sound').setAttribute('aria-pressed',String(sound));
  $('command').placeholder=t('prompt');$('command').setAttribute('aria-label',t('input'));
  $('game').setAttribute('aria-label',language==='cs'?'Herní obrazovka':'Game screen');
  for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===language));
  $('compass').replaceChildren();
  const positions=[null,0,null,3,'center',1,null,2,null];
  for(const direction of positions){
    const el=document.createElement(typeof direction==='number'?'button':'span');
    if(typeof direction==='number'){el.type='button';el.textContent=words[language].dirs[direction];el.onclick=()=>command(words[language].commands[direction]);el.dataset.direction=direction;}
    else if(direction==='center'){el.className='center';el.textContent='✧';}
    $('compass').append(el);
  }
  $('quick').replaceChildren();for(const [label,line] of words[language].quick){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>command(line);$('quick').append(b);}
  $('verbs').replaceChildren();for(const [label,verb] of words[language].verbs){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{$('command').value=verb+' ';$('command').focus();};$('verbs').append(b);}
  paint();
}
function command(text){
  if(!started||game.phase!=='input')return;
  const line=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().slice(0,30);
  $('command').value='';game.command(line);paint();void play();
}
function resume(){
  if(!started){started=true;game.reset(0);}else game.continue();
  paint();void play();
}
async function slots(mode){
  const dialog=$('slots');$('slots-title').textContent=t('slots');$('slots-list').replaceChildren();
  for(let i=1;i<=8;i++){
    let saved=null;try{saved=JSON.parse(store.get('slot-'+i));}catch{}
    if(saved?.game?.format!=='neverending-story-2-native')saved=null;
    const b=document.createElement('button');b.type='button';b.textContent=String(i).padStart(2,'0')+' · '+(saved?(saved.game.part?t('part')+' '+saved.game.part+' · '+t('room')+' '+saved.game.room:t('intro')):t('empty'));
    if(saved){const date=document.createElement('small');date.textContent=new Date(saved.time).toLocaleString(language==='cs'?'cs-CZ':'en-GB');b.append(date);}
    b.disabled=mode==='load'&&!saved;
    b.onclick=()=>{try{if(mode==='save'){store.set('slot-'+i,JSON.stringify({time:Date.now(),game:game.snapshot()}));status('saved');}
      else{game.restore(saved.game,language);started=true;status('loaded');paint();void play();}dialog.close();}catch(e){console.error(e);status('error');}};
    $('slots-list').append(b);
  }
  dialog.showModal();
}
for(const b of document.querySelectorAll('[data-lang]'))b.onclick=()=>{
  language=b.dataset.lang;game.setLanguage(language);try{store.set('language',language);}catch{}
  const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);
  localize();status('switched');
};
$('continue').onclick=resume;$('command-form').onsubmit=e=>{e.preventDefault();command($('command').value);};
$('new').onclick=()=>{if(!started||confirm(t('confirm'))){started=true;game.reset(0);paint();void play();}};
$('save').onclick=()=>slots('save');$('load').onclick=()=>slots('load');
$('sound').onclick=()=>{sound=!sound;try{store.set('sound',sound?'on':'off');}catch{}music.setEnabled(sound);localize();void play();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.machine').requestFullscreen();}catch{status('error');}};
document.addEventListener('keydown',e=>{if(e.repeat||$('slots').open||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if((e.code==='Space'||e.code==='Enter')&&!$('overlay').hidden){e.preventDefault();resume();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)music.pause();else if(started)music.resume();});
globalThis.neverstory2Debug={game,command,continue:resume,snapshot:()=>game.snapshot(),get started(){return started;}};
localize();

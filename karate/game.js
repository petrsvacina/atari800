(function () {
  'use strict';
const I=globalThis.AtariI18n||{t:value=>value,html:value=>value,locale:'cs-CZ'};
  const $=id=>document.getElementById(id), Engine=globalThis.KarateEngine;
  const canvas=$('arena'),ctx=canvas.getContext('2d'),keys=new Set(),touches=new Map();
  const storage={get(key,fallback){try{return localStorage.getItem('karate-'+key)||fallback;}catch(_){return fallback;}},set(key,value){try{localStorage.setItem('karate-'+key,value);}catch(_){}}};
  let game=null,paused=false,muted=storage.get('muted','false')==='true',lastTime=0,accumulator=0;
  let menuScene=0,moveTab='normal',uiStamp='',lastPhase='',touchFire=false,gamepadFire=false,gamepadPause=false;
  const audio=new KarateAudio({onStatus:message=>$('audio-status').textContent=I.t(message)});
  const backgrounds=KARATE_BACKGROUNDS.map(item=>{const image=new Image();image.src=item.src;return {...item,image};});
  for(const id of ['mode','difficulty','sound-mode']) {
    const value=storage.get(id,$(id).value);
    if([...$(id).options].some(option=>option.value===value))$(id).value=value;
    $(id).addEventListener('change',()=>{storage.set(id,$(id).value);if(id==='mode')updateSettings();syncAudio();});
  }
  const palette=KARATE_PALETTE.fighters;
  const sprites=palette.map(colors=>KARATE_FIGHTERS.frames.map(frame=>{
    const image=document.createElement('canvas');image.width=80;image.height=96;
    const context=image.getContext('2d');let tile=0;
    for(let row=0;row<12;row++) {
      const layout=frame.layout[row],offset=layout>>4,length=layout&15;
      for(let col=0;col<length;col++,tile++)for(let y=0;y<8;y++) {
        const packed=frame.data[tile*8+y];
        for(let x=0;x<4;x++) {
          const color=(packed>>(6-x*2))&3;if(!color)continue;
          context.fillStyle=colors[color];context.fillRect((offset+col)*8+x*2,row*8+y,2,1);
        }
      }
    }
    return image;
  }));
  const refereeSprites=new Map(KARATE_REFEREE.frames.map(frame=>{
    const image=document.createElement('canvas');image.width=KARATE_REFEREE.width;image.height=KARATE_REFEREE.height;
    const context=image.getContext('2d');
    for(let i=0;i<frame.pixels.length;i++)if(frame.pixels[i]){
      context.fillStyle=KARATE_REFEREE.palette[frame.pixels[i]];
      context.fillRect(i%image.width,Math.floor(i/image.width),1,1);
    }
    return [frame.id,image];
  }));
  function syncAudio(){audio.sync(!!game,paused,$('sound-mode').value,muted);}
  function updateSettings(){
    const active=!!game;
    $('mode').disabled=active;$('difficulty').disabled=active||$('mode').value==='two';$('music-preview').disabled=active;
    $('name-two').textContent=I.t(($('mode').value==='two'?'ČERVENÝ · HRÁČ 2':'ČERVENÝ · POČÍTAČ'));
  }
  const joystick=globalThis.AtariTouchJoystick?.mount({host:$('touch'),action:'attack',enabled:()=>!!game&&!paused&&game.phase!=='gameover',onInteract:()=>audio.unlock()});
  function clearInput(){joystick?.clear();keys.clear();touches.clear();touchFire=false;for(const button of document.querySelectorAll('.held'))button.classList.remove('held');}
  function startGame(){
    audio.unlock();audio.preview=false;clearInput();
    game=new Engine.Game({mode:$('mode').value,difficulty:$('difficulty').value});
    globalThis.internationalKarate=game;
    paused=false;accumulator=0;uiStamp='';lastPhase='';
    $('screen').classList.add('is-playing');updateSettings();syncAudio();updateUI();
    $('start').blur();
  }
  function menu(){
    if(game)menuScene=game.scene%backgrounds.length;
    game=null;globalThis.internationalKarate=null;paused=false;clearInput();accumulator=0;
    $('screen').classList.remove('is-playing');$('pause').disabled=true;
    uiStamp='';updateSettings();syncAudio();updateUI();
  }
  function setPaused(value){
    if(!game||game.phase==='gameover')return;
    paused=value;clearInput();accumulator=0;syncAudio();uiStamp='';updateUI();
  }
  function toggleMute(){muted=!muted;storage.set('muted',String(muted));audio.unlock();syncAudio();updateSoundButton();}
  function updateSoundButton(){
    $('mute').innerHTML=I.html(`${muted?'♩ Ztlumeno':'♪ Zvuk'} <kbd>M</kbd>`);
    $('mute').setAttribute('aria-pressed',String(muted));
    $('music-preview').textContent=I.t(audio.preview?'Ⅱ Zastavit titulní hudbu':'♪ Poslechnout původní hudbu');
  }
  async function fullscreen(){
    try{if(document.fullscreenElement)await document.exitFullscreen();else await $('screen').requestFullscreen();}catch(_){$('hint').textContent=I.t('Celou obrazovku tento prohlížeč nepovolil.');}
  }
  $('start').addEventListener('click',()=>paused?setPaused(false):startGame());
  $('pause').addEventListener('click',()=>{audio.unlock();setPaused(!paused);});
  $('restart').addEventListener('click',menu);$('mute').addEventListener('click',toggleMute);
  $('fullscreen').addEventListener('click',fullscreen);
  $('music-preview').addEventListener('click',()=>{audio.togglePreview();syncAudio();updateSoundButton();});
  const controlKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyQ']);
  document.addEventListener('keydown',event=>{
    if(event.metaKey||event.ctrlKey||event.altKey||/^(SELECT|INPUT|TEXTAREA)$/.test(event.target.tagName))return;
    if(controlKeys.has(event.code)&&game&&!paused&&game.phase!=='gameover'){event.preventDefault();keys.add(event.code);}
    if(event.repeat)return;
    if(event.code==='KeyP'||event.code==='Escape'){if(game){event.preventDefault();setPaused(!paused);}}
    else if(event.code==='KeyM'){event.preventDefault();toggleMute();}
    else if(event.code==='KeyR'){event.preventDefault();menu();}
    else if(event.code==='KeyF'){event.preventDefault();fullscreen();}
    else if(event.code==='Enter'&&!/^(BUTTON|A)$/.test(event.target.tagName)) {
      if(!game||game.phase==='gameover'){event.preventDefault();startGame();}
      else if(paused){event.preventDefault();audio.unlock();setPaused(false);}
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>{clearInput();setPaused(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();setPaused(true);}});
  function bindTouch(button,fire=false){
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();button.setPointerCapture(event.pointerId);button.classList.add('held');
      if(fire)touchFire=true;else touches.set(event.pointerId,button.dataset.dir.split(',').map(Number));
      audio.unlock();
    });
    const release=event=>{if(fire)touchFire=false;else touches.delete(event.pointerId);button.classList.remove('held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  for(const button of document.querySelectorAll('[data-dir]'))bindTouch(button);
  bindTouch($('touch-fire'),true);
  function getInputs(){
    const inputs=[{x:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y:Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')),fire:keys.has('Space')||touchFire},
      {x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyS'))-Number(keys.has('KeyW')),fire:keys.has('KeyQ')}];
    for(const [x,y]of touches.values()){inputs[0].x+=x;inputs[0].y+=y;}
    joystick?.axes(inputs[0]);
    let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]).filter(Boolean);}catch(_){}
    let fire=false,pausePressed=false;
    for(let i=0;i<Math.min(pads.length,2);i++){
      const pad=pads[i],buttons=pad.buttons;
      const x=buttons[15]?.pressed?1:buttons[14]?.pressed?-1:Math.abs(pad.axes[0]||0)>.3?Math.sign(pad.axes[0]):0;
      const y=buttons[13]?.pressed?1:buttons[12]?.pressed?-1:Math.abs(pad.axes[1]||0)>.3?Math.sign(pad.axes[1]):0;
      if(x||y){inputs[i].x=x;inputs[i].y=y;}
      inputs[i].fire ||= !!(buttons[0]?.pressed||buttons[1]?.pressed);
      fire ||= !!buttons[0]?.pressed;
      pausePressed ||= !!buttons[9]?.pressed;
    }
    if(pausePressed&&!gamepadPause&&game)setPaused(!paused);
    gamepadPause=pausePressed;
    if(!game&&fire&&!gamepadFire)startGame();
    gamepadFire=fire;return inputs;
  }
  const arrows=['↑','↗','→','↘','↓','↙','←','↖'];
  function renderMoves(){
    $('move-grid').replaceChildren();
    const ids=[8,1,2,7,0,3,6,5,4];
    for(const id of ids){const cell=document.createElement('div');cell.className='move'+(!id?' center':'');
      if(!id)cell.textContent=I.t(moveTab==='fire'?'+ FIRE':'JOYSTICK');
      else{const b=document.createElement('b'),name=document.createElement('span');b.textContent=I.t(arrows[id-1]);name.textContent=I.t(Engine.MOVES[id+(moveTab==='fire'?8:0)].name);cell.append(b,name);}
      $('move-grid').append(cell);
    }
  }
  for(const button of document.querySelectorAll('[data-moves]'))button.addEventListener('click',()=>{
    moveTab=button.dataset.moves;
    for(const tab of document.querySelectorAll('[data-moves]')){const selected=tab===button;tab.classList.toggle('selected',selected);tab.setAttribute('aria-pressed',String(selected));}
    renderMoves();
  });
  function pips(id,points){
    const el=$(id);el.replaceChildren();
    for(let i=0;i<2;i++){const pip=document.createElement('span');pip.className='pip'+(points>=i*2+2?' full':points===i*2+1?' half':'');el.append(pip);}
    el.setAttribute('aria-label',I.t(`${points/2} bodu`));
  }
  function updateUI(){
    const phase=game?.phase||'menu',stamp=[phase,paused,game?.seconds,game?.points,game?.score,game?.wins,game?.round,game?.belt].join('|');
    if(stamp===uiStamp)return;uiStamp=stamp;
    const over=phase==='gameover',overlay=!game||paused||over;
    $('overlay').hidden=!overlay;$('pause').disabled=!game||over;
    $('pause').innerHTML=I.html(paused?'▶ Pokračovat <kbd>P</kbd>':'Ⅱ Pauza <kbd>P</kbd>');
    if(!game){
      $('overlay-kicker').textContent=I.t('SYSTEM 3 · ARCHER MACLEAN');$('overlay-title').innerHTML=I.html('Každý pohyb<br>se počítá.');
      $('overlay-copy').innerHTML=I.html('Dva karatisté. Dva body k vítězství.<br>Původní pixelové souboje z Atari.');
      $('start').innerHTML=I.html('VSTOUPIT DO SOUBOJE <span>↵</span>');
    }else if(paused){
      $('overlay-kicker').textContent=I.t('SOUBOJ POČKÁ');$('overlay-title').textContent=I.t('Chvíle na nádech.');
      $('overlay-copy').textContent=I.t('Pokračuj, až budeš připravený.');$('start').innerHTML=I.html('POKRAČOVAT <span>↵</span>');
    }else if(over){
      $('overlay-kicker').textContent=I.t(game.mode==='solo'?`PÁSEK: ${game.beltInfo[1].toUpperCase()}`:`SÉRIE ${game.wins[0]} : ${game.wins[1]}`);
      $('overlay-title').textContent=I.t(game.message);
      $('overlay-copy').textContent=I.t(game.mode==='solo'?`Skóre ${game.score[0].toLocaleString(I.locale)} · vyhrané souboje ${game.wins[0]}. Zkus další cestu k černému pásku.`:'Odveta? Spusť novou sérii na dvě vítězství.');
      $('start').innerHTML=I.html('NOVÝ SOUBOJ <span>↵</span>');
    }
    $('phase-label').textContent=I.t(!game?'VSTUP DO DÓDŽÓ':paused?'HRA POZASTAVENA':phase.startsWith('bonus')?'BONUSOVÁ ZKOUŠKA':over?'KONEC SOUBOJE':phase==='fight'?'HRAJEME · BOJUJ':phase==='point'?'ZÁSAH':phase==='round'?'VÝSLEDEK SOUBOJE':'PŘIPRAV SE');
    $('round-label').textContent=I.t(game?`SOUBOJ ${String(game.round).padStart(2,'0')} · ${backgrounds[game.scene%backgrounds.length].name.toUpperCase()}`:'PŮVODNÍ ATARI KLASIKA');
    $('clock').textContent=I.t(game?game.seconds:'30');$('clock').parentElement.classList.toggle('urgent',!!game&&game.seconds<=10);
    for(let i=0;i<2;i++){$(i?'score-two':'score-one').textContent=I.t(String(game?.score[i]||0).padStart(6,'0'));pips(i?'points-two':'points-one',game?.points[i]||0);}
    const belt=game?.beltInfo||Engine.BELTS[0];$('belt-swatch').style.backgroundColor=belt[2];$('belt-label').textContent=I.t(belt[1]);
    const wins=game?.wins[0]||0;
    $('wins').textContent=I.t(game?.mode==='two'?`${game.wins[0]} : ${game.wins[1]}`:`${wins} ${wins===1?'VÝHRA':wins>1&&wins<5?'VÝHRY':'VÝHER'}`);
    $('hint').textContent=I.t(game?.bonus&&phase.startsWith('bonus')?(game.bonus.kind==='tiles'?'Počkej na GO a stiskni mezerník / FIRE.':'Vysoká zbraň: dolů. Nízká zbraň: nahoru.'):'Šipky + mezerník. Směr drž až do provedení pohybu.');
    updateSoundButton();
  }
  function fighter(p,baseline=198){
    ctx.save();ctx.translate(Math.round(p.x)+(p.facing===-1?24:-24),baseline-96);
    if(p.facing===-1)ctx.scale(-1,1);
    ctx.drawImage(sprites[p.id][p.frame]||sprites[p.id][0],0,0,72,96,0,0,72,96);ctx.restore();
  }
  function referee(){
    const state=game?.referee||{frame:'neutral',message:null};
    const {x,y}=KARATE_REFEREE;
    ctx.drawImage(refereeSprites.get(state.frame)||refereeSprites.get('neutral'),x,y);
    if(state.message){
      ctx.save();ctx.font='bold 6px monospace';
      const width=Math.ceil(ctx.measureText(I.t(state.message)).width)+6,left=x-width-5,top=y+3;
      ctx.fillStyle=KARATE_REFEREE.palette[1];ctx.fillRect(left-1,top-1,width+2,12);
      ctx.fillStyle=KARATE_REFEREE.palette[3];ctx.fillRect(left,top,width,10);ctx.fillRect(x-5,top+5,4,2);
      ctx.fillStyle=KARATE_REFEREE.palette[1];ctx.textAlign='center';ctx.fillText(I.t(state.message),left+width/2,top+7);
      ctx.restore();
    }
  }
  function label(text,y,color='#f7edce',size=9){
    ctx.font=`bold ${size}px monospace`;ctx.textAlign='center';ctx.fillStyle='#0d171c';ctx.fillRect(160-ctx.measureText(I.t(text)).width/2-9,y-size-5,ctx.measureText(I.t(text)).width+18,size+12);
    ctx.fillStyle=color;ctx.fillText(I.t(text),160,y);
  }
  function render(now){
    ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;
    const scene=backgrounds[(game?.scene??menuScene)%backgrounds.length];
    ctx.fillStyle='#101c25';ctx.fillRect(0,0,320,210);
    ctx.fillStyle='#15202a';ctx.fillRect(0,0,320,24);
    if(scene.image.complete&&scene.image.naturalWidth)ctx.drawImage(scene.image,0,24,320,98);
    ctx.fillStyle=scene.floor||KARATE_PALETTE.floor;ctx.fillRect(0,122,320,88);
    ctx.fillStyle='#2e3940';ctx.fillRect(0,201,320,9);ctx.fillStyle='#d7b98b';ctx.fillRect(0,200,320,1);
    ctx.fillStyle='#aec1bd';ctx.font='7px monospace';ctx.textAlign='left';ctx.fillText(I.t('INTERNATIONAL KARATE'),9,15);
    ctx.textAlign='right';ctx.fillStyle='#d6b980';ctx.fillText(I.t(scene.name.toUpperCase()),311,15);
    referee();
    if(game){
      const phase=game.phase;
      if(!phase.startsWith('bonus'))for(const p of game.players)fighter(p);
      else{
        fighter(game.players[0]);const b=game.bonus;
        if(b.kind==='tiles'){
          const left=b.fired?10-b.broken:10;
          ctx.fillStyle='#493f39';ctx.fillRect(173,184,4,15);ctx.fillRect(209,184,4,15);
          for(let i=0;i<left;i++){ctx.fillStyle=i%2?'#e8bf83':'#f3dcc1';ctx.fillRect(174,183-i*3,38,2);}
          if(b.fired&&b.broken){for(let i=0;i<8;i++){ctx.fillStyle='#f3dcc1';ctx.fillRect(181+i*5,180+(i%3)*3,3,2);}}
          if(phase==='bonus'&&!b.fired)label(b.age>=b.goAt?'GO!':'ČEKEJ…',67,b.age>=b.goAt?'#f8da7b':'#f1e8d5',15);
        }else{
          for(const object of b.objects){ctx.save();ctx.translate(Math.round(object.x),object.y);ctx.rotate(now*.007*object.dir);ctx.fillStyle='#e5e8d8';ctx.fillRect(-6,-1,12,2);ctx.fillRect(-1,-5,2,10);ctx.restore();}
          if(phase==='bonus')label(`${b.dodged} ÚHYBŮ  ·  ${b.misses} ZÁSAHŮ`,55,'#f2db9c',8);
        }
      }
      if(phase==='ready')label(game.phaseTicks>40?'PŘIPRAV SE':'HRAJEME!',74,game.phaseTicks>40?'#f3e9cf':'#eed08b',13);
      else if(['point','round','bonus-ready','bonus-result'].includes(phase)){
        label(game.message.toUpperCase(),69,'#f5dd9f',phase==='bonus-ready'?9:12);
        if(phase==='bonus-ready')label(game.bonus.kind==='tiles'?'POČKEJ NA GO · POTOM FIRE':'NAHORU = SKOK · DOLŮ = DŘEP',88,'#d9e0d4',7);
      } else if(phase==='fight'&&game.time>1460)label('HRAJEME!',63,'#edd18f',11);
    }else{
      const cycle=Math.floor(now/120)%KARATE_ANIMATIONS[15].frames.length;
      fighter({id:0,x:195,facing:1,frame:KARATE_ANIMATIONS[15].frames[cycle]});
      fighter({id:1,x:262,facing:-1,frame:Math.floor(now/350)%2?19:0});
    }
  }
  function frame(now){
    const elapsed=Math.min(100,Math.max(0,now-lastTime||0));lastTime=now;
    const inputs=getInputs();
    if(game&&!paused){
      accumulator+=elapsed;
      while(accumulator>=20){game.tick(inputs);accumulator-=20;}
      audio.effects(game.drainEvents());
      if(game.phase!==lastPhase){lastPhase=game.phase;syncAudio();}
    }
    updateUI();render(now);requestAnimationFrame(frame);
  }
  updateSettings();renderMoves();updateUI();requestAnimationFrame(frame);
})();

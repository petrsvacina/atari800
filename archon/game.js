(function(){
  'use strict';
const I=globalThis.AtariI18n||{t:value=>value,html:value=>value,locale:'cs-CZ'};
  const $=id=>document.getElementById(id),E=ArchonEngine,A=ARCHON_ASSETS,P=ARCHON_PALETTE;
  const canvas=$('arena'),ctx=canvas.getContext('2d'),B={x:88,y:49,cell:16},keys=new Set(),touches=new Map();
  const store={get(k,d){try{return localStorage.getItem('archon-'+k)||d;}catch(_){return d;}},set(k,v){try{localStorage.setItem('archon-'+k,v);}catch(_){}}};
  let game=null,paused=false,muted=store.get('muted','false')==='true',last=0,accumulator=0,stamp='',armyTab='light';
  let touchFire=false,boardFire=false,boardRepeat=0,padPause=false,padFire=false;
  const preview=new E.Game({mode:'two'}),audio=new ArchonAudio({onStatus:s=>$('audio-status').textContent=I.t(s)});
  const tips={0:'Velmi rychlá střela a pohyb po zemi. Využij dlouhý dostřel.',1:'Teleportuje se na tři pole a sesílá sedm jednorázových kouzel.',2:'Šíp a tři pole po zemi. Drž si od soupeře odstup.',3:'Odolný, ale pomalý. Těžký kámen má dlouhé nabíjení.',4:'Přelétá figury a bojuje vrženým kopím.',5:'Létající bojovník s vysokou odolností a silným proudem vzduchu.',6:'Při ohnivém výbuchu stojí a je nezranitelný. Musí se přiblížit.',7:'Rychle nabíjí, ale útočí jen zblízka.',8:'Silný, velmi rychlý paprsek. Pozemní pohyb omezuje cesta.',9:'Teleportuje se na tři pole a ovládá sedm kouzel temné strany.',10:'Vržené ostny vyžadují přesné míření.',11:'Mnoho životů a těžká střela, pohyb je pomalý. Zvláštní regeneraci nemá.',12:'V aréně přebírá podobu i zbraň soupeře. Přežité rány se zahojí.',13:'Nejsilnější odolnost a ničivá střela. Dlouho se nabíjí.',14:'Působí průběžné zranění širokým křikem. Po uvolnění FIRE se může pohybovat.',15:'Útočí zblízka, dobíjí rychle. Ke střelci se musí dostat.',16:'Dočasně přivolaná bytost. Po jedné bitvě zmizí.',17:'Dočasně přivolaný oheň s rychlým útokem.',18:'Velmi odolný zemní elementál, jeho pohyb je pomalejší.',19:'Vodní elementál s odolností a silnou střelou.'};
  const spellTips={teleport:'Přesune vlastní neuvězněnou figuru kamkoli mimo magické body; může napadnout nepřítele.',heal:'Obnoví základní životy vybrané figury mimo magické body.',shiftTime:'Obrátí tok času. Na vrcholu světla či tmy přeskočí na opačný vrchol.',exchange:'Prohodí dvě neuvězněné figury mimo magické body.',summonElemental:'Náhodný elementál napadne nepřítele mimo magický bod. Po bitvě mizí.',revive:'Vrátí padlou vlastní figuru na volné pole vedle mága.',imprison:'Znehybní nepřítele do jeho příznivého vrcholu. Uvězněný se stále brání.'};
  function bitmap(rows,color){const c=document.createElement('canvas');c.width=16;c.height=rows.length;const g=c.getContext('2d');g.fillStyle=color;for(let y=0;y<rows.length;y++)for(let x=0;x<8;x++)if(rows[y]&(128>>x))g.fillRect(x*2,y,2,1);return c;}
  const colors={light:P.light,dark:P.dark};
  const sprites={},projectiles={},areas={};
  for(const side of E.SIDES){
    sprites[side]=A.units.map(u=>u.frames.map(rows=>bitmap(rows,colors[side])));
    projectiles[side]=A.units.map(u=>u.projectile.frames.map(rows=>bitmap(rows,colors[side])));
    areas[side]={phoenix:bitmap(A.areaEffects.phoenix.rows,colors[side]),banshee:bitmap(A.areaEffects.banshee.rows,colors[side])};
  }
  for(const id of ['mode','first-side']){
    const value=store.get(id,$(id).value);if([...$(id).options].some(o=>o.value===value))$(id).value=value;
    $(id).addEventListener('change',()=>{store.set(id,$(id).value);settings();});
  }
  function settings(){$('mode').disabled=!!game;$('first-side').disabled=!!game;$('music-preview').disabled=!!game;}
  function clearInput(){keys.clear();touches.clear();touchFire=false;boardFire=false;boardRepeat=0;for(const b of document.querySelectorAll('.held'))b.classList.remove('held');}
  function syncAudio(){audio.sync(!!game,paused,muted);game?.arena?.native.syncSound();}
  function soundUI(){$('mute').innerHTML=I.html(`${muted?'♩ Ztlumeno':'♪ Zvuk'} <kbd>M</kbd>`);$('mute').setAttribute('aria-pressed',String(muted));$('music-preview').textContent=I.t(audio.preview?'Ⅱ Zastavit titulní hudbu':'♪ Poslechnout původní titulní hudbu');}
  function start(){
    clearInput();audio.unlock();audio.preview=false;
    game=new E.Game({mode:$('mode').value==='two'?'two':'solo',humanSide:$('mode').value==='dark'?'dark':'light',firstSide:$('first-side').value});
    globalThis.archon=game;paused=false;accumulator=0;stamp='';$('screen').classList.add('is-playing');settings();syncAudio();updateUI();$('start').blur();canvas.focus({preventScroll:true});
  }
  function menu(){game=null;globalThis.archon=null;paused=false;clearInput();accumulator=0;stamp='';$('screen').classList.remove('is-playing');settings();syncAudio();updateUI();}
  function pause(value){if(!game||game.phase==='over')return;paused=value;clearInput();accumulator=0;stamp='';syncAudio();updateUI();}
  function toggleMute(){audio.unlock();muted=!muted;store.set('muted',String(muted));syncAudio();soundUI();}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('screen').requestFullscreen();}catch(_){$('message').textContent=I.t('Celou obrazovku tento prohlížeč nepovolil.');}}
  function confirm(){if(!game||paused)return;if(game.phase==='board')game.selectCell(game.cursor.x,game.cursor.y);else if(game.phase==='arena-intro'){game.phase='arena';game.emit('fight');}stamp='';}
  $('start').addEventListener('click',()=>paused?pause(false):start());$('pause').addEventListener('click',()=>pause(!paused));$('menu').addEventListener('click',menu);$('mute').addEventListener('click',toggleMute);$('fullscreen').addEventListener('click',fullscreen);
  $('cancel').addEventListener('click',()=>{game?.cancel();stamp='';});
  $('music-preview').addEventListener('click',()=>{audio.togglePreview();syncAudio();soundUI();});
  const controls=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyQ']);
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName))return;
    if(game&&controls.has(event.code)){event.preventDefault();keys.add(event.code);}
    if(event.repeat)return;
    if(event.code==='KeyP'){if(game){event.preventDefault();pause(!paused);}}
    else if(event.code==='Escape'){
      if(game){event.preventDefault();if(!paused&&game.phase==='board'&&(game.selected||game.spell)){game.cancel();stamp='';}else pause(!paused);}
    }else if(event.code==='KeyM'){event.preventDefault();toggleMute();}
    else if(event.code==='KeyR'){event.preventDefault();menu();}
    else if(event.code==='KeyF'){event.preventDefault();fullscreen();}
    else if(event.code==='Enter'&&!/^(BUTTON|A)$/.test(event.target.tagName)){
      event.preventDefault();if(!game||game.phase==='over')start();else if(paused)pause(false);else confirm();
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.code));
  window.addEventListener('blur',()=>{clearInput();pause(true);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause(true);}});
  function logicalPoint(event){const box=canvas.getBoundingClientRect(),scale=Math.min(box.width/320,box.height/240);return{x:(event.clientX-box.left-(box.width-320*scale)/2)/scale,y:(event.clientY-box.top-(box.height-240*scale)/2)/scale};}
  canvas.addEventListener('pointerdown',event=>{
    if(!game||paused||event.button>0)return;event.preventDefault();canvas.focus({preventScroll:true});
    if(game.phase==='board'){
      const p=logicalPoint(event),x=Math.floor((p.x-B.x)/B.cell),y=Math.floor((p.y-B.y)/B.cell);
      if(game.inBoard(x,y)){game.cursor={x,y};game.selectCell(x,y);stamp='';}
    }else if(game.phase==='arena-intro')confirm();
  });
  function bindTouch(button,fire=false){
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);button.classList.add('held');if(fire)touchFire=true;else touches.set(event.pointerId,button.dataset.dir.split(',').map(Number));audio.unlock();});
    const release=event=>{if(fire)touchFire=false;else touches.delete(event.pointerId);button.classList.remove('held');};for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
  }
  for(const b of document.querySelectorAll('[data-dir]'))bindTouch(b);bindTouch($('touch-fire'),true);
  function input(){
    const primary={x:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y:Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')),fire:keys.has('Space')||touchFire};
    const secondary={x:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),y:Number(keys.has('KeyS'))-Number(keys.has('KeyW')),fire:keys.has('KeyQ')};
    for(const[x,y]of touches.values()){primary.x+=x;primary.y+=y;}
    let pads=[];try{pads=Array.from(navigator.getGamepads?.()||[]).filter(Boolean);}catch(_){}
    let pressedPause=false,pressedFire=false;
    for(let i=0;i<Math.min(2,pads.length);i++){
      const p=pads[i],b=p.buttons,target=i===0?primary:secondary;
      const x=b[15]?.pressed?1:b[14]?.pressed?-1:Math.abs(p.axes[0]||0)>.3?Math.sign(p.axes[0]):0;
      const y=b[13]?.pressed?1:b[12]?.pressed?-1:Math.abs(p.axes[1]||0)>.3?Math.sign(p.axes[1]):0;
      if(x||y){target.x=x;target.y=y;}target.fire ||= !!(b[0]?.pressed||b[1]?.pressed);pressedPause ||= !!b[9]?.pressed;pressedFire ||= !!b[0]?.pressed;
    }
    if(pressedPause&&!padPause&&game)pause(!paused);if(pressedFire&&!padFire&&!game)start();padPause=pressedPause;padFire=pressedFire;
    const inputs=game?.mode==='solo'&&game.humanSide==='dark'?[secondary,primary]:[primary,secondary];
    return{primary,inputs};
  }
  function boardInput(primary,delta){
    if(!game||paused||game.phase!=='board'&&game.phase!=='arena-intro')return;
    boardRepeat=Math.max(0,boardRepeat-delta);
    if(game.phase==='board'&&!game.aiTurn&&(primary.x||primary.y)&&boardRepeat<=0){
      game.cursor.x=Math.max(0,Math.min(8,game.cursor.x+Math.sign(primary.x)));game.cursor.y=Math.max(0,Math.min(8,game.cursor.y+Math.sign(primary.y)));boardRepeat=135;stamp='';
    }
    if(primary.fire&&!boardFire)confirm();boardFire=primary.fire;
  }
  const spellButtons=new Map();
  for(const[key,name]of Object.entries(E.SPELLS)){
    const button=document.createElement('button');button.type='button';button.title=I.t(spellTips[key]);button.innerHTML=I.html(`${name}<span>◇</span>`);
    button.addEventListener('click',()=>{if(!game)return;game.beginSpell(key);stamp='';updateUI();button.blur();canvas.focus({preventScroll:true});});$('spell-list').append(button);spellButtons.set(key,button);
  }
  function paintIcon(context,type,side,frame=0,mirror=false,x=0,y=0,scale=1){
    const bitmap=sprites[side][type][frame]||sprites[side][type][0];context.save();context.translate(x+(mirror?16*scale:0),y);if(mirror)context.scale(-1,1);context.imageSmoothingEnabled=false;context.drawImage(bitmap,0,0,16*scale,16*scale);context.restore();
  }
  function bestiary(){
    $('bestiary').replaceChildren();
    for(const unit of ARCHON_RULES.units.filter(u=>u.side===armyTab)){
      const row=document.createElement('div');row.className='beast';const icon=document.createElement('canvas');icon.width=32;icon.height=32;paintIcon(icon.getContext('2d'),unit.id,unit.side==='dark'?'dark':'light',0,unit.side==='dark',0,0,2);
      const copy=document.createElement('div'),name=document.createElement('b'),stats=document.createElement('small');name.textContent=I.t(E.NAMES[unit.id]);stats.textContent=I.t(`${unit.hp} životů · útok ${unit.damage}${unit.id===12?' / proměna':''}`);copy.append(name,stats);row.append(icon,copy);row.title=I.t(tips[unit.id]);$('bestiary').append(row);
    }
  }
  for(const b of document.querySelectorAll('[data-army]'))b.addEventListener('click',()=>{armyTab=b.dataset.army;for(const tab of document.querySelectorAll('[data-army]')){const active=tab===b;tab.classList.toggle('selected',active);tab.setAttribute('aria-pressed',String(active));}bestiary();});
  function updateUI(){
    const g=game||preview,phase=game?.phase||'menu';
    const state=[phase,paused,audio.preview,g.turnNumber,g.selected,g.spell?.key,g.spell?.stage,g.spell?.first,g.cursor.x,g.cursor.y,g.message,g.arena?.fighters.map(a=>Math.ceil(a.hp)),g.arena?.fighters.map(a=>Math.ceil(a.cooldown/10))].join('|');if(state===stamp)return;stamp=state;
    const overlay=!game||paused||phase==='over';$('overlay').hidden=!overlay;$('pause').disabled=!game||phase==='over';$('pause').innerHTML=I.html(paused?'▶ Pokračovat <kbd>P</kbd>':'Ⅱ Pauza <kbd>P</kbd>');$('cancel').disabled=!game||paused||phase!=='board'||!game.selected&&!game.spell;
    if(!game){$('overlay-kicker').textContent=I.t('FREE FALL · ELECTRONIC ARTS');$('overlay-title').innerHTML=I.html('Na desce rozum.<br>V aréně reflexy.');$('overlay-copy').innerHTML=I.html('Ovládni pět magických bodů.<br>Nebo poraz celou soupeřovu armádu.');$('start').innerHTML=I.html('ROZEHRÁT ARCHON <span>↵</span>');}
    else if(paused){$('overlay-kicker').textContent=I.t('ČAS NA ROZMYŠLENOU');$('overlay-title').textContent=I.t('Hra je pozastavená.');$('overlay-copy').textContent=I.t('Deska i aréna počkají. Pokračuj, až budeš připravený.');$('start').innerHTML=I.html('POKRAČOVAT <span>↵</span>');}
    else if(phase==='over'){$('overlay-kicker').textContent=I.t(`ODEHRÁNO ${g.turnNumber-1} TAHŮ`);$('overlay-title').textContent=I.t(g.message);$('overlay-copy').textContent=I.t(g.endReason);$('start').innerHTML=I.html('NOVÝ ARCHON <span>↵</span>');}
    $('phase-label').textContent=I.t(paused?'HRA POZASTAVENA':!game?'SVĚTLO A STÍN':phase==='board'?`${E.sideName(g.turn).toUpperCase()} JE NA TAHU`:phase==='over'?'KONEC HRY':phase==='arena-intro'?'VSTUP DO ARÉNY':phase==='arena-result'?'VÝSLEDEK BITVY':'SOUBOJ V ARÉNĚ');
    $('turn-label').textContent=I.t(game?`TAH ${String(g.turnNumber).padStart(2,'0')} · KOLO ${g.round}`:'STRATEGIE SE MĚNÍ V SOUBOJ');
    const combat=phase.startsWith('arena'),control=g.powerControl;
    for(let i=0;i<2;i++){
      const side=i?'dark':'light',f=g.arena?.fighters[i],count=g.liveUnits.filter(u=>u.side===side).length;
      $(side+'-count').innerHTML=I.html(combat&&f?`${Math.ceil(f.hp)} <em>/ ${f.maxHP} HP</em>`:`${count} <em>FIGUR</em>`);
      $(side+'-points').textContent=I.t(`${control[side]} / 5 BODŮ`);
    }
    $('cycle-track').replaceChildren();for(let i=0;i<6;i++){const chip=document.createElement('i');chip.style.background=P.board.variable[[0,1,3,4,6,7][i]];chip.className=i===g.luminosity?'active':'';$('cycle-track').append(chip);}
    const nextIndex=g.pendingEndpointFlip?(g.luminosity===0?5:0):(g.cycleIndex+g.cycleDirection+g.rules.luminosity.cycle.length)%g.rules.luminosity.cycle.length;
    $('cycle-label').textContent=I.t(g.rules.luminosity.cycle[nextIndex]>g.luminosity?'ROZEDNÍVÁ SE':'STMÍVÁ SE');
    $('message').textContent=I.t(!game?'Vyber režim a vstup do hry.':paused?'Hra je pozastavená.':(phase==='board'&&g.lastActionTurn===g.turnNumber-1?I.t(g.lastAction)+' ':'')+I.t(g.message));
    let unit=g.selectedUnit||g.at(g.cursor.x,g.cursor.y)||g.liveUnits.find(u=>u.side===(game?.humanSide||'light'));
    let actor=null;if(combat&&g.arena){actor=g.arena.fighters[game.mode==='solo'&&game.humanSide==='dark'?1:0];unit=actor.unitId===g.arena.attacker.id?g.arena.attacker:g.arena.defender;}
    if(unit){
      const spec=actor?.spec||g.spec(unit),type=actor?.type??unit.type,side=unit.side==='dark'?'dark':'light',context=$('portrait').getContext('2d');context.clearRect(0,0,64,64);paintIcon(context,type,side,0,side==='dark',8,8,3);
      $('unit-side').textContent=I.t(E.sideName(side).toUpperCase()+(unit.imprisoned?' · UVĚZNĚNO':''));$('unit-name').textContent=I.t(E.NAMES[unit.type]+(unit.type===12&&actor?' → '+E.NAMES[type]:''));
      $('unit-move').textContent=I.t(spec.mode==='summoned'?'Pouze přivolaný souboj':`${spec.mode==='ground'?'Pozemní pohyb':spec.mode==='teleport'?'Teleport':'Létání'} · ${spec.move} pole`);
      $('unit-health').textContent=I.t(actor?`${Math.ceil(actor.hp)} / ${actor.maxHP}`:`${unit.health} / ${g.spec(unit).hp}`);$('unit-damage').textContent=I.t(unit.type===12&&!actor?'Proměna':spec.damage);
      $('unit-reload').textContent=I.t(spec.reload?(spec.reload/E.HZ).toLocaleString(I.locale,{maximumFractionDigits:2})+' s':'—');$('unit-tip').textContent=I.t(tips[unit.type]);
      const square=combat?g.arena.square:g.cursor,terrain=g.terrain(square.x,square.y);
      $('terrain-info').textContent=I.t(`${g.isPower(square.x,square.y)?'Magický bod · ':''}${terrain==='cycle'?'Proměnlivé':terrain==='light'?'Světlé':'Tmavé'} pole · Světlo +${g.lifeBonus('light',square.x,square.y)}, Stín +${g.lifeBonus('dark',square.x,square.y)} životů.`);
    }
    for(const[key,b]of spellButtons){const used=game?.usedSpells[game.turn].has(key);b.disabled=!game||paused||phase!=='board'||g.aiTurn||!!g.spellStatus(key);b.classList.toggle('used',!!used);b.classList.toggle('active',g.spell?.key===key);b.querySelector('span').textContent=I.t(used?'✓':'◇');b.title=I.t((game?g.spellStatus(key)||'':'')||spellTips[key]);}
    const revive=phase==='board'&&g.spell?.key==='revive'&&g.spell.stage===0;$('revive-list').hidden=!revive;
    $('revive-options').replaceChildren();if(revive)for(const dead of g.revivableUnits()){const b=document.createElement('button');b.textContent=I.t(E.NAMES[dead.type]);b.addEventListener('click',()=>{g.chooseRevive(dead.id);stamp='';updateUI();canvas.focus({preventScroll:true});});$('revive-options').append(b);}
    soundUI();
  }
  function text(value,x,y,color=P.text,align='left',size=7){ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(I.t(value),x,y);}
  function squareColor(g,x,y){const t=g.terrain(x,y);return t==='light'?P.board.light:t==='dark'?P.board.dark:P.board.variable[[0,1,3,4,6,7][g.luminosity]];}
  function drawBoard(g,now){
    ctx.fillStyle=P.background;ctx.fillRect(0,0,320,240);text('ARCHON',160,18,colors[g.turn],'center',12);
    ctx.strokeStyle=P.dark;ctx.lineWidth=2;ctx.strokeRect(B.x-2,B.y-2,148,148);
    const selected=g.selectedUnit,targets=new Set((g.spell?g.spellTargets():selected?g.legalMoves(selected):[]).map(p=>p.x+','+p.y));
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){
      const xx=B.x+x*B.cell,yy=B.y+y*B.cell;ctx.fillStyle=squareColor(g,x,y);ctx.fillRect(xx,yy,B.cell,B.cell);
      if(g.isPower(x,y)){
        const marker=ARCHON_MECHANICS.powerMarker,phase=(game?g.totalTicks:Math.floor(now*E.HZ/1000))&3;
        if(xx===(marker.phaseHpos[phase]-48)*2&&(y===4||phase===0)){
          ctx.fillStyle=P.board.power;for(let row=0;row<16;row++)for(let bit=0;bit<8;bit++)if(marker.rows[row]&(128>>bit))ctx.fillRect(xx+bit*2,yy+row,2,1);
        }
      }
      if(targets.has(x+','+y)){ctx.strokeStyle=g.at(x,y)?'#dd9c55':'#75c9a6';ctx.lineWidth=1;ctx.strokeRect(xx+1.5,yy+1.5,13,13);if(!g.at(x,y)){ctx.fillStyle='#75c9a6';ctx.fillRect(xx+7,yy+7,2,2);}}
      const unit=g.at(x,y);if(unit){
        const frame=0;
        paintIcon(ctx,unit.type,unit.side,frame,A.units[unit.type].defaultMirror,xx,yy);
        if(unit.imprisoned){ctx.fillStyle='#9fa7c0';for(let dx=3;dx<16;dx+=4)ctx.fillRect(xx+dx,yy,1,16);}
        if(unit.health<g.spec(unit).hp){ctx.fillStyle='#06130c';ctx.fillRect(xx,yy+15,16,1);ctx.fillStyle=colors[unit.side];ctx.fillRect(xx,yy+15,Math.max(1,Math.floor(16*unit.health/g.spec(unit).hp)),1);}
      }
      if(selected?.x===x&&selected?.y===y){ctx.strokeStyle='#f2d783';ctx.strokeRect(xx+.5,yy+.5,15,15);}
    }
    for(let i=0;i<9;i++){text(String.fromCharCode(65+i),B.x+i*B.cell+8,220,'#7caa83','center',6);text(String(9-i),B.x-11,B.y+i*B.cell+12,'#7caa83','center',6);}
    if(game&&!g.aiTurn&&Math.floor(now/350)%2===0){ctx.strokeStyle=P.board.cursor;ctx.lineWidth=1;ctx.strokeRect(B.x+g.cursor.x*B.cell+.5,B.y+g.cursor.y*B.cell+.5,15,15);}
    const unit=g.selectedUnit||g.at(g.cursor.x,g.cursor.y);if(unit)text((E.NAMES[unit.type]+' · '+(g.spec(unit).mode==='ground'?'PO ZEMI':g.spec(unit).mode==='teleport'?'TELEPORT':'LET')).toUpperCase(),160,234,P.text,'center',7);
    if(game&&g.aiTurn)text('POČÍTAČ PŘEMÝŠLÍ',160,18,colors[g.turn],'center',6);
  }
  function sourceColor(index){
    if(index>>4===11)return P.board.variable[(index&15)>>1];
    const original=ARCHON_MECHANICS.palette[index];
    const anchor=index>>4===14?{source:234,target:P.light}:index>>4===9?{source:148,target:P.dark}:null;
    if(!anchor)return original;
    const ref=ARCHON_MECHANICS.palette[anchor.source],rgb=[];
    for(let i=1;i<7;i+=2)rgb.push(Math.max(0,Math.min(255,Math.round(parseInt(original.slice(i,i+2),16)*parseInt(anchor.target.slice(i,i+2),16)/Math.max(1,parseInt(ref.slice(i,i+2),16))))).toString(16).padStart(2,'0'));
    return '#'+rgb.join('');
  }
  function paintArenaPicture(p,color){
    if(!p)return;ctx.fillStyle=color;
    for(let y=0;y<p.rows.length;y++)for(let x=0;x<8;x++)if(p.rows[y]&(128>>x))ctx.fillRect(p.x+x*p.bitWidth,p.y+y,p.bitWidth,1);
  }
  function drawArena(now){
    const arena=game.arena,g=game,n=arena.native;ctx.fillStyle=P.background;ctx.fillRect(0,0,320,240);
    ctx.fillStyle=squareColor(g,arena.square.x,arena.square.y);ctx.fillRect(0,32,320,192);
    const inks=n.colors.map(l=>P.board.variable[l>>1]).concat(P.arena.border),glyphs=ARCHON_MECHANICS.glyphs;
    for(let row=0;row<12;row++)for(let col=0;col<20;col++){
      const value=n.cells[row*20+col],rows=glyphs[value&63];if(!value||!rows)continue;
      ctx.fillStyle=inks[value>>>6];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(rows[y]&(128>>x))ctx.fillRect(col*16+x*2,32+row*16+y*2,2,2);
    }
    for(let i=0;i<2;i++)paintArenaPicture(n.picture(arena.fighters[i]),sourceColor(n.pmColors[i]));
    for(let i=0;i<2;i++)paintArenaPicture(n.picture(arena.fighters[i],true),sourceColor(n.pmColors[i+2]));
    for(let i=0;i<2;i++){
      const f=arena.fighters[i],x=i?308:6;ctx.fillStyle=colors[f.side];
      ctx.fillRect(x,Math.max(0,221-f.hp*4),4,f.hp*4);
      text(E.NAMES[f.unitType].toUpperCase(),i?309:11,18,colors[f.side],i?'right':'left',7);
    }
    if(g.phase==='arena-intro'){banner('SOUBOJ',105);text('SMĚR + FIRE PRO ÚTOK',160,124,'#e5ebce','center',6);}
    else if(g.phase==='arena-result')banner(arena.resultText.toUpperCase(),107,9);
  }
  function banner(value,y,size=14){ctx.font=`bold ${size}px monospace`;const width=ctx.measureText(I.t(value)).width;ctx.fillStyle='#08150eea';ctx.fillRect(160-width/2-10,y-size-7,width+20,size+16);text(value,160,y,'#d5dca9','center',size);}
  function draw(now){ctx.setTransform(2,0,0,2,0,0);ctx.imageSmoothingEnabled=false;if(game?.arena&&game.phase.startsWith('arena'))drawArena(now);else drawBoard(game||preview,now);}
  function frame(now){
    const delta=Math.min(100,Math.max(0,now-last||0));last=now;const inputs=input();boardInput(inputs.primary,delta);
    if(game&&!paused){
      accumulator+=delta;while(accumulator>=1000/E.HZ){game.tick(inputs.inputs);accumulator-=1000/E.HZ;}
      for(const event of game.drainEvents())audio.event(event);
    }
    updateUI();draw(now);requestAnimationFrame(frame);
  }
  settings();bestiary();updateUI();requestAnimationFrame(frame);
})();

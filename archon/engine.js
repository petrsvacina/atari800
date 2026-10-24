/* Native Archon board + arena simulation. Original unit/stat tables are data. */
(function(root){
  'use strict';
  const HZ=60,SIDES=['light','dark'];
  const NAMES=['Jednorožec','Čaroděj','Lučištník','Golem','Valkýra','Džin','Fénix','Rytíř','Bazilišek','Čarodějnice','Mantikora','Troll','Měňavec','Drak','Bánší','Goblin','Vzdušný elementál','Ohnivý elementál','Zemní elementál','Vodní elementál'];
  const SPELLS={teleport:'Teleportace',heal:'Léčení',shiftTime:'Změna času',exchange:'Výměna',summonElemental:'Přivolání elementála',revive:'Oživení',imprison:'Uvěznění'};
  const other=side=>side==='light'?'dark':'light',sideName=side=>side==='light'?'Světlo':'Stín';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sign=Math.sign;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const same=(a,b)=>a.x===b.x&&a.y===b.y;
  const neutral=()=>({x:0,y:0,fire:false});
  class Game{
    constructor(options={}){
      this.rules=options.rules||root.ARCHON_RULES;if(!this.rules?.units)throw Error('Chybějí původní tabulky Archonu.');
      this.random=options.random||Math.random;this.mode=options.mode==='two'?'two':'solo';
      this.humanSide=options.humanSide==='dark'?'dark':'light';this.difficulty=['easy','normal','hard'].includes(options.difficulty)?options.difficulty:'normal';
      this.units=this.rules.layout.map((p,id)=>({...p,id:'u'+id,alive:true,health:this.rules.units[p.type].hp,imprisoned:false}));
      this.turn='light';this.turnNumber=1;this.round=1;this.phase='board';this.totalTicks=0;
      this.cycleIndex=2;this.cycleDirection=1;this.selected=null;this.spell=null;this.arena=null;this.winner=null;this.endReason='';
      this.cursor={x:this.humanSide==='light'?1:7,y:4};this.events=[];this.aiDelay=50;this.aiThink=0;
      this.usedSpells={light:new Set(),dark:new Set()};this.message='Světlo začíná. Vyber figuru.';
      this.quietRounds=0;
    }
    emit(type,data={}){
      if(type==='spell'){this.lastAction=sideName(this.turn)+' sesílá '+SPELLS[data.spell]+'.';this.lastActionTurn=this.turnNumber;}
      this.events.push({type,tick:this.totalTicks,...data});
    }
    drainEvents(){const out=this.events;this.events=[];return out;}
    get aiTurn(){return this.mode==='solo'&&this.turn!==this.humanSide;}
    get luminosity(){return this.rules.luminosity.cycle[this.cycleIndex];}
    get selectedUnit(){return this.units.find(u=>u.id===this.selected&&u.alive)||null;}
    get liveUnits(){return this.units.filter(u=>u.alive);}
    get powerControl(){const out={light:0,dark:0};for(const[x,y]of this.rules.powerPoints){const u=this.at(x,y);if(u)out[u.side]++;}return out;}
    at(x,y){return this.units.find(u=>u.alive&&u.x===x&&u.y===y)||null;}
    unit(id){return this.units.find(u=>u.id===id)||null;}
    spec(unit){return this.rules.units[unit.type];}
    isPower(x,y){return this.rules.powerPoints.some(p=>p[0]===x&&p[1]===y);}
    inBoard(x,y){return x>=0&&x<9&&y>=0&&y<9;}
    terrain(x,y){return this.rules.terrain[y*9+x];}
    lifeBonus(side,x,y){
      if(side==='elemental')return 0;
      const terrain=this.terrain(x,y),light=terrain==='light'?7:terrain==='dark'?0:[0,1,3,4,6,7][this.luminosity];
      let bonus=side==='light'?light:7-light;
      if(y===4&&(side==='light'&&x===0||side==='dark'&&x===8))bonus=Math.max(0,bonus-this.usedSpells[side].size);
      return bonus;
    }
    legalMoves(unit){
      if(!unit?.alive||unit.imprisoned)return[];
      const spec=this.spec(unit),out=[];
      if(spec.mode==='fly'||spec.mode==='teleport'){
        for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(Math.max(Math.abs(x-unit.x),Math.abs(y-unit.y))<=spec.move&&!same(unit,{x,y})&&this.at(x,y)?.side!==unit.side)out.push({x,y});
      }else{
        const queue=[{x:unit.x,y:unit.y,d:0}],visited=new Set([unit.x+','+unit.y]);
        for(let i=0;i<queue.length;i++){
          const p=queue[i];if(p.d>=spec.move)continue;
          for(const[dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
            const x=p.x+dx,y=p.y+dy,key=x+','+y;if(!this.inBoard(x,y)||visited.has(key))continue;
            const occupant=this.at(x,y);if(occupant?.side===unit.side)continue;
            visited.add(key);out.push({x,y});if(!occupant)queue.push({x,y,d:p.d+1});
          }
        }
      }
      return out;
    }
    say(message){this.message=message;this.emit('notice',{message});return false;}
    selectCell(x,y){
      if(this.phase!=='board'||this.aiTurn)return false;
      if(!this.inBoard(x,y))return false;this.cursor={x,y};
      if(this.spell)return this.spellCell(x,y);
      const target=this.at(x,y),selected=this.selectedUnit;
      if(target?.side===this.turn){
        if(target.imprisoned)return this.say('Tato figura je uvězněná.');
        this.selected=target.id;this.message=NAMES[target.type]+' · vyber cílové pole.';this.emit('select',{unit:target.type});return true;
      }
      if(!selected)return this.say('Nejdřív vyber vlastní figuru.');
      return this.move(selected,x,y);
    }
    move(unit,x,y,forced=false){
      if(this.phase!=='board'||unit.side!==this.turn||!unit.alive)return false;
      if(!forced&&!this.legalMoves(unit).some(p=>p.x===x&&p.y===y))return this.say('Na toto pole figura nedosáhne.');
      const target=this.at(x,y);if(target?.side===unit.side)return false;
      if(target){this.startArena(unit,target);return true;}
      unit.x=x;unit.y=y;this.emit('move',{unit:unit.type});this.finishTurn();return true;
    }
    cancel(){
      if(this.phase!=='board')return;
      this.spell=null;this.selected=null;this.message='Vyber figuru.';
    }
    mage(side=this.turn){return this.liveUnits.find(u=>u.side===side&&(u.type===1||u.type===9))||null;}
    spellStatus(key,side=this.turn){
      if(!SPELLS[key])return 'Neznámé kouzlo.';
      const mage=this.mage(side);if(!mage)return 'Mág už není ve hře.';
      if(mage.imprisoned)return 'Mág je uvězněný.';
      if(this.usedSpells[side].has(key))return 'Toto kouzlo už bylo použité.';
      if(key==='revive'&&!this.units.some(u=>u.side===side&&!u.alive))return 'Nemáš padlou figuru k oživení.';
      return '';
    }
    beginSpell(key,fromAI=false){
      if(this.phase!=='board'||this.aiTurn&&!fromAI)return false;
      const reason=this.spellStatus(key);if(reason)return this.say(reason);
      this.selected=this.mage().id;this.spell={key,stage:0,first:null};
      if(key==='shiftTime'){
        if(this.luminosity===0||this.luminosity===5)this.cycleIndex=this.luminosity===0?5:0;
        else this.cycleDirection*=-1;
        this.releasePrisoners();this.completeSpell(key);return true;
      }
      const prompts={teleport:'Teleportace: vyber vlastní figuru.',heal:'Léčení: vyber zraněnou figuru.',exchange:'Výměna: vyber první figuru.',summonElemental:'Elementál: vyber nepřítele.',revive:'Oživení: vyber padlou figuru v nabídce.',imprison:'Uvěznění: vyber nepřítele.'};
      this.message=prompts[key];return true;
    }
    magicImmune(unit){return this.isPower(unit.x,unit.y);}
    completeSpell(key){this.usedSpells[this.turn].add(key);this.spell=null;this.emit('spell',{spell:key});this.finishTurn();}
    chooseRevive(id){
      if(this.spell?.key!=='revive'||this.spell.stage!==0)return false;
      const u=this.unit(id);if(!u||u.alive||u.side!==this.turn)return false;
      this.spell.first=id;this.spell.stage=1;this.message='Vyber volné pole vedle svého mága.';return true;
    }
    spellCell(x,y){
      const spell=this.spell,key=spell.key,target=this.at(x,y);
      if(this.isPower(x,y))return this.say('Na magickém bodě kouzla nepůsobí.');
      if(key==='teleport'){
        if(spell.stage===0){
          if(!target||target.side!==this.turn||target.imprisoned)return this.say('Vyber volnou vlastní figuru mimo magický bod.');
          spell.first=target.id;spell.stage=1;this.message='Vyber cíl teleportace.';return true;
        }
        const first=this.unit(spell.first);if(target?.side===this.turn)return this.say('Cíl je obsazený vlastní figurou.');
        this.usedSpells[this.turn].add(key);this.spell=null;this.emit('spell',{spell:key});
        return this.move(first,x,y,true);
      }
      if(key==='heal'){
        if(!target)return this.say('Vyber figuru.');
        target.health=this.spec(target).hp;this.completeSpell(key);return true;
      }
      if(key==='exchange'){
        if(!target||target.imprisoned)return this.say('Vyber neuvězněnou figuru mimo magické body.');
        if(spell.stage===0){spell.first=target.id;spell.stage=1;this.message='Vyber druhou figuru.';return true;}
        const first=this.unit(spell.first);if(first.id===target.id)return this.say('Vyber jinou figuru.');
        const{x:xx,y:yy}=first;first.x=target.x;first.y=target.y;target.x=xx;target.y=yy;this.completeSpell(key);return true;
      }
      if(key==='imprison'){
        if(!target||target.side===this.turn)return this.say('Vyber nepřátelskou figuru.');
        if(this.luminosity===(target.side==='light'?5:0))return this.say('Na vrcholu vlastní síly nelze figuru uvěznit.');
        target.imprisoned=true;this.completeSpell(key);return true;
      }
      if(key==='summonElemental'){
        if(!target||target.side===this.turn)return this.say('Vyber nepřátelskou figuru mimo magický bod.');
        const type=16+Math.floor(this.random()*4),elemental={id:'elemental-'+this.totalTicks,type,side:this.turn,health:this.rules.units[type].hp,alive:true,x:-1,y:-1};
        this.usedSpells[this.turn].add(key);this.spell=null;this.emit('spell',{spell:key});this.startArena(elemental,target,{summoned:true});return true;
      }
      if(key==='revive'){
        if(spell.stage!==1)return this.say('Nejdřív vyber padlou figuru v nabídce.');
        const mage=this.mage();if(target||Math.max(Math.abs(x-mage.x),Math.abs(y-mage.y))!==1)return this.say('Oživ figuru na volném poli vedle mága.');
        const u=this.unit(spell.first);u.alive=true;u.health=this.spec(u).hp;u.imprisoned=false;u.x=x;u.y=y;this.completeSpell(key);return true;
      }
      return false;
    }
    spellTargets(){
      if(!this.spell)return[];const spell=this.spell,out=[];
      for(let y=0;y<9;y++)for(let x=0;x<9;x++){
        if(this.isPower(x,y))continue;const u=this.at(x,y);let valid=false;
        if(spell.key==='teleport')valid=spell.stage===0?u?.side===this.turn&&!u.imprisoned:!u||u.side!==this.turn;
        else if(spell.key==='heal')valid=!!u;
        else if(spell.key==='exchange')valid=!!u&&!u.imprisoned&&u.id!==spell.first;
        else if(['imprison','summonElemental'].includes(spell.key))valid=!!u&&u.side!==this.turn&&(spell.key!=='imprison'||this.luminosity!==(u.side==='light'?5:0));
        else if(spell.key==='revive'&&spell.stage===1){const m=this.mage();valid=!u&&Math.max(Math.abs(x-m.x),Math.abs(y-m.y))===1;}
        if(valid)out.push({x,y});
      }
      return out;
    }
    advanceLight(){
      const cycle=this.rules.luminosity.cycle;this.cycleIndex=(this.cycleIndex+this.cycleDirection+cycle.length)%cycle.length;
      this.releasePrisoners();
      this.emit('light',{shade:this.luminosity});
    }
    releasePrisoners(){
      for(const u of this.liveUnits)if(u.imprisoned&&(u.side==='light'&&this.luminosity===5||u.side==='dark'&&this.luminosity===0))u.imprisoned=false;
    }
    checkVictory(){
      const control=this.powerControl;
      for(const side of SIDES)if(control[side]===5){this.end(side,'Obsazení všech pěti magických bodů.');return true;}
      const counts=SIDES.map(side=>this.liveUnits.filter(u=>u.side===side).length);
      if(!counts[0]&&!counts[1]){this.end(null,'Obě armády padly.');return true;}
      for(let i=0;i<2;i++)if(!counts[i]){this.end(SIDES[1-i],'Nepřátelská armáda byla zničena.');return true;}
      for(let i=0;i<2;i++)if(counts[i]===1&&this.liveUnits.find(u=>u.side===SIDES[i]).imprisoned){this.end(SIDES[1-i],'Poslední nepřátelská figura je uvězněná.');return true;}
      return false;
    }
    end(side,reason){this.winner=side;this.endReason=reason;this.phase='over';this.message=side?sideName(side)+' vítězí.':'Remíza.';this.emit('end',{winner:side});}
    finishTurn(){
      this.selected=null;this.spell=null;this.arena=null;
      if(this.checkVictory())return;
      const previous=this.turn;this.turn=other(this.turn);this.turnNumber++;
      if(previous==='dark'){
        this.round++;this.advanceLight();
        for(const u of this.liveUnits){
          const peak=u.side==='light'?this.luminosity===5:this.luminosity===0;
          u.health=Math.min(this.spec(u).hp,u.health+(this.isPower(u.x,u.y)?1:0)+(peak?1:0));
        }
        if(SIDES.every(side=>this.liveUnits.filter(u=>u.side===side).length<3))this.quietRounds++;else this.quietRounds=0;
        if(this.quietRounds>=12){this.end(null,'Malé armády se dvanáct kol nesetkaly v boji.');return;}
      }
      this.phase='board';this.aiDelay=45;this.message=sideName(this.turn)+' je na tahu.';
      const movable=this.liveUnits.filter(u=>u.side===this.turn).some(u=>this.legalMoves(u).length);
      if(!movable){this.end(other(this.turn),'Soupeř nemá pohyblivou figuru.');return;}
      this.emit('turn',{side:this.turn});
    }
    startArena(attacker,defender,options={}){
      this.quietRounds=0;this.selected=null;this.spell=null;
      const square={x:defender.x,y:defender.y},fighters=[];
      for(const unit of [attacker,defender]){
        const copied=unit.type===12?this.spec(unit===attacker?defender:attacker):this.spec(unit);
        const type=copied.id,spec=copied,bonus=unit.type>=16?0:this.lifeBonus(unit.side,square.x,square.y);
        const hp=(unit.type===12?spec.hp:unit.health)+bonus;
        const actor={unitId:unit.id,unitType:unit.type,type,side:unit.side,spec,bonus,maxHP:spec.hp+bonus,hp,
          x:unit.side==='light'?30:290,y:105,vx:0,vy:0,look:{x:unit.side==='light'?1:-1,y:0},
          cooldown:20,attackTicks:0,areaTicks:0,areaAge:0,hurt:0,moving:false,walkAge:0,aiInput:neutral(),aiClock:0};
        fighters[unit.side==='light'?0:1]=actor;
      }
      const obstacles=[];
      for(let y=40;y<=174;y+=27)for(let x=77;x<=244;x+=33)if(this.random()<.48)obstacles.push({x:x+Math.floor(this.random()*9)-4,y:y+Math.floor(this.random()*7)-3,offset:Math.floor(this.random()*180)});
      this.arena={attacker,defender,square,summoned:!!options.summoned,fighters,shots:[],obstacles,elapsed:0,winner:undefined,resultText:''};
      this.phase='arena-intro';this.phaseTicks=75;this.message=NAMES[attacker.type]+' proti '+NAMES[defender.type];
      this.emit('challenge',{attacker:attacker.type,defender:defender.type});
    }
    obstaclePhase(obstacle){return Math.floor((this.arena.elapsed+obstacle.offset)/60)%3;}
    blocked(x,y){
      if(x<14||x>306||y<22||y>192)return true;
      return this.arena.obstacles.some(o=>this.obstaclePhase(o)===2&&Math.abs(x-o.x)<10&&Math.abs(y-o.y)<10);
    }
    startAttack(actor){
      if(actor.cooldown>0||actor.hp<=0)return;
      const spec=actor.spec;
      if(this.arena.shots.some(s=>s.owner===actor.side&&!s.dead))return;
      actor.cooldown=Math.max(1,spec.reload);actor.attackTicks=12;
      this.emit('fire',{side:actor.side,unit:actor.type});
      if(['phoenix','banshee'].includes(spec.special)){actor.areaTicks=40;actor.areaAge=0;return;}
      const aim=actor.look;
      if(spec.special==='melee'){
        this.arena.shots.push({owner:actor.side,type:actor.type,melee:true,x:actor.x+aim.x*13,y:actor.y+aim.y*8,dx:aim.x,dy:aim.y,life:7,damage:spec.damage,dead:false});return;
      }
      const speed=Math.max(1,spec.shotSpeed);
      this.arena.shots.push({owner:actor.side,type:actor.type,x:actor.x+aim.x*10,y:actor.y+aim.y*7,dx:aim.x*speed*2,dy:aim.y*speed,life:120,damage:spec.damage,dead:false});
    }
    hurt(actor,amount){
      if(actor.hp<=0||actor.type===6&&actor.areaTicks>0)return false;
      actor.hp=Math.max(0,actor.hp-amount);actor.hurt=10;this.emit('impact',{side:actor.side,unit:actor.type});return true;
    }
    updateActor(actor,input){
      const dx=sign(input?.x||0),dy=sign(input?.y||0);
      actor.vx=0;actor.vy=0;actor.moving=false;
      if(actor.cooldown>0)actor.cooldown--;if(actor.attackTicks>0)actor.attackTicks--;if(actor.hurt>0)actor.hurt--;
      if(actor.hp<=0){actor.areaTicks=0;return;}
      if(input?.aim)actor.look={x:input.aim.x,y:input.aim.y};else if(dx||dy)actor.look={x:dx,y:dy};
      const frozen=!!input?.fire||actor.spec.special==='phoenix'&&actor.areaTicks>0;
      const slow=actor.spec.arenaSpeed===.75&&this.arena.elapsed%4===0;
      if(!frozen&&!slow){
        const nx=actor.x+dx*2,ny=actor.y+dy;
        if(!this.blocked(nx,actor.y)){actor.vx=nx-actor.x;actor.x=nx;}
        if(!this.blocked(actor.x,ny)){actor.vy=ny-actor.y;actor.y=ny;}
        actor.moving=!!(actor.vx||actor.vy);if(actor.moving)actor.walkAge++;
      }
      if(actor.areaTicks>0){actor.areaTicks--;actor.areaAge++;}
      if(input?.fire)this.startAttack(actor);
    }
    areaSize(actor){
      if(actor.spec.special==='banshee')return{rx:32,ry:16};
      const stage=Math.min(4,Math.floor(actor.areaAge/8));return{rx:[8,16,32,16,8][stage],ry:[8,16,16,16,8][stage]};
    }
    tickArena(inputs){
      const arena=this.arena;arena.elapsed++;
      const actual=arena.fighters.map((actor,i)=>this.mode==='solo'&&actor.side!==this.humanSide?this.combatAI(actor,arena.fighters[1-i]):inputs[i]||neutral());
      for(let i=0;i<2;i++)this.updateActor(arena.fighters[i],actual[i]);
      for(const actor of arena.fighters)if(actor.areaTicks>0&&actor.areaAge%8===0){
        const enemy=arena.fighters.find(a=>a.side!==actor.side),size=this.areaSize(actor);
        if(((enemy.x-actor.x)/(size.rx+6))**2+((enemy.y-actor.y)/(size.ry+6))**2<=1)this.hurt(enemy,actor.spec.damage);
      }
      for(const shot of arena.shots){
        const enemy=arena.fighters.find(a=>a.side!==shot.owner);
        if(shot.melee){if(Math.abs(shot.x-enemy.x)<15&&Math.abs(shot.y-enemy.y)<11){this.hurt(enemy,shot.damage);shot.dead=true;}}
        else{
          const steps=Math.ceil(Math.max(Math.abs(shot.dx),Math.abs(shot.dy))/3);
          for(let i=0;i<steps&&!shot.dead;i++){
            shot.x+=shot.dx/steps;shot.y+=shot.dy/steps;
            if(shot.x<9||shot.x>311||shot.y<17||shot.y>199){shot.dead=true;break;}
            if(arena.obstacles.some(o=>this.obstaclePhase(o)===2&&Math.abs(shot.x-o.x)<6&&Math.abs(shot.y-o.y)<6)){shot.dead=true;break;}
            if(Math.abs(shot.x-enemy.x)<8&&Math.abs(shot.y-enemy.y)<8){this.hurt(enemy,shot.damage);shot.dead=true;}
          }
        }
        if(--shot.life<=0)shot.dead=true;
      }
      arena.shots=arena.shots.filter(s=>!s.dead);
      if(arena.fighters.some(a=>a.hp<=0)){
        const surviving=arena.fighters.filter(a=>a.hp>0),deadSide=arena.fighters.find(a=>a.hp<=0).side;
        const liveMissile=arena.shots.some(s=>s.owner===deadSide&&!s.dead);
        if(!surviving.length||!liveMissile)this.resolveArena();
      }
    }
    resolveArena(){
      const arena=this.arena,alive=arena.fighters.filter(a=>a.hp>0);
      arena.winner=alive.length===1?alive[0].side:null;
      for(const actor of arena.fighters){
        const unit=actor.unitId===arena.attacker.id?arena.attacker:arena.defender;
        if(actor.hp<=0){unit.alive=false;unit.imprisoned=false;this.emit('defeat',{side:unit.side,unit:unit.type});}
        else unit.health=unit.type===12?this.spec(unit).hp:Math.max(1,Math.min(unit.health,actor.hp));
      }
      if(arena.winner===arena.attacker.side&&!arena.summoned){arena.attacker.x=arena.square.x;arena.attacker.y=arena.square.y;}
      arena.resultText=arena.winner?sideName(arena.winner)+' ovládlo arénu.':'Obě figury padly.';
      if(arena.summoned&&arena.winner===arena.attacker.side)arena.resultText='Elementál porazil soupeře a mizí.';
      this.phase='arena-result';this.phaseTicks=115;this.message=arena.resultText;this.emit('result',{winner:arena.winner});
    }
    combatAI(actor,enemy){
      const level={easy:0,normal:1,hard:2}[this.difficulty];
      if(--actor.aiClock>0)return actor.aiInput;
      actor.aiClock=[14,8,4][level];
      const ex=enemy.x+(level===2?enemy.vx*3:0),ey=enemy.y+(level===2?enemy.vy*3:0),dx=(ex-actor.x)/2,dy=ey-actor.y;
      const ax=Math.abs(dx),ay=Math.abs(dy),close=Math.max(ax,ay),area=['phoenix','banshee','melee'].includes(actor.spec.special);
      let aim={x:sign(dx),y:sign(dy)};
      if(ax>ay*2)aim.y=0;else if(ay>ax*2)aim.x=0;
      const aligned=ay<7||ax<6||Math.abs(ax-ay)<7;
      let x=sign(dx),y=sign(dy),fire=false;
      if(area){fire=close<(actor.spec.special==='melee'?12:15);if(fire&&actor.spec.special==='phoenix'){x=0;y=0;}}
      else{
        if(aligned&&close<125){fire=this.random()<[.68,.9,1][level];x=0;y=0;}
        if(close<24){x=-sign(dx);y=ay<10?(actor.y<105?1:-1):-sign(dy);}
      }
      const threat=this.arena.shots.find(s=>s.owner!==actor.side&&!s.melee&&distance(s,actor)<55);
      if(threat&&this.random()<[.2,.65,.95][level]){fire=false;if(Math.abs(threat.dx)>Math.abs(threat.dy)){x=0;y=actor.y>threat.y?1:-1;}else{x=actor.x>threat.x?1:-1;y=0;}}
      if(this.blocked(actor.x+x*5,actor.y+y*4)){
        if(x&&y){if(!this.blocked(actor.x+x*5,actor.y))y=0;else x=0;}
        else if(x)y=actor.y<105?1:-1;else x=actor.x<160?1:-1;
      }
      actor.aiInput={x,y,fire,aim};return actor.aiInput;
    }
    computerTurn(){
      const mage=this.mage(),friendly=this.liveUnits.filter(u=>u.side===this.turn);
      if(mage&&!mage.imprisoned){
        const injured=friendly.filter(u=>!this.magicImmune(u)&&u.health<this.spec(u).hp*.45).sort((a,b)=>this.spec(b).hp-b.health-(this.spec(a).hp-a.health))[0];
        if(injured&&!this.spellStatus('heal')){this.beginSpell('heal',true);this.spellCell(injured.x,injured.y);return;}
        const lost=this.units.filter(u=>u.side===this.turn&&!u.alive).sort((a,b)=>this.spec(b).hp+this.spec(b).damage-this.spec(a).hp-this.spec(a).damage)[0];
        if(lost&&!this.spellStatus('revive')){
          const spaces=[];for(let y=mage.y-1;y<=mage.y+1;y++)for(let x=mage.x-1;x<=mage.x+1;x++)if(this.inBoard(x,y)&&!this.at(x,y)&&!this.isPower(x,y)&&!same(mage,{x,y}))spaces.push({x,y});
          if(spaces.length){this.beginSpell('revive',true);this.chooseRevive(lost.id);this.spellCell(spaces[0].x,spaces[0].y);return;}
        }
        const lastEnemy=this.liveUnits.filter(u=>u.side!==this.turn);
        if(lastEnemy.length===1&&!this.spellStatus('imprison')&&!this.magicImmune(lastEnemy[0])&&this.luminosity!==(lastEnemy[0].side==='light'?5:0)){
          this.beginSpell('imprison',true);this.spellCell(lastEnemy[0].x,lastEnemy[0].y);return;
        }
        if(!this.spellStatus('shiftTime')&&this.luminosity===(this.turn==='light'?0:5)) {this.beginSpell('shiftTime',true);return;}
        const enemies=this.liveUnits.filter(u=>u.side!==this.turn&&!this.magicImmune(u));
        if(!this.spellStatus('summonElemental')&&friendly.length+2<this.liveUnits.length-friendly.length&&enemies.length){
          const foe=enemies.sort((a,b)=>this.spec(b).hp+this.spec(b).damage-this.spec(a).hp-this.spec(a).damage)[0];
          this.beginSpell('summonElemental',true);this.spellCell(foe.x,foe.y);return;
        }
        if(!this.spellStatus('teleport')){
          for(const friend of friendly.filter(u=>!u.imprisoned&&!this.magicImmune(u)&&u.health>=9))for(const foe of enemies){
            const ours=friend.health+this.lifeBonus(friend.side,foe.x,foe.y),theirs=foe.health+this.lifeBonus(foe.side,foe.x,foe.y);
            if(ours>theirs*1.8&&Math.max(Math.abs(friend.x-foe.x),Math.abs(friend.y-foe.y))>this.spec(friend).move){
              this.beginSpell('teleport',true);this.spellCell(friend.x,friend.y);this.spellCell(foe.x,foe.y);return;
            }
          }
        }
        if(!this.spellStatus('exchange')){
          const exposed=friendly.find(u=>!u.imprisoned&&!this.magicImmune(u)&&u.health<4&&enemies.some(e=>Math.abs(e.x-u.x)+Math.abs(e.y-u.y)<3));
          const replacement=friendly.find(u=>u!==exposed&&!u.imprisoned&&!this.magicImmune(u)&&u.health>=14);
          if(exposed&&replacement){this.beginSpell('exchange',true);this.spellCell(exposed.x,exposed.y);this.spellCell(replacement.x,replacement.y);return;}
        }
      }
      const moves=[];
      for(const unit of friendly)for(const target of this.legalMoves(unit)){
        const enemy=this.at(target.x,target.y),spec=this.spec(unit),bonus=this.lifeBonus(unit.side,target.x,target.y);
        let score=(4-Math.abs(target.x-4)-Math.abs(target.y-4))*.15+this.random()*.65;
        const closest=Math.min(...this.rules.powerPoints.filter(p=>this.at(p[0],p[1])?.side!==unit.side).map(p=>Math.abs(target.x-p[0])+Math.abs(target.y-p[1])));
        if(Number.isFinite(closest))score-=closest*.16;
        if(this.isPower(target.x,target.y))score+=4;
        if(this.isPower(unit.x,unit.y))score-=4.4;
        if(enemy){
          const foe=this.spec(enemy),foeBonus=this.lifeBonus(enemy.side,target.x,target.y);
          const strength=(unit.health+bonus)*(Math.max(2,spec.damage)+5)/(Math.max(1,spec.reload)/50+.8);
          const their=(enemy.health+foeBonus)*(Math.max(2,foe.damage)+5)/(Math.max(1,foe.reload)/50+.8);
          score+=3+clamp((strength/their-1)*4,-7,8)+(enemy.type===1||enemy.type===9?3:0);
        }
        if(unit.type===1||unit.type===9)score-=enemy?1.5:.5;
        moves.push({unit,target,score});
      }
      moves.sort((a,b)=>b.score-a.score);
      if(!moves.length){this.end(other(this.turn),'Soupeř nemá pohyblivou figuru.');return;}
      const index=this.difficulty==='easy'?Math.floor(this.random()*Math.min(4,moves.length)):0,choice=moves[index];
      this.move(choice.unit,choice.target.x,choice.target.y);
    }
    tick(inputs=[neutral(),neutral()]){
      this.totalTicks++;
      if(this.phase==='board'){if(this.aiTurn&&--this.aiDelay<=0)this.computerTurn();return;}
      if(this.phase==='arena-intro'){if(--this.phaseTicks<=0){this.phase='arena';this.emit('fight');}return;}
      if(this.phase==='arena-result'){if(--this.phaseTicks<=0)this.finishTurn();return;}
      if(this.phase==='arena')this.tickArena(inputs);
    }
  }
  root.ArchonEngine={Game,HZ,NAMES,SPELLS,SIDES,other,sideName,neutral};
})(globalThis);

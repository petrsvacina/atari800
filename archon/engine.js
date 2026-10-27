/* Native Archon board + arena simulation. Original unit/stat tables are data. */
(function(root){
  'use strict';
  const HZ=1789790/(114*262),SIDES=['light','dark'];
  const NAMES=['Jednorožec','Čaroděj','Lučištník','Golem','Valkýra','Džin','Fénix','Rytíř','Bazilišek','Čarodějnice','Mantikora','Troll','Měňavec','Drak','Bánší','Goblin','Vzdušný elementál','Ohnivý elementál','Zemní elementál','Vodní elementál'];
  const SPELLS={teleport:'Teleportace',heal:'Léčení',shiftTime:'Změna času',exchange:'Výměna',summonElemental:'Přivolání elementála',revive:'Oživení',imprison:'Uvěznění'};
  const other=side=>side==='light'?'dark':'light',sideName=side=>side==='light'?'Světlo':'Stín';
  const same=(a,b)=>a.x===b.x&&a.y===b.y;
  const neutral=()=>({x:0,y:0,fire:false});
  class Game{
    constructor(options={}){
      this.rules=options.rules||root.ARCHON_RULES;if(!this.rules?.units)throw Error('Chybějí původní tabulky Archonu.');
      this.random=options.random||Math.random;this.randomByte=options.randomByte||(()=>Math.floor(this.random()*256));this.mode=options.mode==='two'?'two':'solo';
      this.humanSide=options.humanSide==='dark'?'dark':'light';
      this.units=this.rules.layout.map((p,id)=>({...p,id:'u'+id,originalIndex:p.side==='light'?p.y*2+p.x:18+p.y*2+p.x-7,alive:true,health:this.rules.units[p.type].hp,imprisoned:false}));
      this.firstSide=options.firstSide==='dark'?'dark':'light';this.turn=this.firstSide;this.turnNumber=1;this.round=1;this.phase='board';this.totalTicks=0;
      this.cycleIndex=this.firstSide==='light'?8:3;this.cycleDirection=1;this.pendingEndpointFlip=false;this.selected=null;this.spell=null;this.arena=null;this.winner=null;this.endReason='';
      this.cursor={x:this.humanSide==='light'?1:7,y:4};this.events=[];this.aiDelay=50;
      this.usedSpells={light:new Set(),dark:new Set()};this.message=sideName(this.firstSide)+' začíná. Vyber figuru.';
      this.quietCounter=0;
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
        if(this.luminosity===0||this.luminosity===5)this.pendingEndpointFlip=!this.pendingEndpointFlip;
        this.cycleDirection*=-1;
        this.completeSpell(key);return true;
      }
      const prompts={teleport:'Teleportace: vyber vlastní figuru.',heal:'Léčení: vyber zraněnou figuru.',exchange:'Výměna: vyber první figuru.',summonElemental:'Elementál: vyber nepřítele.',revive:'Oživení: vyber padlou figuru v nabídce.',imprison:'Uvěznění: vyber nepřítele.'};
      this.message=prompts[key];return true;
    }
    magicImmune(unit){return this.isPower(unit.x,unit.y);}
    completeSpell(key){this.usedSpells[this.turn].add(key);this.spell=null;this.emit('spell',{spell:key});this.finishTurn();}
    chooseRevive(id){
      if(this.spell?.key!=='revive'||this.spell.stage!==0)return false;
      const u=this.unit(id);if(!u||u.alive||u.side!==this.turn)return false;
      // $4DCC selects the first dead original index for each distinct type.
      const first=this.revivableUnits().find(dead=>dead.type===u.type);
      this.spell.first=first.id;this.spell.stage=1;this.message='Vyber volné pole vedle svého mága.';return true;
    }
    revivableUnits(){
      const types=new Set();return this.units.filter(u=>!u.alive&&u.side===this.turn)
        .sort((a,b)=>(a.originalIndex??0)-(b.originalIndex??0)).filter(u=>{if(types.has(u.type))return false;types.add(u.type);return true;});
    }
    spellCell(x,y,computer=false){
      if(!this.inBoard(x,y))return false;
      const spell=this.spell,key=spell.key,target=this.at(x,y);
      if(!computer&&this.isPower(x,y))return this.say('Na magickém bodě kouzla nepůsobí.');
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
        if(!target||target.side!==this.turn)return this.say('Vyber vlastní figuru.');
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
        let element;do{element=this.randomByte()&3;}while(element===this.lastElemental);this.lastElemental=element;
        const type=16+element,elemental={id:'elemental-'+this.totalTicks,originalIndex:36+element,type,side:this.turn,health:this.rules.units[type].hp,alive:true,x:-1,y:-1};
        this.usedSpells[this.turn].add(key);this.spell=null;this.emit('spell',{spell:key});
        // The CPU dispatch ignores the failed shield validation but still spends
        // the spell and turn; $624B leaves the arena challenge flag unset.
        if(computer&&this.isPower(x,y)){this.finishTurn();return true;}
        this.startArena(elemental,target,{summoned:true});return true;
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
        else if(spell.key==='heal')valid=!!u&&u.side===this.turn;
        else if(spell.key==='exchange')valid=!!u&&!u.imprisoned&&u.id!==spell.first;
        else if(['imprison','summonElemental'].includes(spell.key))valid=!!u&&u.side!==this.turn&&(spell.key!=='imprison'||this.luminosity!==(u.side==='light'?5:0));
        else if(spell.key==='revive'&&spell.stage===1){const m=this.mage();valid=!u&&Math.max(Math.abs(x-m.x),Math.abs(y-m.y))===1;}
        if(valid)out.push({x,y});
      }
      return out;
    }
    advanceLight(){
      const cycle=this.rules.luminosity.cycle;if(this.pendingEndpointFlip){this.cycleIndex=this.luminosity===0?5:0;this.pendingEndpointFlip=false;}else this.cycleIndex=(this.cycleIndex+this.cycleDirection+cycle.length)%cycle.length;
      this.releasePrisoners();
      this.emit('light',{shade:this.luminosity});
    }
    releasePrisoners(){
      for(const u of this.liveUnits)if(u.imprisoned&&(u.side==='light'&&this.luminosity===5||u.side==='dark'&&this.luminosity===0))u.imprisoned=false;
    }
    checkVictory({prisoners=true,currentOnly=false}={}){
      const control=this.powerControl;
      for(const side of SIDES)if(control[side]===5){this.end(side,'Obsazení všech pěti magických bodů.');return true;}
      const counts=SIDES.map(side=>this.liveUnits.filter(u=>u.side===side).length);
      if(!counts[0]&&!counts[1]){this.end(null,'Obě armády padly.');return true;}
      for(let i=0;i<2;i++)if(!counts[i]){this.end(SIDES[1-i],'Nepřátelská armáda byla zničena.');return true;}
      for(let i=0;i<2;i++)if(prisoners&&(!currentOnly||SIDES[i]===this.turn)&&counts[i]===1&&this.liveUnits.find(u=>u.side===SIDES[i]).imprisoned){this.end(SIDES[1-i],'Poslední nepřátelská figura je uvězněná.');return true;}
      return false;
    }
    end(side,reason){this.winner=side;this.endReason=reason;this.phase='over';this.message=side?sideName(side)+' vítězí.':'Remíza.';this.emit('end',{winner:side});}
    finishTurn(){
      this.selected=null;this.spell=null;this.arena=null;
      if(this.checkVictory({prisoners:false}))return;
      const previous=this.turn;this.turn=other(this.turn);this.turnNumber++;
      if(previous!==this.firstSide){
        if(this.quietCounter&&!(this.quietCounter&15)){this.end(null,'Malé armády se dvanáct kol nesetkaly v boji.');return;}
        if(this.quietCounter)this.quietCounter--;
        this.round++;this.advanceLight();
        for(const u of this.liveUnits){
          const peak=u.side==='light'?this.luminosity===5:this.luminosity===0;
          u.health=Math.min(this.spec(u).hp,u.health+(this.isPower(u.x,u.y)?1:0)+(peak?1:0));
        }
      }
      if(this.checkVictory({currentOnly:true}))return;
      this.phase='board';this.aiDelay=45;this.message=sideName(this.turn)+' je na tahu.';
      this.emit('turn',{side:this.turn});
    }
    startArena(attacker,defender,options={}){
      this.quietCounter=0;this.selected=null;this.spell=null;
      const square={x:defender.x,y:defender.y},fighters=[];
      for(const [index,unit] of [attacker,defender].entries()){
        // $5196 assigns arena slots by the moving side, not the piece's owner.
        // The original AI can teleport an enemy piece; keep that source quirk.
        const combatSide=index?other(this.turn):this.turn;
        const copied=unit.type===12?this.spec(unit===attacker?defender:attacker):this.spec(unit);
        const type=copied.id,spec=copied,bonus=unit.type>=16?0:this.lifeBonus(combatSide,square.x,square.y);
        const base=unit.type===12?(type>=16?this.spec(unit).hp:spec.hp):unit.health,hp=base+bonus;
        const actor={unitId:unit.id,unitType:unit.type,type,side:combatSide,spec,bonus,maxHP:base+bonus,hp,
          x:combatSide==='light'?30:290,y:105,vx:0,vy:0,look:{x:combatSide==='light'?1:-1,y:0},
          cooldown:20,attackTicks:0,areaTicks:0,areaAge:0,hurt:0,moving:false,walkAge:0,aiInput:neutral(),aiClock:0};
        fighters[combatSide==='light'?0:1]=actor;
      }
      this.arena={attacker,defender,attackerSide:this.turn,square,summoned:!!options.summoned,fighters,shots:[],elapsed:0,winner:undefined,resultText:''};
      this.arena.native=new root.ArchonArena.Arena(this,fighters,options);
      this.phase='arena-intro';this.phaseTicks=75;this.message=NAMES[attacker.type]+' proti '+NAMES[defender.type];
      this.emit('challenge',{attacker:attacker.type,defender:defender.type});
    }
    startAttack(actor){
      if(actor.cooldown||actor.weapon.active)return;
      const native=this.arena.native,i=this.arena.fighters.indexOf(actor);
      if(actor.look.x)native.aimAxis(actor,'x',actor.look.x);
      if(actor.look.y||!actor.look.x)native.aimAxis(actor,'y',actor.look.y||1);
      native.startWeapon(i);
    }
    areaSize(actor){return this.arena.native.areaSize(actor);}
    tickArena(inputs){
      const arena=this.arena;arena.elapsed++;arena.native.step(inputs);
      arena.shots=arena.fighters.filter(f=>f.weapon.active&&!(root.ARCHON_MECHANICS.weaponParameters[f.type]&64)).map(f=>({owner:f.side,type:f.type,x:(f.weapon.hx-48)*2+8,y:f.weapon.by+4,dx:root.ArchonArena.signed(f.weapon.dx)*2,dy:root.ArchonArena.signed(f.weapon.dy),dead:false}));
      if(arena.native.finished)this.resolveArena();
    }
    resolveArena(){
      const arena=this.arena,alive=arena.fighters.filter(a=>a.hp>0);
      arena.winner=alive.length===1?alive[0].side:null;
      for(const actor of arena.fighters){
        const unit=actor.unitId===arena.attacker.id?arena.attacker:arena.defender;
        if(actor.hp<=0){unit.alive=false;unit.imprisoned=false;this.emit('defeat',{side:unit.side,unit:unit.type});}
        // Shapeshifter recovery is still the web fallback. The supplied XEX's
        // $5533 indexes by piece ID and can pop unrelated stack data; see PORTING.
        else unit.health=unit.type===12?this.spec(unit).hp:Math.max(1,Math.min(unit.health,actor.hp));
      }
      if(arena.winner===arena.attackerSide&&!arena.summoned){arena.attacker.x=arena.square.x;arena.attacker.y=arena.square.y;}
      arena.resultText=arena.winner?sideName(arena.winner)+' ovládlo arénu.':'Obě figury padly.';
      if(arena.summoned&&arena.winner===arena.attackerSide)arena.resultText='Elementál porazil soupeře a mizí.';
      this.phase='arena-result';this.phaseTicks=115;this.message=arena.resultText;this.emit('result',{winner:arena.winner});
    }
    computerTurn(){
      const action=new root.ArchonBoardAI.BoardAI(this).choose();
      if(!action){this.aiDelay=45;return;}
      if(!action.spell){const unit=this.unit(action.unit);this.move(unit,action.x,action.y);return;}
      if(!this.beginSpell(action.spell,true)){this.aiDelay=45;return;}
      if(action.spell==='shiftTime')return;
      // $50F6 bypasses human validation after the computer's target selection.
      if(action.spell==='teleport'){
        const unit=this.unit(action.target),target=this.at(action.x,action.y);
        this.usedSpells[this.turn].add(action.spell);this.spell=null;this.emit('spell',{spell:action.spell});
        if(target)this.startArena(unit,target);
        else{unit.x=action.x;unit.y=action.y;this.emit('move',{unit:unit.type});this.finishTurn();}
        return;
      }
      if(action.spell==='summonElemental'){
        // $4BC0 can retain a protected target and waste the spell/turn.
        this.spellCell(action.x,action.y,true);return;
      }
      if(action.spell==='revive')this.chooseRevive(action.revive);
      this.spellCell(action.x,action.y);
      if(this.spell){this.cancel();this.aiDelay=45;}
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

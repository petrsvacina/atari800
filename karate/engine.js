/* Native PAL game. Combat routines are translated from the supplied ATR. */
(function(root){
  'use strict';
  const Original=root.KarateOriginal,Bonus=root.KarateBonus;
  const HZ=50,POSE_TICKS=5,HIT_POSE_TICKS=7;
  const BELTS=[[0,'Bílý','#eee9d7'],[6000,'Žlutý','#eac953'],[12000,'Zelený','#6c9c68'],[18000,'Fialový','#a97cb5'],[24000,'Hnědý','#986d43'],[40000,'Černý','#303844']];
  const MOVES = {1: {'name': 'Skok'}, 2: {'name': 'Přední úder'}, 3: {'name': 'Krok vpřed'}, 4: {'name': 'Kop do hrudi'}, 5: {'name': 'Podmet'}, 6: {'name': 'Úder z dřepu'}, 7: {'name': 'Ústup / blok'}, 8: {'name': 'Zadní úder'}, 9: {'name': 'Letící kop'}, 10: {'name': 'Salto vpřed'}, 11: {'name': 'Přední kop'}, 12: {'name': 'Přední boční kop'}, 13: {'name': 'Zadní úder z dřepu'}, 14: {'name': 'Zadní boční kop'}, 15: {'name': 'Obloukový kop'}, 16: {'name': 'Salto vzad'}};
  const neutral=()=>({x:0,y:0,fire:false});
  function player(id,origin,facing){
    const p={id,origin,facing,frame:0,action:0,pose:0,nextPose:0,age:0,uninterrupted:0,
      reverse:0,preparation:0,strikeTicks:0,inputFlipped:0,frozen:0,flags:0,previousFlags:0,threat:0,idleCounter:0,idleVariant:0};
    Object.defineProperty(p,'x',{enumerable:true,get(){return (this.origin+(this.facing===1?12:24)-16)*2;},set(x){this.origin=Math.round(x/2)+16-(this.facing===1?12:24);}});
    return p;
  }
  // Static move guide. Gameplay reads the original context-dependent input tables.
  function inputAction(input,facing){
    const x=Math.sign(input?.x||0)*facing,y=Math.sign(input?.y||0);
    const d=y<0?(x>0?2:x<0?8:1):y>0?(x>0?4:x<0?6:5):x>0?3:x<0?7:0;
    return d?d+(input?.fire?8:0):0;
  }
  class KarateGame{
    constructor(options={}){
      this.mode=options.mode==='two'?'two':'solo';this.human=0;
      this.animations=root.KARATE_ANIMATIONS;this.hitData=root.KARATE_HIT_DATA;
      this.random=options.random||Math.random;this.randomByte=()=>Math.floor(this.random()*256)&255;
      this.scanline=()=>Math.floor(this.random()*156);
      this.round=1;this.stage=1;this.cycle=1;this.level=0;this.scene=0;this.belt=0;this.weaponDifficulty=0;
      this.wins=[0,0];this.soloWins=0;this.score=[0,0];this.points=[0,0];this.roundScore=[0,0];this.tug=60;
      this.events=[];this.totalTicks=0;this.priority=0;this.attackOwner=0;this.stepClock=0;this.poseClock=0;this.frameByte=0;this.message='Připrav se';
      this.time=(this.mode==='two'?60:30)*HZ;this.secondClock=25;this.lastWinner=null;this.resetFighters();
    }
    emit(type,data={}){this.events.push({type,tick:this.totalTicks,...data});}
    drainEvents(){const events=this.events;this.events=[];return events;}
    isHuman(id){return this.mode==='two'||id===this.human;}
    resetFighters(){
      this.players=[player(0,48,1),player(1,104+(this.randomByte()&7),-1)];
      const bow=this.mode==='solo'||this.seconds===60;
      for(const p of this.players){
        Original.select(p,bow?28:0,this.randomByte);
        this.animate(p,0,this.isHuman(p.id));
      }
      this.lastPoint=null;this.hitState=0;this.stepClock=0;this.phase=bow?'ready':'fight';
      this.phaseTicks=bow?70:0;
    }
    get beltInfo(){return BELTS[this.belt];}
    get seconds(){return Math.max(0,Math.ceil(this.time/HZ));}
    get referee(){
      let message=null;
      if(this.phase==='ready')message='HRAJEME!'; // Original $2E92: BEGIN during the bow.
      if(this.phase==='round')message=this.roundPrompt==='SCORE'?(this.mode==='two'?`+${this.roundAward||0}`:String(this.seconds)):this.roundPrompt;
      if(this.phase==='point'&&this.lastPoint){
        const df=150-this.phaseTicks;
        if(this.mode==='two')message=df<100?(this.lastPoint.player===0?'BÍLÝ':'ČERVENÝ'):String(this.seconds);
        else if(df<130)message=df<50?(this.lastPoint.player===0?'BÍLÝ':'ČERVENÝ'):(this.lastPoint.units===2?'CELÝ BOD':'PŮL BODU');
      }
      return {frame:'neutral',message};
    }
    startAction(p,id){Original.select(p,id,this.randomByte);p.age=0;}
    updatePlayer(p,input,stepTicks=POSE_TICKS){
      if(++p.age<stepTicks)return;
      p.age=0;this.animate(p,Original.controls(p,this.players.find(q=>q.id!==p.id),input),this.isHuman(p.id));
    }
    animate(p,command,human,forced=false){
      const before=p.frame;Original.motion(p,command,human,this.randomByte,forced);
      if(p.frame!==before)this.emit('pose',{player:p.id,frame:p.frame,flags:p.flags,falling:[17,18,19,31].includes(p.action)});
    }
    combatStep(inputs,hit=false){
      if(!hit){
        const frames=this.players.map(p=>p.frame);
        this.priority=Original.step(this.players,inputs,[this.isHuman(0),this.isHuman(1)],this.level,this.priority,this.randomByte,this.scanline);
        this.attackOwner=this.priority; // Both $3D00 calls write D4, even for human actors.
        for(const p of this.players)if(p.frame!==frames[p.id])this.emit('pose',{player:p.id,frame:p.frame,flags:p.flags,falling:[17,18,19,31].includes(p.action)});
        if(this.phase==='fight')this.resolveCombat();
        return;
      }
      const commands=this.players.map((p,i)=>Original.controls(p,this.players[i^1],hit?neutral():inputs[i]));
      for(const i of [1,0]){
        const p=this.players[i];
        this.animate(p,commands[i],this.isHuman(i),hit);
      }
      this.priority^=1; // $3C06 alternates the first eligible attacker before contact.
    }
    attackResult(attacker,defender){
      const hit=Original.contact(attacker,defender,this.hitData);
      return hit?{...hit,attacker,defender}:null;
    }
    resolveCombat(){
      // $415A stops after the first eligible attack, even when its contact misses.
      const result=Original.arbitrate(this.players,this.priority,this.hitData,id=>{this.attackOwner=id;});
      if(!result)return;
      const hit={...result,attacker:this.players[result.player],defender:this.players[result.player^1]};
      const id=hit.attacker.id,previous=this.points[id];this.lastWinner=id;this.hitState=hit.units;
      this.lastPoint={player:id,units:hit.units,value:hit.value,awarded:false};
      let units=hit.units,flourish=units===2&&previous>=2;
      if(this.mode==='two'){
        this.tug+=id===0?1:-1;
        this.pendingRound=this.tug<=54||this.tug>=66;
        units=this.pendingRound?2:0;flourish=this.pendingRound;
      }else this.pendingRound=previous+units>=4;
      this.lastPoint.pointUnits=units;
      this.startAction(hit.defender,hit.fall);
      if(flourish)this.startAction(hit.attacker,32);
      else Original.select(hit.attacker,0,this.randomByte,true);
      this.emit('hit',{player:id,units:hit.units,frame:hit.attacker.frame});
      this.message=hit.units===2?'Celý bod':'Půl bodu';
      this.phase='point';this.pointDuration=this.mode==='two'&&!this.pendingRound?100:150;this.phaseTicks=this.pointDuration;
      this.stepClock=0;
      this.combatStep([neutral(),neutral()],true);
      // Ordinary multiplayer starts DF at 50, so its score is displayed immediately.
      if(this.pointDuration===100)this.awardPoint();
    }
    awardPoint(){
      const hit=this.lastPoint;if(!hit||hit.awarded)return;hit.awarded=true;
      this.score[hit.player]+=hit.value;this.roundScore[hit.player]+=hit.value;
      this.points[hit.player]=Math.min(5,this.points[hit.player]+hit.pointUnits);this.belt=this.computeBelt();
    }
    computeBelt(){let index=0;for(let i=1;i<BELTS.length;i++)if(this.score[this.human]>=BELTS[i][0])index=i;return index;}
    timeoutWinner(){
      if(this.mode==='two')return this.tug===60?(this.roundScore[0]===this.roundScore[1]?null:this.roundScore[0]>this.roundScore[1]?0:1):this.tug>60?0:1;
      if(this.points[0]!==this.points[1])return this.points[0]>this.points[1]?0:1;
      if(this.roundScore[0]!==this.roundScore[1])return this.roundScore[0]>this.roundScore[1]?0:1;
      return this.lastWinner??this.roundWinner??0;
    }
    endRound(winner){
      this.roundWinner=winner;this.phase='round';this.message=winner===null?'Remíza':winner===0?'Vítězí bílý':'Vítězí červený';this.emit('round',{winner});
      this.poseClock=16;this.resultProgram=this.resultSequence(winner);this.resumeResult();
    }
    *displayWait(frames){
      this.displayTimer=frames;
      do{yield {sync:true,hit:!!this.hitState};}while(this.displayTimer>0);
    }
    *resultSequence(winner){ // $2918-$2B9F, with original display waits and score countdown.
      if(this.time<=0)for(const p of this.players)p.frame=48;
      const facing=Original.geometry(this.players[0],this.players[1]).context&4;
      for(const p of this.players)if(p.frame<39||p.frame>=48){p.facing=((facing?1:0)^p.id)?-1:1;p.origin=Math.max(16,Math.min(136,p.origin));}
      if(this.mode==='solo'){
        if(winner===this.human)this.soloWins++;
        const p=this.players[winner];this.roundPrompt=winner===0?'BÍLÝ':'ČERVENÝ';p.frame=49;p.origin++;
        yield 25;yield 50;this.roundPrompt=null;p.frame=48;p.origin--;yield 25;
        if(this.time>0){this.roundPrompt='SCORE';while(this.time>0){this.time-=HZ;this.score[winner]+=100;this.belt=this.computeBelt();yield 4;}}
        yield 50;
      }else{
        if(this.time<=0){this.roundPrompt='STOP';yield* this.displayWait(75);}
        if(winner===null){
          if(!this.roundScore.some(Boolean)){this.resultProgram=null;this.phase='gameover';this.message='Remíza';this.emit('end');return;}
          this.roundPrompt='Remíza';yield* this.displayWait(100);
        }else{
          this.wins[winner]++;this.roundPrompt=winner===0?'BÍLÝ':'ČERVENÝ';
          if(this.tug<=54||this.tug>=66){yield* this.displayWait(75);this.score[winner]+=1000;this.roundAward=1000;this.roundPrompt='SCORE';}
          const p=this.players[winner];p.frame=49;p.origin++;yield* this.displayWait(50);p.frame=48;p.origin--;yield* this.displayWait(75);
        }
        if(this.stage>=5||this.wins.some(w=>w>=2)){
          const survivor=this.wins[0]!==this.wins[1]?(this.wins[0]>this.wins[1]?0:1):this.score[0]!==this.score[1]?(this.score[0]>this.score[1]?0:1):null;
          if(survivor===null){
            this.roundPrompt='Remíza';yield* this.displayWait(75);this.roundPrompt='KONEC SOUBOJE';yield* this.displayWait(200);
            this.resultProgram=null;this.phase='gameover';this.message='Remíza';this.emit('end');return;
          }
          this.roundPrompt=survivor===0?'Vítězí bílý':'Vítězí červený';yield* this.displayWait(100);
          if(this.stage<5){this.score[survivor]+=5000;this.roundAward=5000;this.roundPrompt='SCORE';yield* this.displayWait(100);}
        }
      }
      this.roundPrompt=null;this.resultProgram=null;this.nextRound();
    }
    resumeResult(){
      for(let guard=0;guard<50;guard++){
        const result=this.resultProgram.next();if(result.done)return;
        const request=result.value;
        if(typeof request==='number'){this.resultWait=request;this.resultSync=0;return;}
        const period=request.hit?HIT_POSE_TICKS:POSE_TICKS;
        if(this.poseClock>=period){this.poseClock=0;this.priority^=1;continue;}
        this.resultWait=period-this.poseClock;this.resultSync=period;return;
      }
      throw new Error('Invalid result transition');
    }
    nextRound(){
      const winner=this.roundWinner;
      if(this.mode==='solo'&&winner!==this.human){this.phase='gameover';this.message='Turnaj skončil';this.emit('end');return;}
      if(this.mode==='two'&&(this.stage>=5||this.wins.some(w=>w>=2))){
        let survivor;
        if(this.wins[0]!==this.wins[1])survivor=this.wins[0]>this.wins[1]?0:1;
        else if(this.score[0]!==this.score[1])survivor=this.score[0]>this.score[1]?0:1;
        else {this.phase='gameover';this.message='Remíza';this.emit('end');return;}
        // $2B6E/$2B76 announce the series result but do not replace D1. $2C0E
        // therefore retains the last bout's winner (or D4 after a drawn bout).
        const retained=winner??this.attackOwner;
        this.mode='solo';this.human=retained;this.score[retained^1]=0;
        // $2C0E uses the winner's BCD ten-thousands byte as the table index.
        const high=Math.floor(this.score[retained]/10000),index=high?Math.floor(high/10)*16+high%10+10:0;
        this.stage=root.KARATE_ROUTINE_DATA.transferLevels[index]||0;this.cycle=this.stage;this.level=this.stage;
      }
      this.prepareRound();
    }
    advanceStage(){
      const state={stage:this.stage,cycle:this.cycle,level:this.level,weaponDifficulty:this.weaponDifficulty,multiplayer:this.mode==='two'};
      const mode=Bonus.advance(state);Object.assign(this,{stage:state.stage,round:state.stage,cycle:state.cycle,level:state.level,weaponDifficulty:state.weaponDifficulty});
      return mode;
    }
    prepareRound(){
      const mode=this.advanceStage();
      this.points=[0,0];this.roundScore=[0,0];this.tug=60;this.lastWinner=null;this.time=(this.mode==='two'?60:30)*HZ;this.secondClock=25;
      this.resetFighters();this.message='Připrav se';this.emit('ready');
      if(mode===4||mode===5)this.startBonus(mode===4?'tiles':'dodge');
    }
    bonusCommand(id){return Original.controls(this.players[id],this.players[id^1],this.inputs?.[id]||neutral());}
    bonusMotion(id,command,falling=false){
      const p=this.players[id],before=p.frame;Original.motion(p,command,true,this.randomByte,falling);
      // $39AE runs here only during a knockdown, not ordinary bonus movements.
      if(falling&&p.frame!==before)this.emit('pose',{player:id,frame:p.frame,flags:p.flags,falling:true});
    }
    startBonus(kind=this.cycle===4?'tiles':'dodge'){
      this.bonus={kind,player:0,age:0,df:0,broken:0,target:0,points:0,prompt:null,weapon:null};
      this.bonusProgram=this.bonusSequence(kind);this.resumeBonus();
    }
    *bonusSequence(kind){
      for(let id=0;id<2;id++)if(this.isHuman(id)){
        if(kind==='tiles')yield* this.tileTrial(id);else yield* this.weaponTrial(id);
      }
      this.phase='bonus-result';yield 40;
      this.bonusProgram=null;this.bonus=null;
      // $303C: finish both players, advance the stage, then invoke $4389.
      this.prepareRound();this.scene=(this.scene+1)%7;this.emit('scene',{scene:this.scene});
    }
    resumeBonus(){
      for(let guard=0;guard<100;guard++){
        const result=this.bonusProgram.next();if(result.done)return;
        const request=result.value;
        if(typeof request==='number'){if(!request)continue;this.bonusWait=request;this.bonusSync=0;return;}
        const period=request.hit?HIT_POSE_TICKS:POSE_TICKS;
        if(this.poseClock>=period){this.poseClock=0;this.priority^=1;continue;}
        this.bonusWait=period-this.poseClock;this.bonusSync=period;return;
      }
      throw new Error('Invalid bonus transition');
    }
    *tileTrial(id){ // $3059-$31A7, including quiet-input calibration before GO.
      const b=this.bonus,p=this.players[id];b.player=id;b.broken=0;b.target=0;b.points=0;b.prompt=null;b.weapon=null;
      p.origin=84;p.facing=1;p.frame=52;p.action=0;p.inputFlipped=0;
      this.phase='bonus-ready';this.message='Bonus · rozbíjení dlaždic';yield {sync:true};yield 100;
      yield 25;b.prompt='WAIT';yield 100;yield {sync:true};yield ((this.randomByte()&63)|15);
      b.df=0;this.frameByte=0;b.clockWraps=0;let previous=this.bonusCommand(id);
      for(;;){
        const command=this.bonusCommand(id);
        if(command===previous){if(b.df>=13){b.df=0;break;}}
        else {previous=command;b.df=0;if(b.clockWraps){b.df=25;break;}}
        yield 1;
      }
      b.prompt='GO';this.phase='bonus';
      while(this.bonusCommand(id)===previous&&b.df<100)yield 1;
      if(this.bonusCommand(id)===previous){
        b.prompt='SLOW';this.phase='bonus-result';this.message='Pozdě';yield 100;
      }else{
        b.reaction=b.df;b.target=Bonus.tileCount(b.df);p.frame=53;
        do{
          yield {sync:true};b.broken++;this.emit('break',{player:id,count:b.broken});yield b.broken;
        }while(b.broken<b.target);
        p.frame=52;yield {sync:true};yield 50;
        b.points=Bonus.tileScore(b.target);this.score[id]+=b.points;this.belt=this.computeBelt();
        b.prompt='SCORE';this.phase='bonus-result';this.message=`${b.broken} z 10 dlaždic`;yield 100;
      }
      b.prompt=null;
    }
    *weaponTrial(id){ // $2F3E-$3047; VBI movement is separate from the five-frame actor loop.
      const b=this.bonus,p=this.players[id];b.player=id;b.df=0;b.age=0;b.points=0;b.prompt='WAIT';
      b.weapon=Bonus.weaponState(id,this.weaponDifficulty);p.origin=84;p.facing=id?-1:1;p.frame=0;p.frozen=0;
      Original.select(p,0,this.randomByte,true);this.poseClock=16;this.phase='bonus-ready';this.message='Bonus · vyhýbej se zbraním';
      do{yield {sync:true};this.bonusMotion(id,this.bonusCommand(id));}while(b.df<80);
      b.prompt=null;
      do{this.bonusMotion(id,this.bonusCommand(id));yield {sync:true};}while(b.df<200);
      b.weapon.enabled=1;this.phase='bonus';
      do{this.bonusMotion(id,this.bonusCommand(id));yield {sync:true};}while(!b.weapon.failed&&b.weapon.remaining);
      this.phase='bonus-result';
      if(b.weapon.failed){
        b.df=id;b.prompt=null;const fall=(b.weapon.dir^(p.facing===-1?1:0))?18:17;
        Original.select(p,fall,this.randomByte,true);
        do{this.bonusMotion(id,0,true);yield {sync:true,hit:true};}while(b.df<128);
      }else{
        b.weapon.enabled=0;b.df=0;b.points=2000;this.score[id]+=2000;this.belt=this.computeBelt();b.prompt='SCORE';
        do{this.bonusMotion(id,0);yield {sync:true};}while(b.df<128);
      }
      b.weapon.enabled=0;b.prompt=null;
    }
    tickBonus(){
      const b=this.bonus;b.age++;b.df=(b.df+1)&255;if(this.frameByte===0)b.clockWraps=(b.clockWraps||0)+1;
      if(b.weapon){Bonus.latchCollision(b.weapon,Bonus.weaponContact(b.weapon,this.players[b.player]));Bonus.weaponFrame(b.weapon,this.frameByte,this.randomByte);}
      if(--this.bonusWait<=0){if(this.bonusSync){this.poseClock=0;this.priority^=1;}this.resumeBonus();}
    }
    tick(inputs=[neutral(),neutral()]){
      this.totalTicks++;this.frameByte=(this.frameByte+1)&255;this.poseClock=(this.poseClock+1)&255;this.inputs=inputs;
      if(this.phase==='gameover')return;
      if(this.displayTimer>0)this.displayTimer--;
      if(this.resultProgram){if(--this.resultWait<=0){if(this.resultSync){this.poseClock=0;this.priority^=1;}this.resumeResult();}return;}
      if(this.bonusProgram){this.tickBonus();return;}
      if(this.phase==='ready'||this.phase==='fight'){
        if(this.phase==='fight'&&--this.secondClock<=0){this.time=Math.max(0,this.time-HZ);this.secondClock=HZ;}
        if(++this.stepClock>=POSE_TICKS){this.stepClock=0;this.poseClock=0;this.combatStep(inputs);}
        if(this.phase==='ready'){
          this.phaseTicks=Math.max(0,this.phaseTicks-1);
          if(this.players.every(p=>p.action!==28)){this.phase='fight';this.message='Hrajeme!';this.emit('fight');}
        }
        if(this.phase==='fight'&&this.time<=0)this.endRound(this.timeoutWinner());
        return;
      }
      if(this.phase==='point'){
        this.phaseTicks--;
        if(++this.stepClock>=HIT_POSE_TICKS){this.stepClock=0;this.poseClock=0;this.combatStep([neutral(),neutral()],true);}
        if(150-this.phaseTicks>=50)this.awardPoint();
        if(this.phaseTicks<=0){if(this.pendingRound)this.endRound(this.lastWinner);else this.resetFighters();}
        return;
      }


    }
  }
  root.KarateEngine={Game:KarateGame,MOVES,BELTS,HZ,POSE_TICKS,HIT_POSE_TICKS,inputAction,neutral};
  if(typeof module!=='undefined')module.exports=root.KarateEngine;
})(globalThis);

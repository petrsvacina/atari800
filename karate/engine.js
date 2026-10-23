/* Native 50 Hz game logic. Original animation frames, displacements and cadence. */
(function (root) {
  'use strict';
  const HZ = 50, POSE_TICKS = 5, HIT_POSE_TICKS = 7;
  const BELTS = [[0, 'Bílý', '#eee9d7'], [6000, 'Žlutý', '#eac953'], [12000, 'Zelený', '#6c9c68'],
    [18000, 'Fialový', '#a97cb5'], [24000, 'Hnědý', '#986d43'], [40000, 'Černý', '#303844']];
  // Input names and action metadata; hit geometry uses the original ATR tables.
  const MOVES = {
    1: {name:'Skok', air:true}, 2:{name:'Přední úder', height:'high', reach:40, active:[1], value:800},
    3: {name:'Krok vpřed', walk:true}, 4:{name:'Kop do hrudi', height:'high', reach:53, active:[2], value:800},
    5: {name:'Podmet', height:'low', reach:37, active:[1], value:400},
    6: {name:'Úder z dřepu', height:'mid', reach:39, active:[1], value:400, low:true},
    7: {name:'Ústup / blok', walk:true, guard:true}, 8:{name:'Zadní úder', height:'high', reach:40, active:[2], value:800, turn:1},
    9: {name:'Letící kop', height:'high', reach:52, active:[2,3], value:1000, air:true},
    10:{name:'Salto vpřed', air:true}, 11:{name:'Přední kop', height:'mid', reach:52, active:[2], value:200},
    12:{name:'Přední boční kop', height:'low', reach:43, active:[1], value:200, low:true},
    13:{name:'Zadní úder z dřepu', height:'mid', reach:39, active:[2], value:400, turn:1, low:true},
    14:{name:'Zadní boční kop', height:'low', reach:43, active:[2], value:200, turn:1, low:true},
    15:{name:'Obloukový kop', height:'high', reach:56, active:[4], value:1000},
    16:{name:'Salto vzad', air:true}
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const neutral = () => ({x:0,y:0,fire:false});
  const player = (id, x, facing) => ({id,x,facing,frame:0,action:0,pose:0,age:0,lock:false,
    connected:false,turned:false,guard:false,low:false,air:false,cancelled:false,lastInput:0,strikeTicks:0});
  function inputAction(input, facing) {
    const x = Math.sign(input?.x || 0) * facing, y = Math.sign(input?.y || 0);
    let direction = 0;
    if (y < 0) direction = x > 0 ? 2 : x < 0 ? 8 : 1;
    else if (y > 0) direction = x > 0 ? 4 : x < 0 ? 6 : 5;
    else if (x) direction = x > 0 ? 3 : 7;
    return direction ? direction + (input.fire ? 8 : 0) : 0;
  }
  class KarateGame {
    constructor(options = {}) {
      this.mode = options.mode === 'two' ? 'two' : 'solo';
      this.difficulty = ['easy','normal','hard'].includes(options.difficulty) ? options.difficulty : 'normal';
      this.animations = options.animations || root.KARATE_ANIMATIONS;
      this.hitData = options.hitData || root.KARATE_HIT_DATA;
      if (!this.animations?.[16]) throw new Error('Chybějí původní animace.');
      this.random = options.random || Math.random;
      this.round = 1; this.wins = [0,0]; this.score = [0,0]; this.points = [0,0];
      this.belt = 0; this.phase = 'ready'; this.phaseTicks = 90; this.time = 30 * HZ;
      this.events = []; this.message = 'Připrav se'; this.totalTicks = 0; this.scene = 0;
      this.ai = {cooldown:0,hold:0,input:neutral(),last:-1};
      this.resetFighters();
    }
    emit(type, data = {}) { this.events.push({type,tick:this.totalTicks,...data}); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    resetFighters() { this.players = [player(0,90,1),player(1,230,-1)]; this.ai.hold=0; this.lastPoint=null; }
    get beltInfo() { return BELTS[this.belt]; }
    get seconds() { return Math.ceil(this.time / HZ); }
    get referee() {
      const state={frame:'neutral',message:null};
      if(this.phase==='point'&&this.lastPoint) {
        const age=this.pointDuration-this.phaseTicks;
        if(age<this.pointDuration-20)state.message=age<50
          ?(this.lastPoint.player===0?'BÍLÝ':'ČERVENÝ')
          :(this.lastPoint.units===2?'CELÝ BOD':'PŮL BODU');
      }
      return state;
    }
    startAction(p, id) {
      p.action=id; p.pose=0; p.age=0; p.connected=false; p.turned=false; p.cancelled=false; p.strikeTicks=0;
      p.lock=!MOVES[id]?.walk; this.applyPose(p);
      if (MOVES[id]?.active) this.emit('swing',{player:p.id});
    }
    applyPose(p) {
      const anim = this.animations[p.action];
      const move = MOVES[p.action] || {};
      const previousFrame=p.frame;
      if (move.turn === p.pose && !p.turned) {
        const oldAnchor=p.facing===1?12:24;
        p.facing *= -1; p.turned=true;
        p.x+=2*((p.facing===1?12:24)-oldAnchor);
      }
      p.frame = anim.frames[p.pose] ?? 0;
      p.x = clamp(p.x + (anim.dx[p.pose] || 0) * 2 * p.facing, 20,300);
      p.guard=!!move.guard; p.low=!!move.low || [17,18,21,32,33,38,39,44,45,46,47].includes(p.frame);
      p.air=!!move.air && p.pose>0 && p.pose<anim.frames.length-2;
      if(p.frame!==previousFrame)this.emit('pose',{player:p.id,frame:p.frame,flags:anim.flags[p.pose]||0,falling:[17,18,19,31].includes(p.action)});
    }
    updatePlayer(p, input, stepTicks=POSE_TICKS) {
      const requested = inputAction(input,p.facing);
      if (!requested) p.lock=false;
      if(MOVES[p.action]?.walk&&requested!==p.action&&(this.animations[p.action].flags[p.pose]&16)) {
        p.action=0;p.frame=0;p.guard=false;
      }
      if (p.action) {
        const move=MOVES[p.action];
        // Releasing an attack during its preparation cancels it. A held attack
        // does not restart until the joystick is released.
        if (move?.active && !p.cancelled && !p.connected && !requested && p.pose<move.active[0]) {
          p.cancelled=true; p.action=0; p.frame=0; p.age=0; p.low=false; p.air=false; p.guard=false;
        } else {
          if(this.hitData.attackFrames.includes(p.frame))p.strikeTicks++;
          const heldStrike=!!(this.animations[p.action].flags[p.pose]&8)&&requested;
          const knockedDown=p.pose===this.animations[p.action].frames.length-1&&(this.animations[p.action].flags[p.pose]&32);
          if(!heldStrike&&!knockedDown)p.age++;
          if (p.age>=stepTicks) {
            p.age=0; p.pose++;
            if (p.pose>=this.animations[p.action].frames.length) {
              p.action=0; p.frame=0; p.guard=false; p.low=false; p.air=false;
            } else this.applyPose(p);
          }
        }
      }
      if (!p.action && requested && (!p.lock || MOVES[requested]?.walk)) {
        // Turning is deliberate: attacks 8/13/14 turn the original character.
        this.startAction(p,requested);
      }
      if (!p.action && !requested) { p.frame=0; p.guard=false; p.low=false; p.air=false; }
      p.lastInput=requested;
    }
    separatePlayers() {
      const [a,b]=this.players;
      if (a.air || b.air) return;
      const diff=b.x-a.x;
      if (Math.abs(diff)<25) {
        const direction=diff<0?-1:1,center=clamp((a.x+b.x)/2,32.5,287.5);
        a.x=center-direction*12.5;b.x=center+direction*12.5;
      }
    }
    attackResult(attacker,defender) {
      const data=this.hitData,index=data.attackFrames.indexOf(attacker.frame);
      if(!MOVES[attacker.action]?.active||index<0||attacker.connected||attacker.cancelled||attacker.strikeTicks>=10)return null;
      let bodyClass=data.frameClasses[defender.frame];
      if(attacker.frame===18&&defender.frame===32)bodyClass=26;
      if(bodyClass===255||!data.bodyOffsets[bodyClass])return null;
      const ax=attacker.x/2+attacker.facing*(data.attackX[index]-12);
      for(let zone=0;zone<6;zone++) {
        const offset=data.bodyOffsets[bodyClass][zone];
        if(!(data.zoneMasks[index]&data.zoneBits[zone])||offset===128)continue;
        const tx=defender.x/2+defender.facing*(offset-12);
        let distance=attacker.facing===1?ax-tx:tx-ax;
        if(attacker.facing===defender.facing)distance+=data.halfRange[index];
        if(distance<0||distance>data.halfRange[index])continue;
        const move=MOVES[attacker.action];
        if(defender.guard&&defender.facing===-attacker.facing&&move.height!=='low')return {blocked:true,attacker,defender};
        const full=distance<data.fullRange[index];
        return {blocked:false,attacker,defender,units:full?2:1,value:full?data.fullScores[index]:data.halfScores[index]};
      }
      return null;
    }
    resolveCombat() {
      const [a,b]=this.players;
      const hits=[this.attackResult(a,b),this.attackResult(b,a)].filter(Boolean);
      const scoring=hits.filter(h=>!h.blocked);
      for (const hit of hits) {
        hit.attacker.connected=true;
        if (hit.blocked) { this.emit('block',{player:hit.defender.id}); this.message='Blok'; }
      }
      if (!scoring.length) return;
      if (scoring.length===2) {
        this.message='Současný zásah'; this.emit('clash');
        this.phase='point'; this.phaseTicks=65; this.pendingRound=false;this.lastPoint=null;
        for (const p of this.players) { p.action=0; p.frame=19; }
        return;
      }
      const hit=scoring[0], id=hit.attacker.id;
      const previousPoints=this.points[id];
      this.points[id]=Math.min(4,this.points[id]+hit.units); this.score[id]+=hit.value;
      this.belt=this.computeBelt();
      this.message=hit.units===2?'Celý bod':'Půl bodu'; this.lastWinner=id;
      this.emit('hit',{player:id,units:hit.units,frame:hit.attacker.frame});
      this.startAction(hit.defender,MOVES[hit.attacker.action]?.height==='low'?17:18);
      // Original $28D8: a full point with at least one existing point starts
      // action 32 (blow on the fist, then shake it behind the back).
      const flourish=hit.units===2&&previousPoints>=2;
      if(flourish)this.startAction(hit.attacker,32);
      else {hit.attacker.action=0;hit.attacker.frame=0;}
      this.lastPoint={player:id,units:hit.units};
      this.phase='point';this.pointDuration=this.mode==='solo'||flourish?150:100;
      this.phaseTicks=this.pointDuration;this.pendingRound=this.points[id]>=4;
    }
    computeBelt() { let index=0; for(let i=1;i<BELTS.length;i++) if(this.score[0]>=BELTS[i][0]) index=i; return index; }
    cpuInput() {
      const cpu=this.players[1],human=this.players[0];
      if (this.ai.hold>0) { this.ai.hold--; return this.ai.input; }
      const difficulty={easy:0,normal:1,hard:2}[this.difficulty];
      const distance=Math.abs(cpu.x-human.x);
      const direction=Math.sign(human.x-cpu.x)||-1;
      const orient=direction*cpu.facing;
      if (cpu.action) { this.ai.input=neutral(); return this.ai.input; }
      if (this.ai.cooldown>0) { this.ai.cooldown--; this.ai.input=neutral(); return this.ai.input; }
      if (orient<0) {
        this.ai.input={x:-cpu.facing,y:-1,fire:false}; this.ai.hold=24; return this.ai.input;
      }
      const threat=MOVES[human.action]?.active && !human.connected;
      let input;
      if (distance>49) input={x:direction,y:0,fire:false};
      else if (threat && this.random()<.2+difficulty*.2) {
        input=MOVES[human.action].height==='low'?{x:0,y:-1,fire:false}:{x:-direction,y:0,fire:false};
      } else if (distance<30 && this.random()<.45) input={x:-direction,y:0,fire:false};
      else {
        const attacks=distance>42?[3,5,9,15]:distance>30?[2,4,6,11,12]:[2,6,12];
        let action=attacks[Math.floor(this.random()*attacks.length)];
        if (action===this.ai.last) action=attacks[(attacks.indexOf(action)+1)%attacks.length];
        this.ai.last=action;
        const d=(action-1)%8+1;
        const vectors={1:[0,-1],2:[1,-1],3:[1,0],4:[1,1],5:[0,1],6:[-1,1],7:[-1,0],8:[-1,-1]};
        const [x,y]=vectors[d]; input={x:x*cpu.facing,y,fire:action>8};
        this.ai.cooldown=[22,12,5][difficulty]+Math.floor(this.random()*13);
      }
      this.ai.input=input; this.ai.hold=inputAction(input,cpu.facing)===3||inputAction(input,cpu.facing)===7?10:45; return input;
    }
    endRound(winner) {
      this.roundWinner=winner;
      if (winner!==null) this.wins[winner]++;
      this.phase='round'; this.phaseTicks=135;
      this.message=winner===null?'Remíza':winner===0?'Vítězí bílý':'Vítězí červený';
      this.emit('round',{winner});
      if (winner!==null) this.startAction(this.players[winner],28);
    }
    nextRound() {
      const winner=this.roundWinner;
      if (this.mode==='solo' && winner===1 || this.mode==='two' && this.wins.some(w=>w>=2)) {
        this.phase='gameover'; this.message=this.mode==='solo'?'Turnaj skončil':`Vítězí ${this.wins[0]>this.wins[1]?'bílý':'červený'}`;
        this.emit('end'); return;
      }
      if (this.mode==='solo' && winner===0 && this.wins[0]%3===0) { this.startBonus(); return; }
      this.prepareRound(winner!==null);
    }
    prepareRound(advance=true) {
      if (advance) this.round++;
      this.scene=(this.round-1)%7; this.points=[0,0]; this.time=30*HZ;
      this.resetFighters(); this.phase='ready'; this.phaseTicks=80; this.message='Připrav se';
      this.emit('ready');
    }
    startBonus() {
      const kind=Math.floor(this.wins[0]/3)%2===1?'tiles':'dodge';
      this.bonus={kind,age:0,goAt:100+Math.floor(this.random()*85),fired:false,previousFire:false,
        broken:0,dodged:0,misses:0,objects:[],nextObject:70,count:0};
      this.phase='bonus-ready'; this.phaseTicks=125;
      this.message=kind==='tiles'?'Bonus · rozbíjení dlaždic':'Bonus · vyhýbej se zbraním';
      this.players=[player(0,kind==='tiles'?140:160,1),player(1,230,-1)];
      this.players[0].frame=kind==='tiles'?50:0;
      this.emit('bonus',{kind});
    }
    updateBonus(input) {
      const bonus=this.bonus,p=this.players[0]; bonus.age++;
      if (bonus.kind==='tiles') {
        const fire=!!input.fire;
        if (fire&&!bonus.previousFire&&!bonus.fired) {
          bonus.fired=true;
          const delta=bonus.age-bonus.goAt;
          bonus.broken=delta<0?0:clamp(10-Math.floor(delta/4),0,10);
          this.score[0]+=bonus.broken*100+(bonus.broken===10?2000:0);
          p.frame=delta<0?50:51;
          this.message=delta<0?'Příliš brzy':bonus.broken?`${bonus.broken} z 10 dlaždic`:'Pozdě';
          this.emit('break',{count:bonus.broken}); this.phase='bonus-result'; this.phaseTicks=140;
        }
        bonus.previousFire=fire;
        if (bonus.age>bonus.goAt+90&&!bonus.fired) {
          this.message='Čas vypršel'; this.phase='bonus-result'; this.phaseTicks=100;
        }
      } else {
        // Bonus uses the same jump and crouch positions as the original fighters.
        if (p.action) this.updatePlayer(p,input);
        else if (input.y<0) this.startAction(p,1);
        else { p.low=input.y>0; p.frame=p.low?17:0; p.air=false; }
        if (bonus.count<8&&bonus.age>=bonus.nextObject) {
          const high=this.random()<.5,side=bonus.count%2;
          bonus.objects.push({x:side?335:-15,y:high?151:176,dir:side?-1:1,high,checked:false});
          bonus.count++; bonus.nextObject+=75-Math.min(20,this.wins[0]);
          this.emit('throw');
        }
        for(const object of bonus.objects) {
          object.x+=object.dir*(2.7+this.wins[0]*.08);
          if(!object.checked&&Math.abs(object.x-p.x)<8) {
            object.checked=true;
            if(object.high?p.low:p.air) {bonus.dodged++;this.score[0]+=100;this.emit('dodge');}
            else {bonus.misses++;this.emit('hit',{player:1,units:0});}
          }
        }
        bonus.objects=bonus.objects.filter(o=>o.x>-30&&o.x<350);
        if(bonus.count===8&&!bonus.objects.length) {
          if(!bonus.misses)this.score[0]+=2000;
          this.message=`Úhyby ${bonus.dodged} z 8${bonus.misses?'':' · perfektní!'}`;
          this.phase='bonus-result';this.phaseTicks=140;
        }
      }
      this.belt=this.computeBelt();
    }
    tick(inputs=[neutral(),neutral()]) {
      this.totalTicks++;
      if (this.phase==='gameover') return;
      if (this.phase==='ready') {
        if(--this.phaseTicks<=0) {this.phase='fight';this.message='Hrajeme!';this.emit('fight');}
        return;
      }
      if (this.phase==='point') {
        for(const p of this.players) if(p.action>=17)this.updatePlayer(p,neutral(),HIT_POSE_TICKS);
        if(--this.phaseTicks<=0) {
          if(this.pendingRound)this.endRound(this.lastWinner);
          else if(this.time<=0)this.endRound(this.points[0]===this.points[1]?null:this.points[0]>this.points[1]?0:1);
          else {this.resetFighters();this.phase='ready';this.phaseTicks=55;this.message='Připrav se';}
        }
        return;
      }
      if (this.phase==='round') {
        for(const p of this.players) if(p.action)this.updatePlayer(p,neutral());
        if(--this.phaseTicks<=0)this.nextRound(); return;
      }
      if (this.phase==='bonus-ready') {
        if(--this.phaseTicks<=0) {this.phase='bonus';this.message=this.bonus.kind==='tiles'?'Čekej na GO':'Uhýbej!';}
        return;
      }
      if (this.phase==='bonus-result') {
        if(--this.phaseTicks<=0)this.prepareRound(); return;
      }
      if (this.phase==='bonus') {this.updateBonus(inputs[0]||neutral());return;}
      this.time--;
      const cpu=this.mode==='solo'?this.cpuInput():inputs[1]||neutral();
      this.updatePlayer(this.players[0],inputs[0]||neutral());
      this.updatePlayer(this.players[1],cpu);
      this.separatePlayers(); this.resolveCombat();
      if(this.phase==='fight'&&this.time<=0)this.endRound(this.points[0]===this.points[1]?null:this.points[0]>this.points[1]?0:1);
    }
  }
  root.KarateEngine={Game:KarateGame,MOVES,BELTS,HZ,POSE_TICKS,HIT_POSE_TICKS,inputAction,neutral};
  if(typeof module!=='undefined')module.exports=root.KarateEngine;
})(globalThis);

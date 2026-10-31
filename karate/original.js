/* Semantic JavaScript translation of the supplied ATR's combat routines.
 * No CPU, memory image or executable Atari code is used at runtime.
 * Addresses and offline differential fixtures: research/international-karate/FIDELITY.md.
 */
(function(root){
  'use strict';
  const tables=root.KARATE_ROUTINE_DATA,animations=root.KARATE_ANIMATIONS;
  const byte=n=>n&255, left=p=>p.facing===-1?1:0;
  function geometry(p,q){ // $3F8F; the first SBC intentionally inherits clear carry.
    const a=byte(p.origin+(left(p)?23:12)),b=byte(q.origin+(left(q)?24:12));
    const delta=byte(a-b),signed=delta<128?delta:delta-256;
    return {context:((signed>=0?4:0)|(left(p)<<1)|left(q)),distance:Math.abs(signed)>>2};
  }
  function select(p,command,randomByte,forced=false){ // $530F
    let action=command;
    if(!action&&!forced){
      p.idleCounter=byte(p.idleCounter+1);
      if(p.idleCounter>=128&&randomByte()<16){
        action=21;p.idleCounter=(randomByte()&63)+16;p.idleVariant=randomByte()&48;
      }
    }else p.idleCounter=action;
    p.action=action;p.pose=0;p.nextPose=0;p.uninterrupted=1;
    p.reverse=0;p.preparation=0;p.strikeTicks=0;p.inputFlipped=0;p.flags=0;p.previousFlags=0;
  }
  function move(p,direction=left(p)){ // $5509/$550E, including pose-dependent edge clamps.
    const dx=animations[p.action].dx[p.pose]||0,width=tables.widths[p.frame];
    p.origin=byte(p.origin+(direction?-dx:dx));
    const right=direction?byte(p.origin+36):byte(p.origin+width);
    const start=direction?byte(right-width):p.origin;
    if(start<=16)p.origin=left(p)?Math.max(0,18+width-36):16;
    else if(right>174)p.origin=left(p)?138:174-width;
    if(p.origin>=240)p.origin=0;
  }
  function motion(p,command,human,randomByte,forced=false){ // $53BC, one original animation step.
    if(p.frozen)return;
    let reselect=false;
    for(let guard=0;guard<12;guard++){
      if(!reselect&&human){
        if(command!==p.action)p.uninterrupted=0;
        if(!p.uninterrupted&&p.preparation)p.reverse=1;
        if(p.reverse){
          p.pose--;
          if(p.pose<0)reselect=true;
          else {p.frame=animations[p.action].frames[p.pose];move(p,p.reverse^left(p));return;}
        }
      }
      if(!reselect)p.pose=p.nextPose;
      if(reselect||!p.action||p.pose>=animations[p.action].frames.length)select(p,command,randomByte,forced);
      reselect=false;
      const sequence=animations[p.action];
      p.frame=sequence.frames[p.pose];
      p.previousFlags=p.flags;p.flags=sequence.flags[p.pose];p.preparation=p.flags&4;p.threat=p.flags&64;
      if(human){
        if(p.flags&8){
          if(command===p.action){
            if(p.strikeTicks<128){if(!p.strikeTicks)move(p);p.strikeTicks=byte(p.strikeTicks+1);}
            return;
          }
          if(p.strikeTicks){p.strikeTicks=0;p.reverse=0;p.preparation=0;p.nextPose=p.pose+1;continue;}
        }
        if((p.flags&16)&&!p.uninterrupted){
          if(p.action===3||p.action===7||command){
            if(p.action===7)p.origin=byte(p.origin+(left(p)?3:-3));
            reselect=true;continue;
          }
        }
      }
      if(p.flags&2){p.facing=-p.facing;p.inputFlipped=1;}
      if(p.flags&32)p.frozen=1;
      move(p);p.nextPose=p.pose+1;return;
    }
    throw new Error('Invalid original animation transition');
  }
  function controls(p,q,input){ // $51F9, including automatic close-range blocking.
    let stick=15;
    if(input?.y<0)stick&=~1;if(input?.y>0)stick&=~2;
    if(input?.x<0)stick&=~4;if(input?.x>0)stick&=~8;
    if(input?.fire)stick|=16;
    if(!p.strikeTicks&&q.threat){
      const {context,distance}=geometry(q,p);
      if(tables.blockingClasses[context]&&distance<8)return (left(p)?tables.inputBlockLeft:tables.inputBlockRight)[stick];
    }
    return (left(p)===p.inputFlipped?tables.inputNormal:tables.inputMirrored)[stick];
  }
  function decide(p,q,level,randomByte,scanline){ // $3D00; null preserves an in-progress action.
    if(p.action&&!(p.flags&16))return null;
    const {context:c,distance:d}=geometry(p,q),kind=tables.actionClass[q.action];
    // $3F6E rejection sampling, including its raster-register fallback.
    function choice(count){for(let guard=0;guard<1000;guard++){
      let n=randomByte()&31;if(n<count)return n;n=(n&15)&scanline();if(n<count)return n;
    }throw new Error('Invalid random source');}
    const approach=()=>(d<8?tables.approachNear:tables.approachFar)[choice(12)];
    function general(){
      if(tables.contextApproach[c])return approach();
      if(d>=10)return tables.retreat[choice(12)];
      return tables.attacks[tables.distanceRows[d]+choice(tables.choiceCount[level])];
    }
    if(kind>=128||q.strikeTicks>=8){
      if(p.action)return null;
      if(p.idleCounter>=48)return general();
    }else if(d<9){
      if((q.action===5||q.action===12)&&d<8){
        const n=randomByte();
        if(n>=tables.sweepThreshold[level])return tables.sweepEscape[((c&4)?((c&3)^3):(c&3))*8+(n&7)];
      }
      if(randomByte()>=tables.reactionThreshold[level]){
        if(!tables.contextReact[c])return approach();
        return (kind?tables.reactSweep:tables.reactOrdinary)[choice(8)];
      }
    }
    if(randomByte()<tables.idleThreshold[level])return null;
    return general();
  }
  function contact(p,q,data){ // $4182-$4305; caller selects the first eligible attacker.
    const i=data.attackFrames.indexOf(p.frame);
    if(i<0||p.strikeTicks>=2)return null;
    let cls=data.frameClasses[q.frame];if(cls===255)return null;
    if(cls===24&&i===3)cls=26;
    const c=geometry(p,q).context;
    if(cls===19&&(c===0||c===7))cls=0;
    const ax=byte(p.origin+(left(p)?36-data.attackX[i]:data.attackX[i]));
    for(let z=0;z<6;z++){
      const offset=data.bodyOffsets[cls][z];
      if(!(data.zoneMasks[i]&data.zoneBits[z])||offset===128)continue;
      const tx=byte(q.origin+(left(q)?36-offset:offset));
      let delta=left(p)?tx-ax:ax-tx;
      if(left(p)===left(q))delta+=data.halfRange[i];delta=byte(delta);
      if(delta>=128||delta>data.halfRange[i])continue;
      const full=delta<data.fullRange[i];
      return {units:full?2:1,value:full?data.fullScores[i]:data.halfScores[i],fall:tables.fallActions[i*4+(c&3)]};
    }
    return null;
  }
  function arbitrate(players,priority,data,onCandidate){ // $415A checks one eligible attack, not both contacts.
    for(const i of [priority,priority^1]){
      const p=players[i];
      if(!data.attackFrames.includes(p.frame))continue;
      onCandidate?.(i);
      if(p.strikeTicks>=2)continue;
      const hit=contact(p,players[i^1],data);return hit?{...hit,player:i}:null;
    }
    return null;
  }
  function step(players,inputs,humans,level,priority,randomByte,scanline){ // $51C0
    const commands=players.map((p,i)=>humans[i]?controls(p,players[i^1],inputs[i]):0);
    for(const i of [priority,priority^1]){
      if(!humans[i]){
        const action=decide(players[i],players[i^1],level,randomByte,scanline);
        if(action!==null)select(players[i],action,randomByte);
      }
      motion(players[i],commands[i],humans[i],randomByte);
    }
    return priority^1;
  }
  root.KarateOriginal={geometry,select,motion,controls,decide,contact,arbitrate,step,move};
})(globalThis);

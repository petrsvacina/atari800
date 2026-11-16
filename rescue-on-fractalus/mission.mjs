// Mission arithmetic and score presentation from the supplied computer disk.
const byte=n=>n&255;
export const packedDecimal=n=>((Math.floor(n/10)<<4)|(n%10))&255;
export const unpackDecimal=n=>(n>>>4)*10+(n&15);

// $75F5: preserve the old night phase when the daytime branch does not write it.
export function levelParameters(level,{nightPhase=0}={}) {
  level=byte(level);
  const quota=Math.min(20,(level>>>1)+2),halfAlien=byte(26-level);
  const alienBase=halfAlien&128?halfAlien:halfAlien>>>1;
  const threshold=alienBase&128?2:Math.max(2,alienBase);
  const delay=byte(42-level);
  return {
    quota,remainingBcd:packedDecimal(quota),rescueThreshold:(quota>>>1)+1,
    respawnCounter:Math.max(0,quota-5),gunDensity:level===1?0:Math.min(level,43)*4,
    saucerTimers:[level<4?0:88-2*Math.min(level,34),level<4?0:88-2*Math.min(level,34)],
    fireDelayMask:(44-Math.min(level,40))>>>1,
    lockonReload:delay&128?4:Math.max(4,delay>>>1),
    alienBase,alienThreshold:threshold>=8?255:threshold<<5,
    alienDelay:byte((level>>>2)+5),thrustOffset:Math.max(0,8-(level>>>2)),
    nightFlag:level<16?level:0,nightPhase:level<16?nightPhase:Math.min(23,level-16)
  };
}

// $497D-$49ED, including the six displayed digits and their skipped writes.
export function addScore(state,delta) {
  if(!Number.isInteger(delta)||delta<0||delta>9999)throw new RangeError('Original two-byte BCD delta required');
  state.score=(state.score+delta)%100000000;
  const digits=String(state.score).padStart(8,'0');
  let visible=digits.slice(0,2)!=='00';
  for(let i=0;i<6;i++) {
    const digit=Number(digits[i+2]);
    if(visible||digit||i===5){state.scoreCells[i]=80+digit;visible=true;}
  }
  state.pendingScore=0;
  return state;
}

// Counter/score prefix of $7AF4, before the separate HUD/wait and replenishment.
export function advanceRescueCounter(state,{ace=false}={}) {
  let count=unpackDecimal(state.remainingBcd);
  if(state.overQuota)count=(count+1)%100;
  else {
    count=(count+99)%100;
    if(count===0)state.overQuota=byte(state.overQuota+1);
  }
  state.remainingBcd=packedDecimal(count);
  state.rescued=byte(state.rescued+1);
  state.pendingScore=ace?2000:200;
  return state;
}

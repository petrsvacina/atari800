// Native rescue/boarding/Jaggi routines from the supplied computer disk.
// Blocking foreground waits are generators; the caller continues the original VBI.
import {byte,word} from './math.mjs';
import {createSystemState,enqueueEvent,clearMessage} from './systems.mjs';
import {advanceRescueCounter,packedDecimal,unpackDecimal} from './mission.mjs';
import {placeOccupants} from './world.mjs';

export const RESCUE_FIELDS={
  pilotX:[0x3f,1],pilotY:[0x40,1],pilotScale:[0x50,2],pilotFractionX:[0x59,1],pilotStepX:[0x5a,1],
  plotX:[0x4f,1],plotY:[0x4e,1],pilotColumnLimit:[0xb3,1],
  pilotDistance:[0x79,1],knockCount:[0x7b,1],knockClock:[0x7c,1],knockDelay:[0x7d,1],
  approachSentinelA:[0x28d9,1],approachSentinelB:[0x28da,1],pilotRowStart:[0x28de,1],
  pilotColumnBase:[0x28df,1],pilotFractionY:[0x28e4,1],pilotStepY:[0x28e5,1],rescueCell:[0x28e6,1],
  approachShift:[0x28e9,1],pilotFrame:[0x291f,1],figureIsAlien:[0x281e,1],
  alienKnockActive:[0x632,1],alienAttackGate:[0x2844,1],rescueStatus:[0x642,1],
  alienThreshold:[0x61b,1],alienBase:[0x61a,1],rescueThreshold:[0x61f,1],quotaFlag:[0x627,1],
  remainingBcd:[0x628,1],rescued:[0x629,1],overQuota:[0x62b,1],
  occupancyMarker:[0x281d,1],occupancyRemaining:[0x288c,1],occupancyStart:[0x288b,1],
  airlockCell:[0x3388,1],rescueVoiceBusy:[0x6ff,1],energyEmpty:[0x6e,1],energyColor:[0xde,1],
  soundSpecialIndex:[0x635,1],soundSpecialTimer:[0x636,1],soundSpecialVolume:[0x637,1],
  soundSpecialPitchA:[0x638,1],soundSpecialPitchB:[0x639,1],soundSpecialVolumeTimer:[0x63a,1],
  alienLinkA:[0x5e,1],alienPositionB:[0x5f,1],alienLinkB:[0x2921,1],
  alienPick:[0x2922,1],alienPreviousPick:[0x2923,1],alienPositionA:[0x2924,1],alienPositionC:[0x2926,1],
  alienLimitA:[0x2927,1],alienLimitB:[0x2928,1],alienLimitC:[0x2929,1],
  alienFrameA:[0x292a,1],alienFrameB:[0x292b,1],alienFrameC:[0x292c,1],
  alienPacked:[0x292d,1],alienSustain:[0x292e,1],alienRow:[0x292f,1],
  alienTop:[0x2930,1],alienColumn:[0x2931,1]
};

export function createRescueState(values={}) {
  return Object.assign(createSystemState(),Object.fromEntries(Object.keys(RESCUE_FIELDS).map(k=>[k,0])),
    {energyCells:Array(64).fill(0)},values);
}
const marked=(s,id)=>enqueueEvent(s,id|128);
function random(context,site){if(typeof context.random!=='function')throw new TypeError('Original random-byte source required');return context.random(site)&255;}
function fields(context) {
  if(!(context.sourceField instanceof Uint8Array)||context.sourceField.length!==2304||
     !(context.field instanceof Uint8Array)||context.field.length!==2304)
    throw new TypeError('Rescue needs frozen sourceField and destination field, each 48 × 48 packed bytes');
}
function soundWrite(context,index,value) {
  if(typeof context.sound?.write!=='function')throw new TypeError('Original sound register writer required');
  context.sound.write(index,byte(value));
}
function* wait(s,count) {s.clock=0;yield {kind:'clock',value:byte(count)};}
function* nextFrame(){yield {kind:'frame'};}

// $7D38 / $7C9A: transparent source fields restore the frozen previous half.
export function drawPilot(s,data,context) {
  fields(context);
  const {sourceField,field}=context,p=data.pilot,step=s.pilotScale;
  if(!step)throw new RangeError('Original pilot inverse scale must be nonzero');
  const shape=p.shapes[s.pilotFrame&3],left=byte(s.plotX-Math.floor(1536/step)-1);
  s.pilotRowStart=left;s.plotX=left;
  function plot(pen) {
    const x=s.plotX,y=s.plotY;s.plotX=byte(x+1);
    if(y<108||y>=151||x<40||x>=216)return;
    const column=byte((x>>>2)+248);
    if(column>=s.pilotColumnLimit||column>=48)return;
    const at=(151-y)*48+column,part=x&3;
    const value=(pen||sourceField[at])&p.pixelMask[part];
    field[at]=(field[at]&p.inverseMask[part])|value;
  }
  for(let i=0;i<14;i++)plot(0);
  s.plotY=byte(s.plotY-1);
  for(let row=0;row<4608;row+=step) {
    s.plotX=left;plot(0);
    for(let column=0;column<3072;column+=step) {
      const index=(column>>>8)+s.pilotColumnBase;
      if(index>=24)throw new RangeError('Invalid original pilot column selection');
      const v=shape[p.rowOffset[row>>>8]+p.columnOffset[index]];
      plot(p.pen[(v>>>(p.fieldSelect[index]*2))&3]);
    }
    plot(0);plot(0);s.plotY=byte(s.plotY-1);
  }
  return field;
}

// $7F85 sequencing, independently callable for the bitmap oracle.
export function stepAlienSequence(s,data,context) {
  const a=data.alien;
  function side(position,link) {
    s[position]=byte(s[position]+1);
    let frame=a.sideSequence[s[position]];
    if(frame===0) {
      if(s[link]===0||s[link]>=4)s[link]=s.alienSustain?0:3;
      s[position]=a.sideLinks[s[link]];frame=a.sideSequence[s[position]];
    }
    if(frame===undefined)throw new RangeError('Invalid original Jaggi side sequence');
    return frame;
  }
  s.alienFrameA=side('alienPositionA','alienLinkA');
  s.alienFrameB=side('alienPositionB','alienLinkB');
  s.alienPositionC=byte(s.alienPositionC+1);
  let frame=a.middleSequence[s.alienPositionC];
  if(frame===0) {
    let pick;
    do {pick=(random(context,'rescue.alienExpression')&7)+1;}while(pick===s.alienPick||pick===s.alienPreviousPick);
    s.alienPreviousPick=s.alienPick;s.alienPick=pick;
    s.alienPositionC=a.middleLinks[pick];frame=a.middleSequence[s.alienPositionC];
  }
  if(frame===undefined)throw new RangeError('Invalid original Jaggi middle sequence');
  s.alienFrameC=frame;s.alienPacked=frame>=12?1:0;
  s.alienLimitA=a.sideShapes[s.alienFrameA].limit;
  s.alienLimitB=a.sideShapes[s.alienFrameB].limit;
  s.alienLimitC=a.middleShapes[s.alienPacked?frame-11:frame].limit;
  return s;
}
const reversePairs=v=>((v&3)<<6)|((v&12)<<2)|((v&48)>>>2)|((v&192)>>>6);

// Original three independent bitmap strips; source/destination halves are kept
// distinct. Every cell applies the original generated transparency table.
export function drawAlien(s,data,context) {
  fields(context);
  const {sourceField,field}=context,a=data.alien;
  const sideA=a.sideShapes[s.alienFrameA],sideB=a.sideShapes[s.alienFrameB];
  const middle=a.middleShapes[s.alienPacked?s.alienFrameC-11:s.alienFrameC];
  if(!sideA||!sideB||!middle)throw new RangeError('Invalid original Jaggi bitmap frame');
  let ca=sideA.cursor,cb=sideB.cursor,cc=middle.cursor,cd=231;
  let offset=s.alienTop*48+s.alienColumn;
  // The original row pointer advances $60 in the interleaved two-field bank.
  // On each packed half that is one row. The selected +$30 can wrap a row.
  for(let row=s.alienTop;row<44;row++,offset+=48) {
    s.alienRow=row;
    const cells=new Uint8Array(17);
    if(ca>=sideA.limit)ca=byte(ca+1);
    else for(let i=4;i>=0;i--)cells[i]=reversePairs(sideA.bytes[ca++]);
    if(cb>=sideB.limit)cb=byte(cb+1);
    else for(let i=12;i<17;i++)cells[i]=sideB.bytes[cb++];
    if(cc>=middle.limit)cc=byte(cc+1);
    else if(s.alienPacked)for(let i=11;i>=5;i--)cells[i]=reversePairs(middle.bytes[cc++]);
    else for(let i=5;i<12;i++)cells[i]=middle.bytes[cc++];
    if(cd>=168)cd=byte(cd+1);
    else for(let i=5;i<12;i++)cells[i]=a.lowerShape[cd++];
    for(let i=16;i>=0;i--) {
      // Equivalent native half-bank coordinates for original indirect rows.
      // column+16 is at most 35 in the reachable $0C..$13 range.
      const at=offset+i;
      if(at>=0&&at<field.length) {
        field[at]=(a.mask[cells[i]]&sourceField[at])|cells[i];
        if(at===23)s.sensorMaskB=field[at]; // shared original $1057 cell
      }
    }
  }
  return field;
}

export function alienAttack(s,context) {
  const r=random(context,'rescue.alienAttack');if(!(r&128))return;
  if(r&15) {
    if(!(s.rescueAvailable&128))s.messageTimer=s.colorBase=109;
    if(r&3) {
      s.jitterPhase=r&1;s.messageTimer=s.colorBase=112;
      let high=s.pitch>>>8;
      if(high!==244){high=byte(high-1);if(high!==244)high=byte(high-1);}s.pitch=high<<8|s.pitch&255;
      high=s.roll>>>8;
      if(random(context,'rescue.alienRoll')&128){if(high!==251){high=byte(high-1);if(high!==251)high=byte(high-1);}}
      else if(high!==5){high=byte(high+1);if(high!==5)high=byte(high+1);}
      s.roll=high<<8|s.roll&255;s.speed=Math.max(0,(s.speed>>>8)-8)<<8|s.speed&255;
    }
  }
  if(s.mode!==2)s.objectPath=byte(s.objectPath+4);
  marked(s,26);marked(s,27);
}

export function beginApproach(s,context,{entryX=0}={}) {
  s.lockonState=s.targetRange=s.landingTarget=s.doorWait=128;
  const distance=s.pilotDistance;
  if(distance&128){s.colorBase=42;s.messageTimer=104;}
  else if(distance>=8){s.colorBase=26;s.messageTimer=103;}
  else {s.colorBase=entryX;s.messageTimer=70;s.landingPhase=byte(s.landingPhase+1);}
  if(s.landingPhase<3)return;
  s.rescueStatus=0;
  const scale=byte(distance+1),carry=distance===255?1:0;
  s.pilotScale=scale<<8;
  s.knockCount=byte((byte(scale-18-(1-carry))^255)<<1);
  s.knockClock=165;s.knockDelay=15;
  s.approachSentinelA=s.approachSentinelB=s.pilotDistance=128;
  s.figureIsAlien=1;
  let marker=context.objects[s.rescueCell];
  if(marker===128) {
    marker=s.alienThreshold;
    if(marker&&marker>=random(context,'rescue.alienDesignation'))return;
  } else s.figureIsAlien=0;
  s.gamePhase=byte(s.gamePhase+1);
  s.colorB=12;
  if(marker===201){s.messageTimer=85;s.colorB=104;}
}

export function advanceApproach(s,context) {
  s.approachShift=s.pilotScale>>>8;s.pilotStepX=random(context,'rescue.approachX');
  s.pilotStepY=s.pilotY>=108?random(context,'rescue.approachY'):0;
  do {s.pilotStepX=(s.pilotStepX>>>1)|(s.pilotX&128);s.pilotStepY>>>=1;s.approachShift>>>=1;}while(s.approachShift);
  if((s.pilotScale>>>8)!==1)return;
  s.pilotStepX|=64;
  if((s.pilotScale&255)===0) {
    if(s.pilotY<108) {
      const sum=random(context,'rescue.knockClockA')+random(context,'rescue.knockClockB');
      // ROR includes the ADC carry; the two LSRs leave bit1 as ADC carry.
      const rotated=(sum>>>1)&255;
      let value=(rotated>>>2)+s.pilotY+((rotated>>>1)&1),carry=value>255?1:0;
      value=byte(value);
      if(s.figureIsAlien)value=byte(value+32+carry);
      s.clock=value;s.landingPhase=byte(s.landingPhase+1);
    }
    s.pilotStepY=255;
  } else s.pilotStepY|=128;
}

function initEvent(s,value) {s.messageTimer=value;s.airlockCell=180;s.airlock=0;marked(s,22);}
function activeCell(s,context){context.objects[s.rescueCell]=1;}
function respawn(s,context) {
  activeCell(s,context);if(!s.respawnCounter)return;
  const visible=typeof context.visibleCells==='function'?context.visibleCells():context.visibleCells;
  s.occupancyMarker=s.respawnCounter===1?201:200;s.occupancyRemaining=1;
  placeOccupants(context.terrain,context.objects,{value:s.occupancyMarker,count:1,visibleCells:visible,
    random:site=>{const r=random(context,site);s.occupancyStart=r;return r;}});
  s.occupancyRemaining=0;s.respawnCounter=byte(s.respawnCounter-1);
}
function countAlien(s,context) {
  activeCell(s,context);s.scoreDeltaLow=0;s.scoreDeltaHigh=1;s.pendingScore=100;
  s.destroyedCount=packedDecimal((unpackDecimal(s.destroyedCount)+1)%100);
}
function missionTimer(s,context) {
  if((s.rescueAvailable&128)||s.missionTimer)return;
  let v=(random(context,'rescue.missionTimer')|8)&63;
  if(s.scene)v>>>=1;
  else if(s.overQuota)v>>>=3;
  s.missionTimer=v;
}

function* zoom(s,data,context) {
  s.pilotFrame=0;
  do {
    yield {kind:'clockAbove',value:3};s.clock=0;
    if(s.pilotFrame===1||s.pilotFrame===5)marked(s,25);
    s.pilotColumnBase=data.pilot.columnBase[s.pilotFrame];
    const horizontal=s.pilotFractionX+s.pilotStepX;
    s.pilotFractionX=byte(horizontal);
    if(s.pilotStepX&128){if(horizontal<256&&s.pilotX)s.pilotX--;}
    else if(horizontal>255&&s.pilotX!==255)s.pilotX++;
    s.plotX=s.pilotX;
    const vertical=s.pilotFractionY+s.pilotStepY;s.pilotFractionY=byte(vertical);
    if(vertical>255&&s.pilotY)s.pilotY--;
    s.plotY=s.pilotY;
    if(s.pilotScale!==256)s.pilotScale=Math.max(256,s.pilotScale-16);
    drawPilot(s,data,context);
    if(!s.systemsOff)return;
    s.pilotFrame=byte(s.pilotFrame+1);
  }while(s.pilotFrame&7);
}
function* knock(s,context) {
  if(s.clock)return;
  if(!s.knockCount) {
    s.knockCount=255;marked(s,25);yield*wait(s,10);s.knockDelay=byte(s.knockDelay<<1);marked(s,25);
    s.clock=s.knockClock;return;
  }
  if(s.knockCount&128){respawn(s,context);s.landingPhase=2;s.messageTimer=9;return;}
  let count=random(context,'rescue.knockCount')&7;if(count<3)count|=3;
  if(s.knockCount<7)count>>>=1;
  const skip=!count;count=count||1;const delay=s.knockDelay;
  for(let i=0;i<count;i++) {
    if(!(skip&&i===0)&&!s.airlock) {
      marked(s,27);
      for(let j=0;j<(delay||256);j++){yield*wait(s,1);if(!s.systemsOff)return;}
    }
    const before=s.knockCount;if(before)s.knockCount=byte(before-1);
    if(before<15){s.knockDelay=byte(s.knockDelay+2);s.knockClock=byte(s.knockClock-7);}
  }
  s.clock=s.knockClock;
}
function* boardingSweep(s) {
  for(let pass=5;pass>=0;pass--) {
    const delay=Math.max(20,s.knockDelay);
    for(let i=0;i<delay;i++){yield*wait(s,1);if(!s.systemsOff)return false;}
    marked(s,26);
  }
  return true;
}
function* replenish(s,data,context,count) {
  for(let i=0;i<count;i++) {
    s.energy+=4;
    let delay=1;
    if(s.energy>=220){delay=0;s.energyCells[0]=240;s.energy=220;}
    yield*wait(s,delay);
    const row=(220-s.energy)>>>2;s.energyCells[row+1]=240;
    const index=row>>>3;if(index<6)s.energyEmpty=0;
    s.energyColor=data.energyColors[index];
  }
}
function* rescuePilot(s,data,context) {
  advanceRescueCounter(s,{ace:s.colorB===104});
  if(s.quotaFlag||s.rescued>=s.rescueThreshold)missionTimer(s,context);
  s.scoreDeltaLow=0;s.scoreDeltaHigh=s.colorB===104?32:2;
  yield*replenish(s,data,context,s.colorB===104?16:8);respawn(s,context);
}
function* abortFlourish(s,context) {
  s.landingInhibit=byte(s.landingInhibit+1);
  // These voice volume cells are live under VBI mixing, hence reread each pass.
  for(let i=1;i<16;i=s.engineLatch+1) {
    s.engineLatch=s.engineLatch2=i;enqueueEvent(s,1);enqueueEvent(s,2);yield*wait(s,1);
  }
  for(let i=0;i<60;i++){yield*wait(s,1);s.colorB=random(context,'rescue.abortFlash')|4;}
  s.landingInhibit=0;
}
function silence(s,context) {
  s.sfxBusy=0;for(const index of [1,3,5,7])soundWrite(context,index,0);soundWrite(context,8,96);
  s.alienKnockActive=0;
}
function* death(s,data,context) {
  soundWrite(context,8,0);
  for(let index=21;index>=0;index--) {
    const r=random(context,'rescue.deathTone');if(r&128)soundWrite(context,0,r&15);
    const v=data.alien.deathTone[index];soundWrite(context,1,(v>>>1)|160);
    soundWrite(context,3,v|128);soundWrite(context,2,(v<<1)^31);yield*wait(s,1);
  }
  soundWrite(context,8,96);
  // $4FCE and $4FE0 are the root's shared fatal-event presentation/lifecycle.
  if(typeof context.death!=='function')throw new Error('Original root death lifecycle required after Jaggi direct tones');
  yield*context.death(s);
}
function* alienFrame(s,data,context) {
  stepAlienSequence(s,data,context);drawAlien(s,data,context);
  if(s.alienPositionA===0||s.alienPositionA===13||s.alienPositionB===0||s.alienPositionB===13) {
    s.alienSustain=byte(s.alienSustain-1);
    if(s.alienSustain&128){s.controlMode=0;silence(s,context);yield*death(s,data,context);return false;}
    marked(s,26);marked(s,27);
  }
  return true;
}
function* alienOutside(s,data,context) {
  s.alienKnockActive=1;s.alienLinkA=1;s.alienPositionA=9;s.alienLinkB=2;s.alienPositionB=11;
  s.alienPick=s.alienPositionC=0;s.sfxBusy=byte(s.sfxBusy+1);
  s.soundSpecialVolume=s.soundSpecialVolumeTimer=0;soundWrite(context,8,0);
  s.soundSpecialIndex=32;s.soundSpecialPitchA=191;s.soundSpecialPitchB=211;
  s.alienColumn=(random(context,'rescue.alienColumn')&7)+12;
  let top=(random(context,'rescue.alienTop')&7)+33;
  for(const delta of [16,10,4,2]){s.alienTop=top;if(!(yield*alienFrame(s,data,context)))return false;top=byte(top-delta);}
  s.alienTop=top;
  if(!s.systemsOff){s.alienKnockActive=0;return true;}
  const total=(random(context,'rescue.alienSustain')&3)+s.alienBase;
  s.alienSustain=byte((total&128?0:byte(total))+1+(total>255?1:0));
  s.alienLinkA=4;s.alienPositionA=15;s.alienLinkB=5;s.alienPositionB=18;
  do {yield {kind:'clockAbove',value:4};s.clock=0;if(!(yield*alienFrame(s,data,context)))return false;}while(s.systemsOff);
  silence(s,context);return true;
}
function* runRescue(s,data,context,options) {
  beginApproach(s,context,options);
  for(;;) {
    if(s.alienInside) {
      if(s.clock&8){if(!s.alienAttackGate){s.alienAttackGate=byte(s.alienAttackGate+1);alienAttack(s,context);}}
      else s.alienAttackGate=0;
    }
    if(!s.systemsOff) {
      if(s.airlock)initEvent(s,74);
      const phase=s.landingPhase;s.landingTarget=s.landingPhase=s.gamePhase=s.roll=0;
      if(phase===3||phase===4) {
        if(s.figureIsAlien){s.messageTimer=64;countAlien(s,context);}
        else {s.messageTimer=73;respawn(s,context);}
        yield*abortFlourish(s,context);
      }
      return;
    }
    if(s.landingPhase===3){advanceApproach(s,context);if(s.landingPhase!==4){yield*zoom(s,data,context);continue;}}
    if(s.landingPhase!==4){yield*nextFrame();continue;}
    if(s.doorWait) {
      if(s.clock){yield*nextFrame();continue;}
      s.doorWait=0;
    }
    if(s.figureIsAlien) {
      if(!s.airlock){s.gamePhase=0;if(!(yield*alienOutside(s,data,context)))return;continue;}
      s.airlock=128;
    } else {
      if(!s.airlock){yield*knock(s,context);yield*nextFrame();continue;}
      while(s.rescueVoiceBusy)yield*nextFrame();s.airlock=255;
    }
    if(!(yield*boardingSweep(s)))continue;
    clearMessage(s);yield*wait(s,20);
    let message;
    if(s.airlock===128){activeCell(s,context);s.alienInside=1;s.colorBase=216;message=112;}
    else {yield*rescuePilot(s,data,context);message=10;}
    initEvent(s,message);s.landingPhase=byte(s.landingPhase+1);
  }
}

// Call once after each logical VBI. start() executes synchronous work up to the
// first original wait; step() resumes ready waits and never advances the clock.
export class RescueController {
  constructor(data,state,context) {this.data=data;this.state=state;this.context=context;this.iterator=null;this.waiting=null;this.active=false;}
  start(options={}) {
    if(this.active)throw new Error('A rescue foreground is already running');
    this.iterator=runRescue(this.state,this.data,this.context,options);this.active=true;this.waiting=null;
    return this.resume();
  }
  resume() {
    for(let budget=0;budget<4096;budget++) {
      const result=this.iterator.next();
      if(result.done){this.active=false;this.waiting=null;return false;}
      this.waiting=result.value;
      if(this.waiting.kind==='clock'&&this.state.clock===this.waiting.value)continue;
      if(this.waiting.kind==='clockAbove'&&this.state.clock>this.waiting.value)continue;
      return true;
    }
    throw new Error('Rescue did not reach an original foreground wait');
  }
  step() {
    if(!this.active)return false;
    const w=this.waiting;
    if(w.kind==='clock'&&this.state.clock!==w.value||w.kind==='clockAbove'&&this.state.clock<=w.value)return true;
    return this.resume();
  }
}

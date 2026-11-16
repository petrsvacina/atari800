// Native scheduling of the disk's flight VBI. The renderer never calls this.
import {byte} from './math.mjs';
import {integrateFlight} from './flight.mjs';
import {updateGroundProjection} from './flight-services.mjs';
import {clearMessage,dispatchCommand,enqueueEvent,showMessage,syncPalette,tickLockIndicator} from './systems.mjs';
import {addScore,unpackDecimal} from './mission.mjs';

export const VBI_FIELDS={
  clockHigh:[0x12,1],renderSwap:[0x42,1],collisionClock:[0x4b,1],
  parity:[0x643,1],eventTail:[0x74,1],lockColor:[0xd9,1],
  crosshairHpos:[0x2840,1],torpedoColor:[0x37,1],targetLatch:[0x2838,1],
  motherShipLeft:[0x3356,1],motherShipRight:[0x3357,1],
  scannerLeft:[0x33df,1],scannerRight:[0x33e0,1],quotaDim:[0xbf,1],
  crashTrigger:[0x63d,1],rangeCache:[0x647,1],killsCache:[0x645,1],quotaCache:[0x646,1]
};

function marked(s,event){enqueueEvent(s,event|128);}
export function flushScore(s) {
  addScore(s,unpackDecimal(s.scoreDeltaLow)+100*unpackDecimal(s.scoreDeltaHigh));
  s.scoreDeltaLow=s.scoreDeltaHigh=0;
}

// $B70C/$B756. The two coordinate high bytes participate in each ROR.
export function tickIndicator(s) {
  if(s.mode!==2&&!(s.objectSlot&128)) {
    const distance=((s.objectSlot^127)>>>2)-16;
    const axis=(lo,hi)=>Math.abs(byte(((hi<<8|lo)>>>4)-8)<<24>>24);
    const offset=byte(15-byte(axis(s.objectXMid,s.objectXHigh)+axis(s.objectYMid,s.objectYHigh))+distance);
    s.indicatorPos=((offset&128?0:offset)>>>2)+2;
  } else if(!(s.clock&15))s.indicatorPos=byte(s.indicatorPos-1);
  s.indicatorValue=s.indicatorPos;s.indicatorCharacter=160;s.indicatorPhase=(s.clock&5)+2;
  enqueueEvent(s,8);
}

// $4184: fuel discharge also runs on the draw half while damage is active.
export function drainEnergy(s,energyColors,hooks) {
  const before=s.energy;if(before)s.energy=byte(before-1);
  if(!s.energy) {
    if(s.dial&&s.mode!==2){hooks.throttleBar(s,8);s.dial=30;}
    else s.energy=byte(s.energy+1);
    if((s.objectPath|s.surfaceFraction)>=1) {
      s.crashTrigger=s.objectPath|s.surfaceFraction;s.energy=0;
      s.indicatorPos=0;s.indicatorValue=0;s.indicatorCharacter=160;s.indicatorPhase=(s.clock&5)+2;enqueueEvent(s,8);
    }
  }
  const row=byte(220-s.energy)>>>2,index=row>>>3;
  s.energyCells[row]=0;
  if(index===6){if(!s.energyEmpty)s.energyEmpty=6;}
  else s.energyColor=energyColors[index];
}

// $4131 through $41D9, including the original two ADC carry steps.
export function tickBlinkAndFuel(s,energyColors,hooks) {
  if(s.energyEmpty>=1) {
    s.energyEmpty=byte(s.energyEmpty-1);
    if(!s.energyEmpty) {
      s.energyEmpty=15;
      if(!s.systemsOff&&s.energy&&(s.objectSlot&128))marked(s,28);
      s.energyColor=78;
    } else if(s.energyEmpty<10)s.energyColor=70;
  }
  if(s.objectPath){s.objectPath=byte(s.objectPath-1);drainEnergy(s,energyColors,hooks);return;}
  let fraction=((byte(8-s.thrustNotch)>>>1)+(s.systemsOff?0:1))+s.surfaceFraction;
  fraction=byte(fraction)+(fraction>255?1:0)+s.fuelFraction;
  s.fuelFraction=byte(fraction);
  if(fraction>255)drainEnergy(s,energyColors,hooks);
}

function coloredMessage(s,id,messages){s.messageColor=id&32?s.colorBase:202;showMessage(s,id&223,messages);}

// $3FFA's dynamic scanner/counter writes. The rasterizer consumes the values.
export function tickScanner(s) {
  s.quotaDim=0;
  const blink=s.rescueStatus>=1&&s.rescueStatus<3&&!(s.rescueStatus&s.collisionClock);
  if(blink&&s.mode)marked(s,20);
  s.scannerLeft=blink?158:30;s.scannerRight=s.scannerLeft-1;
  s.rangeCache=s.rescueStatus;s.killsCache=s.destroyedCount;
  if(s.overQuota&&!(12&s.collisionClock))s.quotaDim=128;
  s.quotaCache=s.remainingBcd|s.quotaDim;
}

export function fireTorpedo(s) {
  if(s.objectFrame)return;
  s.projectileStateA=s.objectScreenYHi=s.targetLatch=0;
  s.projectileStateB=s.objectFrame=1;s.objectScreenXHi=124;s.torpedoColor=120;s.projectileStateC=12;
}

/** One display interrupt, PAL or NTSC. Physics runs on the original parity.
 * Optional graphics services are explicit; a missing active service is an error.
 */
export function stepFlightVbi(s,{input={},random,sound,hooks,world,tables,quarter,sprites,lifecycle}) {
  s.clock=byte(s.clock+1);
  if(!s.clock&&(s.eventOwner|s.systemsOff)) {
    s.clockHigh=byte(s.clockHigh+1);s.pendingEvent=byte(s.pendingEvent+1);
    if(s.pendingEvent&128){s.pendingEvent=128;for(let i=0;i<15;i++)s.paletteParams[i]=(s.savedPalette[i]^s.clockHigh)&246;
      [s.colorA,s.colorB,s.colorC,s.colorD]=s.paletteParams.slice(11,15);s.messageColor=s.paletteParams[9];}
  }
  if(s.controlMode&&s.renderSwap)s.renderSwap=0;
  s.parity=byte(s.parity-1);
  if(s.parity) {
    const odd=s.lockColor&1,a=byte((s.lockColor>>>1)+(odd?-1:1));
    s.lockColor=byte(a*2+(a>=(odd?75:78)?1:0));
    if(s.objectFrame&&!s.eventOwner)sprites.player2(s);
    if(s.introCounter)lifecycle.tickCrashFlash(s,{random});
    if(s.controlMode) {
      if(s.objectIndex&128){if(s.objectIndex===255)sprites.player3(s);sprites.stripe(s);}
      else {if(s.targetWindowY===127)sprites.stripe(s);sprites.player3(s);}
      s.collisionClock=byte(s.collisionClock-1);tickScanner(s);
      if(s.rescueAvailable&128){s.motherShipRight=s.collisionClock&8?182:54;s.motherShipLeft=s.motherShipRight-1;}
      if(s.objectPath){s.objectPath=byte(s.objectPath-1);drainEnergy(s,tables.energyColors,hooks);}
    }
    if(!(s.messageFlash&128)) {
      s.messageFlash=byte(s.messageFlash-1);
      if(s.messageFlash&128){clearMessage(s);if(s.scene){s.colorBase=234;coloredMessage(s,51,tables.messages);}}
    } else if(s.messageTimer)coloredMessage(s,s.messageTimer,tables.messages);
    if(s.scoreDeltaHigh)flushScore(s);
  } else {
    tickLockIndicator(s,random);s.parity=2;
    let blink=false,keyWindow=false,reset=false;
    if(s.scene){reset=!!s.targetLatch;blink=reset||!!s.controlMode;keyWindow=blink;}
    else if(s.eventOwner)keyWindow=true;
    else if(s.controlMode===2){blink=true;keyWindow=true;
      if(input.fire){if(!s.systemsOff)reset=true;else{s.messageFlash=s.systemsOff;s.messageTimer=79;}}
    }
    if(reset)fireTorpedo(s);
    if(blink)tickBlinkAndFuel(s,tables.energyColors,hooks);
    if(keyWindow&&input.command!==undefined){dispatchCommand(s,input.command,{messages:tables.messages,hooks});if(s.eventGlyph)marked(s,s.eventGlyph);}
    if(s.controlMode) {
      integrateFlight(s,{port:input.port??255,random},quarter,hooks);updateGroundProjection(s,world);
      if(!s.gamePhase&&!(s.pendingEvent&128)) {
        const altitude=s.depth>>>8,index=(altitude<50?0:Math.min(6,(altitude-50)>>>1))+s.nightPalette;
        s.colorA=tables.atmosphere[0][index];s.colorC=tables.atmosphere[1][index];s.colorB=tables.atmosphere[2][index];s.colorD=tables.atmosphere[3][index];
        // BNE tests the LDA dayFlag value if the decrement is skipped.
        if(!s.dayFlag){s.nightTimer=byte(s.nightTimer-1);if(!s.nightTimer){s.nightPhase=byte(s.nightPhase+1);s.nightPalette=tables.nightPalette[(s.nightPhase>>>2)&15];}}
      }
      sprites.hud?.(s);sprites.scanner?.(s);
      s.scoreClock=byte(s.scoreClock-1);
      if(!s.scoreClock) {
        if(s.missionTimer){s.missionTimer=byte(s.missionTimer-1);if(!s.missionTimer)lifecycle.setupLevelClear(s);}
        if(s.clearance){s.scoreDeltaLow=byte(s.scoreDeltaLow+1);flushScore(s);}s.scoreClock=30;
      }
    }
  }
  if(!s.eventOwner) {
    if(s.indicatorPos)tickIndicator(s);sound.stepFlight(s);
    if(!s.gamePhase&&!s.alienKnockActive) {
      const band=s.nightPhase&63;
      if(band===40&&s.weather<=240)s.weather+=15;
      else if(band===48&&s.weather>=15)s.weather-=15;
    }
  }
  syncPalette(s);
  s.paletteParams[10]=s.lockColor;s.paletteParams[15]=s.energyColor;
  return s;
}

import {byte} from './math.mjs';
import {thrustRate} from './flight.mjs';
import {createServiceState} from './flight-services.mjs';

export const SYSTEM_FIELDS={
  eventOwner:[0x43,1],pendingEvent:[0x63b,1],eventGlyph:[0xdf,1],sfxBusy:[0x634,1],savedControlMode:[0x630,1],
  thrustNotch:[0x6f,1],airlock:[0x3c,1],alienInside:[0x633,1],pilotVisible:[0x288d,1],pilotPrevious:[0x288e,1],
  landingTarget:[0x2830,1],doorWait:[0x7a,1],rescueAvailable:[0x3a,1],messageColor:[0xd8,1],messageFlash:[0x63e,1],
  colorBase:[0x47,1],messageTimer:[0x44,1],lockTimer:[0xe6,1],lockActive:[0x48,1],
  lockPhase:[0x631,1],lockReload:[0x618,1],scoreClock:[0x65d,1],missionTimer:[0x2849,1],
  fuelFraction:[0x2848,1],dayFlag:[0x617,1],nightTimer:[0x8a1,1],nightPhase:[0x8a2,1],nightPalette:[0x8a3,1],weather:[0x62c,1],airlockCell:[0x3388,1]
};
export function createSystemState(values={}) {
  return Object.assign(createServiceState(),Object.fromEntries(Object.keys(SYSTEM_FIELDS).map(k=>[k,0])),
    {paletteParams:Array(16).fill(0),savedPalette:Array(16).fill(0),messageCells:Array(14).fill(0),
     score:0,pendingScore:0,scoreCells:Array(6).fill(0),lockCells:Array(6).fill(169)},values);
}
export function enqueueEvent(state,event) {
  const head=Math.min(state.eventHead,31);state.eventRing[head]=event;state.eventHead=(head+31)&31;
}
export function syncPalette(state){state.paletteParams[9]=state.messageColor;state.paletteParams.splice(11,4,state.colorA,state.colorB,state.colorC,state.colorD);}
export function showMessage(state,id,messages) {
  if(!(id&128))state.messageCells.fill(0);
  id&=127;state.messageTimer=0;state.messageFlash=id>=64?90:255;
  id&=63;if(id===9)state.messageColor=56;
  const sequence=messages[id];
  for(let i=0;i<sequence.length;i++)state.messageCells[i]=sequence[i];
  syncPalette(state);
}
export function clearMessage(state){state.messageCells.fill(0);}
function modeMessage(state,mode,id,messages){state.mode=mode;state.messageColor=72;showMessage(state,id,messages);}
function coloredMessage(state,id,messages){state.messageColor=id&32?state.colorBase:202;showMessage(state,id&223,messages);}
function savePalette(state){state.savedPalette=state.paletteParams.slice();state.savedPalette.splice(11,4,state.colorA,state.colorB,state.colorC,state.colorD);state.savedPalette[9]=state.messageColor;}
function restorePalette(state){state.paletteParams=state.savedPalette.slice();[state.colorA,state.colorB,state.colorC,state.colorD]=state.paletteParams.slice(11,15);state.messageColor=state.paletteParams[9];}
function clearRescue(state){state.systemsOff=state.pilotVisible=state.pilotPrevious=0;}
function resetRescue(state){if(!state.landingTarget)state.landingPhase=0;clearRescue(state);}
function setTimer(state,value){state.timer=state.timerParamA=state.timerParamB=value;enqueueEvent(state,11);enqueueEvent(state,13);enqueueEvent(state,14);}
function setThrust(state,notch,hooks){state.thrustNotch=notch;state.dial=thrustRate(state.level,notch);hooks.throttleBar(state,notch);}
const commands=[0,63,21,62,7,6,128,28];

// Original $4644 dispatch. Web keys map to these semantic commands externally.
function dispatchInternal(state,key,{messages,hooks}) {
  const pending=state.pendingEvent;state.pendingEvent=0;state.eventGlyph=0;
  if(pending&128)restorePalette(state);
  const slot=commands.lastIndexOf(key);
  if(slot<0||state.scene)return state;
  if(slot===7) {
    if(state.eventOwner){state.eventOwner=0;state.controlMode=state.savedControlMode;for(const event of [1,2,11,13,14])enqueueEvent(state,event);}
    else if(!state.sfxBusy){state.savedControlMode=state.controlMode;state.controlMode=0;savePalette(state);state.eventOwner=1;}
    return state;
  }
  if(state.eventOwner)return state;
  state.eventGlyph=33;
  if(slot===state.mode)return state;
  if(slot===3) {
    if(state.landingPhase<2)return state;
    if(!state.systemsOff){savePalette(state);state.systemsOff=byte(state.systemsOff+1);state.colorBase=58;state.messageTimer=47;}
    else {state.messageFlash=255;clearRescue(state);state.messageTimer=14;}
  } else if(slot===1) {
    if(state.alienInside){state.colorBase=40;state.eventGlyph=23;coloredMessage(state,113,messages);}
    else if(state.systemsOff) {
      if(!state.airlock){state.airlock=1;state.airlockCell=52;state.eventGlyph=22;coloredMessage(state,1,messages);}
      else if(!(state.airlock&128)&&!(state.landingPhase===4&&!state.doorWait)){
        state.airlock=byte(state.airlock-1);state.airlockCell=180;state.eventGlyph=22;coloredMessage(state,10,messages);
      }
    }
  } else if(slot===2) {
    if(!(state.rescueAvailable&128)){state.eventGlyph=28;state.messageColor=72;showMessage(state,205,messages);}
    else {setTimer(state,1);resetRescue(state);modeMessage(state,2,2,messages);}
  } else if(state.energy) {
    if(slot===4) {
      state.mode=255;
      if(state.landingPhase){if(!state.pilotPrevious)state.messageTimer=0;resetRescue(state);state.roll=0;setThrust(state,7,hooks);}
      else if(state.thrustNotch)setThrust(state,state.thrustNotch-1,hooks);
      clearMessage(state);
    } else if(!state.landingPhase) {
      if(slot===5){state.mode=255;if(state.thrustNotch<=6)setThrust(state,state.thrustNotch+1,hooks);clearMessage(state);}
      else if(slot===0) {
        if(state.clearance>=100){state.eventGlyph=28;modeMessage(state,255,197,messages);}
        else {setThrust(state,8,hooks);modeMessage(state,0,4,messages);}
      } else {state.mode=6;coloredMessage(state,6,messages);}
    }
  }
  return state;
}

export function dispatchCommand(state,key,services) {
  dispatchInternal(state,key,services);syncPalette(state);return state;
}

export function tickLockIndicator(state,random) {
  if(state.eventOwner)return;
  const write=(index,value)=>{state.lockCells[index-1]=value;enqueueEvent(state,146);};
  const mode=state.lockonState;
  if(mode>=129) {
    const phase=state.lockPhase;state.lockPhase>>>=1;
    if(phase&1)return;
    state.lockPhase++;
    const index=mode&15;
    state.lockonState=byte(state.lockonState-(index===7?2:1));write(index===7?6:index,169);
  } else if(mode===128) {
    state.lockTimer=byte(state.lockTimer-1);
    if(!(state.lockTimer&128))return;
    const r=random()&7;state.lockTimer=r;const index=r>=6?r>>>1:r;state.lockCells[index]^=128;
  } else if(mode) {
    state.lockTimer=byte(state.lockTimer-1);
    if(!(state.lockTimer&128))return;
    state.lockTimer=state.lockReload;
    if(mode===7){if(!state.lockActive)state.lockActive=state.impactTimer=1;}
    else {state.lockonState++;write(mode,41);}
  } else {state.lockActive=0;state.lockonState=1;state.lockTimer=state.lockReload;state.lockCells.fill(169);}
}

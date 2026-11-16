// Native fatal-event and mission-return orchestration from the supplied disk.
// Waits yield to the original VBI; presentation speed cannot multiply rewards.
import {byte} from './math.mjs';
import {createCombatState} from './combat.mjs';
import {enqueueEvent,showMessage,clearMessage,syncPalette} from './systems.mjs';
import {addScore,levelParameters,packedDecimal,unpackDecimal} from './mission.mjs';

export const LIFECYCLE_FIELDS={
  soundFadeDistortion:[0x66a,1],crashFade:[0xc2,1],displayBackground:[0xd4,1],
  crashControl:[0xcc,1],objectRightX:[0x2870,1],attractTimer:[0xe2,1],missionDifference:[0xe3,1],
  restartPhase:[0xe5,1],gameSoundActive:[0x6c,1],cockpitActive:[0x60b,1],
  previousLevel:[0x626,1],quota:[0x62a,1],levelCount:[0x604,1],maximumSelectable:[0x609,1],highestLevel:[0x60a,1],
  musicActive:[0x655,1],minimumSelectable:[0x9b,1],bonusRemaining:[0x96,1],
  bonusLevelCount:[0xc1,1],bonusLevelBcd:[0xc3,1],gunDensity:[0x623,1],thrustOffset:[0x625,1],
  musicGate:[0xe7,1],musicNoteTimer:[0x73a,1],musicCursor:[0x73c,1],sfxReinitGate:[0x90,1]
};
export function createLifecycleState(values={}) {
  return Object.assign(createCombatState(),Object.fromEntries(Object.keys(LIFECYCLE_FIELDS).map(k=>[k,0])),values);
}
const marked=(s,id)=>enqueueEvent(s,id|128);
function random(c,site){if(typeof c.random!=='function')throw new TypeError('Original random-byte source required');return c.random(site)&255;}
function requireMethod(object,name){if(typeof object?.[name]!=='function')throw new Error(`Original lifecycle service required: ${name}`);return object[name].bind(object);}
function* wait(s,count){s.clock=0;yield {kind:'clock',value:byte(count)};}
function* frame(){yield {kind:'frame'};}

// $4F9F, on the odd branch of the flight VBI while introCounter is nonzero.
export function tickCrashFlash(s,context) {
  s.introDelay=byte(s.introDelay-1);
  if(s.introDelay&128){s.introDelay=(random(context,'lifecycle.crashDelay')&7)|1;marked(s,14);marked(s,15);}
  const color=random(context,'lifecycle.crashColor')|4;
  s.colorA=s.colorB=s.colorC=s.colorD=color;
  s.introCounter=byte(s.introCounter-1);s.gamePhase=s.introCounter?color:0;syncPalette(s);
}
// $4FCE. The sound engine binds these exact three voice cells.
export function resetFatalVoice(s) {
  s.soundFadeDistortion=s.engineFrequency=0;s.timerParamA=12;enqueueEvent(s,13);
}
// $4FE0. Only the first eight palette parameters are changed by this fade.
export function fadeFatalPalette(s,data,context) {
  for(let i=7;i>=0;i--)s.paletteParams[i]=(data.palette[i]&15)|s.crashFade;
  s.displayBackground=s.paletteParams[5];
  if(context?.graphics?.collisionColor)context.graphics.collisionColor(s.paletteParams[0]);
  s.crashFade=byte(s.crashFade+1);
}
// $3D38, immediately before the shared hardware/standby rebuild at $3D48.
export function resetAfterDeath(s) {
  s.previousLevel=s.quotaFlag=s.remainingBcd=s.rescued=s.quota=s.overQuota=0;
  s.gameSoundActive=0;s.attractTimer=100;
}
function* teardown(s,context) {
  // $4F76 disables viewport DMA, then holds the current frame for sixty VBIs.
  s.viewportEnabled=false;
  if(context.graphics)requireMethod(context.graphics,'viewport')(false);
  yield*wait(s,60);
  let index=s.crashFade;
  do {
    s.timerParamA=byte(s.timerParamA-1);enqueueEvent(s,13);
    s.displayBackground=index;s.paletteParams[5]=index;yield*wait(s,2);index=byte(index-1);
  }while(index!==31);
  s.displayBackground=s.paletteParams[5]=0;s.restartPhase=5;resetAfterDeath(s);
  if(context.restart)context.restart(s);
  return {kind:'restart'};
}
// This is the `death` generator passed to RescueController, after $8237 tones.
export function* jaggiDeathTail(s,data,context={}) {
  resetFatalVoice(s);yield*wait(s,20);s.crashFade=s.gamePhase=32;
  do {fadeFatalPalette(s,data,context);yield*wait(s,2);}while(s.crashFade!==43);
  return yield*teardown(s,context);
}
export function* crashDeath(s,data,context) {
  s.lockonState=128;
  while(s.introCounter)yield*frame();
  requireMethod(context.sound,'reset')();
  s.controlMode=s.objectRightX=s.crashControl=s.introDelay=0;s.introCounter=66;s.crashFade=32;
  do {
    yield*wait(s,2);
    if(s.introCounter<6){fadeFatalPalette(s,data,context);resetFatalVoice(s);}
  }while(s.crashFade!==43);
  return yield*teardown(s,context);
}

// $7BC6, entered when the original mission-return timer expires.
export function setupLevelClear(s) {
  s.rescueAvailable=255;if(s.scene)s.mode=2;s.messageTimer=82;marked(s,29);return s;
}
// $70E7, restoring the idle music sequence after the mission lift/rebuild.
export function resetIdleAudio(s,context) {
  s.musicGate=1;requireMethod(context.sound,'write')(8,0);
  s.musicNoteTimer=s.sfxReinitGate=0;s.musicCursor=255;
}
function refresh(s,context){requireMethod(context,'refreshHud')(s);}
function scorePending(s) {
  const delta=unpackDecimal(s.scoreDeltaHigh)*100+unpackDecimal(s.scoreDeltaLow);
  addScore(s,delta);s.scoreDeltaLow=s.scoreDeltaHigh=0;
}
function* bonus(s,context,{decrement=false}={}) {
  if(decrement){s.remainingBcd=packedDecimal((unpackDecimal(s.remainingBcd)+99)%100);refresh(s,context);}
  scorePending(s);marked(s,16);yield*wait(s,10);
}
function* displayCount(s,context,count) {
  s.remainingBcd=packedDecimal(count);s.bonusLevelCount=count%10;refresh(s,context);yield*wait(s,20);
}
// $75B8 increments at least once, even if the two level values already match.
export function countLevels(s) {
  const count=((s.level-s.levelCount)&255)||256;
  s.levelCount=s.level;s.bonusLevelBcd=packedDecimal(count%100);return count;
}
// $6153..$622D / $62E7: score and the exact next selectable level interval.
// The surrounding standby/lift renderer consumes the returned interval.
export function* missionReturn(s,data,context) {
  if(s.rescued) {
    s.missionDifference=byte(s.rescued-s.quota);
    let count,oldQuota=s.quota;
    if(s.missionDifference&128){s.quota=byte(s.quota-s.rescued);count=s.rescued;}
    else count=s.quota;
    s.bonusRemaining=count;
    yield*displayCount(s,context,oldQuota);
    s.messageColor=120;showMessage(s,12,context.messages);
    do {
      s.scoreDeltaLow=0;s.scoreDeltaHigh=5;yield*bonus(s,context,{decrement:true});
      s.bonusRemaining=byte(s.bonusRemaining-1);
    }while(s.bonusRemaining);
    if(!(s.missionDifference&128)) {
      if(s.missionDifference) {
        yield*wait(s,60);yield*displayCount(s,context,s.missionDifference);s.messageColor=124;syncPalette(s);
        do {
          s.scoreDeltaHigh=16;requireMethod(context.sound,'load')(16);yield*wait(s,5);
          yield*bonus(s,context,{decrement:true});s.missionDifference=byte(s.missionDifference-1);
        }while(s.missionDifference);
      }
      yield*wait(s,60);s.messageColor=42;showMessage(s,131,context.messages);
      requireMethod(context.jingle,'start')(1);s.musicActive=1;
      do {yield*frame();s.musicActive=context.jingle.active?1:0;}while(s.musicActive);
      s.musicGate=s.restartPhase=0; // original $712D music-end side effects
      s.bonusLevelCount=s.level;if(s.level>=s.highestLevel)s.highestLevel=s.level;
      countLevels(s);
      if(!s.quotaFlag) {
        do {
          s.bonusRemaining=2;
          do {s.scoreDeltaHigh=s.bonusLevelBcd;yield*bonus(s,context);s.bonusRemaining=byte(s.bonusRemaining-1);}while(s.bonusRemaining);
          s.bonusLevelCount=byte(s.bonusLevelCount-1);
        }while(s.bonusLevelCount);
        yield*wait(s,60);
      }
    } else yield*wait(s,60);
    clearMessage(s);
  }
  if(s.missionDifference&128) {
    if(s.level<5){s.minimumSelectable=1;s.maximumSelectable=4;}
    else {s.maximumSelectable=s.level;s.minimumSelectable=byte(s.level-3);}
    return {kind:'standby',completed:false,minimum:s.minimumSelectable,maximum:s.maximumSelectable};
  }
  s.minimumSelectable=byte(s.level+1);
  const maximum=byte(s.level+4);s.maximumSelectable=s.sfxReinitGate=maximum>=100?99:maximum;
  return {kind:'lift',completed:true,minimum:s.minimumSelectable,maximum:s.maximumSelectable};
}

// $6378..$63A7. Replaying the same level preserves the actual world and its
// occupants, as well as the remaining quota after a short return.
export function prepareLaunch(s) {
  s.rescued=0;let resetScore=false;
  if(!s.scene) {
    const previous=s.previousLevel;s.previousLevel=s.level;
    if(s.level===previous){s.quotaFlag=byte(s.quotaFlag+1);return {reuseWorld:true,resetScore:false};}
    if(s.level<previous){resetScore=true;s.score=0;s.levelCount=0;s.scoreCells.fill(0);}
  }
  s.quotaFlag=0;
  const p=levelParameters(s.level,{nightPhase:s.nightPhase});
  Object.assign(s,{quota:p.quota,remainingBcd:p.remainingBcd,rescueThreshold:p.rescueThreshold,respawnCounter:p.respawnCounter,
    gunDensity:p.gunDensity,saucerReload:p.saucerTimers[0],saucerCountdown:p.saucerTimers[1],fireDelayMask:p.fireDelayMask,
    lockReload:p.lockonReload,alienBase:p.alienBase,alienThreshold:p.alienThreshold,rangeRecovery:p.alienDelay,
    thrustOffset:p.thrustOffset,dayFlag:p.nightFlag,nightPhase:p.nightPhase,bonusLevelCount:s.level>>>2});
  return {reuseWorld:false,resetScore};
}

// A semantic foreground runner shared by the root's death/return presentation.
// It never advances the clock, sound, or VBI on its own.
export class LifecycleController {
  constructor(state){this.state=state;this.active=false;this.result=null;}
  start(iterator) {if(this.active)throw new Error('Lifecycle foreground already active');this.iterator=iterator;this.active=true;this.waiting=null;this.result=null;return this.resume();}
  resume() {
    for(let budget=0;budget<4096;budget++) {
      const result=this.iterator.next();
      if(result.done){this.active=false;this.waiting=null;this.result=result.value;return false;}
      this.waiting=result.value;
      if(this.waiting.kind==='clock'&&this.state.clock===this.waiting.value)continue;
      return true;
    }
    throw new Error('Lifecycle failed to reach an original foreground wait');
  }
  step() {if(!this.active)return false;if(this.waiting.kind==='clock'&&this.state.clock!==this.waiting.value)return true;return this.resume();}
}

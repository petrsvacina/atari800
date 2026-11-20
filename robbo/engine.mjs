// Native Robbo mission/lifecycle orchestration. Original CPU is an offline oracle.
import {createObjectEngine} from './objects.mjs';
import {createPlayer,addScore,bcdSubtract} from './player.mjs';
import {createVbi} from './vbi.mjs';
import {makeFont} from './raster.mjs';

export const PAL_HZ=1773447/(312*114);
const byte=value=>value&255;
export class RobboRandom {
  constructor(seed=0){this.bits=new Uint8Array(16385);let value=131071;for(let i=0;i<this.bits.length;i++){value=((((value>>>5)^value)&255)<<9)+(value>>>8);this.bits[i]=(value>>>1)&255;}this.phase=((seed%131071)+131071)%131071;this.reads=0;}
  advance(cycles){this.phase=(this.phase+Math.floor(cycles))%131071;}
  next(){this.advance(9);this.reads++;const n=this.phase>>>3,shift=this.phase&7;return((this.bits[n]>>>shift)|(this.bits[n+1]<<(8-shift)))&255;}
}
export function createState(values={}) {
  return {x:0,y:0,scanX:0,scanY:0,fx:0,fy:0,lm:13,scrolling:0,scrollCounter:0,vscroll:0,tele:1,fac:0,
    level:0,keys:0,lives:8,screws:0,lastLifeLevel:99,ammo:0,demo:0,moving:0,counter:0,noga:0,shotTimer:0,
    score:new Uint8Array(3),map:new Uint8Array(512),displayMap:new Uint8Array(512).fill(19),cameraAddress:0x1000,targetAddress:0x1000,
    clock:0,infoPhase:0,colors:[0,0,0,0,0],border:0,...values};
}
export function createServices(state,assets,{randomByte=()=>128,sound=()=>{},input=()=>({stick:15,fire:false}),footstep=()=>{},exitFlash=()=>{}}={}) {
  const s=state;
  const ctx={state:s,randomByte,sound,input,addScore:(low,mid)=>addScore(s,low,mid),
    test:(x=s.x,y=s.y)=>s.map[((y&31)<<4)|(x&255)]??160,
    put:id=>{if(s.x<0||s.x>=16||s.y<0||s.y>=32)return;const at=s.y*16+s.x;s.map[at]=s.displayMap[at]=id&255;},
    spawnReady:()=>!s.scrolling,exitFlash};
  ctx.objects=createObjectEngine(ctx);ctx.player=createPlayer(ctx);ctx.robbo=()=>ctx.player.tick();ctx.teleportExit=()=>ctx.player.stop();
  ctx.chnmon=()=>{
    s.fontRobotPhase=s.noga&1;
    if(s.moving&&s.fac){s.noga=byte(s.noga+1);footstep();}
    s.font=makeFont(assets,{...s,cntr:s.counter});
  };
  ctx.afterScan=()=>ctx.chnmon();
  return ctx;
}
// Pure PLA1/ENTCV state, separate from presentation waits and VBI interleaving.
export function initializeLevel(s,assets,ctx) {
  const level=assets.levels[s.level];if(!level)throw new Error('Invalid original Robbo planet');
  s.map.set(level.map);s.map.set(level.metadata,496);s.displayMap.fill(19);
  s.screws=level.screwsBcd;s.colors=Array.from(level.colors);s.border=level.border;
  s.tele=1;s.keys=s.ammo=s.moving=0;s.lm=13;ctx.sound(255);
  s.y=31;for(s.x=15;s.x>=0;s.x--)ctx.put(19);
  for(s.x=16;s.x>=0;s.x--) {
    for(s.y=0;s.y<31;s.y++) {
      let id=ctx.test();if(id===42){ctx.player.stop();id=27;}
      if(id===43&&s.level===s.lastLifeLevel)id=225;
      ctx.put(id);
    }
    ctx.chnmon();if(s.x&1)s.counter=byte(s.counter+1);
  }
  s.x=255;s.y=31;
}
export function initializeGame(assets,{level=0,lives=8}={}) {
  const state=createState({level,lives}),ctx=createServices(state,assets);
  initializeLevel(state,assets,ctx);return {state,ctx};
}

export class Robbo {
  constructor(assets,{level=0,seed=0,sound=null,randomByte=null,demo=false}={}) {
    this.assets=assets;this.hz=PAL_HZ;this.random=new RobboRandom(seed);this.randomByte=randomByte??(()=>this.random.next());this.sound=sound;
    this.state=createState({level,demo:Number(demo)});this.events=[];this.ticks=0;this.scans=0;this.input={stick:15,fire:false};this.checkpoint=level&252;
    this.ctx=createServices(this.state,assets,{randomByte:()=>this.randomByte(),sound:id=>this.effect(id),input:()=>this.input,
      footstep:()=>this.sound?.footstep?.(),exitFlash:()=>{this.flashFrames=3;this.savedBorder=this.state.border;this.state.border=15;}});
    this.vbi=createVbi({state:this.state,infoFont:assets.infoFont,hudTemplate:assets.hudTemplate,soundStep:clock=>this.sound?.step(clock)});
    this.timer=0;this.loadLevel(level,{newGame:true});
  }
  effect(id){this.sound?.trigger(id);}
  loadLevel(level,{newGame=false}={}) {
    const s=this.state,oldTarget=s.targetAddress,startCounter=s.counter;
    s.level=level;initializeLevel(s,this.assets,this.ctx);this.finalTarget=s.targetAddress;s.targetAddress=oldTarget;
    s.displayMap.fill(19);s.counter=startCounter;s.moving=0;this.ctx.chnmon();
    this.phase='reveal';this.column=16;this.revealWait=newGame?4:0;this.timer=0;this.job=null;this.demoTimer=1280;
    this.events.push({type:'planet',level});
  }
  startScan() {
    if(this.phase==='play')this.state.fac=0;
    this.timer=7;this.job=this.ctx.objects.scanSteps({wait:true});this.jobWait=0;
  }
  finishScan() {
    this.job=null;this.scans++;const s=this.state;
    if(this.phase==='play') {
      if(s.tele)s.fac=s.tele;
      if(s.fac&128){this.closePlanet();return;}
      if(!s.fac){this.beginDeath();return;}
      if(s.demo&&this.demoTimer<256){this.closePlanet();return;}
    } else if(this.deathFrames<=0) {
      if(this.phase==='death-wait'){this.explodePlanet();return;}
      if(s.demo){this.closePlanet();return;}
      const next=bcdSubtract(s.lives,1);s.lives=next.value;
      if(next.carry){this.loadLevel(s.level);this.events.push({type:'life',lives:s.lives});}
      else {s.lives=byte(s.lives+1);this.phase='gameover';this.checkpoint=s.level&252;this.events.push({type:'gameover',checkpoint:this.checkpoint,score:Array.from(s.score)});}
    }
  }
  kill(){if(this.phase==='play')this.beginDeath();}
  beginDeath(){this.state.moving=0;this.phase='death-wait';this.deathFrames=48;this.timer=Math.max(0,this.timer);}
  explodePlanet() {
    const s=this.state;this.effect(0);
    for(let y=31;y>=0;y--)for(let x=15;x>=0;x--) {
      const at=y*16+x,id=s.map[at]&127;if([0,32,19,17,5].includes(id))continue;
      s.map[at]=byte(97+(this.randomByte()&3)+(id>=5?1:0));
    }
    this.phase='death-explosion';this.deathFrames=48;
  }
  closePlanet(){this.phase='closing';this.job=null;this.column=15;this.revealWait=0;this.state.moving=0;this.checkpoint=this.state.level&252;}
  tick(input=this.input) {
    const s=this.state;this.input=input;this.ticks++;s.clock=byte(s.clock+1);this.random.advance(35568);this.vbi.tick();
    if(s.demo&&this.demoTimer)this.demoTimer--;
    if(this.flashFrames&&!--this.flashFrames)s.border=this.savedBorder;
    if(this.timer)this.timer--;
    if(this.phase==='reveal') {
      if(this.revealWait){this.revealWait--;return;}
      if(this.column<0){this.phase='play';this.timer=0;return;}
      if(this.column===s.fx)s.targetAddress=this.finalTarget;
      if(this.column<16)for(let y=0;y<32;y++)s.displayMap[y*16+this.column]=s.map[y*16+this.column];
      this.ctx.chnmon();if(this.column&1)s.counter=byte(s.counter+1);this.column--;this.revealWait=2;return;
    }
    if(this.phase==='closing') {
      if(this.revealWait){this.revealWait--;return;}
      if(this.column<0) {
        if(s.level===55){this.phase=s.demo?'demo-end':'ending';this.events.push({type:s.demo?'demo-end':'complete',score:Array.from(s.score)});}
        else this.loadLevel(s.level+1);
        return;
      }
      s.x=this.column;for(s.y=31;s.y>=0;s.y--)this.ctx.put(19);
      this.ctx.chnmon();if(this.column&1)s.counter=byte(s.counter+1);this.column--;this.revealWait=2;return;
    }
    if(['gameover','ending','demo-end'].includes(this.phase))return;
    if(this.phase==='death-wait'||this.phase==='death-explosion')this.deathFrames--;
    if(this.jobWait&&--this.jobWait)return;
    for(let guard=0;guard<3;guard++) {
      if(!this.job){if(this.timer)return;this.startScan();}
      const step=this.job.next();
      if(!step.done){this.jobWait=step.value.frames;return;}
      this.finishScan();if(!['play','death-wait','death-explosion'].includes(this.phase))return;
    }
  }
}

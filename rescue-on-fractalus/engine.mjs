import {ViewGeometry} from './geometry.mjs';
import {TerrainRaster} from './terrain.mjs';
import {GroundObjectPainter} from './objects.mjs';
import {generateWorld} from './world.mjs';
import {FLIGHT_FIELDS,thrustRate} from './flight.mjs';
import {SERVICE_FIELDS,attachFlightServices,THRUST_CELL_ADDRESSES} from './flight-services.mjs';
import {SYSTEM_FIELDS,syncPalette} from './systems.mjs';
import {RESCUE_FIELDS,RescueController,alienAttack} from './rescue.mjs';
import {COMBAT_FIELDS,createTerrainContext,applyTerrainEffects,stepEnemyFire,enemyDispatch} from './combat.mjs';
import {LIFECYCLE_FIELDS,createLifecycleState,LifecycleController,jaggiDeathTail,crashDeath,missionReturn,prepareLaunch,tickCrashFlash,setupLevelClear} from './lifecycle.mjs';
import {VBI_FIELDS,stepFlightVbi,tickScanner} from './vbi.mjs';
import {SoundDriver,JingleDriver} from './sound.mjs';
import {PokeyRandom} from './random.mjs';
import {linkState} from './state.mjs';
import {instrumentCells,cockpitAssets} from './cockpit.mjs';
import {unpackDecimal} from './mission.mjs';

export const PAL_HZ=1773447/(312*114),NTSC_HZ=1789790/(262*114);
const byte=n=>n&255;
const camera=s=>({heading:s.heading,x:s.worldX,z:s.worldZ,altitude:s.depth,pitch:s.pitch,roll:s.rollShadow});

export class Fractalus {
  constructor(data,{level=4,seed=0,standard='pal',spriteApi}={}) {
    if(!spriteApi)throw new Error('Native PMG services required');
    this.data=data;this.spriteApi=spriteApi;this.standard=standard;this.hz=standard==='ntsc'?NTSC_HZ:PAL_HZ;
    this.clockHz=standard==='ntsc'?1789790:1773447;this.randomSource=new PokeyRandom(seed);this.random=()=>this.randomSource.next();
    const logicalGeometry=new ViewGeometry(data.geometry,data.trigonometry);
    logicalGeometry.x.set(data.bootstrap.state.projectedX);logicalGeometry.y.set(data.bootstrap.state.projectedY);
    this.logicalRasters=[0,1].map(()=>new TerrainRaster(logicalGeometry,data.raster));
    this.raster=this.logicalRasters[1];this.geometry=this.raster.geometry;
    this.visualGeometry=new ViewGeometry(data.geometry,data.trigonometry);this.visualRaster=new TerrainRaster(this.visualGeometry,data.raster);
    this.painter=new GroundObjectPainter(data.objects);this.ticks=0;this.logicalPasses=0;this.half=48;
    this.phase='flight';this.input={port:255,fire:false};this.commandQueue=[];this.events=[];this.job=null;this.ended=false;
    this.state=linkState(createLifecycleState({...structuredClone(data.bootstrap.state),level}),FLIGHT_FIELDS,SERVICE_FIELDS,SYSTEM_FIELDS,RESCUE_FIELDS,COMBAT_FIELDS,LIFECYCLE_FIELDS,VBI_FIELDS,spriteApi.SPRITE_FIELDS);
    this.state.previousLevel=0;prepareLaunch(this.state);this.state.dial=thrustRate(level,7);
    const visibleCells=Uint8Array.from(data.bootstrap.world.visibleCells);
    this.world={...generateWorld({level,random:this.random,visibleCells}),visibleCells};
    this.bindServices();this.beginPass();
  }
  bindServices() {
    const s=this.state,d=this.data;
    this.pm=this.spriteApi.createSpriteState(d.bootstrap.spritePmg);
    this.pm.p1.set(s.energyCells,0x98);s.energyCells=this.pm.p1.subarray(0x98,0xd8);
    this.sound=new SoundDriver(d.sound,{random:this.random});this.sound.parameters.set(d.bootstrap.sound.parameters);
    this.sound.registers.set(d.bootstrap.sound.registers);
    for(const [key,value]of Object.entries(d.bootstrap.sound))if(!['parameters','registers'].includes(key))this.sound[key]=value;
    this.sound.bindFlight(s);
    this.hooks=attachFlightServices({...this.world,visibleCells:()=>this.world.visibleCells,random:this.random});
    this.sprites=this.spriteApi.makeSpriteHooks(this.pm,{spanTable:()=>s.terrainScreenSpans,random:this.random});
    const jingle={active:false,start:song=>{this.jingle=new JingleDriver(d.sound,{song,registers:this.sound.registers});this.jingle.registers=this.sound.registers;jingle.active=true;}};
    this.lifecycleContext={random:this.random,sound:this.sound,messages:d.systems.messages,jingle,refreshHud:state=>tickScanner(state),
      graphics:{viewport:value=>{s.viewportEnabled=value;},collisionColor(){}},restart:()=>{this.ended=true;this.phase='gameover';this.events.push({type:'gameover'});}};
    this.life=new LifecycleController(s);
    this.rescueContext={...this.world,random:this.random,sound:this.sound,sourceField:new Uint8Array(2304),field:this.raster.field,
      death:state=>jaggiDeathTail(state,d.lifecycle,this.lifecycleContext)};
    this.rescue=new RescueController(d.rescue,s,this.rescueContext);
  }
  command(code){if(this.phase==='flight'&&!this.ended)this.commandQueue.push(code);}
  get registers(){return this.jingle?.active?this.jingle.registers:this.sound.registers;}
  tick(input=this.input) {
    if(this.ended)return;
    this.input=input;this.ticks++;this.randomSource.advance(this.clockHz/this.hz);
    const s=this.state,command=this.commandQueue[0];
    if(this.phase==='return') {
      // The original has left the flight interrupt for the station VBI here.
      // Bonus waits cannot keep integrating the aircraft or adding flight time.
      s.clock=byte(s.clock+1);s.standbyCounter=byte((s.standbyCounter??0)+1);
      if(this.jingle){this.jingle.step();this.lifecycleContext.jingle.active=this.jingle.active;}
      this.sound.stepFlight(s);this.life.step();if(!this.life.active)this.lifecycleFinished();return;
    }
    const consumesCommand=s.parity===1&&(s.eventOwner||s.controlMode===2||s.scene&&s.controlMode);
    stepFlightVbi(s,{input:{...input,command},random:this.random,sound:this.sound,hooks:this.hooks,world:this.world,
      tables:{...this.data.systems,energyColors:this.data.rescue.energyColors},quarter:this.data.trigonometry.high,sprites:this.sprites,lifecycle:{tickCrashFlash,setupLevelClear}});
    if(consumesCommand&&command!==undefined)this.commandQueue.shift();
    if(this.jingle){this.jingle.step();this.lifecycleContext.jingle.active=this.jingle.active;}
    if(this.life.active){this.life.step();if(!this.life.active)this.lifecycleFinished();return;}
    if(this.rescue.active){this.rescue.step();if(!this.rescue.active&&!this.ended){this.afterRescue();if(this.phase==='flight'&&!this.life.active)this.beginPass();}return;}
    if(s.eventOwner)return;
    if(this.job&&this.ticks>=this.job.readyAt)this.finishPass();
    if(!this.job&&!this.life.active&&!this.rescue.active&&!this.ended&&this.phase==='flight')this.beginPass();
  }
  beginPass() {
    this.raster=this.logicalRasters[this.half===48?1:0];this.geometry=this.raster.geometry;
    this.rescueContext.field=this.raster.field;
    const s=this.state,context=createTerrainContext(s,{half:this.half,random:this.random});
    const shapeBase=byte((s.rollShadow>>>8)+4);s.p3ShapeBase=shapeBase&128?0:Math.min(8,shapeBase);
    const view=camera(s),vector=this.geometry.headingVector(s.heading);s.directionX=vector.sin&65535;s.directionZ=vector.cos&65535;
    this.raster.draw(view,this.world.terrain,{half:this.half,horizonCells:s.horizonCells,painter:this.painter,objects:this.world.objects,context});
    this.world.visibleCells.set(this.geometry.mapIndex);
    // Calibrated scheduling is supplied separately from the physics clock.
    // Until all scene costs are mapped, this is a measured-rate compatibility
    // profile, not a claim of exact Atari CPU/DMA wall timing.
    const profile=this.data.timing.profiles[s.level===1?'1':'4'];
    const measured=profile.intervals[this.logicalPasses%profile.intervals.length];
    const interrupts=Math.max(1,Math.round(measured*this.hz/PAL_HZ*1773447/this.clockHz));
    this.job={context,readyAt:this.ticks+interrupts,view,half:this.half};
  }
  finishPass() {
    const s=this.state,job=this.job;this.job=null;this.logicalPasses++;
    const result=applyTerrainEffects(s,this.world,this.geometry,job.context,{random:this.random,half:job.half,skyline:this.raster.skyline});
    if(job.half===48)this.pilotState=s.gamePhase;else if(s.gamePhase)this.pilotState=s.gamePhase;
    let foregroundIndex=result.nextIndex;
    const fire=stepEnemyFire(s,this.raster,this.random);if(fire.nextIndex!==undefined)foregroundIndex=fire.nextIndex;
    const dispatch=enemyDispatch(s);
    if(dispatch==='cinematic'){this.life.start(crashDeath(s,this.data.lifecycle,this.lifecycleContext));return;}
    if(dispatch==='alien')alienAttack(s,this.rescueContext);
    this.displayRaster=this.raster;
    if(job.half===0)s.sensorMaskA=this.raster.field[23];else s.sensorMaskB=this.raster.field[23];
    if(job.half===48) {
      s.renderSwap=2;
      if(s.energy<14&&!s.scene&&s.rescueAvailable===1)s.missionTimer=1;
      this.half=0;
    } else {
      this.half=48;
      if(s.pilotPrevious&&s.pilotVisible) {
        this.rescueContext.sourceField.set(this.raster.field);
        this.rescue.start({entryX:foregroundIndex});
        if(this.rescue.active)return;
      }
      this.afterRescue();
    }
    syncPalette(s);
  }
  afterRescue() {
    const s=this.state;s.pilotPrevious=s.pilotVisible;s.pilotVisible=this.pilotState?0:s.systemsOff;s.renderSwap=1;
    if(s.systemsOff!==1&&s.mode!==2&&s.landingPhase){s.landingPhase=2;s.messageTimer=14;}
    if(s.mode===2) {
      s.controlMode=3;s.approachSentinelA=s.approachSentinelB=128;
      if((s.depth>>>8)>=64&&(s.ready&128)){
        s.controlMode=0;s.missionDifference=255;this.phase='return';
        this.life.start(missionReturn(s,this.data.lifecycle,this.lifecycleContext));if(!this.life.active)this.lifecycleFinished();
      }
    }
  }
  lifecycleFinished() {
    const result=this.life.result;
    if(result?.kind==='restart'){this.ended=true;this.phase='gameover';}
    else if(result?.kind==='standby'||result?.kind==='lift') {
      this.phase='standby';this.nextLevel=result.minimum;this.events.push({type:'mission',...result,score:this.state.score});
    }
  }
  terrain(smooth=false) {
    if(!smooth||this.rescue.active||this.life.active||this.state.systemsOff||this.phase!=='flight')return this.displayRaster??this.raster;
    const s=this.state,context=createTerrainContext(s,{half:this.half});
    this.visualGeometry.x.set(this.geometry.x);this.visualGeometry.y.set(this.geometry.y);
    this.visualRaster.draw(camera(s),this.world.terrain,{half:this.half,horizonCells:s.horizonCells,painter:this.painter,objects:this.world.objects,context});
    return this.visualRaster;
  }
  launch(level=this.nextLevel??this.state.level) {
    const old=this.state;old.level=level;const transition=prepareLaunch(old);
    const keep=['level','previousLevel','quotaFlag','remainingBcd','rescued','quota','overQuota','rescueThreshold','respawnCounter','gunDensity','saucerReload','saucerCountdown','fireDelayMask','lockReload','alienBase','alienThreshold','rangeRecovery','thrustOffset','dayFlag','nightPhase','levelCount','maximumSelectable','highestLevel','score','scoreCells'];
    const values=structuredClone(this.data.bootstrap.state);for(const key of keep)values[key]=structuredClone(old[key]);
    this.state=linkState(createLifecycleState(values),FLIGHT_FIELDS,SERVICE_FIELDS,SYSTEM_FIELDS,RESCUE_FIELDS,COMBAT_FIELDS,LIFECYCLE_FIELDS,VBI_FIELDS,this.spriteApi.SPRITE_FIELDS);
    this.state.dial=thrustRate(level,7);
    if(!transition.reuseWorld){const visibleCells=this.world.visibleCells.slice();this.world={...generateWorld({level,random:this.random,visibleCells}),visibleCells};}
    this.bindServices();this.phase='flight';this.ended=false;this.job=null;this.half=48;this.commandQueue=[];this.jingle=null;this.beginPass();
  }
  cockpitState() {
    const s=this.state,data=cockpitAssets(),cells=instrumentCells(s,data);
    const cell=(address,value)=>{const i=address-0x332d;if(i>=0&&i<cells.length)cells[i]=value;};
    for(let i=0;i<THRUST_CELL_ADDRESSES.length;i++)cell(THRUST_CELL_ADDRESSES[i],s.thrustCells[i]);
    for(let i=0;i<6;i++)cell(0x3492+i,s.lockCells[i]);
    for(const [address,key]of [[0x3355,'status'],[0x3356,'motherShipLeft'],[0x3357,'motherShipRight'],[0x3388,'airlockCell'],[0x33df,'scannerLeft'],[0x33e0,'scannerRight']])cell(address,s[key]);
    return {...s,cockpitCells:cells,ahRows:this.pm.p2,altitudeRows:this.pm.p0,missileRows:this.pm.missiles,energyRows:this.pm.p1,range:s.rescueStatus,kills:unpackDecimal(s.destroyedCount),quota:unpackDecimal(s.remainingBcd),quotaDim:!!(s.overQuota&&!(12&s.collisionClock)),paletteParams:s.paletteParams};
  }
}

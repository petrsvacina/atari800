/* Native River Raid flight and collision rules. Atari is an offline data oracle only. */
(function(root){
'use strict';
const WIDTH=320,HEIGHT=160,HZ=1789772.5/(114*262),MAX_FUEL=65535,MAX_SCORE=9999990;
class Course{
 constructor(a=root.RIVER_ASSETS){this.assets=a;this.rows=new Array(512);this.tags=new Float64Array(512).fill(-1);this.head=-1;}
 put(index,pixels){const slot=index&511;this.rows[slot]=pixels;this.tags[slot]=index;this.head=index;}
 fullRow(index){if(index<0||this.tags[index&511]!==index)return null;return this.rows[index&511];}
 row(index){return this.fullRow(index)?.subarray(4,44)||null;}
 color(x,y){const row=this.fullRow(y);if(!row||x< -32||x>=352)return 0;const p=(x+32)>>1;return row[p>>2]>>(6-(p&3)*2)&3;}
 start(bridge){return this.assets.generator.starts.find(s=>s.bridge===bridge)||this.assets.generator.starts[0];}
}
function flight(p,input={}){
 const previous=p.controls??15;
 let controls=15;for(const[k,bit]of [['up',1],['down',2],['left',4],['right',8]])if(input[k])controls&=15^bit;
 p.pose=9;
 if((controls&12)===12){p.accel=0;p.fraction=0;}
 else{
  const next=p.accel+8;if(next<256)p.accel=next;
  const overflow=next>=256;
  if(controls&8){p.pose=7;if(overflow){p.rawX--;p.fraction=8;}else{const n=p.fraction-p.accel;if(n<0)p.rawX--;p.fraction=n&255;}}
  else{p.pose=8;if(overflow){p.rawX++;p.fraction=0;}else{const f=previous&8?255:p.fraction,n=f+p.accel+(overflow?1:0);if(n>=256)p.rawX++;p.fraction=n&255;}}
 }
 if(!(controls&1)){if(p.speed+2<256)p.speed+=2;}
 else if(!(controls&2)){if(p.speed>=65)p.speed-=2;}
 else if(p.speed<128)p.speed+=2;else if(p.speed>128&&p.speed>=65)p.speed-=2;
 p.rawX&=255;p.controls=controls;return p;
}
function planeBits(assets,pose){return assets.planes[pose]||assets.planes[9];}
function sprite(assets,type,flags=0){return assets.sprites[type]?.variants[flags&8?1:0];}
function hitPixels(bits,scale,x,y,other,otherScale,ox,oy){
 const h=bits.length,oh=other.length;if(x+8*scale<=ox||ox+8*otherScale<=x||y+h<=oy||oy+oh<=y)return false;
 for(let yy=Math.max(y,oy);yy<Math.min(y+h,oy+oh);yy++)for(let xx=Math.max(x,ox);xx<Math.min(x+8*scale,ox+8*otherScale);xx++)if(bits[Math.floor(yy-y)]&(128>>Math.floor((xx-x)/scale))&&other[Math.floor(yy-oy)]&(128>>Math.floor((xx-ox)/otherScale)))return true;
 return false;
}
class Game{
 constructor(options={}){
  this.baseCourse=options.course||new Course();this.assets=this.baseCourse.assets;
  this.mode=options.mode==='two'?'two':'solo';this.startBridge=[1,5,20,50].includes(Number(options.bridge))?Number(options.bridge):1;
  this.randomState=options.seed??0x52697665;this.tick=-80;this.events=[];this.paused=false;this.playerIndex=0;this.best=Number(options.best)||0;
  const start=this.assets.generator.starts.find(s=>s.bridge===this.startBridge);
  this.pilots=Array.from({length:this.mode==='two'?2:1},()=>({lives:4,score:0,nextLife:10000,bridge:this.startBridge,checkpoint:copyCheckpoint(start)}));
  this.resetFlight();
  // The web menu shows the original ready screen after its 160-row warm-up.
  for(let i=0;i<80;i++){this.tick++;this.combat();this.generate(2);}
  this.warmFrames=0;this.phase='ready';this.life=47;this.player.pose=9;this.pending=this.collisions();this.drainEvents();
 }
 get pilot(){return this.pilots[this.playerIndex];}get score(){return this.pilot.score;}get lives(){return this.pilot.lives;}get bridge(){return this.pilot.bridge;}
 get enemies(){return this.gen.actors.slice(this.gen.first);}
 get tank(){return this.gen.tank;}get gunner(){return this.gen.gunner;}
 get bridgeDestroyed(){return this.gen.bridgeDestroyed;}set bridgeDestroyed(value){this.gen.bridgeDestroyed=value;}
 emit(type,data={}){this.events.push({type,...data});}drainEvents(){return this.events.splice(0);}
 random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState>>>24;}
 resetFlight(){
  const oldGunner=this.gen?.gunner,oldActors=this.gen?.actors,oldControls=this.player?.controls??15;
  this.gen=new root.RiverGenerator(this.assets,this.pilot.checkpoint,this.gen?.previousCheckpoint);
  if(oldGunner)Object.assign(this.gen.gunner,{rawY:oldGunner.rawY,dx:oldGunner.dx});
  if(oldActors)for(let i=0;i<10;i++)this.gen.actors[i].rawY=oldActors[i].rawY;
  this.course=this.baseCourse instanceof Course?new Course(this.assets):this.baseCourse;
  this.player={rawX:(this.gen.center+92)&255,fraction:0,accel:0,speed:254,controls:oldControls,pose:0,y:142};
  this.scroll=-160;this.scrollFraction=0;this.generated=-1;this.fuel=MAX_FUEL;this.bullet=null;this.refueling=false;this.refuelClock=0;this.waterFlash=0;this.waterRed=false;
  this.phase='warmup';this.life=127;this.warmFrames=80;this.pending={};this.emit('reset');
 }
 start(){if(this.phase==='ready'){this.phase='playing';this.life=0;this.player.speed=64;this.emit('start');}}
 screenY(e){return e.rawY-93;}slot(e){return this.gen.actors.indexOf(e);}internalStage(){return this.gen.stage;}
 generate(count){for(let i=0;i<count;i++){const pixels=this.gen.next();this.course.put?.(this.gen.row,pixels);this.generated=this.gen.row;this.scroll=this.generated-159;}this.pilot.checkpoint=copyCheckpoint(this.gen.checkpoint);}
 scrollRiver(){
  // A701 makes two independent additions; speed FE always produces two rows.
  for(let i=0;i<2;i++)if(this.player.speed>=254)this.generate(1);else{this.scrollFraction+=this.player.speed;if(this.scrollFraction>=256){this.scrollFraction-=256;this.generate(1);}}
 }
 combat(){
  const g=this.gen;
  root.RiverMechanics.updateCombat({tick:this.tick,tank:g.tank,actors:g.actors,first:g.first,nearest:g.nearest,flip:g.flip,stage:g.stage,playing:this.phase==='playing',bridgeDestroyed:g.bridgeDestroyed},this.tick%16===0?this.random():0,this.assets.mechanics);
 }
 projectiles(){
  const g=this.gen,e=g.gunnerSlot<11?g.actors[g.gunnerSlot]:null;
  if(root.RiverMechanics.updateGunner(g.gunner,e,this.phase==='playing'))this.emit('tank');
  const old=g.tank.phase;root.RiverMechanics.updateTankShot(g.tank,this.phase==='playing',this.assets.mechanics);if(old===0&&g.tank.picture)this.emit('tankBeam');
 }
 addScore(n){
  const p=this.pilot,total=p.score+n,overflow=total>MAX_SCORE;p.score=Math.min(MAX_SCORE,total);this.best=Math.max(this.best,p.score);
  while(p.score>=p.nextLife&&p.nextLife<=MAX_SCORE){p.nextLife+=10000;if(p.lives<10){p.lives++;this.emit('life');}}
  if(overflow&&this.phase==='playing'){p.lives=1;this.crash('Dosaženo nejvyššího skóre.');}
 }
 destroy(e,frame=2,score=true){
  if(e.frame<7)return;e.frame=frame;let points=this.assets.scores[e.type]||0,bonus=false;
  if(score&&e.type===14){this.gen.bridgeDestroyed=true;this.waterFlash=23;this.pilot.bridge++;if(root.RiverMechanics.tankBonus(this.tank,e.rawX,this.bridge)){points=750;bonus=true;}this.emit('bridge');}
  this.emit('explosion',{tank:bonus});if(score)this.addScore(points);
 }
 crash(reason,sound='impact'){
  if(this.phase!=='playing')return;
  const g=this.gen;
  // B1C0 reconciles the bridge under the plane with the generator's look-ahead.
  if((g.actors[10].flags^g.flags)&4){
   if(g.bridgeDestroyed&&(g.flags&128))g.advanceStage();
   else if(!g.bridgeDestroyed&&!(g.flags&128)){g.stage=g.previousCheckpoint.stage;g.checkpoint=g.previousCheckpoint;}
  }
  this.pilot.checkpoint=copyCheckpoint(g.checkpoint);this.pilot.checkpoint.stage=g.stage;
  this.pilot.lives--;this.phase='crash';this.reason=reason;this.life=254;this.player.pose=6;this.bullet=null;g.gunnerSlot=11;this.gunner.rawX=0;this.emit('crash',{sound});
 }
 chooseNextPilot(){if(this.mode==='two')for(let n=1;n<=2;n++){const i=(this.playerIndex+n)%2;if(this.pilots[i].lives>0){this.playerIndex=i;return true;}}return this.pilot.lives>0;}
 actorPixels(e){return root.RiverMechanics.actorPicture(this.assets,e);}
 collisions(){
  const c={playerActor:-1,bulletActor:-1,blastActor:-1},p=this.player,px=(p.rawX-48)*2,bits=planeBits(this.assets,p.pose),t=this.tank;
  for(let slot=this.gen.first;slot<11;slot++){
   const e=this.gen.actors[slot],y=this.screenY(e),info=this.assets.sprites[e.type],picture=this.actorPixels(e),scale=info.width/4,x=(e.rawX-48)*2;
   if(y>=160||y+picture.bits.length<=0)continue;
   e.flags&=254;
   // B61E shifts P3PF before masking: NPCs turn on PF1, the dark shoreline.
   for(let yy=0;yy<picture.bits.length;yy++)if(y+yy>=0&&y+yy<160)for(let xx=0;xx<8;xx++)if(picture.bits[yy]&(128>>xx))for(let sx=0;sx<scale;sx++)if(this.course.color(x+xx*scale+sx,this.generated-y-yy)===2)e.flags|=1;
   if(hitPixels(bits,2,px,p.y,picture.bits,scale,x,y))c.playerActor=slot;
   if(this.bullet&&hitPixels([128,128,128,128,128,128,128,128],2,this.bullet.x,this.bullet.y,picture.bits,scale,x,y))c.bulletActor=slot;
   if(t.picture&&hitPixels(this.assets.mechanics.shotFrames[t.picture],2,(t.shotX-48)*2,t.shotY-28,picture.bits,scale,x,y))c.blastActor=slot;
  }
  for(let yy=0;yy<bits.length;yy++)for(let xx=0;xx<8;xx++)if(bits[yy]&(128>>xx))for(let sx=0;sx<2;sx++)if(this.course.color(px+xx*2+sx,this.generated-p.y-yy)===1)c.playerBank=true;
  if(this.bullet)for(let yy=0;yy<8;yy++)if(this.bullet.y+yy>=0&&this.bullet.y+yy<160)for(let sx=0;sx<2;sx++){const color=this.course.color(this.bullet.x+sx,this.generated-this.bullet.y-yy);if(color===1||color===2)c.bulletBank=true;}
  t.bankCollision=false;const tankBits=this.assets.mechanics.tankFrames[t.frame&127];
  for(let yy=0;yy<tankBits.length;yy++)if(t.rawY-28+yy>=0&&t.rawY-28+yy<160)for(let xx=0;xx<8;xx++)if(tankBits[yy]&(128>>xx))for(let sx=0;sx<2;sx++)if(this.course.color((t.rawX-48)*2+xx*2+sx,this.generated-(t.rawY-28)-yy)===2)t.bankCollision=true;
  if(t.picture&&hitPixels(bits,2,px,p.y,this.assets.mechanics.shotFrames[t.picture],2,(t.shotX-48)*2,t.shotY-28))c.tankShot=true;
  const gun=this.gunner;gun.bankCollision=false;
  if(gun.rawX){const x=(gun.rawX-48)*2,y=gun.rawY-28;for(let xx=0;xx<8;xx++){const color=this.course.color(x+xx,this.generated-y);if(color===1||color===2)gun.bankCollision=true;}if(hitPixels(bits,2,px,p.y,[240],2,x,y))c.gunnerShot=true;}
  return c;
 }
 play(input){
  const c=this.pending,p=this.player,e=c.playerActor>=0?this.gen.actors[c.playerActor]:null;this.refueling=false;
  if(e&&e.frame>=7){
   if(e.frame===15){this.refueling=true;this.fuel=Math.min(MAX_FUEL,this.fuel+512);if(this.refuelClock--<=0){this.emit(this.fuel>=MAX_FUEL?'full':'refuel');this.refuelClock=8;}}
   else{if(e.frame===14)this.gen.bridgeDestroyed=true;this.crash(e.frame===14?'Srážka s mostem.':'Srážka s nepřítelem.');this.destroy(e,3);return;}
  }
  if(c.playerBank||c.gunnerShot||c.tankShot&&this.tank.phase>=17){this.crash(c.playerBank?'Zásah břehu nebo ostrova.':'Zásah nepřátelskou střelou.');return;}
  if(this.fuel<32){this.crash('Došlo palivo.','fuel');return;}this.fuel-=32;
  p.controls=this.priorControls;flight(p,input);
  const hit=c.bulletActor>=0?this.gen.actors[c.bulletActor]:null,blast=c.blastActor>=0?this.gen.actors[c.blastActor]:null;
  let consumed=c.bulletBank;
  if(hit&&hit.frame>=7){this.destroy(hit);consumed=true;}
  else if(blast&&blast.frame>=8&&this.tank.phase>=17)this.destroy(blast,2,false);
  if(consumed)this.bullet=null;
  else if(this.bullet){if(this.bullet.y>=0)this.bullet.y-=6;else this.bullet=null;}
  if(input.fire&&!this.bullet&&!consumed){this.bullet={x:0,y:141};this.emit('shot');}
  if(this.bullet)this.bullet.x=(p.rawX-48)*2+8;
  if(!this.refueling)this.refuelClock=0;
 }
 step(input={}){
  if(this.paused||this.phase==='over')return;
  this.tick++;this.waterRed=!!(this.waterFlash&1);if(this.waterFlash)this.waterFlash--;
  // B0F1's memory clear spans thirteen additional VBIs with no foreground AI.
  if(this.phase==='clearing'){
   if(--this.clearFrames)return;
   this.phase='warmup';this.generate(2);this.warmFrames--;this.projectiles();this.pending=this.collisions();return;
  }
  this.combat();
  this.priorControls=this.player.controls;this.player.controls=15;
  for(const[key,bit]of [['up',1],['down',2],['left',4],['right',8]])if(input[key])this.player.controls&=15^bit;
  if(this.phase==='ready'){if(input.fire||input.left||input.right||input.up||input.down)this.start();}
  if(this.phase==='playing')this.play(input);
  else if(this.phase==='crash'){
   if(!((this.life+1)&7)&&this.player.pose)this.player.pose--;
   if(--this.life===127){
    if(!this.chooseNextPilot()){this.phase='over';this.emit('over');return;}
    this.resetFlight();
    this.phase='clearing';this.clearFrames=13;return;
   }
  }
  if(this.phase==='warmup'){
   if(this.warmFrames){this.life=47+this.warmFrames;this.generate(2);this.warmFrames--;}
   else{this.phase='ready';this.life=47;this.player.pose=9;}
  }
  this.projectiles();
  if(this.phase==='playing')this.scrollRiver();
  if(this.tank.rawY>=188){this.tank.frame=0;this.tank.rawY=0;}
  if(this.tank.shotY>=188){this.tank.phase=255;this.tank.picture=0;this.tank.shotY=0;}
  this.pending=this.collisions();
 }
}
function copyCheckpoint(c){return{stage:c.stage,seed:[...c.seed],center:c.center};}

root.RiverRaid={Game,Course,flight,planeBits,sprite,hitPixels,WIDTH,HEIGHT,HZ,MAX_FUEL};
})(globalThis);

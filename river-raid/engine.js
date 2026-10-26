/* Native River Raid flight and collision rules. Atari is an offline data oracle only. */
(function(root){
'use strict';
const WIDTH=320,HEIGHT=160,HZ=60,MAX_FUEL=65535;
const decode=s=>Uint8Array.from(root.atob(s),c=>c.charCodeAt(0));
class Course{
 constructor(a=root.RIVER_ASSETS){this.assets=a;this.dictionary=decode(a.dictionary);const bytes=decode(a.indices);this.indices=new Uint32Array(bytes.length/4);for(let i=0;i<this.indices.length;i++)this.indices[i]=bytes[i*4]|bytes[i*4+1]<<8|bytes[i*4+2]<<16|bytes[i*4+3]<<24;this.flags=decode(a.flags);}
 row(index){if(index<0||index>=this.indices.length)return null;const offset=this.indices[index]*40;return this.dictionary.subarray(offset,offset+40);}
 color(x,y){const row=this.row(y);if(!row||x<0||x>=320)return 0;const p=x>>1;return row[p>>2]>>(6-(p&3)*2)&3;}
 start(bridge){return this.assets.stages.find(s=>s.bridge===bridge)?.row||0;}
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
  this.course=options.course||new Course();this.assets=this.course.assets;this.mode=options.mode==='two'?'two':'solo';this.startBridge=[1,5,20,50].includes(Number(options.bridge))?Number(options.bridge):1;
  this.randomState=options.seed??0x52697665;this.tick=0;this.events=[];this.paused=false;this.phase='ready';this.wait=0;this.playerIndex=0;this.best=Number(options.best)||0;
  this.pilots=Array.from({length:this.mode==='two'?2:1},()=>({lives:4,score:0,nextLife:10000,bridge:this.startBridge,checkpoint:this.course.start(this.startBridge),destroyed:new Set()}));this.resetFlight();
 }
 get pilot(){return this.pilots[this.playerIndex];}get score(){return this.pilot.score;}get lives(){return this.pilot.lives;}get bridge(){return this.pilot.bridge;}
 emit(type,data={}){this.events.push({type,...data});}drainEvents(){return this.events.splice(0);}
 random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState>>>24;}
 resetFlight(){
  this.scroll=this.pilot.checkpoint;this.player={rawX:124,fraction:0,accel:0,speed:64,controls:15,pose:9,y:142};this.fuel=MAX_FUEL;this.bullet=null;this.enemies=[];this.explosions=[];this.shells=[];this.refueling=false;this.refuelClock=0;this.waterFlash=0;this.bridgeDestroyed=false;
  this.tank={frame:0,rawX:0,rawY:0,phase:255,picture:0,shotX:0,shotY:0,fraction:0,dx:2,fractionDX:0,follow:0};
  this.gunner={rawX:0,rawY:0,dx:0,bankCollision:false};
  this.pilot.destroyed.clear();
  const first=this.assets.objects.findIndex(o=>o.row>=this.scroll-40);this.nextObject=first<0?this.assets.objects.length:first;
  const tank=this.assets.tankCandidates.findIndex(o=>o.row>=this.scroll);this.nextTank=tank<0?this.assets.tankCandidates.length:tank;
  this.generated=159+Math.floor(this.scroll);
  if(this.scroll===0)this.enemies.push({id:-1,row:-1,worldY:22,type:14,frame:0,rawX:0,x:-96,flags:132,size:3,slot:10});
  this.spawn();this.emit('reset');
 }
 start(){if(this.phase==='ready'){this.phase='playing';this.emit('start');}}
 spawn(){
  const end=159+Math.floor(this.scroll);
  while(this.nextObject<this.assets.objects.length&&this.assets.objects[this.nextObject].row<=end){const i=this.nextObject++,e=this.assets.objects[i];if(e.flags&128)this.bridgeDestroyed=false;this.enemies.push({...e,id:i,frame:e.type,x:(e.rawX-48)*2});}
  while(this.nextTank<this.assets.tankCandidates.length&&this.assets.tankCandidates[this.nextTank].row<=end){
   const e=this.assets.tankCandidates[this.nextTank++];if(this.tank.frame===0){Object.assign(this.tank,e,{rawY:e.rawY+end-e.row,picture:0});if(e.follow&128)this.tank.phase=255;}
  }
 }
 screenY(e){return Math.floor(163+this.scroll-e.worldY);}
 slot(e){const wraps=r=>Math.floor((r+75)/256);return (e.slot??0)+wraps(this.generated)-wraps(e.row);}
 internalStage(){const n=Math.max(1,Math.floor((this.generated-31)/1024)+1);return n>80?79+((n-79)&1):n;}
 combat(){
  const actors=Array.from({length:11},()=>({frame:0,rawX:0,flags:0}));let first=11,nearest=11,newest=-Infinity;
  for(const e of this.enemies){const slot=this.slot(e);if(slot<0||slot>=11)continue;actors[slot]=e;first=Math.min(first,slot);if(e.row>newest){newest=e.row;nearest=this.generated-e.row<=this.assets.sprites[e.type].height+2?slot:11;}}
  root.RiverMechanics.updateCombat({tick:this.tick,tank:this.tank,actors,first,nearest,flip:Math.floor((this.generated+75)/256)&1,stage:this.internalStage(),playing:this.phase==='playing',bridgeDestroyed:this.bridgeDestroyed},this.tick%16===0?this.random():0,this.assets.mechanics);
  for(const e of this.enemies)e.x=(e.rawX-48)*2;
  const shooter=this.enemies.find(e=>e.type===10||e.type===11);
  if(root.RiverMechanics.updateGunner(this.gunner,shooter?{...shooter,rawY:this.screenY(shooter)+93}:null,this.phase==='playing'))this.emit('tank');
  const old=this.tank.phase;root.RiverMechanics.updateTankShot(this.tank,this.phase==='playing',this.assets.mechanics);if(old===0&&this.tank.picture)this.emit('tank');
 }
 addScore(n){const p=this.pilot;p.score=Math.min(999999,p.score+n);this.best=Math.max(this.best,p.score);while(p.score>=p.nextLife&&p.nextLife<=999999){p.nextLife+=10000;p.lives=Math.min(9,p.lives+1);this.emit('life');}}
 destroy(e){if(e.frame<7)return;e.frame=2;this.pilot.destroyed.add(e.id);let points=this.assets.scores[e.type]||0;this.emit('explosion');if(e.type===14){this.bridgeDestroyed=true;this.waterFlash=23;this.pilot.bridge++;this.pilot.checkpoint=Math.max(this.pilot.checkpoint,e.row+32);if(root.RiverMechanics.tankBonus(this.tank,e.rawX,this.bridge))points=750;this.emit('bridge');}this.addScore(points);}
 crash(reason){if(this.phase!=='playing')return;this.pilot.lives--;this.phase='crash';this.reason=reason;this.wait=85;this.explosions.push({x:(this.player.rawX-48)*2+8,y:this.player.y+5,age:0});this.emit('explosion');}
 chooseNextPilot(){if(this.mode==='two')for(let n=1;n<=2;n++){const i=(this.playerIndex+n)%2;if(this.pilots[i].lives>0){this.playerIndex=i;return true;}}return this.pilot.lives>0;}
 step(input={}){
  if(this.paused||this.phase==='over'||this.phase==='complete')return;
  if(this.phase==='ready'){if(input.fire||input.left||input.right||input.up||input.down)this.start();return;}
  this.tick++;for(const e of this.explosions)e.age++;this.explosions=this.explosions.filter(e=>e.age<38);
  if(this.waterFlash)this.waterFlash--;this.combat();
  if(this.phase==='crash'){if(--this.wait===0){if(this.chooseNextPilot()){this.resetFlight();this.phase='ready';}else{this.phase='over';this.emit('over');}}return;}
  flight(this.player,input);this.scroll+=this.player.speed/128;
  const rows=159+Math.floor(this.scroll)-this.generated;this.generated+=rows;this.tank.rawY=(this.tank.rawY+rows)&255;this.tank.shotY=(this.tank.shotY+rows)&255;this.gunner.rawY=(this.gunner.rawY+rows)&255;
  if(this.tank.rawY>=188){this.tank.frame=0;this.tank.rawY=0;}
  this.spawn();
  if(this.scroll+200>=this.course.indices.length){this.phase='complete';this.emit('complete');return;}
  this.fuel=Math.max(0,this.fuel-32);this.refueling=false;
  const p=this.player,px=(p.rawX-48)*2,bits=planeBits(this.assets,p.pose);
  // Original one-missile slot: a hit permits the next missile immediately.
  if(this.bullet){this.bullet.y-=6;if(this.bullet.y<0)this.bullet=null;}
  if(input.fire&&!this.bullet){this.bullet={x:px+8,y:141};this.emit('shot');}
  for(const e of this.enemies){
   const y=this.screenY(e),info=this.assets.sprites[e.type],current=root.RiverMechanics.actorPicture(this.assets,e),scale=info.width/8*2;
   if(this.bullet&&e.frame>=7&&this.bullet.x+2>=e.x&&this.bullet.x<e.x+info.width*2&&this.bullet.y<=y+info.height&&this.bullet.y+8>=y){
    // Pixel masks also let shots pass through the open sides of a balloon.
    if(hitPixels([128,128,128,128,128,128,128,128],2,this.bullet.x,this.bullet.y,current.bits,scale,e.x,y)){this.destroy(e);this.bullet=null;continue;}
   }
   if(y>170||y+info.height<0)continue;
   e.flags&=254;
   for(let yy=0;yy<current.bits.length;yy++)for(let xx=0;xx<8;xx++)if(current.bits[yy]&(128>>xx))for(let sx=0;sx<scale;sx++)if(this.course.color(Math.floor(e.x+xx*scale+sx),this.generated-y-yy)===1)e.flags|=1;
   if(e.frame>=7&&hitPixels(bits,2,px,p.y,current.bits,scale,e.x,y)){
    if(e.type===15){this.refueling=true;this.fuel=Math.min(MAX_FUEL,this.fuel+512);if(this.refuelClock--<=0){this.emit(this.fuel>=MAX_FUEL?'full':'refuel');this.refuelClock=8;}}
    else this.crash(e.type===14?'Most musíš nejdřív prostřelit.':'Srážka s nepřítelem.');
   }
  }
  this.enemies=this.enemies.filter(e=>this.screenY(e)<200&&this.slot(e)<11);
  const t=this.tank;t.bankCollision=false;const tankBits=this.assets.mechanics.tankFrames[t.frame&127];
  for(let yy=0;yy<tankBits.length;yy++)for(let xx=0;xx<8;xx++)if(tankBits[yy]&(128>>xx))for(let sx=0;sx<2;sx++)if(this.course.color((t.rawX-48)*2+xx*2+sx,this.generated-(t.rawY-28)-yy)===2)t.bankCollision=true;
  if(t.picture>=2&&hitPixels(bits,2,px,p.y,this.assets.mechanics.shotFrames[t.picture],2,(t.shotX-48)*2,t.shotY-28))this.crash('Výbuch střely tanku nad řekou.');
  const gun=this.gunner;gun.bankCollision=false;if(gun.rawX){const x=(gun.rawX-48)*2,y=gun.rawY-28;for(let xx=0;xx<4;xx++){const c=this.course.color(x+xx,this.generated-y);if(c===1||c===2)gun.bankCollision=true;}if(hitPixels(bits,2,px,p.y,[192],2,x,y))this.crash('Zásah střelou vrtulníku.');}
  if(this.bullet){const bank=this.course.color(this.bullet.x,Math.floor(159+this.scroll-this.bullet.y));if(bank===1||bank===2)this.bullet=null;}
  if(!this.refueling)this.refuelClock=0;
  // Compare the real silhouettes with the original indexed river, including islands.
  for(let yy=0;yy<bits.length&&this.phase==='playing';yy++)for(let xx=0;xx<8;xx++)if(bits[yy]&(128>>xx)){
   const x=px+xx*2,world=Math.floor(159+this.scroll-p.y-yy);
   // Original P2PF tests PF0 (green land); the dark shoreline is passable.
   if(x<0||x>=320||this.course.color(x,world)===1){this.crash('Zásah břehu nebo ostrova.');break;}
  }
  if(!this.fuel)this.crash('Došlo palivo. Zpomal nad další nádrží FUEL.');
 }
}
root.RiverRaid={Game,Course,flight,planeBits,sprite,hitPixels,WIDTH,HEIGHT,HZ,MAX_FUEL};
})(globalThis);

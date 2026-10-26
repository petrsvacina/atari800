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
  this.scroll=this.pilot.checkpoint;this.player={rawX:124,fraction:0,accel:0,speed:128,controls:15,pose:9,y:145};this.fuel=MAX_FUEL;this.bullet=null;this.enemies=[];this.explosions=[];this.shells=[];this.refueling=false;this.refuelClock=0;
  const first=this.assets.objects.findIndex(o=>o.row>=this.scroll-40);this.nextObject=first<0?this.assets.objects.length:first;this.spawn();this.emit('reset');
 }
 start(){if(this.phase==='ready'){this.phase='playing';this.emit('start');}}
 spawn(){while(this.nextObject<this.assets.objects.length&&this.assets.objects[this.nextObject].row<this.scroll+160){const i=this.nextObject++,e=this.assets.objects[i];if(!this.pilot.destroyed.has(i))this.enemies.push({...e,id:i,x:(e.rawX-48)*2,active:false,phase:0,shotClock:80+(i%61)});}}
 screenY(e){return Math.floor(159+this.scroll-e.worldY);}
 addScore(n){const p=this.pilot;p.score=Math.min(999999,p.score+n);this.best=Math.max(this.best,p.score);while(p.score>=p.nextLife&&p.nextLife<=999999){p.nextLife+=10000;p.lives=Math.min(9,p.lives+1);this.emit('life');}}
 destroy(e){if(e.dead)return;e.dead=true;this.pilot.destroyed.add(e.id);this.addScore(this.assets.scores[e.type]||0);this.explosions.push({x:e.x+this.assets.sprites[e.type].width,y:this.screenY(e)+4,age:0});this.emit('explosion');if(e.type===14){this.pilot.bridge++;this.pilot.checkpoint=Math.max(this.pilot.checkpoint,e.row+32);this.emit('bridge');}}
 crash(reason){if(this.phase!=='playing')return;this.pilot.lives--;this.phase='crash';this.reason=reason;this.wait=85;this.explosions.push({x:(this.player.rawX-48)*2+8,y:this.player.y+5,age:0});this.emit('explosion');}
 chooseNextPilot(){if(this.mode==='two')for(let n=1;n<=2;n++){const i=(this.playerIndex+n)%2;if(this.pilots[i].lives>0){this.playerIndex=i;return true;}}return this.pilot.lives>0;}
 step(input={}){
  if(this.paused||this.phase==='over'||this.phase==='complete')return;
  if(this.phase==='ready'){if(input.fire)this.start();return;}
  this.tick++;for(const e of this.explosions)e.age++;this.explosions=this.explosions.filter(e=>e.age<38);
  if(this.phase==='crash'){if(--this.wait===0){if(this.chooseNextPilot()){this.resetFlight();this.phase='ready';}else{this.phase='over';this.emit('over');}}return;}
  flight(this.player,input);this.scroll+=this.player.speed/128;this.spawn();
  if(this.scroll+200>=this.course.indices.length){this.phase='complete';this.emit('complete');return;}
  this.fuel=Math.max(0,this.fuel-32);this.refueling=false;
  const p=this.player,px=(p.rawX-48)*2,bits=planeBits(this.assets,p.pose);
  // Original one-missile slot: a hit permits the next missile immediately.
  if(this.bullet){this.bullet.y-=6;if(this.bullet.y<0)this.bullet=null;}
  if(input.fire&&!this.bullet){this.bullet={x:px+8,y:p.y};this.emit('shot');}
  if(this.tick%16===0&&this.enemies.length){const candidates=this.enemies.filter(e=>e.type!==14&&e.type!==15);if(candidates.length)candidates[this.random()%candidates.length].active=true;}
  for(const e of this.enemies){
   if(e.dead)continue;const y=this.screenY(e),info=this.assets.sprites[e.type];e.phase++;
   if(e.type<12&&this.tick%2===0&&e.type>=8)e.frame=(e.type&1)?e.type-1:e.type+1;
   if(e.type!==14&&e.type!==15&&(e.type===7||e.active&&((this.tick+e.id)&1)===0)&&(e.type!==12||!(this.tick&2))){
    const dx=e.flags&8?-2:2,nx=e.x+dx;
    if(e.type===7)e.x=nx<-8?328:nx>328?-8:nx;
    else if(this.course.color(Math.floor(nx+(dx>0?info.width*2:0)),Math.floor(e.worldY-info.height/2))===3)e.x=nx;
    else e.flags^=8;
   }
   const current=sprite(this.assets,e.frame||e.type,e.flags),scale=info.width/8*2;
   if(this.bullet&&this.bullet.x+2>=e.x&&this.bullet.x<e.x+info.width*2&&this.bullet.y<=y+info.height&&this.bullet.y+8>=y){
    // Pixel masks also let shots pass through the open sides of a balloon.
    if(hitPixels([128,128,128,128,128,128,128,128],2,this.bullet.x,this.bullet.y,current.bits,scale,e.x,y)){this.destroy(e);this.bullet=null;continue;}
   }
   if(y>170||y+info.height<0)continue;
   if(hitPixels(bits,2,px,p.y,current.bits,scale,e.x,y)){
    if(e.type===15){this.refueling=true;this.fuel=Math.min(MAX_FUEL,this.fuel+512);if(this.refuelClock--<=0){this.emit(this.fuel>=MAX_FUEL?'full':'refuel');this.refuelClock=8;}}
    else this.crash(e.type===14?'Most musíš nejdřív prostřelit.':'Srážka s nepřítelem.');
   }
   if((e.type===10||e.type===11)&&--e.shotClock<=0&&y>50&&y<130){e.shotClock=120;this.shells.push({x:e.x+(e.flags&8?-2:18),y,dx:e.flags&8?-3:3,age:0});this.emit('tank');}
  }
  this.enemies=this.enemies.filter(e=>!e.dead&&this.screenY(e)<200);
  for(const shell of this.shells){shell.x+=shell.dx;shell.age++;if(shell.age===45){this.explosions.push({x:shell.x,y:shell.y,age:0});if(Math.abs(shell.x-px-8)<14&&Math.abs(shell.y-p.y-7)<12)this.crash('Výbuch střely nad řekou.');}}
  this.shells=this.shells.filter(s=>s.age<50);
  if(this.bullet&&this.course.color(this.bullet.x,Math.floor(159+this.scroll-this.bullet.y))!==3)this.bullet=null;
  if(!this.refueling)this.refuelClock=0;
  // Compare the real silhouettes with the original indexed river, including islands.
  for(let yy=0;yy<bits.length&&this.phase==='playing';yy++)for(let xx=0;xx<8;xx++)if(bits[yy]&(128>>xx)){
   const x=px+xx*2,world=Math.floor(159+this.scroll-p.y-yy);
   if(this.course.color(x,world)!==3){this.crash('Zásah břehu nebo ostrova.');break;}
  }
  if(!this.fuel)this.crash('Došlo palivo. Zpomal nad další nádrží FUEL.');
 }
}
root.RiverRaid={Game,Course,flight,planeBits,sprite,hitPixels,WIDTH,HEIGHT,HZ,MAX_FUEL};
})(globalThis);

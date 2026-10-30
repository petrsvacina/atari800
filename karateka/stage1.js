/* Native outdoor campaign controller. Original routines $B801-$BB87,
 * $B260 camera boundaries and $B400/$B403 guard entrances.
 * Integration with later banks is deliberately a separate controller. */
(function(root){'use strict';
const {fighter,byte}=root.KaratekaMotion;
class Stage1 extends root.KaratekaBattle{
 constructor(seed=7){super();this.presentation=root.KaratekaPresentation?new root.KaratekaPresentation():null;this.reset(seed);}
 reset(seed=7){
  this.renderState=null;
  this.paletteState=root.KaratekaPalette?new root.KaratekaPalette():null;
  this.hero=fighter([7,7,11,0,0,0,0,0,0,0,255,0,1,0,0,255]);this.newEnemy();this.camera=new root.KaratekaCamera(1);
  this.max=[14,14];this.health=[14,14];this.restore=[0,0];this.restoreDelay=[30,30];this.alive=[1,1];this.hit=[0,0];this.results=[0,0];this.rules.random=byte(seed);this.rules.sound=this.rules.kick=this.rules.punch=0;
  this.input=new root.KaratekaInput();this.clock=0;this.buffer=64;this.guardStyle=0;this.kind=0;this.progress=0;this.marker=0;this.enemyWait=7;this.approachDelay=14;this.farDelay=15;this.deathDelay=0;this.climb=11;this.falling=0;this.cliffFall=0;this.cutRequested=0;this.mode='climb';this.phase='playing';this.events=[];this.climbFrames=[];this.fallFrames=[];this.hitSound=0;this.palette=0;this.hold=this.holdRequested=0;this.playerSide=this.enemySide=0;this.enemyProbabilities();
 }
 newEnemy(){const old=this.enemy;this.enemy=fighter([7,7,48,old?.drawX||0,old?.repeat||0,0,0,0,0,0,0,0,255,0,old?.spare2||0,255]);this.enemySide=0;}
 context(){super.context();this.rules.phase=this.progress;}
 enemyProbabilities(){const r=this.rules,d=r.data,i=this.guardStyle;r.kickChance=d.guardKick[i];r.punchChance=d.guardPunch[i];r.waitChance=d.guardWait[i];}
 emit(type,id){this.events.push({type,id});}
 poll(input){if(input.joystick)return this.input.joystick(this.rules,this.hero,input.joystick,{hawkActive:this.hawk?.active||0,hawkX:this.hawk?.x||80,hawkDx:this.hawk?.dx||80,enemyAlive:this.alive[1],kind:this.kind,enemyX:this.enemy.x});if(input.key!==undefined)this.input.key(input.key);this.input.keyboard(this.rules,this.hero);}
 advancePlayer(input){
  const h=this.hero,r=this.rules;this.context();
  if(!this.alive[1]){
   if(!this.deathDelay&&this.enemy.legs===19){if(h.torso===28||h.torso===29){h.torso=6;r.kick=r.punch=0;}}
   else{h.move=0;r.command(h,209);r.advance(h);return this.finishPlayer();}
  }
  if(h.x>=36){if(!this.playerSide||!this.alive[1]||this.enemy.x>=46){if(this.playerSide){if(this.alive[1])this.enemy.x=60;this.marker=100;}h.move=1;r.command(h,0);}else this.poll(input);}
  else this.poll(input);
  r.advance(h);this.finishPlayer();
 }
 finishPlayer(){if(this.hero.legFrame===21){this.hold=30;this.holdRequested=1;}if(!this.playerSide&&!this.camera.room&&byte(48-this.camera.offset+this.hero.x)<11)this.cliffFall=1;}
 cameraTick(){
  const c=this.camera,h=this.hero;Object.assign(c,{heroX:h.x,enemyX:this.enemy.x});
  const translate=amount=>{c.heroX=byte(c.heroX+amount);c.enemyX=byte(c.enemyX+amount);c.hawkX=byte(c.hawkX+amount);};
  if(h.x>=128||h.x<3){
   if(!c.room||c.room===this.playerSide){c.velocity=1;c.left();}
   else{c.room=byte(c.room-1);c.offset=27;translate(26);c.cloud=byte(c.cloud+2);}
  }else if(!c.room&&h.x>=33&&this.progress){c.room=1;c.offset=11;c.shift=0;translate(-26);c.cloud=byte(c.cloud-2);}
  else if(h.x>=42){if(c.room)this.emit('scene',2);else this.cutRequested=1;}
  else if((c.offset===27&&!c.shift&&h.x>=15)||(c.offset===11&&!c.shift&&h.x<15)||h.x===15)c.velocity=0;
  else if(h.x<15)c.left();else c.right(h.running,h.legFrame);
  h.x=c.heroX;this.enemy.x=c.enemyX;
 }
 beginEntrance(){
  const c=this.camera;this.saved={shift:c.shift,cloud:c.cloud,offset:c.offset,side:this.playerSide};this.newEnemy();this.marker=0;this.progress=1;this.enemy.x=byte(c.offset+20);this.enemySide=1;this.approachDelay=14;
  if(this.playerSide)return this.endEntrance();
  Object.assign(this.enemy,{legs:35,torso:30,legFrame:67,armFrame:46,legStep:1,armStep:1,move:1});c.cloud=23;c.offset=27;c.shift=0;this.playerSide=1;this.enemy.x=39;this.mode='entrance';
 }
 endEntrance(){const s=this.saved,c=this.camera;c.offset=s.offset;c.cloud=s.cloud;c.shift=s.shift;this.playerSide=s.side;this.newEnemy();this.enemy.x=byte(c.offset+20-(s.side?0:44));this.enemySide=1;this.mode='playing';this.alive[1]=1;this.enemyWait=25;this.rules.kick=this.rules.punch=0;}
 beginApproach(){const c=this.camera,e=this.enemy;this.saved={shift:c.shift,cloud:c.cloud,x:e.x,phase:c.shift&1,parity:e.x&1};c.cloud=15+(c.shift&1);e.x=24+(e.x&1);this.enemyWait=this.approachDelay;const next=byte(this.approachDelay-2);if(next>=5)this.approachDelay=next;this.mode='approach';}
 arrivalFrame(){
  // $B47F/$B520 present this guard-only shot before restoring the world
  // coordinates. Retain its last frame even when the routine returns here.
  this.renderState={...this,hero:{...this.hero},enemy:{...this.enemy},camera:{...this.camera},arrivalShot:true,renderEffects:[],renderState:null};
 }
 entranceTick(){
  const c=this.camera,e=this.enemy,r=this.rules;this.context();r.command(e,0);r.advance(e);
  if(this.mode==='entrance'){this.arrivalFrame();if(e.x<=(this.birdEnabled?5:this.guardStyle)*4+4)this.endEntrance();}
  else{
   for(const amount of [6,4]){let value=byte(c.shift+amount);if(value>=7){value-=7;e.x=byte(e.x+1);this.saved.x=byte(this.saved.x-1);c.cloud=byte(c.cloud+1);if(c.cloud===40)c.cloud=248;}c.shift=value;}
   this.arrivalFrame();
   if(this.enemyWait)this.enemyWait--;
   if(!this.enemyWait&&(c.shift&1)===this.saved.phase&&(e.x&1)===this.saved.parity){c.shift=this.saved.shift;c.cloud=this.saved.cloud;e.x=byte((this.saved.x&254)+this.saved.parity);this.mode='playing';this.enemyWait=25;this.farDelay=15;this.rules.kick=this.rules.punch=0;}
  }
 }
 continueMovie(){if(this.mode==='court'){this.progress=byte(this.progress+1);this.palette=1;if(this.paletteState)this.paletteState.selector=1;this.mode='playing';}}
 tick(input={}){
  this.renderState=null;this.events=[];if(this.phase!=='playing'||this.mode==='court')return;this.clock++;this.climbFrames=[];this.fallFrames=[];
  if(this.mode==='entrance'||this.mode==='approach'){this.entranceTick();this.endFrame();return;}
  if(this.climb){if(this.climb>=23){this.climb=0;this.mode='playing';this.emit('music',26);}else{this.climbFrames=[this.climb+1,this.climb+2];this.climb+=2;this.endFrame();return;}}
  const h=this.hero,e=this.enemy,r=this.rules,c=this.camera;
  if(this.falling===48){this.health[0]=this.alive[0]=0;this.emit('effect',7);this.phase='lost';return;}
  if(h.legs===19&&this.enemyWait&&(e.legs===19||e.legs===7||this.kind&&e.legs===6)){this.emit('music',22);this.phase='lost';return;}
  if(this.alive[0]&&this.marker&&this.progress){
   if(this.marker===20){if(c.room||c.offset<30||c.offset>=49){if(this.guardStyle<5)this.guardStyle++;this.enemyProbabilities();this.health[1]=this.max[1];this.restore[0]=0;this.emit('music',25);this.beginEntrance();if(this.mode==='entrance')this.entranceTick();this.endFrame();return;}}
   else this.marker=byte(this.marker+1);
  }
  if(this.alive[0]&&!this.enemyWait&&this.alive[1]&&(c.room||c.offset<30||c.offset>=49)){this.beginApproach();this.entranceTick();this.endFrame();return;}
  if(e.legs===19&&h.legs===6&&!this.marker&&this.alive[0]){this.deathDelay=this.marker=1;this.restoreDelay[0]=2;if(this.max[0]>=10){this.max[0]--;this.max[1]++;if(this.health[0]>this.max[0]){this.health[0]=this.max[0];this.restore[1]=0;}}}
  if(!this.falling){if(this.cliffFall){this.falling=31;this.alive[0]=0;h.legs=19;}else this.advancePlayer(input);}
  if(!this.playerSide&&!this.enemySide&&byte(e.x-h.x)>=60&&byte(48-c.offset+e.x)>=80){if(h.move===1)this.farDelay=15;else if(!(--this.farDelay))this.enemyWait=1;this.enemyWait=byte(this.enemyWait-1);}
  this.context();if(this.kind<2&&(this.buffer===32||e.legFrame>=14||!e.legStep)){r.ai(e);r.advance(e);}
  this.context();this.results=[0,0];if(this.alive[0]&&this.alive[1]){this.results[1]=r.contact(e.legs,h.contact,r.distance,false);this.context();if(this.buffer===32)this.results[0]=r.contact(h.legs,e.contact,r.distance,true);this.damage();}
  this.heal();this.cameraTick();
  if(this.cutRequested){this.cutRequested--;if(!this.progress&&this.marker){this.mode='court';this.emit('movie','court');return;}}
  this.side(h,0);this.side(e,1);
  if(this.falling){let n=this.falling+1;if(n<35){this.fallFrames=[n,n+1];n++;}this.falling=n;}
  this.endFrame();
 }
 endFrame(){
  if(this.camera.scene===1){this.paletteState?.update(this.renderState||this);if(this.renderState)this.palette=this.renderState.palette;}
  const bump=this.events.some(e=>e.type==='bump'),gate=this.events.some(e=>e.type==='gate');this.events=this.events.filter(e=>e.type!=='bump'&&e.type!=='gate');
  if(this.health[0]&&!(this.camera.scene===4&&this.kind===2)){if(this.health[0]<3){if(!this.lowHealth){this.emit('music',21);this.lowHealth=true;}}else this.lowHealth=false;}
  this.renderEffects=this.presentation?this.presentation.effects(this):[];
  if(bump){this.rules.sound=0;this.results[1]=0;this.hit=[0,0];this.emit('effect',13);}
  else{
   if(this.hit[0]){this.hit[0]--;this.rules.sound=0;this.emit('effect',this.hitSound);}
   if(this.hit[1]){this.hit[1]--;this.rules.sound=0;this.emit('effect',this.results[1]===1?3:this.hitSound);}
   if(this.deathDelay){this.deathDelay--;if(!this.deathDelay)this.emit('music',23);else this.deathDelay=byte(this.deathDelay-1);}
   if(this.rules.sound)this.emit('effect',this.rules.sound);
  }
  this.rules.sound=0;if(gate)this.emit('gate',7);
  const incoming=!!this.renderState||this.mode==='entrance'||this.mode==='approach',f=this.renderState?.enemy||(incoming?this.enemy:this.hero);
  if(f.legs===36||f.legFrame===74||f.legFrame===75)this.emit('effect',incoming?10:11);
  if(this.holdRequested){this.emit('wait',this.hold);this.holdRequested=0;}
  this.buffer^=96;if(this.renderState)this.renderState.buffer=this.buffer;this.context();
 }

}
root.KaratekaStage1=Stage1;
})(globalThis);
